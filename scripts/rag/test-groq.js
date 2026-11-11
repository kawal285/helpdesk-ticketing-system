/*
 * Checks the Groq connection on its own, before it is wired into the app.
 *
 *   node scripts/rag/test-groq.js
 *
 * Expect two OK lines. The error code printed on failure says what to fix:
 *   CONFIG      .env missing GROQ_API_KEY or a model name
 *   AUTH        key is wrong
 *   API         usually "model not found" -- check the name in the Groq console
 *   RATE_LIMIT  free-tier limit hit
 *   NETWORK     no internet, or timed out
 */
require('dotenv').config();

const groq = require('../../src/services/rag/providers/groqChat');

async function check(label, options, prompt) {
  const started = Date.now();

  try {
    const reply = await groq.generate(
      [{ role: 'user', content: prompt }],
      options
    );
    console.log(`${label} OK (${options.model}, ${Date.now() - started}ms)\n  ${reply}\n`);
  } catch (error) {
    console.error(`${label} FAILED [${error.code || 'ERROR'}] ${error.message}\n`);
    process.exitCode = 1;
  }
}

(async () => {
  await check(
    'FAST ',
    { model: process.env.AGENT_FAST_MODEL },
    'Say hello in 5 words.'
  );

  await check(
    'THINK',
    { model: process.env.AGENT_THINK_MODEL, think: true, maxTokens: 1500 },
    'My laptop Wi-Fi drops every 10 minutes. Give 3 likely causes.'
  );
})();