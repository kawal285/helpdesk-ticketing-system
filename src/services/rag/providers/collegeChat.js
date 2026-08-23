/*
 * Placeholder for the college-hosted generation API.
 *
 * Throws rather than falling back, for the same reason as the embedding
 * stub: a silent substitution is worse than a loud failure.
 *
 * Still needed from the client:
 *   - base URL of the chat/completion endpoint
 *   - authentication method
 *   - request body shape (does it accept a messages array?)
 *   - where the generated text sits in the response
 */

const NOT_READY =
  'The college generation provider is not implemented yet. ' +
  'Set GENERATION_PROVIDER=ollama in .env, or implement ' +
  'src/services/rag/providers/collegeChat.js once the API details arrive.';

module.exports = {
  name: 'college:unconfigured',

  generate() {
    throw new Error(NOT_READY);
  },
};