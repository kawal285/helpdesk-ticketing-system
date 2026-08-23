/*
 * The full RAG pipeline, end to end.
 *
 *   question -> retrieve -> relevance check -> grounded prompt -> LLM
 *            -> answer + sources
 *
 * This is the only module the API layer needs to know about.
 */

const { retrieve } = require('./retrievalService');
const { generate, getModelInfo } = require('./generationService');
const { buildMessages, refusalMessage } = require('./prompt');

/*
 * One source entry per article, not per chunk. Three chunks from the same
 * article is one citation to the reader, and the highest-scoring chunk
 * decides the ordering.
 */
function summariseSources(matches) {
  const byArticle = new Map();

  for (const match of matches) {
    const existing = byArticle.get(match.articleId);

    if (!existing || match.score > existing.score) {
      byArticle.set(match.articleId, {
        articleId: match.articleId,
        title: match.articleTitle,
        section: match.heading,
        category: match.category,
        score: Number(match.score.toFixed(4)),
      });
    }
  }

  return [...byArticle.values()].sort((a, b) => b.score - a.score);
}

async function ask(question, options = {}) {
  const started = Date.now();

  const retrieval = await retrieve(question, options);

  // The refusal path. Nothing reaches the model, so nothing can be
  // invented -- the guarantee is structural, not a matter of the model
  // following instructions.
  if (!retrieval.hasRelevantContext) {
    return {
      answer: refusalMessage(),
      grounded: false,
      sources: [],
      topScore: Number(retrieval.topScore.toFixed(4)),
      threshold: retrieval.threshold,
      model: getModelInfo().name,
      ms: Date.now() - started,
    };
  }

  const messages = buildMessages(question, retrieval.relevant);
  const answer = await generate(messages);

  return {
    answer,
    grounded: true,
    sources: summariseSources(retrieval.relevant),
    topScore: Number(retrieval.topScore.toFixed(4)),
    threshold: retrieval.threshold,
    model: getModelInfo().name,
    ms: Date.now() - started,
  };
}

module.exports = { ask };