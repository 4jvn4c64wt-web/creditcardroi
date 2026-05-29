window.CardTracker = window.CardTracker || {};
window.CardTracker.classification = window.CardTracker.classification || {};

// =============================================================================
// CATEGORY HIERARCHY (Child → Parent mapping)
// Allows transactions to be classified to specific categories, then walk up
// the hierarchy to find the best matching category a card actually has.
// =============================================================================
window.CardTracker.classification.CATEGORY_HIERARCHY = {
  // Dining children
  'food-truck': 'dining',
  'cafe': 'dining',
  'coffee-shop': 'dining',
  'bar': 'dining',
  'bakery': 'dining',
  'fast-food': 'dining',
  'fine-dining': 'dining',
  'food-delivery': 'dining',

  // Grocery children
  'supermarket': 'grocery',
  'farmers-market': 'grocery',
  'butcher': 'grocery',
  'organic-store': 'grocery',
  'online-grocery': 'grocery', // Falls back to grocery for cards without online-grocery bonus

  // Gas/Auto children
  'car-wash': 'gas',
  'car-maintenance': 'automotive',
  'car-repair': 'automotive',
  'toll': 'automotive',
  'automotive': 'other',

  // Travel children
  'cruise': 'travel',
  'resort': 'hotels-direct',
  'vacation-rental': 'travel',
  'airbnb': 'travel',
  'car-rental': 'travel',
  'parking': 'travel',

  // Transit children (Note: lyft is top-level due to Chase partnership bonuses)
  'uber-ride': 'transit',
  'taxi': 'transit',
  'subway': 'transit',
  'bus': 'transit',

  // Online shopping children
  'amazon': 'online-shopping', // Amazon.com retail walks up to online-shopping before shopping
  'online-shopping': 'shopping',

  // Grocery children (Whole Foods is a physical grocery store, not online shopping)
  'whole-foods': 'grocery',

  // Shopping children
  'makeup': 'shopping',
  'beauty': 'shopping',
  'clothing': 'shopping',
  'electronics': 'shopping',
  'furniture': 'shopping',
  'home-decor': 'shopping',
  'sporting-goods': 'shopping',
  'books': 'shopping',
  'toys': 'shopping',
  'retail': 'shopping',
  'department-stores': 'shopping',
  'select-clothing': 'shopping',

  // Utilities children
  'electric': 'utilities',
  'water': 'utilities',
  'internet': 'utilities',
  'cable': 'utilities',
  'cable-internet': 'utilities',
  'phone': 'utilities',
  'cell-phone': 'utilities',

  // Entertainment children
  'movies': 'entertainment',
  'movie-theaters': 'entertainment',
  'concerts': 'entertainment',
  'theater': 'entertainment',
  'museum': 'entertainment',
  'amusement-park': 'entertainment',
  'gaming': 'entertainment',

  // Pet children
  'pet-food': 'pet',
  'veterinary': 'pet',
  'pet-grooming': 'pet',
  'pet': 'other',

  // Services → other
  'salon': 'other',
  'spa': 'other',
  'laundry': 'other',
  'dry-cleaning': 'other',
  'insurance': 'other',
  'medical': 'other',
  'shipping': 'other',
  'legal': 'other',
  'tax': 'other',
  'education': 'other',
  'charity': 'other',
  'government-services': 'other',
  'subscription': 'other',

  // Parent categories (null = top-level, no further rollup)
  'dining': null,
  'grocery': null,
  'gas': null,
  'drugstore': null,
  'transit': null,
  'lyft': null, // Top-level due to Chase partnership bonuses (not under transit)
  'streaming': null,
  'utilities': null,
  'fitness': null,
  'entertainment': null,
  'shopping': null,
  'travel': null,
  'flights-direct': 'travel',
  'hotels-direct': 'travel',
  'capital-one-travel': 'travel', // Capital One Travel portal (child of travel)
  'capital-one-entertainment': 'entertainment', // Capital One Entertainment (child of entertainment)
  'rent': null,
  'ground-transport': 'transit',
  'other': null
};

