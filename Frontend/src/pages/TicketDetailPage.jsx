import { useState, useEffect } from 'react';

export default function TicketDetailPage({ ticketId, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

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