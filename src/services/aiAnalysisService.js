/*
 * Classifies a new ticket: category, priority, and a suggested response
 * for the agent who picks it up.
 *
 * Previously this called Gemini directly. It now goes through the same
 * generation provider as the AI assistant, so both AI features run on one
 * configurable backend -- currently Ollama locally, and the college API
 * when its details arrive -- with no API key or quota involved.
 *
 * The prompt and the parser are unchanged, so the existing parseAnalysis
 * tests still apply.
 */

const { generate } = require('./rag/generationService');
const ticketPrompt = require('../prompts/ticketPrompt');
const { CATEGORIES, PRIORITIES } = require('../utils/ticketFields');
const { redactSecrets } = require('./rag/safety');

/*
 * The reply is three short lines, so the token budget is small. This is
 * what keeps classification fast enough to run while a ticket is being
 * created, rather than the several seconds a full answer would take.
 */
const MAX_TOKENS = 160;

// Classification is a labelling task, not a writing one. Near-zero
// temperature keeps the same description mapping to the same category.
const TEMPERATURE = 0.1;

async function generateAnalysis(description) {
  const messages = [
    { role: 'system', content: ticketPrompt },
    { role: 'user', content: description },
  ];

  return generate(messages, {
    num_predict: MAX_TOKENS,
    temperature: TEMPERATURE,
  });
}

/*
 * Values outside the allowed lists fall back to safe defaults, so a model
 * inventing a category cannot write an invalid value into the database.
 */
function parseAnalysis(text) {
  const categoryMatch = text.match(/Category:\s*(.+)/i);
  const priorityMatch = text.match(/Priority:\s*(.+)/i);
  const responseMatch = text.match(/Suggested Response:\s*([\s\S]+)/i);

  const category = categoryMatch ? categoryMatch[1].trim() : null;
  const priority = priorityMatch ? priorityMatch[1].trim() : null;

  const suggestedResponse = responseMatch ? responseMatch[1].trim() : text.trim();

  return {
    category: CATEGORIES.includes(category) ? category : 'Other',
    priority: PRIORITIES.includes(priority) ? priority : 'Medium',
    // Prompt wording (ticketPrompt.js) already tells the model not to
    // include credentials, but that's guidance, not a guarantee -- this
    // is the same code-level backstop the RAG assistant applies to its
    // own answers (rag/safety.js), run here too since this response can
    // end up shown directly to an agent.
    suggestedResponse: redactSecrets(suggestedResponse),
  };
}

async function analyzeTicket(description) {
  const raw = await generateAnalysis(description);

  return parseAnalysis(raw);
}

module.exports = { analyzeTicket, parseAnalysis };