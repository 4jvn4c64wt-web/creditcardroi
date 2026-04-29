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
  earningRatesNote: '+ quarterly bonus categories shown above',
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

  getDisplayRate: function(category, txnDate, ctx) {
    var txnYear, txnQuarter;
    if (txnDate) {
      if (txnDate.includes('-')) {
        var parts = txnDate.split('-').map(Number);
        txnYear = parts[0];
        txnQuarter = 'Q' + Math.ceil(parts[1] / 3);
      } else if (txnDate.includes('/')) {
        var parts2 = txnDate.split('/');
        var month = parseInt(parts2[0]);
        txnYear = parseInt(parts2[2]);
        if (txnYear < 100) txnYear += 2000;
        txnQuarter = 'Q' + Math.ceil(month / 3);
      }
    }
    if (!txnYear) {
      var now = new Date();
      txnYear = now.getFullYear();
      txnQuarter = 'Q' + Math.ceil((now.getMonth() + 1) / 3);
    }
    var quarterKey = txnYear + '-' + txnQuarter;
    var cffEntries = (ctx.cffQuarterlyData || {})[quarterKey] || [];
    var entry = cffEntries.find(function(e) { return e.key === category; });
    if (entry) return { rate: entry.rate, bonus: true };
    var card = this;
    if (card.multipliers[category]) return { rate: card.multipliers[category], bonus: true };
    return { rate: card.baseRate, bonus: false };
  },

  getCategoryFilter: function(txnDate, currentCategory, ctx) {
    var txnYear, txnQuarter;
    if (txnDate) {
      if (txnDate.includes('-')) {
        var parts = txnDate.split('-').map(Number);
        txnYear = parts[0];
        txnQuarter = 'Q' + Math.ceil(parts[1] / 3);
      } else if (txnDate.includes('/')) {
        var parts2 = txnDate.split('/');
        var month = parseInt(parts2[0]);
        txnYear = parseInt(parts2[2]);
        if (txnYear < 100) txnYear += 2000;
        txnQuarter = 'Q' + Math.ceil(month / 3);
      }
    }
    if (!txnYear) {
      var now = new Date();
      txnYear = now.getFullYear();
      txnQuarter = 'Q' + Math.ceil((now.getMonth() + 1) / 3);
    }
    var quarterKey = txnYear + '-' + txnQuarter;
    var cffEntries = (ctx.cffQuarterlyData || {})[quarterKey] || [];
    var baseCats = ['chase-travel', 'dining', 'drugstore'];
    var quarterlyCats = cffEntries.map(function(e) { return e.key; });
    var allowed = baseCats.concat(quarterlyCats).concat(['other']);
    return allowed.filter(function(c, i, arr) { return arr.indexOf(c) === i; });
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

  renderConfigSection: function(cardId, ctx) {
    var ALL_CFF_LABELS = {
      'amazon': 'Amazon', 'car-rental': 'Rental Cars', 'charity': 'Charities',
      'chase-travel': 'Chase Travel', 'clothing': 'Clothing', 'cruise': 'Cruises',
      'department-stores': 'Department Stores', 'dining': 'Dining',
      'ebay': 'eBay', 'ev-charging': 'EV Charging', 'fast-food': 'Fast Food',
      'fitness': 'Gyms & Fitness', 'gas': 'Gas Stations', 'grocery': 'Grocery Stores',
      'home-improvement': 'Home Improvement', 'insurance': 'Insurance',
      'internet-cable-phone': 'Internet/Cable/Phone', 'live-entertainment': 'Live Entertainment',
      'lowes': "Lowe's", 'movies': 'Movie Theaters', 'online-grocery': 'Online Grocery',
      'paypal': 'PayPal', 'pet': 'Pet & Vet', 'spa-self-care': 'Spa & Self Care',
      'streaming': 'Streaming Services', 'target': 'Target', 'tax': 'Tax Preparation',
      'walmart': 'Walmart', 'whole-foods': 'Whole Foods', 'wholesale-club': 'Wholesale Clubs'
    };
    var QUARTERS = [
      { id: 'Q1', name: 'Q1 (Jan-Mar)' },
      { id: 'Q2', name: 'Q2 (Apr-Jun)' },
      { id: 'Q3', name: 'Q3 (Jul-Sep)' },
      { id: 'Q4', name: 'Q4 (Oct-Dec)' }
    ];

    var CFF_DATA = ctx.cffQuarterlyData;
    var txnYears = [];
    var seen = {};
    var txns = ctx.state.transactions || [];
    for (var i = 0; i < txns.length; i++) {
      var y = ctx.getYearFromDateString(txns[i].date);
      if (!seen[y]) { seen[y] = true; txnYears.push(y); }
    }
    txnYears.sort(function(a, b) { return b - a; });
    var currentYear = new Date().getFullYear();
    var availableYears = txnYears.length > 0 ? txnYears : [currentYear];

    // Also include years that have stored quarterly data
    var storedYearsSeen = {};
    var storedYears = [];
    var cffKeys = Object.keys(CFF_DATA);
    for (var ki = 0; ki < cffKeys.length; ki++) {
      var sy = parseInt(cffKeys[ki].split('-')[0]);
      if (!storedYearsSeen[sy]) { storedYearsSeen[sy] = true; storedYears.push(sy); }
    }
    // Merge and deduplicate
    var allYearsSeen = {};
    var allCFFYears = [];
    var merged = availableYears.concat(storedYears);
    for (var mi = 0; mi < merged.length; mi++) {
      if (!allYearsSeen[merged[mi]]) { allYearsSeen[merged[mi]] = true; allCFFYears.push(merged[mi]); }
    }
    allCFFYears.sort(function(a, b) { return b - a; });
    var selectedCFFYear = ctx.state.selectedCFFYear || allCFFYears[0];

    var html = '<div id="quarterlySection">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<h3 style="font-size:14px;font-weight:600;">Quarterly Bonus Categories</h3>' +
        '<select id="cffYearSelect" class="form-select" style="min-width:100px;padding:6px 10px;">';
    for (var yi = 0; yi < allCFFYears.length; yi++) {
      html += '<option value="' + allCFFYears[yi] + '"' + (allCFFYears[yi] === selectedCFFYear ? ' selected' : '') + '>' + allCFFYears[yi] + '</option>';
    }
    html += '</select></div>' +
      '<p style="font-size:12px;color:#78716c;margin-bottom:4px;">Chase Freedom Flex rotating bonus categories are automatically applied based on quarter.</p>' +
      '<p style="font-size:11px;color:#a8a29e;margin-bottom:12px;">$1,500 cap per quarter. Card also earns 5x Chase Travel, 3x dining/drugstores.</p>' +
      '<div id="cffQuarters">';

    for (var qi = 0; qi < QUARTERS.length; qi++) {
      var q = QUARTERS[qi];
      var yearQuarterKey = selectedCFFYear + '-' + q.id;
      var entries = CFF_DATA[yearQuarterKey] || [];
      var isCurrentQuarter = selectedCFFYear === currentYear && ctx.getCurrentQuarter() === q.id;
      var activeKeys = {};
      for (var ei = 0; ei < entries.length; ei++) activeKeys[entries[ei].key] = entries[ei];

      var entryCountLabel = entries.length > 0
        ? entries.length + ' bonus categor' + (entries.length === 1 ? 'y' : 'ies')
        : 'No data';

      html += '<details style="margin-bottom:12px;border:1px solid #e7e5e4;border-radius:8px;' + (isCurrentQuarter ? 'border-color:#059669;' : '') + '"' + (isCurrentQuarter ? ' open' : '') + '>' +
        '<summary style="padding:12px;cursor:pointer;font-weight:500;font-size:13px;background:' + (isCurrentQuarter ? '#dcfce7' : '#fafaf9') + ';border-radius:7px;list-style:none;display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + q.name + (isCurrentQuarter ? ' (Current)' : '') + '</span>' +
          '<span style="font-size:11px;color:#78716c;">' + entryCountLabel + '</span>' +
        '</summary>' +
        '<div style="padding:12px;">';

      if (entries.length > 0) {
        html += '<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;">';
        var labelKeys = Object.keys(ALL_CFF_LABELS);
        for (var li = 0; li < labelKeys.length; li++) {
          var key = labelKeys[li];
          var genericLabel = ALL_CFF_LABELS[key];
          var entry = activeKeys[key] || null;
          var isActive = !!entry;
          var displayLabel = entry ? entry.label : genericLabel;
          var monthName = entry && entry.monthOnly ? new Date(2000, entry.monthOnly - 1).toLocaleString('en', {month: 'short'}) : '';
          var rateLabel = entry ? entry.rate + '%' : '';

          html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid ' + (isActive ? '#059669' : '#f0eeec') + ';border-radius:4px;font-size:11px;' + (isActive ? 'background:#dcfce7;font-weight:600;color:#1a1a1a;' : 'background:#fafaf9;color:#c4c0bc;') + '">' +
            (isActive ? '<span style="color:#059669;flex-shrink:0;">&#10003;</span>' : '<span style="flex-shrink:0;visibility:hidden;">&#10003;</span>') +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + ctx.escapeHtml(displayLabel) + (monthName ? ' (' + monthName + ' only)' : '') + '">' + ctx.escapeHtml(displayLabel) + '</span>' +
            (isActive ? '<span style="margin-left:auto;font-size:10px;color:#059669;flex-shrink:0;white-space:nowrap;">' + rateLabel + (monthName ? ' <span style="font-size:9px;color:#78716c;">(' + monthName + ')</span>' : '') + '</span>' : '') +
          '</div>';
        }
        html += '</div>';
      } else {
        html += '<div style="font-size:12px;color:#a8a29e;font-style:italic;">No quarterly category data available for this period.</div>';
      }

      html += '</div></details>';
    }

    html += '</div></div>';
    return html;
  },

  attachConfigListeners: function(cardId, ctx) {
    var cffYearSelect = document.getElementById('cffYearSelect');
    if (cffYearSelect) {
      cffYearSelect.addEventListener('change', function(e) {
        ctx.state.selectedCFFYear = parseInt(e.target.value);
        ctx.renderCardConfig();
      });
    }
  },

  pluginState: {
    keys: [{ stateKey: 'cffCategories', localStorageKey: 'ccTracker_cffCategories', default: {} }],
    exportState: function(ctx) { return { cffCategories: ctx.state.cffCategories }; },
    importState: function(data, ctx) {
      if (data.cffCategories) {
        ctx.state.cffCategories = data.cffCategories;
        ctx.safeLocalStorageSet('ccTracker_cffCategories', data.cffCategories);
      }
    },
    clearState: function(ctx) {
      ctx.state.cffCategories = {};
      localStorage.removeItem('ccTracker_cffCategories');
    }
  },
};
