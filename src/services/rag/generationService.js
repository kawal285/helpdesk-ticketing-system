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

/*
 * options are passed straight to the provider. Ticket classification uses
 * them to cap the reply length, because it needs three short lines rather
 * than a full answer -- which keeps it fast enough to run during ticket
 * creation.
 */
function generate(messages, options = {}) {
  if (!Array.isArray(messages) || !messages.length) {
    throw new Error('generate requires a non-empty messages array.');
  }

  return provider.generate(messages, options);
}

module.exports = { generate, getModelInfo };