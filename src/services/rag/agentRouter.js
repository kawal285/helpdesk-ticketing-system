/*
 * Decides WHICH agent answers a message. It does not answer anything.
 *
 *   fast   small talk only ("hi", "thanks"). No knowledge base, no IT advice.
 *   main   the normal grounded RAG answer. The default.
 *   think  harder, multi-step or "why" questions, or when the user asks for
 *          it. Still grounded in the knowledge base.
 *
 * Rule-based on purpose: instant, free, and easy to explain in a PDR. An AI
 * classifier can replace pickAgent() later without touching anything else.
 *
 * Message LENGTH is deliberately not used to pick the fast agent. A short
 * message like "printer offline" is a real IT question and must go through
 * the knowledge base; sending it to a model with no sources would invite
 * invented fixes.
 */

// Words that, on their own, are just politeness. Every word in the message
// must be one of these, so "hello my printer is broken" is NOT small talk.
const SMALL_TALK_WORDS = new Set([
  'hi', 'hello', 'hey', 'hiya', 'yo', 'thanks', 'thank', 'you', 'thx', 'ty',
  'ok', 'okay', 'cool', 'great', 'nice', 'perfect', 'awesome', 'bye',
  'goodbye', 'cheers', 'good', 'morning', 'afternoon', 'evening', 'there',
  'again', 'so', 'much', 'a', 'lot', 'mate',
]);

const MAX_SMALL_TALK_WORDS = 5;

const THINK_HINTS = new RegExp(
  '\\b(' +
    [
      'why',
      'troubleshoot\\w*',
      'step[- ]by[- ]step',
      'compare',
      'explain',
      'diagnos\\w*',
      'root cause',
      'what else',
      'already tried',
      'still (?:not|doesn\'?t|won\'?t|failing|broken)',
      'keeps? (?:\\w+ ){0,2}(?:dropping|crashing|failing|disconnecting|freezing)',
    ].join('|') +
    ')\\b',
  'i'
);

const LONG_MESSAGE_CHARS = 250;

function isSmallTalk(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return (
    words.length > 0 &&
    words.length <= MAX_SMALL_TALK_WORDS &&
    words.every((word) => SMALL_TALK_WORDS.has(word))
  );
}

/*
 * forceThink must be the boolean true. The controller passes it from the
 * "Think deeper" button; anything else (a string, 1) is ignored so a
 * malformed request cannot switch agents by accident.
 */
function pickAgent(message, { forceThink = false } = {}) {
  const text = typeof message === 'string' ? message.trim() : '';

  if (forceThink === true) return 'think';
  if (isSmallTalk(text)) return 'fast';
  if (text.length > LONG_MESSAGE_CHARS || THINK_HINTS.test(text)) return 'think';

  return 'main';
}

/*
 * Settings are read from .env at call time (not at require time) so tests
 * and a restarted server both see the current values.
 *
 * A missing AGENT_<NAME>_PROVIDER or _MODEL falls back to the Ollama
 * defaults the rest of the app already uses.
 */
// maxTokens: a reasoning model spends part of its budget thinking before it
// writes the answer, so the think agent needs far more room than its answer
// length suggests. null = the provider's own default.
const AGENT_DEFAULTS = {
  fast: { useRag: false, think: false, temperature: 0.4, reasoningEffort: 'low', maxTokens: 150 },
  main: { useRag: true, think: false, temperature: 0.2, reasoningEffort: null, maxTokens: null },
  think: { useRag: true, think: true, temperature: 0.3, reasoningEffort: null, maxTokens: 1500 },
};

function getAgent(name) {
  const defaults = AGENT_DEFAULTS[name];

  if (!defaults) {
    throw new Error(`Unknown agent "${name}". Use fast, main or think.`);
  }

  const key = name.toUpperCase();

  return {
    name,
    ...defaults,
    provider: process.env[`AGENT_${key}_PROVIDER`] || 'ollama',
    model:
      process.env[`AGENT_${key}_MODEL`] ||
      process.env.GENERATION_MODEL ||
      'llama3.2',
  };
}

/*
 * Where to go when an agent's own provider fails (Groq rate limit, no
 * internet). Always a local model, so the assistant still answers offline.
 */
function getFallback() {
  return {
    provider: process.env.AGENT_FALLBACK_PROVIDER || 'ollama',
    model:
      process.env.AGENT_FALLBACK_MODEL ||
      process.env.GENERATION_MODEL ||
      'llama3.2',
  };
}

module.exports = { pickAgent, getAgent, getFallback, isSmallTalk };