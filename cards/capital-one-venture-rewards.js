window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['capital-one-venture-rewards'] = {
  name: 'Capital One Venture Rewards',
  shortName: 'Venture Rewards',
  annualFee: 95,
  // Point value varies by redemption: ~0.01 for statement credit, ~0.016+ for travel transfers/portal.
  // 0.016 is a reasonable default for "miles" style points.
  pointValue: 0.016,
  multipliers: { 'capital-one-travel': 5, 'capital-one-entertainment': 5 },
  baseRate: 2,
  credits: [
    { name: 'Global Entry/TSA PreCheck', amount: 120, keywords: ['GLOBAL ENTRY', 'TSA PRECHECK', 'KNOWN TRAVELER', 'TRUSTED TRAVELER'], manual: false, frequency: 'none' },
    // Note: Lifestyle Collection credit may not appear as a statement credit depending on how Capital One applies it.
    { name: 'Lifestyle Collection Credit', amount: 50, keywords: ['LIFESTYLE COLLECTION', 'CAPITAL ONE LIFESTYLE', 'CAPITAL ONE TRAVEL', 'EXPERIENCE CREDIT'], manual: false, frequency: 'annual' }
  ],
  categories: ['capital-one-travel', 'capital-one-entertainment', 'other']
};
