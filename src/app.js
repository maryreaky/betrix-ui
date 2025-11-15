const express = require("express");
const app = express();
app.use(express.json({ limit: "100kb" }));

// Basic in-memory queue for immediate-ack + background processing
const queue = [];
let workerRunning = false;
const MAX_QUEUE = 1000;
const PROCESS_BATCH = 5;

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

// Minimal immediate-ack webhook with light rate-limiting
app.post("/telegram", (req, res) => {
  try {
    if (!req.body) {
      res.status(400).send("bad request");
      return;
    }
    // Light rate-limit: reject when queue too large
    if (queue.length >= MAX_QUEUE) {
      console.warn("queue full, rejecting update");
      res.status(429).send("too many requests");
      return;
    }

    // Enqueue update and ack immediately
    queue.push({ receivedAt: Date.now(), payload: req.body });
    res.status(200).send("ok");

    // Kick off background worker if not running
    if (!workerRunning) {
      workerRunning = true;
      setImmediate(processQueue);
    }
  } catch (err) {
    console.error("webhook handler error:", err);
    try { res.status(500).send("error"); } catch {}
  }
});

// Background processor (non-blocking, resilient)
async function processQueue() {
  while (queue.length > 0) {
    const batch = [];
    for (let i = 0; i < PROCESS_BATCH && queue.length > 0; i++) {
      batch.push(queue.shift());
    }
    // Process batch in parallel but guarded
    await Promise.all(batch.map(async item => {
      try {
        // Replace this block with your real processing logic
        // Keep it async and non-blocking (no heavy sync work)
        // Example placeholder:
        await handleUpdate(item.payload);
      } catch (err) {
        console.error("processing error:", err);
      }
    }));
    // Yield back to event loop briefly to let the server accept requests
    await new Promise(r => setTimeout(r, 10));
    console.log("queue length:", queue.length);
  }
  workerRunning = false;
}

// Placeholder async update handler — adapt to your real logic
async function handleUpdate(update) {
  // Example: quick validation + simulated async work
  if (update && update.message && update.message.text) {
    // simulate a small async task (e.g., DB write or API call)
    await new Promise(r => setTimeout(r, 50));
    console.log("processed message:", (update.message.text || "").slice(0, 80));
    return;
  }
  // Non-message updates are logged and skipped
  console.log("processed non-message update");
}
module.exports = app;
