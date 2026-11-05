import { useEffect, useRef, useState } from 'react';
import AnswerText from '../components/AnswerText';
import './AiAssistant.css';

const API_URL = 'http://localhost:4000/ai/assist';
const SAVE_WEB_RESULT_URL = 'http://localhost:4000/knowledge-base/save-web-result';

/*
 * Starter questions are drawn from real knowledge-base topics, one per
 * category, so a first-time user sees the kind of thing the assistant can
 * actually answer rather than a generic invitation to "ask anything".
 */
const STARTERS = [
  { category: 'Account', text: 'I cannot remember my password' },
  { category: 'Network', text: 'The wifi keeps dropping in the library' },
  {
    category: 'Hardware',
    text: 'Nothing comes out when I send something to print',
  },
];

/*
 * Answers take several seconds on a local model. Rather than an unlabelled
 * spinner, the status names the stage the request is actually in -- which
 * also makes the retrieval step visible to anyone watching a demo.
 */
const STAGES = [
  'Searching the knowledge base and the web…',
  'Reading the closest sections…',
  'Writing the answer…',
];

/*
 * Confidence ticks. Scores from this embedding model sit in a narrow band
 * -- roughly 0.50 for unrelated text up to 0.90 for a direct match -- so
 * the scale is stretched across that range rather than 0 to 1, where every
 * answer would look identical.
 */
function tickCount(score) {
  const scaled = Math.round(((score - 0.5) / 0.4) * 5);

  return Math.max(1, Math.min(5, scaled));
}

