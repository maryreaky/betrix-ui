# 🚀 BETRIX - World-Class Sports AI Platform

**Production-Ready Telegram Bot with Gemini AI, Subscription Tiers, and Premium Analytics**

## ✨ What You Get

- ✅ Autonomous AI with Gemini integration
- ✅ 3-tier subscription system (Free, Member, VVIP)
- ✅ Beautiful odds presentation with advanced metrics
- ✅ Tier-aware responses and feature gating
- ✅ Professional match analysis for VVIP
- ✅ Real-time alerts and live commentary
- ✅ Personal betting coach
- ✅ Admin dashboard with monitoring
- ✅ Complete analytics and tracking

## 🎯 Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
export REDIS_URL="your-redis-url"
export TELEGRAM_TOKEN="your-bot-token"
export GEMINI_API_KEY="your-gemini-key"
export API_FOOTBALL_KEY="your-api-football-key"

# Start the bot
bash start.sh
```

## 📊 Subscription Tiers

### 🎁 FREE
- Live matches, odds, standings
- General tips
- Referral rewards

### 👤 MEMBER (KES 150)
- Everything in Free +
- Match analysis
- AI predictions
- Personal insights
- Leaderboard

### 💎 VVIP (from KES 200/day)
- Everything in Member +
- Professional match dossier
- Betting coach
- Live alerts
- Seasonal trends
- Advanced metrics

## 🎮 Commands

**Free:**
```
/start /menu /live /standings /odds /tips /help /pricing /refer
```

**Member:**
```
/analyze /predict /stats /insights /compete /watch
```

**VVIP:**
```
/dossier /coach /trends /alerts /live_commentary
```

## 📁 Architecture

```
src/
├── config.js - Centralized configuration
├── worker-complete.js - Main production worker
├── handlers.js - Basic commands
├── handlers-tier.js - Tier-aware handlers
├── services/ - AI, data, payment services
├── middleware/ - Gating, context, rate limiting
├── admin/ - Admin dashboard
└── utils/ - UI, formatting, statistics
```

## 🔐 Features

- **Gemini AI** - Natural language understanding
- **Tier Gating** - Feature access control
- **Beautiful UI** - Icons, menus, formatting
- **Odds Analysis** - Professional presentation
- **Predictions** - ML-powered with confidence
- **Alerts** - Real-time match notifications
- **Admin Tools** - Health, users, revenue
- **Analytics** - Engagement, accuracy, performance

## 💳 Payment Methods

- PayPal (instant)
- M-Pesa (instant)
- Binance (1 hour)
- Bank Transfer (1-3 days)

## 📈 Next Steps

1. Update environment variables
2. Run `bash start.sh`
3. Bot will be ready for users
4. Check `/admin_health` for system status
5. Monitor revenue with `/admin_revenue`

## 📚 Documentation

- `FEATURES_BY_TIER.md` - Detailed tier breakdown
- `TIER_SYSTEM_GUIDE.md` - Implementation guide
- `WORLD_CLASS_FEATURES.md` - Advanced features
- `ARCHITECTURE.md` - System design

## 🌟 Production Ready

✅ Autonomous AI personality
✅ Subscription tier system working
✅ Beautiful UI with icons
✅ Tier-aware response system
✅ Advanced analytics
✅ Error handling & fallbacks
✅ Rate limiting & security
✅ Admin monitoring
✅ Payment integration ready

**Deploy with confidence!** 🚀

