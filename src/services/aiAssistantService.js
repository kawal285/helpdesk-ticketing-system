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

  return {
    question: cleanQuestion,
    answer:
      'I could not find an approved knowledge-base article that fully answers this question. Please create a support ticket so the IT team can help you.',
    knowledgeBaseMatch: false,
    source: null,
    suggestedCategory: aiSuggestions.category,
    suggestedPriority: aiSuggestions.priority,
    suggestedResponse: aiSuggestions.suggestedResponse,
    shouldCreateTicket: true,
  };
}

module.exports = {
  assistUser,
};