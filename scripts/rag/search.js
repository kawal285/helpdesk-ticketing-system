/*
 * Retrieval test harness. No LLM -- shows exactly which chunks a question
 * matches and how strongly.
 *
 *   node scripts/rag/search.js "how do I reset my password"
 *   node scripts/rag/search.js "who won the football" --k 5
 *
 * Read the scores. Retrieval must be right before generation is worth
 * building: if the wrong chunk comes back, no prompt can fix the answer.
 */

require('dotenv').config();

const db = require('../../src/models');
const { retrieve } = require('../../src/services/rag/retrievalService');

function parseArgs() {
  const args = process.argv.slice(2);
  const kFlag = args.indexOf('--k');

  let topK = 5;

  if (kFlag !== -1) {
    topK = Number(args[kFlag + 1]) || 5;
    args.splice(kFlag, 2);
  }

  return { question: args.join(' ').trim(), topK };
}

async function main() {
  const { question, topK } = parseArgs();

  if (!question) {
    console.log('\nUsage: node scripts/rag/search.js "your question here"\n');
    process.exitCode = 1;
    return;
  }

  const result = await retrieve(question, { topK, threshold: null });

  console.log('');
  console.log(`Question : ${result.question}`);
  console.log(`Searched : ${result.searched} chunks`);
  console.log('');

  result.matches.forEach((match, i) => {
    console.log(
      `${(i + 1).toString().padStart(2)}. ${match.score.toFixed(4)}  ` +
        `[${match.category}] ${match.articleTitle}`
    );
    console.log(`                  -> ${match.heading}`);
  });

  console.log('');
  console.log('Best match text:');
  console.log('');
  console.log(result.matches[0].text.replace(/^/gm, '    '));
  console.log('');
}

main()
  .catch((error) => {
    console.error('\nSearch failed:', error.message, '\n');
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());