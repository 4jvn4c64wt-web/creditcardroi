window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['bilt-palladium'] = {
  name: 'Bilt Palladium',
  shortName: 'Bilt Palladium',
  annualFee: 495,
  annualFeeStartDate: '2026-02-07', // No annual fee charged before this date
  pointValue: 0.022,
  // Bilt 2.0: 2x on ALL everyday spending (flat rate, no categories)
  multipliers: {},
  baseRate: 2,
  credits: [
    { name: 'Bilt Travel Credit', amount: 400, keywords: ['BILT TRAVEL'], manual: false }
  ],
  categories: ['rent', 'other'],
  isBilt: true,
  // Legacy (before Feb 7, 2026): same as all Bilt cards - 3x dining, 2x travel, 1x everything else
  legacy: {
    multipliers: { 'dining': 3, 'travel': 2 },
    baseRate: 1,
    categories: ['dining', 'travel', 'rent', 'other']
  }
};
