window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['chase-sapphire-preferred'] = {
  name: 'Chase Sapphire Preferred',
  shortName: 'Sapphire Preferred',
  annualFee: 95,
  pointValue: 0.017,
  multipliers: { 'chase-travel': 5, 'dining': 3, 'streaming': 3, 'online-grocery': 3, 'travel': 2, 'lyft': 5 },
  baseRate: 1,
  credits: [
    { name: 'Hotel Credit (Chase Travel)', amount: 50, keywords: ['CHASE TRAVEL'], manual: false },
    { name: 'DoorDash Grocery Credit', amount: 120, keywords: [], manual: true }, // $10/month in-app
    { name: 'DashPass Membership', amount: 120, keywords: [], manual: true }, // $9.99/month value
  ],
  categories: ['chase-travel', 'dining', 'streaming', 'online-grocery', 'travel', 'lyft', 'other'],
  // CSP 3x streaming only applies to these specific services (per Chase terms)
  streamingKeywords: [
    'apple music', 'apple tv',
    'disney+', 'disney plus',
    'fubo',
    'hbo', 'hbo max', 'max ', 'helpmaxcom',
    'hulu',
    'netflix',
    'pandora',
    'paramount', 'paramount+', 'paramount plus',
    'peacock',
    'showtime', 'sho ',
    'sirius', 'siriusxm',
    'sling',
    'spotify',
    'vudu',
    'youtube premium', 'youtube tv'
  ],
  // Lyft partnership started Jan 12, 2020
  lyftPartnershipStart: '2020-01-12'
};
