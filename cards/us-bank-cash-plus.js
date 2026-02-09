window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['us-bank-cash-plus'] = {
  name: 'U.S. Bank Cash+',
  shortName: 'Cash+',
  annualFee: 0,
  pointValue: 0.01,
  multipliers: {}, // Populated dynamically based on quarterly selections
  baseRate: 1,
  credits: [],
  // Categories are dynamic based on quarterly selection
  categories: ['other'], // Base categories, expanded by getCardCategories()
  selectableCategories: {
    fivePercent: [
      'streaming', 'utilities', 'cell-phone', 'department-stores', 'electronics',
      'furniture', 'fast-food', 'fitness', 'ground-transport', 'movies',
      'sporting-goods', 'clothing'
    ],
    twoPercent: ['gas', 'grocery', 'dining']
  }
};
