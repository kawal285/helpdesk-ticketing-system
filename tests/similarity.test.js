const {
  cosineSimilarity,
  normalise,
  truncateAndNormalise,
  magnitude,
} = require('../src/services/rag/similarity');

describe('cosineSimilarity', () => {
  test('identical direction scores 1', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });

  test('perpendicular vectors score 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  test('opposite direction scores -1', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  test('ignores magnitude, so only direction matters', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
  });

  test('a zero vector scores 0 rather than dividing by zero', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  test('refuses to compare vectors of different lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
      /different sizes/
    );
  });
});

describe('normalise', () => {
  test('produces a unit-length vector', () => {
    expect(magnitude(normalise([3, 4]))).toBeCloseTo(1, 12);
  });

  test('leaves a zero vector alone', () => {
    expect(normalise([0, 0])).toEqual([0, 0]);
  });
});

describe('truncateAndNormalise', () => {
  test('shortens to the requested number of dimensions', () => {
    expect(truncateAndNormalise([3, 4, 99, 99], 2)).toHaveLength(2);
  });

  test('re-normalises after truncating', () => {
    expect(magnitude(truncateAndNormalise([3, 4, 99, 99], 2))).toBeCloseTo(
      1,
      12
    );
  });

  test('normalises without truncating when asked for more than it has', () => {
    expect(truncateAndNormalise([3, 4], 10)).toHaveLength(2);
  });
});