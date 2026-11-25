
jest.mock('../src/models', () => ({
  KbChunk: {
    findAll: jest.fn(),
  },
}));

jest.mock('../src/services/rag/embeddingService', () => ({
  embedQuery: jest.fn(),
  getModelInfo: jest.fn(),
}));

jest.mock('../src/services/rag/similarity', () => ({
  cosineSimilarity: jest.fn(),
}));

const { KbChunk } = require('../src/models');
const {
  embedQuery,
  getModelInfo,
} = require('../src/services/rag/embeddingService');
const {
  cosineSimilarity,
} = require('../src/services/rag/similarity');

const {
  retrieve,
  refresh,
} = require('../src/services/rag/retrievalService');

describe('Knowledge-base retrieval access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refresh();

    getModelInfo.mockReturnValue({
      name: 'test-model',
      dimensions: 2,
    });

    embedQuery.mockResolvedValue([1, 0]);

    cosineSimilarity.mockImplementation(
      (query, embedding) => embedding[0]
    );

    KbChunk.findAll.mockResolvedValue([
      {
        id: 1,
        articleId: 1,
        articleTitle: 'Public article',
        category: 'Account',
        audience: 'All',
        heading: 'Overview',
        text: 'Public information',
        embedding: [0.9, 0.1],
        embeddingModel: 'test-model',
        dimensions: 2,
      },
      {
        id: 2,
        articleId: 2,
        articleTitle: 'Student article',
        category: 'Account',
        audience: 'Students',
        heading: 'Overview',
        text: 'Student information',
        embedding: [0.8, 0.2],
        embeddingModel: 'test-model',
        dimensions: 2,
      },
      {
        id: 3,
        articleId: 3,
        articleTitle: 'Staff article',
        category: 'Account',
        audience: 'Staff',
        heading: 'Overview',
        text: 'Staff information',
        embedding: [0.7, 0.3],
        embeddingModel: 'test-model',
        dimensions: 2,
      },
    ]);
  });

  test('customers cannot retrieve staff-only articles', async () => {
    const result = await retrieve('account help', {
      role: 'customer',
      threshold: null,
      relativeCutoff: 0,
      topK: 10,
    });

    expect(result.matches.map((item) => item.articleTitle)).toEqual([
      'Public article',
      'Student article',
    ]);

    expect(result.matches.some(
      (item) => item.articleTitle === 'Staff article'
    )).toBe(false);
  });

  test('agents can retrieve staff articles', async () => {
    const result = await retrieve('account help', {
      role: 'agent',
      threshold: null,
      relativeCutoff: 0,
      topK: 10,
    });

    expect(result.matches.map((item) => item.articleTitle)).toContain(
      'Staff article'
    );
  });

  test('admins can retrieve staff articles', async () => {
    const result = await retrieve('account help', {
      role: 'admin',
      threshold: null,
      relativeCutoff: 0,
      topK: 10,
    });

    expect(result.matches.map((item) => item.articleTitle)).toContain(
      'Staff article'
    );
  });
});
