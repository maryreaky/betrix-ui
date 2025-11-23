# BETRIX Subscription Tier System - Complete Guide

## 🎯 How It Works

BETRIX uses a 3-tier subscription model with intelligent feature gating:

### **TIER 1: FREE** 🎁
- No payment required
- Basic features available
- Rate limit: 30 commands/min

### **TIER 2: MEMBER** 👤  
- One-time payment: KES 150 / USD 1
- Unlock member-only features
- Rate limit: 100 commands/min
- Lifetime access (no expiration)

### **TIER 3: VVIP** 💎
- Flexible duration: Daily, Weekly, or Monthly
- Premium features + personal coaching
- Rate limit: 500 commands/min
- Auto-expires after duration

---

## 🔒 Feature Gating Implementation

### How the Bot Controls Access

**When a FREE user tries `/analyze`:**
```
❌ DENIED
Message: "🔒 Professional match analysis available for members"
Action: Show upsell menu with upgrade options
```

**When a MEMBER user tries `/dossier`:**
```
❌ DENIED
Message: "🔒 Professional dossier available for VVIP"
Action: Show upgrade to VVIP button
```

**When a VVIP user tries `/dossier`:**
```
✅ ALLOWED
Response: "📋 PROFESSIONAL MATCH DOSSIER [500+ words]"
Action: Show full premium content
```

---

## 💻 Technical Implementation

### Subscription Gatekeeper Service
Located in `src/middleware/subscription-gatekeeper.js`

```javascript
// Check if user can access feature
const hasAccess = await gatekeeper.canAccess(userId, "dossier");

if (!hasAccess) {
  // Show upsell and block feature
  await gatekeeper.enforceAccess(chatId, userId, "dossier");
  return;
}

// Show premium content
```

### Tier-Aware Handlers
Located in `src/handlers-tier.js`

Each command is wrapped with subscription checking:

```javascript
async analysisWithTier(chatId, userId, matchQuery) {
  // Step 1: Check if user has access
  if (!(await this.gatekeeper.enforceAccess(chatId, userId, "analysis"))) {
    return; // Access denied + upsell shown
  }

  // Step 2: Get user tier
  const tier = await this.gatekeeper.getUserTier(userId);

  // Step 3: Provide tier-appropriate response
  if (tier === "vvip") {
    // Show advanced analysis with metrics
  } else if (tier === "member") {
    // Show standard analysis
  }
}
```

---

## 📊 Beautiful UI Presentation

### Odds Display by Tier

**FREE users see:**
```
🎲 Match Odds
🏠 Home: 1.85
🤝 Draw: 3.50
🏁 Away: 4.10

💡 Upgrade to VVIP for advanced odds analysis
```

**VVIP users see:**
```
🎲 Match Odds
🏠 Home: 1.85 (Implied: 54.1%)
🤝 Draw: 3.50 (Implied: 28.6%)
🏁 Away: 4.10 (Implied: 24.4%)

Advanced Analysis (VVIP):
📊 Implied Home: 54.1%
📊 Implied Draw: 28.6%
📊 Implied Away: 24.4%
💰 Vig: 10.5%
```

### Menu System by Tier

**FREE user menu:**
```
🧭 BETRIX Menu

🔴 Live - Standings - Odds - Tips - Settings - Account
```

**MEMBER menu:**
```
🧭 BETRIX Menu

🔴 Live - Standings - Odds - Tips
🔍 Analysis - 🎯 Predictions - Settings - 👤 Account
```

**VVIP menu:**
```
🧭 BETRIX Menu

🔴 Live - Standings - Odds - Tips
🔍 Analysis - 🎯 Predictions
⭐ Premium - 🔔 Alerts - Settings - 💎 Account
```

---

## 🎛️ How Bot Responds by Tier

### Same Command, Different Responses

#### FREE user: `/predict Liverpool vs Man City`
```
🔒 Predictions available for members
Become a member for KES 150 to unlock AI predictions
[Button: Become Member]
```

#### MEMBER user: `/predict Liverpool vs Man City`
```
🎯 Match Prediction

Liverpool slightly favored. Strong home record.
Man City impressive form. Van Dijk key defender.

📊 Confidence: 72%

Upgrade to VVIP for expected value analysis
```

#### VVIP user: `/predict Liverpool vs Man City`
```
🎯 Match Prediction

Liverpool slightly favored. Strong home record.
Man City impressive form. Van Dijk key defender.

📊 Confidence: 72%
📈 Expected Value: +15.2%
🎯 Recommended Unit: 1-2 units
💎 High confidence bet identified
```