// Specific category keywords for more granular classification
// Order matters: more specific patterns should be checked first
window.CardTracker.classification.SPECIFIC_CATEGORY_KEYWORDS = {
  // Skip categories - checked first to filter out non-purchase transactions
  // Skip patterns for non-purchase transactions (payments, transfers, statement lines, fees, interest)
  'skip': ['transfer', 'payment thank you', 'autopay', 'credit card payment', 'paycheck', 'direct deposit', 'income', 'payroll', 'ach credit',
           'automatic payment', 'last statement bal', 'statement balance', 'previous balance', 'balance from',
           'interest charge', 'interest debit', 'purch interest',
           'annual membership fee', 'membership fee', 'annual fee', 'returned payment', 'late fee', 'late charge',
           'over limit fee', 'balance transfer fee', 'cash advance fee', 'foreign transaction fee',
           'payment received', 'autopay payment', 'credit balance refund'],

  // Dining specifics
  'food-truck': ['food truck'],
  'cafe': ['cafe', 'caffè', 'caffe'],
  'coffee-shop': ['coffee', 'starbucks', 'dunkin', 'peets', 'blue bottle', 'philz'],
  'bakery': ['bakery', 'donut', 'bagel', 'pastry', 'bread'],
  'bar': ['bar ', ' bar', 'pub', 'brewery', 'tavern', 'lounge', 'taproom', 'wine bar'],
  'fast-food': ['mcdonalds', 'wendys', 'burger king', 'taco bell', 'chick-fil-a', 'popeyes', 'arbys', 'sonic', 'jack in the box', 'five guys', 'shake shack', 'in-n-out', 'chipotle', 'qdoba', 'panera'],
  'food-delivery': ['doordash', 'uber eats', 'grubhub', 'seamless', 'caviar', 'postmates', 'instacart'],
  'fine-dining': ['steakhouse', 'fine dining'],

  // Grocery specifics
  'supermarket': ['supermarket', 'safeway', 'kroger', 'publix', 'albertsons', 'heb', 'meijer', 'giant', 'stop & shop', 'food lion', 'aldi', 'lidl', 'wegmans', 'whole foods', 'trader joe'],
  'farmers-market': ['farmers market', 'farm stand'],
  'organic-store': ['organic', 'natural grocers', 'sprouts'],

  // Auto specifics
  'car-wash': ['car wash', 'carwash'],
  'car-maintenance': ['oil change', 'jiffy lube', 'valvoline', 'firestone', 'goodyear', 'discount tire', 'tire', 'auto repair', 'mechanic'],
  'parking': ['parking', 'spothero', 'parkwhiz', 'parkme'],
  'toll': ['toll', 'ezpass', 'fastrak', 'sunpass'],

  // Travel specifics
  'cruise': ['cruise', 'carnival', 'royal caribbean', 'norwegian cruise'],
  'resort': ['resort'],
  'airbnb': ['airbnb', 'vrbo', 'vacation rental', 'homeaway'],

  // Transit specifics
  'lyft': ['lyft'],
  'uber-ride': ['uber trip', 'uber ride'],
  'taxi': ['taxi', 'cab ', 'yellow cab'],
  'subway': ['subway', 'metro', 'mta', 'wmata', 'bart', 'cta'],
  'bus': ['greyhound', 'megabus', 'flixbus'],

  // Shopping specifics
  'makeup': ['makeup', 'cosmetic', 'sephora', 'ulta', 'mac cosmetics'],
  'beauty': ['beauty', 'salon', 'day spa', 'nail salon', 'nails ', ' nails', 'manicure', 'pedicure', 'massage'],
  'clothing': ['clothing', 'apparel', 'fashion', 'shoes', 'nike', 'adidas', 'gap', 'old navy', 'h&m', 'zara', 'uniqlo', 'nordstrom', 'macys', 'kohls'],
  'electronics': ['best buy', 'apple store', 'micro center', 'newegg', 'b&h photo'],
  'furniture': ['furniture', 'ikea', 'wayfair', 'pottery barn', 'crate & barrel', 'west elm'],
  'home-decor': ['home decor', 'bed bath', 'homegoods', 'pier 1'],
  'books': ['books', 'barnes & noble', 'bookstore'],
  'toys': ['toys', 'toy store', 'lego store', 'gamestop'],

  // Entertainment specifics
  'movies': ['movie', 'cinema', 'amc', 'regal', 'cinemark', 'fandango'],
  'concerts': ['concert', 'live music', 'ticketmaster', 'stubhub', 'live nation'],
  'museum': ['museum', 'gallery', 'exhibit'],
  'amusement-park': ['disney', 'universal', 'six flags', 'amusement', 'theme park', 'legoland', 'seaworld'],
  'gaming': ['steam', 'playstation', 'xbox', 'nintendo', 'epic games'],

  // Pet specifics
  'pet-food': ['pet food', 'dog food', 'cat food', 'chewy'],
  'veterinary': ['veterinary', 'vet ', 'animal hospital', 'banfield'],
  'pet-grooming': ['pet grooming', 'dog grooming', 'groomer'],

  // Utilities specifics
  'electric': ['electric', 'power company', 'energy'],
  'water': ['water utility', 'water company', 'water bill'],
  'internet': ['comcast', 'xfinity', 'spectrum', 'verizon fios', 'att internet', 'cox'],
  'cable': ['cable tv', 'directv', 'dish network'],

  // Services
  'salon': ['salon', 'hair', 'barber', 'supercuts', 'great clips'],
  'laundry': ['laundry', 'dry clean', 'cleaners'],
  'insurance': ['insurance', 'state farm', 'geico', 'allstate', 'progressive',
              'liberty mutual', 'usaa ins', 'farmers ins', 'nationwide ins',
              'travelers ins', 'cigna', 'anthem', 'aetna', 'unitedhealth',
              'connecticare', 'bcbs', 'blue cross', 'blue shield', 'humana',
              'kaiser', 'metlife ins', 'prudential ins'],
  'medical': ['dental', 'dentist', 'physician', 'medical', 'hospital',
            'surgery', 'surgical', 'urgent care', 'pediatr', 'orthoped',
            'dermatol', 'chiropract', 'healthcare', 'health care',
            'physical therapy', 'optometr', 'ophthalmol'],
  'education': ['tuition', 'school', 'university', 'college', 'coursera', 'udemy'],
  'charity': ['charity', 'donation', 'nonprofit', 'red cross', 'united way']
};

