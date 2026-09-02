/*
 * End-to-end answer evaluation harness.
 *
 *   node scripts/rag/evaluate-answers.js
 *
 * measure-threshold.js only checks retrieval (did the right chunk come
 * back?). This checks the thing a person actually reads: the generated
 * answer text, for a curated set of realistic questions
 * (tests/rag/answer-evaluation-set.json). It does not score
 * correct/partial/wrong itself -- that requires comparing the generated
 * text against each question's correctAnswerMustCover list by hand, since
 * no simple string match can judge whether an answer paraphrased the
 * right thing. This script's job is only to capture the real transcript
 * so that scoring is done against actual model output, not
 * reconstructed from memory.
 *
 * Writes the raw transcript to docs/ai-evaluation-raw.json.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const db = require('../../src/models');
const { ask } = require('../../src/services/rag/ragService');

const testset = require('../../tests/rag/answer-evaluation-set.json');

async function run() {
  const results = [];

  console.log(`Asking ${testset.length} questions against the live RAG pipeline...\n`);

  for (const test of testset) {
    const start = Date.now();
    const result = await ask(test.question);
    const elapsed = Date.now() - start;

    console.log(`[${test.id}/${testset.length}] "${test.question}"`);
    console.log(`  grounded=${result.grounded} topScore=${result.topScore} sources=${result.sources.map((s) => s.articleId).join(',') || 'none'} (${elapsed}ms)`);

    results.push({
      id: test.id,
      question: test.question,
      expectedArticleId: test.expectedArticleId,
      correctAnswerMustCover: test.correctAnswerMustCover,
      answer: result.answer,
      grounded: result.grounded,
      sources: result.sources,
      topScore: result.topScore,
      threshold: result.threshold,
      model: result.model,
      ms: result.ms,
    });
  }

  const outPath = path.join(__dirname, '..', '..', 'docs', 'ai-evaluation-raw.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log(`\nWritten: docs/ai-evaluation-raw.json`);
  console.log('Score each answer against its correctAnswerMustCover list and write up docs/ai-evaluation-report.md.');
}

run()
  .catch((error) => {
    console.error('\nEvaluation failed:', error.message, '\n');
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
