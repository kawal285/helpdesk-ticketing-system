import { useState, useEffect } from 'react';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

export default function TicketDetailPage({ ticketId, user, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const [statusSaving, setStatusSaving] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [actionError, setActionError] = useState('');

  const isStaff = user.role === 'agent' || user.role === 'admin';

  useEffect(() => {
    loadEverything();
  }, [ticketId]);

  async function loadEverything() {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Fetch the ticket and its comments at the same time, instead of
      // waiting for one to finish before starting the other.
      const [ticketRes, commentsRes] = await Promise.all([
        fetch(`http://localhost:4000/tickets/${ticketId}`, { headers }),
        fetch(`http://localhost:4000/tickets/${ticketId}/comments`, { headers }),
      ]);

      const ticketData = await ticketRes.json();
      const commentsData = await commentsRes.json();

      if (!ticketRes.ok) throw new Error(ticketData.message || 'Could not load ticket');
      if (!commentsRes.ok) throw new Error(commentsData.message || 'Could not load comments');

      setTicket(ticketData.ticket);
      setComments(commentsData.comments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:4000/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not post comment');

      // Add the new comment to the list immediately instead of re-fetching
      // everything.
      setComments((prev) => [...prev, data.comment]);
      setCommentText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (!newStatus || newStatus === ticket.status) return;
    setActionError('');
    setStatusSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:4000/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update status');
      setTicket(data.ticket);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleAssignChange(assigneeId) {
    setActionError('');
    setAssignSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:4000/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assigneeId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update assignment');
      setTicket(data.ticket);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleAiAnalyze() {
    setActionError('');
    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:4000/tickets/${ticketId}/ai-analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'AI analysis failed');
      setTicket(data.ticket);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 4px 16px rgba(16, 20, 43, 0.25)',
    fontFamily: 'sans-serif',
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '6px 12px' }}>
        ← Back to My Tickets
      </button>

      <div style={cardStyle}>
        {loading && <p>Loading…</p>}
        {error && <div className="error-text">{error}</div>}

        {ticket && (
          <>
            <h1 style={{ margin: '0 0 4px' }}>
              #{ticket.id} — {ticket.title}
            </h1>
            <p style={{ color: '#656a7d', marginTop: 0 }}>
              {ticket.status} · {ticket.priority} · {ticket.category}
            </p>

            <p style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>

            {isStaff && (
              <div
                style={{
                  background: '#f7f7f5',
                  border: '1px solid #e5e2d9',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <h3 style={{ marginTop: 0 }}>Staff actions</h3>
                {actionError && <div className="error-text">{actionError}</div>}

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: 13 }}>
                    Status:{' '}
                    <select
                      value={ticket.status}
                      disabled={statusSaving}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <span style={{ fontSize: 13 }}>
                    {ticket.assigneeId ? `Assigned to user #${ticket.assigneeId}` : 'Unassigned'}
                  </span>
                  {ticket.assigneeId === user.id ? (
                    <button
                      type="button"
                      disabled={assignSaving}
                      onClick={() => handleAssignChange(null)}
                      style={{ padding: '4px 10px' }}
                    >
                      Unassign
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={assignSaving}
                      onClick={() => handleAssignChange(user.id)}
                      style={{ padding: '4px 10px' }}
                    >
                      Assign to me
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={handleAiAnalyze}
                    style={{ padding: '4px 10px' }}
                  >
                    {analyzing ? 'Analyzing…' : 'Run AI analysis'}
                  </button>
                </div>

                {ticket.aiAnalyzedAt && (
                  <div style={{ marginTop: 12, fontSize: 13 }}>
                    <div>
                      <strong>AI suggestion:</strong> {ticket.aiCategory} · {ticket.aiPriority}
                    </div>
                    {ticket.aiSuggestedResponse && (
                      <div style={{ marginTop: 4, color: '#656a7d', whiteSpace: 'pre-wrap' }}>
                        {ticket.aiSuggestedResponse}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e5e2d9' }} />

            <h3>Comments</h3>
            {comments.length === 0 && <p style={{ color: '#656a7d' }}>No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e5e2d9' }}>
                <div style={{ fontSize: 12, color: '#656a7d', marginBottom: 4 }}>
                  {c.author?.name || `User #${c.authorId}`} ·{' '}
                  {new Date(c.createdAt).toLocaleString()}
                </div>
                <div>{c.text}</div>
              </div>
            ))}

            <form onSubmit={handleAddComment} style={{ marginTop: 16 }}>
              <div className="field">
                <textarea
                  rows={3}
                  placeholder="Add a comment…"
                  style={{ width: '100%', padding: 8, fontFamily: 'inherit' }}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
              </div>
              <button className="btn-primary" type="submit" disabled={posting} style={{ width: 'auto' }}>
                {posting ? 'Posting…' : 'Post comment'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}