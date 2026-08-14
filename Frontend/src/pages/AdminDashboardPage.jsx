import { useState, useEffect } from 'react';

function authHeaders() {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
}

async function fetchCount(query) {
  const res = await fetch(`http://localhost:4000/tickets?limit=1${query}`, { headers: authHeaders() });
  const data = await res.json();
  return res.ok ? data.total : 0;
}

export default function AdminDashboardPage({ user, onSelectTicket }) {
  const [counts, setCounts] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    Promise.all([
      fetchCount(''),
      fetchCount(`&status=${encodeURIComponent('Open')}`),
      fetchCount(`&status=${encodeURIComponent('In Progress')}`),
      fetchCount(`&status=${encodeURIComponent('Resolved')}`),
      fetch('http://localhost:4000/tickets?limit=5', { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([total, open, inProgress, resolved, recent]) => {
        setCounts({ total, open, inProgress, resolved });
        setRecentTickets(recent.tickets || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 4px 16px rgba(16, 20, 43, 0.08)',
    flex: 1,
  };

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ margin: '0 0 4px' }}>Dashboard</h1>
      <p style={{ color: '#656a7d', marginTop: 0 }}>Welcome back, {user.name}</p>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: 'flex', gap: 16, margin: '20px 0' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: '#656a7d' }}>Total Tickets</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '…' : counts.total}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: '#656a7d' }}>Open Tickets</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '…' : counts.open}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: '#656a7d' }}>In Progress</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '…' : counts.inProgress}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: '#656a7d' }}>Resolved Tickets</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '…' : counts.resolved}</div>
        </div>
      </div>

      <div style={{ ...cardStyle, flex: 'none' }}>
        <h3 style={{ marginTop: 0 }}>Recent Tickets</h3>

        {loading && <p>Loading…</p>}

        {!loading && recentTickets.length === 0 && <p>No tickets yet.</p>}

        {!loading && recentTickets.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e2d9' }}>
                <th style={{ padding: 10 }}>Ticket ID</th>
                <th style={{ padding: 10 }}>Subject</th>
                <th style={{ padding: 10 }}>Requester</th>
                <th style={{ padding: 10 }}>Priority</th>
                <th style={{ padding: 10 }}>Status</th>
                <th style={{ padding: 10 }}>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelectTicket(t.id)}
                  style={{ borderBottom: '1px solid #e5e2d9', cursor: 'pointer' }}
                >
                  <td style={{ padding: 10 }}>TK-{t.id}</td>
                  <td style={{ padding: 10 }}>{t.title}</td>
                  <td style={{ padding: 10 }}>{t.requester?.name || `User #${t.requesterId}`}</td>
                  <td style={{ padding: 10 }}>{t.priority}</td>
                  <td style={{ padding: 10 }}>{t.status}</td>
                  <td style={{ padding: 10 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
