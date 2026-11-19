import { useState } from 'react';
import { percent, reasonText } from '../utils/handoff';
import { priorityLabel } from '../utils/priority';

const API_URL = 'http://localhost:4000';

// Staff-only banner for a ticket the AI wasn't sure about. Staff either
// change the priority/category (which also clears it) or confirm the
// AI's answer with "Mark as checked".
export default function HumanCheckBanner({ ticket, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function setFlag(value) {
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
        body: JSON.stringify({ needsHumanCheck: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update the ticket.');
      await onChanged();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  const reasons = ticket.humanCheckReasons || [];

  if (!ticket.needsHumanCheck) {
    if (ticket.humanCheckOutcome) {
      return (
        <p className="handoff-done">
          Checked by staff:{' '}
          {ticket.humanCheckOutcome === 'changed'
            ? "the AI's suggestion was changed."
            : "the AI's suggestion was kept."}
        </p>
      );
    }
    return (
      <p className="handoff-done">
        <button
          type="button"
          className="similar-link-button"
          disabled={saving}
          onClick={() => setFlag(true)}
        >
          Flag for a human check
        </button>
      </p>
    );
  }

  return (
    <div className="handoff-banner" role="status">
      <strong>Needs human check</strong>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>{reasonText(reason)}</li>
        ))}
      </ul>
      {(ticket.aiPriority || ticket.aiCategory) && (
        <p>
          AI suggested{' '}
          {ticket.aiPriority && (
            <>
              {priorityLabel(ticket.aiPriority, ticket.aiPriorityLevel)} (
              {percent(ticket.aiPriorityConfidence)} sure)
            </>
          )}
          {ticket.aiPriority && ticket.aiCategory && ' and '}
          {ticket.aiCategory && (
            <>
              {ticket.aiCategory} ({percent(ticket.aiCategoryConfidence)} sure)
            </>
          )}
          . Change the priority or category if it's wrong, or confirm it.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      <button
        type="button"
        className="ticket-secondary-button"
        disabled={saving}
        onClick={() => setFlag(false)}
      >
        Mark as checked
      </button>
    </div>
  );
}
