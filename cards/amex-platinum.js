window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['amex-platinum'] = {
  name: 'American Express Platinum',
  shortName: 'Amex Plat',
  annualFee: 895,
  pointValue: 0.016,
  multipliers: { 'flights-direct': 5, 'amex-travel': 5 },
  baseRate: 1,
  credits: [
    { name: 'Hotel Credit', amount: 600, keywords: ['FINE HOTELS', 'FHR', 'HOTEL COLLECTION'], manual: false },
    { name: 'Resy Dining', amount: 400, keywords: ['RESY'], manual: false },
    { name: 'Lululemon', amount: 300, keywords: ['LULULEMON'], manual: false },
    { name: 'Digital Entertainment', amount: 300, keywords: ['DIGITAL ENTERTAINMENT', 'ENTERTAINMENT CREDIT'], manual: false },
    { name: 'Airline Incidental', amount: 200, keywords: ['AIRLINE FEE', 'AIRLINE CREDIT'], manual: false },
    { name: 'Uber One Credit', amount: 96, keywords: ['UBER ONE', 'PLATINUM UBER ONE'], manual: false },
    { name: 'Uber Cash', amount: 200, keywords: [], manual: true },
    { name: 'CLEAR+', amount: 209, keywords: ['CLEAR', 'CLEARME', 'CLEAR PLUS', 'AMEX CLEAR'], manual: false },
    { name: 'Saks', amount: 100, keywords: ['SAKS'], manual: false },
    { name: 'Equinox', amount: 300, keywords: ['EQUINOX'], manual: false },
    { name: 'Walmart+', amount: 155.40, keywords: ['WALMART+', 'WALMART PLUS'], manual: false, streamingBenefit: true },
    { name: 'Global Entry/TSA PreCheck', amount: 120, keywords: ['GLOBAL ENTRY', 'TSA PRECHECK', 'KNOWN TRAVELER', 'TRUSTED TRAVELER'], manual: false },
  ],
  categories: ['flights-direct', 'amex-travel', 'other'],

  // Portal bonuses: 5x hotels & flights via Amex Travel, 1x everything else
  portalBonuses: {
    'amex-travel': {
      'flights-portal': 5,
      'hotels-portal': 5,
      defaultRate: 1
    }
  },
};
