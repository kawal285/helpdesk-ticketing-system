/*
 * The full RAG pipeline, end to end.
 *
 *   question -> retrieve (KB) + search (web), in parallel
 *            -> relevance check -> grounded prompt -> LLM
 *            -> answer + sources
 *
 * This is the only module the API layer needs to know about.
 */

const { retrieve } = require('./retrievalService');
const { generate, getModelInfo } = require('./generationService');
const webSearchService = require('./webSearchService');
const { buildMessages, refusalMessage } = require('./prompt');

/*
 * One source entry per article, not per chunk. Three chunks from the same
 * article is one citation to the reader, and the highest-scoring chunk
 * decides the ordering.
 */
function summariseKbSources(matches) {
  const byArticle = new Map();

  for (const match of matches) {
    const existing = byArticle.get(match.articleId);

    if (!existing || match.score > existing.score) {
      byArticle.set(match.articleId, {
        type: 'knowledge_base',
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

/*
 * snippet travels with the summary (unlike the KB summary's score) because
 * a caller that wants to save this result to the knowledge base needs the
 * original search snippet, not the model's blended answer, as the thing
 * actually being saved.
 */
function summariseWebSources(results) {
  return results.map((result) => ({
    type: 'web',
    title: result.title,
    url: result.url,
    snippet: result.snippet,
  }));
}

/*
 * options.webSearch === false skips the web entirely (used by the
 * evaluation harness and anything else that wants a deterministic,
 * offline, knowledge-base-only answer). Otherwise it runs alongside
 * retrieval rather than after it, so a slow web search doesn't add to a
 * fast KB answer's latency on top of its own.
 */
async function ask(question, options = {}) {
  const started = Date.now();

  const [retrieval, web] =
    options.webSearch === false
      ? [await retrieve(question, options), { results: [], provider: 'none' }]
      : await Promise.all([
          retrieve(question, options),
          webSearchService.search(question),
        ]);

  const hasKb = retrieval.hasRelevantContext;
  const hasWeb = web.results.length > 0;

  // The refusal path. Nothing reaches the model, so nothing can be
  // invented -- the guarantee is structural, not a matter of the model
  // following instructions. Only taken when neither source has anything.
  if (!hasKb && !hasWeb) {
    return {
      answer: refusalMessage(),
      grounded: false,
      sources: [],
      topScore: Number(retrieval.topScore.toFixed(4)),
      threshold: retrieval.threshold,
      model: getModelInfo().name,
      webSearchProvider: web.provider,
      ms: Date.now() - started,
    };
  }

  const messages = buildMessages(question, retrieval.relevant, web.results);
  const answer = await generate(messages);

  return {
    answer,
    grounded: true,
    sources: [
      ...summariseKbSources(retrieval.relevant),
      ...summariseWebSources(web.results),
    ],
    topScore: Number(retrieval.topScore.toFixed(4)),
    threshold: retrieval.threshold,
    model: getModelInfo().name,
    webSearchProvider: web.provider,
    ms: Date.now() - started,
  };
}

module.exports = { ask };