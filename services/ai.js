const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is missing from your .env file. The AI service cannot start without it.");
  process.exit(1);
}

const ticketPrompt = require("../prompts/ticketPrompt");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// A realistic fallback used only when the AI quota is exhausted, so
// development isn't blocked by Gemini's free-tier daily limit.
function mockResponse(issue) {
  return `Category: General\nPriority: Medium\nSuggested Response: (AI quota reached - this is a placeholder response for "${issue.slice(0, 50)}...")`;
}

async function analyzeTicket(issue) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: ticketPrompt,
    });

    const result = await model.generateContent(issue);
    return result.response.text();
  } catch (err) {
    if (err.status === 429) {
      console.log("(Gemini quota reached - using mock response so development can continue)");
      return mockResponse(issue);
    }
    throw err; // any other kind of error should still show up normally
  }
}

module.exports = analyzeTicket;