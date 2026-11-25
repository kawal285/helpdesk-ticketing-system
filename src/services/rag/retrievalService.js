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

const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K) || 4;

/*
 * Caps how many chunks one article may contribute to the results.
 *
 * Without this, a question touching two topics loses: the best-matching
 * article fills every slot with its own sections and the second topic is
 * never retrieved, so the model correctly reports it does not know
 * something the knowledge base actually covers.
 */
const DEFAULT_MAX_PER_ARTICLE = Number(process.env.RAG_MAX_PER_ARTICLE) || 2;

/*
 * Drops chunks that score more than this far below the best match.
 *
 * The absolute threshold answers "is anything relevant at all?". This
 * answers "is this chunk relevant given how good the best one is?" -- a
 * chunk 0.07 below the top hit is usually a neighbouring topic rather than
 * part of the answer, and feeding it to the model invites details from it
 * to leak into the answer.
 *
 * Set RAG_RELATIVE_CUTOFF=0 to disable.
 */
const DEFAULT_RELATIVE_CUTOFF =
  process.env.RAG_RELATIVE_CUTOFF === undefined
    ? 0.06
    : Number(process.env.RAG_RELATIVE_CUTOFF);

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

function getAllowedAudiences(role = 'customer') {
  const normalizedRole = String(role).toLowerCase();

  if (normalizedRole === 'admin' || normalizedRole === 'agent') {
    return ['All', 'Students', 'Staff'];
  }

  if (normalizedRole === 'customer') {
    return ['All', 'Students'];
  }

  // Unknown roles receive the least privileged access.
  return ['All'];
}

async function retrieve(question, options = {}) {
 const {
  topK = DEFAULT_TOP_K,
  threshold = DEFAULT_THRESHOLD,
  category = null,
  maxPerArticle = DEFAULT_MAX_PER_ARTICLE,
  relativeCutoff = DEFAULT_RELATIVE_CUTOFF,
  role = 'customer',
} = options;

  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('A question is required.');
  }

  const chunks = await loadChunks();
  const queryVector = await embedQuery(question);

 const allowedAudiences = getAllowedAudiences(role);

const pool = chunks.filter((chunk) => {
  const audienceAllowed = allowedAudiences.includes(chunk.audience);

  const categoryAllowed =
    !category || chunk.category === category;

  return audienceAllowed && categoryAllowed;
});
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

  // Walk the ranking in order, skipping an article once it has contributed
  // its quota. Order is still strictly by score -- diversity is enforced by
  // omission, never by promoting a weaker chunk above a stronger one.
  const perArticle = new Map();
  const top = [];

  for (const match of scored) {
    if (top.length >= topK) {
      break;
    }

    const used = perArticle.get(match.articleId) || 0;

    if (used >= maxPerArticle) {
      continue;
    }

    perArticle.set(match.articleId, used + 1);
    top.push(match);
  }

  let relevant =
    threshold === null ? top : top.filter((match) => match.score >= threshold);

  // Relative filter, applied after the absolute one. The best match always
  // survives; weaker neighbours are dropped rather than passed to the model
  // as context it did not need.
  if (relativeCutoff > 0 && relevant.length > 1) {
    const floor = relevant[0].score - relativeCutoff;

    relevant = relevant.filter((match) => match.score >= floor);
  }

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

module.exports = {
  retrieve,
  refresh,
  loadChunks,
  DEFAULT_TOP_K,
  getAllowedAudiences,
};