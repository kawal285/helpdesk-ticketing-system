const { analyzeTicket } = require('./aiAnalysisService');

/*
 * A local model on CPU is slower than a hosted API. Classification asks
 * for a very short reply, so it normally returns in a few seconds, but the
 * budget allows for a cold model load on the first ticket after a restart.
 */
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 60000;

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
//
// The warning matters. This wrapper previously swallowed failures in
// silence, so a broken API key looked exactly like a working classifier
// from the outside -- tickets were being filed with default categories for
// weeks before anyone noticed.
async function getAiSuggestions(description) {
  const { promise: timeoutPromise, cancel } = timeout(AI_TIMEOUT_MS);

  try {
    return await Promise.race([analyzeTicket(description), timeoutPromise]);
  } catch (err) {
    console.warn(
      `AI ticket classification unavailable (${err.message}). ` +
        'Falling back to the defaults; the category was not chosen by the AI.'
    );

    return { category: null, priority: null, suggestedResponse: null };
  } finally {
    cancel();
  }
}

module.exports = { getAiSuggestions };