// Keyword exclusions: if merchant contains any of these, don't match the category
// This prevents false positives like "HK Best Barbers" matching 'bar' → dining
window.CardTracker.classification.KEYWORD_EXCLUSIONS = {
  'bar': ['barber', 'chocolate bar', 'candy bar', 'granola bar', 'protein bar', 'snack bar', 'handlebar', 'sidebar', 'crossbar', 'toolbar'],
  'insurance': ['aetna cvs', 'cvs aetna']
};

// =============================================================================
// ONLINE GROCERY DETECTION (for CSP 3x online grocery bonus)
// =============================================================================
// Patterns in transaction descriptions that indicate an online/app grocery order
// vs an in-store purchase. Online orders typically show ".COM", "ONLINE", "APP",
// "DELIVERY", "PICKUP", "CURBSIDE", etc. instead of a store number + local city.
//
// Two pattern sets: normalized patterns work on normalize()'d text (dots/hyphens stripped),
// raw patterns work on lowercased-but-otherwise-unmodified text (preserves ".com" etc.)
window.CardTracker.classification.ONLINE_GROCERY_PATTERNS = [
  // These work on normalized text (special chars stripped)
  'online', 'dotcom',
  ' app ', 'ecom',   // ' app ' (with spaces) to avoid matching "apple valley" etc.
  'delivery', 'dlvry',
  'pickup', 'pick up', 'curbside',
  'shipped', ' digital', ' web'
];

// Raw patterns checked against lowercase (non-normalized) text to preserve special chars
window.CardTracker.classification.ONLINE_GROCERY_RAW_PATTERNS = [
  '.com', '-online', '-app'
];

// Merchants excluded from online grocery upgrade even if online indicators present.
// Target, Walmart, and wholesale clubs do NOT qualify for CSP online grocery 3x.
window.CardTracker.classification.ONLINE_GROCERY_EXCLUSIONS = [
  'target', 'walmart', 'wal-mart', 'wal mart', 'wmt',
  'costco', 'sams club', "sam's club", 'sam s club', 'bjs', "bj's", 'bj s'
];

// =============================================================================
// CLASSIFICATION ENGINE
// =============================================================================

// PRINCIPLE: Confidence scoring is additive - multiple agreeing signals combine.
// CSV category is the primary signal, but heuristics stack on top when they agree.

