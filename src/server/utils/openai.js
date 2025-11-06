const axios = require("axios");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const ask = async (prompt, system) => {
  const url = "https://api.openai.com/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  };
  const body = {
    model: "gpt-4",
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ]
  };
  const res = await axios.post(url, body, { headers });
  return res.data.choices[0].message.content;
};

exports.askGeneral = async (prompt) =>
  ask(prompt, "You are BETRIX, a friendly sports-tech assistant. Respond with emojis and brand tone.");

exports.askFootball = async (prompt) =>
  ask(prompt, "You are BETRIX, an expert in football odds, fixtures, and match analysis. Respond with stats, emojis, and betting psychology.");
