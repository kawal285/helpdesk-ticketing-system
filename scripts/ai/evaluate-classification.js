/*
 * Ticket classification evaluation harness.
 *
 *   node scripts/ai/evaluate-classification.js
 *
 * Runs every description in tests/classification/ticket-classification-
 * evaluation-set.json through getAiSuggestions() -- the exact function
 * ticket.controller.js calls on real ticket creation, including its 8s
 * timeout and never-throws guarantee -- and compares the predicted
 * category/priority against the hand-labelled expected values.
 *
 * Mirrors scripts/rag/evaluate-answers.js: a real, live-API run captured
 * to a raw results file, not a Jest test (a real Gemini call per question
 * is slow and depends on external quota/availability, which is exactly
 * the kind of thing that makes a test suite flaky rather than useful).
 *
 * Writes docs/ai-classification-evaluation-raw.json.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { getAiSuggestions } = require('../../src/services/aiService');
const testSet = require('../../tests/classification/ticket-classification-evaluation-set.json');

function summariseByField(results, field, expectedField) {
  const byValue = {};

  for (const result of results) {
    const expected = result[expectedField];

    if (!byValue[expected]) {
      byValue[expected] = { correct: 0, total: 0 };
    }

    byValue[expected].total += 1;

    if (result[`${field}Correct`]) {
      byValue[expected].correct += 1;
    }
  }

  return byValue;
}

function confusionPairs(results, expectedField, predictedField) {
  const pairs = {};

  for (const result of results) {
    const key = `${result[expectedField]} -> ${result[predictedField] || '(no prediction)'}`;
    pairs[key] = (pairs[key] || 0) + 1;
  }

  return Object.entries(pairs).sort((a, b) => b[1] - a[1]);
}

function printBreakdown(title, byValue) {
  console.log(`\n${title}`);

  for (const [value, { correct, total }] of Object.entries(byValue)) {
    const pct = ((correct / total) * 100).toFixed(1);
    console.log(`  ${value}: ${correct}/${total} (${pct}%)`);
  }
}

async function run() {
  const results = [];

  console.log(`Classifying ${testSet.length} tickets against the live AI service...\n`);

  for (const test of testSet) {
    const start = Date.now();
    const ai = await getAiSuggestions(test.description);
    const elapsed = Date.now() - start;

    const categoryCorrect = ai.category === test.expectedCategory;
    const priorityCorrect = ai.priority === test.expectedPriority;

    console.log(
      `[${test.id}/${testSet.length}] category=${ai.category || '(none)'} ` +
        `(expected ${test.expectedCategory}, ${categoryCorrect ? 'OK' : 'MISS'}) ` +
        `priority=${ai.priority || '(none)'} (expected ${test.expectedPriority}, ` +
        `${priorityCorrect ? 'OK' : 'MISS'}) (${elapsed}ms)`
    );

    results.push({
      id: test.id,
      description: test.description,
      expectedCategory: test.expectedCategory,
      expectedPriority: test.expectedPriority,
      predictedCategory: ai.category,
      predictedPriority: ai.priority,
      categoryCorrect,
      priorityCorrect,
      aiUnavailable: ai.category === null,
      ms: elapsed,
    });
  }

  const categoryAccuracy = results.filter((r) => r.categoryCorrect).length / results.length;
  const priorityAccuracy = results.filter((r) => r.priorityCorrect).length / results.length;
  const unavailableCount = results.filter((r) => r.aiUnavailable).length;

  console.log('\n=== Overall ===');
  console.log(`Category accuracy: ${(categoryAccuracy * 100).toFixed(1)}% (${results.filter((r) => r.categoryCorrect).length}/${results.length})`);
  console.log(`Priority accuracy: ${(priorityAccuracy * 100).toFixed(1)}% (${results.filter((r) => r.priorityCorrect).length}/${results.length})`);

  if (unavailableCount > 0) {
    console.log(`AI unavailable (fell back to defaults) on ${unavailableCount}/${results.length} tickets.`);
  }

  printBreakdown('=== Category accuracy by expected category ===', summariseByField(results, 'category', 'expectedCategory'));
  printBreakdown('=== Priority accuracy by expected priority ===', summariseByField(results, 'priority', 'expectedPriority'));

  console.log('\n=== Category confusion (expected -> predicted) ===');
  for (const [pair, count] of confusionPairs(results, 'expectedCategory', 'predictedCategory')) {
    console.log(`  ${pair}: ${count}`);
  }

  console.log('\n=== Priority confusion (expected -> predicted) ===');
  for (const [pair, count] of confusionPairs(results, 'expectedPriority', 'predictedPriority')) {
    console.log(`  ${pair}: ${count}`);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    categoryAccuracy: Number((categoryAccuracy * 100).toFixed(1)),
    priorityAccuracy: Number((priorityAccuracy * 100).toFixed(1)),
    total: results.length,
    aiUnavailableCount: unavailableCount,
    results,
  };

  const outPath = path.join(__dirname, '..', '..', 'docs', 'ai-classification-evaluation-raw.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nWritten: docs/ai-classification-evaluation-raw.json`);
}

run().catch((error) => {
  console.error('\nEvaluation failed:', error.message, '\n');
  process.exitCode = 1;
});
