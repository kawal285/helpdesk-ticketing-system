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
const { createProviderRegistry } = require('../../utils/createProviderRegistry');

const { registerProvider, getProvider, resetProviderCache } = createProviderRegistry({
  envVar: 'KNOWLEDGE_BASE_PROVIDER',
  defaultProvider: 'local-json',
});

registerProvider('local-json', () => createLocalJsonProvider());

module.exports = { getProvider, resetProviderCache, registerProvider };
