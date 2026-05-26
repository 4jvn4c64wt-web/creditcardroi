window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['bofa-travel-rewards'] = {
  name: 'Bank of America Travel Rewards',
  shortName: 'BofA Travel Rewards',
  annualFee: 0,
  // Points worth $0.01 when redeemed as travel credit (statement credit against travel/dining).
  // Worth $0.006 as cash. Use $0.01 as default since travel redemption is the intended use case.
  pointValue: 0.01,
  // 3x at BofA Travel Center portal, 1.5x on everything else.
  // Portal bookings classified as 'bofa-travel' category; all other travel is base rate.
  multipliers: { 'bofa-travel': 3 },
  baseRate: 1.5,
  credits: [],
  categories: ['bofa-travel', 'other'],

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    // BofA Travel Center portal: 3x.
    // Auto-detect via merchant descriptor (cxLoyalty / CX* = CX Loyalty, BofA's portal vendor).
    // Also matches manual 'bofa-travel' category assignment.
    if (category === 'bofa-travel') {
      return { rate: 3, reason: '3x BofA Travel Center portal' };
    }
    if (merchantDesc) {
      var desc = merchantDesc.toLowerCase();
      if (desc.indexOf('cxloyalty') >= 0 || desc.indexOf('cx*') >= 0 || desc.indexOf('bofa travel center') >= 0) {
        return { rate: 3, reason: '3x BofA Travel Center portal (auto-detected)' };
      }
    }
    return null; // Fall through to baseRate (1.5x)
  },
};
