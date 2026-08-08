const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUser, uniqueEmail } = require('./helpers/testHelpers');

afterAll(async () => {
  await sequelize.close();
});

describe('POST /auth/register', () => {
  it('registers a new user and always forces role=customer, regardless of body', async () => {
    const email = uniqueEmail('register');

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'New User', email, password: 'Password123!', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail('dup');
    await request(app).post('/auth/register').send({ name: 'First', email, password: 'Password123!' });

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Second', email, password: 'Password123!' });

    expect(res.status).toBe(409);
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Weak Pw', email: uniqueEmail('weak'), password: 'short' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid email with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Bad Email', email: 'not-an-email', password: 'Password123!' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials and returns a usable token', async () => {
    const email = uniqueEmail('login');
    await request(app).post('/auth/register').send({ name: 'Login User', email, password: 'Password123!' });

    const loginRes = await request(app).post('/auth/login').send({ email, password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toEqual(expect.any(String));

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(email);
  });

  it('rejects an incorrect password with 401', async () => {
    const email = uniqueEmail('wrongpw');
    await request(app).post('/auth/register').send({ name: 'Wrong Pw', email, password: 'Password123!' });

    const res = await request(app).post('/auth/login').send({ email, password: 'WrongPassword1!' });
    expect(res.status).toBe(401);
  });

  it('rejects a nonexistent email with 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: uniqueEmail('ghost'), password: 'Password123!' });

    expect(res.status).toBe(401);
  });

  it('rejects login for a deactivated account with 401', async () => {
    const password = 'Password123!';
    const user = await createUser({ role: 'customer', password, isActive: false });

    const res = await request(app).post('/auth/login').send({ email: user.email, password });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('rejects a request with no token with 401', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed/invalid token with 401', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
