/*
 * Saves a web search result as a new knowledge-base article and makes it
 * immediately retrievable by RAG -- no server restart and no manual
 * "npm run kb:index" run.
 *
 *   { title, url, snippet } -> appended to knowledgeBase.json
 *                           -> chunked -> embedded -> kb_chunks
 *                           -> retrieval cache invalidated
 *
 * This is the write side of the otherwise read-only knowledge-base
 * provider contract (docs/PROVIDERS.md). It is deliberately NOT part of
 * that contract: only this app's own local JSON file can be appended to
 * from here. A real CRM or hosted knowledge base would need its own save
 * path, so this fails clearly -- rather than silently doing nothing --
 * when a different KNOWLEDGE_BASE_PROVIDER is active.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../models');
const { CATEGORIES } = require('../utils/ticketFields');
const { chunkArticle } = require('./rag/chunker');
const { embedDocuments, getModelInfo } = require('./rag/embeddingService');
const { refresh: refreshRetrievalCache } = require('./rag/retrievalService');

const { KbChunk } = db;

const DEFAULT_KB_FILE = path.join(__dirname, '..', 'data', 'knowledgeBase.json');

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function assertLocalJsonProviderActive() {
  const active = process.env.KNOWLEDGE_BASE_PROVIDER || 'local-json';

  if (active !== 'local-json') {
    const error = new Error(
      'Saving a web result to the knowledge base needs the local-json ' +
        `provider (the active one is "${active}").`
    );
    error.statusCode = 501;
    throw error;
  }
}

/*
 * A web search result only ever gives a title, url and snippet -- there is
 * no full article body to index. The snippet plus a visible source link
 * becomes the article content: thin, but genuinely retrievable and
 * honestly attributed, rather than inventing a longer article nobody
 * actually reviewed.
 */
function buildContent(snippet, url) {
  const body =
    typeof snippet === 'string' && snippet.trim()
      ? snippet.trim()
      : 'No summary was captured from the search result.';

  return `${body}\n\nSource: ${url}`;
}

// filePath is injectable so tests can point at a fixture instead of the
// real knowledge base (mirrors createLocalJsonProvider's filePath param).
function createKnowledgeBaseWriteService(filePath = DEFAULT_KB_FILE) {
  function readArticles() {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function writeArticles(articles) {
    fs.writeFileSync(filePath, `${JSON.stringify(articles, null, 2)}\n`, 'utf8');
  }

  async function saveWebResultToKnowledgeBase({ title, url, snippet, category }) {
    assertLocalJsonProviderActive();

    const finalCategory = CATEGORIES.includes(category) ? category : 'Other';

    const articles = readArticles();
    const nextId =
      articles.reduce((max, article) => Math.max(max, article.id), 0) + 1;

    const article = {
      id: nextId,
      title: title.trim(),
      category: finalCategory,
      audience: 'All',
      tags: [],
      lastReviewed: new Date().toISOString().slice(0, 10),
      content: buildContent(snippet, url.trim()),
      source: 'web',
      sourceUrl: url.trim(),
    };

    // Index before writing anything persistent. Both steps below call out
    // to something that can fail for reasons outside our control (the
    // embedding provider, the database) -- if either throws before the
    // file is touched, the knowledge base is left exactly as it was: no
    // orphaned article with zero indexed content sitting in the file,
    // invisible to search but still listed to anyone browsing the KB.
    const chunks = chunkArticle(article);
    const model = getModelInfo();
    const vectors = await embedDocuments(chunks.map((chunk) => chunk.text));

    const rows = chunks.map((chunk, i) => ({
      articleId: chunk.articleId,
      articleTitle: chunk.articleTitle,
      category: chunk.category,
      audience: chunk.audience,
      heading: chunk.heading,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      embedding: vectors[i],
      embeddingModel: model.name,
      dimensions: vectors[i].length,
      contentHash: hash(chunk.text),
    }));

    await KbChunk.bulkCreate(rows, { validate: true });

    // The file write happens last and is the one step in this pipeline
    // with no external dependency, so it is the least likely to fail --
    // this ordering minimises the window for any inconsistency rather
    // than eliminating it outright (a crash between this line and the
    // next could still leave indexed chunks for an article the file
    // doesn't know about, but that is harmless: it just sits unused
    // until the next successful save recomputes the same next id).
    articles.push(article);
    writeArticles(articles);

    refreshRetrievalCache();

    return article;
  }

  return { saveWebResultToKnowledgeBase };
}

module.exports = {
  ...createKnowledgeBaseWriteService(),
  createKnowledgeBaseWriteService,
};
