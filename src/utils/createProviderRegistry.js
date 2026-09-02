// Shared plumbing behind every swappable-backend registry in this app
// (knowledgeBaseProviders, ticketProviders, and any future one). Each
// call to createProviderRegistry() produces its own independent
// registry -- an open Map a provider registers itself into, resolved by
// an env var, cached after the first resolution. The registration and
// contract-shape decisions stay with each caller; only the mechanics of
// "look up a name, cache the result, fail clearly on an unknown one" are
// shared here.
function createProviderRegistry({ envVar, defaultProvider }) {
  const registry = new Map();
  let cachedProvider = null;

  function registerProvider(name, factory) {
    registry.set(name, factory);
  }

  function getProvider() {
    if (cachedProvider) return cachedProvider;

    const key = process.env[envVar] || defaultProvider;
    const factory = registry.get(key);

    if (!factory) {
      throw new Error(
        `Unknown ${envVar} "${key}". Available providers: ${[...registry.keys()].join(', ')}.`
      );
    }

    cachedProvider = factory();
    return cachedProvider;
  }

  // Test-only: forces the next getProvider() call to re-resolve instead
  // of reusing the cached instance, so tests can swap the env var and
  // see the change take effect.
  function resetProviderCache() {
    cachedProvider = null;
  }

  return { registerProvider, getProvider, resetProviderCache };
}

module.exports = { createProviderRegistry };
