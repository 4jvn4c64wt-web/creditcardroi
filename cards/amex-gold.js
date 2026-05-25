window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['amex-gold'] = {
  name: 'American Express Gold',
  shortName: 'Amex Gold',
  annualFee: 325,
  pointValue: 0.016,
  // hotels-amex-travel: 2x before Apr 30 2026, 5x after (Apr 30 2026 refresh)
  multipliers: { 'dining': 4, 'grocery': 4, 'flights-direct': 3, 'amex-travel': 3, 'hotels-amex-travel': 5 },
  baseRate: 1,
  credits: [
    { name: 'Uber Cash', amount: 120, keywords: [], manual: true, frequency: 'monthly' },
    // Dining Credit partners as of Apr 30 2026: Buffalo Wild Wings and Wonder added immediately.
    // Goldbelly and Wine.com removed after Jun 30 2026. Five Guys and Cheesecake Factory remain.
    // Pre-Apr-30-2026 partners (Goldbelly, Wine.com, Milkbar) handled via date logic in getCredit hook.
    { name: 'Dining Credit', amount: 120, keywords: ['DINING CREDIT', 'GRUBHUB', 'SEAMLESS', 'CHEESECAKE FACTORY', 'FIVE GUYS', 'BUFFALO WILD WINGS', 'BWW', 'WONDER', 'GOLDBELLY', 'WINE.COM', 'MILKBAR'], manual: false, frequency: 'monthly' },
    { name: 'Resy Credit', amount: 100, keywords: ['RESY'], manual: false, frequency: 'semi-annual' },
    { name: 'Dunkin Credit', amount: 84, keywords: ['DUNKIN'], manual: false, frequency: 'monthly' },
  ],
  categories: ['dining', 'grocery', 'flights-direct', 'amex-travel', 'hotels-amex-travel', 'other'],

  // Apr 30 2026 refresh cutoff dates
  hotelMultiplierRefreshDate: '2026-04-30', // hotels-amex-travel: 2x before, 5x after
  diningCreditPartnerChangeDate: '2026-07-01', // Goldbelly + Wine.com valid before this date; BWW + Wonder valid after Apr 30

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    var card = this;

    // hotels-amex-travel: 2x before Apr 30 2026, 5x from Apr 30 2026 onward
    if (category === 'hotels-amex-travel' && card.hotelMultiplierRefreshDate) {
      var refreshDate = new Date(card.hotelMultiplierRefreshDate);
      var txnDateObj = txnDate ? new Date(txnDate) : new Date();
      if (txnDateObj < refreshDate) {
        return { rate: 2, reason: '2x Amex Travel hotels (pre-Apr 2026 rate)' };
      }
      return { rate: 5, reason: '5x Amex Travel hotels (Apr 2026 refresh)' };
    }

    return null; // Fall through to default
  },
};
