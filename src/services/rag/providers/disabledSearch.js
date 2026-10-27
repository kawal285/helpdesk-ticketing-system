/*
 * Disables web search. Set WEB_SEARCH_PROVIDER=none to make the assistant
 * answer from the knowledge base only, matching its behaviour before this
 * feature existed.
 */
module.exports = {
  name: 'none',
  async search() {
    return [];
  },
};
