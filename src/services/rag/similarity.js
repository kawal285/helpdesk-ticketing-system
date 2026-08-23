/*
 * Vector maths for retrieval. No API calls, no database -- pure functions,
 * so they are unit-testable offline.
 */

function dotProduct(a, b) {
  let total = 0;

  for (let i = 0; i < a.length; i += 1) {
    total += a[i] * b[i];
  }

  return total;
}

function magnitude(vector) {
  return Math.sqrt(dotProduct(vector, vector));
}

/*
 * Cosine similarity: the cosine of the angle between two vectors,
 * ignoring their lengths. Ranges from -1 (opposite) through 0
 * (unrelated) to 1 (identical direction). We compare direction rather
 * than distance because the direction is what carries the meaning.
 */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error('Both arguments must be arrays of numbers.');
  }

  if (a.length !== b.length) {
    throw new Error(
      `Cannot compare vectors of different sizes (${a.length} vs ${b.length}). ` +
        'This usually means they came from different embedding models.'
    );
  }

  const denominator = magnitude(a) * magnitude(b);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct(a, b) / denominator;
}

/*
 * Scales a vector to length 1. Needed after truncating a Matryoshka-style
 * embedding: the model guarantees the leading dimensions carry the most
 * meaning, but a truncated vector is no longer unit length, and comparing
 * un-normalised vectors distorts the scores.
 */
function normalise(vector) {
  const length = magnitude(vector);

  if (length === 0) {
    return vector.slice();
  }

  return vector.map((value) => value / length);
}

function truncateAndNormalise(vector, dimensions) {
  if (!dimensions || dimensions >= vector.length) {
    return normalise(vector);
  }

  return normalise(vector.slice(0, dimensions));
}

module.exports = {
  cosineSimilarity,
  normalise,
  truncateAndNormalise,
  magnitude,
};