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

/*
 * Full confusion matrix: matrix[expected][predicted] = count, for a fixed
 * label order so rows/columns always line up in the report. A missing
 * prediction is counted in a NONE column so it is never silently dropped.
 */
const NONE = '(none)';

function confusionMatrix(results, expectedField, predictedField, labels) {
  const columns = [...labels, NONE];
  const matrix = {};

  for (const row of labels) {
    matrix[row] = Object.fromEntries(columns.map((col) => [col, 0]));
  }

  for (const result of results) {
    const expected = result[expectedField];
    if (!matrix[expected]) continue;
    const predicted = labels.includes(result[predictedField]) ? result[predictedField] : NONE;
    matrix[expected][predicted] += 1;
  }

  return matrix;
}

function round(value, places = 3) {
  return Number(value.toFixed(places));
}

/*
 * Precision, recall and F1 for every label, plus macro (every label
 * counts the same) and weighted (by how many tickets have that label)
 * averages. A label never predicted has precision 0, not NaN.
 */
function classMetrics(matrix, labels) {
  const perClass = {};
  let total = 0;

  for (const label of labels) {
    const tp = matrix[label][label];
    const support = Object.values(matrix[label]).reduce((a, b) => a + b, 0);
    const predicted = labels.reduce((sum, row) => sum + matrix[row][label], 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

    perClass[label] = {
      precision: round(precision),
      recall: round(recall),
      f1: round(f1),
      support,
    };
    total += support;
  }

  const macro = (key) =>
    round(labels.reduce((sum, l) => sum + perClass[l][key], 0) / labels.length);
  const weighted = (key) =>
    total
      ? round(labels.reduce((sum, l) => sum + perClass[l][key] * perClass[l].support, 0) / total)
      : 0;

  const correct = labels.reduce((sum, l) => sum + matrix[l][l], 0);

  return {
    perClass,
    accuracy: total ? round(correct / total) : 0,
    correct,
    total,
    macro: { precision: macro('precision'), recall: macro('recall'), f1: macro('f1') },
    weighted: { precision: weighted('precision'), recall: weighted('recall'), f1: weighted('f1') },
  };
}

/*
 * Cohen's kappa: agreement between two raters (here the hand labels and
 * the AI) after removing the agreement expected by chance. 1 = perfect,
 * 0 = no better than chance. A missing prediction counts as disagreement.
 */
function cohensKappa(matrix, labels) {
  const columns = [...labels, NONE];
  let total = 0;
  for (const row of labels) for (const col of columns) total += matrix[row][col];
  if (!total) return 0;

  const observed = labels.reduce((sum, l) => sum + matrix[l][l], 0) / total;

  let expected = 0;
  for (const label of labels) {
    const rowTotal = columns.reduce((sum, col) => sum + matrix[label][col], 0);
    const colTotal = labels.reduce((sum, row) => sum + matrix[row][label], 0);
    expected += (rowTotal / total) * (colTotal / total);
  }

  return expected === 1 ? 1 : round((observed - expected) / (1 - expected));
}

// Rough reading of a kappa value (Landis & Koch, 1977).
function kappaStrength(kappa) {
  if (kappa < 0) return 'poor';
  if (kappa <= 0.2) return 'slight';
  if (kappa <= 0.4) return 'fair';
  if (kappa <= 0.6) return 'moderate';
  if (kappa <= 0.8) return 'substantial';
  return 'almost perfect';
}

/*
 * The full set of numbers for one field, ready for the report.
 */
function evaluateField(results, expectedField, predictedField, labels) {
  const matrix = confusionMatrix(results, expectedField, predictedField, labels);
  const metrics = classMetrics(matrix, labels);
  const kappa = cohensKappa(matrix, labels);

  return { labels, matrix, ...metrics, kappa, kappaStrength: kappaStrength(kappa) };
}

module.exports = {
  summariseByField,
  confusionPairs,
  confusionMatrix,
  classMetrics,
  cohensKappa,
  kappaStrength,
  evaluateField,
  NONE,
};
