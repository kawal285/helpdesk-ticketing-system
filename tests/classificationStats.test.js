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

const {
  confusionMatrix,
  classMetrics,
  cohensKappa,
  kappaStrength,
  evaluateField,
  NONE,
} = require('../scripts/ai/classificationStats');

// Worked by hand: 5 tickets, labels A and B.
//   expected A: predicted A, A, B      expected B: predicted B, B
const SMALL = [
  { e: 'A', p: 'A' },
  { e: 'A', p: 'A' },
  { e: 'A', p: 'B' },
  { e: 'B', p: 'B' },
  { e: 'B', p: 'B' },
];

describe('confusionMatrix', () => {
  it('counts expected (rows) against predicted (columns)', () => {
    expect(confusionMatrix(SMALL, 'e', 'p', ['A', 'B'])).toEqual({
      A: { A: 2, B: 1, [NONE]: 0 },
      B: { A: 0, B: 2, [NONE]: 0 },
    });
  });

  it('puts a missing or unknown prediction in the (none) column', () => {
    const matrix = confusionMatrix(
      [{ e: 'A', p: null }, { e: 'A', p: 'Z' }],
      'e',
      'p',
      ['A', 'B']
    );
    expect(matrix.A[NONE]).toBe(2);
  });
});

describe('classMetrics', () => {
  it('gives precision, recall and F1 per label', () => {
    const m = classMetrics(confusionMatrix(SMALL, 'e', 'p', ['A', 'B']), ['A', 'B']);

    // A: 2 right of 3 real A (recall 0.667), both A guesses right (precision 1)
    expect(m.perClass.A).toEqual({ precision: 1, recall: 0.667, f1: 0.8, support: 3 });
    // B: 2 right of 2 real B (recall 1), 2 of 3 B guesses right (precision 0.667)
    expect(m.perClass.B).toEqual({ precision: 0.667, recall: 1, f1: 0.8, support: 2 });
    expect(m.accuracy).toBe(0.8);
    expect(m.macro.f1).toBe(0.8);
  });

  it('gives 0, not NaN, for a label that was never predicted', () => {
    const m = classMetrics(
      confusionMatrix([{ e: 'A', p: 'B' }, { e: 'B', p: 'B' }], 'e', 'p', ['A', 'B']),
      ['A', 'B']
    );
    expect(m.perClass.A).toEqual({ precision: 0, recall: 0, f1: 0, support: 1 });
  });
});

describe('cohensKappa', () => {
  it('matches the hand calculation', () => {
    // observed 0.8, chance (3/5*2/5 + 2/5*3/5) = 0.48, kappa = 0.32/0.52
    expect(cohensKappa(confusionMatrix(SMALL, 'e', 'p', ['A', 'B']), ['A', 'B'])).toBe(0.615);
  });

  it('is 1 for perfect agreement and 0 or less for chance-level guessing', () => {
    const perfect = [{ e: 'A', p: 'A' }, { e: 'B', p: 'B' }];
    expect(cohensKappa(confusionMatrix(perfect, 'e', 'p', ['A', 'B']), ['A', 'B'])).toBe(1);

    const allA = [{ e: 'A', p: 'A' }, { e: 'B', p: 'A' }];
    expect(cohensKappa(confusionMatrix(allA, 'e', 'p', ['A', 'B']), ['A', 'B'])).toBe(0);
  });

  it('names the strength of agreement', () => {
    expect(kappaStrength(0.615)).toBe('substantial');
    expect(kappaStrength(0.1)).toBe('slight');
    expect(kappaStrength(-0.2)).toBe('poor');
  });
});

describe('evaluateField', () => {
  it('bundles the matrix, metrics and kappa together', () => {
    const r = evaluateField(SMALL, 'e', 'p', ['A', 'B']);
    expect(r).toMatchObject({ accuracy: 0.8, correct: 4, total: 5, kappa: 0.615 });
    expect(r.matrix.A.A).toBe(2);
  });
});
