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
 *
 * Four override keys are NOT Ollama options and are handled here instead,
 * so the multi-agent code can use one call shape for every provider:
 *   model            use this model for this call instead of GENERATION_MODEL
 *   maxTokens        same as num_predict
 *   think            ignored (a cloud-model setting)
 *   reasoningEffort  ignored (a cloud-model setting)
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

/*
 * Context window. On a low-memory laptop a smaller window is faster, but if
 * the prompt (rules + sources + question) plus the reply do not fit, Ollama
 * quietly cuts text off -- and the rules are at the start. Leave this unset
 * unless you have measured it; 4096 is a safe floor for this prompt.
 */
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || null;

// Calls the chat API and returns Ollama's full JSON reply.
async function callChat(messages, overrides = {}, { logprobs = false } = {}) {
  // eslint-disable-next-line no-unused-vars
  const { model, maxTokens, think, reasoningEffort, ...ollamaOptions } = overrides;
  const useModel = model || modelName;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;

  try {
    response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        messages,
        stream: false,
        keep_alive: KEEP_ALIVE,
        ...(logprobs ? { logprobs: true, top_logprobs: 3 } : {}),
        options: {
          temperature,
          num_predict: maxTokens || MAX_TOKENS,
          ...(NUM_CTX ? { num_ctx: NUM_CTX } : {}),
          ...ollamaOptions,
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
        `Check it is running and that "ollama pull ${useModel}" has completed.`
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

  return data;
}

async function generate(messages, overrides = {}) {
  const data = await callChat(messages, overrides);
  return data.message.content.trim();
}

/*
 * Same as generate, plus how likely the model thought each token was.
 * content is NOT trimmed, so token positions line up with it. Used to
 * tell how sure the model was of a ticket's priority and category.
 */
async function generateWithLogprobs(messages, overrides = {}) {
  const data = await callChat(messages, overrides, { logprobs: true });
  return {
    content: data.message.content,
    tokens: Array.isArray(data.logprobs) ? data.logprobs : null,
  };
}

module.exports = { name: `ollama:${modelName}`, generate, generateWithLogprobs };