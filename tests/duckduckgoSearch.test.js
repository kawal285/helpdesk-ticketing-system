const {
  parseResults,
  search,
} = require('../src/services/rag/providers/duckduckgoSearch');

const SAMPLE_HTML = `
<div class="result results_links results_links_deep web-result">
  <div class="links_main links_deep result__body">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsupport.microsoft.com%2Fwindows%2Freset%2Dpassword&rut=abc">
        How to reset your <b>Windows</b> password
      </a>
    </h2>
    <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsupport.microsoft.com%2Fwindows%2Freset%2Dpassword&rut=abc">
      Learn how to <b>reset</b> your Windows password if you&#x27;ve forgotten it.
    </a>
  </div>
</div>
<div class="result results_links results_links_deep web-result">
  <div class="links_main links_deep result__body">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="https://example.com/direct-link">
        A direct (non-redirected) result
      </a>
    </h2>
    <a class="result__snippet" href="https://example.com/direct-link">
      Some other snippet text here.
    </a>
  </div>
</div>
`;

describe('duckduckgoSearch.parseResults', () => {
  it('extracts title, resolved url and snippet for each result', () => {
    const results = parseResults(SAMPLE_HTML, 10);

    expect(results).toHaveLength(2);

    expect(results[0]).toEqual({
      title: 'How to reset your Windows password',
      url: 'https://support.microsoft.com/windows/reset-password',
      snippet: "Learn how to reset your Windows password if you've forgotten it.",
    });

    expect(results[1]).toEqual({
      title: 'A direct (non-redirected) result',
      url: 'https://example.com/direct-link',
      snippet: 'Some other snippet text here.',
    });
  });

  it('respects maxResults', () => {
    const results = parseResults(SAMPLE_HTML, 1);

    expect(results).toHaveLength(1);
  });

  it('returns an empty array for markup with no results', () => {
    expect(parseResults('<html><body>No results found.</body></html>', 10)).toEqual([]);
  });
});

describe('duckduckgoSearch.search', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches the HTML endpoint and parses the response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    });

    const results = await search('reset windows password', { maxResults: 5 });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('html.duckduckgo.com/html/?q='),
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(results).toHaveLength(2);
  });

  it('throws when DuckDuckGo responds with a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });

    await expect(search('anything')).rejects.toThrow('429');
  });
});
