/*
 * Phase 5 smoke test. Proves three things before we build anything on
 * top of embeddings:
 *
 *   1. The API key and model name work.
 *   2. We know the real vector length being returned.
 *   3. The vectors actually capture meaning -- a paraphrase scores high,
 *      an unrelated sentence scores low.
 *
 * Point 3 is the one that matters. If a paraphrase does not outscore an
 * unrelated sentence, retrieval cannot work and there is no point
 * continuing to the database.
 *
 * Run: node scripts/rag/smoke-embed.js
 */

require('dotenv').config();

const { embedQuery, getModelInfo } = require('../../src/services/rag/embeddingService');
const { cosineSimilarity } = require('../../src/services/rag/similarity');

const REFERENCE =
  'Reset a forgotten password — Reset your own password. ' +
  'Open the sign-in page and select Forgot password. Enter your ' +
  'institutional email address and follow the reset link sent to your inbox.';

const PARAPHRASE = 'I cannot remember my login details, how do I change them?';
const RELATED = 'My account is locked after too many sign-in attempts.';
const UNRELATED = 'Who won the football match last night?';

async function main() {
  const info = getModelInfo();

  console.log('Provider  :', info.name);
  console.log('Configured:', info.dimensions, 'dimensions');
  console.log('');

  const reference = await embedQuery(REFERENCE);

  console.log('Actual    :', reference.length, 'dimensions returned');

  if (reference.length !== info.dimensions) {
    console.log('');
    console.log('WARNING: returned length does not match EMBEDDING_DIMENSIONS.');
    console.log('Set EMBEDDING_DIMENSIONS=' + reference.length + ' in .env.');
  }

  console.log('');

  const cases = [
    ['paraphrase of the article', PARAPHRASE],
    ['related but different topic', RELATED],
    ['completely unrelated', UNRELATED],
  ];

  const scores = {};

  for (const [label, text] of cases) {
    const score = cosineSimilarity(reference, await embedQuery(text));
    scores[label] = score;
    console.log(score.toFixed(4).padStart(7), ' ', label);
  }

  console.log('');

  const ok =
    scores['paraphrase of the article'] > scores['completely unrelated'] &&
    scores['related but different topic'] > scores['completely unrelated'];

  console.log(
    ok
      ? 'PASS - semantic ordering is correct. Safe to continue to Phase 6.'
      : 'FAIL - the model is not separating related from unrelated text. Stop and investigate.'
  );

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error('');
  console.error('Smoke test failed:', error.message);
  process.exit(1);
});