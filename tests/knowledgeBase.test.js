const request = require('supertest');
const app = require('../src/app');

describe('Knowledge-base API', () => {
  test('GET /knowledge-base returns all articles', async () => {
    const response = await request(app).get('/knowledge-base');

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBeGreaterThan(0);
    expect(Array.isArray(response.body.articles)).toBe(true);
  });

  test('GET /knowledge-base/search returns a relevant printer article', async () => {
    const response = await request(app).get(
      '/knowledge-base/search?q=printer'
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.query).toBe('printer');
    expect(response.body.count).toBeGreaterThan(0);
    expect(response.body.articles[0].title.toLowerCase()).toContain(
      'printer'
    );
    expect(response.body.articles[0].score).toBeGreaterThan(0);
  });

  test('GET /knowledge-base/search rejects a missing query', async () => {
    const response = await request(app).get('/knowledge-base/search');

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      'A non-empty search query is required.'
    );
  });

  test('GET /knowledge-base/:id returns one article', async () => {
    const response = await request(app).get('/knowledge-base/1');

    expect(response.statusCode).toBe(200);
    expect(response.body.article.id).toBe(1);
    expect(response.body.article.title).toBeTruthy();
  });

  test('GET /knowledge-base/:id returns 404 for an unknown article', async () => {
    const response = await request(app).get('/knowledge-base/999');

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe(
      'Knowledge-base article not found.'
    );
  });

  test('search is case-insensitive', async () => {
    const response = await request(app).get(
      '/knowledge-base/search?q=PRINTER'
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBeGreaterThan(0);
    expect(response.body.articles[0].title.toLowerCase()).toContain(
      'printer'
    );
  });
});