window.CardTracker.classification.CONFIDENCE_ADJUSTMENTS = {
  // Base scores
  CSV_BASE: 50,                    // CSV category maps to a specific subcategory
  KNOWN_MERCHANT_OVERRIDE: 100,    // Known merchant list always wins

  // Heuristic support (when CSV provides base)
  KEYWORD_SUPPORTS: 10,            // Merchant name keyword agrees with CSV subcategory
  POS_PATTERN_SUPPORTS: 15,        // TST*, SQ* etc. agrees with subcategory
  ADDRESS_SUPPORTS: 10,            // Address-like pattern agrees with subcategory

  // Heuristic discovery (when CSV is vague, heuristics are weighted higher)
  KEYWORD_DISCOVERY: 25,           // Keyword found when CSV is vague
  POS_PATTERN_DISCOVERY: 25,       // POS pattern found when CSV is vague
  ADDRESS_DISCOVERY: 25,           // Address pattern found when CSV is vague

  // Bonuses and penalties
  MULTIPLE_HEURISTICS_BONUS: 10,   // 2+ heuristics agree on same category
  KEYWORD_CONFLICTS: -15,          // Merchant name keyword disagrees with subcategory
  POS_PATTERN_CONFLICTS: -10,      // POS pattern disagrees with subcategory
  ADDRESS_CONFLICTS: -10,          // Address pattern disagrees with subcategory

  // Sibling transaction signal
  SIBLING: 15,                     // Each high-confidence sibling with same subcategory
  SIBLING_MAX: 50                  // Cap total sibling contribution
};

// Vague CSV categories that trigger discovery mode
// These should NOT be trusted - fall back to keyword/pattern matching
window.CardTracker.classification.VAGUE_CSV_CATEGORIES = [
  'other', 'unknown', 'personal', 'miscellaneous', 'misc',
  'general', 'uncategorized', 'family', 'business'
];

// Transactions below this threshold are flagged for review
window.CardTracker.classification.CONFIDENCE_THRESHOLD = 50;

// Map CSV category keywords to our subcategories
window.CardTracker.classification.CSV_TO_SUBCATEGORY = {
  // High confidence mappings
  'food': 'dining',
  'drink': 'dining',
  'restaurant': 'dining',
  'dining': 'dining',
  'groceries': 'grocery',
  'grocery': 'grocery',
  'supermarket': 'grocery',
  'gas': 'gas',
  'fuel': 'gas',
  'pharmacy': 'drugstore',
  'drug store': 'drugstore',
  'fitness': 'fitness',
  'gym': 'fitness',
  'subscriptions': 'subscription',
  'streaming': 'streaming',
  'rent': 'rent',
  'mortgage': 'rent',

  // Transit
  'taxi': 'transit',
  'ride share': 'transit',
  'rideshare': 'transit',
  'transportation': 'transit',
  'transit': 'transit',

  // Travel - return special marker for additional processing
  'travel': '_travel_',
  'vacation': '_travel_',
  'airline': '_travel_',
  'hotel': '_travel_',
  'lodging': '_travel_',

  // Entertainment
  'entertainment': 'entertainment',
  'recreation': 'entertainment',
  'movies': 'entertainment',

  // Shopping
  'shopping': 'shopping',
  'retail': 'shopping',
  'merchandise': 'shopping',
  'clothing': 'shopping',

  // Utilities
  'utilities': 'utilities',
  'electric': 'utilities',
  'internet': 'utilities',
  'phone': 'utilities',

  // Insurance
  'insurance': 'insurance',

  // Medical
  'medical': 'medical',
  'healthcare': 'medical',
  'health care': 'medical',
  'doctor': 'medical',

  // Shipping
  'shipping': 'shipping',
  'postage': 'shipping'
};

// =============================================================================
// CLASSIFICATION FUNCTIONS
// These reference CARDS, KNOWN_MERCHANTS, KEYWORD_EXCLUSIONS, state, normalize()
// from the global scope — all available at call time when loaded in app.html.
// =============================================================================

/**
 * Find the effective category for a specific card by walking up the hierarchy.
 */
window.CardTracker.classification.getEffectiveCategory = function(specificCategory, cardId) {
  const card = CARDS[cardId];
  if (!card) return specificCategory;

  let current = specificCategory;
  const CATEGORY_HIERARCHY = window.CardTracker.classification.CATEGORY_HIERARCHY;

  // Walk up hierarchy until we find a category the card has, or hit null
  while (current) {
    if (card.multipliers && card.multipliers[current] !== undefined) {
      return current;
    }
    if (card.categories?.includes(current)) {
      return current;
    }
    current = CATEGORY_HIERARCHY[current];
  }

  return 'other';
};

/**
 * Classify to most specific category using keyword matching
 */
