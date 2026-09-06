import { useEffect, useState } from "react";
import { ArrowRight, Bot, Flag, Search, SlidersHorizontal } from "lucide-react";

const STATUS_LABELS = {
  Open: "Open",
  "In Progress": "In Progress",
  Resolved: "Resolved - Awaiting Review",
  Closed: "Reviewed and Closed",
};

const STATUS_COLORS = {
  Open: "#f37021",
  "In Progress": "#006bb6",
  Resolved: "#66a300",
  Closed: "#263238",
};

const PRIORITY_COLORS = {
  Critical: "#c62828",
  High: "#f37021",
  Medium: "#d9a404",
  Low: "#006bb6",
  Trivial: "#7b8794",
};

const ORGANIZATIONS = ["Future Skills", "OP"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITIES = ["Critical", "High", "Medium", "Low", "Trivial"];

const fieldStyle = {
  width: "100%",
  minHeight: 42,
  padding: "9px 11px",
  color: "#10142b",
  background: "#ffffff",
  border: "1px solid #cfd8e1",
  borderRadius: 7,
  font: "inherit",
};

export default function TicketsPage({
  user,
  onNewTicket,
  onSelectTicket,
  onManageUsers,
  onAiAssistant,
}) {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [agentFilter, setAgentFilter] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");

  const isCustomer = user?.role === "customer";
  const isAgent = user?.role === "agent";
  const isAdmin = user?.role === "admin";
  const isStaff = isAgent || isAdmin;

  const pageTitle = isAdmin
    ? "All Tickets"
    : isAgent
      ? "Support Queue"
      : "My Tickets";

  const pageDescription = isAdmin
    ? "Search, filter, assign and manage all support tickets."
    : isAgent
      ? "Search assigned and available support requests."
      : "Search and review all your support requests.";

  useEffect(() => {
    if (!isAdmin) return;

    const token = localStorage.getItem("token");

    fetch("http://localhost:4000/users?role=agent", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load agents.");
        }

        return data;
      })
      .then((data) => setAgents(data.users || []))
      .catch(() => setAgents([]));
  }, [isAdmin]);

  useEffect(() => {
    loadTickets();
  }, [overdueOnly, agentFilter, organizationFilter]);

  async function loadTickets() {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();

    params.set("limit", "100");

    if (agentFilter && isAdmin) {
      params.set("assigneeId", agentFilter);
    }

    if (organizationFilter && isStaff) {
      params.set("organization", organizationFilter);
    }

    const url =
      overdueOnly && isStaff
        ? "http://localhost:4000/tickets/overdue"
        : `http://localhost:4000/tickets?${params.toString()}`;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load tickets.");
      }

      let rows = data.tickets || [];

      if (overdueOnly && agentFilter && isAdmin) {
        rows = rows.filter(
          (ticket) => String(ticket.assigneeId) === String(agentFilter),
        );
      }

      if (overdueOnly && organizationFilter && isStaff) {
        rows = rows.filter(
          (ticket) => ticket.organization === organizationFilter,
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
    if (ticket.assignee?.name) return ticket.assignee.name;
    if (!ticket.assigneeId) return "Unassigned";

    const matchingAgent = agents.find(
      (agent) => Number(agent.id) === Number(ticket.assigneeId),
    );

    return matchingAgent ? matchingAgent.name : `Agent #${ticket.assigneeId}`;
  }

  function clearFilters() {
    setSearchText("");
    setStatusFilter("");
    setPriorityFilter("");
    setCategoryFilter("");
    setOverdueOnly(false);
    setAgentFilter("");
    setOrganizationFilter("");
  }

  const categories = [
    ...new Set(tickets.map((ticket) => ticket.category).filter(Boolean)),
  ].sort();

  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleTickets = tickets.filter((ticket) => {
    const searchableText = [
      `TK-${ticket.id}`,
      ticket.title,
      ticket.status,
      ticket.priority,
      ticket.category,
      ticket.organization,
      ticket.assignee?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!normalizedSearch || searchableText.includes(normalizedSearch)) &&
      (!statusFilter || ticket.status === statusFilter) &&
      (!priorityFilter || ticket.priority === priorityFilter) &&
      (!categoryFilter || ticket.category === categoryFilter)
    );
  });

  const filtersActive = Boolean(
    searchText ||
    statusFilter ||
    priorityFilter ||
    categoryFilter ||
    overdueOnly ||
    agentFilter ||
    organizationFilter,
  );

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1120,
        margin: "40px auto",
        padding: "0 22px 50px",
      }}
    >
      <section
        style={{
          padding: 28,
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(16, 20, 43, 0.14)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 5px",
                color: "#f37021",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Ticket management
            </p>
            <h1 style={{ margin: 0, color: "#005a9c", fontSize: 36 }}>
              {pageTitle}
            </h1>
            <p style={{ margin: "5px 0 0", color: "#656a7d" }}>
              {pageDescription}
            </p>
            <small style={{ display: "block", marginTop: 4, color: "#7b8794" }}>
              Logged in as {user?.name || "User"} ({user?.role || "customer"})
            </small>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {isCustomer && onAiAssistant && (
              <button
                type="button"
                onClick={onAiAssistant}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 16px",
                  color: "#173500",
                  background: "#a8d500",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Bot size={17} aria-hidden="true" /> Ask AI
              </button>
            )}

            {isCustomer && onNewTicket && (
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto" }}
                onClick={onNewTicket}
              >
                + New Ticket
              </button>
            )}

            {isAdmin && onManageUsers && (
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto" }}
                onClick={onManageUsers}
              >
                Manage Users
              </button>
            )}
          </div>
        </header>

        <section
          aria-label="Ticket filters"
          style={{
            padding: 16,
            marginBottom: 18,
            background: "#f7f9fb",
            border: "1px solid #e1e7ec",
            borderRadius: 9,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              color: "#10142b",
              fontWeight: 800,
            }}
          >
            <SlidersHorizontal size={18} color="#005a9c" />
            Search and filter tickets
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 2fr) repeat(3, minmax(145px, 1fr))",
              gap: 10,
            }}
          >
            <label style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 11,
                  top: 11,
                  color: "#7b8794",
                }}
              >
                <Search size={18} aria-hidden="true" />
              </span>
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search ID or title"
                aria-label="Search tickets"
                style={{ ...fieldStyle, paddingLeft: 38 }}
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              style={fieldStyle}
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label="Filter by priority"
              style={fieldStyle}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
              style={fieldStyle}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {isStaff && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                marginTop: 12,
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(event) => setOverdueOnly(event.target.checked)}
                />
                Show overdue only
              </label>

              {isAdmin && (
                <label style={{ fontSize: 14 }}>
                  Assigned agent:{" "}
                  <select
                    value={agentFilter}
                    onChange={(event) => setAgentFilter(event.target.value)}
                    style={{ ...fieldStyle, width: "auto", minHeight: 36 }}
                  >
                    <option value="">All agents</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ fontSize: 14 }}>
                Organization:{" "}
                <select
                  value={organizationFilter}
                  onChange={(event) =>
                    setOrganizationFilter(event.target.value)
                  }
                  style={{ ...fieldStyle, width: "auto", minHeight: 36 }}
                >
                  <option value="">Both organisations</option>
                  {ORGANIZATIONS.map((organization) => (
                    <option key={organization} value={organization}>
                      {organization}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginTop: 12,
            }}
          >
            <small style={{ color: "#656a7d" }}>
              Showing {visibleTickets.length} of {tickets.length} tickets
            </small>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  padding: 0,
                  color: "#005a9c",
                  background: "transparent",
                  border: 0,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </section>

        {loading && <p>Loading tickets…</p>}
        {error && <div className="error-text">{error}</div>}

        {!loading && !error && visibleTickets.length === 0 && (
          <div
            style={{
              padding: 30,
              color: "#656a7d",
              background: "#f7f9fb",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            {tickets.length === 0
              ? "No tickets are currently available."
              : "No tickets match the selected filters."}
          </div>
        )}

        {!loading && !error && visibleTickets.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: isStaff ? 930 : 760,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    color: "#10142b",
                    background: "#eef5fa",
                    textAlign: "left",
                    borderBottom: "2px solid #cfd8e1",
                  }}
                >
                  <th style={{ padding: 12 }}>ID</th>
                  <th style={{ padding: 12 }}>Title</th>
                  <th style={{ padding: 12 }}>Status</th>
                  <th style={{ padding: 12 }}>Priority</th>
                  <th style={{ padding: 12 }}>Category</th>
                  {isStaff && <th style={{ padding: 12 }}>Organization</th>}
                  {isStaff && <th style={{ padding: 12 }}>Assignee</th>}
                  <th style={{ padding: 12 }}>View</th>
                </tr>
              </thead>

              <tbody>
                {visibleTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    tabIndex={0}
                    onClick={() => onSelectTicket(ticket.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        onSelectTicket(ticket.id);
                      }
                    }}
                    style={{
                      borderBottom: "1px solid #e5e9ed",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: 12, fontWeight: 700 }}>
                      TK-{ticket.id}
                    </td>
                    <td
                      title={ticket.title}
                      style={{
                        padding: 12,
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ticket.title}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 9,
                            height: 9,
                            flexShrink: 0,
                            borderRadius: "50%",
                            background:
                              STATUS_COLORS[ticket.status] || "#7b8794",
                          }}
                        />
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Flag
                          size={14}
                          color={PRIORITY_COLORS[ticket.priority] || "#7b8794"}
                          fill={PRIORITY_COLORS[ticket.priority] || "#7b8794"}
                          aria-hidden="true"
                        />
                        {ticket.priority}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>{ticket.category}</td>
                    {isStaff && (
                      <td style={{ padding: 12 }}>{ticket.organization}</td>
                    )}
                    {isStaff && (
                      <td style={{ padding: 12 }}>{assigneeLabel(ticket)}</td>
                    )}
                    <td style={{ padding: 12 }}>
                      <ArrowRight
                        size={17}
                        color="#005a9c"
                        aria-hidden="true"
                      />
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
