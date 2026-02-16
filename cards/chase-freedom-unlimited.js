window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['chase-freedom-unlimited'] = {
  name: 'Chase Freedom Unlimited',
  shortName: 'Freedom Unlimited',
  annualFee: 0,
  // Cash back card (1 cpp) unless paired with Sapphire Preferred/Reserve, which enables UR transfer (1.8 cpp)
  pointValue: 0.01,
  multipliers: { 'chase-travel': 5, 'dining': 3, 'drugstore': 3, 'lyft': 2 },
  baseRate: 1.5,
  credits: [],
  categories: ['chase-travel', 'dining', 'drugstore', 'lyft', 'other'],
  // Lyft partnership: 5x from Jan 12, 2020 to March 31, 2025, then 2x after
  lyftPartnershipStart: '2020-01-12',
  lyft5xEndDate: '2025-04-01'
};
