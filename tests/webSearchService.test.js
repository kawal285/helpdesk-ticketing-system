/*
 * Tests the never-throw/timeout wrapper in webSearchService.js, not the
 * real DuckDuckGo provider -- that parsing logic is covered on its own in
 * tests/duckduckgoSearch.test.js. Mocking the provider here keeps these
 * tests fast, deterministic and offline.
 */

jest.mock('../src/services/rag/providers/duckduckgoSearch', () => ({
  name: 'duckduckgo',
  search: jest.fn(),
}));

const {
  search: providerSearch,
} = require('../src/services/rag/providers/duckduckgoSearch');
const { search } = require('../src/services/rag/webSearchService');

describe('webSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the provider's results on success", async () => {
    providerSearch.mockResolvedValue([
      { title: 'Reset a Windows password', url: 'https://example.com/a', snippet: 'Steps…' },
    ]);

    const result = await search('reset windows password');

    expect(result).toEqual({
      results: [
        { title: 'Reset a Windows password', url: 'https://example.com/a', snippet: 'Steps…' },
      ],
      provider: 'duckduckgo',
    });
  });

  it('never throws, and returns empty results, when the provider rejects', async () => {
    providerSearch.mockRejectedValue(new Error('network unreachable'));

    const result = await search('anything');

    expect(result.results).toEqual([]);
    expect(result.provider).toBe('duckduckgo');
    expect(result.error).toBe('network unreachable');
  });

  it('returns empty results for a blank query without calling the provider', async () => {
    const result = await search('   ');

    expect(result).toEqual({ results: [], provider: 'duckduckgo' });
    expect(providerSearch).not.toHaveBeenCalled();
  });

  it('caps the provider results to maxResults', async () => {
    providerSearch.mockResolvedValue([
      { title: 'One', url: 'https://example.com/1', snippet: '' },
      { title: 'Two', url: 'https://example.com/2', snippet: '' },
      { title: 'Three', url: 'https://example.com/3', snippet: '' },
      { title: 'Four', url: 'https://example.com/4', snippet: '' },
    ]);

    const result = await search('anything', { maxResults: 2 });

    expect(result.results).toHaveLength(2);
  });
});
