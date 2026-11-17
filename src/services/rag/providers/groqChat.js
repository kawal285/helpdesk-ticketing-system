/*
 * Groq text-generation provider (cloud).
 *
 * Same contract as ollamaChat.js:
 *   name
 *   generate(messages, overrides) -> string
 *
 * Unlike ollamaChat.js the model is chosen PER CALL (overrides.model),
 * because the fast agent and the thinking agent use different Groq models.
 *
 * Every failure carries an error.code so the caller can decide what to do
 * (fall back to Ollama, show a message) instead of guessing from text.
 * Nothing is swallowed -- a bad key must shout, not hide for weeks.
 */

const BASE_URL = (
  process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
).replace(/\/$/, '');

const TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 30000;
const DEFAULT_MAX_TOKENS = Number(process.env.GROQ_MAX_TOKENS) || 1024;
const REASONING_EFFORT = process.env.GROQ_REASONING_EFFORT || 'medium';

function fail(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

/*
 * overrides:
 *   model        Groq model id (required)
 *   temperature  default 0.2, matching the Ollama provider
 *   maxTokens    default GROQ_MAX_TOKENS or 1024
 *   think        true = ask a reasoning model to reason more
 *   reasoningEffort  'low' | 'medium' | 'high'. Overrides think. The fast
 *                agent uses 'low' so a reasoning model stays quick.
 */
async function generate(messages, overrides = {}) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.startsWith('gsk_your')) {
    throw fail('CONFIG', 'GROQ_API_KEY is missing, or still the placeholder, in .env');
  }

  if (!overrides.model) {
    throw fail('CONFIG', 'groqChat.generate called without a model name.');
  }

  const body = {
    model: overrides.model,
    messages,
    temperature: overrides.temperature ?? 0.2,
    max_tokens: overrides.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  if (overrides.reasoningEffort) {
    body.reasoning_effort = overrides.reasoningEffort;
  } else if (overrides.think) {
    body.reasoning_effort = REASONING_EFFORT;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;

  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw fail(
      'NETWORK',
      error.name === 'AbortError'
        ? `Groq request timed out after ${TIMEOUT_MS / 1000}s.`
        : `Could not reach Groq: ${error.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    throw fail('RATE_LIMIT', 'Groq rate limit reached.', {
      retryAfter: response.headers.get('retry-after'),
    });
  }

  if (response.status === 401) {
    throw fail('AUTH', 'Groq rejected the API key (401). Check GROQ_API_KEY.');
  }

  if (!response.ok) {
    throw fail('API', `Groq returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw fail('EMPTY', 'Groq returned an empty response.');
  }

  return content.trim();
}

module.exports = { name: 'groq', generate };