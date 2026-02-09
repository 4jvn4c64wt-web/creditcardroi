window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['capital-one-venture-x'] = {
  name: 'Capital One Venture X',
  shortName: 'Venture X',
  annualFee: 395,
  // Point value varies by redemption: ~0.01 for statement credit, ~0.015+ for travel transfers/portal.
  // 0.015 is a reasonable default for "miles" style points.
  pointValue: 0.015,
  // Capital One Travel portal: 10x on hotels & rental cars, 5x on flights & vacation rentals.
  // Default to 5x (conservative); getMultiplier() upgrades to 10x when hotel/rental car keywords detected.
  multipliers: { 'capital-one-travel': 5 },
  baseRate: 2,
  credits: [
    // Note: Descriptor may vary (e.g., "CAPITAL ONE TRAVEL CREDIT", "C1 TRAVEL CREDIT", or generic "TRAVEL CREDIT").
    // Keywords cast a wider net; some false positives are possible with generic "TRAVEL CREDIT".
    { name: 'Capital One Travel Credit', amount: 300, keywords: ['CAPITAL ONE TRAVEL CREDIT', 'C1 TRAVEL CREDIT', 'CAPITAL ONE TRAVEL', 'TRAVEL CREDIT'], manual: false },
    // Typically once every ~4 years, but treated as annualized value for ROI purposes.
    { name: 'Global Entry / TSA PreCheck', amount: 120, keywords: ['GLOBAL ENTRY', 'TSA PRECHECK', 'KNOWN TRAVELER', 'TRUSTED TRAVELER'], manual: false }
  ],
  categories: ['capital-one-travel', 'other'],
  // 10,000 bonus miles awarded each cardholder anniversary (not a statement credit)
  annualBonusPoints: 10000
};
