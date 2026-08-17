const fs = require("fs");
const path = require("path");

const KB_FILE = path.join(__dirname, "..", "kb.json");

function loadArticles() {
  const raw = fs.readFileSync(KB_FILE, "utf-8");
  return JSON.parse(raw);
}

// Simple keyword scoring - counts how many words from the search overlap
// with the article's title, content, and tags.
function searchArticles(query) {
  const articles = loadArticles();
  const q = query.toLowerCase();

  const scored = articles.map((article) => {
    const haystack = `${article.title} ${article.content} ${(article.tags || []).join(" ")}`.toLowerCase();
    const score = q
      .split(/\s+/)
      .filter((word) => word.length > 2 && haystack.includes(word)).length;
    return { article, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.article);
}

module.exports = { loadArticles, searchArticles };