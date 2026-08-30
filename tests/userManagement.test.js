const request = require('supertest');
const app = require('../src/app');
const { Op } = require('sequelize');
const { sequelize, User } = require('../src/models');
const { createUser, createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs, assignTicket } = require('./helpers/ticketHelpers');

afterAll(async () => {
  await sequelize.close();
});

describe('User management access control', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects an agent with 403', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });
    const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /users', () => {
  it('lists every user for an admin', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    await createUser({ role: 'customer' });
    await createUser({ role: 'agent' });

    const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(3);
    expect(res.body.users.every((user) => !('passwordHash' in user))).toBe(true);
  });

  it('filters by role when a role query is given', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    await createUser({ role: 'agent' });

    const res = await request(app)
      .get('/users?role=agent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    expect(res.body.users.every((user) => user.role === 'agent')).toBe(true);
  });
});

describe('POST /users', () => {
  it('lets an admin create an agent account', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Agent',
        email: 'new.agent@example.com',
        password: 'Password123!',
        role: 'agent',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'New Agent', email: 'new.agent@example.com', role: 'agent' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('lets an admin create another admin account', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Admin',
        email: 'new.admin@example.com',
        password: 'Password123!',
        role: 'admin',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects role=customer -- only self-registration creates customers', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Should Fail',
        email: 'should.fail@example.com',
        password: 'Password123!',
        role: 'customer',
      });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email with 409', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const existing = await createUser({ role: 'agent' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Duplicate',
        email: existing.email,
        password: 'Password123!',
        role: 'agent',
      });

    expect(res.status).toBe(409);
  });

  it('rejects a non-admin with 403', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Should Fail',
        email: 'nope@example.com',
        password: 'Password123!',
        role: 'agent',
      });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /users/:id/role', () => {
  it('changes a customer to an agent', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const target = await createUser({ role: 'customer' });

    const res = await request(app)
      .patch(`/users/${target.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'agent' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('agent');
  });

  it('blocks demoting the last active admin', async () => {
    const { user, token } = await createUserWithToken({ role: 'admin' });
    // Earlier tests in this run have created other admins; deactivate them
    // so this admin is provably the only active one, isolating the guard.
    await User.update(
      { isActive: false },
      { where: { role: 'admin', isActive: true, id: { [Op.ne]: user.id } } }
    );

    const res = await request(app)
      .patch(`/users/${user.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'agent' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last active admin/i);
  });

  it('allows demoting an admin when another active admin exists', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const target = await createUser({ role: 'admin' });

    const res = await request(app)
      .patch(`/users/${target.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'agent' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('agent');
  });

  it('unassigns that agent\'s open tickets when they are moved off the agent role', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent } = await createUserWithToken({ role: 'agent' });
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });

    const createRes = await createTicketAs(customerToken);
    const ticketId = createRes.body.ticket.id;
    // Assign as admin (not the agent) so this is deterministic regardless
    // of which agent auto-routing picked when the ticket was created.
    await assignTicket(adminToken, ticketId, agent.id);

    await request(app)
      .patch(`/users/${agent.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'customer' });

    const ticketRes = await request(app)
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(ticketRes.body.ticket.assigneeId).toBeNull();
  });

  it('returns 404 for a non-existent user', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });

    const res = await request(app)
      .patch('/users/999999/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'agent' });

    expect(res.status).toBe(404);
  });

  it('rejects a non-admin with 403', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });
    const target = await createUser({ role: 'customer' });

    const res = await request(app)
      .patch(`/users/${target.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'agent' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /users/:id/deactivate', () => {
  it('deactivates a user', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const target = await createUser({ role: 'customer' });

    const res = await request(app)
      .patch(`/users/${target.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
  });

  it('blocks deactivating the last active admin', async () => {
    const { user, token } = await createUserWithToken({ role: 'admin' });
    await User.update(
      { isActive: false },
      { where: { role: 'admin', isActive: true, id: { [Op.ne]: user.id } } }
    );

    const res = await request(app)
      .patch(`/users/${user.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last active admin/i);
  });

  it('allows deactivating an admin when another active admin exists', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const target = await createUser({ role: 'admin' });

    const res = await request(app)
      .patch(`/users/${target.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
  });

  it('unassigns a deactivated agent\'s open tickets', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent } = await createUserWithToken({ role: 'agent' });
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });

    const createRes = await createTicketAs(customerToken);
    const ticketId = createRes.body.ticket.id;
    await assignTicket(adminToken, ticketId, agent.id);

    await request(app)
      .patch(`/users/${agent.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    const ticketRes = await request(app)
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(ticketRes.body.ticket.assigneeId).toBeNull();
  });

  it('returns 404 for a non-existent user', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });

    const res = await request(app)
      .patch('/users/999999/deactivate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('rejects a non-admin with 403', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });
    const target = await createUser({ role: 'customer' });

    const res = await request(app)
      .patch(`/users/${target.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
