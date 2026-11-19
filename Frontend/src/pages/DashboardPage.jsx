
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  Flag,
} from 'lucide-react';
import SlaSummaryBadge from '../components/SlaSummaryBadge';
import { priorityLabel } from '../utils/priority';


// Shared status labels keep customer and staff views consistent.
const STATUS_LABELS = {
  Open: 'Open',
  'In Progress': 'In Progress',
  Resolved: 'Resolved – Awaiting Review',
  Closed: 'Reviewed and Closed',
};

// Matches the colours the admin Report page's summary cards already use
// for the same statuses, so the two views read as one system.
const STATUS_COLORS = {
  Open: '#f37021',
  'In Progress': '#006bb6',
  Resolved: '#66a300',
  Closed: '#263238',
};

const PRIORITY_COLORS = {
  Critical: '#c62828',
  High: '#f37021',
  Medium: '#d9a404',
  Low: '#006bb6',
  Trivial: '#7b8794',
};

const ORGANIZATIONS = ['Future Skills', 'OP'];

export default function DashboardPage({
  user,
  onNewTicket,
  onSelectTicket,
  onManageUsers,
  onAiAssistant,
}) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [agentFilter, setAgentFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [agents, setAgents] = useState([]);

  const isCustomer = user?.role === 'customer';
  const isAgent = user?.role === 'agent';
  const isAdmin = user?.role === 'admin';
  const isStaff = isAgent || isAdmin;

  const storedName = user?.name?.trim() || 'User';
  const displayName =
    storedName.charAt(0).toUpperCase() + storedName.slice(1);

  const pageTitle = isAdmin
    ? 'All Tickets'
    : isAgent
      ? 'Support Queue'
      : `Welcome back, ${displayName}`;

  const pageDescription = isAdmin
    ? 'Monitor, assign and manage all support tickets.'
    : isAgent
      ? 'View assigned and available support tickets.'
      : 'Here is an overview of your support requests.';

  useEffect(() => {
    if (!isAdmin) return;

    const token = localStorage.getItem('token');

    fetch('http://localhost:4000/users?role=agent', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Could not load agents.'
          );
        }

        return data;
      })
      .then((data) => setAgents(data.users || []))
      .catch(() => setAgents([]));
  }, [isAdmin]);

  const loadTickets = useCallback(async () => {
    const token = localStorage.getItem('token');

    const params = new URLSearchParams();

    if (agentFilter && isAdmin) {
      params.set('assigneeId', agentFilter);
    }

    if (organizationFilter && isStaff) {
      params.set('organization', organizationFilter);
    }

    const queryString = params.toString();

    // Both endpoints apply the agent/organization filters on the server.
    const base =
      overdueOnly && isStaff
        ? 'http://localhost:4000/tickets/overdue'
        : 'http://localhost:4000/tickets';
    const url = `${base}${queryString ? `?${queryString}` : ''}`;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not load tickets.'
        );
      }

      setTickets(data.tickets || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [overdueOnly, agentFilter, organizationFilter, isAdmin, isStaff]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  function assigneeLabel(ticket) {
    if (ticket.assignee?.name) {
      return ticket.assignee.name;
    }

    if (!ticket.assigneeId) {
      return 'Unassigned';
    }

    const matchingAgent = agents.find(
      (agent) =>
        Number(agent.id) === Number(ticket.assigneeId)
    );

    return matchingAgent
      ? matchingAgent.name
      : `Agent #${ticket.assigneeId}`;
  }

  const customerCounts = {
    Open: tickets.filter((ticket) => ticket.status === 'Open').length,
    'In Progress': tickets.filter(
      (ticket) => ticket.status === 'In Progress'
    ).length,
    Resolved: tickets.filter(
      (ticket) => ticket.status === 'Resolved'
    ).length,
    Closed: tickets.filter((ticket) => ticket.status === 'Closed')
      .length,
  };

  const totalCustomerTickets = tickets.length;
  const openEnd = totalCustomerTickets
    ? (customerCounts.Open / totalCustomerTickets) * 100
    : 0;
  const progressEnd = totalCustomerTickets
    ? openEnd +
      (customerCounts['In Progress'] / totalCustomerTickets) * 100
    : 0;
  const resolvedEnd = totalCustomerTickets
    ? progressEnd +
      (customerCounts.Resolved / totalCustomerTickets) * 100
    : 0;

  const chartBackground = totalCustomerTickets
    ? `conic-gradient(
        ${STATUS_COLORS.Open} 0 ${openEnd}%,
        ${STATUS_COLORS['In Progress']} ${openEnd}% ${progressEnd}%,
        ${STATUS_COLORS.Resolved} ${progressEnd}% ${resolvedEnd}%,
        ${STATUS_COLORS.Closed} ${resolvedEnd}% 100%
      )`
    : '#e5e9ed';

  const customerSummaryCards = [
    {
      label: 'Open',
      value: customerCounts.Open,
      color: STATUS_COLORS.Open,
      background: '#fff5ee',
      icon: CircleDot,
    },
    {
      label: 'In Progress',
      value: customerCounts['In Progress'],
      color: STATUS_COLORS['In Progress'],
      background: '#eef7fd',
      icon: Clock3,
    },
    {
      label: 'Awaiting Review',
      value: customerCounts.Resolved,
      color: STATUS_COLORS.Resolved,
      background: '#f4fae9',
      icon: CheckCircle2,
    },
    {
      label: 'Closed',
      value: customerCounts.Closed,
      color: STATUS_COLORS.Closed,
      background: '#f1f3f4',
      icon: CheckCircle2,
    },
  ];

  const recentCustomerTickets = [...tickets]
    .sort(
      (first, second) =>
        new Date(second.updatedAt || second.createdAt || 0) -
        new Date(first.updatedAt || first.createdAt || 0)
    )
    .slice(0, 3);

  const helpTopics = [
    'Password and sign-in help',
    'Wi-Fi and network problems',
    'Printer troubleshooting',
  ];

  function formatTicketDate(ticket) {
    const value = ticket.updatedAt || ticket.createdAt;

    if (!value) return 'Recently updated';

    return `Updated ${new Date(value).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  return (
    <main
      style={{
        width: '100%',
        maxWidth: 1050,
        margin: '40px auto',
        padding: '0 22px 50px',
      }}
    >
      <section
        style={{
          padding: 28,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow:
            '0 4px 16px rgba(16, 20, 43, 0.14)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: '#005a9c',
                fontSize: 36,
              }}
            >
              {pageTitle}
            </h1>

            <p
              style={{
                margin: '5px 0 0',
                color: '#656a7d',
              }}
            >
              {pageDescription}
            </p>

            <small
              style={{
                display: 'block',
                marginTop: 4,
                color: '#7b8794',
              }}
            >
              Logged in as {user?.name || 'User'} ({user?.role || 'customer'})
            </small>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {isCustomer && (
              <>
                <button
                  type="button"
                  style={{
                    padding: '10px 16px',
                    color: '#173500',
                    background: '#a8d500',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={onAiAssistant}
                >
                  Ask AI
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: 'auto' }}
                  onClick={onNewTicket}
                >
                  + New Ticket
                </button>
              </>
            )}

            {isAdmin && (
              <button
                type="button"
                className="btn-primary"
                style={{ width: 'auto' }}
                onClick={onManageUsers}
              >
                Manage Users
              </button>
            )}
          </div>
        </header>

        {isStaff && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
              marginBottom: 20,
              padding: 14,
              background: '#f7f9fb',
              borderRadius: 6,
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(event) =>
                  setOverdueOnly(event.target.checked)
                }
              />

              Show overdue only
            </label>

            {isAdmin && (
              <label style={{ fontSize: 14 }}>
                Assigned agent:{' '}

                <select
                  value={agentFilter}
                  onChange={(event) =>
                    setAgentFilter(event.target.value)
                  }
                  style={{
                    padding: '7px 9px',
                    border: '1px solid #d9e1e8',
                    borderRadius: 4,
                  }}
                >
                  <option value="">All agents</option>

                  {agents.map((agent) => (
                    <option
                      key={agent.id}
                      value={agent.id}
                    >
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label style={{ fontSize: 14 }}>
              Organization:{' '}

              <select
                value={organizationFilter}
                onChange={(event) =>
                  setOrganizationFilter(event.target.value)
                }
                style={{
                  padding: '7px 9px',
                  border: '1px solid #d9e1e8',
                  borderRadius: 4,
                }}
              >
                <option value="">
                  Both (Future Skills &amp; OP)
                </option>

                {ORGANIZATIONS.map((organization) => (
                  <option
                    key={organization}
                    value={organization}
                  >
                    {organization}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {loading && <p>Loading tickets…</p>}

        {error && (
          <div className="error-text">{error}</div>
        )}

        {isCustomer && !loading && !error && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 14,
                marginBottom: 22,
              }}
            >
              {customerSummaryCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.label}
                    style={{
                      padding: 18,
                      border: `1px solid ${card.color}33`,
                      borderLeft: `5px solid ${card.color}`,
                      borderRadius: 10,
                      background: card.background,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: '#656a7d',
                            fontSize: 13,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                          }}
                        >
                          {card.label}
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            color: '#10142b',
                            fontSize: 30,
                            fontWeight: 800,
                          }}
                        >
                          {card.value}
                        </div>
                      </div>

                      <Icon
                        size={28}
                        color={card.color}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 18,
                marginBottom: 22,
              }}
            >
              <section
                style={{
                  padding: 20,
                  border: '1px solid #d9e1e8',
                  borderRadius: 10,
                  background: '#ffffff',
                }}
              >
                <h2
                  style={{
                    margin: '0 0 18px',
                    color: '#10142b',
                    fontSize: 20,
                  }}
                >
                  Ticket progress
                </h2>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 28,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    role="img"
                    aria-label={`${totalCustomerTickets} total tickets grouped by status`}
                    style={{
                      position: 'relative',
                      width: 150,
                      height: 150,
                      borderRadius: '50%',
                      background: chartBackground,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 28,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        background: '#ffffff',
                      }}
                    >
                      <strong
                        style={{
                          color: '#10142b',
                          fontSize: 26,
                        }}
                      >
                        {totalCustomerTickets}
                      </strong>
                      <span
                        style={{
                          color: '#7b8794',
                          fontSize: 12,
                        }}
                      >
                        Total tickets
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    {Object.entries(STATUS_LABELS).map(
                      ([status, label]) => (
                        <div
                          key={status}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            color: '#4f5668',
                            fontSize: 13,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: STATUS_COLORS[status],
                            }}
                          />
                          {label}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </section>

              <section
                style={{
                  padding: 20,
                  border: '1px solid #d9e1e8',
                  borderRadius: 10,
                  background: '#ffffff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      color: '#10142b',
                      fontSize: 20,
                    }}
                  >
                    Recent activity
                  </h2>

                  <span
                    style={{
                      color: '#7b8794',
                      fontSize: 12,
                    }}
                  >
                    Latest 3
                  </span>
                </div>

                {recentCustomerTickets.length === 0 ? (
                  <div
                    style={{
                      padding: '26px 12px',
                      color: '#656a7d',
                      textAlign: 'center',
                    }}
                  >
                    You have not created any tickets yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recentCustomerTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => onSelectTicket(ticket.id)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 12,
                          width: '100%',
                          padding: 12,
                          color: '#10142b',
                          background: '#f7f9fb',
                          border: '1px solid #e5e9ed',
                          borderRadius: 8,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={ticket.title}
                          >
                            TK-{ticket.id} · {ticket.title}
                          </strong>
                          <small
                            style={{
                              display: 'block',
                              marginTop: 4,
                              color: '#7b8794',
                            }}
                          >
                            {formatTicketDate(ticket)}
                          </small>
                        </span>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            color: '#4f5668',
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background:
                                STATUS_COLORS[ticket.status] ||
                                '#7b8794',
                            }}
                          />
                          {STATUS_LABELS[ticket.status] ||
                            ticket.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <p
                  style={{
                    margin: '12px 0 0',
                    color: '#7b8794',
                    fontSize: 12,
                    textAlign: 'right',
                  }}
                >
                  Use the Tickets menu to view the complete list.
                </p>
              </section>
            </div>

            <section
              style={{
                padding: 20,
                border: '1px solid #d9e1e8',
                borderRadius: 10,
                background: '#f7f9fb',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  marginBottom: 14,
                }}
              >
                <BookOpen
                  size={21}
                  color="#005a9c"
                  aria-hidden="true"
                />
                <h2
                  style={{
                    margin: 0,
                    color: '#10142b',
                    fontSize: 20,
                  }}
                >
                  Suggested help
                </h2>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: 12,
                }}
              >
                {helpTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={onAiAssistant}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: 14,
                      color: '#005a9c',
                      background: '#ffffff',
                      border: '1px solid #d9e1e8',
                      borderRadius: 8,
                      fontWeight: 700,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 9,
                      }}
                    >
                      <Bot size={18} aria-hidden="true" />
                      {topic}
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {isStaff && !loading && !error && tickets.length === 0 && (
          <div
            style={{
              padding: 24,
              color: '#656a7d',
              background: '#f7f9fb',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            No tickets are currently available.
          </div>
        )}

        {isStaff && !loading && !error && tickets.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <p style={{ margin: '0 0 10px', color: '#5f6878', fontSize: 14 }}>
              {overdueOnly
                ? 'Overdue tickets, the most overdue first.'
                : 'Your queue, most urgent first (P1 to P4), then the nearest deadline.'}
            </p>
            <table
              style={{
                width: '100%',
                minWidth: 820,
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
                  <th style={{ padding: 11 }}>ID</th>
                  <th style={{ padding: 11 }}>Title</th>
                  <th style={{ padding: 11 }}>Status</th>
                  <th style={{ padding: 11 }}>Priority</th>
                  <th style={{ padding: 11 }}>Target (estimate)</th>
                  <th style={{ padding: 11 }}>Category</th>

                  {isStaff && (
                    <th style={{ padding: 11 }}>
                      Organization
                    </th>
                  )}

                  {isStaff && (
                    <th style={{ padding: 11 }}>
                      Assignee
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    tabIndex={0}
                    onClick={() =>
                      onSelectTicket(ticket.id)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' ||
                        event.key === ' '
                      ) {
                        onSelectTicket(ticket.id);
                      }
                    }}
                    style={{
                      borderBottom:
                        '1px solid #e5e9ed',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: 11 }}>
                      TK-{ticket.id}
                    </td>

                    <td
                      style={{
                        padding: 11,
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={ticket.title}
                    >
                      {ticket.title}
                    </td>

                    <td style={{ padding: 11 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            flexShrink: 0,
                            background:
                              STATUS_COLORS[ticket.status] ||
                              '#7b8794',
                          }}
                        />

                        {STATUS_LABELS[ticket.status] ||
                          ticket.status}
                      </span>
                    </td>

                    <td style={{ padding: 11 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Flag
                          size={14}
                          color={
                            PRIORITY_COLORS[ticket.priority] ||
                            '#7b8794'
                          }
                          fill={
                            PRIORITY_COLORS[ticket.priority] ||
                            '#7b8794'
                          }
                          aria-hidden="true"
                        />

                        {priorityLabel(ticket.priority, ticket.priorityLevel)}
                      </span>
                    </td>

                    <td style={{ padding: 11 }}>
                      <SlaSummaryBadge sla={ticket.sla} />
                    </td>

                    <td style={{ padding: 11 }}>
                      {ticket.category}
                    </td>

                    {isStaff && (
                      <td style={{ padding: 11 }}>
                        {ticket.organization}
                      </td>
                    )}

                    {isStaff && (
                      <td style={{ padding: 11 }}>
                        {assigneeLabel(ticket)}
                      </td>
                    )}
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
