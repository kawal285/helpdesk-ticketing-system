/*
 * Ollama embedding provider -- runs locally, needs no API key.
 *
 * Implements the same contract as providers/gemini.js:
 *   name, dimensions, embedQuery(text), embedDocuments(texts, onProgress)
 *
 * Requires Ollama running and the model pulled:
 *   ollama pull nomic-embed-text
 *
 * nomic-embed-text produces 768-dimension vectors natively, so unlike the
 * Gemini provider there is nothing to truncate.
 */

const { normalise } = require('../similarity');

const DEFAULT_HOST = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'nomic-embed-text';
const DEFAULT_DIMENSIONS = 768;

/*
 * nomic-embed-text is trained with these prefixes and expects them. They
 * play the same role as Gemini's RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY
 * task types: telling the model whether it is embedding something to be
 * searched, or something to search with. Omitting them measurably hurts
 * retrieval quality.
 */
const DOCUMENT_PREFIX = 'search_document: ';
const QUERY_PREFIX = 'search_query: ';

const host = (process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/$/, '');
const modelName = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
const dimensions =
  Number(process.env.EMBEDDING_DIMENSIONS) || DEFAULT_DIMENSIONS;

function connectionHelp(error) {
  return new Error(
    `Could not reach Ollama at ${host} (${error.message}). ` +
      'Check that Ollama is running -- "ollama list" should respond -- ' +
      `and that the model is pulled: "ollama pull ${modelName}".`
  );
}

/*
 * Newer Ollama exposes /api/embed, which accepts a batch. Older builds
 * only have /api/embeddings, which takes one string at a time. Try the
 * modern route first and fall back, so this works on either version.
 */
async function callEmbed(texts) {
  let response;

  try {
    response = await fetch(`${host}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, input: texts }),
    });
  } catch (error) {
    throw connectionHelp(error);
  }

  if (response.status === 404) {
    return callLegacyEmbeddings(texts);
  }

  if (!response.ok) {
    throw new Error(
      `Ollama returned ${response.status}: ${await response.text()}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data.embeddings)) {
    throw new Error('Ollama response contained no embeddings array.');
  }

  return data.embeddings;
}

async function callLegacyEmbeddings(texts) {
  const vectors = [];

  for (const text of texts) {
    let response;

    try {
      response = await fetch(`${host}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName, prompt: text }),
      });
    } catch (error) {
      throw connectionHelp(error);
    }

    if (!response.ok) {
      throw new Error(
        `Ollama returned ${response.status}: ${await response.text()}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data.embedding)) {
      throw new Error('Ollama response contained no embedding array.');
    }

    vectors.push(data.embedding);
  }

  return vectors;
}

async function embedQuery(text) {
  const [vector] = await callEmbed([QUERY_PREFIX + text]);

  return normalise(vector);
}

async function embedDocuments(texts, onProgress) {
  const vectors = [];
  const BATCH = 16;

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts
      .slice(i, i + BATCH)
      .map((text) => DOCUMENT_PREFIX + text);

    const batch = await callEmbed(slice);

    for (const vector of batch) {
      vectors.push(normalise(vector));
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH, texts.length), texts.length);
    }
  }

  return vectors;
}

module.exports = {
  name: `ollama:${modelName}`,
  dimensions,
  embedQuery,
  embedDocuments,
};