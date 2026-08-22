const path = require('path');
const { createLocalJsonProvider } = require('../src/services/knowledgeBaseProviders/localJsonProvider');

const SAMPLE_FILE = path.join(__dirname, 'fixtures', 'knowledgeBase.sample.json');
const INVALID_FILE = path.join(__dirname, 'fixtures', 'knowledgeBase.invalid.json');

describe('localJsonProvider', () => {
  describe('listAll', () => {
    it('returns every article from the file', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      const articles = provider.listAll();

      expect(articles).toHaveLength(3);
      expect(articles.map((a) => a.id)).toEqual([1, 2, 3]);
    });

    it('throws when the file does not contain a JSON array', () => {
      const provider = createLocalJsonProvider(INVALID_FILE);

      expect(() => provider.listAll()).toThrow('Knowledge-base data must be an array.');
    });

    it('throws when the file does not exist', () => {
      const provider = createLocalJsonProvider(path.join(__dirname, 'fixtures', 'does-not-exist.json'));

      expect(() => provider.listAll()).toThrow();
    });
  });

  describe('search', () => {
    it('returns [] for an empty or whitespace-only query without reading the file', () => {
      const provider = createLocalJsonProvider(path.join(__dirname, 'fixtures', 'does-not-exist.json'));

      expect(provider.search('')).toEqual([]);
      expect(provider.search('   ')).toEqual([]);
    });

    it('returns [] for a non-string query', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      expect(provider.search(undefined)).toEqual([]);
      expect(provider.search(null)).toEqual([]);
      expect(provider.search(42)).toEqual([]);
    });

    it('finds the relevant article by keyword match in title/content/tags', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      const results = provider.search('printer keeps jamming');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('Printer troubleshooting guide');
    });

    it('is case-insensitive', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      const results = provider.search('PRINTER JAMS');

      expect(results[0].title).toBe('Printer troubleshooting guide');
    });

    it('ranks the more relevant article first when a query matches multiple articles', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      const results = provider.search('network vpn connection problem');

      expect(results[0].title).toBe('VPN connection issues');
    });

    it('excludes articles below the relevance threshold', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      // A single short, generic word shouldn't drag in unrelated articles.
      const results = provider.search('the');

      expect(results).toEqual([]);
    });

    it('does not mutate the underlying article objects', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      provider.search('printer');
      const articles = provider.listAll();

      expect(articles[0]).not.toHaveProperty('score');
    });
  });

  describe('getById', () => {
    it('returns the matching article', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      const article = provider.getById(2);

      expect(article.title).toBe('How to reset your password');
    });

    it('coerces a string id to match', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      const article = provider.getById('2');

      expect(article.title).toBe('How to reset your password');
    });

    it('returns undefined for an unknown id', () => {
      const provider = createLocalJsonProvider(SAMPLE_FILE);

      expect(provider.getById(999)).toBeUndefined();
    });
  });
});

describe('knowledgeBaseProviders registry', () => {
  const ORIGINAL_ENV = process.env.KNOWLEDGE_BASE_PROVIDER;

  // The registry module caches its resolved provider in module state, so
  // each test needs a clean require + explicit cache reset to observe a
  // different KNOWLEDGE_BASE_PROVIDER value.
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.KNOWLEDGE_BASE_PROVIDER;
    } else {
      process.env.KNOWLEDGE_BASE_PROVIDER = ORIGINAL_ENV;
    }
  });

  it('defaults to the local-json provider when KNOWLEDGE_BASE_PROVIDER is unset', () => {
    delete process.env.KNOWLEDGE_BASE_PROVIDER;
    const { getProvider } = require('../src/services/knowledgeBaseProviders');

    const provider = getProvider();

    expect(typeof provider.listAll).toBe('function');
    expect(typeof provider.search).toBe('function');
    expect(typeof provider.getById).toBe('function');
  });

  it('resolves the provider named by KNOWLEDGE_BASE_PROVIDER', () => {
    process.env.KNOWLEDGE_BASE_PROVIDER = 'local-json';
    const { getProvider } = require('../src/services/knowledgeBaseProviders');

    expect(() => getProvider()).not.toThrow();
  });

  it('throws a clear error for an unregistered provider name', () => {
    process.env.KNOWLEDGE_BASE_PROVIDER = 'zendesk';
    const { getProvider } = require('../src/services/knowledgeBaseProviders');

    expect(() => getProvider()).toThrow(/Unknown KNOWLEDGE_BASE_PROVIDER "zendesk"/);
  });

  it('caches the resolved provider across calls', () => {
    delete process.env.KNOWLEDGE_BASE_PROVIDER;
    const { getProvider } = require('../src/services/knowledgeBaseProviders');

    expect(getProvider()).toBe(getProvider());
  });

  it('resetProviderCache forces re-resolution', () => {
    delete process.env.KNOWLEDGE_BASE_PROVIDER;
    const { getProvider, resetProviderCache } = require('../src/services/knowledgeBaseProviders');

    const first = getProvider();
    resetProviderCache();
    const second = getProvider();

    expect(first).not.toBe(second);
  });
});
