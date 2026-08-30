const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUser, createUserWithToken } = require('./helpers/testHelpers');

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
