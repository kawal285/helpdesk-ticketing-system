/*
 * Retrieval: turn a question into the most relevant knowledge-base chunks.
 *
 *   question -> embedQuery -> compare against every stored vector
 *            -> sort by score -> take top K -> apply threshold
 *
 * No LLM involved. This module answers "which chunks are relevant?" and
 * nothing else, so it can be tested and measured on its own.
 */

const db = require('../../models');
const { embedQuery, getModelInfo } = require('./embeddingService');
const { cosineSimilarity } = require('./similarity');

const { KbChunk } = db;

const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K) || 3;

// Deliberately unset by default. A threshold copied from a tutorial is
// meaningless -- the right value depends on the embedding model, and is
// measured against a real test set. See scripts/rag/measure-threshold.js.
const DEFAULT_THRESHOLD =
  process.env.RAG_SIMILARITY_THRESHOLD === undefined
    ? null
    : Number(process.env.RAG_SIMILARITY_THRESHOLD);

let cache = null;

/*
 * MariaDB stores JSON as LONGTEXT, so the driver returns the embedding as a
 * string rather than an array -- and raw queries bypass Sequelize's own
 * conversion. Parse once at load time so the maths never sees a string.
 */
function toVector(value, rowId) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      throw new Error(
        `Chunk ${rowId} has an embedding that is not valid JSON. ` +
          'Re-run "npm run kb:index -- --force".'
      );
    }
  }

  throw new Error(
    `Chunk ${rowId} has an embedding of type ${typeof value}, expected an array.`
  );
}

/*
 * All 113 chunks are held in memory. At roughly 1 MB that is cheap, and it
 * avoids re-reading a megabyte of vectors from MySQL on every question.
 * Re-run ingestion then call refresh() (or restart) to pick up changes.
 */
async function loadChunks() {
  if (cache) {
    return cache;
  }

  const model = getModelInfo();

  const rows = await KbChunk.findAll({
    attributes: [
      'id',
      'articleId',
      'articleTitle',
      'category',
      'audience',
      'heading',
      'text',
      'embedding',
      'embeddingModel',
      'dimensions',
    ],
    raw: true,
    logging: false,
  });

  if (!rows.length) {
    throw new Error(
      'The knowledge base index is empty. Run "npm run kb:index" first.'
    );
  }

  // Vectors from a different model are not comparable to the current
  // query embedding. Cosine similarity would still return a number, so
  // this has to be checked explicitly or the failure is silent.
  const mismatched = rows.filter((row) => row.embeddingModel !== model.name);

  if (mismatched.length) {
    throw new Error(
      `${mismatched.length} of ${rows.length} indexed chunks were embedded ` +
        `with "${mismatched[0].embeddingModel}" but the configured provider ` +
        `is "${model.name}". Re-index with "npm run kb:index -- --force".`
    );
  }

  cache = rows.map((row) => ({
    ...row,
    embedding: toVector(row.embedding, row.id),
  }));

  const wrongLength = cache.filter(
    (row) => row.embedding.length !== model.dimensions
  );

  if (wrongLength.length) {
    throw new Error(
      `Chunk ${wrongLength[0].id} has ${wrongLength[0].embedding.length} ` +
        `dimensions but the provider is configured for ${model.dimensions}. ` +
        'Re-index with "npm run kb:index -- --force".'
    );
  }

  return cache;
}

function refresh() {
  cache = null;
}

/*
 * topK: how many chunks to return. Small numbers keep the prompt focused;
 *       too small risks missing the chunk that holds the answer.
 * threshold: minimum score to count as relevant. null means return
 *       everything, which is what you want while measuring.
 * category: optional metadata filter, e.g. restrict to "Network".
 */
async function retrieve(question, options = {}) {
  const {
    topK = DEFAULT_TOP_K,
    threshold = DEFAULT_THRESHOLD,
    category = null,
  } = options;

  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('A question is required.');
  }

  const chunks = await loadChunks();
  const queryVector = await embedQuery(question);

  const pool = category
    ? chunks.filter((chunk) => chunk.category === category)
    : chunks;

  const scored = pool.map((chunk) => ({
    id: chunk.id,
    articleId: chunk.articleId,
    articleTitle: chunk.articleTitle,
    category: chunk.category,
    heading: chunk.heading,
    text: chunk.text,
    score: cosineSimilarity(queryVector, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, topK);

  const relevant =
    threshold === null ? top : top.filter((match) => match.score >= threshold);

  return {
    question,
    topScore: top.length ? top[0].score : 0,
    threshold,
    matches: top,
    relevant,
    // The signal the generation step needs: if nothing cleared the bar,
    // the assistant must say it does not know rather than guess.
    hasRelevantContext: relevant.length > 0,
    searched: pool.length,
  };
}

module.exports = { retrieve, refresh, loadChunks, DEFAULT_TOP_K };