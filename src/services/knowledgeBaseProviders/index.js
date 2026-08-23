// The knowledge-base provider contract. Anything the platform reads
// articles from -- the local JSON file today, a real CRM or hosted
// knowledge base later -- must expose exactly these three methods:
//
//   listAll()        -> Article[]
//   search(query)     -> Article[] (scored/ranked, [] for an empty query)
//   getById(id)       -> Article | undefined
//
// Article shape: { id, title, content, tags?: string[] }.
//
// The registry is open, not a hardcoded switch: a provider becomes
// available by calling registerProvider(name, factory), which the local
// JSON provider does to itself below. A future CRM package (in this repo
// or an external one) registers itself the same way and never has to
// touch this file -- "not locked into one vendor" holds even at the
// registration point, not just the interface.
//
// Which provider is active is a config decision, not a code change: set
// KNOWLEDGE_BASE_PROVIDER to a registered name. Everything else in the app
// (routes, the AI assistant) calls the functions in
// ../knowledgeBaseService.js, which just delegates to whatever this
// resolves to.

const { createLocalJsonProvider } = require('./localJsonProvider');

const registry = new Map();

function registerProvider(name, factory) {
  registry.set(name, factory);
}

let cachedProvider = null;

function getProvider() {
  if (cachedProvider) return cachedProvider;

  const key = process.env.KNOWLEDGE_BASE_PROVIDER || 'local-json';
  const factory = registry.get(key);

  if (!factory) {
    throw new Error(
      `Unknown KNOWLEDGE_BASE_PROVIDER "${key}". Available providers: ${[...registry.keys()].join(', ')}.`
    );
  }

  cachedProvider = factory();
  return cachedProvider;
}

// Test-only: forces the next getProvider() call to re-resolve instead of
// reusing the cached instance, so tests can swap KNOWLEDGE_BASE_PROVIDER
// and see the change take effect.
function resetProviderCache() {
  cachedProvider = null;
}

registerProvider('local-json', () => createLocalJsonProvider());

module.exports = { getProvider, resetProviderCache, registerProvider };
