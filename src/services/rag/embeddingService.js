/*
 * The single point every other module uses to turn text into vectors.
 *
 * Nothing outside this folder should import a provider directly. That is
 * what makes swapping providers a one-line change in .env rather than an
 * edit across the ingestion script, the retrieval service and the
 * assistant service.
 */

const providers = {
  gemini: require('./providers/gemini'),
  college: require('./providers/college'),
  ollama: require('./providers/ollama'),
};

const selected = process.env.EMBEDDING_PROVIDER || 'gemini';
const provider = providers[selected];

if (!provider) {
  throw new Error(
    `Unknown EMBEDDING_PROVIDER "${selected}". ` +
      `Available: ${Object.keys(providers).join(', ')}.`
  );
}

/*
 * Written next to every stored vector. At query time the retrieval
 * service compares this against what is in the database and refuses to
 * run if they differ, because vectors from two models are not comparable
 * and the failure would otherwise be silent.
 */
function getModelInfo() {
  return {
    provider: selected,
    name: provider.name,
    dimensions: provider.dimensions,
  };
}

function embedQuery(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Cannot embed empty text.');
  }

  return provider.embedQuery(text.trim());
}

function embedDocuments(texts, onProgress) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('embedDocuments requires a non-empty array of strings.');
  }

  return provider.embedDocuments(texts, onProgress);
}

module.exports = { embedQuery, embedDocuments, getModelInfo };