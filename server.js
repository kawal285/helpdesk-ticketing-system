const express = require("express");
const app = express();

// Lets the server read JSON sent in POST/PATCH request bodies.
// Without this, req.body would be undefined and every POST below would break.
app.use(express.json());

app.get("/", (req, res) => {
  res.send("HelpDesk backend is running!");
});

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

