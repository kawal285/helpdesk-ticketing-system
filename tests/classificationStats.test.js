const {
  summariseByField,
  confusionPairs,
} = require('../scripts/ai/classificationStats');

describe('summariseByField', () => {
  it('counts correct and total per expected value', () => {
    const results = [
      { expectedCategory: 'Hardware', categoryCorrect: true },
      { expectedCategory: 'Hardware', categoryCorrect: false },
      { expectedCategory: 'Network', categoryCorrect: true },
    ];

    expect(summariseByField(results, 'category', 'expectedCategory')).toEqual({
      Hardware: { correct: 1, total: 2 },
      Network: { correct: 1, total: 1 },
    });
  });

  it('keys the breakdown by field name, so category and priority never mix', () => {
    const results = [
      { expectedCategory: 'Hardware', categoryCorrect: true, expectedPriority: 'High', priorityCorrect: false },
    ];

    expect(summariseByField(results, 'category', 'expectedCategory')).toEqual({
      Hardware: { correct: 1, total: 1 },
    });
    expect(summariseByField(results, 'priority', 'expectedPriority')).toEqual({
      High: { correct: 0, total: 1 },
    });
  });

  it('returns an empty object for an empty results array', () => {
    expect(summariseByField([], 'category', 'expectedCategory')).toEqual({});
  });

  it('treats every miss as 0 correct for that value, never throwing on an all-wrong group', () => {
    const results = [
      { expectedCategory: 'Software', categoryCorrect: false },
      { expectedCategory: 'Software', categoryCorrect: false },
    ];

    expect(summariseByField(results, 'category', 'expectedCategory')).toEqual({
      Software: { correct: 0, total: 2 },
    });
  });
});

describe('confusionPairs', () => {
  it('counts each (expected -> predicted) pair', () => {
    const results = [
      { expectedCategory: 'Hardware', predictedCategory: 'Hardware' },
      { expectedCategory: 'Hardware', predictedCategory: 'Software' },
      { expectedCategory: 'Hardware', predictedCategory: 'Software' },
    ];

    expect(confusionPairs(results, 'expectedCategory', 'predictedCategory')).toEqual([
      ['Hardware -> Software', 2],
      ['Hardware -> Hardware', 1],
    ]);
  });

  it('sorts most frequent pair first', () => {
    const results = [
      { expectedCategory: 'A', predictedCategory: 'A' },
      { expectedCategory: 'B', predictedCategory: 'B' },
      { expectedCategory: 'B', predictedCategory: 'B' },
      { expectedCategory: 'B', predictedCategory: 'B' },
    ];

    const [first] = confusionPairs(results, 'expectedCategory', 'predictedCategory');
    expect(first).toEqual(['B -> B', 3]);
  });

  it('labels a missing prediction explicitly rather than printing "null"', () => {
    const results = [{ expectedCategory: 'Hardware', predictedCategory: null }];

    expect(confusionPairs(results, 'expectedCategory', 'predictedCategory')).toEqual([
      ['Hardware -> (no prediction)', 1],
    ]);
  });

  it('returns an empty array for an empty results array', () => {
    expect(confusionPairs([], 'expectedCategory', 'predictedCategory')).toEqual([]);
  });
});
