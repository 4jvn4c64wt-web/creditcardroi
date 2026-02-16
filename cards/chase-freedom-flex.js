window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['chase-freedom-flex'] = {
  name: 'Chase Freedom Flex',
  shortName: 'Freedom Flex',
  annualFee: 0,
  // Cash back card (1 cpp) unless paired with Sapphire Preferred/Reserve, which enables UR transfer (1.8 cpp)
  pointValue: 0.01,
  multipliers: { 'chase-travel': 5, 'dining': 3, 'drugstore': 3 },
  baseRate: 1,
  credits: [],
  categories: ['chase-travel', 'dining', 'drugstore', 'other'], // Base categories, expanded by quarterly selection
  // Quarterly rotating 5% categories (select 1)
  selectableCategories: {
    fivePercent: [
      'grocery', 'gas', 'dining', 'streaming', 'fitness', 'spa-self-care',
      'amazon', 'whole-foods', 'target', 'walmart', 'ebay', 'paypal',
      'hotels-direct', 'chase-travel', 'car-rental', 'ev-charging',
      'movies', 'live-entertainment', 'home-improvement', 'lowes',
      'wholesale-club', 'internet-cable-phone', 'pet', 'charity', 'mcdonalds'
    ]
  }
};
