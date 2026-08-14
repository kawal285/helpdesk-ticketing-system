const {
  searchArticles,
} = require('./knowledgeBaseService');
const {
  getAiSuggestions,
} = require('./aiService');

async function assistUser(question) {
  if (typeof question !== 'string' || !question.trim()) {
    const error = new Error('A non-empty IT question is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanQuestion = question.trim();

  const matchingArticles = searchArticles(cleanQuestion);
  const bestArticle =
    matchingArticles.length > 0 ? matchingArticles[0] : null;

  const aiSuggestions = await getAiSuggestions(cleanQuestion);

  if (bestArticle) {
    return {
      question: cleanQuestion,
      answer: bestArticle.content,
      knowledgeBaseMatch: true,
      source: {
        id: bestArticle.id,
        title: bestArticle.title,
      },
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
  guidanceType: aiSuggestions.suggestedResponse
    ? 'general-ai'
    : 'ticket-required',
  suggestedCategory: aiSuggestions.category,
  suggestedPriority: aiSuggestions.priority,
  shouldCreateTicket: true,
};
  
}

module.exports = {
  assistUser,
};