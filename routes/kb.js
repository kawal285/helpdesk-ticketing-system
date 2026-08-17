const express = require("express");
const router = express.Router();
const { loadArticles, searchArticles } = require("../services/kb");

// List every article
router.get("/", (req, res) => {
  res.json(loadArticles());
});

// Search: GET /kb/search?q=printer
router.get("/search", (req, res) => {
  const query = req.query.q || "";
  if (!query.trim()) {
    return res.status(400).json({ error: "A search query (?q=) is required" });
  }
  res.json(searchArticles(query));
});

module.exports = router;