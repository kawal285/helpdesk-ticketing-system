const express = require("express");
const app = express();

// Lets the server read JSON sent in POST/PATCH request bodies.
// Without this, req.body would be undefined and every POST below would break.
app.use(express.json());

app.get("/", (req, res) => {
  res.send("HelpDesk backend is running!");
});

// ---- Knowledge base routes ----
const kbRoutes = require("./routes/kb");
app.use("/kb", kbRoutes);

// ---- In-memory ticket storage ----
// Just a plain array for now. Fine while you're building and testing --
// a real database can replace this later without changing the routes below.
let tickets = [];
let nextId = 1;

// SLA response targets in hours, by priority.
const SLA_HOURS = { Critical: 4, High: 8, Medium: 24, Low: 72 };

function computeDueAt(priority, createdAt) {
  const hours = SLA_HOURS[priority] || 24;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

// Create a ticket
app.post("/tickets", (req, res) => {
  const { title, description, requester, priority, category, assignee } = req.body;
  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  const createdAt = new Date();
  const ticket = {
    id: nextId++,
    title,
    description: description || "",
    requester: requester || "Unknown",
    category: category || "Other",
    priority: priority || "Medium",
    status: "Open",
    assignee: assignee || "Unassigned",
    createdAt,
    dueAt: computeDueAt(priority || "Medium", createdAt),
    comments: [],
  };
  tickets.push(ticket);
  res.status(201).json(ticket);
});

// List tickets (optionally filter by status/priority/category/assignee)
app.get("/tickets", (req, res) => {
  let result = tickets;
  const { status, priority, category, assignee } = req.query;
  if (status) result = result.filter((t) => t.status === status);
  if (priority) result = result.filter((t) => t.priority === priority);
  if (category) result = result.filter((t) => t.category === category);
  if (assignee) result = result.filter((t) => t.assignee === assignee);
  res.json(result);
});

// Overdue tickets -- MUST be declared before /tickets/:id below, or Express
// will try to treat "overdue" as an :id and this route will never be reached.
app.get("/tickets/overdue", (req, res) => {
  const now = new Date();
  const overdue = tickets.filter(
    (t) => t.dueAt < now && t.status !== "Resolved" && t.status !== "Closed"
  );
  res.json(overdue);
});

// Get a single ticket
app.get("/tickets/:id", (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json(ticket);
});

// Update a ticket (status, priority, assignee, category)
app.patch("/tickets/:id", (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  const { status, priority, category, assignee } = req.body;
  if (status) ticket.status = status;
  if (category) ticket.category = category;
  if (assignee) ticket.assignee = assignee;
  if (priority) {
    ticket.priority = priority;
    ticket.dueAt = computeDueAt(priority, ticket.createdAt); // deadline moves with priority
  }
  res.json(ticket);
});

// Add a comment to a ticket
app.post("/tickets/:id/comments", (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  const { author, text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  const comment = { author: author || "Unknown", text, createdAt: new Date() };
  ticket.comments.push(comment);
  res.status(201).json(comment);
});

// List comments on a ticket
app.get("/tickets/:id/comments", (req, res) => {
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json(ticket.comments);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});