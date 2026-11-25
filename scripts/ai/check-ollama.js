/*
 * Checks that Ollama is ready for this app -- run it after installing or
 * updating Ollama:
 *
 *   npm run check:ai
 *
 * It checks, in order:
 *   1. Ollama answers at OLLAMA_HOST (default http://127.0.0.1:11434)
 *   2. its version
 *   3. the chat model (GENERATION_MODEL) and embedding model
 *      (EMBEDDING_MODEL) are downloaded
 *   4. embeddings come back with EMBEDDING_DIMENSIONS numbers (768 for
 *      nomic-embed-text) -- a different size breaks the KB search
 *   5. the chat model answers, and how long it took
 *   6. the chat model returns token probabilities, which the
 *      "Needs human check" handoff uses (docs/ai-handoff.md)
 *
 * Exits with code 1 if anything the app needs is missing.
 */

require('dotenv').config({ quiet: true });

const host = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');
const chatModel = process.env.GENERATION_MODEL || 'llama3.2';
const embedModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const dimensions = Number(process.env.EMBEDDING_DIMENSIONS) || 768;

const results = [];
function record(ok, name, detail, fix = '') {
  results.push({ ok, name, detail, fix });
  const mark = ok === true ? 'PASS' : ok === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${mark}  ${name}: ${detail}${fix && ok !== true ? `\n      -> ${fix}` : ''}`);
}

async function getJson(path, body) {
  const response = await fetch(`${host}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

// "llama3.2" matches "llama3.2:latest".
function hasModel(models, name) {
  return models.some((m) => m.name === name || m.name === `${name}:latest` || m.model === name);
}

async function run() {
  console.log(`Checking Ollama at ${host} for chat model "${chatModel}" and embedding model "${embedModel}"\n`);

  let models;
  try {
    models = (await getJson('/api/tags')).models || [];
    record(true, 'Ollama running', host);
  } catch (error) {
    record(false, 'Ollama running', error.message, 'Start Ollama (open the Ollama app, or run "ollama list") and try again.');
    return;
  }

  try {
    const { version } = await getJson('/api/version');
    record(true, 'Version', version);
  } catch (error) {
    record('warn', 'Version', `could not read (${error.message})`);
  }

  const chatThere = hasModel(models, chatModel);
  record(chatThere, 'Chat model downloaded', chatModel, `Run: ollama pull ${chatModel}`);
  const embedThere = hasModel(models, embedModel);
  record(embedThere, 'Embedding model downloaded', embedModel, `Run: ollama pull ${embedModel}`);

  if (embedThere) {
    try {
      const data = await getJson('/api/embed', { model: embedModel, input: ['search_document: printer not printing'] });
      const size = data.embeddings && data.embeddings[0] ? data.embeddings[0].length : 0;
      record(
        size === dimensions,
        'Embedding size',
        `${size} numbers (expected ${dimensions})`,
        'EMBEDDING_DIMENSIONS in .env must match the model. If you changed model, run: npm run kb:index -- --force'
      );
    } catch (error) {
      record(false, 'Embeddings work', error.message, 'Update Ollama, then re-run this check.');
    }
  }

  if (chatThere) {
    try {
      const started = Date.now();
      const data = await getJson('/api/chat', {
        model: chatModel,
        stream: false,
        logprobs: true,
        top_logprobs: 3,
        options: { temperature: 0.1, num_predict: 8 },
        messages: [{ role: 'user', content: 'Reply with one word: High or Low. A printer is out of toner.' }],
      });
      const ms = Date.now() - started;
      const answer = (data.message && data.message.content || '').trim();
      record(Boolean(answer), 'Chat model answers', `"${answer.slice(0, 40)}" in ${(ms / 1000).toFixed(1)}s` +
        (ms > 15000 ? ' (first call loads the model, so it is slow; run again for a real time)' : ''));
      record(
        Array.isArray(data.logprobs) && data.logprobs.length > 0 ? true : 'warn',
        'Token probabilities',
        Array.isArray(data.logprobs) && data.logprobs.length > 0
          ? 'returned (the "Needs human check" handoff works)'
          : 'not returned',
        'Update Ollama to a newer version. Without them tickets are never flagged for low AI confidence, but everything else works.'
      );
    } catch (error) {
      record(false, 'Chat model answers', error.message, 'Check the model downloaded fully: ollama pull ' + chatModel);
    }
  }
}

run()
  .catch((error) => record(false, 'Check', error.message))
  .finally(() => {
    const failed = results.filter((r) => r.ok === false).length;
    console.log(failed ? `\n${failed} check(s) failed.` : '\nOllama is ready for the app.');
    process.exitCode = failed ? 1 : 0;
  });
