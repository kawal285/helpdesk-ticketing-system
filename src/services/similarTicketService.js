/*
 * "Similar open tickets": finds open tickets that describe the same
 * problem, so staff can link duplicates (for example many people
 * reporting the same outage) instead of solving it several times.
 *
 * Reuses the knowledge-base search pipeline: the same embedding provider
 * (local nomic-embed-text by default) and the same cosine similarity.
 * Each ticket's title + description is embedded once and stored in
 * ticket_embeddings; it is only recomputed when the text or the model
 * changes.
 *
 * The threshold was picked from a labelled set of ticket pairs (see
 * docs/similar-tickets.md and scripts/ai/evaluate-similar-tickets.js).
 */

const crypto = require('crypto');
const { TicketEmbedding } = require('../models');
const { embedDocuments, getModelInfo } = require('./rag/embeddingService');
const { cosineSimilarity } = require('./rag/similarity');
const { redact } = require('../utils/privacy');
const { getProvider } = require('./ticketProviders');
const { ticketScopeForUser } = require('../utils/ticketAccess');
const { priorityLevel } = require('../utils/ticketFields');

const DEFAULT_THRESHOLD = 0.73;
const DEFAULT_LIMIT = 5;
// How many open tickets are compared at most (newest first).
const MAX_CANDIDATES = 500;
const FINISHED = ['Resolved', 'Closed'];

function getThreshold() {
  const value = Number(process.env.SIMILAR_TICKET_THRESHOLD);
  return value > 0 && value < 1 ? value : DEFAULT_THRESHOLD;
}

// What gets embedded. Private details are removed first, like every
// other text that goes to an AI service.
function ticketText(ticket) {
  return redact(`${ticket.title || ''}. ${ticket.description || ''}`.trim());
}

function contentHash(text, model) {
  return crypto.createHash('sha256').update(`${model}\n${text}`).digest('hex');
}

/*
 * Makes sure every ticket given has an up-to-date stored embedding,
 * embedding any missing or stale ones in one batch. Returns a map of
 * ticketId -> vector.
 */
async function ensureEmbeddings(tickets) {
  const model = getModelInfo().name;
  const ids = tickets.map((t) => t.id);
  const stored = ids.length
    ? await TicketEmbedding.findAll({ where: { ticketId: ids } })
    : [];
  const byId = new Map(stored.map((row) => [row.ticketId, row]));

  const vectors = new Map();
  const toEmbed = [];

  for (const ticket of tickets) {
    const text = ticketText(ticket);
    const hash = contentHash(text, model);
    const row = byId.get(ticket.id);

    if (row && row.contentHash === hash) {
      vectors.set(ticket.id, row.embedding);
    } else {
      toEmbed.push({ ticket, text, hash });
    }
  }

  if (toEmbed.length > 0) {
    const embedded = await embedDocuments(toEmbed.map((item) => item.text));

    await Promise.all(
      toEmbed.map(({ ticket, hash }, i) => {
        vectors.set(ticket.id, embedded[i]);
        return TicketEmbedding.upsert({
          ticketId: ticket.id,
          embedding: embedded[i],
          embeddingModel: model,
          dimensions: embedded[i].length,
          contentHash: hash,
        });
      })
    );
  }

  return vectors;
}

/*
 * Embeds one ticket after it is created or its text changes. Never
 * throws: a missing embedding is filled in later, the first time
 * someone asks for similar tickets.
 */
async function indexTicket(ticket) {
  try {
    await ensureEmbeddings([ticket]);
  } catch (error) {
    console.warn(`[similar-tickets] could not embed ticket ${ticket.id}: ${error.message}`);
  }
}

// Runs indexTicket without making the request wait for it. Switched off
// in tests (the embedding is then made on demand instead), so a test
// never ends with work still running in the background.
function scheduleIndex(ticket) {
  if (process.env.NODE_ENV === 'test' && process.env.AUTO_INDEX_TICKETS !== 'true') return;
  setImmediate(() => indexTicket(ticket));
}

/*
 * Open tickets the user is allowed to see that look like the same
 * problem as `ticket`, most similar first.
 */
async function findSimilarTickets(ticket, user, options = {}) {
  const threshold = options.threshold ?? getThreshold();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const scope = ticketScopeForUser(user);

  if (!scope) return { similar: [], threshold, compared: 0 };

  const { rows } = await getProvider().listTickets(
    { ...scope, statusNotIn: FINISHED },
    { limit: MAX_CANDIDATES, offset: 0, sort: 'newest' }
  );
  const candidates = rows.filter((row) => row.id !== ticket.id);

  if (candidates.length === 0) return { similar: [], threshold, compared: 0 };

  const vectors = await ensureEmbeddings([ticket, ...candidates]);
  const source = vectors.get(ticket.id);

  const similar = candidates
    .map((candidate) => ({
      candidate,
      score: cosineSimilarity(source, vectors.get(candidate.id)),
    }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate, score }) => ({
      id: candidate.id,
      title: candidate.title,
      status: candidate.status,
      priority: candidate.priority,
      priorityLevel: priorityLevel(candidate.priority),
      category: candidate.category,
      createdAt: candidate.createdAt,
      parentCaseId: candidate.parentCaseId || null,
      requester: candidate.requester ? { id: candidate.requester.id, name: candidate.requester.name } : null,
      score: Number(score.toFixed(3)),
    }));

  return { similar, threshold, compared: candidates.length };
}

module.exports = {
  findSimilarTickets,
  indexTicket,
  scheduleIndex,
  ensureEmbeddings,
  ticketText,
  DEFAULT_THRESHOLD,
};
