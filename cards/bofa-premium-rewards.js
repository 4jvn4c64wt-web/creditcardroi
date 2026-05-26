window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['bofa-premium-rewards'] = {
  name: 'Bank of America Premium Rewards',
  shortName: 'BofA Premium Rewards',
  annualFee: 95,
  // Points worth $0.01 each (1 cpp) for cash, travel portal, or gift cards.
  pointValue: 0.01,
  // 2x on travel and dining, 1.5x on everything else.
  multipliers: { 'travel': 2, 'dining': 2 },
  baseRate: 1.5,
  credits: [
    // Up to $100/year for airline incidental fees (baggage, seat upgrades, in-flight purchases, etc.).
    // Does NOT include airfare ticket purchases. Covers select U.S. domestic carriers only.
    // Excludes Allegiant Air, Spirit Airlines, Sun Country Airlines.
    { name: 'Airline Incidental Credit', amount: 100, keywords: ['AIRLINE INCIDENTAL', 'AIRLINE', 'INCIDENTAL'], manual: false },
    // Up to $100 every 4 years for TSA PreCheck or Global Entry application fee.
    // Annualized value: $25/year ($100 / 4 years).
    { name: 'Global Entry / TSA PreCheck (every 4 years)', amount: 100, keywords: ['GLOBAL ENTRY', 'TSA PRECHECK', 'KNOWN TRAVELER', 'TRUSTED TRAVELER'], manual: false, frequency: 'none' },
  ],
  categories: ['travel', 'dining', 'other'],

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    // Walk up hierarchy for travel (airlines, hotels, transit, car rental, etc.)
    // BofA's travel definition is broad: airlines, hotels, car rental, transit, parking, cruises, etc.
    var travelCategories = ['travel', 'flights-direct', 'flights-portal', 'hotels-direct', 'hotels-portal',
      'car-rental', 'transit', 'cruise', 'parking', 'ground-transport'];

    var checkCat = category;
    while (checkCat) {
      if (travelCategories.indexOf(checkCat) >= 0) {
        return { rate: 2, reason: '2x travel (BofA broad travel category)' };
      }
      checkCat = ctx.CATEGORY_HIERARCHY[checkCat];
    }

    // Walk up hierarchy for dining
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
