WEBHOOK & WORKER setup
- Required env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, REDIS_URL, OPENAI_API_KEY
- Deploy worker: run `npm run start:worker` as a background service (Render background worker or separate service).
- After deploy, set Telegram webhook to: https://<your-app>/telegram/<YOUR_SECRET>
