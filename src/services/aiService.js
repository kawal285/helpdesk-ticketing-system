const { analyzeTicket } = require('./aiAnalysisService');

const AI_TIMEOUT_MS = 8000;

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('AI analysis timed out')), ms));
}

// Never throws: ticket creation must succeed even if the AI is
// unconfigured, down, or slow. Callers treat a null category as "no
// suggestion available" and fall back to their own defaults.
async function getAiSuggestions(description) {
  try {
    return await Promise.race([analyzeTicket(description), timeout(AI_TIMEOUT_MS)]);
  } catch (err) {
    return { category: null, priority: null, suggestedResponse: null };
  }
}

module.exports = { getAiSuggestions };
