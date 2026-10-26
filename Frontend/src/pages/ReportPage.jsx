import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Hourglass,
  RefreshCw,
  Ticket as TicketIcon,
} from 'lucide-react';

const API_URL = 'http://localhost:4000';

// Validated categorical palette (dataviz skill, references/palette.md) --
// fixed hue order assigned by category position, not cycled by data.
// Passes CVD-separation and normal-vision-floor checks at 5 slots.
const CATEGORY_COLOURS = [
  '#2a78d6', // Hardware -- blue
  '#eb6834', // Software -- orange
  '#1baf7a', // Network -- aqua
  '#eda100', // Account -- yellow
  '#e87ba4', // Other -- magenta
];

// Priority is ordinal severity, so it gets a single-hue ordinal ramp
// (light = least urgent, dark = most urgent) rather than five arbitrary
// hues -- the previous High/Medium pair (orange/yellow) measured ΔE 12.2,
// below the 15 floor, genuinely hard to tell apart even with normal vision.
const PRIORITY_COLOURS = {
  Trivial: '#86b6ef',
  Low: '#5598e7',
  Medium: '#2a78d6',
  High: '#1c5cab',
  Critical: '#104281',
};

const ASSIGNMENT_COLOURS = {
  Assigned: '#1baf7a',
  Unassigned: '#f37021',
};

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

    const countByOrganization = (organization) =>
      tickets.filter(
        (ticket) => ticket.organization === organization
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
      assignments: [
        {
          name: 'Assigned',
          count: tickets.filter((ticket) =>
            Boolean(ticket.assigneeId)
          ).length,
        },
        {
          name: 'Unassigned',
          count: tickets.filter(
            (ticket) => !ticket.assigneeId
          ).length,
        },
      ],
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
      organizations: [
        {
          name: 'Future Skills',
          count: countByOrganization('Future Skills'),
        },
        {
          name: 'OP',
          count: countByOrganization('OP'),
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
      Icon: TicketIcon,
    },
    {
      label: 'Open',
      value: report.open,
      colour: '#f37021',
      Icon: Hourglass,
    },
    {
      label: 'In Progress',
      value: report.inProgress,
      colour: '#006bb6',
      Icon: RefreshCw,
    },
    {
      label: 'Resolved',
      value: report.resolved,
      colour: '#66a300',
      Icon: CheckCircle2,
    },
    {
      label: 'Reviewed & Closed',
      value: report.closed,
      colour: '#263238',
      Icon: CheckCheck,
    },
    {
      label: 'Overdue',
      value: report.overdue,
      colour: '#c62828',
      Icon: AlertTriangle,
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
                <div
                  key={card.label}
                  style={{
                    ...cardStyle,
                    ...(card.label === 'Overdue'
                      ? {
                          border: '2px solid #c62828',
                          background: '#fff7f7',
                        }
                      : {}),
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color:
                        card.label === 'Overdue'
                          ? '#c62828'
                          : '#626b7d',
                      fontSize: 15,
                      fontWeight:
                        card.label === 'Overdue' ? 700 : 400,
                    }}
                  >
                    <card.Icon size={16} color={card.colour} aria-hidden="true" />
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

                <ChartFrame visible={report.total > 0}>
                  <PieChart>
                    <Pie
                      data={report.categories}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                    >
                      {report.categories.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={
                            CATEGORY_COLOURS[
                              index % CATEGORY_COLOURS.length
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ChartFrame>
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

                <ChartFrame visible={report.total > 0}>
                  <BarChart data={report.priorities}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {report.priorities.map((item) => (
                        <Cell
                          key={item.name}
                          fill={
                            PRIORITY_COLOURS[item.name] ||
                            '#2a78d6'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartFrame>
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

                <ChartFrame visible={report.total > 0}>
                  <PieChart>
                    <Pie
                      data={report.assignments}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                    >
                      {report.assignments.map((item) => (
                        <Cell
                          key={item.name}
                          fill={
                            ASSIGNMENT_COLOURS[item.name]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ChartFrame>
              </div>

              <div style={cardStyle}>
                <h2
                  style={{
                    color: '#005a9c',
                    marginTop: 0,
                  }}
                >
                  Tickets by organization
                </h2>

                <ChartFrame visible={report.total > 0}>
                  <BarChart
                    data={report.organizations}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill="#005a9c"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ChartFrame>
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
                        <th style={{ padding: 12 }}>Organization</th>
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
                          <td
                            style={{
                              padding: 12,
                              maxWidth: 220,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={ticket.title}
                          >
                            {ticket.title}
                          </td>
                          <td
                            style={{
                              padding: 12,
                              color: isTicketOverdue(ticket)
                                ? '#c62828'
                                : '#121826',
                              fontWeight: isTicketOverdue(ticket)
                                ? 700
                                : 400,
                            }}
                          >
                            {ticket.status}
                            {isTicketOverdue(ticket)
                              ? ' • Overdue'
                              : ''}
                          </td>
                          <td style={{ padding: 12 }}>
                            {ticket.priority}
                          </td>
                          <td style={{ padding: 12 }}>
                            {ticket.category}
                          </td>
                          <td style={{ padding: 12 }}>
                            {ticket.organization}
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

function ChartFrame({ visible, children }) {
  if (!visible) return null;

  return (
    <div style={{ width: '100%', height: 220, marginBottom: 8 }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}

function isTicketOverdue(ticket) {
  if (!ticket.dueAt) return false;

  const completed =
    ticket.status === 'Resolved' || ticket.status === 'Closed';

  return !completed && new Date(ticket.dueAt) < new Date();
}
