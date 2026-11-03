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
const safety = require('./safety');

/*
 * Each question is normally answered on its own. A short follow-up such as
 * "its not working what else can i do" means nothing without the question
 * before it, so for those -- and only those -- the previous question(s) are
 * added to what is searched. A new, self-contained question is left alone,
 * otherwise an old topic would leak into unrelated answers.
 */
const MAX_FOLLOW_UP_WORDS = 8;
const FOLLOW_UP_CUES =
  /\b(it|its|it's|that|this|them|still|else|again|same|another|more)\b/i;

function buildSearchContext(question, history) {
  const previous = Array.isArray(history)
    ? history
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim())
        .slice(-2)
    : [];

  const wordCount = question.trim().split(/\s+/).length;
  const isFollowUp =
    previous.length > 0 &&
    wordCount <= MAX_FOLLOW_UP_WORDS &&
    FOLLOW_UP_CUES.test(question);

  if (!isFollowUp) {
    return { searchText: question, previousQuestion: null };
  }

  const context = previous.join('. ');

  return {
    searchText: `${context}. ${question}`,
    previousQuestion: context,
  };
}

/*
 * Small models sometimes echo the SOURCES numbering ("as mentioned in [1]")
 * even when told not to. The reader cannot see those numbers, so they are
 * removed after the fact rather than trusted to the prompt alone.
 */
function stripCitationMarkers(text) {
  if (typeof text !== 'string') {
    return text;
  }

  return text
    .replace(/\s*\(\s*\[\d+\](?:\s*,\s*\[\d+\])*\s*\)/g, '')
    .replace(/\s*\[\d+\]/g, '')
    .trim();
}

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

  // Checked first, before anything else, against the user's raw message.
  // A described hazard is time-sensitive and needs a fixed safety
  // response immediately -- it never reaches retrieval or the model, so
  // no phrasing of the question can talk it past this check.
  if (safety.detectHazard(question)) {
    return {
      answer: safety.hazardEscalationMessage(),
      grounded: false,
      escalated: true,
      sources: [],
      topScore: 0,
      threshold: null,
      model: null,
      webSearchProvider: 'none',
      ms: Date.now() - started,
    };
  }

  const { searchText, previousQuestion } = buildSearchContext(
    question,
    options.history
  );

  const [retrieval, web] =
    options.webSearch === false
      ? [await retrieve(searchText, options), { results: [], provider: 'none' }]
      : await Promise.all([
          retrieve(searchText, options),
          webSearchService.search(searchText),
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
      escalated: false,
      sources: [],
      topScore: Number(retrieval.topScore.toFixed(4)),
      threshold: retrieval.threshold,
      model: getModelInfo().name,
      webSearchProvider: web.provider,
      ms: Date.now() - started,
    };
  }

  const messages = buildMessages(
    question,
    retrieval.relevant,
    web.results,
    previousQuestion
  );
  const rawAnswer = stripCitationMarkers(await generate(messages));

  // Output-side guard: whatever the model actually said, check it for
  // unsafe disassembly instructions before it ever reaches the reader --
  // this holds even if a source document (or the model itself) suggested
  // them. Secret redaction runs on the real answer either way, since a
  // credential-shaped string is a risk regardless of what else is wrong.
  const dangerousAdvice = safety.containsDangerousAdvice(rawAnswer);
  const answer = dangerousAdvice
    ? safety.safeFallbackForDangerousAdvice()
    : safety.redactSecrets(rawAnswer);

  return {
    answer,
    grounded: true,
    escalated: dangerousAdvice,
    sources: dangerousAdvice ? [] : [
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

module.exports = { ask, buildSearchContext, stripCitationMarkers };