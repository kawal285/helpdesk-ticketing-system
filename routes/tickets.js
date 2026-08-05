const express = require("express");
const router = express.Router();

const { readData, writeData } = require("../db");
const analyzeTicket = require("../services/ai");

// SLA targets by priority (in hours) - matches the Warning Time / Failure
// Time columns seen in the client's Dynamics CRM case list
const SLA_HOURS = {
  Critical: { warning: 2, failure: 4 },
  High: { warning: 12, failure: 24 },
  Medium: { warning: 48, failure: 72 },
  Low: { warning: 96, failure: 120 },
};

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

// Create a new ticket
router.post("/", async (req, res) => {
  const { title, description, category, customer, priority } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: "title and description are required" });
  }

  // Ask the AI to analyze the ticket (category, priority, suggested response)
  const aiResult = await analyzeTicket(description);

  // Pull the category/priority the AI suggested out of its text response
  const categoryMatch = aiResult.match(/Category:\s*(.+)/i);
  const priorityMatch = aiResult.match(/Priority:\s*(.+)/i);
  const aiCategory = categoryMatch ? categoryMatch[1].trim() : "General";
  const aiPriority = priorityMatch ? priorityMatch[1].trim() : "Medium";

  const finalPriority = priority || aiPriority; // human can override the AI's guess
  const sla = SLA_HOURS[finalPriority] || SLA_HOURS.Medium;
  const now = new Date();

  const data = readData();

  const newTicket = {
    id: Date.now(),
    title,
    description,
    category: category || aiCategory,     // human can override the AI's guess
    subcategory: "",                       // filled in later by an agent if needed
    customer: customer || "Unknown",
    owner: null,                           // unassigned until an agent picks it up
    status: "New",
    priority: finalPriority,
    slaWarningAt: addHours(now, sla.warning),
    slaFailureAt: addHours(now, sla.failure),
    aiSuggestion: aiResult,
    timeline: [
      { note: "Ticket created", at: now.toISOString() },
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  data.tickets.push(newTicket);
  writeData(data);

  res.status(201).json(newTicket);
});

// List all tickets
router.get("/", (req, res) => {
  const data = readData();
  res.json(data.tickets);
});

// Get a single ticket by id
router.get("/:id", (req, res) => {
  const data = readData();
  const ticket = data.tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json(ticket);
});

// Update a ticket (assign an owner, change status, add a timeline note)
router.patch("/:id", (req, res) => {
  const { status, owner, note } = req.body;
  const data = readData();
  const ticket = data.tickets.find((t) => t.id === Number(req.params.id));

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  if (status) ticket.status = status;
  if (owner) ticket.owner = owner;
  if (note) ticket.timeline.push({ note, at: new Date().toISOString() });

  ticket.updatedAt = new Date().toISOString();
  writeData(data);

  res.json(ticket);
});

module.exports = router;