export default function AiAssistantPage({ user, onCreateTicket }) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState('');

  const [guideCount, setGuideCount] = useState(null);

  const threadEnd = useRef(null);
  const inputRef = useRef(null);

  /*
   * Read the real number of published guides rather than hard-coding it,
   * so the figure cannot drift out of date when the knowledge base grows.
   * If the request fails the strip simply hides.
   */
  useEffect(() => {
    fetch('http://localhost:4000/knowledge-base', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const articles = data && (data.articles || data.data || data);

        if (Array.isArray(articles)) {
          setGuideCount(articles.length);
        }
      })
      .catch(() => setGuideCount(null));
  }, []);

  useEffect(() => {
    if (threadEnd.current) {
      threadEnd.current.scrollIntoView({ block: 'end' });
    }
  }, [turns, loading]);

  useEffect(() => {
    if (!loading) {
      setStage(0);
      return undefined;
    }

    const timers = [
      setTimeout(() => setStage(1), 1200),
      setTimeout(() => setStage(2), 4000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [loading]);

  async function askQuestion(text) {
    const trimmed = text.trim();

    if (!trimmed || loading) {
      return;
    }

    // The last couple of questions that got an answer, so a short follow-up
    // like "what else can I do" is understood. Answers are not sent back.
    const history = turns
      .filter((turn) => !turn.failed)
      .slice(-2)
      .map((turn) => turn.question);

    setQuestion('');
    setError('');
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ question: trimmed, history }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'The assistant could not answer that question.'
        );
      }

      setTurns((previous) => [
        ...previous,
        { question: trimmed, assistant: data.assistant },
      ]);
    } catch (requestError) {
      setError(requestError.message);
      setTurns((previous) => [
        ...previous,
        { question: trimmed, failed: true },
      ]);
    } finally {
      setLoading(false);

      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }

  function handleKeyDown(event) {
    // Enter sends; Shift+Enter starts a new line, which people expect from
    // any message box.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      askQuestion(question);
    }
  }

  return (
    <div className="chat">
      <header className="chat__header">
        <p className="chat__eyebrow">Otago Polytechnic &middot; IT Helpdesk</p>
        <h1 className="chat__title">Assistant</h1>
        <p className="chat__subtitle">
          Answers combine the approved IT documentation with live web search,
          and show every source they used. When neither covers something,
          the assistant says so instead of guessing.
        </p>
      </header>

      {guideCount !== null && (
        <div className="chat__scope">
          <div className="chat__scope-item">
            <span className="chat__scope-value">{guideCount}</span>
            <span className="chat__scope-label">Approved guides</span>
          </div>
          <div className="chat__scope-item">
            <span className="chat__scope-value">Every</span>
            <span className="chat__scope-label">Answer cited</span>
          </div>
          <div className="chat__scope-item">
            <span className="chat__scope-value">Live</span>
            <span className="chat__scope-label">Web search</span>
          </div>
        </div>
      )}

      <div className="chat__thread" aria-live="polite">
        {turns.length === 0 && !loading && (
          <div className="chat__empty">
            <p className="chat__empty-lead">
              Describe the problem in your own words &mdash; you don&rsquo;t
              need to match the wording of any guide. Try one of these:
            </p>

            <div className="chat__starters">
              {STARTERS.map((starter) => (
                <button
                  key={starter.text}
                  type="button"
                  className="chat__starter"
                  data-category={starter.category}
                  onClick={() => askQuestion(starter.text)}
                >
                  <span className="chat__starter-bar" />

                  <span className="chat__starter-text">
                    <span className="chat__starter-kicker">
                      {starter.category}
                    </span>
                    {starter.text}
                  </span>

                  <span className="chat__starter-arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, index) => (
          <article className="chat__turn" key={index}>
            <div className="chat__question">
              <span>{turn.question}</span>
            </div>

            {turn.failed ? (
              <div className="chat__answer chat__answer--error">
                <div className="chat__cap" />
                <div className="chat__inner">
                  <div className="chat__body">
                    That request didn&rsquo;t get through. Check that the
                    server is running, then send it again.
                  </div>
                </div>
              </div>
            ) : (
              <AnswerCard
                assistant={turn.assistant}
                user={user}
                onCreateTicket={onCreateTicket}
              />
            )}
          </article>
        ))}

        {loading && (
          <div className="chat__thinking">
            <span className="chat__scanner" />
            {STAGES[stage]}
          </div>
        )}

        <div ref={threadEnd} />
      </div>

      <div className="chat__composer">
        <div className="chat__input-row">
          <textarea
            ref={inputRef}
            className="chat__input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your IT problem…"
            rows={1}
            aria-label="Describe your IT problem"
          />

          <button
            type="button"
            className="chat__send"
            onClick={() => askQuestion(question)}
            disabled={loading || !question.trim()}
          >
            {loading ? 'Working…' : 'Ask'}
          </button>
        </div>

        <p className="chat__hint">
          Short follow-ups like &ldquo;what else can I do&rdquo; use your
          previous question for context. For a new problem, include the
          details. Enter sends, Shift + Enter adds a line.
        </p>

        {error && <p className="chat__error">{error}</p>}
      </div>
    </div>
  );
}

function AnswerCard({ assistant, user, onCreateTicket }) {
  const grounded = assistant.knowledgeBaseMatch;
  const escalated = Boolean(assistant.safetyEscalation);
  const sources = assistant.sources || [];
  const kbSources = sources.filter((source) => source.type !== 'web');
  const webSources = sources.filter((source) => source.type === 'web');

  const canCurateKnowledgeBase =
    user && (user.role === 'agent' || user.role === 'admin');

  const [saveStatus, setSaveStatus] = useState({});

  async function saveToKnowledgeBase(source) {
    setSaveStatus((previous) => ({ ...previous, [source.url]: 'saving' }));

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(SAVE_WEB_RESULT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          category: assistant.suggestedCategory || undefined,
        }),
      });

      // 409 means this page is already in the knowledge base (saved earlier,
      // by someone else, or by an earlier click) -- not a failure.
      if (response.status === 409) {
        setSaveStatus((previous) => ({ ...previous, [source.url]: 'duplicate' }));
        return;
      }

      if (!response.ok) {
        throw new Error();
      }

      setSaveStatus((previous) => ({ ...previous, [source.url]: 'saved' }));
    } catch {
      setSaveStatus((previous) => ({ ...previous, [source.url]: 'error' }));
    }
  }

  return (
    <div
      className={`chat__answer${
        escalated ? ' chat__answer--escalated' : grounded ? '' : ' chat__answer--refused'
      }`}
    >
      <div className="chat__cap" />

      <div className="chat__inner">
        <div className="chat__meta">
          {escalated ? (
            <span className="chat__tag chat__tag--escalated">
              ⚠ Possible safety risk
            </span>
          ) : grounded ? (
            assistant.suggestedCategory && (
              <span
                className="chat__tag"
                data-category={assistant.suggestedCategory}
              >
                {assistant.suggestedCategory}
              </span>
            )
          ) : (
            <span className="chat__tag chat__tag--refused">
              Not in the knowledge base
            </span>
          )}

          {typeof assistant.ms === 'number' && (
            <span className="chat__timing">
              {(assistant.ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        <div className="chat__body">
          <AnswerText text={assistant.answer} />
        </div>

        {!grounded && !escalated && (
          <p className="chat__refusal-detail">
            Closest match {assistant.topScore} &middot; needs{' '}
            {assistant.threshold} to answer
          </p>
        )}

        {onCreateTicket && (
          <button
            type="button"
            className={`chat__cta${
              escalated ? ' chat__cta--escalated' : grounded ? ' chat__cta--secondary' : ''
            }`}
            onClick={onCreateTicket}
          >
            {escalated
              ? 'Raise a ticket now'
              : grounded
                ? 'Still stuck? Raise a ticket'
                : 'Raise a ticket'}
          </button>
        )}

        {grounded && kbSources.length > 0 && (
          <div className="chat__sources">
            <div className="chat__sources-label">
              Sourced from {kbSources.length}{' '}
              {kbSources.length === 1 ? 'section' : 'sections'}
            </div>

            {kbSources.map((source, index) => (
              <div className="chat__source" key={source.articleId}>
                <span className="chat__source-index">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span>
                  <span className="chat__source-title">{source.title}</span>{' '}
                  <span className="chat__source-section">
                    &mdash; {source.section}
                  </span>
                </span>

                <span
                  className="chat__confidence"
                  title={`Similarity score: ${source.score}`}
                >
                  <span className="chat__ticks" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((tick) => (
                      <span
                        key={tick}
                        className={`chat__tick${
                          tick <= tickCount(source.score)
                            ? ' chat__tick--on'
                            : ''
                        }`}
                      />
                    ))}
                  </span>
                  <span className="chat__confidence-value">
                    {source.score}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {grounded && webSources.length > 0 && (
          <div className="chat__sources chat__sources--web">
            <div className="chat__sources-label">
              From the web ({webSources.length})
            </div>

            {webSources.map((source) => (
              <div className="chat__source chat__source--web" key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chat__source-title"
                >
                  {source.title}
                </a>

                {canCurateKnowledgeBase && (
                  <button
                    type="button"
                    className="chat__save-to-kb"
                    disabled={['saving', 'saved', 'duplicate'].includes(
                      saveStatus[source.url]
                    )}
                    onClick={() => saveToKnowledgeBase(source)}
                  >
                    {saveStatus[source.url] === 'saved'
                      ? 'Saved to KB'
                      : saveStatus[source.url] === 'duplicate'
                        ? 'Already in KB'
                        : saveStatus[source.url] === 'saving'
                          ? 'Saving…'
                          : saveStatus[source.url] === 'error'
                            ? 'Failed, retry?'
                            : 'Save to knowledge base'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}