window.CardTracker.classification.classifyToSpecificCategory = function(merchantName) {
  const norm = merchantName.toLowerCase();
  const SPECIFIC_CATEGORY_KEYWORDS = window.CardTracker.classification.SPECIFIC_CATEGORY_KEYWORDS;
  const KEYWORD_EXCLUSIONS = window.CardTracker.classification.KEYWORD_EXCLUSIONS;

  // Check skip patterns first
  for (const pattern of SPECIFIC_CATEGORY_KEYWORDS['skip']) {
    if (norm.includes(pattern)) {
      return { category: 'skip', reason: `Matched skip pattern: "${pattern}"` };
    }
  }

  // Check specific categories (skip 'skip' since we already checked it)
  for (const [category, patterns] of Object.entries(SPECIFIC_CATEGORY_KEYWORDS)) {
    if (category === 'skip') continue;
    for (const pattern of patterns) {
      if (norm.includes(pattern)) {
        const exclusions = KEYWORD_EXCLUSIONS[category];
        if (exclusions && exclusions.some(excl => norm.includes(excl))) {
          continue;
        }
        return { category, reason: `Matched: "${pattern}"` };
      }
    }
  }

  return null;
};

/**
 * Map CSV category string to our subcategory
 */
window.CardTracker.classification.mapCSVToSubcategory = function(normCSV) {
  const CSV_TO_SUBCATEGORY = window.CardTracker.classification.CSV_TO_SUBCATEGORY;
  for (const [keyword, subcategory] of Object.entries(CSV_TO_SUBCATEGORY)) {
    if (normCSV.includes(keyword)) {
      return subcategory;
    }
  }
  return null;
};

/**
 * Check if two subcategories "agree" (same or related via hierarchy)
 */
window.CardTracker.classification.subcategoryAgrees = function(cat1, cat2) {
  if (cat1 === cat2) return true;
  const CATEGORY_HIERARCHY = window.CardTracker.classification.CATEGORY_HIERARCHY;

  const parent1 = CATEGORY_HIERARCHY[cat1];
  const parent2 = CATEGORY_HIERARCHY[cat2];

  if (parent1 && parent1 === parent2) return true;
  if (cat1 === parent2 || cat2 === parent1) return true;

  return false;
};

/**
 * Check for POS system patterns that suggest dining
 */
window.CardTracker.classification.checkPOSPatterns = function(normalizedMerchant) {
  const posPatterns = [
    { pattern: 'sq ', category: 'dining', name: 'Square' },
    { pattern: 'tst', category: 'dining', name: 'Toast' },
    { pattern: 'toast', category: 'dining', name: 'Toast' },
    { pattern: 'clover', category: 'dining', name: 'Clover' },
    { pattern: 'square ', category: 'dining', name: 'Square' }
  ];

  for (const { pattern, category, name } of posPatterns) {
    if (normalizedMerchant.includes(pattern)) {
      return {
        matched: true,
        suggestedCategory: category,
        reason: `${name} POS suggests ${category}`
      };
    }
  }

  return { matched: false };
};

/**
 * Check for address-like patterns that suggest physical location categories
 */
window.CardTracker.classification.checkAddressPatterns = function(normalizedMerchant) {
  const addressIndicators = [
    { pattern: /\d+\s+(main|elm|oak|park|broadway|first|second|third|market|church|water)\s*(st|ave|rd|blvd|dr|ln|way|ct)?/i, category: 'dining', reason: 'Street address suggests local business' },
    { pattern: /\d+\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court)\b/i, category: 'dining', reason: 'Street address pattern' }
  ];

  for (const { pattern, category, reason } of addressIndicators) {
    if (pattern.test(normalizedMerchant)) {
      return {
        matched: true,
        suggestedCategory: category,
        reason
      };
    }
  }

  return { matched: false };
};

/**
 * Check if a grocery transaction description has online purchase indicators.
 * Looks for patterns like ".com", "ONLINE", "APP", "DELIVERY", "PICKUP", etc.
 * Excludes Target, Walmart, and wholesale clubs which don't qualify for CSP 3x.
 * @param {string} normalizedText - normalize()'d text (dots/hyphens stripped)
 * @param {string} rawLowerText - lowercased raw text (preserves .com, hyphens)
 */
