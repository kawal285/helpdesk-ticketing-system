const OpenAI = require("openai");
require("dotenv").config();

const ticketPrompt = require("../prompts/ticketPrompt");

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeTicket(issue) {
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: ticketPrompt,
            },
            {
                role: "user",
                content: issue,
            },
        ],
    });

    return response.choices[0].message.content;
}

module.exports = analyzeTicket;