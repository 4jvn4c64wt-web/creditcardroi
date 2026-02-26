window.CardTracker = window.CardTracker || {};

// =============================================================================
// PORTAL MODULE
// Portals are booking channels (Capital One Travel, Amex Travel, etc.), not
// categories. A portal transaction has two dimensions: which portal was used
// and what was actually purchased (hotel, flight, etc.). The card declares
// which portal + purchase type combinations earn a bonus.
// =============================================================================

window.CardTracker.portal = (function() {

  // ---------------------------------------------------------------------------
  // PORTAL_REGISTRY — source of truth for what portals exist and how to detect
  // ---------------------------------------------------------------------------
  var PORTAL_REGISTRY = {
    'chase-travel': {
      label: 'Chase Travel',
      keywords: ['chase travel', 'chasetravel', 'cl chase', 'clchase',
                 'chasepay', 'chasecomtravel', 'cardmember serv', 'cardmember ser']
    },
    'amex-travel': {
      label: 'Amex Travel',
      keywords: ['amex travel', 'amextravel', 'american express travel',
                 'amexcomtravel', 'aexp travel', 'amex trv',
                 'americanexpresscomtravel']
    },
    'bilt-travel': {
      label: 'Bilt Travel',
      keywords: ['bilt travel', 'bilttravel', 'biltcomtravel']
    },
    'capital-one-travel': {
      label: 'Capital One Travel',
      keywords: ['capital one travel', 'capitalonetravel', 'capitalone travel',
                 'capone travel', 'c1 travel']
    },
    'capital-one-entertainment': {
      label: 'Capital One Entertainment',
      keywords: ['capital one entertainment', 'capitaloneentertainment',
                 'c1 entertainment']
    }
  };

  // ---------------------------------------------------------------------------
  // SUBCATEGORY_KEYWORDS — generic descriptive words indicating what was
  // purchased through a portal (not merchant names)
  // ---------------------------------------------------------------------------
  var SUBCATEGORY_KEYWORDS = {
    'flights-portal':         ['air ', 'airfare', 'flight', 'airline', 'airways'],
    'hotels-portal':          ['hotel', 'resort', 'inn', 'lodge', 'prepaid hotel', 'motel'],
    'car-rental-portal':      ['car rental', 'rental car', 'auto rental', 'rent a car'],
    'dining-portal':          ['restaurant', 'dining', 'food', 'bistro', 'grill'],
    'entertainment-portal':   ['entertainment', 'concert', 'theater', 'show', 'event'],
    'attractions-portal':     ['attraction', 'museum', 'tour ', 'experience',
                               'ticket', 'theme park'],
    'vacation-rental-portal': ['vacation rental', 'vrbo', 'airbnb']
  };

  // ---------------------------------------------------------------------------
  // MERCHANT_TO_PORTAL_CATEGORY — maps KNOWN_MERCHANTS categories to their
  // portal-prefixed equivalents
  // ---------------------------------------------------------------------------
  var MERCHANT_TO_PORTAL_CATEGORY = {
    'hotels-direct':    'hotels-portal',
    'flights-direct':   'flights-portal',
    'car-rental':       'car-rental-portal',
    'dining':           'dining-portal',
    'entertainment':    'entertainment-portal',
    'cruise':           'cruise-portal',
    'vacation-rental':  'vacation-rental-portal'
  };

  // ---------------------------------------------------------------------------
  // detectPortal(merchantDesc)
  // Returns the portal ID (e.g. 'capital-one-travel') or null.
  // ---------------------------------------------------------------------------
  function detectPortal(merchantDesc) {
    if (!merchantDesc) return null;
    var norm = merchantDesc.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    for (var portalId in PORTAL_REGISTRY) {
      var keywords = PORTAL_REGISTRY[portalId].keywords;
      for (var i = 0; i < keywords.length; i++) {
        if (norm.includes(keywords[i])) {
          return portalId;
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // resolvePortalCategory(merchantDesc, bonusedCategories)
  // Returns an 'xxx-portal' string or null.
  // Resolution: 1) KNOWN_MERCHANTS lookup  2) SUBCATEGORY_KEYWORDS scan
  // Only checks categories the card actually bonuses.
  // ---------------------------------------------------------------------------
  function resolvePortalCategory(merchantDesc, bonusedCategories) {
    if (!merchantDesc || !bonusedCategories || bonusedCategories.length === 0) return null;
    var norm = merchantDesc.toLowerCase().replace(/[^a-z0-9\s]/g, '');

    // Build a set for O(1) lookup
    var bonusedSet = {};
    for (var i = 0; i < bonusedCategories.length; i++) {
      bonusedSet[bonusedCategories[i]] = true;
    }

    // 1) Check KNOWN_MERCHANTS for the merchant name
    var KNOWN_MERCHANTS = window.CardTracker.merchants || {};
    for (var key in KNOWN_MERCHANTS) {
      if (norm.includes(key)) {
        var merchantCat = KNOWN_MERCHANTS[key];
        var portalCat = MERCHANT_TO_PORTAL_CATEGORY[merchantCat];
        if (portalCat && bonusedSet[portalCat]) {
          return portalCat;
        }
      }
    }

    // 2) Check SUBCATEGORY_KEYWORDS, but only for bonused categories
    for (var cat in SUBCATEGORY_KEYWORDS) {
      if (!bonusedSet[cat]) continue;
      var keywords = SUBCATEGORY_KEYWORDS[cat];
      for (var j = 0; j < keywords.length; j++) {
        if (norm.includes(keywords[j])) {
          return cat;
        }
      }
    }

    // 3) Unresolvable
    return null;
  }

  // ---------------------------------------------------------------------------
  // getPortalMultiplier(card, portalId, merchantDesc)
  // Main entry point called from getMultiplier(). Returns { rate, reason } or null.
  // ---------------------------------------------------------------------------
  function getPortalMultiplier(card, portalId, merchantDesc) {
    if (!card || !card.portalBonuses) return null;

    var portalConfig = card.portalBonuses[portalId];
    if (!portalConfig) return null;

    var portalLabel = PORTAL_REGISTRY[portalId] ? PORTAL_REGISTRY[portalId].label : portalId;

    // Gather bonused categories (all keys except defaultRate)
    var bonusedCategories = [];
    for (var key in portalConfig) {
      if (key !== 'defaultRate') {
        bonusedCategories.push(key);
      }
    }

    var defaultRate = portalConfig.defaultRate;

    // If no bonused categories (only defaultRate), skip resolution
    if (bonusedCategories.length === 0) {
      return { rate: defaultRate, reason: defaultRate + 'x ' + portalLabel + ' (portal)' };
    }

    // Resolve the purchase type
    var resolvedCategory = resolvePortalCategory(merchantDesc, bonusedCategories);

    if (resolvedCategory) {
      var rate = portalConfig[resolvedCategory];
      return { rate: rate, reason: rate + 'x ' + portalLabel + ' (' + resolvedCategory + ')' };
    }

    // No match — use defaultRate
    return { rate: defaultRate, reason: defaultRate + 'x ' + portalLabel + ' (portal)' };
  }

  // Public API
  return {
    PORTAL_REGISTRY: PORTAL_REGISTRY,
    SUBCATEGORY_KEYWORDS: SUBCATEGORY_KEYWORDS,
    MERCHANT_TO_PORTAL_CATEGORY: MERCHANT_TO_PORTAL_CATEGORY,
    detectPortal: detectPortal,
    resolvePortalCategory: resolvePortalCategory,
    getPortalMultiplier: getPortalMultiplier
  };

})();
