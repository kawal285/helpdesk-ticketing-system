import { useEffect, useState } from 'react';

const API_URL = 'http://localhost:4000';

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}`, ...extra };
}

// Desk levels for the app's priorities (Trivial sits below P4).
const DESK_LEVEL = { Critical: 'P1', High: 'P2', Medium: 'P3', Low: 'P4' };

function describeMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 60) return `${value} min`;
  const hours = value / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

const inputStyle = {
  width: 90,
  padding: '6px 8px',
  border: '1px solid #c9d1da',
  borderRadius: 6,
};

// Admin editor for the sla_targets table. Changes apply to tickets created
// or re-prioritised afterwards; existing deadlines are not moved.
export default function SlaTargetsEditor({ defaultPriority }) {
  const [targets, setTargets] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingPriority, setSavingPriority] = useState('');
  const [message, setMessage] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    loadTargets();
  }, []);

  async function loadTargets() {
    setLoadError('');
    try {
      const response = await fetch(`${API_URL}/sla-targets`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load targets.');
      setTargets(data.targets);
      setDrafts(
        Object.fromEntries(
          data.targets.map((t) => [
            t.priority,
            { responseMinutes: String(t.responseMinutes), resolutionMinutes: String(t.resolutionMinutes) },
          ])
        )
      );
    } catch (err) {
      setLoadError(err.message);
    }
  }

  function updateDraft(priority, field, value) {
    setDrafts((current) => ({
      ...current,
      [priority]: { ...current[priority], [field]: value },
    }));
  }

  function isChanged(target) {
    const draft = drafts[target.priority];
    return (
      draft &&
      (Number(draft.responseMinutes) !== target.responseMinutes ||
        Number(draft.resolutionMinutes) !== target.resolutionMinutes)
    );
  }

  async function save(priority) {
    const draft = drafts[priority];
    setSavingPriority(priority);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/sla-targets/${priority}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          responseMinutes: Number(draft.responseMinutes),
          resolutionMinutes: Number(draft.resolutionMinutes),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save the target.');
      setTargets((current) => current.map((t) => (t.priority === priority ? data.target : t)));
      setMessage({ ok: true, text: `${priority} targets saved. They apply to new tickets and priority changes.` });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setSavingPriority('');
    }
  }

  if (loadError) {
    return <p style={{ color: '#a12a20', margin: 0 }}>{loadError}</p>;
  }

  const usingDefaults = targets.some((t) => t.isDefault);

  return (
    <>
      <p style={{ margin: '0 0 12px', color: '#5f6878' }}>
        Times in minutes. Changes apply to tickets created or re-prioritised from now on.
        {usingDefaults && ' Rows marked "default" use provisional values not yet confirmed by the IT desk.'}
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #d8dde3' }}>
              <th style={{ padding: 8 }}>Priority</th>
              <th style={{ padding: 8 }}>First response</th>
              <th style={{ padding: 8 }}>Resolution</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {[...targets].reverse().map((target) => {
              const draft = drafts[target.priority] || {};
              return (
                <tr key={target.priority} style={{ borderBottom: '1px solid #e2e6ea' }}>
                  <td style={{ padding: 8 }}>
                    {target.priority}
                    {DESK_LEVEL[target.priority] && (
                      <span style={{ marginLeft: 6, color: '#5f6878' }}>({DESK_LEVEL[target.priority]})</span>
                    )}
                    {target.priority === defaultPriority && (
                      <div style={{ fontSize: 12, color: '#5f6878' }}>default priority</div>
                    )}
                    {target.isDefault && (
                      <div style={{ fontSize: 12, color: '#8a4b00' }}>default target</div>
                    )}
                  </td>
                  {['responseMinutes', 'resolutionMinutes'].map((field) => (
                    <td key={field} style={{ padding: 8, whiteSpace: 'nowrap' }}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        aria-label={`${target.priority} ${field === 'responseMinutes' ? 'first response' : 'resolution'} minutes`}
                        value={draft[field] ?? ''}
                        onChange={(e) => updateDraft(target.priority, field, e.target.value)}
                        style={inputStyle}
                      />
                      <span style={{ marginLeft: 6, fontSize: 12, color: '#5f6878' }}>
                        {describeMinutes(draft[field])}
                      </span>
                    </td>
                  ))}
                  <td style={{ padding: 8 }}>
                    <button
                      type="button"
                      onClick={() => save(target.priority)}
                      disabled={!isChanged(target) || savingPriority === target.priority}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: isChanged(target) ? '#005a9c' : '#c9d1da',
                        color: '#ffffff',
                        cursor: isChanged(target) ? 'pointer' : 'default',
                      }}
                    >
                      {savingPriority === target.priority ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {message && (
        <p style={{ margin: '12px 0 0', color: message.ok ? '#1e6b34' : '#a12a20' }}>{message.text}</p>
      )}
    </>
  );
}
