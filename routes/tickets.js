const express = require("express");
const router = express.Router();

const { readData, writeData } = require("../db");
const analyzeTicket = require("../services/ai");

// Create a new ticket
router.post("/", async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: "title and description are required" });
  }

  // Ask the AI to analyze the ticket
  const aiResult = await analyzeTicket(description);

  const data = readData();

  const newTicket = {
    id: Date.now(),
    title,
    description,
    status: "New",
    aiSuggestion: aiResult,
    createdAt: new Date().toISOString(),
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

module.exports = router;