window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['capital-one-venture-x'] = {
  name: 'Capital One Venture X',
  shortName: 'Venture X',
  annualFee: 395,
  // Point value varies by redemption: ~0.01 for statement credit, ~0.016+ for travel transfers/portal.
  // 0.016 is a reasonable default for "miles" style points.
  pointValue: 0.016,
  // Capital One Travel portal: 10x on hotels & rental cars, 5x on flights & vacation rentals.
  // Default to 5x (conservative); getMultiplier() upgrades to 10x when hotel/rental car keywords detected.
  multipliers: { 'capital-one-travel': 5 },
  baseRate: 2,
  credits: [
    // Note: Descriptor may vary (e.g., "CAPITAL ONE TRAVEL CREDIT", "C1 TRAVEL CREDIT", or generic "TRAVEL CREDIT").
    // Keywords cast a wider net; some false positives are possible with generic "TRAVEL CREDIT".
    { name: 'Capital One Travel Credit', amount: 300, keywords: ['CAPITAL ONE TRAVEL CREDIT', 'C1 TRAVEL CREDIT', 'CAPITAL ONE TRAVEL', 'TRAVEL CREDIT'], manual: false, frequency: 'annual', resetBasis: 'anniversary' },
    // Typically once every ~4 years, but treated as annualized value for ROI purposes.
    { name: 'Global Entry / TSA PreCheck (every 4 years)', amount: 120, keywords: ['GLOBAL ENTRY', 'TSA PRECHECK', 'KNOWN TRAVELER', 'TRUSTED TRAVELER'], manual: false, frequency: 'none' }
  ],
  categories: ['capital-one-travel', 'other'],
  // 10,000 bonus miles awarded each cardholder anniversary (not a statement credit)
  annualBonusPoints: 10000,

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    // Portal bookings: 10x on hotels & rental cars, 5x on everything else
    if (category === 'capital-one-travel' && merchantDesc) {
      var normDesc = merchantDesc.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      var hotelKeywords = ['marriott', 'hilton', 'hyatt', 'ihg', 'wyndham', 'best western', 'radisson',
        'sheraton', 'westin', 'ritz', 'four seasons', 'mgm', 'caesars', 'flamingo',
        'venetian', 'bellagio', 'cosmopolitan'];
      var carRentalKeywords = ['hertz', 'enterprise', 'avis', 'budget', 'national car', 'alamo',
        'dollar rent', 'thrifty', 'sixt', 'zipcar'];
      for (var i = 0; i < hotelKeywords.length; i++) {
        if (normDesc.includes(hotelKeywords[i])) {
          return { rate: 10, reason: '10x Capital One Travel (hotel: ' + hotelKeywords[i] + ')' };
        }
      }
      for (var j = 0; j < carRentalKeywords.length; j++) {
        if (normDesc.includes(carRentalKeywords[j])) {
          return { rate: 10, reason: '10x Capital One Travel (rental car: ' + carRentalKeywords[j] + ')' };
        }
      }
      return { rate: 5, reason: '5x Capital One Travel (default — flights/vacation rentals/unknown)' };
    }
    return null; // Fall through to default
  },
};
