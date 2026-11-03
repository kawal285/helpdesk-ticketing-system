/*
 * Answers a user's IT question using Retrieval-Augmented Generation.
 *
 * Replaces the previous implementation, which did keyword matching over the
 * knowledge base and, when that missed, returned an ungrounded answer from
 * the model's general knowledge. That fallback is gone: if nothing relevant
 * is retrieved, the assistant says so and points the user at a ticket.
 *
 * The response shape is unchanged apart from two additions (`sources` and
 * `topScore`), so the existing frontend keeps working.
 */

const { ask } = require('./rag/ragService');

/*
 * Knowledge-base categories are the same five values as ticket categories
 * (see src/utils/ticketFields.js), so the category of the best-matching
 * article is a usable suggestion for a ticket raised from this answer.
 *
 * This replaces a model call. It is deterministic, instant, and traceable
 * to a specific article rather than to a model's guess.
 */
function suggestCategory(sources) {
  return sources.length ? sources[0].category : null;
}

async function assistUser(question, options = {}) {
  if (typeof question !== 'string' || !question.trim()) {
    const error = new Error('A non-empty IT question is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanQuestion = question.trim();

  // history is the user's recent questions in this chat (already cleaned by
  // the controller). ask() decides whether this question is a follow-up.
  const result = await ask(cleanQuestion, { history: options.history });

  const best = result.sources.length ? result.sources[0] : null;

  return {
    question: cleanQuestion,
    answer: result.answer,

    // True when the answer was generated from retrieved knowledge-base
    // content. False means nothing cleared the relevance threshold and the
    // model was never called.
    knowledgeBaseMatch: result.grounded,

    // Kept for the existing frontend, which shows a single "approved source".
    source: best ? { id: best.articleId, title: best.title } : null,

    // Every article the answer drew on, with the section and score. This is
    // what makes an answer auditable.
    sources: result.sources,

    suggestedCategory: suggestCategory(result.sources),

    // Only ever set by a safety escalation (rag/safety.js) -- a normal
    // grounded or refused answer doesn't guess a priority, that's ticket
    // creation's job, not the assistant's.
    suggestedPriority: result.escalated ? 'Critical' : null,

    // True whenever this needs a human either way: nothing was found to
    // answer from, or a safety guardrail stepped in.
    shouldCreateTicket: !result.grounded || Boolean(result.escalated),

    // Lets the frontend show a distinct, more urgent treatment than the
    // ordinary "couldn't find anything" refusal.
    safetyEscalation: Boolean(result.escalated),

    // Retrieval diagnostics. Useful in the UI during the demo and when
    // explaining why a question was refused.
    topScore: result.topScore,
    threshold: result.threshold,
    model: result.model,
    ms: result.ms,
  };
}

module.exports = { assistUser };