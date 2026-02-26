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
  lyft5xEndDate: '2025-04-01',

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    var card = this;

    // Lyft partnership date-dependent logic
    if (category === 'lyft' && card.lyftPartnershipStart) {
      var lyftStart = new Date(card.lyftPartnershipStart);
      var txnDateObj = txnDate ? new Date(txnDate) : new Date();

      if (txnDateObj >= lyftStart) {
        // CFU had 5x Lyft until April 1, 2025, then 2x after
        if (card.lyft5xEndDate) {
          var lyft5xEnd = new Date(card.lyft5xEndDate);
          if (txnDateObj < lyft5xEnd) {
            return { rate: 5, reason: '5x Lyft (Chase partnership 2020-2025)' };
          }
        }
        // After April 1, 2025: use defined multiplier (2x)
        if (card.multipliers['lyft']) {
          return { rate: card.multipliers['lyft'], reason: card.multipliers['lyft'] + 'x Lyft (Chase partnership)' };
        }
      }
      // Before partnership start — fall through to default
    }

    // No other special logic — fall through to default
    return null;
  },

  getPointValueOverride: function(walletCardIds, ctx) {
    // CFU paired with Sapphire enables UR transfer (1.8 cpp instead of 1 cpp)
    if (walletCardIds.indexOf('chase-sapphire-preferred') >= 0 ||
        walletCardIds.indexOf('chase-sapphire-reserve') >= 0) {
      return 0.018;
    }
    return null;
  },
};
