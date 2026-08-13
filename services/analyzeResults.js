const fs = require("fs");

const data = JSON.parse(fs.readFileSync("./accuracyResults.json", "utf-8"));

const matrix = {};
data.results.forEach((r) => {
  const key = `${r.expected} → ${r.predicted}`;
  matrix[key] = (matrix[key] || 0) + 1;
});

console.log("=== Confusion Matrix ===");
Object.entries(matrix)
  .sort((a, b) => b[1] - a[1])
  .forEach(([pair, count]) => console.log(`${pair}: ${count}`));

const byCategory = {};
data.results.forEach((r) => {
  if (!byCategory[r.expected]) byCategory[r.expected] = { correct: 0, total: 0 };
  byCategory[r.expected].total++;
  if (r.correct) byCategory[r.expected].correct++;
});

console.log("\n=== Accuracy by Category ===");
Object.entries(byCategory).forEach(([cat, { correct, total }]) => {
  console.log(`${cat}: ${correct}/${total} (${((correct / total) * 100).toFixed(1)}%)`);
});