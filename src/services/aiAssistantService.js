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
const AppError = require('../utils/appError');

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

// Earlier chat messages sent by the page ({ role, content }), checked
// because they come straight from the request body.
function validateConversationHistory(history = []) {
  if (!Array.isArray(history)) {
    throw new AppError('Conversation history must be an array.', 400);
  }

  if (history.length > 10) {
    throw new AppError('Conversation history cannot contain more than 10 messages.', 400);
  }

  return history.map((message) => {
    if (
      !message ||
      !['user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string' ||
      !message.content.trim() ||
      message.content.length > 2000
    ) {
      throw new AppError('Invalid conversation history message.', 400);
    }

    return {
      role: message.role,
      content: message.content.trim(),
    };
  });
}

/*
 * options:
 *   history              the user's last questions (strings), used to
 *                        understand a short follow-up when searching
 *   thinkDeeper          the "Think deeper" button (only boolean true)
 *   conversationHistory  earlier chat messages, given to the model
 *   role                 the signed-in user's role, which decides which
 *                        knowledge-base articles they can see
 */
async function assistUser(question, options = {}) {
  if (typeof question !== 'string' || !question.trim()) {
    const error = new Error('A non-empty IT question is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanQuestion = question.trim();
  const conversationHistory = validateConversationHistory(options.conversationHistory);

  // history is the user's recent questions in this chat (already cleaned by
  // the controller). ask() decides whether this question is a follow-up.
  const result = await ask(cleanQuestion, {
    history: options.history,
    // The "Think deeper" button. Only the boolean true switches agents.
    thinkDeeper: options.thinkDeeper === true,
    conversationHistory,
    role: options.role || 'customer',
  });

  // A web source has no category or article id, so "best match" and the
  // suggested ticket category come from knowledge-base sources only.
  const kbSources = result.sources.filter((source) => source.type !== 'web');
  const best = kbSources.length ? kbSources[0] : null;

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

    suggestedCategory: suggestCategory(kbSources),

    // Only ever set by a safety escalation (rag/safety.js) -- a normal
    // grounded or refused answer doesn't guess a priority, that's ticket
    // creation's job, not the assistant's.
    suggestedPriority: result.escalated ? 'Critical' : null,
    suggestedPriorityLevel: result.escalated ? 'P1' : null,

    // True whenever this needs a human: a safety guardrail stepped in, or
    // nothing was found to answer from. A greeting is not a failed
    // answer, so it never suggests a ticket.
    shouldCreateTicket: result.escalated
      ? true
      : result.smallTalk
        ? false
        : !result.grounded || result.lowConfidence === true,

    // The answer is only a weak match: show "Needs human check".
    needsHumanCheck: result.lowConfidence === true,

    // Lets the frontend show a distinct, more urgent treatment than the
    // ordinary "couldn't find anything" refusal.
    safetyEscalation: Boolean(result.escalated),

    // Which agent answered, and whether the cloud model failed over to the
    // local one. The page shows these as the "answered by" badge.
    agent: result.agent || 'main',
    fellBack: result.fellBack === true,
    smallTalk: result.smallTalk === true,
    // 'prompt_injection' when the question was stopped before any model.
    blocked: result.blocked || null,

    // Retrieval diagnostics. Useful in the UI during the demo and when
    // explaining why a question was refused.
    topScore: result.topScore,
    threshold: result.threshold,
    model: result.model,
    ms: result.ms,
  };
}

module.exports = { assistUser, validateConversationHistory };