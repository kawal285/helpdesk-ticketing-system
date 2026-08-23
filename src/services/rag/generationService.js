/*
 * Single point for text generation, mirroring embeddingService.js.
 *
 * Nothing outside this folder imports a chat provider directly, so moving
 * from Ollama to the college API is one line in .env.
 */

const providers = {
  ollama: require('./providers/ollamaChat'),
  college: require('./providers/collegeChat'),
};

const selected = process.env.GENERATION_PROVIDER || 'ollama';
const provider = providers[selected];

if (!provider) {
  throw new Error(
    `Unknown GENERATION_PROVIDER "${selected}". ` +
      `Available: ${Object.keys(providers).join(', ')}.`
  );
}

function getModelInfo() {
  return { provider: selected, name: provider.name };
}

function generate(messages) {
  if (!Array.isArray(messages) || !messages.length) {
    throw new Error('generate requires a non-empty messages array.');
  }

  return provider.generate(messages);
}

module.exports = { generate, getModelInfo };