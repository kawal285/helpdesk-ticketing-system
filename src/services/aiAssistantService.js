const { searchArticles } = require('./knowledgeBaseService');
const { getAiSuggestions } = require('./aiService');
const { ask: ragAsk } = require('./rag/ragService');

// The keyword-search fallback this replaced as the primary path. Kept as a
// safety net: the RAG pipeline depends on Ollama (or another configured
// embedding/generation provider) actually being reachable, which plain
// keyword search never did -- if RAG throws for any reason, the assistant
// degrades to this instead of failing outright.
function legacyKeywordAssist(cleanQuestion, aiSuggestions) {
  const matchingArticles = searchArticles(cleanQuestion);
  const bestArticle = matchingArticles.length > 0 ? matchingArticles[0] : null;

  if (bestArticle) {
    return {
      question: cleanQuestion,
      answer: bestArticle.content,
      knowledgeBaseMatch: true,
      source: { id: bestArticle.id, title: bestArticle.title },
      suggestedCategory: aiSuggestions.category,
      suggestedPriority: aiSuggestions.priority,
      suggestedResponse: aiSuggestions.suggestedResponse,
      shouldCreateTicket: false,
    };
  }

  const generalAiGuidance =
    aiSuggestions.suggestedResponse ||
    'I could not find approved guidance for this problem. Please create a support ticket so the IT team can investigate it safely.';

  return {
    question: cleanQuestion,
    answer: generalAiGuidance,
    knowledgeBaseMatch: false,
    source: null,
    guidanceType: aiSuggestions.suggestedResponse ? 'general-ai' : 'ticket-required',
    suggestedCategory: aiSuggestions.category,
    suggestedPriority: aiSuggestions.priority,
    shouldCreateTicket: true,
  };
}

async function assistUser(question) {
  if (typeof question !== 'string' || !question.trim()) {
    const error = new Error('A non-empty IT question is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanQuestion = question.trim();

  // getAiSuggestions (ticket category/priority triage) and the RAG pipeline
  // (grounded answer retrieval) answer different questions and don't
  // depend on each other, so they run in parallel rather than back to
  // back -- the RAG call alone takes several seconds.
  const [aiSuggestions, ragOutcome] = await Promise.all([
    getAiSuggestions(cleanQuestion),
    ragAsk(cleanQuestion).then(
      (result) => ({ ok: true, result }),
      (error) => ({ ok: false, error })
    ),
  ]);

  if (!ragOutcome.ok) {
    console.error(`RAG pipeline unavailable, falling back to keyword search: ${ragOutcome.error.message}`);
    return legacyKeywordAssist(cleanQuestion, aiSuggestions);
  }

  const { result } = ragOutcome;
  const topSource = result.sources[0] || null;

  return {
    question: cleanQuestion,
    answer: result.answer,
    knowledgeBaseMatch: result.grounded,
    source: topSource ? { id: topSource.articleId, title: topSource.title } : null,
    suggestedCategory: aiSuggestions.category,
    suggestedPriority: aiSuggestions.priority,
    suggestedResponse: aiSuggestions.suggestedResponse,
    shouldCreateTicket: !result.grounded,
  };
}

module.exports = { assistUser };
