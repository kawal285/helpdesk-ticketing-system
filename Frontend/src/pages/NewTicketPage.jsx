import { useState } from 'react';

const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const INITIAL_FEELINGS = ['Calm', 'Concerned', 'Frustrated', 'Urgent'];
const ORIGINS = ['Portal', 'Email', 'Phone', 'Walk-in'];

export default function NewTicketPage({ onCreated, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    priority: '',
    initialFeeling: '',
    origin: '',
    location: '',
    studentLivingVillageResident: false,
    opsvDefect: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Leave optional dropdowns out of the request entirely if left blank,
    // rather than sending an empty string -- the backend validator only
    // accepts a real option or nothing at all.
    const body = {
      title: form.title,
      description: form.description,
      ...(form.category && { category: form.category }),
      ...(form.priority && { priority: form.priority }),
      ...(form.initialFeeling && { initialFeeling: form.initialFeeling }),
      ...(form.origin && { origin: form.origin }),
      ...(form.location && { location: form.location }),
      studentLivingVillageResident: form.studentLivingVillageResident,
      opsvDefect: form.opsvDefect,
    };

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not create ticket');
      onCreated(data.ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      <h1>New Case</h1>

      {error && <div className="error-text">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            required
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            required
            rows={5}
            style={{ width: '100%', padding: 8, fontFamily: 'inherit' }}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
          >
            <option value="">Let AI suggest</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            value={form.priority}
            onChange={(e) => updateField('priority', e.target.value)}
          >
            <option value="">Let AI suggest</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="initialFeeling">Initial Feeling</label>
          <select
            id="initialFeeling"
            value={form.initialFeeling}
            onChange={(e) => updateField('initialFeeling', e.target.value)}
          >
            <option value="">—</option>
            {INITIAL_FEELINGS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="origin">Origin</label>
          <select
            id="origin"
            value={form.origin}
            onChange={(e) => updateField('origin', e.target.value)}
          >
            <option value="">—</option>
            {ORIGINS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            placeholder="e.g. Block C, Room 214"
            value={form.location}
            onChange={(e) => updateField('location', e.target.value)}
          />
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.studentLivingVillageResident}
              onChange={(e) => updateField('studentLivingVillageResident', e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Student Living Village Resident?
          </label>
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.opsvDefect}
              onChange={(e) => updateField('opsvDefect', e.target.checked)}
              style={{ marginRight: 8 }}
            />
            OPSV Defect?
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: 'auto' }}>
            {loading ? 'Submitting…' : 'Submit Ticket'}
          </button>
          <button type="button" onClick={onCancel} style={{ padding: '10px 16px' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}