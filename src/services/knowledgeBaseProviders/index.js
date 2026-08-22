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
// Which provider is active is a config decision, not a code change: set
// KNOWLEDGE_BASE_PROVIDER to the registry key below. Everything else in the
// app (routes, the AI assistant) calls the functions in
// ../knowledgeBaseService.js, which just delegates to whatever this
// resolves to -- so adding a provider is "write a file implementing this
// contract, register it here," never "touch the consumers."

const { createLocalJsonProvider } = require('./localJsonProvider');

const REGISTRY = {
  'local-json': () => createLocalJsonProvider(),
};

let cachedProvider = null;

function getProvider() {
  if (cachedProvider) return cachedProvider;

  const key = process.env.KNOWLEDGE_BASE_PROVIDER || 'local-json';
  const factory = REGISTRY[key];

  if (!factory) {
    throw new Error(
      `Unknown KNOWLEDGE_BASE_PROVIDER "${key}". Available providers: ${Object.keys(REGISTRY).join(', ')}.`
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

module.exports = { getProvider, resetProviderCache };
