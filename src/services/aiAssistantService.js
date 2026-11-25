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
function validateConversationHistory(history) {
  if (!Array.isArray(history)) {
    const error = new Error('Conversation history must be an array.');
    error.statusCode = 400;
    throw error;
  }

  if (history.length > 10) {
    const error = new Error('Conversation history cannot contain more than 10 messages.');
    error.statusCode = 400;
    throw error;
  }

  return history.map((message) => {
    if (
      !message ||
      !['user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string' ||
      !message.content.trim() ||
      message.content.length > 2000
    ) {
      const error = new Error('Invalid conversation history message.');
      error.statusCode = 400;
      throw error;
    }

    return {
      role: message.role,
      content: message.content.trim(),
    };
  });
}
async function assistUser(
  question,
  conversationHistory = [],
  role = 'customer'
) {
    const validatedHistory = validateConversationHistory(conversationHistory);

  if (typeof question !== 'string' || !question.trim()) {
    const error = new Error('A non-empty IT question is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanQuestion = question.trim();

const result = await ask(cleanQuestion, {
  conversationHistory: validatedHistory,
  role,
});

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
    suggestedPriority: null,

    shouldCreateTicket: !result.grounded,

    // Retrieval diagnostics. Useful in the UI during the demo and when
    // explaining why a question was refused.
    topScore: result.topScore,
    threshold: result.threshold,
    model: result.model,
    ms: result.ms,
  };
}

module.exports = { assistUser };