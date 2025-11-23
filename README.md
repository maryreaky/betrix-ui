# 🌀 BETRIX - Multi-Sport AI Telegram Bot Platform

Production-ready Telegram bot providing AI-powered sports analysis, payment tiers, referral rewards, and leaderboards across 12+ sports.

## 🚀 Features

### Core Capabilities
- **Natural Language AI** - Google Gemini conversational interactions
- **User Signup** - Collects name, age, country for personalization
- **12+ Sports** - Football, Basketball, Tennis, Cricket, F1, MMA, Baseball, Hockey, Golf, Rugby, eSports, Boxing
- **Real-time Updates** - Live scores, schedules, standings, analysis
- **Cryptocurrency** - Real-time prices via Binance
- **Weather** - Location-based forecasts

### Payment & Subscriptions
- **3-Tier Pricing** per sport:
  - Starter: $9.99/mo
  - Pro: $24.99/mo
  - Elite: $59.99/mo
- **All-Access Bundle**: $149.99/mo
- **PayPal Integration** - Secure processing with webhooks
- **Instant Activation** - Subscriptions activate after payment

### Referral & Rewards
- **Referral Links** - Unique code per user
- **Auto-Rewards** - 50 points per referral
- **Free Upgrade** - Pro tier free 30 days after 5 referrals
- **Leaderboards** - Track top referrers and points

## 🏗️ Architecture

### System Components
- **Webhook Server** - Express on port 5000
- **Worker Process** - Telegram bot handler
- **Payment Processor** - Background payment capture
- **Redis Queue** - Decoupled job processing
- **Managed Redis** - External persistence layer

### Database Schema (Redis)
- Sorted sets for scalable leaderboards
- Indexed lookups (no keys() scans)
- Pending payment metadata with TTL
- Active subscription tracking

## 💻 Tech Stack
Node.js • Express • Redis • Telegram • Gemini • PayPal • RapidAPI • Binance

## 📚 Documentation
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Production deployment
- [replit.md](replit.md) - Architecture details

## 🚀 Quick Start
```bash
npm install
export REDIS_URL=redis://localhost:6379
export TELEGRAM_TOKEN=your_token
bash start.sh