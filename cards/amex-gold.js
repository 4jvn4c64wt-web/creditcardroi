window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['amex-gold'] = {
  name: 'American Express Gold',
  shortName: 'Amex Gold',
  annualFee: 325,
  pointValue: 0.02,
  multipliers: { 'dining': 4, 'grocery': 4, 'flights-direct': 3, 'amex-travel': 3, 'hotels-amex-travel': 2 },
  baseRate: 1,
  credits: [
    { name: 'Uber Cash', amount: 120, keywords: [], manual: true },
    { name: 'Dining Credit', amount: 120, keywords: ['DINING CREDIT', 'GRUBHUB', 'SEAMLESS', 'CHEESECAKE FACTORY', 'GOLDBELLY', 'WINE.COM', 'MILKBAR'], manual: false },
    { name: 'Resy Credit', amount: 100, keywords: ['RESY'], manual: false },
    { name: 'Dunkin Credit', amount: 84, keywords: ['DUNKIN'], manual: false },
  ],
  categories: ['dining', 'grocery', 'flights-direct', 'amex-travel', 'hotels-amex-travel', 'other']
};
