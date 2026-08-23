/*
 * Placeholder for the college-hosted AI service.
 *
 * Intentionally throws rather than silently falling back to Gemini: if
 * this provider is selected but not implemented, we want a loud failure
 * at startup, not vectors quietly produced by a different model and
 * written into the same table.
 *
 * To implement, replace the bodies below and keep the exported shape
 * identical -- nothing else in the codebase needs to change.
 *
 * Still needed from the client:
 *   - base URL of the embeddings endpoint
 *   - authentication method (header name / token format)
 *   - request body shape
 *   - response shape and where the vector sits in it
 *   - vector length the model returns
 */

const NOT_READY =
  'The college embedding provider is not implemented yet. ' +
  'Set EMBEDDING_PROVIDER=gemini in .env, or implement ' +
  'src/services/rag/providers/college.js once the API details arrive.';

module.exports = {
  name: 'college:unconfigured',
  dimensions: Number(process.env.EMBEDDING_DIMENSIONS) || 0,

  embedQuery() {
    throw new Error(NOT_READY);
  },

  embedDocuments() {
    throw new Error(NOT_READY);
  },
};