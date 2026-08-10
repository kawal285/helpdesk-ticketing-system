const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUserWithToken, uniqueEmail } = require('./helpers/testHelpers');

afterAll(async () => {
  await sequelize.close();
});

describe('/users (admin-only)', () => {
  it('rejects customers and agents with 403', async () => {
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });
    const { token: agentToken } = await createUserWithToken({ role: 'agent' });

    const asCustomer = await request(app).get('/users').set('Authorization', `Bearer ${customerToken}`);
    const asAgent = await request(app).get('/users').set('Authorization', `Bearer ${agentToken}`);

    expect(asCustomer.status).toBe(403);
    expect(asAgent.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  it('lets an admin create an agent account', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const email = uniqueEmail('newagent');

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Agent', email, password: 'Password123!', role: 'agent' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('agent');
  });

  it('rejects creating a customer account via this endpoint with 400', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Should Fail', email: uniqueEmail('badrole'), password: 'Password123!', role: 'customer' });

    expect(res.status).toBe(400);
  });

  it('lists users and supports filtering by role', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    await createUserWithToken({ role: 'agent' });

    const res = await request(app).get('/users?role=agent').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThan(0);
    expect(res.body.users.every((u) => u.role === 'agent')).toBe(true);
  });

  it("lets an admin change a user's role", async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: target } = await createUserWithToken({ role: 'customer' });

    const res = await request(app)
      .patch(`/users/${target.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'agent' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('agent');
  });

  it('returns 404 when changing the role of a nonexistent user', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });

    const res = await request(app)
      .patch('/users/999999/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'agent' });

    expect(res.status).toBe(404);
  });

  it('deactivates a user, immediately invalidating their existing token', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: target, token: targetToken } = await createUserWithToken({ role: 'customer' });

    const deactivateRes = await request(app)
      .patch(`/users/${target.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.user.isActive).toBe(false);

    const meRes = await request(app).get('/auth/me').set('Authorization', `Bearer ${targetToken}`);
    expect(meRes.status).toBe(401);
  });
});
