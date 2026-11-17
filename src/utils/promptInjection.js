/*
 * Code-level defence against prompt injection. The prompts already tell
 * each model to treat user text and sources as data, but a small model
 * can still be talked round, so anything that clearly tries to give the
 * AI new instructions is stopped here, before it reaches a model:
 *
 *   - ticket classification: the AI suggestion is skipped and the ticket
 *     gets the default category/priority for a person to triage
 *     (aiAnalysisService.analyzeTicket);
 *   - the assistant: a fixed reply is returned (ragService.ask);
 *   - web search: results carrying instructions are dropped before they
 *     become SOURCES (webSearchService.search).
 *
 * Patterns are deliberately narrow -- they look for instructions aimed at
 * the AI, not ordinary help-desk wording like "I ignored the error" or
 * "please treat this as urgent", so normal tickets are unaffected.
 */

const RULES = [
  {
    label: 'override_instructions',
    pattern:
      /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,30}\b(previous|prior|above|earlier|preceding|all|any|your|system|original)\b[^.\n]{0,20}\b(instructions?|prompts?|rules|guidelines|directions)\b/i,
  },
  {
    label: 'new_instructions',
    pattern: /\b(new|updated|real|actual)\s+(system\s+)?instructions?\s*:/i,
  },
  {
    label: 'role_change',
    pattern:
      /\byou\s+are\s+now\b|\bfrom\s+now\s+on,?\s+you\b|\bpretend\s+(to\s+be|you\s+are)\b/i,
  },
  {
    label: 'reveal_prompt',
    pattern:
      /\b(reveal|show|print|repeat|output|tell\s+me|what\s+is|what\s+are)\b[^.\n]{0,30}\b(system\s+prompt|your\s+(instructions|prompt|rules)|hidden\s+(instructions|prompt))\b/i,
  },
  {
    label: 'chat_template_marker',
    pattern:
      /<\|(im_start|im_end|system|user|assistant|endoftext)\|>|\[\/?(INST|SYS)\]|<<\/?SYS>>/i,
  },
  {
    label: 'jailbreak',
    pattern: /\b(jailbreak|DAN\s+mode|developer\s+mode|god\s+mode)\b/i,
  },
  // Text addressed to the AI that tries to set the classification itself.
  {
    label: 'classification_override',
    pattern:
      /\b(AI|assistant|model|classifier|bot|LLM)\b[^.\n]{0,40}\b(must|should|shall|has\s+to|needs?\s+to)\b[^.\n]{0,30}\b(set|assign|classify|mark|label|output|return|respond)\b[^.\n]{0,30}\b(priority|category|critical)\b/i,
  },
  {
    label: 'output_override',
    pattern: /\b(respond|reply|answer|output)\s+(only\s+)?with\s*:?\s*["']?(Category|Priority)\s*:/i,
  },
];

/**
 * @returns {{ detected: boolean, labels: string[] }}
 */
function detectPromptInjection(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { detected: false, labels: [] };
  }

  const labels = RULES.filter((rule) => rule.pattern.test(text)).map(
    (rule) => rule.label
  );

  return { detected: labels.length > 0, labels };
}

function isSafeUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Drops web results that carry instructions for the AI or link to
 * anything other than an http(s) page (javascript:, data:, file:).
 *
 * @returns {{ results: object[], removed: number }}
 */
function filterWebResults(results) {
  if (!Array.isArray(results)) return { results: [], removed: 0 };

  const kept = results.filter(
    (result) =>
      result &&
      isSafeUrl(result.url) &&
      !detectPromptInjection(`${result.title || ''}\n${result.snippet || ''}`).detected
  );

  return { results: kept, removed: results.length - kept.length };
}

function injectionRefusalMessage() {
  return (
    "I can only help with IT support questions, and I can't change how I " +
    'work or share my instructions. Please describe the problem you are ' +
    'having, or create a ticket and the help desk will look at it.'
  );
}

module.exports = {
  detectPromptInjection,
  filterWebResults,
  injectionRefusalMessage,
};
