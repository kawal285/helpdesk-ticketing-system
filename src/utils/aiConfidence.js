/*
 * "I'm not sure" handoff (selective prediction): the AI should not guess.
 * When it is unsure of a ticket's priority or category, the ticket is
 * marked "Needs human check" instead of silently trusting the AI.
 *
 * Confidence comes from the model itself: the probability it gave the
 * first token of the value it wrote after "Priority:" / "Category:". A
 * model that writes "High" while also giving "Medium" a fair chance is
 * less sure than one that puts almost everything on "High".
 *
 * The cut-offs were chosen from the 40-ticket evaluation
 * (docs/ai-handoff-evaluation.md).
 */

const DEFAULT_PRIORITY_MIN = 0.5;
const DEFAULT_CATEGORY_MIN = 0.5;

function threshold(envName, fallback) {
  const value = Number(process.env[envName]);
  return value > 0 && value < 1 ? value : fallback;
}

function getThresholds() {
  return {
    priority: threshold('AI_PRIORITY_CONFIDENCE_MIN', DEFAULT_PRIORITY_MIN),
    category: threshold('AI_CATEGORY_CONFIDENCE_MIN', DEFAULT_CATEGORY_MIN),
  };
}

/*
 * Probability (0-1) of the first token of the value after `label:` in
 * the model's reply, or null when it can't be worked out (no token data,
 * label missing, or tokens that don't line up with the text).
 */
function valueConfidence(content, tokens, label) {
  if (typeof content !== 'string' || !Array.isArray(tokens) || tokens.length === 0) {
    return null;
  }

  const match = new RegExp(`${label}\\s*:\\s*`, 'i').exec(content);
  if (!match) return null;
  const valueStart = match.index + match[0].length;

  // Token texts joined back together must equal the reply, otherwise
  // positions can't be trusted.
  if (tokens.map((t) => t.token).join('') !== content) return null;

  let position = 0;
  for (const token of tokens) {
    const end = position + token.token.length;
    if (end > valueStart && token.token.trim()) {
      return Number(Math.exp(token.logprob).toFixed(4));
    }
    position = end;
  }

  return null;
}

/*
 * Why a ticket needs a person to check the AI's suggestion. Empty list
 * means the AI was confident and its answer was usable.
 *
 * aiDecided: which fields the AI actually chose (a field the customer
 * picked themselves isn't the AI's guess, so its confidence doesn't
 * matter).
 */
function humanCheckReasons(ai, { aiDecided = { priority: true, category: true } } = {}) {
  const reasons = [];
  const limits = getThresholds();
  const anyAi = aiDecided.priority || aiDecided.category;

  if (ai.injectionDetected) {
    reasons.push('prompt_injection');
    return reasons;
  }

  if (ai.category === null && ai.priority === null) {
    if (anyAi) reasons.push('ai_unavailable');
    return reasons;
  }

  if (aiDecided.priority) {
    if (ai.priorityValid === false) reasons.push('unclear_ai_priority');
    else if (ai.priorityConfidence != null && ai.priorityConfidence < limits.priority) {
      reasons.push('low_priority_confidence');
    }
  }

  if (aiDecided.category) {
    if (ai.categoryValid === false) reasons.push('unclear_ai_category');
    else if (ai.categoryConfidence != null && ai.categoryConfidence < limits.category) {
      reasons.push('low_category_confidence');
    }
  }

  return reasons;
}

// Short, plain explanations for the ticket page.
const REASON_TEXT = {
  prompt_injection: 'The ticket tried to give the AI instructions.',
  ai_unavailable: 'The AI was not available when the ticket was created.',
  unclear_ai_priority: "The AI's priority answer could not be read.",
  unclear_ai_category: "The AI's category answer could not be read.",
  low_priority_confidence: 'The AI was not sure about the priority.',
  low_category_confidence: 'The AI was not sure about the category.',
};

module.exports = {
  valueConfidence,
  humanCheckReasons,
  getThresholds,
  REASON_TEXT,
  DEFAULT_PRIORITY_MIN,
  DEFAULT_CATEGORY_MIN,
};
