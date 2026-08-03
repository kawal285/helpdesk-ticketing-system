const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const ticketPrompt = require("../prompts/ticketPrompt");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeTicket(issue) {
    const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        systemInstruction: ticketPrompt,
    });

    const result = await model.generateContent(issue);

    return result.response.text();
}

module.exports = analyzeTicket;