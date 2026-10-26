/*
 * Tests the write path directly, against a throwaway fixture file and a
 * mocked embedding provider -- never the real src/data/knowledgeBase.json
 * or a real embedding call. The HTTP route (auth, validation, status
 * codes) is covered separately in tests/knowledgeBase.test.js with this
 * whole service mocked out.
 */

jest.mock('../src/services/rag/embeddingService');

const fs = require('fs');
const os = require('os');
const path = require('path');

const { embedDocuments, getModelInfo } = require('../src/services/rag/embeddingService');
const { sequelize, KbChunk } = require('../src/models');
const {
  createKnowledgeBaseWriteService,
} = require('../src/services/knowledgeBaseWriteService');

afterAll(async () => {
  await sequelize.close();
});

function writeFixture(articles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-write-test-'));
  const filePath = path.join(dir, 'knowledgeBase.json');
  fs.writeFileSync(filePath, JSON.stringify(articles, null, 2));
  return filePath;
}

const SEED_ARTICLES = [
  { id: 1, title: 'Reset a forgotten password', category: 'Account', content: 'Existing content.' },
  { id: 5, title: 'VPN connection issues', category: 'Network', content: 'Existing content.' },
];

describe('knowledgeBaseWriteService.saveWebResultToKnowledgeBase', () => {
  const originalProvider = process.env.KNOWLEDGE_BASE_PROVIDER;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.KNOWLEDGE_BASE_PROVIDER;
    getModelInfo.mockReturnValue({ name: 'ollama:nomic-embed-text', dimensions: 4 });
    embedDocuments.mockImplementation((texts) => Promise.resolve(texts.map(() => [0.1, 0.2, 0.3, 0.4])));
  });

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.KNOWLEDGE_BASE_PROVIDER;
    } else {
      process.env.KNOWLEDGE_BASE_PROVIDER = originalProvider;
    }
  });

  it('appends a new article with the next id, category and a source footer', async () => {
    const filePath = writeFixture(SEED_ARTICLES);
    const { saveWebResultToKnowledgeBase } = createKnowledgeBaseWriteService(filePath);

    const article = await saveWebResultToKnowledgeBase({
      title: 'Fix a stuck print queue on Windows 11',
      url: 'https://support.example.com/windows/print-queue',
      snippet: 'Restart the Print Spooler service, then resend the job.',
      category: 'Hardware',
    });

    expect(article.id).toBe(6);
    expect(article.title).toBe('Fix a stuck print queue on Windows 11');
    expect(article.category).toBe('Hardware');
    expect(article.content).toContain('Restart the Print Spooler service');
    expect(article.content).toContain('Source: https://support.example.com/windows/print-queue');

    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(onDisk).toHaveLength(3);
    expect(onDisk[2].id).toBe(6);
  });

  it('defaults to category Other when none, or an invalid one, is given', async () => {
    const filePath = writeFixture(SEED_ARTICLES);
    const { saveWebResultToKnowledgeBase } = createKnowledgeBaseWriteService(filePath);

    const article = await saveWebResultToKnowledgeBase({
      title: 'Some result',
      url: 'https://example.com/page',
      snippet: '',
      category: 'NotARealCategory',
    });

    expect(article.category).toBe('Other');
  });

  it('chunks, embeds and stores the article so it is immediately searchable', async () => {
    const filePath = writeFixture(SEED_ARTICLES);
    const { saveWebResultToKnowledgeBase } = createKnowledgeBaseWriteService(filePath);

    const article = await saveWebResultToKnowledgeBase({
      title: 'Fix a stuck print queue on Windows 11',
      url: 'https://support.example.com/windows/print-queue',
      snippet: 'Restart the Print Spooler service, then resend the job.',
      category: 'Hardware',
    });

    expect(embedDocuments).toHaveBeenCalled();

    const rows = await KbChunk.findAll({ where: { articleId: article.id }, raw: true });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].articleTitle).toBe('Fix a stuck print queue on Windows 11');
    expect(rows[0].embeddingModel).toBe('ollama:nomic-embed-text');
  });

  it('refuses when a non-local-json provider is active', async () => {
    process.env.KNOWLEDGE_BASE_PROVIDER = 'acme-crm';

    const filePath = writeFixture(SEED_ARTICLES);
    const { saveWebResultToKnowledgeBase } = createKnowledgeBaseWriteService(filePath);

    await expect(
      saveWebResultToKnowledgeBase({
        title: 'Anything',
        url: 'https://example.com',
        snippet: '',
      })
    ).rejects.toMatchObject({ statusCode: 501 });

    expect(embedDocuments).not.toHaveBeenCalled();
  });

  it('leaves the knowledge-base file untouched when embedding fails', async () => {
    const filePath = writeFixture(SEED_ARTICLES);
    const { saveWebResultToKnowledgeBase } = createKnowledgeBaseWriteService(filePath);

    embedDocuments.mockRejectedValue(new Error('Ollama is not reachable'));

    await expect(
      saveWebResultToKnowledgeBase({
        title: 'A result that fails to embed',
        url: 'https://support.example.com/windows/print-queue',
        snippet: 'Restart the Print Spooler service.',
        category: 'Hardware',
      })
    ).rejects.toThrow('Ollama is not reachable');

    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(onDisk).toEqual(SEED_ARTICLES);

    const rows = await KbChunk.findAll({ where: { articleTitle: 'A result that fails to embed' } });
    expect(rows).toHaveLength(0);
  });

  it('leaves the knowledge-base file untouched when the chunk insert fails', async () => {
    const filePath = writeFixture(SEED_ARTICLES);
    const { saveWebResultToKnowledgeBase } = createKnowledgeBaseWriteService(filePath);

    // A dimension mismatch is a realistic way for the insert itself to
    // fail even though embedding "succeeded" -- e.g. a misconfigured
    // provider returning the wrong vector length.
    embedDocuments.mockResolvedValue([[0.1, 0.2]]);
    getModelInfo.mockReturnValue({ name: 'ollama:nomic-embed-text', dimensions: 4 });

    jest.spyOn(KbChunk, 'bulkCreate').mockRejectedValueOnce(new Error('insert failed'));

    await expect(
      saveWebResultToKnowledgeBase({
        title: 'Another web result',
        url: 'https://example.com/other',
        snippet: 'Some snippet.',
        category: 'Hardware',
      })
    ).rejects.toThrow('insert failed');

    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(onDisk).toEqual(SEED_ARTICLES);

    KbChunk.bulkCreate.mockRestore();
  });
});
