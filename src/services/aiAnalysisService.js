const { GoogleGenerativeAI } = require('@google/generative-ai');
const ticketPrompt = require('../prompts/ticketPrompt');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const VALID_CATEGORIES = ['Hardware', 'Software', 'Network', 'Account', 'Other'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// A realistic fallback used only when the AI quota is exhausted, so
// development isn't blocked by Gemini's free-tier daily limit.
function mockResponse(description) {
  return `Category: General\nPriority: Medium\nSuggested Response: (AI quota reached - this is a placeholder response for "${description.slice(0, 50)}...")`;
}

async function generateAnalysis(description) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      systemInstruction: ticketPrompt,
    });

    const result = await model.generateContent(description);
    return result.response.text();
  } catch (err) {
    if (err.status === 429) {
      return mockResponse(description);
    }
    throw err; // any other kind of error should still show up normally
  }
}

function parseAnalysis(text) {
  const categoryMatch = text.match(/Category:\s*(.+)/i);
  const priorityMatch = text.match(/Priority:\s*(.+)/i);
  const responseMatch = text.match(/Suggested Response:\s*([\s\S]+)/i);

  const category = categoryMatch ? categoryMatch[1].trim() : null;
  const priority = priorityMatch ? priorityMatch[1].trim() : null;

  return {
    category: VALID_CATEGORIES.includes(category) ? category : 'Other',
    priority: VALID_PRIORITIES.includes(priority) ? priority : 'Medium',
    suggestedResponse: responseMatch ? responseMatch[1].trim() : text.trim(),
  };
}

async function analyzeTicket(description) {
  const raw = await generateAnalysis(description);
  return parseAnalysis(raw);
}

module.exports = { analyzeTicket };
