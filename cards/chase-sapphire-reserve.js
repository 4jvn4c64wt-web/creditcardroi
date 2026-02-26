window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['chase-sapphire-reserve'] = {
  name: 'Chase Sapphire Reserve',
  shortName: 'Sapphire Reserve',
  annualFee: 795,
  pointValue: 0.018,
  // CSR only has bonuses for specific travel categories - no generic 'travel' bonus
  multipliers: { 'chase-travel': 8, 'flights-direct': 4, 'hotels-direct': 4, 'dining': 3, 'lyft': 5 },
  baseRate: 1,
  credits: [
    { name: 'Travel Credit', amount: 300, keywords: ['TRAVEL CREDIT'], manual: false },
    { name: 'Global Entry/TSA PreCheck', amount: 120, keywords: ['GLOBAL ENTRY', 'TSA PRECHECK', 'KNOWN TRAVELER', 'TRUSTED TRAVELER'], manual: false },
    { name: 'Dining/OpenTable Credit', amount: 300, keywords: ['DINING CREDIT', 'OPENTABLE'], manual: false },
    { name: 'The Edit Hotels', amount: 500, keywords: ['THE EDIT'], manual: false },
    { name: 'DoorDash Restaurant Credit', amount: 60, keywords: [], manual: true }, // $5/month in-app
    { name: 'DoorDash Grocery Credit', amount: 240, keywords: [], manual: true }, // 2x $10/month in-app
    { name: 'DashPass Membership', amount: 120, keywords: [], manual: true }, // $9.99/month value
    { name: 'StubHub', amount: 300, keywords: ['STUBHUB', 'VIAGOGO'], manual: false },
    { name: 'Lyft Credit', amount: 120, keywords: [], manual: true },
    { name: 'Peloton', amount: 120, keywords: ['PELOTON'], manual: false },
    { name: 'Apple Music/TV+', amount: 288, keywords: [], manual: true },
  ],
  categories: ['chase-travel', 'flights-direct', 'hotels-direct', 'dining', 'lyft', 'other'],
  // Portal bonuses: flat 8x on all Chase Travel (no sub-type differentiation)
  // Note: Legacy rates (10x before Oct 2025) are handled by the plugin hook below.
  portalBonuses: {
    'chase-travel': {
      defaultRate: 8
    }
  },
  // Lyft partnership: 10x from Jan 12, 2020 to March 31, 2025, then 5x after
  lyftPartnershipStart: '2020-01-12',
  lyft10xEndDate: '2025-04-01', // After this date, CSR gets 5x instead of 10x
  // Legacy CSR (before Oct 26, 2025): different earning structure, lower annual fee
  legacyCutoffDate: '2025-10-26',
  legacyAnnualFee: 550,
  legacy: {
    multipliers: { 'chase-travel': 10, 'travel': 3, 'dining': 3, 'lyft': 10 },
    baseRate: 1,
    categories: ['chase-travel', 'travel', 'dining', 'lyft', 'other']
  },

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    var card = this;

    // Lyft partnership date-dependent logic
    if (category === 'lyft' && card.lyftPartnershipStart) {
      var lyftStart = new Date(card.lyftPartnershipStart);
      var txnDateObj = txnDate ? new Date(txnDate) : new Date();

      if (txnDateObj >= lyftStart) {
        // CSR had 10x Lyft until April 1, 2025, then 5x after
        if (card.lyft10xEndDate) {
          var lyft10xEnd = new Date(card.lyft10xEndDate);
          if (txnDateObj < lyft10xEnd) {
            return { rate: 10, reason: '10x Lyft (Chase partnership 2020-2025)' };
          }
        }
        // After April 1, 2025: use defined multiplier (5x)
        if (card.multipliers['lyft']) {
          return { rate: card.multipliers['lyft'], reason: card.multipliers['lyft'] + 'x Lyft (Chase partnership)' };
        }
      }
      // Before partnership start — fall through to default
    }

    // Legacy CSR rates (before Oct 26, 2025)
    if (card.legacyCutoffDate) {
      var csrCutoff = new Date(card.legacyCutoffDate);
      var txnDateObj2 = txnDate ? new Date(txnDate) : new Date();

      if (txnDateObj2 < csrCutoff) {
        if (category === 'chase-travel') return { rate: 10, reason: '10x Chase Travel (Legacy CSR)' };
        if (category === 'dining') return { rate: 3, reason: '3x dining (Legacy CSR)' };

        // Legacy CSR had 3x on ALL travel — walk up hierarchy
        var checkCat = category;
        while (checkCat) {
          if (checkCat === 'travel' || checkCat === 'flights-direct' ||
              checkCat === 'hotels-direct' || checkCat === 'car-rental' ||
              checkCat === 'transit' || checkCat === 'cruise' ||
              checkCat === 'vacation-rental' || checkCat === 'airbnb') {
            return { rate: 3, reason: '3x travel (Legacy CSR — ' + category + ')' };
          }
          checkCat = ctx.CATEGORY_HIERARCHY[checkCat];
        }

        return { rate: 1, reason: '1x base (Legacy CSR)' };
      }
    }

    // Post-legacy: fall through to default multiplier logic
    return null;
  },

  getCategories: function(txnDate, ctx) {
    var card = this;
    if (card.legacyCutoffDate) {
      var csrCutoff = new Date(card.legacyCutoffDate);
      var txnDateObj = txnDate ? new Date(txnDate) : new Date();
      if (txnDateObj < csrCutoff) {
        return card.legacy.categories || ['chase-travel', 'travel', 'dining', 'lyft', 'other'];
      }
    }
    return card.categories;
  },

  getAnnualFee: function(transactions, detectedFees, ctx) {
    var card = this;
    // Detected fees are checked by the default handler first — this hook is only
    // called when no detected fee was found. Handle legacy fee here.
    if (card.legacyCutoffDate) {
      var cutoff = new Date(card.legacyCutoffDate);
      var cardTxns = transactions.filter(function(t) { return t.cardId === 'chase-sapphire-reserve'; });
      var hasPostCutoff = cardTxns.some(function(t) {
        return new Date(t.date) >= cutoff;
      });
      return hasPostCutoff ? card.annualFee : card.legacyAnnualFee;
    }
    return null; // Use default
  },
};
