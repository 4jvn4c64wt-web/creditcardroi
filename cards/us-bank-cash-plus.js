window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['us-bank-cash-plus'] = {
  name: 'U.S. Bank Cash+',
  shortName: 'Cash+',
  annualFee: 0,
  pointValue: 0.01,
  multipliers: {}, // Populated dynamically based on quarterly selections
  baseRate: 1,
  earningRatesNote: 'Based on quarterly selections above',
  credits: [],
  // Categories are dynamic based on quarterly selection
  categories: ['other'], // Base categories, expanded by getCardCategories()
  selectableCategories: {
    fivePercent: [
      'streaming', 'utilities', 'cell-phone', 'department-stores', 'electronics',
      'furniture', 'fast-food', 'fitness', 'ground-transport', 'movies',
      'sporting-goods', 'clothing'
    ],
    twoPercent: ['gas', 'grocery', 'dining']
  },

  // Category details: descriptions, rules, and merchant lists for each selectable category
  categoryDetails: {
    // =========================================================================
    // 5% CATEGORIES
    // =========================================================================
    'ground-transport': {
      name: 'Ground Transportation',
      description: 'Get 5% cash back when you use your card for purchases such as bus and passenger railway tickets, taxi fares and more. You can also get cash back on purchases for car services, like Uber and limousines!',
      keepInMind: 'It does not include purchases (such as bus and passenger railway tickets) made through travel agencies and tour operators. It also does not include purchases made at steam ships, cruise lines, freight trains, parking meters, parking garages and toll stations.',
      merchants: [
        'Amtrak', 'Lyft', 'Uber', 'car2go', 'Metra', 'Ventra',
        'Catalina Express', 'NYC Taxi', 'Washington State Ferries',
        'Clipper', 'Sound Transit', 'Yellow Cab',
        'Greyhound', 'TriMet'
      ]
    },

    'fitness': {
      name: 'Gyms/Fitness Centers',
      description: 'Earn cash back when you use your card to pay your membership fees at most sports and recreation facilities.',
      keepInMind: 'Purchases at recreational facilities that do not require membership, such as golf driving ranges, baseball batting cages and ski slopes, do not qualify. In addition, purchases made at fitness centers outside of your membership fee, like personal training or fitness classes, may not be included.',
      merchants: [
        '24 Hour Fitness', 'LA Fitness', 'Snap Fitness',
        'Anytime Fitness', 'Life Time Fitness', 'SoulCycle',
        'Crunch Fitness', 'Orangetheory Fitness', 'Weight Watchers',
        'Equinox', 'Planet Fitness', 'XSport Fitness',
        'Genesis Health Clubs', 'Pure Barre', 'ZUMBA Fitness'
      ]
    },

    'clothing': {
      name: 'Select Clothing Stores',
      description: 'Dress to the nines and earn 5% back when you shop at standalone clothing stores.',
      keepInMind: 'This category includes only the merchants listed below. U.S. Bank relies upon transaction data sent by the merchant to determine whether a purchase will qualify for the 5% Rebate in the Select Clothing Stores category.',
      merchants: [
        'Aeropostale', 'Express', 'Jos A Bank',
        'American Eagle Outfitters', 'Forever 21', 'Old Navy',
        'Ann Taylor', 'GAP', 'Talbots',
        'Banana Republic', 'J.Crew', 'The Limited',
        'Eddie Bauer'
      ]
    },

    'sporting-goods': {
      name: 'Sporting Goods Stores',
      description: 'Earn cash back on sports and outdoor equipment, including clothing and camping gear. You\'ll also earn cash back at most sports specialty stores for golf, skiing/snowboarding, exercise equipment, skate/surf shops and more.',
      keepInMind: 'This category also includes used sporting goods merchants like 2nd Wind Exercise and Play It Again Sports, as well as online purchases from merchants like backcountry.com and theclymb.com. However, there are exceptions. For example, Cabelas.com purchases do not qualify.',
      merchants: [
        'Academy Sports + Outdoors', 'Camping World', 'Orvis',
        'Backcountry.com', 'Dick\'s Sporting Goods', 'Play It Again Sports',
        'Bass Pro Shops', 'Golf Galaxy', 'REI',
        'Big 5 Sporting Goods', 'Hibbett Sports', 'Scheels',
        'Cabela\'s', 'MLB.com', 'Sportsman\'s Warehouse'
      ]
    },

    'movies': {
      name: 'Movie Theaters',
      description: 'Catch the latest movies at most cinemas and earn cash back. Refreshments earn cash back, too.',
      keepInMind: 'Video and DVD rentals (such as Redbox), online movie purchases and live theatrical performances do not qualify.',
      merchants: [
        'AMC Theatres', 'Edwards Cinemas', 'movietickets.com',
        'Atom Tickets', 'Fandango.com', 'Rave Cinema',
        'Century Theatres', 'Harkins Theatres', 'Regal Cinemas',
        'Cinemark', 'Megaplex Theatres', 'Showplace Icon Theatres'
      ]
    },

    'electronics': {
      name: 'Electronics Stores',
      description: 'Make even smarter buys when you earn cash back on the latest tech products, including televisions, computers and phones.',
      keepInMind: 'Includes most online purchases from merchants like Bestbuy.com and Frys.com. Does not include electronics purchases from telecom companies like Verizon or AT&T, or from discount stores like Target or Wal-Mart.',
      merchants: [
        'Apple Store', 'firstSTREET', 'Magnolia',
        'Best Buy', 'Fry\'s Electronics', 'Monoprice',
        'Bestbuy.com', 'Frys.com', 'Newegg.com',
        'Bose', 'h.h. gregg', 'O&M Electronics',
        'Electronic Express', 'Huppin\'s', 'Video Only'
      ]
    },

    'furniture': {
      name: 'Furniture Stores',
      description: 'Outfit your home with furniture and accessories while you pad your wallet with cash back.',
      keepInMind: 'Furniture purchases at stores like Wal-Mart, Target or Sears do not qualify. Outdoor furniture purchases from garden stores or home improvement stores do not qualify.',
      merchants: [
        'American Furniture Warehouse', 'Homemakers Furniture', 'RC Willey',
        'Art Van Furniture', 'IKEA', 'Restoration Hardware',
        'Ashley Furniture', 'La Z Boy', 'Room & Board',
        'Bob\'s Discount Furniture', 'Mattress Warehouse', 'Slumberland Furniture',
        'Ethan Allen', 'Mor', 'Steinhafels',
        'Furniture Row', 'Nebraska Furniture Mart', 'Value City Furniture',
        'Hom Furniture'
      ]
    },

    'utilities': {
      name: 'Home Utilities',
      description: 'Earn 5% cash back when you use your card for household utilities, such as payments to electric, gas and waste management companies.',
      keepInMind: 'This category includes bills paid directly to your household utility providers and excludes Internet/cable/telecom service providers, cell phone services, security system services and similar merchants. Some utility providers may charge a convenience fee for using a credit card to pay your bill — please check with your providers.',
      merchants: [
        'Ameren Corporation', 'Nicor Gas', 'Puget Sound Energy',
        'ComEd Payment', 'NW Natural', 'Republic Services',
        'Duke Energy', 'Pacific Gas and Electric Company', 'Seattle City Light',
        'Kansas City Power and Light Company', 'Portland General Electric', 'Waste Management',
        'Los Angeles Department of Water & Power', 'Portland Water Bureau', 'Xcel Energy'
      ]
    },

    'department-stores': {
      name: 'Department Stores',
      description: 'Find everything you need — from clothing, shoes and cosmetics to kitchen goods, housewares and home furnishings. Plus, earn 1% cash back on all your other eligible net purchases.',
      keepInMind: 'Most online purchases from these merchants also qualify. However, there are exceptions. For example, Sears.com purchases do not qualify. In addition, purchases at discount stores like Wal-Mart, Target and Costco do not qualify.',
      merchants: [
        'Bloomingdale\'s', 'Kohl\'s', 'Off 5th',
        'Bon-Ton', 'Loehmann\'s', 'Saks Fifth Avenue',
        'Boston Store', 'Macy\'s', 'Sears',
        'Dillard\'s', 'Nordstrom', 'Soma Intimates',
        'JCPenney', 'Nordstrom Rack', 'Von Maur'
      ]
    },

    'cell-phone': {
      name: 'Cell Phone Providers',
      description: 'Earn cash back on payments made directly to your wireless phone service provider, including monthly bills and phone-related purchases.',
      keepInMind: 'This category includes phones and accessories purchased directly from your cell phone service provider, as well as bill payments made to your provider. It does not include cell phone or accessory purchases from electronic stores, cell phone resellers or independent dealers, discount stores or similar merchants. Cell phone payments made under a bundled plan may not qualify. Please check the Rewards History page when you log in at usbank.com to see if your purchase qualifies.',
      merchants: [
        'AT&T Wireless', 'GreatCall', 'TracFone Wireless',
        'Boost Mobile', 'MetroPCS Wireless', 'U.S. Cellular Wireless',
        'CenturyLink', 'Sprint Wireless', 'Verizon Wireless',
        'Consumer Cellular', 'Straight Talk Wireless', 'Virgin Mobile',
        'Cricket Wireless', 'T-Mobile', 'XFINITY MOBILE'
      ]
    },

    'fast-food': {
      name: 'Fast Food',
      description: 'Get your burgers, subs, tacos, baked goods and more — plus earn cash back. Eat in or take out!',
      keepInMind: 'Full-service restaurants like Applebee\'s and Olive Garden are in the Restaurants category. Fast-food restaurants located within other businesses (in gas stations, discount stores, casinos, sports venues, etc.) may not qualify.',
      merchants: [
        'Arby\'s', 'Domino\'s', 'Papa Murphy\'s',
        'Burger King', 'In-N-Out Burger', 'Qdoba Mexican Grill',
        'Carl\'s Jr.', 'Jack in the Box', 'Sonic',
        'Chick-fil-A', 'Jimmy John\'s', 'Subway',
        'Chipotle Mexican Grill', 'KFC', 'Taco Bell',
        'Culver\'s', 'McDonald\'s', 'Wendy\'s',
        'Dairy Queen', 'Panda Express'
      ]
    },

    'streaming': {
      name: 'TV, Internet & Streaming Services',
      description: 'Earn 5% cash back when you use your card for payments made to cable and satellite TV, Internet, and Streaming providers.',
      keepInMind: 'This category includes bills paid directly to your cable and internet service providers, as well as online streaming services. Purchases made using a third-party service such as PayPal, Google Play, Amazon, and iTunes Store may not qualify.',
      merchants: {
        'TV Provider': ['Charter', 'DIRECTV', 'Time Warner Cable', 'Comcast', 'DISH Network'],
        'TV or Movie Streaming': ['Disney+', 'Netflix', 'YouTube', 'FandangoNOW', 'Sling TV', 'Hulu', 'Vudu'],
        'Music Streaming': ['Amazon Music', 'Pandora', 'Spotify', 'Apple Music', 'SiriusXM', 'Google Play Music', 'Slacker Radio']
      }
    },

    // =========================================================================
    // 2% CATEGORIES
    // =========================================================================
    'gas': {
      name: 'Gas Stations and EV Charging Stations',
      description: 'Use your card at the pump, or inside the store or at EV charging stations to receive cash back. Feel like a coffee or a snack? You can earn 2% cash back for that, too.',
      keepInMind: 'Some grocery stores with gas stations (like Hy-Vee, Kroger or Meijer) may qualify for 2% cash back in the gas and/or grocery categories. Because this may vary between individual locations, please check the Rewards History page when you log in at usbank.com to see if your purchase qualifies. The category does not include truck stops, marinas, home heating companies or other direct fuel, oil or propane sales.',
      merchants: [
        '7-Eleven', 'EVgo Fast Charging Network', 'Marathon Oil',
        '76 Gas Stations', 'ExxonMobil', 'Maverick Country Store',
        'Blink Charging', 'Fred Meyer Fuel Center', 'Phillips 66',
        'BP', 'Holiday Stationstores', 'QuikTrip',
        'Cenex', 'Kroger Fuel Center', 'Shell',
        'ChargePoint Charging Station', 'Kum & Go', 'Speedway',
        'Chevron', 'KwikShop', 'SuperAmerica',
        'Love\'s Travel Stops', 'Tesla Inc'
      ]
    },

    'grocery': {
      name: 'Grocery Stores and Grocery Delivery',
      description: 'Check off your grocery list and earn cash back at most grocery stores and supermarkets.',
      keepInMind: 'Some grocery stores with gas stations (like Hy-Vee, Kroger or Meijer) may qualify for 2% cash back in the gas and/or grocery categories. Grocery store and supermarket purchases at discount stores/supercenters such as Target and Walmart and wholesale clubs are excluded. Because categories may vary between individual merchant locations, please check the Rewards History page when you log in at usbank.com to see if your purchase qualifies.',
      merchants: [
        'Albertsons', 'Jewel-Osco', 'Safeway',
        'Cub Foods', 'King Soopers', 'Schnucks',
        'Dierbergs', 'Kroger', 'Sprouts Farmers Market',
        'Fred Meyer', 'Lunds & Byerlys',
        'Giant Eagle', 'Pick\'n Save', 'Trader Joe\'s',
        'Hy-Vee', 'Publix',
        'Instacart', 'Ralphs', 'Whole Foods Market'
      ]
    },

    'dining': {
      name: 'Restaurants',
      description: 'Let someone else do the cooking while you earn cash back at cafes, cafeterias, grills and fine-dining establishments.',
      keepInMind: 'Excludes most fast food restaurants like McDonald\'s, Subway or Domino\'s — see the fast food category for these. Also excludes restaurants located within other businesses, such as department store cafeterias, truck stops, casinos or sports venues.',
      merchants: [
        'Applebee\'s', 'Grubhub', 'Red Lobster',
        'BJ\'s Restaurant', 'IHOP', 'Red Robin',
        'Bite Squad', 'Longhorn Steakhouse', 'Ruby Tuesday',
        'Bob Evans', 'Old Chicago', 'Sizzler',
        'Buffalo Wild Wings', 'Olive Garden', 'Skyline Chili',
        'Cheddar\'s Casual Cafe', 'Outback Steakhouse', 'Smashburger',
        'Cracker Barrel', 'P.F. Chang\'s', 'T.G.I. Friday\'s',
        'delivery.com', 'Perkins', 'Texas Roadhouse',
        'DoorDash', 'Pizza Hut', 'Uber Eats',
        'Famous Dave\'s BBQ', 'Postmates', 'Village Inn'
      ]
    }
  },

  // Plugin hooks

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
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

    var quarter = txnDate ? ctx.getQuarterForDate(txnDate) : ctx.getCurrentQuarter();
    var year = getYearFromDate(txnDate);
    var yearQuarterKey = year + '-' + quarter;

    // Try year-specific key first, then fall back to quarter-only key for legacy data
    var quarterCats = ctx.state.cashPlusCategories[yearQuarterKey] || ctx.state.cashPlusCategories[quarter];

    if (quarterCats) {
      // Walk up hierarchy to check if this category or any parent matches 5% selection
      var checkCat = category;
      while (checkCat) {
        if (quarterCats.fivePercent && quarterCats.fivePercent.indexOf(checkCat) >= 0) {
          var reason = checkCat !== category
            ? '5% ' + checkCat + ' (from ' + category + ', ' + year + ' ' + quarter + ')'
            : '5% ' + category + ' (' + year + ' ' + quarter + ' selection)';
          return { rate: 5, reason: reason };
        }
        checkCat = ctx.CATEGORY_HIERARCHY[checkCat];
      }

      // Walk up hierarchy to check if this category or any parent matches 2% selection
      checkCat = category;
      while (checkCat) {
        if (quarterCats.twoPercent === checkCat) {
          var reason2 = checkCat !== category
            ? '2% ' + checkCat + ' (from ' + category + ', ' + year + ' ' + quarter + ')'
            : '2% ' + category + ' (' + year + ' ' + quarter + ' selection)';
          return { rate: 2, reason: reason2 };
        }
        checkCat = ctx.CATEGORY_HIERARCHY[checkCat];
      }
    }

    // Cash+ base rate is 1%
    return { rate: 1, reason: '1% base rate' };
  },

  getCategories: function(txnDate, ctx) {
    // Show ALL possible 5% and 2% categories so user can always recategorize
    var allPossible5Pct = ['streaming', 'utilities', 'cell-phone', 'department-stores',
                          'electronics', 'furniture', 'fast-food', 'fitness',
                          'ground-transport', 'movie-theaters', 'sporting-goods', 'select-clothing'];
    var allPossible2Pct = ['gas', 'grocery', 'dining'];
    var seen = {};
    var unique = [];
    var all = allPossible5Pct.concat(allPossible2Pct).concat(['other']);
    for (var i = 0; i < all.length; i++) {
      if (!seen[all[i]]) { seen[all[i]] = true; unique.push(all[i]); }
    }
    return unique;
  },

  renderConfigSection: function(cardId, ctx) {
    var CASH_PLUS_5_LABELS = {
      'streaming': 'TV, Internet & Streaming',
      'utilities': 'Home Utilities',
      'cell-phone': 'Cell Phone Providers',
      'department-stores': 'Department Stores',
      'electronics': 'Electronics Stores',
      'furniture': 'Furniture Stores',
      'fast-food': 'Fast Food',
      'fitness': 'Gyms & Fitness Centers',
      'ground-transport': 'Ground Transportation',
      'movies': 'Movie Theaters',
      'sporting-goods': 'Sporting Goods Stores',
      'clothing': 'Select Clothing Stores'
    };
    var CASH_PLUS_2_LABELS = {
      'gas': 'Gas Stations',
      'grocery': 'Grocery Stores',
      'dining': 'Restaurants'
    };
    var QUARTERS = [
      { id: 'Q1', name: 'Q1 (Jan-Mar)' },
      { id: 'Q2', name: 'Q2 (Apr-Jun)' },
      { id: 'Q3', name: 'Q3 (Jul-Sep)' },
      { id: 'Q4', name: 'Q4 (Oct-Dec)' }
    ];

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
    var selectedCashPlusYear = ctx.state.selectedCashPlusYear || availableYears[0];

    var html = '<div id="quarterlySection">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<h3 style="font-size:14px;font-weight:600;">Quarterly Category Selection</h3>' +
        '<select id="cashPlusYearSelect" class="form-select" style="min-width:100px;padding:6px 10px;">';
    for (var yi = 0; yi < availableYears.length; yi++) {
      html += '<option value="' + availableYears[yi] + '"' + (availableYears[yi] === selectedCashPlusYear ? ' selected' : '') + '>' + availableYears[yi] + '</option>';
    }
    html += '</select></div>' +
      '<p style="font-size:12px;color:#78716c;margin-bottom:4px;">Select the bonus categories you activated with U.S. Bank for each quarter.</p>' +
      '<p style="font-size:11px;color:#a8a29e;margin-bottom:12px;">This affects how points are calculated for transactions in that period. $2,000 cap on 5% categories per quarter.</p>' +
      '<div id="cashPlusQuarters">';

    for (var qi = 0; qi < QUARTERS.length; qi++) {
      var q = QUARTERS[qi];
      var yearQuarterKey = selectedCashPlusYear + '-' + q.id;
      var quarterSelections = ctx.state.cashPlusCategories[yearQuarterKey] || ctx.state.cashPlusCategories[q.id] || { fivePercent: [], twoPercent: '' };
      var isCurrentQuarter = selectedCashPlusYear === currentYear && ctx.getCurrentQuarter() === q.id;
      var numSelected = (quarterSelections.fivePercent && quarterSelections.fivePercent.length) || 0;

      html += '<details style="margin-bottom:12px;border:1px solid #e7e5e4;border-radius:8px;' + (isCurrentQuarter ? 'border-color:#059669;' : '') + '"' + (isCurrentQuarter ? ' open' : '') + '>' +
        '<summary style="padding:12px;cursor:pointer;font-weight:500;font-size:13px;background:' + (isCurrentQuarter ? '#dcfce7' : '#fafaf9') + ';border-radius:7px;list-style:none;display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + q.name + (isCurrentQuarter ? ' (Current)' : '') + '</span>' +
          '<span style="font-size:11px;color:#78716c;">' + numSelected + '/2 categories selected</span>' +
        '</summary>' +
        '<div style="padding:12px;">' +
          '<div style="margin-bottom:12px;">' +
            '<div style="font-size:12px;font-weight:500;margin-bottom:6px;">5% Categories (select up to 2):</div>' +
            '<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:6px;">';

      var fiveKeys = Object.keys(CASH_PLUS_5_LABELS);
      for (var fi = 0; fi < fiveKeys.length; fi++) {
        var key = fiveKeys[fi];
        var label = CASH_PLUS_5_LABELS[key];
        var isChecked = quarterSelections.fivePercent && quarterSelections.fivePercent.indexOf(key) >= 0;
        html += '<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid #e7e5e4;border-radius:4px;cursor:pointer;font-size:11px;' + (isChecked ? 'background:#dcfce7;border-color:#059669;' : '') + '">' +
          '<input type="checkbox" class="cash-plus-5" data-year="' + selectedCashPlusYear + '" data-quarter="' + q.id + '" data-category="' + key + '"' + (isChecked ? ' checked' : '') + '>' +
          label + '</label>';
      }

      html += '</div></div><div>' +
        '<div style="font-size:12px;font-weight:500;margin-bottom:6px;">2% Category (select 1):</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;">';

      var twoKeys = Object.keys(CASH_PLUS_2_LABELS);
      for (var ti = 0; ti < twoKeys.length; ti++) {
        var tkey = twoKeys[ti];
        var tlabel = CASH_PLUS_2_LABELS[tkey];
        var tChecked = quarterSelections.twoPercent === tkey;
        html += '<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid #e7e5e4;border-radius:4px;cursor:pointer;font-size:11px;' + (tChecked ? 'background:#fef9c3;border-color:#eab308;' : '') + '">' +
          '<input type="radio" name="cashPlus2-' + q.id + '" class="cash-plus-2" data-year="' + selectedCashPlusYear + '" data-quarter="' + q.id + '" data-category="' + tkey + '"' + (tChecked ? ' checked' : '') + '>' +
          tlabel + '</label>';
      }

      html += '</div></div></div></details>';
    }

    html += '</div></div>';
    return html;
  },

  attachConfigListeners: function(cardId, ctx) {
    // Limit 5% selections to 2 per quarter
    document.querySelectorAll('.cash-plus-5').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var quarter = cb.dataset.quarter;
        var checked = document.querySelectorAll('.cash-plus-5[data-quarter="' + quarter + '"]:checked');
        if (checked.length > 2) {
          cb.checked = false;
          alert('You can only select 2 categories for 5% cashback per quarter');
        }
        cb.closest('label').style.background = cb.checked ? '#dcfce7' : '';
        cb.closest('label').style.borderColor = cb.checked ? '#059669' : '#e7e5e4';
      });
    });
    document.querySelectorAll('.cash-plus-2').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var quarter = cb.dataset.quarter;
        document.querySelectorAll('.cash-plus-2[data-quarter="' + quarter + '"]').forEach(function(r) {
          r.closest('label').style.background = r.checked ? '#fef9c3' : '';
          r.closest('label').style.borderColor = r.checked ? '#eab308' : '#e7e5e4';
        });
      });
    });
    // Year selector
    var cashPlusYearSelect = document.getElementById('cashPlusYearSelect');
    if (cashPlusYearSelect) {
      cashPlusYearSelect.addEventListener('change', function(e) {
        ctx.state.selectedCashPlusYear = parseInt(e.target.value);
        ctx.renderCardConfig();
      });
    }
  },

  saveConfigSection: function(cardId, ctx) {
    var defaultYear = ctx.state.availableYears && ctx.state.availableYears.length > 0
      ? ctx.state.availableYears[0] : new Date().getFullYear();
    var cashPlusYear = ctx.state.selectedCashPlusYear || defaultYear;
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(function(quarterKey) {
      var yearQuarterKey = cashPlusYear + '-' + quarterKey;
      var fivePercent = [];
      document.querySelectorAll('.cash-plus-5[data-quarter="' + quarterKey + '"]:checked').forEach(function(cb) {
        fivePercent.push(cb.dataset.category);
      });
      var twoPercentCb = document.querySelector('.cash-plus-2[data-quarter="' + quarterKey + '"]:checked');
      var twoPercent = twoPercentCb ? twoPercentCb.dataset.category : '';
      ctx.state.cashPlusCategories[yearQuarterKey] = { fivePercent: fivePercent, twoPercent: twoPercent };
    });
    ctx.safeLocalStorageSet('ccTracker_cashPlusCategories', ctx.state.cashPlusCategories);
  },

  pluginState: {
    keys: [{ stateKey: 'cashPlusCategories', localStorageKey: 'ccTracker_cashPlusCategories', default: {} }],
    exportState: function(ctx) { return { cashPlusCategories: ctx.state.cashPlusCategories }; },
    importState: function(data, ctx) {
      if (data.cashPlusCategories) {
        ctx.state.cashPlusCategories = data.cashPlusCategories;
        ctx.safeLocalStorageSet('ccTracker_cashPlusCategories', data.cashPlusCategories);
      }
    },
    clearState: function(ctx) {
      ctx.state.cashPlusCategories = {};
      localStorage.removeItem('ccTracker_cashPlusCategories');
    }
  },
};
