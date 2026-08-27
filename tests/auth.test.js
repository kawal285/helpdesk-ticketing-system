const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUser, createUserWithToken, uniqueEmail } = require('./helpers/testHelpers');

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
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with 400', async () => {
    const email = uniqueEmail('dup');
    await request(app).post('/auth/register').send({ name: 'First', email, password: 'Password123!' });

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Second', email, password: 'Password123!' });

    expect(res.status).toBe(400);
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
    expect(meRes.body.data.user.email).toBe(email);
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

describe('PATCH /auth/change-password', () => {
  it('rejects a request with no token with 401', async () => {
    const res = await request(app)
      .patch('/auth/change-password')
      .send({ currentPassword: 'x', newPassword: 'newpassword1' });

    expect(res.status).toBe(401);
  });

  it('rejects a new password under 8 characters with 400', async () => {
    const password = 'Password123!';
    const { token } = await createUserWithToken({ role: 'customer', password });

    const res = await request(app)
      .patch('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'short' });

    expect(res.status).toBe(400);
  });

  it('rejects the wrong current password with 401, and does not change anything', async () => {
    const password = 'Password123!';
    const { user, token } = await createUserWithToken({ role: 'customer', password });

    const res = await request(app)
      .patch('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'TotallyWrong1', newPassword: 'BrandNewPass1' });

    expect(res.status).toBe(401);

    // Old password still works -- nothing was changed.
    const login = await request(app).post('/auth/login').send({ email: user.email, password });
    expect(login.status).toBe(200);
  });

  it('changes the password, so the old one stops working and the new one logs in', async () => {
    const oldPassword = 'Password123!';
    const newPassword = 'BrandNewPass1';
    const { user, token } = await createUserWithToken({ role: 'customer', password: oldPassword });

    const res = await request(app)
      .patch('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: oldPassword, newPassword });

    expect(res.status).toBe(200);

    const oldLogin = await request(app).post('/auth/login').send({ email: user.email, password: oldPassword });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/auth/login').send({ email: user.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it('works for every role, not just customers', async () => {
    const oldPassword = 'Password123!';
    const newPassword = 'BrandNewPass1';
    const { user, token } = await createUserWithToken({ role: 'agent', password: oldPassword });

    const res = await request(app)
      .patch('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: oldPassword, newPassword });

    expect(res.status).toBe(200);

    const newLogin = await request(app).post('/auth/login').send({ email: user.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });
});
