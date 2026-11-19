const {
  rankOf,
  hitAt,
  meanReciprocalRank,
  summarise,
} = require('../scripts/rag/rankingStats');

describe('rankOf', () => {
  it('gives the 1-based position of the expected article', () => {
    expect(rankOf([7, 3, 9], 3)).toBe(2);
    expect(rankOf(['7', '3'], 7)).toBe(1);
  });

  it('gives null when the article is missing', () => {
    expect(rankOf([7, 3], 5)).toBeNull();
  });
});

describe('ranking metrics', () => {
  // Worked by hand: first, third, second, not found.
  const ranks = [1, 3, 2, null];

  it('Hit@k counts the questions answered within the top k', () => {
    expect(hitAt(ranks, 1)).toBe(0.25);
    expect(hitAt(ranks, 3)).toBe(0.75);
  });

  it('MRR averages 1/rank, counting a miss as 0', () => {
    // (1 + 1/3 + 1/2 + 0) / 4 = 0.4583...
    expect(meanReciprocalRank(ranks)).toBeCloseTo(0.4583, 4);
  });

  it('summarise bundles them', () => {
    expect(summarise(ranks)).toMatchObject({
      questions: 4,
      hitAt1: 0.25,
      hitAt3: 0.75,
      hitAt5: 0.75,
      notFound: 1,
    });
  });

  it('handles an empty list', () => {
    expect(summarise([])).toMatchObject({ questions: 0, hitAt1: 0, mrr: 0 });
  });
});