window.CardTracker.classification.isOnlineGrocery = function(normalizedText, rawLowerText) {
  const EXCLUSIONS = window.CardTracker.classification.ONLINE_GROCERY_EXCLUSIONS;
  const PATTERNS = window.CardTracker.classification.ONLINE_GROCERY_PATTERNS;
  const RAW_PATTERNS = window.CardTracker.classification.ONLINE_GROCERY_RAW_PATTERNS;

  // Excluded merchants never qualify for online grocery
  const checkText = rawLowerText || normalizedText;
  for (const excl of EXCLUSIONS) {
    if (checkText.includes(excl)) {
      return false;
    }
  }

  // Check normalized text patterns (online, delivery, pickup, etc.)
  for (const pattern of PATTERNS) {
    if (normalizedText.includes(pattern)) {
      return true;
    }
  }

  // Check raw text patterns (.com, -online, -app)
  if (rawLowerText) {
    for (const pattern of RAW_PATTERNS) {
      if (rawLowerText.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Special handling for travel classification
 */
window.CardTracker.classification.classifyTravel = function(normalizedText, cardId) {
  const norm = normalizedText;
  const CONFIDENCE_ADJUSTMENTS = window.CardTracker.classification.CONFIDENCE_ADJUSTMENTS;

  // Check for portal bookings
  const chasePatterns = ['chase travel', 'chasetravel', 'cl chase', 'clchase', 'chasepay', 'chasecomtravel', 'cardmember serv', 'cardmember ser'];
  for (const pattern of chasePatterns) {
    if (norm.includes(pattern)) {
      return { subcategory: 'chase-travel', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: 'Chase Travel portal' };
    }
  }
  const amexPatterns = ['amex travel', 'amextravel', 'american express travel', 'amexcomtravel', 'aexp travel', 'aet', 'amex trv', 'americanexpresscomtravel'];
  for (const pattern of amexPatterns) {
    if (norm.includes(pattern)) {
      return { subcategory: 'amex-travel', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: 'Amex Travel portal' };
    }
  }
  const biltPatterns = ['bilt travel', 'bilttravel', 'biltcomtravel'];
  for (const pattern of biltPatterns) {
    if (norm.includes(pattern)) {
      return { subcategory: 'bilt-travel', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: 'Bilt Travel portal' };
    }
  }
  const capitalOnePatterns = ['capital one travel', 'capitalonetravel', 'capitalone travel', 'capone travel', 'c1 travel'];
  for (const pattern of capitalOnePatterns) {
    if (norm.includes(pattern)) {
      return { subcategory: 'capital-one-travel', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: 'Capital One Travel portal' };
    }
  }

  // Check for OTAs
  const otas = ['expedia', 'booking.com', 'hotels.com', 'priceline', 'kayak', 'orbitz', 'travelocity'];
  for (const ota of otas) {
    if (norm.includes(ota)) {
      return { subcategory: 'travel-ota', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: `OTA: ${ota}` };
    }
  }

  // Check for direct airline bookings
  const airlines = ['delta', 'american air', 'united air', 'southwest', 'jetblue', 'alaska air', 'spirit air', 'frontier air', 'allegiant'];
  for (const airline of airlines) {
    if (norm.includes(airline)) {
      return { subcategory: 'flights-direct', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: `Direct airline: ${airline}` };
    }
  }

  // Check for direct hotel bookings
  const hotels = ['marriott', 'hilton', 'hyatt', 'ihg', 'wyndham', 'best western', 'radisson',
                  'sheraton', 'westin', 'ritz', 'four seasons', 'mgm', 'caesars', 'flamingo',
                  'venetian', 'bellagio', 'cosmopolitan'];
  for (const hotel of hotels) {
    if (norm.includes(hotel)) {
      return { subcategory: 'hotels-direct', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: `Direct hotel: ${hotel}` };
    }
  }

  // Check for Airbnb/VRBO
  if (norm.includes('airbnb') || norm.includes('vrbo')) {
    return { subcategory: 'hotels-direct', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: 'Vacation rental' };
  }

  // Check for car rentals
  const carRentals = ['hertz', 'enterprise', 'avis', 'budget', 'national car', 'alamo', 'dollar rent', 'thrifty', 'sixt', 'zipcar'];
  for (const rental of carRentals) {
    if (norm.includes(rental)) {
      return { subcategory: 'car-rental', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: `Car rental: ${rental}` };
    }
  }

  // Check for cruises
  const cruises = ['carnival', 'royal caribbean', 'norwegian cruise', 'princess cruise', 'disney cruise', 'msc cruise'];
  for (const cruise of cruises) {
    if (norm.includes(cruise)) {
      return { subcategory: 'cruise', confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE, source: 'known', reason: `Cruise: ${cruise}` };
    }
  }

  // Generic travel from CSV
  return {
    subcategory: 'travel',
    confidence: CONFIDENCE_ADJUSTMENTS.CSV_BASE,
    source: 'csv-category',
    reason: 'Travel - specific type unknown'
  };
};

/**
 * Main classification function
 * References normalize(), state, KNOWN_MERCHANTS from global scope (available at call time)
 */
window.CardTracker.classification.classifyMerchant = function(merchant, csvCategory, cardId, originalStatement) {
  const result = window.CardTracker.classification._classifyMerchantInternal(merchant, csvCategory, cardId, originalStatement);
  
  // Bilt Palladium override: only 'rent' matters. Everything else is 'other' with high confidence.
  if (cardId === 'bilt-palladium' && result.subcategory !== 'rent' && result.subcategory !== 'skip') {
    result.subcategory = 'other';
    // Set confidence to override threshold so user is not prompted to review
    result.confidence = window.CardTracker.classification.CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE;
    result.reason = (result.reason ? result.reason + '; ' : '') + 'Bilt Palladium override to other';
  }
  
  return result;
};

window.CardTracker.classification._classifyMerchantInternal = function(merchant, csvCategory, cardId, originalStatement) {
  if (cardId === undefined) cardId = null;
  if (originalStatement === undefined) originalStatement = null;

  const cls = window.CardTracker.classification;
  const CONFIDENCE_ADJUSTMENTS = cls.CONFIDENCE_ADJUSTMENTS;
  const VAGUE_CSV_CATEGORIES = cls.VAGUE_CSV_CATEGORIES;
  const SPECIFIC_CATEGORY_KEYWORDS = cls.SPECIFIC_CATEGORY_KEYWORDS;

  const norm = normalize(merchant);
  const normOriginal = normalize(originalStatement || '');
  const combinedNorm = norm + ' ' + normOriginal;
  // Raw lowercase text preserves .com, hyphens, etc. for online grocery detection
  const combinedRaw = ((merchant || '') + ' ' + (originalStatement || '')).toLowerCase();
  const cacheKey = norm.substring(0, 50);
  const normCSV = (csvCategory || '').toLowerCase().trim();

  const isVagueCSV = !normCSV || VAGUE_CSV_CATEGORIES.some(v => normCSV.includes(v));

  // PRIORITY 1: Skip Detection
  const skipPatterns = SPECIFIC_CATEGORY_KEYWORDS['skip'] || [];
  for (const pattern of skipPatterns) {
    if (combinedNorm.includes(pattern)) {
      return {
        subcategory: 'skip',
        confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE,
        source: 'skip-pattern',
        reason: `Skipped: "${pattern}"`
      };
    }
  }

  // PRIORITY 2: User-defined Merchant Rules
  const cardSpecificKey = cardId ? `${cardId}:${cacheKey}` : null;
  const ruleCategory = (cardSpecificKey && state.merchantRules[cardSpecificKey]) || state.merchantRules[cacheKey];
  if (ruleCategory) {
    return {
      subcategory: ruleCategory,
      confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE,
      source: 'user-rule',
      reason: cardSpecificKey && state.merchantRules[cardSpecificKey] ? 'User rule (this card)' : 'User rule (all cards)'
    };
  }

  // PRIORITY 3: Known Merchant List
  for (const [key, cat] of Object.entries(KNOWN_MERCHANTS)) {
    if (combinedNorm.includes(key)) {
      const exclusions = cls.KEYWORD_EXCLUSIONS[cat];
      if (exclusions && exclusions.some(excl => combinedNorm.includes(excl))) {
        continue;
      }
      // Upgrade grocery → online-grocery if online purchase indicators are present
      let effectiveCat = cat;
      if ((cat === 'grocery' || cls.CATEGORY_HIERARCHY[cat] === 'grocery') && cls.isOnlineGrocery(combinedNorm, combinedRaw)) {
        effectiveCat = 'online-grocery';
      }
      state.merchantCache[cacheKey] = effectiveCat;
      return {
        subcategory: effectiveCat,
        confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE,
        source: 'known-merchant',
        reason: effectiveCat === 'online-grocery'
          ? `Known: "${key}" (online)`
          : `Known: "${key}"`
      };
    }
  }

  // STEP 1: Gather ALL signals
  let csvSubcategory = null;
  let keywordResult = null;
  let posResult = null;
  let addressResult = null;

  if (!isVagueCSV) {
    csvSubcategory = cls.mapCSVToSubcategory(normCSV);
    if (csvSubcategory === '_travel_') {
      return cls.classifyTravel(combinedNorm, cardId);
    }
  }

  keywordResult = cls.classifyToSpecificCategory(norm);
  if (keywordResult && keywordResult.category === 'skip') {
    keywordResult = null;
  }

  posResult = cls.checkPOSPatterns(norm);
  addressResult = cls.checkAddressPatterns(norm);

  // STEP 2: Determine primary subcategory
  let subcategory = null;
  let confidence = 0;
  let source = 'unknown';
  const reasons = [];

  if (csvSubcategory) {
    subcategory = csvSubcategory;
    confidence = CONFIDENCE_ADJUSTMENTS.CSV_BASE;
    source = 'csv-category';
    reasons.push(`CSV: "${csvCategory}"`);
  } else {
    const votes = {};
    if (keywordResult) {
      votes[keywordResult.category] = (votes[keywordResult.category] || 0) + 1;
    }
    if (posResult.matched) {
      votes[posResult.suggestedCategory] = (votes[posResult.suggestedCategory] || 0) + 1;
    }
    if (addressResult.matched) {
      votes[addressResult.suggestedCategory] = (votes[addressResult.suggestedCategory] || 0) + 1;
    }

    let maxVotes = 0;
    let winningCategory = null;
    for (const [cat, count] of Object.entries(votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        winningCategory = cat;
      }
    }

    if (winningCategory) {
      subcategory = winningCategory;
      source = 'heuristics';
    }
  }

  // STEP 3: Apply additive confidence scoring
  if (subcategory) {
    let heuristicsAgreeing = 0;

    if (keywordResult) {
      const agrees = cls.subcategoryAgrees(keywordResult.category, subcategory);
      if (agrees) {
        const points = isVagueCSV ? CONFIDENCE_ADJUSTMENTS.KEYWORD_DISCOVERY : CONFIDENCE_ADJUSTMENTS.KEYWORD_SUPPORTS;
        confidence += points;
        heuristicsAgreeing++;
        reasons.push(`Keyword "${keywordResult.reason}" (+${points})`);
      } else if (!isVagueCSV) {
        confidence += CONFIDENCE_ADJUSTMENTS.KEYWORD_CONFLICTS;
        reasons.push(`Keyword conflicts: "${keywordResult.reason}" (${CONFIDENCE_ADJUSTMENTS.KEYWORD_CONFLICTS})`);
      }
    }

    if (posResult.matched) {
      const agrees = cls.subcategoryAgrees(posResult.suggestedCategory, subcategory);
      if (agrees) {
        const points = isVagueCSV ? CONFIDENCE_ADJUSTMENTS.POS_PATTERN_DISCOVERY : CONFIDENCE_ADJUSTMENTS.POS_PATTERN_SUPPORTS;
        confidence += points;
        heuristicsAgreeing++;
        reasons.push(`POS pattern (+${points})`);
      } else if (!isVagueCSV) {
        confidence += CONFIDENCE_ADJUSTMENTS.POS_PATTERN_CONFLICTS;
        reasons.push(`POS pattern conflicts (${CONFIDENCE_ADJUSTMENTS.POS_PATTERN_CONFLICTS})`);
      }
    }

    if (addressResult.matched) {
      const agrees = cls.subcategoryAgrees(addressResult.suggestedCategory, subcategory);
      if (agrees) {
        const points = isVagueCSV ? CONFIDENCE_ADJUSTMENTS.ADDRESS_DISCOVERY : CONFIDENCE_ADJUSTMENTS.ADDRESS_SUPPORTS;
        confidence += points;
        heuristicsAgreeing++;
        reasons.push(`Address pattern (+${points})`);
      } else if (!isVagueCSV) {
        confidence += CONFIDENCE_ADJUSTMENTS.ADDRESS_CONFLICTS;
        reasons.push(`Address conflicts (${CONFIDENCE_ADJUSTMENTS.ADDRESS_CONFLICTS})`);
      }
    }

    if (heuristicsAgreeing >= 2) {
      confidence += CONFIDENCE_ADJUSTMENTS.MULTIPLE_HEURISTICS_BONUS;
      reasons.push(`Multiple signals bonus (+${CONFIDENCE_ADJUSTMENTS.MULTIPLE_HEURISTICS_BONUS})`);
    }

    // Upgrade grocery → online-grocery if online purchase indicators are present
    if ((subcategory === 'grocery' || cls.CATEGORY_HIERARCHY[subcategory] === 'grocery') && cls.isOnlineGrocery(combinedNorm, combinedRaw)) {
      subcategory = 'online-grocery';
      reasons.push('Online grocery (description heuristic)');
    }

    state.merchantCache[cacheKey] = subcategory;
    return {
      subcategory,
      confidence: Math.max(0, confidence),
      source,
      reason: reasons.join('; ')
    };
  }

  // UNKNOWN
  return {
    subcategory: null,
    confidence: 0,
    source: 'unknown',
    reason: 'No match found'
  };
};
