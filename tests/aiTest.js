require("dotenv").config();

const analyzeTicket = require("../services/ai");

async function testAI() {
    const result = await analyzeTicket(
        "My laptop is not connecting to WiFi and I cannot access the internet."
    );

    console.log(result);
}

testAI();