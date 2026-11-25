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
const { generateWithAgent, getModelInfo } = require('./generationService');
const webSearchService = require('./webSearchService');
const { buildMessages, smallTalkMessages, refusalMessage } = require('./prompt');
const { pickAgent, getAgent } = require('./agentRouter');

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
 * Some reasoning models write their thinking inside <think> tags. The reader
 * should only ever see the answer.
 */
function stripThinkTags(text) {
  if (typeof text !== 'string') {
    return text;
  }

  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();
}

/*
 * Small talk is answered by the fast agent with no knowledge base and no web
 * search. Because it has no sources, anything that looks like advice is
 * thrown away and replaced with a fixed reply -- it can greet, it cannot
 * troubleshoot.
 */
const SMALL_TALK_MAX_WORDS = 30;
const LOOKS_LIKE_ADVICE = /\d|https?:|www\.|\bstep\b|\bclick\b|\brestart\b|\binstall\b/i;

function cannedSmallTalk(question) {
  return /\b(thanks?|thx|ty|cheers)\b/i.test(question)
    ? "You're welcome. Ask me anything else IT-related."
    : 'Hi! What IT problem can I help you with?';
}

function sanitizeSmallTalk(text, question) {
  const clean = stripThinkTags(text) || '';
  const words = clean.split(/\s+/).filter(Boolean).length;

  if (!clean || words > SMALL_TALK_MAX_WORDS || LOOKS_LIKE_ADVICE.test(clean)) {
    return cannedSmallTalk(question);
  }

  return clean;
}

async function answerSmallTalk(question, started) {
  let answer;
  let model = 'none';
  let fellBack = false;

  try {
    const generated = await generateWithAgent(
      getAgent('fast'),
      smallTalkMessages(question)
    );

    answer = sanitizeSmallTalk(generated.content, question);
    model = `${generated.provider}:${generated.model}`;
    fellBack = generated.fellBack === true;
  } catch (error) {
    // A greeting must never produce an error. Both the cloud model and the
    // local fallback are down, so use the fixed reply.
    console.warn('[agents] small talk failed, using a fixed reply:', error.message);
    answer = cannedSmallTalk(question);
  }

  return {
    answer,
    grounded: false,
    smallTalk: true,
    sources: [],
    topScore: null,
    threshold: null,
    model,
    agent: 'fast',
    fellBack,
    webSearchProvider: 'none',
    ms: Date.now() - started,
  };
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

    // Include recent user questions when searching for follow-up answers.
  const previousUserQuestions = (options.conversationHistory || [])
    .filter((message) => message.role === 'user')
    .slice(-2)
    .map((message) => message.content);

  const searchQuestion = [
    ...previousUserQuestions,
    question,
  ].join('\n');

  const [retrieval, web] =
    options.webSearch === false
      ? [
          await retrieve(searchQuestion, options),
          { results: [], provider: 'none' },
        ]
      : await Promise.all([
          retrieve(searchQuestion, options),
          webSearchService.search(searchQuestion),
  // options.agent forces an agent. webSearch:false is the deterministic,
  // offline mode used by the evaluation scripts, so it always uses main.
  // thinkDeeper only counts when it is exactly true.
  const agentName =
    options.agent ||
    (options.webSearch === false
      ? 'main'
      : pickAgent(question, { forceThink: options.thinkDeeper === true }));

  if (agentName === 'fast') {
    return answerSmallTalk(question, started);
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
      sources: [],
      topScore: Number(retrieval.topScore.toFixed(4)),
      threshold: retrieval.threshold,
      model: getModelInfo().name,
      agent: agentName,
      fellBack: false,
      webSearchProvider: web.provider,
      ms: Date.now() - started,
    };
  }

  const messages = buildMessages(
  question,
  retrieval.relevant,
  web.results,
  options.conversationHistory || []
);
  const answer = await generate(messages);
    question,
    retrieval.relevant,
    web.results,
    previousQuestion,
    agentName
  );
  const generated = await generateWithAgent(getAgent(agentName), messages);
  const answer = stripCitationMarkers(stripThinkTags(generated.content));

  return {
    answer,
    grounded: true,
    sources: [
      ...summariseKbSources(retrieval.relevant),
      ...summariseWebSources(web.results),
    ],
    topScore: Number(retrieval.topScore.toFixed(4)),
    threshold: retrieval.threshold,
    // The model that ACTUALLY answered. After a fallback this is the local one.
    model: `${generated.provider}:${generated.model}`,
    agent: agentName,
    fellBack: generated.fellBack === true,
    webSearchProvider: web.provider,
    ms: Date.now() - started,
  };
}

module.exports = {
  ask,
  buildSearchContext,
  stripCitationMarkers,
  stripThinkTags,
  sanitizeSmallTalk,
};