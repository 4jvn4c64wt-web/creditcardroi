window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['bilt-obsidian'] = {
  name: 'Bilt Obsidian',
  shortName: 'Bilt Obsidian',
  annualFee: 95,
  pointValue: 0.022,
  // Bilt 2.0: 3x dining OR grocery (user choice), 2x travel, 1x other
  multipliers: { 'dining': 3, 'travel': 2 },
  baseRate: 1,
  credits: [{ name: 'Bilt Travel Credit', amount: 100, keywords: ['BILT TRAVEL'], manual: false }],
  categories: ['rent', 'dining', 'grocery', 'travel', 'other'],
  isBilt: true,
  hasObsidianBonus: true, // Can choose 3x dining OR grocery
  // Legacy (before Feb 7, 2026): same as all Bilt cards - 3x dining, 2x travel, 1x everything else
  legacy: {
    multipliers: { 'dining': 3, 'travel': 2 },
    baseRate: 1,
    categories: ['dining', 'travel', 'rent', 'other']
  }
};
