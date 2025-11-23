/**
 * i18n - Multi-language Support
 */

const translations = {
  en: {
    welcome: "Welcome to BETRIX",
    menu: "Main Menu",
    live: "Live Matches",
    odds: "Betting Odds",
    analyze: "Match Analysis",
    predict: "Predictions",
    dossier: "Match Dossier",
    coach: "Betting Coach",
    trends: "Seasonal Trends",
    pricing: "Pricing Plans",
    upgrade: "Upgrade Now",
    tier_denied: "This feature requires a higher tier",
    payment_success: "Payment successful!",
    payment_failed: "Payment failed",
    otp_sent: "OTP sent to your phone",
    otp_expired: "OTP expired",
    welcome_member: "Welcome to Member tier!",
    welcome_vvip: "Welcome to VVIP tier!",
  },
  sw: {
    welcome: "Karibu BETRIX",
    menu: "Menyu Kuu",
    live: "Michezo Hai",
    odds: "Ubashiri wa Bahati",
    analyze: "Uchambuzi wa Michezo",
    predict: "Ubashiri",
    dossier: "Ripoti ya Michezo",
    coach: "Kocha wa Bahati",
    trends: "Mwelekeo wa Msimu",
    pricing: "Mipango ya Bei",
    upgrade: "Boresha Sasa",
    tier_denied: "Kipengele hiki kinahitaji kiwango cha juu",
    payment_success: "Malipo yalipokea!",
    payment_failed: "Malipo yalishindwa",
    otp_sent: "OTP imetumwa kwenye simu yako",
    otp_expired: "OTP imeishia muda",
    welcome_member: "Karibu kwa kiwango cha Member!",
    welcome_vvip: "Karibu kwa kiwango cha VVIP!",
  },
  fr: {
    welcome: "Bienvenue sur BETRIX",
    menu: "Menu Principal",
    live: "Matchs en Direct",
    odds: "Cotes de Paris",
    analyze: "Analyse de Match",
    predict: "Prédictions",
    dossier: "Dossier de Match",
    coach: "Coach de Paris",
    trends: "Tendances Saisonnières",
    pricing: "Plans de Tarification",
    upgrade: "Mettre à Niveau Maintenant",
    tier_denied: "Cette fonctionnalité nécessite un niveau supérieur",
    payment_success: "Paiement réussi!",
    payment_failed: "Échec du paiement",
    otp_sent: "OTP envoyé à votre téléphone",
    otp_expired: "OTP expiré",
    welcome_member: "Bienvenue au niveau Membre!",
    welcome_vvip: "Bienvenue au niveau VVIP!",
  },
};

class I18n {
  static get(key, language = "en") {
    return translations[language]?.[key] || translations.en[key] || key;
  }

  static getAll(language = "en") {
    return translations[language] || translations.en;
  }

  static supportedLanguages() {
    return Object.keys(translations);
  }
}

export { I18n };
