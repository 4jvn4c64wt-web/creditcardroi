window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['bofa-premium-rewards-elite'] = {
  name: 'Bank of America Premium Rewards Elite',
  shortName: 'BofA PR Elite',
  annualFee: 550,
  // Points worth $0.01 each (1 cpp) for cash, travel portal, or gift cards.
  // Air Savings Program: 20% off airfare when redeeming points via BofA Travel Center
  // (effectively $0.0125/point for airfare bookings). Use standard $0.01 as default.
  pointValue: 0.01,
  // 2x on travel and dining, 1.5x on everything else.
  // Note: Elite earns 2 points (0.5 bonus + 1.5 base) vs Premium Rewards' 2 base points.
  // Functionally identical earn rate — difference is in how BofA structures bonus vs base.
  multipliers: { 'travel': 2, 'dining': 2 },
  baseRate: 1.5,
  credits: [
    // Up to $300/year for airline incidental fees (seat upgrades, baggage, in-flight, lounge fees, etc.).
    // Does NOT include airfare purchases. Covers select U.S. domestic carriers only.
    // Excludes Allegiant Air, Spirit Airlines, Sun Country Airlines.
    { name: 'Airline Incidental Credit', amount: 300, keywords: ['AIRLINE INCIDENTAL', 'AIRLINE', 'INCIDENTAL'], manual: false },
    // Up to $120 every 4 years for TSA PreCheck or Global Entry application fee.
    // Annualized value: $30/year ($120 / 4 years).
    { name: 'Global Entry / TSA PreCheck (every 4 years)', amount: 120, keywords: ['GLOBAL ENTRY', 'TSA PRECHECK', 'KNOWN TRAVELER', 'TRUSTED TRAVELER'], manual: false, frequency: 'none' },
    // Up to $150/year for rideshare, food delivery, video streaming, and fitness at select merchants.
    // BofA requires both a qualifying MCC AND a "designated identifier" (internal service code) — the
    // identifier is not present in CSV exports, so auto-detection would produce false positives.
    // The qualifying MCCs span 23 codes including grocery (5411), clothing (5691), and software (5734),
    // making keyword matching against them unreliable. Manual tracking is the correct approach.
    { name: 'Lifestyle Credit', amount: 150, keywords: ['LIFESTYLE'], manual: false },
  ],
  categories: ['travel', 'dining', 'other'],

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    // Walk up hierarchy for travel (broad BofA definition: airlines, hotels, transit, car rental, parking, etc.)
    var travelCategories = ['travel', 'flights-direct', 'flights-portal', 'hotels-direct', 'hotels-portal',
      'car-rental', 'transit', 'cruise', 'parking', 'ground-transport'];

    var checkCat = category;
    while (checkCat) {
      if (travelCategories.indexOf(checkCat) >= 0) {
        return { rate: 2, reason: '2x travel (BofA broad travel category)' };
      }
      checkCat = ctx.CATEGORY_HIERARCHY[checkCat];
    }

    // Walk up hierarchy for dining (restaurants, fast food, bars/drinking establishments, caterers)
    checkCat = category;
    while (checkCat) {
      if (checkCat === 'dining') {
        return { rate: 2, reason: '2x dining' };
      }
      checkCat = ctx.CATEGORY_HIERARCHY[checkCat];
    }

    return null; // Fall through to baseRate (1.5x)
  },
};
