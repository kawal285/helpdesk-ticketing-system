/*
 * Removes sensitive details from user-written text before it leaves the
 * server -- to a chat model (Groq / college / local Ollama), the embedding
 * provider (Gemini) or the web search provider (DuckDuckGo).
 *
 * Applied to what the *user* wrote (ticket descriptions, assistant
 * questions, conversation history, search queries), never to the
 * knowledge base: help-desk articles legitimately carry the desk's own
 * phone numbers and emails, and the answer needs them.
 *
 * Each match is replaced with a typed placeholder such as [EMAIL] so the
 * model still knows *what kind* of detail was there ("my [PASSWORD] is
 * not working" classifies the same as the original). Only the counts of
 * what was removed are ever returned or logged, never the values.
 */

// Order matters: the most specific patterns run first so, for example, a
// bearer token isn't half-matched as something else.
const RULES = [
  {
    type: 'PRIVATE_KEY',
    pattern:
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  { type: 'TOKEN', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi },
  // JSON web token: three base64url segments, the first two starting eyJ.
  { type: 'TOKEN', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { type: 'API_KEY', pattern: /\bAIza[0-9A-Za-z_-]{30,40}\b/g }, // Google
  { type: 'API_KEY', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g }, // OpenAI-style
  { type: 'API_KEY', pattern: /\bgsk_[A-Za-z0-9]{20,}\b/g }, // Groq
  { type: 'API_KEY', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,40}\b/g }, // GitHub
  { type: 'API_KEY', pattern: /\bAKIA[0-9A-Z]{16}\b/g }, // AWS access key id
  { type: 'API_KEY', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g }, // Slack
  // Labelled secret with ':' or '=': "password: hunter2", "api_key=abc".
  {
    type: 'PASSWORD',
    pattern:
      /\b(password|passwd|pwd|passcode|pin|api[_ -]?key|secret|client[_ -]?secret|access[_ -]?token|token)(\s*[:=]\s*)(?!\[[A-Z_]+\])("[^"]+"|'[^']+'|\S*[^\s.,;)])/gi,
    keepLabel: true,
  },
  // "my password is Summer2024!" -- only when the value looks like a real
  // secret (quoted, or containing a digit or symbol), so "my password is
  // expired" is left alone and still classifies correctly.
  {
    type: 'PASSWORD',
    pattern:
      /\b(password|passwd|passcode|pin)(\s+(?:is|was|=|to)\s+)(?!\[[A-Z_]+\])("[^"]+"|'[^']+'|(?=\S*[\d!@#$%^&*?])\S*[^\s.,;)])/gi,
    keepLabel: true,
  },
  {
    type: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  // Card numbers are checked with Luhn below so order/ticket numbers of
  // the same length aren't caught.
  { type: 'CARD', pattern: /\b(?:\d[ -]?){12,18}\d\b/g, check: luhnValid },
  // Phone numbers starting with + or 0 (NZ: 021 123 4567, 09-123 4567,
  // (09) 123 4567, 0800 123 456, +64 21 123 4567), 8 to 15 digits.
  {
    type: 'PHONE',
    pattern: /(?:\+\d{1,3}[\s-]?|\(0\d{1,4}\)\s?|\b0)[\d\s-]{6,16}\d\b/g,
    check: (match) => {
      // Dates like 05-11-2026 have enough digits but aren't phones.
      if (/^\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\s*$/.test(match)) return false;
      const digits = match.replace(/\D/g, '').length;
      return digits >= 8 && digits <= 15;
    },
  },
];

function luhnValid(match) {
  const digits = match.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * @returns {{ text: string, redactions: Object<string, number> }}
 *   the cleaned text and how many of each type were removed.
 */
function redactSensitiveData(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { text, redactions: {} };
  }

  const redactions = {};
  let result = text;

  for (const rule of RULES) {
    result = result.replace(rule.pattern, (match, ...groups) => {
      if (rule.check && !rule.check(match)) return match;
      redactions[rule.type] = (redactions[rule.type] || 0) + 1;
      return rule.keepLabel
        ? `${groups[0]}${groups[1]}[${rule.type}]`
        : `[${rule.type}]`;
    });
  }

  return { text: result, redactions };
}

// Convenience when only the cleaned text is needed.
function redact(text) {
  return redactSensitiveData(text).text;
}

module.exports = { redactSensitiveData, redact };
