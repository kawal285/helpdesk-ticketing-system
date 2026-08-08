const { analyzeTicket } = require('./aiAnalysisService');

const AI_TIMEOUT_MS = 8000;

// Promise.race never cancels the loser, so a plain setTimeout here would
// keep firing (and keep the event loop alive) even after analyzeTicket
// already won the race. Returning the handle lets the caller clear it.
function timeout(ms) {
  let handle;
  const promise = new Promise((_, reject) => {
    handle = setTimeout(() => reject(new Error('AI analysis timed out')), ms);
  });
  return { promise, cancel: () => clearTimeout(handle) };
}

// Never throws: ticket creation must succeed even if the AI is
// unconfigured, down, or slow. Callers treat a null category as "no
// suggestion available" and fall back to their own defaults.
async function getAiSuggestions(description) {
  const { promise: timeoutPromise, cancel } = timeout(AI_TIMEOUT_MS);
  try {
    return await Promise.race([analyzeTicket(description), timeoutPromise]);
  } catch (err) {
    return { category: null, priority: null, suggestedResponse: null };
  } finally {
    cancel();
  }
}

module.exports = { getAiSuggestions };
