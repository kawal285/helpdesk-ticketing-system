/*
 * Gemini embedding provider.
 *
 * Implements the provider contract used by embeddingService.js:
 *   name         -- identifier stored alongside every vector
 *   dimensions   -- vector length this provider is configured to produce
 *   embedQuery(text)        -> number[]
 *   embedDocuments(texts)   -> number[][]
 *
 * Queries and documents are embedded with different task types. The model
 * places a question and the passage that answers it closer together when
 * it is told which is which, so this is a free accuracy gain.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { truncateAndNormalise } = require('../similarity');

const DEFAULT_MODEL = 'gemini-embedding-001';
const DEFAULT_DIMENSIONS = 768;
const MAX_RETRIES = 3;

// Task types are passed as plain strings rather than imported from the
// SDK's TaskType enum, because the enum's export path has moved between
// SDK versions and a string is stable across all of them.
const DOCUMENT_TASK = 'RETRIEVAL_DOCUMENT';
const QUERY_TASK = 'RETRIEVAL_QUERY';

const modelName = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
const dimensions =
  Number(process.env.EMBEDDING_DIMENSIONS) || DEFAULT_DIMENSIONS;

let client = null;

function getModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is not set. Add it to .env before running ingestion.'
    );
  }

  if (!client) {
    client = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY
    ).getGenerativeModel({ model: modelName });
  }

  return client;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedOnce(text, taskType) {
  const result = await getModel().embedContent({
    content: { parts: [{ text }] },
    taskType,
  });

  const values = result && result.embedding && result.embedding.values;

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(
      `Embedding API returned no vector for: "${text.slice(0, 60)}..."`
    );
  }

  return truncateAndNormalise(values, dimensions);
}

/*
 * Retries only on rate limiting (429) and transient server errors, with
 * an increasing wait. A bad API key or a malformed request fails
 * immediately -- retrying those just delays the error you need to see.
 */
async function embedWithRetry(text, taskType) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await embedOnce(text, taskType);
    } catch (error) {
      lastError = error;

      const status = error.status || (error.response && error.response.status);
      const retryable = status === 429 || (status >= 500 && status < 600);

      if (!retryable || attempt === MAX_RETRIES) {
        throw error;
      }

      await sleep(attempt * 2000);
    }
  }

  throw lastError;
}

function embedQuery(text) {
  return embedWithRetry(text, QUERY_TASK);
}

/*
 * Sequential rather than parallel. 113 chunks takes about 30 seconds,
 * which is fine for a job that runs at ingestion time, and it keeps us
 * comfortably inside the free-tier rate limit. Firing 113 concurrent
 * requests would trip it immediately.
 */
async function embedDocuments(texts, onProgress) {
  const vectors = [];

  for (let i = 0; i < texts.length; i += 1) {
    vectors.push(await embedWithRetry(texts[i], DOCUMENT_TASK));

    if (onProgress) {
      onProgress(i + 1, texts.length);
    }

    await sleep(150);
  }

  return vectors;
}

module.exports = {
  name: `gemini:${modelName}`,
  dimensions,
  embedQuery,
  embedDocuments,
};