window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['chase-sapphire-preferred'] = {
  name: 'Chase Sapphire Preferred',
  shortName: 'Sapphire Preferred',
  annualFee: 95,
  pointValue: 0.018,
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
  lyftPartnershipStart: '2020-01-12',

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    var card = this;

    // Lyft partnership date-dependent logic
    if (category === 'lyft' && card.lyftPartnershipStart) {
      var lyftStart = new Date(card.lyftPartnershipStart);
      var txnDateObj = txnDate ? new Date(txnDate) : new Date();

      if (txnDateObj >= lyftStart && card.multipliers['lyft']) {
        return { rate: card.multipliers['lyft'], reason: card.multipliers['lyft'] + 'x Lyft (Chase partnership)' };
      }
      // Before partnership start — fall through to default (Lyft as transit/travel)
    }

    // Streaming keyword validation: only give streaming bonus when merchant matches approved service
    if (category === 'streaming' && card.streamingKeywords && merchantDesc) {
      var normDesc = merchantDesc.toLowerCase().replace(/[^a-z0-9\s.+]/g, '');
      var matched = card.streamingKeywords.some(function(kw) { return normDesc.includes(kw); });
      if (!matched) {
        return { rate: card.baseRate, reason: card.baseRate + 'x base rate (streaming service not in ' + (card.shortName || card.name) + ' bonus list)' };
      }
      // Matched — fall through to standard multiplier (3x streaming)
    }

    // No other special logic — fall through to default
    return null;
  },
};
