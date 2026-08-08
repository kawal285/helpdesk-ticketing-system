const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

afterAll(async () => {
  await sequelize.close();
});

describe('GET /health', () => {
  it('reports ok status with a connected database', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(typeof res.body.uptime).toBe('number');
  });
});
