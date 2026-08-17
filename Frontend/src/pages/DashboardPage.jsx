import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  Open: 'Open',
  'In Progress': 'In Progress',
  Resolved: 'Resolved – Awaiting Review',
  Closed: 'Reviewed and Closed',
};

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
  const [agents, setAgents] = useState([]);

  const isCustomer = user.role === 'customer';
  const isAgent = user.role === 'agent';
  const isAdmin = user.role === 'admin';
  const isStaff = isAgent || isAdmin;

  const pageTitle = isAdmin
    ? 'All Tickets'
    : isAgent
      ? 'Support Queue'
      : 'My Tickets';

  const pageDescription = isAdmin
    ? 'Monitor, assign and manage all support tickets.'
    : isAgent
      ? 'View assigned and available support tickets.'
      : 'Create and track your support requests.';

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

  useEffect(() => {
    loadTickets();
  }, [overdueOnly, agentFilter]);

  async function loadTickets() {
    const token = localStorage.getItem('token');

    let url = 'http://localhost:4000/tickets';

    if (overdueOnly && isStaff) {
      url = 'http://localhost:4000/tickets/overdue';
    } else if (agentFilter && isAdmin) {
      url = `http://localhost:4000/tickets?assigneeId=${agentFilter}`;
    }

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

      let rows = data.tickets || [];

      // The overdue endpoint currently does not apply the admin
      // agent filter, so apply it safely in the frontend.
      if (overdueOnly && agentFilter && isAdmin) {
        rows = rows.filter(
          (ticket) =>
            String(ticket.assigneeId) ===
            String(agentFilter)
        );
      }

      setTickets(rows);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

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
              Logged in as {user.name} ({user.role})
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
          </div>
        )}

        {loading && <p>Loading tickets…</p>}

        {error && (
          <div className="error-text">{error}</div>
        )}

        {!loading && !error && tickets.length === 0 && (
          <div
            style={{
              padding: 24,
              color: '#656a7d',
              background: '#f7f9fb',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            {isCustomer
              ? 'You have not created any tickets yet.'
              : 'No tickets are currently available.'}
          </div>
        )}

        {!loading && !error && tickets.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: 720,
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
                  <th style={{ padding: 11 }}>Category</th>

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

                    <td style={{ padding: 11 }}>
                      {ticket.title}
                    </td>

                    <td style={{ padding: 11 }}>
                      {STATUS_LABELS[ticket.status] ||
                        ticket.status}
                    </td>

                    <td style={{ padding: 11 }}>
                      {ticket.priority}
                    </td>

                    <td style={{ padding: 11 }}>
                      {ticket.category}
                    </td>

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