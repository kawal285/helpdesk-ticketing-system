jest.mock('../src/services/knowledgeBaseWriteService', () => ({
  saveWebResultToKnowledgeBase: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');
const {
  saveWebResultToKnowledgeBase,
} = require('../src/services/knowledgeBaseWriteService');

afterAll(async () => {
  await sequelize.close();
});

describe('Knowledge-base API', () => {
  test('rejects an unauthenticated request with 401', async () => {
    const response = await request(app).get('/knowledge-base');

    expect(response.statusCode).toBe(401);
  });

  test('GET /knowledge-base returns all articles', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const response = await request(app)
      .get('/knowledge-base')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBeGreaterThan(0);
    expect(Array.isArray(response.body.articles)).toBe(true);
  });

  test('GET /knowledge-base/search returns a relevant printer article', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const response = await request(app)
      .get('/knowledge-base/search?q=printer')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.query).toBe('printer');
    expect(response.body.count).toBeGreaterThan(0);
    expect(response.body.articles[0].title.toLowerCase()).toContain(
      'printer'
    );
    expect(response.body.articles[0].score).toBeGreaterThan(0);
  });

  test('GET /knowledge-base/search rejects a missing query', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const response = await request(app)
      .get('/knowledge-base/search')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      'A non-empty search query is required.'
    );
  });

  test('GET /knowledge-base/:id returns one article', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const response = await request(app)
      .get('/knowledge-base/1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.article.id).toBe(1);
    expect(response.body.article.title).toBeTruthy();
  });

  test('GET /knowledge-base/:id returns 404 for an unknown article', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const response = await request(app)
      .get('/knowledge-base/999')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe(
      'Knowledge-base article not found.'
    );
  });

  test('search is case-insensitive', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const response = await request(app)
      .get('/knowledge-base/search?q=PRINTER')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBeGreaterThan(0);
    expect(response.body.articles[0].title.toLowerCase()).toContain(
      'printer'
    );
  });
});

describe('POST /knowledge-base/save-web-result', () => {
  const VALID_BODY = {
    title: 'Fix a stuck print queue on Windows 11',
    url: 'https://support.example.com/windows/print-queue',
    snippet: 'Restart the Print Spooler service, then resend the job.',
    category: 'Hardware',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects an unauthenticated request with 401', async () => {
    const response = await request(app)
      .post('/knowledge-base/save-web-result')
      .send(VALID_BODY);

    expect(response.statusCode).toBe(401);
    expect(saveWebResultToKnowledgeBase).not.toHaveBeenCalled();
  });

  test('rejects a customer with 403', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const response = await request(app)
      .post('/knowledge-base/save-web-result')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY);

    expect(response.statusCode).toBe(403);
    expect(saveWebResultToKnowledgeBase).not.toHaveBeenCalled();
  });

  test('rejects an invalid url with 400', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });

    const response = await request(app)
      .post('/knowledge-base/save-web-result')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_BODY, url: 'not-a-url' });

    expect(response.statusCode).toBe(400);
    expect(saveWebResultToKnowledgeBase).not.toHaveBeenCalled();
  });

  test('rejects a missing title with 400', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });

    const response = await request(app)
      .post('/knowledge-base/save-web-result')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_BODY, title: '' });

    expect(response.statusCode).toBe(400);
    expect(saveWebResultToKnowledgeBase).not.toHaveBeenCalled();
  });

  test('lets an agent save a web result, returning the created article', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });

    saveWebResultToKnowledgeBase.mockResolvedValue({
      id: 24,
      title: VALID_BODY.title,
      category: 'Hardware',
      source: 'web',
      sourceUrl: VALID_BODY.url,
    });

    const response = await request(app)
      .post('/knowledge-base/save-web-result')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY);

    expect(response.statusCode).toBe(201);
    expect(response.body.article.id).toBe(24);
    expect(saveWebResultToKnowledgeBase).toHaveBeenCalledWith({
      title: VALID_BODY.title,
      url: VALID_BODY.url,
      snippet: VALID_BODY.snippet,
      category: VALID_BODY.category,
    });
  });

  test('lets an admin save a web result too', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });

    saveWebResultToKnowledgeBase.mockResolvedValue({ id: 25, title: VALID_BODY.title });

    const response = await request(app)
      .post('/knowledge-base/save-web-result')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY);

    expect(response.statusCode).toBe(201);
  });

  test('reports a non-local-json provider as 501 rather than a generic 500', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });

    const error = new Error('Saving needs the local-json provider.');
    error.statusCode = 501;
    saveWebResultToKnowledgeBase.mockRejectedValue(error);

    const response = await request(app)
      .post('/knowledge-base/save-web-result')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY);

    expect(response.statusCode).toBe(501);
  });
});
