const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');
const {
  getProvider,
  registerProvider,
  resetProviderCache,
} = require('../src/services/knowledgeBaseProviders');

afterAll(async () => {
  await sequelize.close();
});

// Mirrors tests/ticketProviderSwap.test.js: this is the actual guarantee
// the "plug and play with a different knowledge base / CRM" story asks
// for -- a completely new provider becomes the one backing real HTTP
// requests purely through registration + config, with zero changes to
// the routes or knowledgeBaseService.js. If this passes, article lookup
// is provably not locked into the local JSON file.
//
// Deliberately never calls jest.resetModules() -- app (required above)
// already loaded knowledgeBaseService.js, which already loaded
// knowledgeBaseProviders once, and this file registers directly onto that
// same cached instance. See tests/ticketProviderSwap.test.js for why a
// reset here would silently register onto a disconnected registry.
describe('knowledge-base provider swap reaches real HTTP requests', () => {
  const ORIGINAL_ENV = process.env.KNOWLEDGE_BASE_PROVIDER;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.KNOWLEDGE_BASE_PROVIDER;
    } else {
      process.env.KNOWLEDGE_BASE_PROVIDER = ORIGINAL_ENV;
    }

    resetProviderCache();
  });

  it('lets an entirely new provider back real knowledge-base requests via registration + config alone', async () => {
    const fakeCrmArticle = {
      id: 'crm-1',
      title: 'From the fake CRM',
      content: 'This article lives entirely outside the local JSON file.',
      tags: ['fake-crm'],
    };

    registerProvider('fake-crm', () => ({
      listAll: () => [fakeCrmArticle],
      search: () => [fakeCrmArticle],
      getById: (id) => (id === fakeCrmArticle.id ? fakeCrmArticle : undefined),
    }));

    process.env.KNOWLEDGE_BASE_PROVIDER = 'fake-crm';
    resetProviderCache();

    expect(getProvider().listAll()).toEqual([fakeCrmArticle]);

    const { token } = await createUserWithToken({ role: 'customer' });

    const listRes = await request(app).get('/knowledge-base').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.articles).toEqual([fakeCrmArticle]);

    const searchRes = await request(app)
      .get('/knowledge-base/search?q=anything')
      .set('Authorization', `Bearer ${token}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.articles).toEqual([fakeCrmArticle]);

    const getRes = await request(app)
      .get(`/knowledge-base/${fakeCrmArticle.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.article).toEqual(fakeCrmArticle);
  });
});
