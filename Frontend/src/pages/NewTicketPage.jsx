import { useState } from 'react';

const CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Account',
  'Other',
];

const EMPTY_FORM = {
  title: '',
  description: '',
  category: '',
  room: '',
};

const styles = {
  page: {
    width: '100%',
    maxWidth: 980,
    margin: '32px auto',
    padding: '0 22px 50px',
    fontFamily: 'inherit',
  },

  headingArea: {
    marginBottom: 18,
  },

  heading: {
    margin: '0 0 3px',
    color: '#005a9c',
    fontSize: 32,
  },

  subtitle: {
    margin: 0,
    color: '#656a7d',
    fontSize: 14,
  },

  tabs: {
    display: 'flex',
    gap: 28,
    padding: '0 4px',
    borderBottom: '1px solid #d9e1e8',
  },

  activeTab: {
    padding: '13px 2px',
    color: '#005a9c',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid #f37021',
    fontWeight: 700,
    cursor: 'default',
  },

  inactiveTab: {
    padding: '13px 2px',
    color: '#656a7d',
    background: 'transparent',
    border: 'none',
    cursor: 'default',
  },

  card: {
    marginTop: 18,
    padding: 26,
    background: '#ffffff',
    border: '1px solid #d9e1e8',
    borderRadius: 10,
    boxShadow: '0 4px 14px rgba(16, 20, 43, 0.08)',
  },

  cardHeading: {
    margin: '0 0 22px',
    color: '#003b70',
    fontSize: 16,
    textTransform: 'uppercase',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '18px 22px',
  },

  fullWidth: {
    gridColumn: '1 / -1',
  },

  textarea: {
    width: '100%',
    minHeight: 150,
    padding: 12,
    resize: 'vertical',
    border: '1px solid #d9e1e8',
    borderRadius: 5,
    fontFamily: 'inherit',
    fontSize: 14,
  },

  helper: {
    display: 'block',
    marginTop: 6,
    color: '#656a7d',
    fontSize: 12,
    lineHeight: 1.4,
  },

  required: {
    color: '#d0483f',
  },

  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14,
    marginTop: 6,
  },

  checkboxCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    background: '#f7f9fb',
    border: '1px solid #d9e1e8',
    borderRadius: 6,
    cursor: 'pointer',
  },

  informationCard: {
    marginTop: 18,
    padding: 18,
    background: '#eaf4fa',
    borderLeft: '4px solid #005a9c',
    borderRadius: 5,
  },

  informationTitle: {
    margin: '0 0 8px',
    color: '#003b70',
    fontSize: 15,
  },

  informationText: {
    margin: 0,
    color: '#354454',
    fontSize: 13,
    lineHeight: 1.55,
  },

  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
  },

  submitButton: {
    width: 'auto',
    minWidth: 150,
  },

  cancelButton: {
    padding: '10px 18px',
    color: '#005a9c',
    background: '#ffffff',
    border: '1px solid #005a9c',
    borderRadius: 5,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default function NewTicketPage({
  onCreated,
  onCancel,
  initialData = {},
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    title: initialData.title || '',
    description:
      initialData.description ||
      initialData.question ||
      '',
    category:
      initialData.category ||
      initialData.suggestedCategory ||
      '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(key, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  function validateForm() {
    if (!form.title.trim()) {
      return 'Please enter a title for the problem.';
    }

    if (form.title.trim().length < 3) {
      return 'The ticket title must contain at least 3 characters.';
    }

    if (!form.description.trim()) {
      return 'Please describe the problem.';
    }

    if (form.description.trim().length < 10) {
      return 'Please provide more information about the problem.';
    }

    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    const body = {
      title: form.title.trim(),
      description: form.description.trim(),

      ...(form.category && {
        category: form.category,
      }),

      ...(form.room.trim() && {
        room: form.room.trim(),
      }),
    };

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error(
          'Your login session has expired. Please log in again.'
        );
      }

      const response = await fetch(
        'http://localhost:4000/tickets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not create the ticket.'
        );
      }

      onCreated(data.ticket);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.headingArea}>
        <h1 style={styles.heading}>New Case</h1>

        <p style={styles.subtitle}>
          Create and track a request with the IT support team.
        </p>
      </header>

      <div style={styles.tabs}>
        <button type="button" style={styles.activeTab}>
          Summary
        </button>

        <button
          type="button"
          style={styles.inactiveTab}
          title="Available after the ticket is created"
        >
          Case Relationships
        </button>

        <button
          type="button"
          style={styles.inactiveTab}
          title="Available to support staff after creation"
        >
          Administration
        </button>
      </div>

      {error && (
        <div
          className="error-text"
          role="alert"
          style={{ marginTop: 18 }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section style={styles.card}>
          <h2 style={styles.cardHeading}>Case details</h2>

          <div style={styles.grid}>
            <div style={styles.fullWidth} className="field">
              <label htmlFor="title">
                Title{' '}
                <span style={styles.required}>*</span>
              </label>

              <input
                id="title"
                name="title"
                required
                maxLength={150}
                placeholder="Short summary of the problem"
                value={form.title}
                onChange={(event) =>
                  updateField('title', event.target.value)
                }
              />

              <small style={styles.helper}>
                Example: Laptop overheats and shuts down.
              </small>
            </div>

            <div className="field">
              <label htmlFor="category">
                Category
              </label>

              <select
                id="category"
                name="category"
                value={form.category}
                onChange={(event) =>
                  updateField('category', event.target.value)
                }
              >
                <option value="">Let AI suggest</option>

                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <small style={styles.helper}>
                AI can recommend a category after submission.
              </small>
            </div>

            <div style={styles.fullWidth} className="field">
              <label htmlFor="room">
                Room
              </label>

              <input
                id="room"
                name="room"
                maxLength={150}
                placeholder="Example: Auckland campus, Level 3, Room 214"
                value={form.room}
                onChange={(event) =>
                  updateField('room', event.target.value)
                }
              />
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardHeading}>Description</h2>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="description">
              Problem description{' '}
              <span style={styles.required}>*</span>
            </label>

            <textarea
              id="description"
              name="description"
              required
              maxLength={5000}
              style={styles.textarea}
              placeholder="Describe the problem in detail. Include: the exact error message (if any), which device or system is affected, and what troubleshooting steps you have already tried."
              value={form.description}
              onChange={(event) =>
                updateField(
                  'description',
                  event.target.value
                )
              }
            />

            <small style={styles.helper}>
              {form.description.length}/5000 characters
            </small>
          </div>
        </section>

        <div style={styles.informationCard}>
          <h3 style={styles.informationTitle}>
            What happens after submission?
          </h3>

          <p style={styles.informationText}>
            The system records your name and email from your
            logged-in account. AI reviews the description to set
            the ticket's priority and target completion date, and
            can suggest a category and initial response. A support
            agent may adjust the priority after reviewing your
            case. An administrator can then assign the appropriate
            support agent. Your ticket will show its status,
            assigned person and target completion date.
          </p>
        </div>

        <div style={styles.actionRow}>
          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={styles.submitButton}
          >
            {loading ? 'Submitting…' : 'Submit Ticket'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}