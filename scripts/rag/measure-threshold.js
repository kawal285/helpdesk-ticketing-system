/*
 * Measures retrieval quality and derives a similarity threshold from the
 * data, rather than copying a number from a tutorial.
 *
 *   node scripts/rag/measure-threshold.js
 *
 * Two things are measured separately, because they fail for different
 * reasons and have different fixes:
 *
 *   Retrieval accuracy -- did the correct article come back in the top K?
 *                         Fixed by chunking, the embedding model, or K.
 *   Threshold quality  -- can one score separate real matches from noise?
 *                         Fixed by choosing a better cut-off.
 *
 * Writes a summary table to docs/rag-evaluation.md for the report.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const db = require('../../src/models');
const { retrieve } = require('../../src/services/rag/retrievalService');
const { getModelInfo } = require('../../src/services/rag/embeddingService');

const testset = require('../../tests/rag/testset.json');

const TOP_K = 3;

async function run() {
  const model = getModelInfo();
  const results = [];

  process.stdout.write(`Running ${testset.length} questions`);

  for (const test of testset) {
    const outcome = await retrieve(test.question, {
      topK: TOP_K,
      threshold: null,
    });

    const articleIds = outcome.matches.map((m) => m.articleId);

    results.push({
      ...test,
      topScore: outcome.topScore,
      topArticleId: articleIds[0],
      retrievedCorrect:
        test.expectedArticleId === null
          ? null
          : articleIds.includes(test.expectedArticleId),
      rank:
        test.expectedArticleId === null
          ? null
          : articleIds.indexOf(test.expectedArticleId) + 1 || null,
    });

    process.stdout.write('.');
  }

  process.stdout.write('\n');

  return { model, results };
}

/*
 * Sweeps candidate thresholds and counts, at each one:
 *   answered   -- in-domain questions that clear the bar (want: all)
 *   refused    -- out-of-domain questions kept out    (want: all)
 * The best threshold maximises the two together.
 */
function sweep(results) {
  const inDomain = results.filter((r) => r.expectedArticleId !== null);
  const outDomain = results.filter((r) => r.expectedArticleId === null);

  const rows = [];

  for (let t = 0.4; t <= 0.85; t += 0.01) {
    const answered = inDomain.filter((r) => r.topScore >= t).length;
    const refused = outDomain.filter((r) => r.topScore < t).length;

    rows.push({
      threshold: Number(t.toFixed(2)),
      answered,
      refused,
      total: answered + refused,
    });
  }

  const best = rows.reduce((a, b) => (b.total > a.total ? b : a));

  return { rows, best, inDomain, outDomain };
}

function report({ model, results }) {
  const { best, inDomain, outDomain } = sweep(results);

  const retrieved = inDomain.filter((r) => r.retrievedCorrect).length;

  const lowestGood = Math.min(...inDomain.map((r) => r.topScore));
  const highestNoise = Math.max(...outDomain.map((r) => r.topScore));

  console.log('');
  console.log('RETRIEVAL ACCURACY');
  console.log(
    `  Correct article in top ${TOP_K}: ${retrieved}/${inDomain.length} ` +
      `(${Math.round((retrieved / inDomain.length) * 100)}%)`
  );

  const missed = inDomain.filter((r) => !r.retrievedCorrect);

  if (missed.length) {
    console.log('  Missed:');
    for (const m of missed) {
      console.log(
        `    "${m.question.slice(0, 55)}" -> got article ${m.topArticleId}, ` +
          `expected ${m.expectedArticleId}`
      );
    }
  }

  console.log('');
  console.log('SCORE SEPARATION');
  console.log(`  Lowest in-domain score  : ${lowestGood.toFixed(4)}`);
  console.log(`  Highest noise score     : ${highestNoise.toFixed(4)}`);
  console.log(
    `  Gap                     : ${(lowestGood - highestNoise).toFixed(4)}` +
      (lowestGood > highestNoise ? '' : '   (OVERLAP -- see note below)')
  );

  console.log('');
  console.log('SUGGESTED THRESHOLD');
  console.log(`  ${best.threshold}`);
  console.log(
    `  answers ${best.answered}/${inDomain.length} real questions, ` +
      `refuses ${best.refused}/${outDomain.length} unrelated ones`
  );

  if (lowestGood <= highestNoise) {
    console.log('');
    console.log(
      '  Note: the ranges overlap, so no threshold separates them perfectly.'
    );
    console.log(
      '  The value above is the best available trade-off. Which errors matter'
    );
    console.log(
      '  more -- a wrong answer or an unnecessary refusal -- is your call.'
    );
  }

  console.log('');
  console.log(`  Add to .env:  RAG_SIMILARITY_THRESHOLD=${best.threshold}`);
  console.log('');

  return { best, retrieved, inDomain, outDomain, lowestGood, highestNoise };
}

function writeMarkdown({ model, results }, summary) {
  const lines = [
    '# RAG retrieval evaluation',
    '',
    `Embedding provider: \`${model.name}\` (${model.dimensions} dimensions)`,
    `Top-K: ${TOP_K}`,
    `Chosen similarity threshold: **${summary.best.threshold}**`,
    '',
    'This measures retrieval only (did the right chunk come back?). For',
    'whether the generated *answer* text is actually correct, see',
    '[ai-evaluation-report.md](./ai-evaluation-report.md).',
    '',
    '## Results',
    '',
    '| # | Type | Question | Top score | Correct chunk retrieved? |',
    '| --- | --- | --- | --- | --- |',
  ];

  results.forEach((r, i) => {
    const correct =
      r.expectedArticleId === null
        ? r.topScore < summary.best.threshold
          ? 'n/a — correctly refused'
          : 'n/a — WRONGLY ANSWERED'
        : r.retrievedCorrect
          ? `Yes (rank ${r.rank})`
          : 'No';

    lines.push(
      `| ${i + 1} | ${r.type} | ${r.question.slice(0, 70)} | ${r.topScore.toFixed(4)} | ${correct} |`
    );
  });

  lines.push(
    '',
    '## Summary',
    '',
    `- Correct article retrieved for ${summary.retrieved}/${summary.inDomain.length} in-domain questions.`,
    `- Lowest in-domain score: ${summary.lowestGood.toFixed(4)}`,
    `- Highest out-of-domain score: ${summary.highestNoise.toFixed(4)}`,
    `- The threshold was selected by sweeping values from 0.40 to 0.85 and`,
    `  choosing the one that answers the most real questions while refusing`,
    `  the most unrelated ones. It was not copied from a tutorial.`,
    ''
  );

  const dir = path.join(__dirname, '..', '..', 'docs');

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rag-evaluation.md'), lines.join('\n'));

  console.log('Written: docs/rag-evaluation.md');
  console.log('');
}

run()
  .then((data) => writeMarkdown(data, report(data)))
  .catch((error) => {
    console.error('\nMeasurement failed:', error.message, '\n');
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());