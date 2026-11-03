/*
 * Deterministic safety guardrails for the AI assistant, independent of
 * whatever the model was told to do. Prompt instructions (rag/prompt.js,
 * prompts/ticketPrompt.js) are the first layer, but a prompt is guidance,
 * not a guarantee -- a model can still ignore it or be talked past it.
 * These checks run in code, against the actual input/output text, so they
 * hold even when the model doesn't cooperate. Same reasoning as
 * refusalMessage() in prompt.js: "a fixed response cannot hallucinate,
 * and it is testable."
 *
 * Two separate guardrails, because they catch two different things:
 *   - detectHazard: the USER describes an active physical danger right
 *     now (smoke, exposed wiring, shock) -- skip the model entirely.
 *   - containsDangerousAdvice: the MODEL's answer tells someone to do
 *     something physically unsafe (open a power supply, discharge a
 *     capacitor) -- override the answer, whatever the source was.
 */

// Phrases describing an already-happening physical hazard, not a request
// for help with normal IT trouble. Matched against the user's own
// question, before anything else runs.
const HAZARD_PATTERNS = [
  /\bsmoke\b|\bsmoking\b/i,
  /smells? (like )?(it'?s |something'?s? )?burning|burning (plastic|electrical)? ?smell/i,
  /\bon fire\b|\bcaught fire\b|\bcatching fire\b/i,
  /\bspark(s|ing)?\b/i,
  /exposed (wire|wiring|cable)|bare wire|frayed (wire|cable|cord)/i,
  /electric(al)? shock|got shocked|shocked me|tingl(e|ing)? when (i|I) touch/i,
  /water.{0,40}(still (on|plugged)|powered on|turned on)|(plugged in|powered on).{0,40}water/i,
];

function detectHazard(text) {
  if (typeof text !== 'string') {
    return false;
  }

  return HAZARD_PATTERNS.some((pattern) => pattern.test(text));
}

function hazardEscalationMessage() {
  return (
    "This sounds like it could be a physical safety risk, not a normal IT problem. " +
    "If it's safe to do so, unplug the device from the wall and step away -- don't " +
    'touch any exposed or damaged parts. If you see fire or smoke, treat it as an ' +
    'emergency and evacuate first. This has been flagged for urgent follow-up by a ' +
    'technician; please raise a ticket now so it reaches someone who can help safely.'
  );
}

// Instructions that involve opening a sealed component or working with
// parts that can hold a dangerous electrical charge even when unplugged --
// a power supply, a CRT monitor. Never appropriate advice for someone
// without training, regardless of what a source document said. Not
// exhaustive -- a best-effort net, not a guarantee of catching every
// phrasing.
const DANGEROUS_ADVICE_PATTERNS = [
  /open(ing)?\s+(the\s+|up\s+)?(the\s+)?power\s+supply/i,
  /remove\s+(the\s+)?(cover|casing)\s+(of|from)\s+the\s+power\s+supply/i,
  /remove\s+(the\s+)?(psu|power\s+supply\s+unit)/i,
  /discharge\s+(the\s+)?capacitor/i,
  /open(ing)?\s+(the\s+)?(monitor|crt)(\s+casing|\s+housing)?/i,
  /open(ing)?\s+(up\s+)?(the\s+)?(computer|pc|case|chassis)(\s+case)?\b.{0,25}(remove|take\s+out|replace|access)/i,
];

function containsDangerousAdvice(text) {
  if (typeof text !== 'string') {
    return false;
  }

  return DANGEROUS_ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function safeFallbackForDangerousAdvice() {
  return (
    "This repair involves opening internal, high-voltage components (like a power " +
    "supply), which isn't safe without training -- they can hold a dangerous charge " +
    "even when unplugged. Please don't attempt this yourself. Raising a ticket will " +
    'get a qualified technician to handle it.'
  );
}

// Credential-shaped substrings in a generated answer, redacted regardless
// of whether they came from a SOURCE or the model invented them -- either
// way they should never reach the reader.
const SECRET_PATTERNS = [
  /\bAIza[0-9A-Za-z_-]{30,40}\b/g, // Google API key
  /\bsk-[A-Za-z0-9]{20,}\b/g, // OpenAI-style key
  /\bgh[pousr]_[A-Za-z0-9]{30,40}\b/g, // GitHub token
  /\bBearer\s+[A-Za-z0-9._-]{20,}/gi, // Bearer token
  /\b(password|passwd|api[_-]?key|secret|token)\s*[:=]\s*\S+/gi, // labelled credential
];

function redactSecrets(text) {
  if (typeof text !== 'string') {
    return text;
  }

  let result = text;

  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[redacted]');
  }

  return result;
}

module.exports = {
  detectHazard,
  hazardEscalationMessage,
  containsDangerousAdvice,
  safeFallbackForDangerousAdvice,
  redactSecrets,
};
