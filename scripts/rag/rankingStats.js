/*
 * Ranking metrics for the knowledge-base search evaluation
 * (evaluate-retrieval-ranking.js). Pure functions, tested on their own.
 *
 * rank: where the correct article came in the results (1 = first), or
 *       null when it didn't come back at all.
 */

// Position (1-based) of the expected article in a ranked list of article
// ids, or null if it isn't there.
function rankOf(rankedArticleIds, expectedArticleId) {
  const index = rankedArticleIds.findIndex((id) => Number(id) === Number(expectedArticleId));
  return index === -1 ? null : index + 1;
}

// Share of questions whose correct article is in the top k.
function hitAt(ranks, k) {
  if (ranks.length === 0) return 0;
  return ranks.filter((rank) => rank !== null && rank <= k).length / ranks.length;
}

// Mean reciprocal rank: 1 for first place, 1/2 for second, 1/3 for third
// and so on, 0 when not found, averaged over the questions.
function meanReciprocalRank(ranks) {
  if (ranks.length === 0) return 0;
  return ranks.reduce((sum, rank) => sum + (rank ? 1 / rank : 0), 0) / ranks.length;
}

function summarise(ranks) {
  return {
    questions: ranks.length,
    hitAt1: hitAt(ranks, 1),
    hitAt3: hitAt(ranks, 3),
    hitAt5: hitAt(ranks, 5),
    mrr: meanReciprocalRank(ranks),
    notFound: ranks.filter((rank) => rank === null).length,
  };
}

module.exports = { rankOf, hitAt, meanReciprocalRank, summarise };
