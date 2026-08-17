import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  Open: 'Open',
  'In Progress': 'In Progress',
  Resolved: 'Resolved – Awaiting Review',
  Closed: 'Reviewed and Closed',
};

function authHeaders() {
  const token = localStorage.getItem('token');

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function fetchCount(query = '') {
  const response = await fetch(
    `http://localhost:4000/tickets?limit=1${query}`,
    {
      headers: authHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'Could not load ticket count.'
    );
  }

  return data.total || 0;
}

export default function AdminDashboardPage({
  user,
  onSelectTicket,
}) {
  const [counts, setCounts] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  });

  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const [
        total,
        open,
        inProgress,
        resolved,
        closed,
        recentResponse,
      ] = await Promise.all([
        fetchCount(''),

        fetchCount(
          `&status=${encodeURIComponent('Open')}`
        ),

        fetchCount(
          `&status=${encodeURIComponent('In Progress')}`
        ),

        fetchCount(
          `&status=${encodeURIComponent('Resolved')}`
        ),

        fetchCount(
          `&status=${encodeURIComponent('Closed')}`
        ),

        fetch(
          'http://localhost:4000/tickets?limit=5',
          {
            headers: authHeaders(),
          }
        ),
      ]);

      const recentData = await recentResponse.json();

      if (!recentResponse.ok) {
        throw new Error(
          recentData.message ||
            'Could not load recent tickets.'
        );
      }

      setCounts({
        total,
        open,
        inProgress,
        resolved,
        closed,
      });

      setRecentTickets(recentData.tickets || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    {
      label: 'Total Tickets',
      value: counts.total,
      colour: '#005a9c',
      background: '#eaf4fa',
    },
    {
      label: 'Open Tickets',
      value: counts.open,
      colour: '#075985',
      background: '#e0f2fe',
    },
    {
      label: 'In Progress',
      value: counts.inProgress,
      colour: '#854d0e',
      background: '#fef3c7',
    },
    {
      label: 'Awaiting Review',
      value: counts.resolved,
      colour: '#166534',
      background: '#dcfce7',
    },
    {
      label: 'Reviewed & Closed',
      value: counts.closed,
      colour: '#374151',
      background: '#e5e7eb',
    },
  ];

  return (
    <main
      style={{
        width: '100%',
        maxWidth: 1100,
        margin: '40px auto',
        padding: '0 22px 50px',
      }}
    >
      <header style={{ marginBottom: 22 }}>
        <h1
          style={{
            margin: '0 0 5px',
            color: '#005a9c',
            fontSize: 38,
          }}
        >
          Dashboard
        </h1>

        <p
          style={{
            margin: 0,
            color: '#656a7d',
          }}
        >
          Welcome back, {user.name}
        </p>
      </header>

      {error && (
        <div className="error-text">{error}</div>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {cards.map((card) => (
          <article
            key={card.label}
            style={{
              minHeight: 135,
              padding: 20,
              background: '#ffffff',
              borderTop: `4px solid ${card.colour}`,
              borderRadius: 12,
              boxShadow:
                '0 4px 16px rgba(16, 20, 43, 0.08)',
            }}
          >
            <div
              style={{
                color: '#656a7d',
                fontSize: 14,
              }}
            >
              {card.label}
            </div>

            <div
              style={{
                marginTop: 10,
                color: card.colour,
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              {loading ? '…' : card.value}
            </div>
          </article>
        ))}
      </section>

      <section
        style={{
          padding: 24,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow:
            '0 4px 16px rgba(16, 20, 43, 0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <h2
            style={{
              margin: 0,
              color: '#003b70',
            }}
          >
            Recent Tickets
          </h2>

          <button
            type="button"
            className="ticket-secondary-button"
            onClick={loadDashboard}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading && <p>Loading tickets…</p>}

        {!loading && recentTickets.length === 0 && (
          <p>No tickets yet.</p>
        )}

        {!loading && recentTickets.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: 760,
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: 'left',
                    borderBottom:
                      '2px solid #d9e1e8',
                  }}
                >
                  <th style={{ padding: 10 }}>
                    Ticket ID
                  </th>

                  <th style={{ padding: 10 }}>
                    Subject
                  </th>

                  <th style={{ padding: 10 }}>
                    Requester
                  </th>

                  <th style={{ padding: 10 }}>
                    Priority
                  </th>

                  <th style={{ padding: 10 }}>
                    Status
                  </th>

                  <th style={{ padding: 10 }}>
                    Created
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() =>
                      onSelectTicket(ticket.id)
                    }
                    style={{
                      borderBottom:
                        '1px solid #e5e9ed',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: 10 }}>
                      TK-{ticket.id}
                    </td>

                    <td style={{ padding: 10 }}>
                      {ticket.title}
                    </td>

                    <td style={{ padding: 10 }}>
                      {ticket.requester?.name ||
                        `User #${ticket.requesterId}`}
                    </td>

                    <td style={{ padding: 10 }}>
                      {ticket.priority}
                    </td>

                    <td style={{ padding: 10 }}>
                      {STATUS_LABELS[ticket.status] ||
                        ticket.status}
                    </td>

                    <td style={{ padding: 10 }}>
                      {new Date(
                        ticket.createdAt
                      ).toLocaleDateString('en-NZ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}