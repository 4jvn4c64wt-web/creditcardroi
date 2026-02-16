window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['bilt-blue'] = {
  name: 'Bilt Blue',
  shortName: 'Bilt Blue',
  annualFee: 0,
  pointValue: 0.018,
  // Bilt 2.0 (Feb 7, 2026+): 1x on ALL everyday spending, NO bonus categories
  multipliers: {},
  baseRate: 1,
  credits: [],
  categories: ['rent', 'other'],
  isBilt: true,
  // Legacy (before Feb 7, 2026): 3x dining, 2x travel, 1x everything else (including rent)
  // Note: rent is 1x (same as baseRate) - no special rent multiplier before 2.0
  legacy: {
    multipliers: { 'dining': 3, 'travel': 2 },
    baseRate: 1,
    categories: ['dining', 'travel', 'rent', 'other']
  }
};
