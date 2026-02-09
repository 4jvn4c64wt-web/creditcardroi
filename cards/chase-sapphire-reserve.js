window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['chase-sapphire-reserve'] = {
  name: 'Chase Sapphire Reserve',
  shortName: 'Sapphire Reserve',
  annualFee: 795,
  pointValue: 0.017,
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
  }
};
