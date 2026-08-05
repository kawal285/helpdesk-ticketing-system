require("dotenv").config();
const fs = require("fs");
const analyzeTicket = require("./services/ai");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCategory(aiText) {
  const match = aiText.match(/Category:\s*(.+)/i);
  return match ? match[1].trim() : "UNKNOWN";
}

async function analyzeWithRetry(description, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await analyzeTicket(description);
    } catch (err) {
      console.log(`  (attempt ${attempt} failed: ${err.status || err.message} - waiting longer...)`);
      await wait(attempt * 10000); // wait 10s, 20s, 30s, 40s - respects free-tier limits
    }
  }
  return "Category: UNKNOWN\nPriority: UNKNOWN\nSuggested Response: (failed after retries)";
}

async function runAccuracyTest() {
  const testTickets = JSON.parse(fs.readFileSync("./testTickets.json", "utf-8"));

  let correct = 0;
  const results = [];

  for (const ticket of testTickets) {
    const aiResponse = await analyzeWithRetry(ticket.description);
    const predictedCategory = extractCategory(aiResponse);
    const isCorrect = predictedCategory.toLowerCase() === ticket.expectedCategory.toLowerCase();

    if (isCorrect) correct++;

    results.push({
      id: ticket.id,
      description: ticket.description,
      expected: ticket.expectedCategory,
      predicted: predictedCategory,
      correct: isCorrect,
    });

    console.log(
      `#${ticket.id} | Expected: ${ticket.expectedCategory} | Got: ${predictedCategory} | ${isCorrect ? "✅" : "❌"}`
    );

    await wait(5000); // 5 seconds between each request - stays safely under free-tier rate limits
  }

  const accuracy = ((correct / testTickets.length) * 100).toFixed(1);
  console.log(`\n=== RESULT: ${correct}/${testTickets.length} correct (${accuracy}% accuracy) ===`);

  fs.writeFileSync(
    "./accuracyResults.json",
    JSON.stringify({ accuracy: `${accuracy}%`, correct, total: testTickets.length, results }, null, 2)
  );
}

runAccuracyTest();