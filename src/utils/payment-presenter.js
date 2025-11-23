/**
 * Payment Presentation Service
 * Beautiful payment options and tier benefits display
 */

import { EMOJIS } from "./ui-builder.js";

class PaymentPresenter {
  /**
   * Show payment options menu
   */
  static buildPaymentOptionsMenu() {
    return {
      inline_keyboard: [
        [
          { text: "💳 PayPal (Card)", callback_data: "pay:paypal" },
          { text: "📱 Till (M-Pesa)", callback_data: "pay:till" },
        ],
        [
          { text: "🏧 Lipa STK Push", callback_data: "pay:stk_push" },
          { text: "₿ Binance (Crypto)", callback_data: "pay:binance" },
        ],
        [
          { text: "🏦 Bank Transfer", callback_data: "pay:bank" },
        ],
        [{ text: "⬅️ Back", callback_data: "menu:main" }],
      ],
    };
  }

  /**
   * Format subscription tier comparison
   */
  static formatTierComparison() {
    const text = `${EMOJIS.premium} <b>BETRIX Subscription Plans</b>\n\n` +
      `<b>🎁 FREE TIER</b>\n` +
      `✓ Live matches\n` +
      `✓ League standings\n` +
      `✓ Betting odds\n` +
      `✓ General tips\n` +
      `✓ Basic support\n\n` +
      `<b>👤 MEMBER - KES 150 / USD 1</b>\n` +
      `✓ All Free features\n` +
      `✓ Match analysis\n` +
      `✓ AI predictions with confidence\n` +
      `✓ Personal insights\n` +
      `✓ Prediction leaderboard\n` +
      `✓ Priority support\n` +
      `✓ Referral program\n\n` +
      `<b>💎 VVIP - DAILY (KES 200 / USD 2)</b>\n` +
      `✓ All Member features\n` +
      `✓ Professional match dossier (500+ words)\n` +
      `✓ Advanced tactical analysis\n` +
      `✓ Live goal alerts\n` +
      `✓ Odds movement tracking\n` +
      `✓ Betting coach access\n` +
      `✓ Seasonal trend analysis\n` +
      `✓ Premium support\n` +
      `⏰ 24-hour access\n\n` +
      `<b>💎 VVIP - WEEKLY (KES 800 / USD 6)</b>\n` +
      `✓ All daily VVIP features\n` +
      `✓ 7 days of premium access\n` +
      `🏆 Best value for week\n\n` +
      `<b>💎 VVIP - MONTHLY (KES 2,500 / USD 20)</b>\n` +
      `✓ All weekly VVIP features\n` +
      `✓ 30 days of premium access\n` +
      `✓ Exclusive monthly reports\n` +
      `🏆 Best value for month`;

    return text;
  }

  /**
   * Format payment option details
   */
  static formatPaymentMethod(method) {
    const methods = {
      paypal: {
        name: "PayPal",
        icon: "💳",
        steps: [
          "1️⃣ Click approval link",
          "2️⃣ Sign in to PayPal",
          "3️⃣ Review and confirm",
          "4️⃣ Auto-returned to BETRIX",
          "✅ Instant activation",
        ],
        note: "Supports debit/credit cards from 200+ countries",
      },
      mpesa: {
        name: "M-Pesa",
        icon: "📱",
        steps: [
          "1️⃣ We send STK prompt",
          "2️⃣ Enter M-Pesa PIN",
          "3️⃣ Confirmation sent",
          "4️⃣ Access instantly",
        ],
        note: "Fast & secure. Paybill: 123456",
      },
      binance: {
        name: "Binance (Crypto)",
        icon: "₿",
        steps: [
          "1️⃣ Send USDT/BNB to wallet",
          "2️⃣ Send us tx hash",
          "3️⃣ Manual verification",
          "4️⃣ Access within 1 hour",
        ],
        note: "TRC20 for USDT, BEP20 for BNB",
      },
      bank: {
        name: "Bank Transfer",
        icon: "🏦",
        steps: [
          "1️⃣ Contact support for details",
          "2️⃣ Wire your payment",
          "3️⃣ We verify receipt",
          "4️⃣ Access activated",
        ],
        note: "International transfers welcome",
      },
    };

    const m = methods[method] || methods.paypal;
    let text = `${m.icon} <b>${m.name}</b>\n\n`;
    text += `<b>Steps:</b>\n`;
    text += m.steps.join("\n") + "\n\n";
    text += `💡 ${m.note}`;

    return text;
  }

  /**
   * Format tier benefits for upsell
   */
  static formatUpgradeOffer(currentTier) {
    const offers = {
      free: {
        headline: "Unlock Premium Features",
        current: "🎁 Currently: Free Tier",
        benefits: [
          "Match analysis with AI",
          "Predictions with confidence scores",
          "Personal insights",
          "Referral rewards",
        ],
        cta: "Become a Member for KES 150",
      },
      member: {
        headline: "Go VVIP - Premium Power",
        current: "👤 Currently: Member",
        benefits: [
          "Professional match dossier (500+ words)",
          "Live goal alerts",
          "Betting coach consultation",
          "Advanced tactical analysis",
          "Odds movement tracking",
        ],
        cta: "Upgrade to VVIP from KES 200/day",
      },
    };

    const offer = offers[currentTier];
    if (!offer) return "";

    let text = `${EMOJIS.premium} <b>${offer.headline}</b>\n\n`;
    text += offer.current + "\n\n";
    text += `<b>Unlock:</b>\n`;
    text += offer.benefits.map((b) => `✨ ${b}`).join("\n");
    text += `\n\n💳 ${offer.cta}`;

    return text;
  }

  /**
   * Format payment success message
   */
  static formatPaymentSuccess(tier, duration) {
    const durationText = {
      day: "24 hours",
      week: "7 days",
      month: "30 days",
    };

    let text = `✅ <b>Payment Successful!</b>\n\n` +
      `🎉 Welcome to ${tier === "vvip" ? "💎 VVIP" : "👤 Member"} tier\n\n` +
      `⏰ Access: ${durationText[duration] || "Lifetime"}\n` +
      `📅 Activated: ${new Date().toLocaleDateString()}\n\n` +
      `Now you can use:\n` +
      `/analyze - Match analysis\n` +
      `/predict - AI predictions\n`;
    
    if (tier === "vvip") {
      text += `/dossier - Pro analysis\n/coach - Betting coach\n`;
    }
    
    text += `/insights - Personal recommendations\n\n` +
      `Type /menu to get started!`;

    return text;
  }

  /**
   * Format referral rewards
   */
  static formatReferralRewards(code = "[YOUR_CODE]") {
    return `${EMOJIS.refer} <b>Earn Rewards</b>\n\nShare your referral code with friends:\n\n🎁 Each friend who joins = +10 points\n🏆 50 points = 1 month free VVIP\n💰 Top 10 referrers get monthly bonus\n\nYour Code:\n<code>${code}</code>\n\nShare link:\nhttps://t.me/betrix_bot?start=${code}\n\n💡 No limits - earn unlimited!`;
  }
}

export { PaymentPresenter };
