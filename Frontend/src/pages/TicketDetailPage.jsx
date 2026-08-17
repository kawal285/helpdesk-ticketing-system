import { useEffect, useState } from 'react';

const STATUSES = [
  'Open',
  'In Progress',
  'Resolved',
  'Closed',
];

const STATUS_LABELS = {
  Open: 'Open',
  'In Progress': 'In Progress',
  Resolved: 'Resolved – Awaiting Review',
  Closed: 'Reviewed and Closed',
};

const TRANSITIONS = {
  Open: ['In Progress', 'Resolved', 'Closed'],
  'In Progress': ['Open', 'Resolved', 'Closed'],
  Resolved: ['In Progress', 'Closed'],
  Closed: [],
};

const CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Account',
  'Other',
];

const PRIORITIES = [
  'Low',
  'Medium',
  'High',
  'Critical',
];

const PRIORITY_DAYS = {
  Low: 10,
  Medium: 5,
  High: 2,
  Critical: 1,
};

function formatDate(value) {
  if (!value) return 'Not available';

  return new Date(value).toLocaleString('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function ProgressTracker({ status }) {
  const currentIndex = STATUS_STEPS.findIndex(
    (step) => step.status === status
  );

  return (
    <div className="ticket-progress">
      {STATUS_STEPS.map((step, index) => {
        const completed = index <= currentIndex;

        return (
          <div
            className={`ticket-progress-step ${
              completed ? 'completed' : ''
            }`}
            key={step.status}
          >
            <div className="ticket-progress-circle">
              {completed ? '✓' : index + 1}
            </div>

            <div className="ticket-progress-label">
              {step.label}
            </div>

            {index < STATUS_STEPS.length - 1 && (
              <div
                className={`ticket-progress-line ${
                  index < currentIndex ? 'completed' : ''
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STATUS_STEPS = [
  {
    status: 'Open',
    label: 'Open',
  },
  {
    status: 'In Progress',
    label: 'In Progress',
  },
  {
    status: 'Resolved',
    label: 'Resolved',
  },
  {
    status: 'Closed',
    label: 'Reviewed',
  },
];

export default function TicketDetailPage({
  ticketId,
  user,
  onBack,
}) {
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [agents, setAgents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const [statusSaving, setStatusSaving] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const isStaff =
    user.role === 'agent' || user.role === 'admin';

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    loadEverything();
  }, [ticketId]);

  useEffect(() => {
    if (!isAdmin) return;

    const token = localStorage.getItem('token');

    fetch('http://localhost:4000/users?role=agent', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => response.json())
      .then((data) => setAgents(data.users || []))
      .catch(() => setAgents([]));
  }, [isAdmin]);

  async function loadEverything() {
    setLoading(true);
    setError('');

    const token = localStorage.getItem('token');

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      const [ticketResponse, commentsResponse] =
        await Promise.all([
          fetch(
            `http://localhost:4000/tickets/${ticketId}`,
            { headers }
          ),
          fetch(
            `http://localhost:4000/tickets/${ticketId}/comments`,
            { headers }
          ),
        ]);

      const ticketData = await ticketResponse.json();
      const commentsData = await commentsResponse.json();

      if (!ticketResponse.ok) {
        throw new Error(
          ticketData.message || 'Could not load the ticket.'
        );
      }

      if (!commentsResponse.ok) {
        throw new Error(
          commentsData.message || 'Could not load comments.'
        );
      }

      setTicket(ticketData.ticket);
      setComments(commentsData.comments || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setEditTitle(ticket.title);
    setEditDescription(ticket.description);
    setEditCategory(ticket.category);
    setEditPriority(ticket.priority);
    setEditError('');
    setEditing(true);
  }

  async function handleStatusChange(newStatus) {
    if (!newStatus || newStatus === ticket.status) return;

    setActionError('');
    setStatusSaving(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `http://localhost:4000/tickets/${ticketId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not update the status.'
        );
      }

      await loadEverything();
    } catch (statusError) {
      setActionError(statusError.message);
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleAssignChange(assigneeId) {
    setActionError('');
    setAssignSaving(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `http://localhost:4000/tickets/${ticketId}/assign`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            assigneeId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not update assignment.'
        );
      }

      await loadEverything();
    } catch (assignmentError) {
      setActionError(assignmentError.message);
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleAiAnalyze() {
    setActionError('');
    setAnalyzing(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `http://localhost:4000/tickets/${ticketId}/ai-analyze`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'AI analysis failed.'
        );
      }

      await loadEverything();
    } catch (analysisError) {
      setActionError(analysisError.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveEdit(event) {
    event.preventDefault();

    setEditError('');
    setEditSaving(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `http://localhost:4000/tickets/${ticketId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: editTitle.trim(),
            description: editDescription.trim(),
            category: editCategory,
            priority: editPriority,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not save changes.'
        );
      }

      setEditing(false);
      await loadEverything();
    } catch (saveError) {
      setEditError(saveError.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddComment(event) {
    event.preventDefault();

    if (!commentText.trim()) return;

    setPosting(true);
    setActionError('');

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `http://localhost:4000/tickets/${ticketId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: commentText.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not post comment.'
        );
      }

      setCommentText('');
      await loadEverything();
    } catch (commentError) {
      setActionError(commentError.message);
    } finally {
      setPosting(false);
    }
  }
  async function handleResolutionReview(action) {
  setActionError('');
  setReviewSaving(true);

  try {
    const token = localStorage.getItem('token');

    const response = await fetch(
      `http://localhost:4000/tickets/${ticketId}/review`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || 'Could not submit your review.'
      );
    }

    await loadEverything();
  } catch (reviewError) {
    setActionError(reviewError.message);
  } finally {
    setReviewSaving(false);
  }
}

  if (loading) {
    return (
      <main className="ticket-detail-page">
        <div className="ticket-detail-card">
          <p>Loading ticket…</p>
        </div>
      </main>
    );
  }

  if (error || !ticket) {
    return (
      <main className="ticket-detail-page">
        <button
          type="button"
          className="ticket-back-button"
          onClick={onBack}
        >
          ← Back to tickets
        </button>

        <div className="error-text">
          {error || 'Ticket not found.'}
        </div>
      </main>
    );
  }

  const dueDate = ticket.dueAt
    ? new Date(ticket.dueAt)
    : null;

  const overdue =
    dueDate &&
    dueDate < new Date() &&
    !['Resolved', 'Closed'].includes(ticket.status);

  const availableStatuses = isAdmin
    ? STATUSES
    : [
        ticket.status,
        ...(TRANSITIONS[ticket.status] || []),
      ];

  return (
    <main className="ticket-detail-page">
      <button
        type="button"
        className="ticket-back-button"
        onClick={onBack}
      >
        ← Back to tickets
      </button>

      <header className="ticket-detail-header">
        <div>
          <span className="ticket-reference">
            Ticket TK-{ticket.id}
          </span>

          <h1>{ticket.title}</h1>

          <p>
            Created {formatDate(ticket.createdAt)}
          </p>
        </div>

        <span
          className={`ticket-status-badge status-${ticket.status
            .toLowerCase()
            .replace(/\s+/g, '-')}`}
        >
          {STATUS_LABELS[ticket.status] || ticket.status}
        </span>
      </header>

      <section className="ticket-detail-card">
        <h2>Ticket progress</h2>

        <ProgressTracker status={ticket.status} />

        {ticket.status === 'Resolved' && !isStaff && (
          <div className="ticket-review-notice">
            The support team marked this ticket as resolved.
            Customer review controls will be added in the next
            stage.
          </div>
        )}
      </section>

      <div className="ticket-detail-grid">
        <section className="ticket-detail-card">
          <h2>Case details</h2>

          {!editing ? (
            <>
              <dl className="ticket-information-list">
                <div>
                  <dt>Priority</dt>
                  <dd>{ticket.priority}</dd>
                </div>

                <div>
                  <dt>Target</dt>
                  <dd>
                    {PRIORITY_DAYS[ticket.priority] || '—'} business
                    day
                    {PRIORITY_DAYS[ticket.priority] === 1
                      ? ''
                      : 's'}
                  </dd>
                </div>

                <div>
                  <dt>Category</dt>
                  <dd>{ticket.category}</dd>
                </div>

                <div>
                  <dt>Origin</dt>
                  <dd>{ticket.origin || 'Not provided'}</dd>
                </div>
{ticket.status === 'Resolved' && !isStaff && (
  <div className="ticket-review-panel">
    <h3>Has your problem been solved?</h3>

    <p>
      The support team marked this ticket as resolved.
      Please confirm whether the solution worked.
    </p>

    {actionError && (
      <div className="error-text">{actionError}</div>
    )}

    <div className="ticket-review-actions">
      <button
        type="button"
        className="ticket-accept-button"
        disabled={reviewSaving}
        onClick={() => handleResolutionReview('accept')}
      >
        {reviewSaving
          ? 'Submitting…'
          : 'Yes, close this ticket'}
      </button>

      <button
        type="button"
        className="ticket-reopen-button"
        disabled={reviewSaving}
        onClick={() => handleResolutionReview('reopen')}
      >
        No, I still need help
      </button>
    </div>
  </div>
)}
                <div>
                  <dt>Location</dt>
                  <dd>{ticket.location || 'Not provided'}</dd>
                </div>

                <div>
                  <dt>Initial feeling</dt>
                  <dd>
                    {ticket.initialFeeling || 'Not provided'}
                  </dd>
                </div>

                <div>
                  <dt>Due date</dt>
                  <dd className={overdue ? 'ticket-overdue' : ''}>
                    {formatDate(ticket.dueAt)}
                    {overdue && ' – Overdue'}
                  </dd>
                </div>

                <div>
                  <dt>Resolved date</dt>
                  <dd>{formatDate(ticket.resolvedAt)}</dd>
                </div>
              </dl>

              <div className="ticket-description">
                <h3>Description</h3>
                <p>{ticket.description}</p>
              </div>

              {isStaff && (
                <button
                  type="button"
                  className="ticket-secondary-button"
                  onClick={startEditing}
                >
                  Edit ticket
                </button>
              )}
            </>
          ) : (
            <form onSubmit={handleSaveEdit}>
              {editError && (
                <div className="error-text">{editError}</div>
              )}

              <div className="field">
                <label htmlFor="editTitle">Title</label>
                <input
                  id="editTitle"
                  required
                  value={editTitle}
                  onChange={(event) =>
                    setEditTitle(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="editDescription">
                  Description
                </label>
                <textarea
                  id="editDescription"
                  rows={5}
                  required
                  value={editDescription}
                  onChange={(event) =>
                    setEditDescription(event.target.value)
                  }
                />
              </div>

              <div className="ticket-edit-grid">
                <div className="field">
                  <label htmlFor="editCategory">
                    Category
                  </label>
                  <select
                    id="editCategory"
                    value={editCategory}
                    onChange={(event) =>
                      setEditCategory(event.target.value)
                    }
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="editPriority">
                    Priority
                  </label>
                  <select
                    id="editPriority"
                    value={editPriority}
                    onChange={(event) =>
                      setEditPriority(event.target.value)
                    }
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ticket-action-row">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={editSaving}
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>

                <button
                  type="button"
                  className="ticket-secondary-button"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="ticket-detail-card">
          <h2>People</h2>

          <div className="ticket-person-card">
            <span>Requester</span>
            <strong>
              {ticket.requester?.name ||
                `User #${ticket.requesterId}`}
            </strong>
            <a
              href={
                ticket.requester?.email
                  ? `mailto:${ticket.requester.email}`
                  : undefined
              }
            >
              {ticket.requester?.email ||
                'Email unavailable'}
            </a>
            <small>
              {ticket.requester?.organization ||
                ticket.organization}
            </small>
          </div>

          <div className="ticket-person-card">
            <span>Assigned support agent</span>
            <strong>
              {ticket.assignee?.name || 'Not assigned'}
            </strong>

            {ticket.assignee?.email ? (
              <a href={`mailto:${ticket.assignee.email}`}>
                {ticket.assignee.email}
              </a>
            ) : (
              <small>
                An available support agent will be assigned.
              </small>
            )}
          </div>
        </section>
      </div>

      {isStaff && (
        <section className="ticket-detail-card">
          <h2>Staff actions</h2>

          {actionError && (
            <div className="error-text">{actionError}</div>
          )}

          <div className="ticket-staff-actions">
            <label>
              Status

              <select
                value={ticket.status}
                disabled={statusSaving}
                onChange={(event) =>
                  handleStatusChange(event.target.value)
                }
              >
                {[...new Set(availableStatuses)].map(
                  (status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status] || status}
                    </option>
                  )
                )}
              </select>
            </label>

            {isAdmin ? (
              <label>
                Assigned agent

                <select
                  value={ticket.assigneeId || ''}
                  disabled={assignSaving}
                  onChange={(event) =>
                    handleAssignChange(
                      event.target.value
                        ? Number(event.target.value)
                        : null
                    )
                  }
                >
                  <option value="">Unassigned</option>

                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <button
                type="button"
                className="ticket-secondary-button"
                disabled={assignSaving}
                onClick={() =>
                  handleAssignChange(
                    ticket.assigneeId === user.id
                      ? null
                      : user.id
                  )
                }
              >
                {ticket.assigneeId === user.id
                  ? 'Unassign me'
                  : 'Assign to me'}
              </button>
            )}

            <button
              type="button"
              className="ticket-secondary-button"
              disabled={analyzing}
              onClick={handleAiAnalyze}
            >
              {analyzing
                ? 'Analysing…'
                : 'Run AI analysis'}
            </button>
          </div>
        </section>
      )}

      {ticket.aiAnalyzedAt && (
        <section className="ticket-detail-card ticket-ai-card">
          <h2>AI analysis</h2>

          <p>
            <strong>Suggested category:</strong>{' '}
            {ticket.aiCategory || 'Not available'}
          </p>

          <p>
            <strong>Suggested priority:</strong>{' '}
            {ticket.aiPriority || 'Not available'}
          </p>

          {ticket.aiSuggestedResponse && (
            <div className="ticket-ai-response">
              {ticket.aiSuggestedResponse}
            </div>
          )}

          <small>
            Analysed {formatDate(ticket.aiAnalyzedAt)}
          </small>
        </section>
      )}

      <section className="ticket-detail-card">
        <h2>Conversation</h2>

        {comments.length === 0 && (
          <p className="ticket-muted-text">
            No comments have been added yet.
          </p>
        )}

        <div className="ticket-comments">
          {comments.map((comment) => (
            <article
              className="ticket-comment"
              key={comment.id}
            >
              <div>
                <strong>
                  {comment.author?.name ||
                    `User #${comment.authorId}`}
                </strong>

                <time>
                  {formatDate(comment.createdAt)}
                </time>
              </div>

              <p>{comment.text}</p>
            </article>
          ))}
        </div>

        <form onSubmit={handleAddComment}>
          <div className="field">
            <label htmlFor="comment">
              Add a comment
            </label>

            <textarea
              id="comment"
              rows={4}
              placeholder="Add an update, answer or question…"
              value={commentText}
              onChange={(event) =>
                setCommentText(event.target.value)
              }
            />
          </div>

          <button
            className="btn-primary ticket-comment-button"
            type="submit"
            disabled={posting || !commentText.trim()}
          >
            {posting ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      </section>
    </main>
  );
}