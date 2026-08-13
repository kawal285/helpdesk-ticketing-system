import { useState, useEffect } from 'react';

export default function DashboardPage({ user, onLogout, onNewTicket, onSelectTicket, onManageUsers }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [agentFilter, setAgentFilter] = useState('');
  const [agents, setAgents] = useState([]);

  const isStaff = user.role === 'agent' || user.role === 'admin';
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem('token');
    fetch('http://localhost:4000/users?role=agent', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAgents(data.users || []))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const url = overdueOnly
      ? 'http://localhost:4000/tickets/overdue'
      : `http://localhost:4000/tickets${agentFilter ? `?assigneeId=${agentFilter}` : ''}`;

    setLoading(true);
    setError('');

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        // The overdue endpoint doesn't support filtering by assignee
        // server-side, so apply it client-side on that smaller result set.
        const rows =
          overdueOnly && agentFilter
            ? data.tickets.filter((t) => String(t.assigneeId) === agentFilter)
            : data.tickets;
        setTickets(rows);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [overdueOnly, agentFilter]);

  function assigneeLabel(ticket) {
    if (!ticket.assigneeId) return 'Unassigned';
    const agent = agents.find((a) => a.id === ticket.assigneeId);
    return agent ? agent.name : `User #${ticket.assigneeId}`;
  }

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 28,
          boxShadow: '0 4px 16px rgba(16, 20, 43, 0.25)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0 }}>My Tickets</h1>
            <p style={{ color: '#656a7d', margin: 0 }}>
              Logged in as {user.name} ({user.role})
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {user.role === 'admin' && (
              <button className="btn-primary" style={{ width: 'auto' }} onClick={onManageUsers}>
                Manage Users
              </button>
            )}
            <button className="btn-primary" style={{ width: 'auto' }} onClick={onNewTicket}>
              + New Ticket
            </button>
            <button className="btn-primary" style={{ width: 'auto' }} onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>

        {isStaff && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              Show overdue only
            </label>

            {isAdmin && (
              <label style={{ fontSize: 13 }}>
                Agent:{' '}
                <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
                  <option value="">All agents</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {loading && <p>Loading tickets…</p>}
        {error && <div className="error-text">{error}</div>}

        {!loading && !error && tickets.length === 0 && <p>No tickets yet.</p>}

        {!loading && !error && tickets.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e2d9' }}>
                <th style={{ padding: 10 }}>ID</th>
                <th style={{ padding: 10 }}>Title</th>
                <th style={{ padding: 10 }}>Status</th>
                <th style={{ padding: 10 }}>Priority</th>
                <th style={{ padding: 10 }}>Category</th>
                {isStaff && <th style={{ padding: 10 }}>Assignee</th>}
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket.id)}
                  style={{ borderBottom: '1px solid #e5e2d9', cursor: 'pointer' }}
                >
                  <td style={{ padding: 10 }}>#{ticket.id}</td>
                  <td style={{ padding: 10 }}>{ticket.title}</td>
                  <td style={{ padding: 10 }}>{ticket.status}</td>
                  <td style={{ padding: 10 }}>{ticket.priority}</td>
                  <td style={{ padding: 10 }}>{ticket.category}</td>
                  {isStaff && <td style={{ padding: 10 }}>{assigneeLabel(ticket)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}