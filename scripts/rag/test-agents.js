/*
 * Runs each agent through generationService, and proves the fallback.
 *
 *   node scripts/rag/test-agents.js
 *
 * Needs Ollama running (the main agent and the fallback are local) and a
 * working GROQ_API_KEY. The last check breaks the Groq key on purpose, in
 * this process only, to show the fast agent falling back to Ollama.
 */
require('dotenv').config();

const { getAgent } = require('../../src/services/rag/agentRouter');
const { generateWithAgent } = require('../../src/services/rag/generationService');

async function run(label, agentName, prompt) {
  const started = Date.now();

  try {
    const result = await generateWithAgent(
      getAgent(agentName),
      [{ role: 'user', content: prompt }]
    );

    console.log(
      `${label} OK  agent=${result.agent} model=${result.provider}/${result.model} ` +
        `fellBack=${result.fellBack} (${Date.now() - started}ms)\n  ${result.content.slice(0, 160).replace(/\n/g, ' ')}\n`
    );
  } catch (error) {
    console.error(`${label} FAILED [${error.code || 'ERROR'}] ${error.message}\n`);
    process.exitCode = 1;
  }
}

(async () => {
  await run('FAST  ', 'fast', 'Say hello in 5 words.');
  await run('MAIN  ', 'main', 'Say hello in 5 words.');
  await run('THINK ', 'think', 'Give one likely cause of a printer showing offline.');

  console.log('--- breaking the Groq key on purpose: expect fellBack=true ---');
  process.env.GROQ_API_KEY = 'gsk_your_placeholder';
  await run('FAST* ', 'fast', 'Say hello in 5 words.');
})();