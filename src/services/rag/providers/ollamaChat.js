/*
 * Ollama text-generation provider.
 *
 * Contract (mirrors the embedding providers):
 *   name
 *   generate(messages, overrides) -> string
 *
 * overrides are merged into Ollama's options object, so a caller can ask
 * for a shorter or more deterministic reply than the defaults below.
 * Ticket classification uses this; the RAG assistant passes nothing and
 * gets the defaults.
 */

const DEFAULT_HOST = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3.2';

const host = (process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/$/, '');
const modelName = process.env.GENERATION_MODEL || DEFAULT_MODEL;

/*
 * Low temperature. Higher values make the model more inventive, which is
 * the opposite of what grounding needs -- but zero produces flat, robotic
 * phrasing, and we want the answer to read naturally.
 */
const temperature = Number(process.env.GENERATION_TEMPERATURE) || 0.2;

const TIMEOUT_MS = Number(process.env.GENERATION_TIMEOUT_MS) || 180000;

/*
 * Caps how many tokens the model may produce. The prompt already asks for
 * short answers, but a hard limit stops a rambling response from taking
 * minutes on CPU. Roughly 300 tokens is comfortably more than 130 words.
 */
const MAX_TOKENS = Number(process.env.GENERATION_MAX_TOKENS) || 300;

/*
 * Keeps the model resident in memory between requests. Without this Ollama
 * unloads it after 5 minutes and the next question pays the full load cost
 * again -- which is what a demo cannot afford.
 */
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

async function generate(messages, overrides = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;

  try {
    response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: false,
        keep_alive: KEEP_ALIVE,
        options: {
          temperature,
          num_predict: MAX_TOKENS,
          ...overrides,
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Generation timed out after ${TIMEOUT_MS / 1000}s. A local model on ` +
          'CPU can be slow; raise GENERATION_TIMEOUT_MS or use a smaller model.'
      );
    }

    throw new Error(
      `Could not reach Ollama at ${host} (${error.message}). ` +
        `Check it is running and that "ollama pull ${modelName}" has completed.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      `Ollama returned ${response.status}: ${await response.text()}`
    );
  }

  const data = await response.json();
  const content = data && data.message && data.message.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Ollama returned an empty response.');
  }

  return content.trim();
}

module.exports = { name: `ollama:${modelName}`, generate };