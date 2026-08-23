/*
 * End-to-end RAG test harness.
 *
 *   node scripts/rag/ask.js "how do I reset my password"
 *   node scripts/rag/ask.js "who won the football" --debug
 *
 * --debug prints the exact prompt sent to the model, which is the first
 * thing to look at when an answer is wrong.
 */

require('dotenv').config();

const db = require('../../src/models');
const { ask } = require('../../src/services/rag/ragService');
const { retrieve } = require('../../src/services/rag/retrievalService');
const { buildMessages } = require('../../src/services/rag/prompt');

async function main() {
  const args = process.argv.slice(2);
  const debug = args.includes('--debug');
  const question = args.filter((a) => a !== '--debug').join(' ').trim();

  if (!question) {
    console.log('\nUsage: node scripts/rag/ask.js "your question"\n');
    process.exitCode = 1;
    return;
  }

  if (debug) {
    const retrieval = await retrieve(question);

    console.log('\n--- PROMPT SENT TO MODEL ---\n');

    if (!retrieval.hasRelevantContext) {
      console.log('(nothing cleared the threshold -- model is not called)');
    } else {
      for (const message of buildMessages(question, retrieval.relevant)) {
        console.log(`[${message.role}]\n${message.content}\n`);
      }
    }

    console.log('--- END PROMPT ---');
  }

  const result = await ask(question);

  console.log('');
  console.log(`Q: ${question}`);
  console.log('');
  console.log(result.answer);
  console.log('');

  if (result.sources.length) {
    console.log('Sources:');

    for (const source of result.sources) {
      console.log(`  - ${source.title} — ${source.section} (${source.score})`);
    }
  } else {
    console.log(`(no sources — top score ${result.topScore}, threshold ${result.threshold})`);
  }

  console.log('');
  console.log(
    `[grounded: ${result.grounded} | ${result.model} | ${result.ms}ms]`
  );
  console.log('');
}

main()
  .catch((error) => {
    console.error('\nFailed:', error.message, '\n');
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());