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
