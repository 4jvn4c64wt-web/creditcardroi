window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['amazon-prime'] = {
  name: 'Amazon Prime Rewards Visa',
  shortName: 'Amazon Prime',
  annualFee: 0,
  pointValue: 0.01,
  multipliers: { 'amazon': 5, 'whole-foods': 5, 'gas': 2, 'transit': 2, 'dining': 2 },
  baseRate: 1,
  credits: [],
  categories: ['amazon', 'whole-foods', 'gas', 'transit', 'dining', 'other']
};