---

## 💳 Payment Flow

### User tries premium feature → Upsell triggered

```
User: /dossier Liverpool vs Man City
Bot: 🔒 Available for VVIP members
     Upgrade from KES 200/day
     [Button: Get VVIP]

User clicks: [Get VVIP]
Bot shows: Select duration
     - Daily: KES 200 (24h)
     - Weekly: KES 800 (7 days)
     - Monthly: KES 2,500 (30 days)
     [Buttons: PayPal | M-Pesa | Binance | Bank]

User selects: Weekly
Bot: Show payment method

User pays: KES 800 via M-Pesa
Bot: ✅ Payment confirmed!
     💎 VVIP activated (7 days)
     Now use: /dossier, /coach, /trends

User: /dossier Liverpool vs Man City
Bot: 📋 PROFESSIONAL MATCH DOSSIER
     [500+ word analysis, tactics, coaching tips]
```

---

## 🔄 Tier-Based Rate Limiting

| Tier | Limit | Resets |
|------|-------|--------|
| FREE | 30/min | Every minute |
| MEMBER | 100/min | Every minute |
| VVIP | 500/min | Every minute |

When limit exceeded:
```
⏱️ Rate limited. You have 5 requests left this minute.
```

---

## 🎁 Referral System by Tier

### All Tiers Can Earn

```
/refer
👥 Share your code: BETRIX-ABC123

🎁 Each friend who joins = +10 points
🏆 50 points = 1 month free VVIP
💰 Top 10 referrers = monthly bonus
```

### Referral Leaderboard
```
/leaderboard
🏆 Top Referrers

🥇 Ali - 250 points (Member with 25 referrals)
🥈 Fatima - 180 points (VVIP subscriber)
🥉 Omar - 160 points (Member)

💡 Upgrade to see full leaderboard
```

---

## 📋 Feature Access Matrix

| Feature | FREE | MEMBER | VVIP |
|---------|------|--------|------|
| /live | ✅ | ✅ | ✅ |
| /standings | ✅ | ✅ | ✅ |
| /odds | ✅ (basic) | ✅ | ✅ (advanced) |
| /tips | ✅ | ✅ | ✅ |
| /analyze | ❌ | ✅ | ✅ (advanced) |
| /predict | ❌ | ✅ | ✅ (advanced) |
| /stats | ❌ | ✅ | ✅ |
| /insights | ❌ | ✅ | ✅ |
| /dossier | ❌ | ❌ | ✅ |
| /coach | ❌ | ❌ | ✅ |
| /trends | ❌ | ❌ | ✅ |
| /watch | ❌ | ✅ | ✅ |

---

## 🚀 Tier Upgrade Flow

### 1. User in FREE sees upsell
```
Automatic: Show upsell when accessing premium feature
Manual: /pricing shows all tiers
```

### 2. User selects tier
```
/pricing → Pick tier → Pick payment method
```

### 3. Payment processed
```
M-Pesa: Instant
PayPal: Instant
Binance: Manual (1 hour)
Bank: Manual (1-3 days)
```

### 4. Tier activated
```
✅ Payment confirmed!
💎 VVIP activated (7 days)
You now have access to:
/dossier, /coach, /trends, /watch, + more
```

### 5. Use premium features
```
/dossier Liverpool vs Man City
→ Full 500+ word professional analysis
```

---

## 🎯 Implementation in Worker

The complete worker (`src/worker-complete.js`) implements everything:

1. **Check tier on every command**
2. **Gate features appropriately**
3. **Show beautiful tier-aware UI**
4. **Display upsells when denied**
5. **Provide different content per tier**

---

## 💡 Best Practices

### For Users
- Start FREE to explore
- Upgrade to MEMBER for serious analysis (KES 150 one-time)
- Go VVIP for professional coaching and live alerts (KES 200+)

### For Developers
- All tier checks happen in `SubscriptionGatekeeper`
- Handlers in `src/handlers-tier.js` wrap basic handlers
- UI formatting in `src/utils/ui-builder.js`
- Payment presentation in `src/utils/payment-presenter.js`

---

## 📞 Support

Users can check their tier anytime:
```
/status → Shows current tier + features
/features → Lists what they can access
/pricing → Shows upgrade options
```

Ready to launch! 🚀
