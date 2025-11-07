const fetch = globalThis.fetch || require("node-fetch");

const callRapidLlama = async (prompt) => {
  const key = process.env.RAPID_API_KEY;
  if (!key) return { ok: false, error: "RAPID_API_KEY missing" };
  const res = await fetch("https://open-ai21.p.rapidapi.com/conversationllama", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": "open-ai21.p.rapidapi.com",
      "x-rapidapi-key": key,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      web_access: false,
    }),
  });
  const json = await res.json().catch(() => ({}));
  const reply = json?.result || json?.text || (json?.choices && json.choices[0]?.message?.content) || JSON.stringify(json);
  return { ok: true, text: String(reply) };
};

const ask = async (prompt) => {
  try {
    return await callRapidLlama(prompt);
  } catch (err) {
    return { ok: false, error: 'RapidAPI failed: ' + (err && err.message ? err.message : String(err)) };
  }
};

module.exports = { ask };
