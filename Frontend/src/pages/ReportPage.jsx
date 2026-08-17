import { useEffect, useMemo, useState } from 'react';

const API_URL = 'http://localhost:4000';

export default function ReportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        setError('');

        const token = localStorage.getItem('token');

        const response = await fetch(
          `${API_URL}/tickets?limit=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Could not load report data.'
          );
        }

        setTickets(
          Array.isArray(data.tickets) ? data.tickets : []
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const report = useMemo(() => {
    const now = new Date();

    const countByStatus = (status) =>
      tickets.filter((ticket) => ticket.status === status)
        .length;

    const countByCategory = (category) =>
      tickets.filter(
        (ticket) => ticket.category === category
      ).length;

    const countByPriority = (priority) =>
      tickets.filter(
        (ticket) => ticket.priority === priority
      ).length;

    const overdue = tickets.filter((ticket) => {
      if (!ticket.dueAt) return false;

      const completed =
        ticket.status === 'Resolved' ||
        ticket.status === 'Closed';

      return !completed && new Date(ticket.dueAt) < now;
    }).length;

    return {
      total: tickets.length,
      open: countByStatus('Open'),
      inProgress: countByStatus('In Progress'),
      resolved: countByStatus('Resolved'),
      closed: countByStatus('Closed'),
      overdue,
      assigned: tickets.filter(
        (ticket) => Boolean(ticket.assigneeId)
      ).length,
      unassigned: tickets.filter(
        (ticket) => !ticket.assigneeId
      ).length,
      categories: [
        {
          name: 'Hardware',
          count: countByCategory('Hardware'),
        },
        {
          name: 'Software',
          count: countByCategory('Software'),
        },
        {
          name: 'Network',
          count: countByCategory('Network'),
        },
        {
          name: 'Account',
          count: countByCategory('Account'),
        },
        {
          name: 'Other',
          count: countByCategory('Other'),
        },
      ],
      priorities: [
        {
          name: 'Critical',
          count: countByPriority('Critical'),
        },
        {
          name: 'High',
          count: countByPriority('High'),
        },
        {
          name: 'Medium',
          count: countByPriority('Medium'),
        },
        {
          name: 'Low',
          count: countByPriority('Low'),
        },
        {
          name: 'Trivial',
          count: countByPriority('Trivial'),
        },
      ],
    };
  }, [tickets]);

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 12,
    padding: 22,
    boxShadow: '0 4px 14px rgba(0, 45, 85, 0.09)',
    border: '1px solid #e2e8ee',
  };

  const summaryCards = [
    {
      label: 'Total Tickets',
      value: report.total,
      colour: '#005a9c',
    },
    {
      label: 'Open',
      value: report.open,
      colour: '#f37021',
    },
    {
      label: 'In Progress',
      value: report.inProgress,
      colour: '#006bb6',
    },
    {
      label: 'Resolved',
      value: report.resolved,
      colour: '#66a300',
    },
    {
      label: 'Reviewed & Closed',
      value: report.closed,
      colour: '#263238',
    },
    {
      label: 'Overdue',
      value: report.overdue,
      colour: '#c62828',
    },
  ];

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        <p>Loading report…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        width: '100%',
        minHeight: '100vh',
        padding: '40px',
        background: '#f1f4f7',
        fontFamily: 'sans-serif',
        color: '#121826',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            marginBottom: 28,
            borderLeft: '7px solid #f37021',
            paddingLeft: 20,
          }}
        >
          <h1
            style={{
              margin: 0,
              color: '#005a9c',
              fontSize: 42,
            }}
          >
            Helpdesk Report
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              color: '#5f6878',
              fontSize: 17,
            }}
          >
            Current ticket workload and service performance.
          </p>
        </div>

        {error && (
          <div
            className="error-text"
            style={{ marginBottom: 20 }}
          >
            {error}
          </div>
        )}

        {!error && (
          <>
            <section
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(165px, 1fr))',
                gap: 16,
                marginBottom: 24,
              }}
            >
              {summaryCards.map((card) => (
                <div key={card.label} style={cardStyle}>
                  <div
                    style={{
                      color: '#626b7d',
                      fontSize: 15,
                    }}
                  >
                    {card.label}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      color: card.colour,
                      fontSize: 36,
                      fontWeight: 800,
                    }}
                  >
                    {card.value}
                  </div>
                </div>
              ))}
            </section>

            <section
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 20,
                marginBottom: 24,
              }}
            >
              <div style={cardStyle}>
                <h2
                  style={{
                    color: '#005a9c',
                    marginTop: 0,
                  }}
                >
                  Tickets by category
                </h2>

                {report.categories.map((item) => (
                  <ReportRow
                    key={item.name}
                    label={item.name}
                    value={item.count}
                    total={report.total}
                  />
                ))}
              </div>

              <div style={cardStyle}>
                <h2
                  style={{
                    color: '#005a9c',
                    marginTop: 0,
                  }}
                >
                  Tickets by priority
                </h2>

                {report.priorities.map((item) => (
                  <ReportRow
                    key={item.name}
                    label={item.name}
                    value={item.count}
                    total={report.total}
                  />
                ))}
              </div>

              <div style={cardStyle}>
                <h2
                  style={{
                    color: '#005a9c',
                    marginTop: 0,
                  }}
                >
                  Assignment overview
                </h2>

                <ReportRow
                  label="Assigned"
                  value={report.assigned}
                  total={report.total}
                />

                <ReportRow
                  label="Unassigned"
                  value={report.unassigned}
                  total={report.total}
                />
              </div>
            </section>

            <section style={cardStyle}>
              <h2
                style={{
                  color: '#005a9c',
                  marginTop: 0,
                }}
              >
                Recent ticket summary
              </h2>

              {tickets.length === 0 ? (
                <p>No ticket data is available.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          textAlign: 'left',
                          borderBottom: '2px solid #d8dde3',
                        }}
                      >
                        <th style={{ padding: 12 }}>Ticket</th>
                        <th style={{ padding: 12 }}>Title</th>
                        <th style={{ padding: 12 }}>Status</th>
                        <th style={{ padding: 12 }}>Priority</th>
                        <th style={{ padding: 12 }}>Category</th>
                        <th style={{ padding: 12 }}>Assignment</th>
                      </tr>
                    </thead>

                    <tbody>
                      {tickets.slice(0, 10).map((ticket) => (
                        <tr
                          key={ticket.id}
                          style={{
                            borderBottom:
                              '1px solid #e2e6ea',
                          }}
                        >
                          <td style={{ padding: 12 }}>
                            TK-{ticket.id}
                          </td>
                          <td style={{ padding: 12 }}>
                            {ticket.title}
                          </td>
                          <td style={{ padding: 12 }}>
                            {ticket.status}
                          </td>
                          <td style={{ padding: 12 }}>
                            {ticket.priority}
                          </td>
                          <td style={{ padding: 12 }}>
                            {ticket.category}
                          </td>
                          <td style={{ padding: 12 }}>
                            {ticket.assignee?.name ||
                              (ticket.assigneeId
                                ? `Agent #${ticket.assigneeId}`
                                : 'Unassigned')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ReportRow({ label, value, total }) {
  const percentage =
    total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 7,
        }}
      >
        <span>{label}</span>
        <strong>
          {value} ({percentage}%)
        </strong>
      </div>

      <div
        style={{
          height: 9,
          borderRadius: 999,
          background: '#e7ecf0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: '#006bb6',
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}