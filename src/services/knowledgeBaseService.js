// Public entry point every consumer (routes, the AI assistant) imports.
// The actual backend -- local JSON today, potentially a real CRM or hosted
// knowledge base later -- is resolved through the provider contract in
// ./knowledgeBaseProviders, selected by the KNOWLEDGE_BASE_PROVIDER env var.
// This file's job is just to keep that swap invisible to callers: the
// function names and behavior here must not change when the provider does.

const { getProvider } = require('./knowledgeBaseProviders');

function loadArticles() {
  return getProvider().listAll();
}

function searchArticles(query) {
  return getProvider().search(query);
}

function getArticleById(id) {
  return getProvider().getById(id);
}

module.exports = { loadArticles, searchArticles, getArticleById };
