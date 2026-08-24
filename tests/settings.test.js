const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');

afterAll(async () => {
  await sequelize.close();
});

describe('GET /settings', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const res = await request(app).get('/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects an agent with 403', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });
    const res = await request(app).get('/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns the current system configuration for an admin', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const res = await request(app).get('/settings').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      email: { configured: expect.any(Boolean) },
      knowledgeBase: { provider: expect.any(String) },
      sla: { Critical: 4, High: 8, Medium: 24, Low: 72, Trivial: 120 },
      tickets: {
        statuses: ['Open', 'In Progress', 'Resolved', 'Closed'],
        statusLabels: expect.any(Object),
        categories: ['Hardware', 'Software', 'Network', 'Account', 'Other'],
        priorities: ['Trivial', 'Low', 'Medium', 'High', 'Critical'],
        defaultPriority: 'Trivial',
      },
      organizations: ['Future Skills', 'OP'],
    });
  });
});

describe('POST /settings/verify-email', () => {
  it('rejects a non-admin with 403', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });
    const res = await request(app).post('/settings/verify-email').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns a clean unverified result when SMTP is not configured, without erroring', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const res = await request(app).post('/settings/verify-email').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.verified).toBe(false);
    expect(res.body.message).toMatch(/SMTP is not configured/);
  });
});
