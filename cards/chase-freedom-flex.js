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
  },

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    var card = this;
    var quarter = txnDate ? ctx.getQuarterForDate(txnDate) : ctx.getCurrentQuarter();

    // Helper to get year from date
    function getYearFromDate(dateStr) {
      if (!dateStr) return new Date().getFullYear();
      if (dateStr.includes('-')) return parseInt(dateStr.split('-')[0]);
      if (dateStr.includes('/')) {
        var parts = dateStr.split('/');
        var yearPart = parts[2];
        return parseInt(yearPart.length === 2 ? '20' + yearPart : yearPart);
      }
      return new Date().getFullYear();
    }

    var year = getYearFromDate(txnDate);
    var yearQuarterKey = year + '-' + quarter;

    // Look up stored quarterly bonus categories
    var CFF_DATA = ctx.cffQuarterlyData;
    var quarterEntries = CFF_DATA[yearQuarterKey] || [];
    var normMerchant = (merchantDesc || '').toLowerCase();

    // Helper to parse transaction month (1-12)
    function getTxnMonth(dateStr) {
      if (!dateStr) return new Date().getMonth() + 1;
      if (dateStr.includes('-')) return parseInt(dateStr.split('-')[1]);
      if (dateStr.includes('/')) return parseInt(dateStr.split('/')[0]);
      return new Date().getMonth() + 1;
    }

    // Check each stored quarterly category for a match
    for (var i = 0; i < quarterEntries.length; i++) {
      var entry = quarterEntries[i];

      // Month-only restriction (e.g., PayPal December-only, Internet June-only)
      if (entry.monthOnly) {
        var txnMonth = getTxnMonth(txnDate);
        if (txnMonth !== entry.monthOnly) continue;
      }

      // PayPal: match by merchant description (payment wrapper, not a category)
      if (entry.key === 'paypal') {
        if (normMerchant.includes('paypal')) {
          var monthNote = entry.monthOnly ? ' ' + new Date(2000, entry.monthOnly - 1).toLocaleString('en', {month: 'long'}) : '';
          return { rate: entry.rate, reason: entry.rate + '% PayPal (' + year + ' ' + quarter + monthNote + ')' };
        }
        continue;
      }

      // Merchant-keyword entries: match by merchant description or exact category match
      if (entry.merchantKeywords) {
        var matched = false;
        for (var k = 0; k < entry.merchantKeywords.length; k++) {
          if (normMerchant.includes(entry.merchantKeywords[k])) { matched = true; break; }
        }
        if (matched) {
          return { rate: entry.rate, reason: entry.rate + '% ' + entry.label + ' (' + year + ' ' + quarter + ' bonus)' };
        }
        // Also match if category was manually assigned to exactly this entry's key
        if (category === entry.key) {
          return { rate: entry.rate, reason: entry.rate + '% ' + entry.label + ' (' + year + ' ' + quarter + ' bonus)' };
        }
        continue; // No keyword or category match - skip this entry entirely
      }

      // Category-based: walk up the transaction's category hierarchy to find a match
      var checkCat = category;
      while (checkCat) {
        if (checkCat === entry.key) {
          var reason = checkCat !== category
            ? entry.rate + '% ' + entry.label + ' (from ' + category + ', ' + year + ' ' + quarter + ')'
            : entry.rate + '% ' + entry.label + ' (' + year + ' ' + quarter + ' bonus)';
          return { rate: entry.rate, reason: reason };
        }
        checkCat = ctx.CATEGORY_HIERARCHY[checkCat];
      }
    }

    // Check static multipliers with hierarchy (chase-travel 5x, dining 3x, drugstore 3x)
    var effectiveCat = ctx.getEffectiveCategory(category, 'chase-freedom-flex');
    if (card.multipliers[effectiveCat]) {
      var rate = card.multipliers[effectiveCat];
      if (effectiveCat !== category) {
        return { rate: rate, reason: rate + 'x ' + effectiveCat + ' (from ' + category + ')' };
      }
      return { rate: rate, reason: rate + 'x ' + effectiveCat };
    }

    return { rate: card.baseRate, reason: card.baseRate + 'x base rate' };
  },

  getCategories: function(txnDate, ctx) {
    // Dynamically derive all possible quarterly categories from cffQuarterlyData
    var baseCats = ['chase-travel', 'dining', 'drugstore'];
    var CFF_DATA = ctx.cffQuarterlyData;
    var allQuarterlyKeys = {};
    for (var qKey in CFF_DATA) {
      var entries = CFF_DATA[qKey];
      for (var i = 0; i < entries.length; i++) {
        allQuarterlyKeys[entries[i].key] = true;
      }
    }
    var allKeys = baseCats.concat(Object.keys(allQuarterlyKeys)).concat(['other']);
    // Deduplicate
    var seen = {};
    var unique = [];
    for (var j = 0; j < allKeys.length; j++) {
      if (!seen[allKeys[j]]) {
        seen[allKeys[j]] = true;
        unique.push(allKeys[j]);
      }
    }
    return unique;
  },

  getScenarioMultiplier: function(category, ctx) {
    // Forward-looking: skip quarterly bonus lookup, use only static multipliers
    var card = this;
    var effectiveCat = ctx.getEffectiveCategory(category, 'chase-freedom-flex');
    if (card.multipliers[effectiveCat]) {
      var rate = card.multipliers[effectiveCat];
      return { rate: rate, reason: rate + 'x ' + effectiveCat };
    }
    return { rate: card.baseRate, reason: card.baseRate + 'x base rate' };
  },

  getPointValueOverride: function(walletCardIds, ctx) {
    // CFF paired with Sapphire enables UR transfer (1.8 cpp instead of 1 cpp)
    if (walletCardIds.indexOf('chase-sapphire-preferred') >= 0 ||
        walletCardIds.indexOf('chase-sapphire-reserve') >= 0) {
      return 0.018;
    }
    return null;
  },
};
