import { useCallback, useEffect, useState } from 'react';
import { priorityLabel } from '../utils/priority';

const API_URL = 'http://localhost:4000';

// "Similar open tickets" for staff: open tickets that look like the same
// problem (found with the same embeddings as the knowledge-base search),
// so a duplicate can be linked to the original instead of solved twice.
export default function SimilarTickets({ ticket, onOpenTicket, onChanged }) {
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/tickets/${ticket.id}/similar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load similar tickets.');
      setSimilar(data.similar || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [ticket.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function linkTo(parentCaseId) {
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ parentCaseId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not link the tickets.');
      await onChanged();
    } catch (linkError) {
      setError(linkError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ticket-detail-card similar-tickets">
      <h2>Similar open tickets</h2>
      <p className="similar-tickets-note">
        Open tickets that look like the same problem. If this is a duplicate,
        link it to the original so it is only worked on once.
      </p>

      {ticket.parentCaseId && (
        <p className="similar-linked">
          Linked as a duplicate of{' '}
          <button
            type="button"
            className="similar-link-button"
            onClick={() => onOpenTicket?.(ticket.parentCaseId)}
          >
            #{ticket.parentCaseId}
          </button>
          {' · '}
          <button
            type="button"
            className="similar-link-button"
            disabled={saving}
            onClick={() => linkTo(null)}
          >
            Unlink
          </button>
        </p>
      )}

      {loading && <p className="ticket-muted-text">Looking for similar tickets…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && similar.length === 0 && (
        <p className="ticket-muted-text">No similar open tickets found.</p>
      )}

      {!loading && similar.length > 0 && (
        <ul className="similar-list">
          {similar.map((item) => (
            <li key={item.id} className="similar-item">
              <div className="similar-main">
                <button
                  type="button"
                  className="similar-link-button similar-title"
                  onClick={() => onOpenTicket?.(item.id)}
                >
                  #{item.id} {item.title}
                </button>
                <span className="similar-meta">
                  {priorityLabel(item.priority, item.priorityLevel)} · {item.status}
                  {item.requester ? ` · ${item.requester.name}` : ''}
                </span>
              </div>
              <span className="similar-score" title="How closely the wording matches">
                {Math.round(item.score * 100)}% match
              </span>
              {ticket.parentCaseId === item.id ? (
                <span className="ai-tag">Linked</span>
              ) : (
                <button
                  type="button"
                  className="ticket-secondary-button"
                  disabled={saving}
                  onClick={() => linkTo(item.id)}
                >
                  Mark as duplicate of #{item.id}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
