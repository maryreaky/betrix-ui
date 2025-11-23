export const PRICING_TIERS = {
  football: {
    starter: { name: 'Football Starter', price: 9.99, features: ['Basic odds', 'Weekly AI insights', 'Match predictions'] },
    pro: { name: 'Football Pro', price: 24.99, features: ['Live alerts', 'Advanced analytics', 'Premium odds', 'AI analysis'] },
    elite: { name: 'Football Elite', price: 59.99, features: ['Real-time AI models', 'Priority support', 'Custom reports', 'VIP insights'] }
  },
  basketball: {
    starter: { name: 'Basketball Starter', price: 9.99, features: ['Basic stats', 'Weekly insights', 'Game predictions'] },
    pro: { name: 'Basketball Pro', price: 24.99, features: ['Live scores', 'Player analytics', 'Team insights', 'AI analysis'] },
    elite: { name: 'Basketball Elite', price: 59.99, features: ['Real-time models', 'Priority chat', 'Advanced metrics', 'VIP access'] }
  },
  tennis: {
    starter: { name: 'Tennis Starter', price: 9.99, features: ['Match odds', 'Weekly tips', 'Player rankings'] },
    pro: { name: 'Tennis Pro', price: 24.99, features: ['Live updates', 'H2H analysis', 'Surface stats', 'AI predictions'] },
    elite: { name: 'Tennis Elite', price: 59.99, features: ['Real-time AI', 'Priority support', 'Tournament insights', 'VIP reports'] }
  },
  cricket: {
    starter: { name: 'Cricket Starter', price: 9.99, features: ['Match odds', 'Weekly insights', 'Team stats'] },
    pro: { name: 'Cricket Pro', price: 24.99, features: ['Live scores', 'Player analytics', 'Pitch reports', 'AI analysis'] },
    elite: { name: 'Cricket Elite', price: 59.99, features: ['Real-time AI', 'Priority chat', 'Tournament data', 'VIP insights'] }
  },
  baseball: {
    starter: { name: 'Baseball Starter', price: 9.99, features: ['Game odds', 'Weekly tips', 'Team rankings'] },
    pro: { name: 'Baseball Pro', price: 24.99, features: ['Live updates', 'Player stats', 'Pitcher analysis', 'AI predictions'] },
    elite: { name: 'Baseball Elite', price: 59.99, features: ['Real-time models', 'Priority support', 'Season analytics', 'VIP access'] }
  },
  hockey: {
    starter: { name: 'Hockey Starter', price: 9.99, features: ['Game odds', 'Weekly insights', 'Team stats'] },
    pro: { name: 'Hockey Pro', price: 24.99, features: ['Live scores', 'Player analytics', 'Goalie stats', 'AI analysis'] },
    elite: { name: 'Hockey Elite', price: 59.99, features: ['Real-time AI', 'Priority chat', 'Advanced metrics', 'VIP reports'] }
  },
  rugby: {
    starter: { name: 'Rugby Starter', price: 9.99, features: ['Match odds', 'Weekly tips', 'Team rankings'] },
    pro: { name: 'Rugby Pro', price: 24.99, features: ['Live updates', 'Player stats', 'Tournament data', 'AI predictions'] },
    elite: { name: 'Rugby Elite', price: 59.99, features: ['Real-time models', 'Priority support', 'Championship insights', 'VIP access'] }
  },
  esports: {
    starter: { name: 'Esports Starter', price: 9.99, features: ['Match odds', 'Weekly tips', 'Team rankings'] },
    pro: { name: 'Esports Pro', price: 24.99, features: ['Live tournaments', 'Player analytics', 'Game insights', 'AI analysis'] },
    elite: { name: 'Esports Elite', price: 59.99, features: ['Real-time AI', 'Priority chat', 'Pro scene data', 'VIP reports'] }
  },
  mma: {
    starter: { name: 'MMA Starter', price: 9.99, features: ['Fight odds', 'Weekly insights', 'Fighter rankings'] },
    pro: { name: 'MMA Pro', price: 24.99, features: ['Live updates', 'Fighter stats', 'Style analysis', 'AI predictions'] },
    elite: { name: 'MMA Elite', price: 59.99, features: ['Real-time models', 'Priority support', 'Event analytics', 'VIP access'] }
  },
  boxing: {
    starter: { name: 'Boxing Starter', price: 9.99, features: ['Fight odds', 'Weekly tips', 'Boxer rankings'] },
    pro: { name: 'Boxing Pro', price: 24.99, features: ['Live updates', 'Boxer stats', 'H2H analysis', 'AI predictions'] },
    elite: { name: 'Boxing Elite', price: 59.99, features: ['Real-time AI', 'Priority chat', 'Fight insights', 'VIP reports'] }
  },
  soccer: {
    starter: { name: 'Soccer Starter', price: 9.99, features: ['Match odds', 'Weekly insights', 'League standings'] },
    pro: { name: 'Soccer Pro', price: 24.99, features: ['Live scores', 'Player analytics', 'Team stats', 'AI analysis'] },
    elite: { name: 'Soccer Elite', price: 59.99, features: ['Real-time models', 'Priority support', 'Championship data', 'VIP insights'] }
  },
  volleyball: {
    starter: { name: 'Volleyball Starter', price: 9.99, features: ['Match odds', 'Weekly tips', 'Team rankings'] },
    pro: { name: 'Volleyball Pro', price: 24.99, features: ['Live updates', 'Player stats', 'Tournament data', 'AI predictions'] },
    elite: { name: 'Volleyball Elite', price: 59.99, features: ['Real-time AI', 'Priority chat', 'Advanced analytics', 'VIP access'] }
  },
  allAccess: {
    bundle: { name: 'All-Access Bundle', price: 149.99, features: ['All 12 sports', 'Elite features', 'Priority support', 'Custom reports', 'VIP access', '20% discount'] }
  }
};

export function getPricingText(sport = null) {
  if (!sport) {
    let text = '🌍 **BETRIX Global Pricing**\n\n';
    text += '💎 **All-Access Bundle: $149.99/month**\n';
    text += '✅ All 12 sports included\n';
    text += '✅ Elite features across all sports\n';
    text += '✅ 20% discount vs individual\n\n';
    text += '📊 **Individual Sports:**\n';
    Object.keys(PRICING_TIERS).forEach(sportName => {
      if (sportName !== 'allAccess') {
        const tiers = PRICING_TIERS[sportName];
        text += `\n**${sportName.toUpperCase()}**\n`;
        text += `  Starter: $${tiers.starter.price}/mo\n`;
        text += `  Pro: $${tiers.pro.price}/mo\n`;
        text += `  Elite: $${tiers.elite.price}/mo\n`;
      }
    });
    return text;
  }

  const tiers = PRICING_TIERS[sport.toLowerCase()];
  if (!tiers) return 'Sport not found';

  let text = `🏆 **${sport.toUpperCase()} Pricing**\n\n`;
  Object.keys(tiers).forEach(tier => {
    const t = tiers[tier];
    text += `**${t.name}** - $${t.price}/month\n`;
    t.features.forEach(f => text += `  ✓ ${f}\n`);
    text += '\n';
  });
  return text;
}
