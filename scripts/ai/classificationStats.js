/*
 * Pure comparison/summary helpers for the classification evaluation
 * harness (evaluate-classification.js). Split out so this logic -- the
 * part that can actually be wrong in a way worth catching -- is testable
 * without a live AI call, the same way chunker.js/similarity.js are
 * tested separately from the RAG pipeline that calls them.
 */

/*
 * Groups results by their expected value for one field (category or
 * priority) and counts how many were correctly predicted in each group.
 *
 * field: 'category' | 'priority' -- looks up `${field}Correct` on each
 *   result.
 * expectedField: 'expectedCategory' | 'expectedPriority' -- the value to
 *   group by.
 */
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

/*
 * Counts how often each (expected -> predicted) pair occurred, sorted
 * most frequent first. A missing prediction (null, from AI unavailable)
 * is labelled explicitly rather than rendered as "null".
 */
function confusionPairs(results, expectedField, predictedField) {
  const pairs = {};

  for (const result of results) {
    const key = `${result[expectedField]} -> ${result[predictedField] || '(no prediction)'}`;
    pairs[key] = (pairs[key] || 0) + 1;
  }

  return Object.entries(pairs).sort((a, b) => b[1] - a[1]);
}

module.exports = { summariseByField, confusionPairs };
