import { useCallback, useEffect, useState } from 'react';

const API_URL = 'http://localhost:4000';

const OUTCOME_LABELS = {
  refused: 'Not answered',
  web_only: 'Answered from the web only',
  kb_low_confidence: 'Weak knowledge-base match',
};

function authHeaders(json = false) {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

// Knowledge-gap report (Knowledge-Centered Service): the questions the AI
// assistant couldn't answer from the knowledge base, grouped into topics,
// so admins can see which articles to write next.
export default function KnowledgeGapsPage() {
  const [report, setReport] = useState(null);
  const [days, setDays] = useState(30);
  const [showCovered, setShowCovered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyTopic, setBusyTopic] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ days: String(days), limit: '20' });
      if (showCovered) params.set('includeCovered', 'true');
      const response = await fetch(`${API_URL}/knowledge-gaps?${params}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load the report.');
      setReport(data.report);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [days, showCovered]);

  useEffect(() => {
    load();
  }, [load]);

  async function markCovered(topic, articleId = null) {
    const response = await fetch(`${API_URL}/knowledge-gaps/cover`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        interactionIds: topic.interactionIds,
        ...(articleId != null ? { articleId: String(articleId) } : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not mark the topic as covered.');
  }

  // Uses the existing "save web result to the knowledge base" feature,
  // then marks the topic as covered by the new article.
  async function saveWebResult(topic, source) {
    setBusyTopic(topic.topic);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`${API_URL}/knowledge-base/save-web-result`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          title: source.title,
          url: source.url,
          snippet: source.snippet || '',
          ...(topic.suggestedCategory ? { category: topic.suggestedCategory } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save the web result.');
      await markCovered(topic, data.article?.id);
      setMessage(`Saved "${source.title}" to the knowledge base. The assistant can use it straight away.`);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusyTopic(null);
    }
  }

  async function coverOnly(topic) {
    setBusyTopic(topic.topic);
    setMessage('');
    setError('');
    try {
      await markCovered(topic);
      setMessage('Topic marked as covered.');
      await load();
    } catch (coverError) {
      setError(coverError.message);
    } finally {
      setBusyTopic(null);
    }
  }

  return (
    <main className="gaps-page">
      <header className="gaps-header">
        <h1>Knowledge gaps</h1>
        <p>
          Questions the AI assistant couldn't answer from the knowledge base,
          grouped into topics. The most asked topics are the articles worth
          writing next.
        </p>
      </header>

      <div className="gaps-controls">
        <label>
          Period:{' '}
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
        <label className="gaps-check">
          <input
            type="checkbox"
            checked={showCovered}
            onChange={(event) => setShowCovered(event.target.checked)}
          />
          Show covered topics
        </label>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}
      {message && <p className="gaps-message" role="status">{message}</p>}
      {loading && <p className="ticket-muted-text">Loading…</p>}

      {report && !loading && (
        <>
          <section className="gaps-stats">
            <div>
              <span className="gaps-stat-value">{report.questionsAsked}</span>
              <span className="gaps-stat-label">Questions asked</span>
            </div>
            <div>
              <span className="gaps-stat-value">{report.gapQuestions}</span>
              <span className="gaps-stat-label">Not answered from the KB</span>
            </div>
            <div>
              <span className="gaps-stat-value">{Math.round(report.gapRate * 100)}%</span>
              <span className="gaps-stat-label">Gap rate</span>
            </div>
            <div>
              <span className="gaps-stat-value">{report.topics.length}</span>
              <span className="gaps-stat-label">Topics shown</span>
            </div>
          </section>

          {report.topics.length === 0 ? (
            <p className="ticket-muted-text">
              No unanswered topics in this period. The knowledge base covered
              every question.
            </p>
          ) : (
            <ol className="gaps-list">
              {report.topics.map((topic, index) => (
                <li key={topic.interactionIds[0]} className="gaps-topic">
                  <div className="gaps-topic-head">
                    <span className="gaps-rank">#{index + 1}</span>
                    <h2>{topic.topic}</h2>
                    {topic.covered && <span className="ai-tag">Covered</span>}
                  </div>

                  <p className="gaps-meta">
                    Asked {topic.timesAsked} time{topic.timesAsked === 1 ? '' : 's'}
                    {topic.askedBy > 0 && ` by ${topic.askedBy} ${topic.askedBy === 1 ? 'person' : 'people'}`}
                    {' · last '}
                    {formatDate(topic.lastAskedAt)}
                    {topic.suggestedCategory && ` · ${topic.suggestedCategory}`}
                  </p>

                  <p className="gaps-meta">
                    {Object.entries(topic.outcomes)
                      .map(([outcome, count]) => `${OUTCOME_LABELS[outcome] || outcome}: ${count}`)
                      .join(' · ')}
                  </p>

                  {topic.exampleQuestions.length > 1 && (
                    <ul className="gaps-examples">
                      {topic.exampleQuestions.map((q) => (
                        <li key={q}>“{q}”</li>
                      ))}
                    </ul>
                  )}

                  {topic.webSources.length > 0 && !topic.covered && (
                    <div className="gaps-web">
                      <p>Web results the assistant used for this topic:</p>
                      <ul>
                        {topic.webSources.map((source) => (
                          <li key={source.url}>
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {source.title}
                            </a>
                            <span className="gaps-meta"> · shown {source.timesShown}×</span>
                            <button
                              type="button"
                              className="ticket-secondary-button"
                              disabled={busyTopic === topic.topic}
                              onClick={() => saveWebResult(topic, source)}
                            >
                              Save to knowledge base
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!topic.covered && (
                    <button
                      type="button"
                      className="similar-link-button"
                      disabled={busyTopic === topic.topic}
                      onClick={() => coverOnly(topic)}
                    >
                      Mark as covered (article written another way)
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}
