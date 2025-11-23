# 🎯 BETSLIP INTEGRATION GUIDE

## Quick Start - How to Use These Services

### 1. Import the Services
```javascript
import { BetslipGenerator } from "./services/betslip-generator.js";
import { BettingSitesService } from "./services/betting-sites-service.js";
import { BetslipAnalysisService } from "./services/betslip-analysis-service.js";
import { FreeBetService } from "./services/free-bet-service.js";
import { BetslipHandlers } from "./handlers-betslip.js";
```

### 2. Initialize in worker-db.js
```javascript
const betslipHandlers = new BetslipHandlers(telegram, userService, gemini);
const freeBetService = new FreeBetService(redis);
```

---

## Usage Examples

### Example 1: Generate Betslip After Payment
```javascript
// After payment verification
const slip = {
  matches: [
    { team: "Liverpool WIN", prediction: "1", odds: 1.80, matchId: "123" },
    { team: "Arsenal WIN", prediction: "1", odds: 1.65, matchId: "124" }
  ],
  totalOdds: 2.97
};

await betslipHandlers.generateBetslipAfterPayment(
  chatId,      // Telegram chat ID
  userId,      // User ID
  slip,        // Slip object
  user,        // User data
  "KE"         // Country code
);
```

**What it does:**
1. Generates AI analysis
2. Creates professional betslip
3. Shows betting sites for Kenya
4. User can one-click to place bet

---

### Example 2: Issue and Generate Free Bet
```javascript
// Issue free bet
const freeBet = await freeBetService.issueBet(
  userId,
  500,              // Amount in KES
  "daily_bonus",    // Reason
  7                 // Expiry in days
);

// Then generate slip for free bet
const slip = { matches: [...], totalOdds: 4.74 };
await betslipHandlers.generateFreeBetSlip(
  chatId,
  userId,
  freeBet,
  slip,
  user,
  "KE"
);
```

---

### Example 3: Format Betslip Manually
```javascript
// Get formatted betslip text
const betslipText = BetslipGenerator.formatBetslipAsImage(
  slip,
  user,
  "KES"  // Currency
);

// Send to user
await telegram.sendMessage(chatId, `<pre>${betslipText}</pre>`);
```

---

### Example 4: Get Betting Sites for Country
```javascript
// Get sites as formatted text
const sitesDisplay = BettingSitesService.formatSitesDisplay("KE");
await telegram.sendMessage(chatId, sitesDisplay);

// Or get as keyboard buttons
const keyboard = BettingSitesService.buildBettingSitesKeyboard("KE");
await telegram.sendMessage(chatId, "Choose site:", { reply_markup: keyboard });

// Or get top site
const topSite = BettingSitesService.getTopSite("KE");
// topSite = { name: "Bet365", url: "...", emoji: "🎲", rating: 4.8 }
```

---

### Example 5: Generate AI Analysis
```javascript
// Create analysis service
const analysisService = new BetslipAnalysisService(gemini);

// Get analysis
const analysis = await analysisService.analyzeBetslip(slip, userStats);

// Get formatted display
const display = analysisService.formatAnalysisDisplay(analysis, slip, userStats);
await telegram.sendMessage(chatId, display);
```

---

### Example 6: Assess Risk
```javascript
// Get risk assessment
const risk = analysisService.assessRisk(slip.totalOdds, slip.matches);
// Returns: { level: "🟠 MEDIUM-HIGH", emoji: "📊", message: "..." }

await telegram.sendMessage(chatId, `Risk: ${risk.level}`);
```

---

### Example 7: Manage Free Bets
```javascript
// Get active free bets
const activeBets = await freeBetService.getActiveBets(userId);

// Use a free bet
const result = await freeBetService.useBet(betId, slipId, stake);

// Check if expired
const isExpired = freeBetService.isExpired(bet);
```

---

## 🌍 Supported Countries

### Auto-Detection
Use user's country during signup:
```javascript
// During signup
const country = await geoService.detectCountry(userId);
user.country = country;

// Use in betslip generation
await betslipHandlers.generateBetslipAfterPayment(
  chatId,
  userId,
  slip,
  user,
  user.country  // Auto-detected country
);
```

### Supported Country Codes
- **Africa:** KE, NG, ZA, TZ, UG, GH (+ 20+ more)
- **Americas:** US, CA, BR, MX
- **Europe:** GB, FR, DE, ES, IT, NL (+ more)
- **Asia-Pacific:** AU, JP, SG, HK (+ more)

---

## 💡 Integration Points

### Payment Success Webhook
```javascript
// In payment handler
if (paymentVerified) {
  // Generate recommended slip
  const slip = await getRecommendedSlip(userId);
  
  // Generate betslip with analysis
  await betslipHandlers.generateBetslipAfterPayment(
    chatId,
    userId,
    slip,
    user,
    country
  );
}
```

### Free Bet Issuance (Admin Command)
```javascript
// /admin_issue_free_bet [userId] [amount] [days]
const bet = await freeBetService.issueBet(
  userId,
  amount,
  "admin_bonus",
  days
);

// Notify user
await telegram.sendMessage(
  userChatId,
  `🎁 You received a ${amount} KES free bet!`
);

// Get their slip
const slip = await getRecommendedSlip(userId);
await betslipHandlers.generateFreeBetSlip(
  userChatId,
  userId,
  bet,
  slip,
  user,
  country
);
```

### User Commands
```javascript
// /freebets - Show active free bets
const bets = await freeBetService.getActiveBets(userId);
for (const bet of bets) {
  const display = freeBetService.formatBetDisplay(bet);
  await telegram.sendMessage(chatId, display);
}

// /betslip - Show last betslip
const betslip = BetslipGenerator.formatBetslipAsImage(slip, user, currency);
await telegram.sendMessage(chatId, `<pre>${betslip}</pre>`);

// /betting_sites - Show sites for their country
const sites = BettingSitesService.formatSitesDisplay(user.country);
await telegram.sendMessage(chatId, sites, {
  reply_markup: BettingSitesService.buildBettingSitesKeyboard(user.country)
});
```

---

## 🎊 Complete Flow Example

```javascript
// In handlers
async handleUpgradePayment(chatId, userId, amount, plan) {
  try {
    // 1. Process payment
    const payment = await processPayment(userId, amount);
    if (!payment.verified) {
      await telegram.sendMessage(chatId, "❌ Payment failed");
      return;
    }
    
    // 2. Get user data
    const user = await userService.getUser(userId);
    
    // 3. Create recommended betslip
    const slip = {
      matches: [
        { team: "Liverpool WIN", prediction: "1", odds: 1.80 },
        { team: "Arsenal WIN", prediction: "1", odds: 1.65 }
      ],
      totalOdds: 2.97
    };
    
    // 4. Generate and send betslip with analysis
    await betslipHandlers.generateBetslipAfterPayment(
      chatId,
      userId,
      slip,
      user,
      user.country
    );
    
    // 5. Update user tier
    await userService.updateTier(userId, plan);
    
  } catch (err) {
    logger.error("Upgrade failed", err);
    await telegram.sendMessage(chatId, "Error processing upgrade");
  }
}
```

---

## ✅ Features Checklist

- ✅ Professional betslip formatting
- ✅ AI analysis generation
- ✅ Country-specific betting sites
- ✅ Free bet management
- ✅ Payment integration
- ✅ Multi-currency support
- ✅ Risk assessment
- ✅ Affiliate link tracking
- ✅ Shareable format
- ✅ Error handling

---

## 🚀 Ready to Deploy

All services are production-ready and tested. Add them to your worker-db.js and enjoy automated betslip generation!
