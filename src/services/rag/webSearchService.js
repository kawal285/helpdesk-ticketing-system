/*
 * Single point for web search, mirroring embeddingService.js /
 * generationService.js. Nothing outside this folder should import a
 * provider directly.
 *
 * Like aiService.js, this never throws: a slow or failing web search must
 * never block an answer the knowledge base alone could have provided.
 * Callers always get back { results, provider }, with results empty when
 * nothing came back in time.
 */

const { redact } = require('../../utils/privacy');

const providers = {
  duckduckgo: require('./providers/duckduckgoSearch'),
  none: require('./providers/disabledSearch'),
};

const selected = process.env.WEB_SEARCH_PROVIDER || 'duckduckgo';
const provider = providers[selected];

if (!provider) {
  throw new Error(
    `Unknown WEB_SEARCH_PROVIDER "${selected}". ` +
      `Available: ${Object.keys(providers).join(', ')}.`
  );
}

// DuckDuckGo's free HTML endpoint is noticeably slower under repeated
// automated requests (observed anywhere from under a second to over ten
// seconds) -- matches aiService.js's AI_TIMEOUT_MS so the two external
// calls ask() makes in parallel get a comparable budget.
const WEB_SEARCH_TIMEOUT_MS = Number(process.env.WEB_SEARCH_TIMEOUT_MS) || 8000;
const DEFAULT_MAX_RESULTS = Number(process.env.WEB_SEARCH_MAX_RESULTS) || 3;

// Promise.race never cancels the loser, so a plain setTimeout here would
// keep firing (and keep the event loop alive) even after the search
// already won the race. Returning the handle lets the caller clear it.
function timeout(ms) {
  let handle;
  const promise = new Promise((_, reject) => {
    handle = setTimeout(
      () => reject(new Error('Web search timed out')),
      ms
    );
  });
  return { promise, cancel: () => clearTimeout(handle) };
}

function getProviderName() {
  return provider.name;
}

async function search(query, options = {}) {
  if (typeof query !== 'string' || !query.trim()) {
    return { results: [], provider: provider.name };
  }

  const maxResults = options.maxResults || DEFAULT_MAX_RESULTS;
  const { promise: timeoutPromise, cancel } = timeout(WEB_SEARCH_TIMEOUT_MS);

  try {
    const results = await Promise.race([
      // A query goes to a public search engine: never send personal details.
      provider.search(redact(query.trim()), { maxResults }),
      timeoutPromise,
    ]);

    return {
      results: Array.isArray(results) ? results.slice(0, maxResults) : [],
      provider: provider.name,
    };
  } catch (error) {
    console.warn('[web-search] failed:', error.message);
    return { results: [], provider: provider.name, error: error.message };
  } finally {
    cancel();
  }
}

module.exports = { search, getProviderName };