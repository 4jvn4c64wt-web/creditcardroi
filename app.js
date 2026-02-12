// =============================================================================
// UTILITY FUNCTIONS (Commercial-Grade Infrastructure)
// =============================================================================

/**
 * Safely parse JSON with error handling and fallback
 * Prevents crashes from corrupted localStorage data
 * @param {string} jsonString - The JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails (default: null)
 * @returns {*} Parsed value or fallback
 */
function safeJSONParse(jsonString, fallback = null) {
  if (jsonString == null || jsonString === '') {
    return fallback;
  }
  try {
    const parsed = JSON.parse(jsonString);
    return parsed != null ? parsed : fallback;
  } catch (e) {
    console.warn('JSON parse error:', e.message, '- using fallback');
    return fallback;
  }
}

/**
 * Safely store data in localStorage with quota handling
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON stringified)
 * @returns {boolean} True if successful, false if quota exceeded
 */
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.error('localStorage quota exceeded for key:', key);
      // Try to alert user on first quota error
      if (!window._quotaWarningShown) {
        window._quotaWarningShown = true;
        alert('Storage limit reached. Some data may not be saved. Consider exporting your data and clearing old transactions.');
      }
    } else {
      console.error('localStorage error:', e);
    }
    return false;
  }
}

/**
 * Safely retrieve and parse data from localStorage
 * @param {string} key - Storage key
 * @param {*} fallback - Fallback value if not found or parse fails
 * @returns {*} Parsed value or fallback
 */
function safeLocalStorageGet(key, fallback = null) {
  try {
    const item = localStorage.getItem(key);
    return safeJSONParse(item, fallback);
  } catch (e) {
    console.warn('localStorage read error for key:', key, e);
    return fallback;
  }
}

/**
 * Unified date parsing utility - handles multiple formats consistently
 * Supported formats: YYYY-MM-DD, MM/DD/YYYY, MM/DD/YY, M/D/YYYY, M/D/YY
 * @param {string} dateStr - Date string in various formats
 * @returns {{year: number, month: number, day: number, date: Date}|null} Parsed date components or null
 */
function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();
  let year, month, day;

  // ISO format: YYYY-MM-DD
  if (trimmed.includes('-') && trimmed.indexOf('-') === 4) {
    const parts = trimmed.split('-');
    if (parts.length >= 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
  }
  // US format: MM/DD/YYYY or MM/DD/YY or M/D/YYYY or M/D/YY
  else if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length >= 3) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      const yearPart = parts[2];
      // Handle 2-digit years (assume 2000s)
      year = parseInt(yearPart, 10);
      if (yearPart.length === 2) {
        year = 2000 + year;
      }
    }
  }

  // Validate parsed values
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    // Fallback: try native Date parsing
    const fallbackDate = new Date(trimmed);
    if (!isNaN(fallbackDate.getTime())) {
      return {
        year: fallbackDate.getFullYear(),
        month: fallbackDate.getMonth() + 1,
        day: fallbackDate.getDate(),
        date: fallbackDate
      };
    }
    return null;
  }

  return {
    year,
    month,
    day,
    date: new Date(year, month - 1, day)
  };
}

/**
 * Get year from date string using unified parsing
 * @param {string} dateStr - Date string
 * @returns {number} Year, or current year if parsing fails
 */
function getYearFromDateString(dateStr) {
  const parsed = parseDateString(dateStr);
  return parsed ? parsed.year : new Date().getFullYear();
}

/**
 * Get quarter (Q1-Q4) from date string
 * @param {string} dateStr - Date string
 * @returns {string} Quarter string (Q1, Q2, Q3, or Q4)
 */
function getQuarterFromDateString(dateStr) {
  const parsed = parseDateString(dateStr);
  if (!parsed) {
    const now = new Date();
    return `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  }
  return `Q${Math.ceil(parsed.month / 3)}`;
}

/**
 * Generate content-based transaction ID for deduplication
 * Uses content-based hashing for cross-upload deduplication
 * @param {string} date - Transaction date
 * @param {string} merchant - Merchant name
 * @param {number} amount - Transaction amount
 * @param {string} last4 - Card last 4 digits
 * @returns {string} Content-based transaction ID (base form)
 */
function generateBaseTransactionId(date, merchant, amount, last4) {
  return `${date}-${(merchant || '').substring(0, 30)}-${Math.abs(amount || 0).toFixed(2)}-${last4 || 'XXXX'}`.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Generate unique transaction ID with collision handling
 * Appends sequence number if base ID already exists in provided set
 * Preserves deduplication behavior while handling same-batch duplicates
 * @param {string} date - Transaction date
 * @param {string} merchant - Merchant name
 * @param {number} amount - Transaction amount
 * @param {string} last4 - Card last 4 digits
 * @param {Set<string>} existingIds - Set of already-used IDs in current batch
 * @returns {string} Unique transaction ID
 */
function generateTransactionId(date, merchant, amount, last4, existingIds = new Set()) {
  const baseId = generateBaseTransactionId(date, merchant, amount, last4);

  // If no collision, use base ID (preserves deduplication)
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  // Collision detected - append sequence number for truly duplicate transactions
  // This handles legitimate duplicates like two $5 Starbucks purchases on the same day
  let seq = 2;
  let uniqueId = `${baseId}-${seq}`;
  while (existingIds.has(uniqueId)) {
    seq++;
    uniqueId = `${baseId}-${seq}`;
  }
  return uniqueId;
}

// =============================================================================
// CARD DEFINITIONS (loaded from individual card files via CardTracker namespace)
// =============================================================================
const SKIP_ACCOUNTS = ['checking', 'savings', 'sofi', 'bank', 'venmo'];

const CARDS = window.CardTracker.cards;

// =============================================================================
// KNOWN MERCHANTS (loaded from merchants.js via CardTracker namespace)
// =============================================================================
const KNOWN_MERCHANTS = window.CardTracker.merchants;
const MONARCH_MAP = window.CardTracker.monarchMap;

// =============================================================================
// CLASSIFICATION DATA & FUNCTIONS (loaded from classification.js via CardTracker namespace)
// =============================================================================
const CATEGORY_HIERARCHY = window.CardTracker.classification.CATEGORY_HIERARCHY;
const SPECIFIC_CATEGORY_KEYWORDS = window.CardTracker.classification.SPECIFIC_CATEGORY_KEYWORDS;
const KEYWORD_EXCLUSIONS = window.CardTracker.classification.KEYWORD_EXCLUSIONS;
function getEffectiveCategory(specificCategory, cardId) { return window.CardTracker.classification.getEffectiveCategory(specificCategory, cardId); }
function classifyToSpecificCategory(merchantName) { return window.CardTracker.classification.classifyToSpecificCategory(merchantName); }

// =============================================================================
// STATE
// =============================================================================
let state = {
  // Persistent state (loaded from localStorage with safe parsing)
  cardMappings: safeLocalStorageGet('ccTracker_cardMappings', {}),
  merchantCache: safeLocalStorageGet('ccTracker_merchantCache', {}),
  customPointValues: safeLocalStorageGet('ccTracker_pointValues', {}),
  creditOverrides: safeLocalStorageGet('ccTracker_creditOverrides', {}),
  disabledCredits: safeLocalStorageGet('ccTracker_disabledCredits', {}),
  monthlyCredits: safeLocalStorageGet('ccTracker_monthlyCredits', {}),
  merchantRules: safeLocalStorageGet('ccTracker_merchantRules', {}),
  confirmedTransactions: safeLocalStorageGet('ccTracker_confirmedTxns', {}), // txnId -> category (single-txn confirmations)
  cashPlusCategories: safeLocalStorageGet('ccTracker_cashPlusCategories', {}),
  cffCategories: safeLocalStorageGet('ccTracker_cffCategories', {}),
  cffPaypalDecemberOnly: safeLocalStorageGet('ccTracker_cffPaypalDecemberOnly', {}), // Tracks PayPal December-only for Q4 by year
  biltConfig: safeLocalStorageGet('ccTracker_biltConfig', {}),
  customAnnualBonusPoints: safeLocalStorageGet('ccTracker_annualBonusPoints', {}),
  cardYearToggles: safeLocalStorageGet('ccTracker_cardYearToggles', {}), // { cardId: true } - tracks which cards show card year instead of calendar year
  columnMappings: safeLocalStorageGet('ccTracker_columnMappings', {}), // Remembers mappings by CSV shape
  pendingCSVData: null, // Temporarily holds CSV data during column mapping
  savedTransactions: safeLocalStorageGet('ccTracker_transactions', []),

  // Tier state (persisted)
  // Decision Pass: array of { key: string, cardId: string, activatedAt: number (ms timestamp) }
  decisionPasses: safeLocalStorageGet('ccTracker_decisionPasses', []),
  // Pro access: { key: string, activatedAt: number (ms timestamp) } or null
  proAccess: safeLocalStorageGet('ccTracker_proAccess', null),
  // Dismissed DP banners: { "config_<cardId>": true, "transactions": true } — per-page dismissals
  dpBannersDismissed: safeLocalStorageGet('ccTracker_dpBannersDismissed', {}),

  // Session state (not persisted)
  transactions: [],
  results: null,
  detectedAnnualFees: {}, // { cardId: { year: amount } } - detected from transaction data
  activeView: 'summary',
  selectedYear: null,
  selectedCreditYear: null, // For card config credit year selection
  selectedCashPlusYear: null, // For Cash+ quarterly category year selection
  selectedCFFYear: null, // For CFF quarterly category year selection
  selectedBiltYear: null, // For Bilt config year selection (separate from summary year)
  availableYears: [],
  summarySortState: { column: 'cardName', direction: 'asc' }, // For summary table sorting
  txnSortState: { column: 'date', direction: 'desc' }, // For transaction table sorting

  // Tour state
  tourComplete: localStorage.getItem('ccTracker_tourComplete') === 'true',
  tourStep: parseInt(localStorage.getItem('ccTracker_tourStep') || '0', 10),
  tourActive: false,
  featureEducation: safeLocalStorageGet('ccTracker_featureEducation', {}) // tracks which feature tutorials have been shown
};

// Migrate "Lyft Pink" → "Lyft Credit" in persisted credit settings
(function migrateLyftPinkName() {
  const oldName = 'Lyft Pink', newName = 'Lyft Credit';
  let changed = false;
  for (const cardId in state.disabledCredits) {
    const arr = state.disabledCredits[cardId];
    const idx = arr.indexOf(oldName);
    if (idx !== -1) { arr[idx] = newName; changed = true; }
  }
  if (changed) safeLocalStorageSet('ccTracker_disabledCredits', state.disabledCredits);
  changed = false;
  for (const txnId in state.creditOverrides) {
    if (state.creditOverrides[txnId] === oldName) { state.creditOverrides[txnId] = newName; changed = true; }
  }
  if (changed) safeLocalStorageSet('ccTracker_creditOverrides', state.creditOverrides);
})();

// =============================================================================
// DECISION PASS & TIER LOGIC
// =============================================================================
const DECISION_PASS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FREE_DATA_MONTHS = 12; // Free users see 1 year of data

// Expire old Decision Passes on page load
(function expireDecisionPasses() {
  const now = Date.now();
  // Don't delete expired passes — just let them stay inert for the user's reference
  // The getActiveDecisionPasses function filters them out
})();

/**
 * Get all currently active (non-expired) Decision Passes
 * @returns {Array} Array of active pass objects { key, cardId, activatedAt }
 */
function getActiveDecisionPasses() {
  const now = Date.now();
  return state.decisionPasses.filter(dp => (now - dp.activatedAt) <= DECISION_PASS_DURATION_MS);
}

/**
 * Check if a specific card has an active Decision Pass
 * @param {string} cardId - The card identifier
 * @returns {boolean}
 */
function hasActiveDecisionPass(cardId) {
  return getActiveDecisionPasses().some(dp => dp.cardId === cardId);
}

/**
 * Build a lookup of active Decision Pass card IDs
 * @returns {Object} { cardId: true, ... } for cards with active passes
 */
function getActiveDecisionPassLookup() {
  const lookup = {};
  getActiveDecisionPasses().forEach(dp => { lookup[dp.cardId] = true; });
  return lookup;
}

/**
 * Check if a card's data is editable (has active DP, or Pro, or is an exception card)
 * Cash+ always allows quarterly category editing; Bilt always allows config editing (except credits)
 * @param {string} cardId - The card identifier
 * @param {string} editType - Type of edit: 'category', 'config', 'credits', 'export'
 * @returns {boolean}
 */
function isCardEditable(cardId, editType = 'config') {
  // Pro: everything editable
  if (window.TIER_CONFIG === 'pro') return true;

  // Active Decision Pass: card is fully editable
  if (hasActiveDecisionPass(cardId)) return true;

  // Note: Bilt-specific config (rent day, reward options) is handled directly
  // in renderCardConfig via card.isBilt checks, not through this function.
  // Point values for Bilt cards are locked just like other cards.

  return false;
}

/**
 * Apply per-card tier-based date filtering to a set of transactions
 * Free users: 12 months of data
 * Decision Pass cards: all-time (no cutoff)
 * Pro: all-time (no cutoff)
 * @param {Array} transactions - Processed transactions to filter
 * @returns {Array} Filtered transactions
 */
function applyTierDateFiltering(transactions) {
  // Pro tier has no data restrictions
  if (window.TIER_CONFIG === 'pro') return transactions;

  const dpLookup = getActiveDecisionPassLookup();
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - FREE_DATA_MONTHS, now.getDate());

  return transactions.filter(t => {
    if (!t.cardId || t.cardId === 'skip') return true;

    // Decision Pass cards get all-time data
    if (dpLookup[t.cardId]) return true;

    const parsed = parseDateString(t.date);
    if (!parsed) return true;

    return parsed.date >= cutoff;
  });
}

/**
 * Validate a Gumroad-style license key format
 * Basic format check: alphanumeric with hyphens, reasonable length
 * @param {string} key - The license key to validate
 * @returns {boolean}
 */
function isValidLicenseKeyFormat(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  // Gumroad keys are typically 8-35 chars, alphanumeric with hyphens
  return /^[A-Za-z0-9-]{8,35}$/.test(trimmed);
}

/**
 * Activate a Decision Pass for a specific card
 * @param {string} key - The license key
 * @param {string} cardId - The card to upgrade
 * @returns {boolean} True if activation succeeded
 */
function activateDecisionPass(key, cardId) {
  if (!isValidLicenseKeyFormat(key)) return false;
  if (!cardId || !CARDS[cardId]) return false;

  // Test keys (TESTDP-xxxx) bypass duplicate check for easy testing
  const isTestKey = /^TESTDP-/i.test(key.trim());
  if (!isTestKey) {
    const existingKey = state.decisionPasses.find(dp => dp.key === key.trim());
    if (existingKey) return false; // Key already used
  }

  state.decisionPasses.push({
    key: key.trim(),
    cardId: cardId,
    activatedAt: Date.now()
  });
  safeLocalStorageSet('ccTracker_decisionPasses', state.decisionPasses);
  return true;
}

/**
 * Activate Pro access
 * @param {string} key - The license key
 * @returns {boolean} True if activation succeeded
 */
function activateProAccess(key) {
  if (!isValidLicenseKeyFormat(key)) return false;

  // Test keys (TESTPRO-xxxx) work just like real keys
  state.proAccess = {
    key: key.trim(),
    activatedAt: Date.now()
  };
  safeLocalStorageSet('ccTracker_proAccess', state.proAccess);
  return true;
}

/**
 * Check if Pro access is currently valid
 * @returns {boolean}
 */
function hasValidProAccess() {
  if (!state.proAccess) return false;
  const elapsed = Date.now() - state.proAccess.activatedAt;
  return elapsed <= 365 * 24 * 60 * 60 * 1000; // 365 days
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function extractLast4(account) {
  const match = (account || '').match(/\(?\.{0,3}(\d{4})\)?\s*$/);
  return match ? match[1] : null;
}

// Parse combined account field (e.g., "Chase Sapphire Reserve (...1234)")
// Returns: { accountType: string|null, cardNumber: string|null }
function parseCombinedAccountField(value) {
  if (!value || typeof value !== 'string') {
    return { accountType: null, cardNumber: null };
  }

  const trimmed = value.trim();

  // Try to extract last 4 digits
  const last4Match = trimmed.match(/\(?\.{0,3}(\d{4})\)?\s*$/);
  const cardNumber = last4Match ? last4Match[1] : null;

  // Get account type (everything before the number pattern)
  let accountType = null;
  if (cardNumber) {
    // Remove the last4 pattern to get the account name/type
    accountType = trimmed.replace(/\s*\(?\.{0,3}\d{4}\)?\s*$/, '').trim();
  } else {
    // No card number found - entire value is the account type
    accountType = trimmed;
  }

  return { accountType: accountType || null, cardNumber };
}

// Check if a transaction should be skipped based on account type
// Returns true if the account type indicates a non-credit card account
function shouldSkipByAccountType(accountType) {
  if (!accountType) return false;

  const normalized = accountType.toLowerCase().trim();

  // Skip these non-credit account types
  const skipTypes = ['checking', 'savings', 'investment', 'brokerage', 'money market', 'debit', 'bank'];
  if (skipTypes.some(type => normalized.includes(type))) {
    return true;
  }

  // If account type is specified and doesn't contain 'credit', skip it
  // This catches generic non-credit accounts
  if (normalized.length > 0 && !normalized.includes('credit')) {
    // But allow card names that don't explicitly say "credit"
    const cardNameIndicators = ['visa', 'mastercard', 'amex', 'american express', 'discover',
                                'sapphire', 'reserve', 'freedom', 'unlimited', 'preferred',
                                'gold', 'platinum', 'rewards', 'cash back', 'cashback'];
    if (!cardNameIndicators.some(indicator => normalized.includes(indicator))) {
      return true;
    }
  }

  return false;
}

// Get valid categories for a card (handles Cash+ and CFF dynamic categories)
function getCardCategories(cardId, txnDate = null) {
  const card = CARDS[cardId];
  if (!card) return ['other'];
  
  // Special handling for Cash+
  // Show ALL possible 5% and 2% categories so user can always recategorize
  if (cardId === 'us-bank-cash-plus') {
    const allPossible5Pct = ['streaming', 'utilities', 'cell-phone', 'department-stores', 
                            'electronics', 'furniture', 'fast-food', 'fitness', 
                            'ground-transport', 'movie-theaters', 'sporting-goods', 'select-clothing'];
    const allPossible2Pct = ['gas', 'grocery', 'dining'];
    return [...new Set([...allPossible5Pct, ...allPossible2Pct, 'other'])];
  }
  
  // Special handling for Chase Freedom Flex (quarterly rotating 5% categories)
  // Show ALL possible quarterly categories so user can always recategorize
  if (cardId === 'chase-freedom-flex') {
    const allQuarterlyOptions = [
      'amazon', 'car-rentals', 'charity', 'chase-travel', 'dining', 'ebay', 
      'ev-charging', 'fitness', 'gas', 'grocery', 'home-improvement', 'hotels', 
      'internet-cable-phone', 'live-entertainment', 'lowes', 'mcdonalds', 
      'movie-theaters', 'paypal', 'pet-stores', 'spa-self-care', 'streaming', 
      'target', 'walmart', 'whole-foods', 'wholesale-clubs'
    ];
    const baseCats = ['chase-travel', 'dining', 'drugstore'];
    return [...new Set([...baseCats, ...allQuarterlyOptions, 'other'])];
  }

  // Special handling for CSR legacy (before Oct 26, 2025)
  if (cardId === 'chase-sapphire-reserve' && card.legacyCutoffDate) {
    const csrCutoff = new Date(card.legacyCutoffDate);
    const txnDateObj = txnDate ? new Date(txnDate) : new Date();
    if (txnDateObj < csrCutoff) {
      // Use legacy categories from card definition (includes lyft for Chase partnership)
      return card.legacy?.categories || ['chase-travel', 'travel', 'dining', 'lyft', 'other'];
    }
  }

  // Special handling for Bilt legacy (before Feb 7, 2026)
  // Before Bilt 2.0, all Bilt cards had the same categories: dining, travel, rent, other
  if (card.isBilt) {
    const bilt2StartDate = new Date(2026, 1, 7); // Feb 7, 2026
    const txnDateObj = txnDate ? new Date(txnDate) : new Date();
    if (txnDateObj < bilt2StartDate) {
      // Use legacy categories - same for all Bilt cards before 2.0
      return card.legacy?.categories || ['dining', 'travel', 'rent', 'other'];
    }
  }

  return card.categories || ['other'];
}

// Map a generic category to the best matching card-specific category
function mapToCardCategory(genericCategory, cardId, txnDate = null) {
  const validCategories = getCardCategories(cardId, txnDate);
  
  // Direct match
  if (validCategories.includes(genericCategory)) {
    return genericCategory;
  }
  
  // Category mapping rules (generic -> card-specific)
  const mappings = {
    // Travel mappings - portal categories should ONLY come from actual portal purchases
    // Generic travel does NOT get portal bonuses (chase-travel, amex-travel, etc.)
    'flights-direct': ['flights-direct', 'travel', 'other'],
    'hotels-direct': ['hotels-direct', 'travel', 'other'],
    'chase-travel': ['chase-travel', 'travel', 'other'],
    'amex-travel': ['amex-travel', 'travel', 'other'],
    'bilt-travel': ['bilt-travel', 'travel', 'other'],
    'capital-one-travel': ['capital-one-travel', 'travel', 'other'],
    'capital-one-entertainment': ['capital-one-entertainment', 'entertainment', 'other'],
    'travel-ota': ['travel-ota', 'travel', 'other'],
    'travel': ['travel', 'other'], // Generic travel NEVER maps to card-specific portals
    'car-rental': ['car-rental', 'travel', 'other'],
    'parking': ['parking', 'travel', 'other'],
    'cruise': ['cruise', 'travel', 'other'],
    'transit': ['transit', 'travel', 'ground-transport', 'other'],
    'lyft': ['lyft', 'transit', 'travel', 'ground-transport', 'other'],
    
    // Food mappings  
    'dining': ['dining', 'fast-food', 'other'],
    'fast-food': ['fast-food', 'dining', 'other'],
    'grocery': ['grocery', 'whole-foods', 'other'],
    'whole-foods': ['whole-foods', 'grocery', 'amazon', 'other'],
    'online-grocery': ['online-grocery', 'grocery', 'other'], // CSP earns 3x on online grocery
    
    // Shopping mappings - wholesale/retail do NOT earn grocery bonuses
    'amazon': ['amazon', 'other'],
    'drugstore': ['drugstore', 'other'],
    'gas': ['gas', 'other'],
    'rent': ['rent', 'other'],
    'wholesale': ['wholesale', 'other'], // Costco, Sam's Club, BJ's - no grocery bonus
    'retail': ['retail', 'other'], // Target, Walmart - no grocery bonus
    'shopping': ['shopping', 'retail', 'other'],
    
    // Entertainment/Services
    'streaming': ['streaming', 'other'],
    'fitness': ['fitness', 'other'],
    'entertainment': ['entertainment', 'other'],
    'utilities': ['utilities', 'other'],
    'cell-phone': ['cell-phone', 'other'],

    // Insurance/Medical/Shipping
    'insurance': ['insurance', 'other'],
    'medical': ['medical', 'other'],
    'shipping': ['shipping', 'other'],
  };
  
  // Try to find a match from the mappings
  const possibilities = mappings[genericCategory] || [genericCategory, 'other'];
  for (const cat of possibilities) {
    if (validCategories.includes(cat)) {
      return cat;
    }
  }
  
  return 'other';
}

function formatCurrency(val) {
  return '$' + Math.abs(val || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatCurrencyPrecise(val) {
  return '$' + Math.abs(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(val) {
  return (val || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Format category for debugging display in transactions table.
 * Shows: subcategory → category (confidence) or category (confidence) if same
 * Examples:
 *   salon → other (45)    - subcategory 'salon' rolled up to 'other', confidence 45
 *   dining (85)           - subcategory 'dining', card has dining bonus, confidence 85
 *   coffee-shop → dining (70) - specific subcategory rolled up to parent
 */
function formatCategoryDebug(txn) {
  const sub = txn.subcategory || 'unknown';
  const cat = txn.category || 'other';
  const conf = txn.confidence || 0;
  const isUserSet = txn.categorySource === 'rule' || txn.categorySource === 'confirmed';
  const checkmark = isUserSet ? ' ✓' : '';

  if (sub === cat) {
    // Subcategory matches earning category - simple display
    return `${escapeHtml(cat)} (${conf})${checkmark}`;
  } else {
    // Subcategory rolled up to different category via hierarchy
    return `<span style="color:#6b7280;">${escapeHtml(sub)}</span> → ${escapeHtml(cat)} (${conf})${checkmark}`;
  }
}

// HTML escape function to prevent XSS attacks from user-controlled data
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// CLASSIFICATION ENGINE (loaded from classification.js via CardTracker namespace)
// =============================================================================
const CONFIDENCE_ADJUSTMENTS = window.CardTracker.classification.CONFIDENCE_ADJUSTMENTS;
const VAGUE_CSV_CATEGORIES = window.CardTracker.classification.VAGUE_CSV_CATEGORIES;
const CONFIDENCE_THRESHOLD = window.CardTracker.classification.CONFIDENCE_THRESHOLD;
const CSV_TO_SUBCATEGORY = window.CardTracker.classification.CSV_TO_SUBCATEGORY;
function classifyMerchant(merchant, csvCategory, cardId, originalStatement) { return window.CardTracker.classification.classifyMerchant(merchant, csvCategory, cardId, originalStatement); }
function mapCSVToSubcategory(normCSV) { return window.CardTracker.classification.mapCSVToSubcategory(normCSV); }
function subcategoryAgrees(cat1, cat2) { return window.CardTracker.classification.subcategoryAgrees(cat1, cat2); }
function checkPOSPatterns(normalizedMerchant) { return window.CardTracker.classification.checkPOSPatterns(normalizedMerchant); }
function checkAddressPatterns(normalizedMerchant) { return window.CardTracker.classification.checkAddressPatterns(normalizedMerchant); }
function classifyTravel(normalizedText, cardId) { return window.CardTracker.classification.classifyTravel(normalizedText, cardId); }

function getPointValue(cardId) {
  if (state.customPointValues[cardId] !== undefined) {
    return state.customPointValues[cardId];
  }
  return CARDS[cardId]?.pointValue || 0.01;
}

// Get annual bonus points for a card (user-configurable, falls back to card default)
function getAnnualBonusPoints(cardId) {
  if (state.customAnnualBonusPoints[cardId] !== undefined) {
    return state.customAnnualBonusPoints[cardId];
  }
  return CARDS[cardId]?.annualBonusPoints || 0;
}

// Check whether an annual fee was detected in transaction data for this card.
// If year is specified, checks only that year; otherwise checks any year.
function hasDetectedAnnualFee(cardId, year = null) {
  const fees = state.detectedAnnualFees[cardId];
  if (!fees) return false;
  if (year) return !!fees[year];
  return Object.keys(fees).length > 0;
}

// Get the dollar value of the annual bonus points for a card.
// Only returns a value if an annual fee was actually detected in the transaction data,
// so the bonus is tied to the card anniversary (when the fee posts).
// Pass year=null for "all years" (any fee detected), or a specific year.
function getAnnualBonusValue(cardId, year = null) {
  if (getAnnualBonusPoints(cardId) <= 0) return 0;
  if (!hasDetectedAnnualFee(cardId, year)) return 0;
  return getAnnualBonusPoints(cardId) * getPointValue(cardId);
}

// Calculate Bilt rent points for a billing cycle based on spending ratio or Bilt Cash
// Returns { points, rate, reason } for the rent payment
function calculateBiltRentPoints(cardId, rentAmount, everydaySpend, billingMonth, billingYear) {
  const card = CARDS[cardId];
  const cfg = state.biltConfig[cardId] || {};
  
  if (!card || !card.isBilt) return { points: 0, rate: 0, reason: 'Not a Bilt card' };
  
  // Check if this is legacy period
  const bilt2StartDate = new Date(2026, 1, 7);
  const cycleDate = new Date(billingYear, billingMonth - 1, 15); // Mid-month as proxy
  if (cycleDate < bilt2StartDate) {
    // Legacy: flat rate based on card
    const legacyRate = card.legacy?.multipliers?.rent || 1;
    return { points: Math.round(rentAmount * legacyRate), rate: legacyRate, reason: `${legacyRate}x rent (legacy Bilt)` };
  }
  
  // Bilt 2.0 logic
  if (cfg.rewardOption === 'housing-only') {
    // Housing-only: rate based on everyday spend ratio
    const ratio = rentAmount > 0 ? everydaySpend / rentAmount : 0;
    let rate = 0;
    let tier = '< 25%';
    
    if (ratio >= 1.0) { rate = 1.25; tier = '100%+'; }
    else if (ratio >= 0.75) { rate = 1.0; tier = '75-99%'; }
    else if (ratio >= 0.50) { rate = 0.75; tier = '50-74%'; }
    else if (ratio >= 0.25) { rate = 0.5; tier = '25-49%'; }
    else { rate = 0; tier = '< 25%'; }
    
    // Minimum floor of 250 points if below threshold but rent was paid
    const points = rate > 0 ? Math.round(rentAmount * rate) : (rentAmount > 0 ? 250 : 0);
    const reason = rate > 0 
      ? `${rate}x rent (${tier} spend ratio: $${everydaySpend.toFixed(0)}/$${rentAmount.toFixed(0)})`
      : `250 pts floor (${tier} spend ratio)`;
    
    return { points, rate, reason };
  } else {
    // Flexible Bilt Cash: user specifies how much Bilt Cash to redeem
    // $3 Bilt Cash = 100 points on $100 rent (i.e., $30 = 1000 pts on $1000)
    const monthlyBiltCash = cfg.monthlyBiltCashRedemption || 0;
    const maxPointsUnlocked = (monthlyBiltCash / 3) * 100;
    const points = Math.min(maxPointsUnlocked, rentAmount); // Cap at 1x rent
    const effectiveRate = rentAmount > 0 ? points / rentAmount : 0;

    const reason = points > 0
      ? `~${(effectiveRate * 100).toFixed(0)}% rent via $${monthlyBiltCash} Bilt Cash`
      : 'No Bilt Cash allocated for rent';
    
    return { points: Math.round(points), rate: effectiveRate, reason };
  }
}

// Detect rent transactions from bank accounts (not cards)
function detectBiltRentPayments(transactions, cardId) {
  const cfg = state.biltConfig[cardId] || {};
  const rentTxns = [];
  
  if (cfg.rentDetection === 'manual') {
    // Manual: look for transactions matching configured amount/day
    const rentAmount = cfg.manualRentAmount || 0;
    const rentDay = cfg.manualRentDay || 1;
    
    transactions.forEach(txn => {
      const amt = Math.abs(txn.amount);
      const txnDate = new Date(txn.date);
      const day = txnDate.getDate();
      
      // Match if amount is close (within $10) and day is close (within 3 days)
      if (Math.abs(amt - rentAmount) <= 10 && Math.abs(day - rentDay) <= 3) {
        rentTxns.push({ ...txn, isDetectedRent: true });
      }
    });
  } else {
    // Auto-detect: look for rent/mortgage keywords or categories
    const rentKeywords = ['rent', 'mortgage', 'hoa', 'property management', 'apartment', 
      'avalon', 'equity residential', 'greystar', 'bilt', 'housing'];
    const rentCategories = ['rent', 'mortgage', 'housing'];
    
    transactions.forEach(txn => {
      const merchant = (txn.merchant || '').toLowerCase();
      const category = (txn.category || '').toLowerCase();
      const amt = Math.abs(txn.amount);
      
      // Must be a debit (negative or large positive indicating payment)
      if (amt < 500) return; // Rent is usually > $500
      
      const matchesKeyword = rentKeywords.some(kw => merchant.includes(kw));
      const matchesCategory = rentCategories.some(cat => category.includes(cat));
      
      if (matchesKeyword || matchesCategory) {
        rentTxns.push({ ...txn, isDetectedRent: true });
      }
    });
  }
  
  return rentTxns;
}

function getMultiplier(cardId, category, txnDate = null, merchantDesc = '') {
  const card = CARDS[cardId];
  if (!card) return { rate: 1, reason: 'Unknown card' };
  
  // Helper to get year from date
  function getYearFromDate(dateStr) {
    if (!dateStr) return new Date().getFullYear();
    if (dateStr.includes('-')) return parseInt(dateStr.split('-')[0]);
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      const yearPart = parts[2];
      return parseInt(yearPart.length === 2 ? '20' + yearPart : yearPart);
    }
    return new Date().getFullYear();
  }
  
  // Special handling for Cash+ with quarterly category selection
  if (cardId === 'us-bank-cash-plus') {
    const quarter = txnDate ? getQuarterForDate(txnDate) : getCurrentQuarter();
    const year = getYearFromDate(txnDate);
    const yearQuarterKey = `${year}-${quarter}`;

    // Try year-specific key first, then fall back to quarter-only key for legacy data
    const quarterCats = state.cashPlusCategories[yearQuarterKey] || state.cashPlusCategories[quarter];

    if (quarterCats) {
      // Walk up hierarchy to check if this category or any parent matches 5% selection
      let checkCat = category;
      while (checkCat) {
        if (quarterCats.fivePercent?.includes(checkCat)) {
          const reason = checkCat !== category
            ? `5% ${checkCat} (from ${category}, ${year} ${quarter})`
            : `5% ${category} (${year} ${quarter} selection)`;
          return { rate: 5, reason };
        }
        checkCat = CATEGORY_HIERARCHY[checkCat];
      }

      // Walk up hierarchy to check if this category or any parent matches 2% selection
      checkCat = category;
      while (checkCat) {
        if (quarterCats.twoPercent === checkCat) {
          const reason = checkCat !== category
            ? `2% ${checkCat} (from ${category}, ${year} ${quarter})`
            : `2% ${category} (${year} ${quarter} selection)`;
          return { rate: 2, reason };
        }
        checkCat = CATEGORY_HIERARCHY[checkCat];
      }
    }
    // Cash+ base rate is 1%
    return { rate: 1, reason: '1% base rate' };
  }
  
  // Special handling for CFF with quarterly rotating categories (from stored historical data)
  if (cardId === 'chase-freedom-flex') {
    const quarter = txnDate ? getQuarterForDate(txnDate) : getCurrentQuarter();
    const year = getYearFromDate(txnDate);
    const yearQuarterKey = `${year}-${quarter}`;

    // Look up stored quarterly bonus categories
    const CFF_DATA = window.CardTracker.cffQuarterlyData || {};
    const quarterEntries = CFF_DATA[yearQuarterKey] || [];
    const normMerchant = (merchantDesc || '').toLowerCase();

    // Helper to parse transaction month (1-12)
    function getTxnMonth(dateStr) {
      if (!dateStr) return new Date().getMonth() + 1;
      if (dateStr.includes('-')) return parseInt(dateStr.split('-')[1]); // YYYY-MM-DD
      if (dateStr.includes('/')) return parseInt(dateStr.split('/')[0]); // MM/DD/YYYY
      return new Date().getMonth() + 1;
    }

    // Check each stored quarterly category for a match
    for (const entry of quarterEntries) {
      // Month-only restriction (e.g., PayPal December-only, Internet June-only)
      if (entry.monthOnly) {
        const txnMonth = getTxnMonth(txnDate);
        if (txnMonth !== entry.monthOnly) continue;
      }

      // PayPal: match by merchant description (payment wrapper, not a category)
      if (entry.key === 'paypal') {
        if (normMerchant.includes('paypal')) {
          const monthNote = entry.monthOnly ? ` ${new Date(2000, entry.monthOnly - 1).toLocaleString('en', {month: 'long'})}` : '';
          return { rate: entry.rate, reason: `${entry.rate}% PayPal (${year} ${quarter}${monthNote})` };
        }
        continue;
      }

      // Merchant-keyword entries: match by merchant description only
      // These are merchant-specific bonuses (McDonald's, Norwegian Cruise Line, etc.)
      // that should NOT fall through to broad category matching
      if (entry.merchantKeywords) {
        let matched = false;
        for (const kw of entry.merchantKeywords) {
          if (normMerchant.includes(kw)) { matched = true; break; }
        }
        if (matched) {
          return { rate: entry.rate, reason: `${entry.rate}% ${entry.label} (${year} ${quarter} bonus)` };
        }
        continue; // No keyword match - skip this entry entirely
      }

      // Category-based: walk up the transaction's category hierarchy to find a match
      let checkCat = category;
      while (checkCat) {
        if (checkCat === entry.key) {
          const reason = checkCat !== category
            ? `${entry.rate}% ${entry.label} (from ${category}, ${year} ${quarter})`
            : `${entry.rate}% ${entry.label} (${year} ${quarter} bonus)`;
          return { rate: entry.rate, reason };
        }
        checkCat = CATEGORY_HIERARCHY[checkCat];
      }
    }

    // Check static multipliers with hierarchy (chase-travel 5x, dining 3x, drugstore 3x)
    // Only apply if not already matched by a quarterly bonus above
    const effectiveCat = getEffectiveCategory(category, cardId);
    if (card.multipliers[effectiveCat]) {
      const rate = card.multipliers[effectiveCat];
      if (effectiveCat !== category) {
        return { rate, reason: `${rate}x ${effectiveCat} (from ${category})` };
      }
      return { rate, reason: `${rate}x ${effectiveCat}` };
    }

    return { rate: card.baseRate, reason: `${card.baseRate}x base rate` };
  }
  
  // Special handling for Bilt cards (legacy vs 2.0)
  if (card.isBilt) {
    const cfg = state.biltConfig[cardId] || {};
    // Bilt 2.0 universally starts Feb 7, 2026
    const bilt2StartDate = new Date(2026, 1, 7); // Feb 7, 2026

    // Parse transaction date explicitly to avoid timezone issues
    let txnDateObj;
    if (txnDate) {
      if (txnDate.includes('-')) {
        const [year, month, day] = txnDate.split('-').map(Number);
        txnDateObj = new Date(year, month - 1, day);
      } else if (txnDate.includes('/')) {
        const parts = txnDate.split('/');
        const month = parseInt(parts[0]);
        const day = parseInt(parts[1]);
        let year = parseInt(parts[2]);
        if (year < 100) year += 2000;
        txnDateObj = new Date(year, month - 1, day);
      } else {
        txnDateObj = new Date(txnDate);
      }
    } else {
      txnDateObj = new Date();
    }
    const isLegacy = txnDateObj < bilt2StartDate;

    // LEGACY MODE (before Feb 7, 2026)
    // All Bilt cards had identical rates: 3x dining, 2x travel, 1x everything else
    if (isLegacy) {
      if (category === 'rent') {
        // Legacy rent: 1x with 5 transactions requirement (no special rent multiplier)
        return { rate: 1, reason: '1x rent (Legacy Bilt — 5 txn requirement)' };
      }
      // Legacy category multipliers (same for all old Bilt cards)
      if (category === 'dining') return { rate: 3, reason: '3x dining (Legacy Bilt)' };
      if (category === 'travel') return { rate: 2, reason: '2x travel (Legacy Bilt)' };
      // Everything else is 1x in legacy mode (no matter which Bilt card)
      return { rate: 1, reason: '1x base (Legacy Bilt)' };
    }
    
    // BILT 2.0 MODE (Feb 7, 2026+)
    if (category === 'rent') {
      const rentAmt = cfg.manualRentAmount || 2000;
      
      if (cfg.rewardOption === 'housing-only') {
        // Calculate NET spending ratio from transactions in the same month (purchases - refunds)
        const txnMonth = txnDateObj.getMonth();
        const txnYear = txnDateObj.getFullYear();
        const monthTxns = state.transactions.filter(t => {
          // Raw transactions lack cardId; look up via card mappings
          const mappedCardId = state.cardMappings[t.last4];
          if (!mappedCardId || !mappedCardId.startsWith('bilt-')) return false;
          const d = new Date(t.date);
          return d.getMonth() === txnMonth && d.getFullYear() === txnYear;
        });
        const purchases = monthTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const refunds = monthTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const monthSpend = Math.max(0, purchases - refunds);
        
        const ratio = rentAmt > 0 ? monthSpend / rentAmt : 0;
        let rate = 0, tierName = '<25%';
        if (ratio >= 1.0) { rate = 1.25; tierName = '100%+'; }
        else if (ratio >= 0.75) { rate = 1; tierName = '75-99%'; }
        else if (ratio >= 0.50) { rate = 0.75; tierName = '50-74%'; }
        else if (ratio >= 0.25) { rate = 0.5; tierName = '25-49%'; }
        
        if (rate === 0) {
          return { rate: 0, reason: `Rent: 250pt floor (${tierName}, $${monthSpend.toFixed(0)}/$${rentAmt} net spend)` };
        }
        return { rate, reason: `Rent: ${rate}x Housing-only (${tierName}: $${monthSpend.toFixed(0)}/$${rentAmt})` };
      } else {
        // Flexible Bilt Cash option - use user-specified monthly redemption amount
        const monthlyRedemption = cfg.monthlyBiltCashRedemption || 0;
        
        const maxPts = (monthlyRedemption / 3) * 100; // $3 Bilt Cash = 100 pts on $100 rent
        const rate = rentAmt > 0 ? Math.min(1, maxPts / rentAmt) : 0;
        if (rate <= 0) {
          return { rate: 0, reason: 'Rent: No Bilt Cash redemption configured' };
        }
        return { rate, reason: `Rent: ${(rate*100).toFixed(0)}% via $${monthlyRedemption.toFixed(0)} Bilt Cash/mo` };
      }
    }
    
    // Obsidian 3x bonus category choice
    if (cardId === 'bilt-obsidian') {
      if (cfg.bonusCategory === 'grocery') {
        if (category === 'grocery') return { rate: 3, reason: '3x grocery (Obsidian bonus)' };
        if (category === 'dining') return { rate: 1, reason: '1x dining (grocery selected)' };
      } else {
        // Default: dining is 3x
        if (category === 'dining') return { rate: 3, reason: '3x dining (Obsidian bonus)' };
        if (category === 'grocery') return { rate: 1, reason: '1x grocery (dining selected)' };
      }
    }
    
    // Standard multipliers
    if (card.multipliers[category]) {
      return { rate: card.multipliers[category], reason: `${card.multipliers[category]}x ${category}` };
    }
    return { rate: card.baseRate, reason: `${card.baseRate}x base rate` };
  }

  // Special handling for Chase Lyft partnership (Jan 12, 2020+)
  // Lyft bonuses apply to CSR, CSP, and CFU - must check before other travel logic
  if (category === 'lyft' && card.lyftPartnershipStart) {
    const lyftStart = new Date(card.lyftPartnershipStart);
    const txnDateObj = txnDate ? new Date(txnDate) : new Date();

    if (txnDateObj >= lyftStart) {
      // CSR had 10x Lyft until April 1, 2025, then 5x after
      if (cardId === 'chase-sapphire-reserve' && card.lyft10xEndDate) {
        const lyft10xEnd = new Date(card.lyft10xEndDate);
        if (txnDateObj < lyft10xEnd) {
          return { rate: 10, reason: '10x Lyft (Chase partnership 2020-2025)' };
        }
        // After April 1, 2025 - fall through to standard 5x from multipliers
      }
      // CFU had 5x Lyft until April 1, 2025, then 2x after
      if (cardId === 'chase-freedom-unlimited' && card.lyft5xEndDate) {
        const lyft5xEnd = new Date(card.lyft5xEndDate);
        if (txnDateObj < lyft5xEnd) {
          return { rate: 5, reason: '5x Lyft (Chase partnership 2020-2025)' };
        }
        // After April 1, 2025 - fall through to standard 2x from multipliers
      }
      // Use defined multiplier (CSP 5x, CSR 5x post-April 2025, CFU 2x post-April 2025)
      if (card.multipliers['lyft']) {
        return { rate: card.multipliers['lyft'], reason: `${card.multipliers['lyft']}x Lyft (Chase partnership)` };
      }
    }
    // Before partnership start date - Lyft would just be regular transit/travel
  }

  // Special handling for CSR legacy (before Oct 26, 2025)
  if (cardId === 'chase-sapphire-reserve' && card.legacyCutoffDate) {
    const csrCutoff = new Date(card.legacyCutoffDate);
    const txnDateObj = txnDate ? new Date(txnDate) : new Date();

    if (txnDateObj < csrCutoff) {
      // Legacy CSR rates
      if (category === 'chase-travel') return { rate: 10, reason: '10x Chase Travel (Legacy CSR)' };
      if (category === 'dining') return { rate: 3, reason: '3x dining (Legacy CSR)' };

      // Legacy CSR had 3x on ALL travel — check if category is travel-related
      // Walk up hierarchy to see if this category falls under 'travel'
      // Note: Lyft is handled above, so won't reach here for Lyft transactions
      let checkCat = category;
      while (checkCat) {
        if (checkCat === 'travel' || checkCat === 'flights-direct' ||
            checkCat === 'hotels-direct' || checkCat === 'car-rental' ||
            checkCat === 'transit' || checkCat === 'cruise' ||
            checkCat === 'vacation-rental' || checkCat === 'airbnb') {
          return { rate: 3, reason: `3x travel (Legacy CSR — ${category})` };
        }
        checkCat = CATEGORY_HIERARCHY[checkCat];
      }

      return { rate: 1, reason: '1x base (Legacy CSR)' };
    }
    // If after cutoff, fall through to standard multiplier logic below
  }

  // Capital One Venture X: portal bookings earn 10x on hotels & rental cars, 5x on everything else.
  // Check the merchant description for travel sub-type keywords to decide 10x vs 5x.
  if (cardId === 'capital-one-venture-x' && category === 'capital-one-travel' && merchantDesc) {
    const normDesc = merchantDesc.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    // Hotel keywords (same as classifyTravel hotels list)
    const hotelKeywords = ['marriott', 'hilton', 'hyatt', 'ihg', 'wyndham', 'best western', 'radisson',
      'sheraton', 'westin', 'ritz', 'four seasons', 'mgm', 'caesars', 'flamingo',
      'venetian', 'bellagio', 'cosmopolitan'];
    // Car rental keywords (same as classifyTravel car rentals list)
    const carRentalKeywords = ['hertz', 'enterprise', 'avis', 'budget', 'national car', 'alamo',
      'dollar rent', 'thrifty', 'sixt', 'zipcar'];
    for (const kw of hotelKeywords) {
      if (normDesc.includes(kw)) {
        return { rate: 10, reason: `10x Capital One Travel (hotel: ${kw})` };
      }
    }
    for (const kw of carRentalKeywords) {
      if (normDesc.includes(kw)) {
        return { rate: 10, reason: `10x Capital One Travel (rental car: ${kw})` };
      }
    }
    // Flights, vacation rentals, and anything unrecognized default to 5x (conservative)
    return { rate: 5, reason: '5x Capital One Travel (default — flights/vacation rentals/unknown)' };
  }

  // Amex Platinum: portal bookings earn 5x on hotels & flights, 1x on everything else (car rentals, etc.)
  // Check the merchant description for travel sub-type keywords to decide 5x vs 1x.
  if (cardId === 'amex-platinum' && category === 'amex-travel' && merchantDesc) {
    const normDesc = merchantDesc.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    // Check for hotel keywords in Amex Travel transactions (e.g., "AMEXTRAVEL.COM PREPAID HOTEL")
    if (normDesc.includes('hotel') || normDesc.includes('prepaid hotel')) {
      return { rate: 5, reason: '5x Amex Travel (hotel)' };
    }
    // Check for flight keywords in Amex Travel transactions (e.g., "AMEXTRAVEL.COM AIRFARE")
    if (normDesc.includes('airfare') || normDesc.includes('flight') || normDesc.includes('airline')) {
      return { rate: 5, reason: '5x Amex Travel (flight)' };
    }
    // Car rentals and everything else through Amex Travel get 1x base rate
    return { rate: 1, reason: '1x Amex Travel (car rental or other)' };
  }

  // Use hierarchy to find the best matching category for this card
  const effectiveCat = getEffectiveCategory(category, cardId);

  if (card.multipliers[effectiveCat]) {
    const rate = card.multipliers[effectiveCat];
    // Show both specific and effective category if they differ
    if (effectiveCat !== category && category !== 'other') {
      return { rate, reason: `${rate}x ${effectiveCat} (from ${category})` };
    }
    return { rate, reason: `${rate}x ${effectiveCat}` };
  }

  return { rate: card.baseRate, reason: `${card.baseRate}x base rate` };
}

// Get effective annual fee for a card based on transaction dates
// For CSR: use $795 if any transactions exist after Oct 26, 2025, otherwise use $550
function getEffectiveAnnualFee(cardId, transactions = []) {
  const card = CARDS[cardId];
  if (!card) return 0;

  // Determine the year(s) from the transactions for this card
  const cardTxns = transactions.filter(t => t.cardId === cardId);
  const txnYears = new Set();
  for (const t of cardTxns) {
    let year;
    if (t.date.includes('-')) {
      year = parseInt(t.date.split('-')[0]);
    } else if (t.date.includes('/')) {
      year = parseInt(t.date.split('/')[2]);
      if (year < 100) year += 2000;
    }
    if (year) txnYears.add(year);
  }

  // Check for detected annual fee from transaction data
  // If we have a detected fee for the relevant year, use it
  const detectedFees = state.detectedAnnualFees[cardId];
  if (detectedFees) {
    // Helper to extract amount from detected fee (handles both old number format and new object format)
    const getFeeAmount = (fee) => typeof fee === 'object' ? fee.amount : fee;

    // If there's only one year in the transactions, use that year's detected fee
    const yearsArray = Array.from(txnYears);
    if (yearsArray.length === 1 && detectedFees[yearsArray[0]]) {
      return getFeeAmount(detectedFees[yearsArray[0]]);
    }
    // If multiple years, use the most recent year's detected fee if available
    if (yearsArray.length > 1) {
      const sortedYears = yearsArray.sort((a, b) => b - a);
      for (const year of sortedYears) {
        if (detectedFees[year]) {
          return getFeeAmount(detectedFees[year]);
        }
      }
    }
    // If no year filter, use the most recent detected fee
    if (yearsArray.length === 0) {
      const detectedYears = Object.keys(detectedFees).sort((a, b) => b - a);
      if (detectedYears.length > 0) {
        return getFeeAmount(detectedFees[detectedYears[0]]);
      }
    }
  }

  // Fall back to card definition logic

  // Handle cards where annual fee started from a specific date (e.g., Bilt Obsidian/Palladium - no fee before Feb 7, 2026)
  if (card.annualFeeStartDate) {
    const startDate = new Date(card.annualFeeStartDate);
    if (cardTxns.length > 0) {
      const hasPostStart = cardTxns.some(t => new Date(t.date) >= startDate);
      return hasPostStart ? card.annualFee : 0;
    }
    // No transactions for this card - default to current annual fee
    return card.annualFee || 0;
  }

  // Special handling for CSR legacy annual fee
  if (cardId === 'chase-sapphire-reserve' && card.legacyCutoffDate) {
    const cutoff = new Date(card.legacyCutoffDate);

    // Check if any transaction is after the cutoff date
    const hasPostCutoff = cardTxns.some(t => {
      const txnDate = new Date(t.date);
      return txnDate >= cutoff;
    });

    return hasPostCutoff ? card.annualFee : card.legacyAnnualFee;
  }

  return card.annualFee || 0;
}

// =============================================================================
// CARD YEAR TOGGLE FUNCTIONS
// =============================================================================

/**
 * Check if a card can show the card year toggle
 * Requirements: card has annual fee > 0 AND we have at least one detected fee with a date
 * @param {string} cardId - Card ID
 * @returns {boolean} True if toggle should be shown
 */
function canShowCardYearToggle(cardId) {
  const card = CARDS[cardId];
  if (!card || !card.annualFee || card.annualFee <= 0) {
    return false;
  }

  const detectedFees = state.detectedAnnualFees[cardId];
  if (!detectedFees) {
    return false;
  }

  // Check if we have at least one fee with a date
  for (const year of Object.keys(detectedFees)) {
    const fee = detectedFees[year];
    if (typeof fee === 'object' && fee.date) {
      return true;
    }
  }

  return false;
}

/**
 * Get the card year period that will be active on December 31 of the given calendar year
 * Example: CSR fee posts March. For calendar year 2025, card year is March 2025 - March 2026
 * @param {string} cardId - Card ID
 * @param {number} calendarYear - The calendar year being viewed
 * @returns {{startDate: Date, endDate: Date, startMonth: string, endMonth: string}|null} Card year period or null
 */
function getCardYearPeriod(cardId, calendarYear) {
  const detectedFees = state.detectedAnnualFees[cardId];
  if (!detectedFees) return null;

  // Get all fee dates sorted chronologically
  const feeDates = [];
  for (const year of Object.keys(detectedFees)) {
    const fee = detectedFees[year];
    if (typeof fee === 'object' && fee.date) {
      const parsed = parseDateString(fee.date);
      if (parsed) {
        feeDates.push({ year: parseInt(year), date: parsed.date, month: parsed.month, day: parsed.day });
      }
    }
  }

  if (feeDates.length === 0) return null;

  // Sort by date
  feeDates.sort((a, b) => a.date - b.date);

  // Find the card year active on Dec 31 of the calendar year
  // Use Jan 1 of the next year as an exclusive upper bound
  const dec31Exclusive = new Date(calendarYear + 1, 0, 1);

  // The card year active on Dec 31 is the one that started BEFORE or ON Dec 31 and ends AFTER Dec 31
  // Fee date marks the START of a new card year

  // Find the most recent fee date before Jan 1 of calendarYear+1 (i.e., on or before Dec 31)
  let startFee = null;
  for (const fee of feeDates) {
    if (fee.date < dec31Exclusive) {
      startFee = fee;
    } else {
      break;
    }
  }

  // If no fee found before Dec 31, we need to extrapolate backward from the earliest known fee
  if (!startFee && feeDates.length > 0) {
    const earliestFee = feeDates[0];
    if (dec31Exclusive <= earliestFee.date) {
      // Extrapolate backward by one year
      const extrapolatedYear = earliestFee.year - 1;
      startFee = {
        year: extrapolatedYear,
        date: new Date(extrapolatedYear, earliestFee.month - 1, earliestFee.day),
        month: earliestFee.month,
        day: earliestFee.day
      };
    }
  }

  if (!startFee) {
    // Still can't determine - Dec 31 is after all known fees
    return null;
  }

  // The end of the card year is approximately one year after the start
  // Use the fee month/day but in the following year
  const startDate = new Date(startFee.year, startFee.month - 1, startFee.day);
  const endDate = new Date(startFee.year + 1, startFee.month - 1, startFee.day);

  // Calculate the last included day (day before endDate) for display
  const lastIncludedDate = new Date(endDate);
  lastIncludedDate.setDate(lastIncludedDate.getDate() - 1);

  // Format full dates for tooltip (e.g., "Feb 15, 2024 – Feb 14, 2025")
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatDate = (d) => `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const startFormatted = formatDate(startDate);
  const endFormatted = formatDate(lastIncludedDate);

  return { startDate, endDate, startFormatted, endFormatted };
}

/**
 * Calculate card metrics for a specific date range (card year)
 * @param {string} cardId - Card ID
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @param {Array} allTransactions - All transactions
 * @returns {{spend: number, points: number, pointsValue: number, credits: number, pointsByCategory: Object}} Metrics
 */
function calculateCardYearMetrics(cardId, startDate, endDate, allTransactions) {
  const card = CARDS[cardId];
  if (!card) return null;

  // Filter transactions for this card within the date range
  const filteredTxns = allTransactions.filter(t => {
    if (t.cardId !== cardId) return false;
    if (t.isPayment) return false;

    const parsed = parseDateString(t.date);
    if (!parsed) return false;

    const txnDate = parsed.date;
    return txnDate >= startDate && txnDate < endDate;
  });

  // Calculate metrics
  const result = {
    spend: 0,
    points: 0,
    pointsValue: 0,
    credits: 0,
    pointsByCategory: {}
  };

  filteredTxns.forEach(t => {
    if (t.isCredit && !t.isRefund) {
      result.credits += Math.abs(t.amount);
    } else if (!t.isCredit) {
      result.spend += Math.abs(t.amount);
      result.points += t.points || 0;
      result.pointsValue += t.pointsValue || 0;

      // Track points by category
      const cat = t.category || 'other';
      if (!result.pointsByCategory[cat]) {
        result.pointsByCategory[cat] = { points: 0, spend: 0 };
      }
      result.pointsByCategory[cat].points += t.points || 0;
      result.pointsByCategory[cat].spend += Math.abs(t.amount);
    }
  });

  return result;
}

/**
 * Get manual credits claimed within a card year period
 * @param {string} cardId - Card ID
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @returns {number} Total manual credits value
 */
function getCardYearManualCredits(cardId, startDate, endDate) {
  const card = CARDS[cardId];
  if (!card) return 0;

  const monthlyForCard = state.monthlyCredits[cardId] || {};
  let total = 0;

  for (const credit of (card.credits || [])) {
    if (!credit.manual) continue;

    const yearData = monthlyForCard[credit.name];
    if (!yearData) continue;

    const monthlyAmount = credit.amount / 12;
    const isDisabled = (state.disabledCredits[cardId] || []).includes(credit.name);
    if (isDisabled) continue;

    // Check each year's claimed months
    const yearsToCheck = typeof yearData === 'object' && !Array.isArray(yearData) ? yearData : {};

    for (const [yearStr, months] of Object.entries(yearsToCheck)) {
      const year = parseInt(yearStr);
      if (!Array.isArray(months)) continue;

      for (const monthIndex of months) {
        // Create date for the claimed month (use 15th as middle of month)
        const claimDate = new Date(year, monthIndex, 15);
        if (claimDate >= startDate && claimDate < endDate) {
          total += monthlyAmount;
        }
      }
    }
  }

  return total;
}

/**
 * Get credits used by credit name within a card year period (for dropdown display)
 * @param {string} cardId - Card ID
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @param {Array} allTransactions - All transactions
 * @returns {Object} Map of credit name to amount used
 */
function getCardYearCreditsUsed(cardId, startDate, endDate, allTransactions) {
  const result = {};

  // Get transaction-detected credits within the date range
  allTransactions.forEach(txn => {
    if (txn.cardId !== cardId) return;
    if (!txn.isCredit || !txn.creditMatch) return;

    const parsed = parseDateString(txn.date);
    if (!parsed) return;

    const txnDate = parsed.date;
    if (txnDate >= startDate && txnDate < endDate) {
      if (!result[txn.creditMatch]) result[txn.creditMatch] = 0;
      result[txn.creditMatch] += Math.abs(txn.amount);
    }
  });

  // Add manual credits claimed within the period
  const card = CARDS[cardId];
  if (!card) return result;

  const monthlyForCard = state.monthlyCredits[cardId] || {};

  for (const credit of (card.credits || [])) {
    if (!credit.manual) continue;

    const yearData = monthlyForCard[credit.name];
    if (!yearData) continue;

    const monthlyAmount = credit.amount / 12;
    const isDisabled = (state.disabledCredits[cardId] || []).includes(credit.name);
    if (isDisabled) continue;

    // Check each year's claimed months
    const yearsToCheck = typeof yearData === 'object' && !Array.isArray(yearData) ? yearData : {};

    for (const [yearStr, months] of Object.entries(yearsToCheck)) {
      const year = parseInt(yearStr);
      if (!Array.isArray(months)) continue;

      for (const monthIndex of months) {
        // Create date for the claimed month (use 15th as middle of month)
        const claimDate = new Date(year, monthIndex, 15);
        if (claimDate >= startDate && claimDate < endDate) {
          if (!result[credit.name]) result[credit.name] = 0;
          result[credit.name] += monthlyAmount;
        }
      }
    }
  }

  return result;
}

// Determine badge color based on whether this is the optimal choice
// Green = best/tied for best option, Yellow = good but better exists, Red = suboptimal
function getCategoryBadgeStyle(txn, returnTooltip = false) {
  // Build debug tooltip suffix showing classification details
  const debugInfo = txn.subcategory
    ? `\n\nClassification: ${txn.subcategory}${txn.subcategory !== txn.category ? ' → ' + txn.category : ''}\nConfidence: ${txn.confidence || 0}\nSource: ${txn.categorySource || 'unknown'}`
    : '';

  if (txn.isPayment) {
    const style = 'background:#f3f4f6;color:#6b7280;'; // Gray for payments
    return returnTooltip ? { style, tooltip: 'Payment — not counted' + debugInfo } : style;
  }
  if (txn.isCredit && !txn.isRefund) {
    const style = 'background:#e0f2fe;color:#0369a1;'; // Blue for credits
    return returnTooltip ? { style, tooltip: 'Statement credit' + debugInfo } : style;
  }
  if (txn.isRefund) {
    const style = 'background:#fce7f3;color:#9d174d;'; // Pink for refunds
    return returnTooltip ? { style, tooltip: 'Refund — points deducted' + debugInfo } : style;
  }

  const category = txn.category;
  const cardId = txn.cardId;
  const currentRate = txn.multiplier;
  const txnDate = txn.date;

  // Find the best possible rate for this category across all mapped cards
  const mappedCardIds = [...new Set(Object.values(state.cardMappings))].filter(id => id && id !== 'skip');
  let bestRate = currentRate;
  let bestCard = cardId;

  for (const cid of mappedCardIds) {
    const testResult = getMultiplier(cid, category, txnDate);
    if (testResult.rate > bestRate) {
      bestRate = testResult.rate;
      bestCard = cid;
    }
  }

  // Determine color and tooltip
  if (currentRate >= bestRate) {
    // This is optimal (or tied for best)
    const style = 'background:#dcfce7;color:#166534;'; // Green
    return returnTooltip ? { style, tooltip: 'Optimal card for this category' + debugInfo } : style;
  } else if (currentRate >= bestRate * 0.6) {
    // Within 60% of best - yellow
    const style = 'background:#fef9c3;color:#854d0e;'; // Yellow
    const bestCardName = CARDS[bestCard]?.shortName || bestCard;
    return returnTooltip ? { style, tooltip: `Good, but ${bestCardName} earns ${bestRate}x` + debugInfo } : style;
  } else {
    // Less than 60% of best - red/orange
    const style = 'background:#fee2e2;color:#991b1b;'; // Light red
    const bestCardName = CARDS[bestCard]?.shortName || bestCard;
    return returnTooltip ? { style, tooltip: `${bestCardName} would earn ${bestRate}x` + debugInfo } : style;
  }
}

// Returns: { name: string, disabled: boolean } | null
// - { name, disabled: false } = credit matched and enabled
// - { name, disabled: true } = credit matched but disabled in card config
// - null = no credit matched (true refund)
function detectCredit(merchant, originalStatement, cardId, txnId, txnDate = null) {
  // Check for manual override first
  if (state.creditOverrides[txnId]) {
    const override = state.creditOverrides[txnId];
    if (override === 'refund') return null; // Marked as refund, not a credit
    // Check if this credit is disabled
    const disabled = state.disabledCredits[cardId] || [];
    if (disabled.includes(override)) {
      return { name: override, disabled: true };
    }
    return { name: override, disabled: false };
  }

  const card = CARDS[cardId];
  if (!card || !card.credits) return null;

  const credits = card.credits;
  const upper = (merchant + ' ' + originalStatement).toUpperCase();
  const disabled = state.disabledCredits[cardId] || [];

  // Exclude payments, transfers, and statement balance lines - these are NOT statement credits
  const excludeKeywords = ['PAYMENT', 'THANK YOU', 'AUTOMATIC PAYMENT', 'CREDIT CARD PAYMENT', 'TRANSFER',
                           'LAST STATEMENT BAL', 'STATEMENT BALANCE', 'PREVIOUS BALANCE'];
  if (excludeKeywords.some(kw => upper.includes(kw))) return null;

  // Check each credit's keywords for a match
  for (const credit of credits) {
    // Skip manual credits (they have no keywords to match)
    if (credit.manual || !credit.keywords || credit.keywords.length === 0) continue;

    // Check if any keyword matches
    for (const kw of credit.keywords) {
      if (upper.includes(kw)) {
        // Found a match! Return with disabled status
        const isDisabled = disabled.includes(credit.name);
        return { name: credit.name, disabled: isDisabled };
      }
    }
  }

  // No specific credit matched. Check for rewards redemption patterns.
  if (upper.includes('REWARD') && (upper.includes('REDEEM') || upper.includes('STATEMENT'))) {
    return { name: 'Rewards Redemption', disabled: false };
  }
  if (upper.includes('CASHBACK') || upper.includes('CASH BACK')) {
    return { name: 'Cash Back Redemption', disabled: false };
  }

  // If this looks like a generic statement credit, return that
  if (upper.includes('CREDIT') && !upper.includes('CREDIT CARD')) {
    return { name: 'Statement Credit', disabled: false };
  }

  // No match found - this is just a refund, not a statement credit
  return null;
}

// =============================================================================
// CSV PARSING (loaded from csv-parser.js via CardTracker namespace)
// =============================================================================
function isDataRow(fields) { return window.CardTracker.csvParser.isDataRow(fields); }
function isWellsFargoFormat(fields) { return window.CardTracker.csvParser.isWellsFargoFormat(fields); }
function getCSVShapeKey(headers) { return window.CardTracker.csvParser.getCSVShapeKey(headers); }
function detectCSVFormat(headers) { return window.CardTracker.csvParser.detectCSVFormat(headers); }
function detectAccountColumnType(sampleValue) { return window.CardTracker.csvParser.detectAccountColumnType(sampleValue); }
function showColumnMapping(csvText) { return window.CardTracker.csvParser.showColumnMapping(csvText); }
function parseCSVLine(line) { return window.CardTracker.csvParser.parseCSVLine(line); }
function validateColumnMapping() { return window.CardTracker.csvParser.validateColumnMapping(); }
function applyColumnMappingAndParse() { return window.CardTracker.csvParser.applyColumnMappingAndParse(); }
function parseCSV(text) { return window.CardTracker.csvParser.parseCSV(text); }

// =============================================================================
// PROCESS TRANSACTIONS
// =============================================================================
async function processTransactions(transactions) {
  const classifications = {};

  // Classify all transactions with rules
  for (const txn of transactions) {
    // PRIORITY 0: Check skip patterns FIRST - these always take precedence
    // This ensures payments, statement balance lines, etc. are always filtered out
    // even if the user previously confirmed them as a different category
    // Check both merchant and original statement fields
    const normMerchant = (txn.merchant || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const normOriginal = (txn.original || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const combinedText = normMerchant + ' ' + normOriginal;
    const skipPatterns = SPECIFIC_CATEGORY_KEYWORDS['skip'] || [];
    let isSkipTransaction = false;
    for (const pattern of skipPatterns) {
      if (combinedText.includes(pattern)) {
        // Detect annual fee transactions before skipping
        // Annual fees typically appear as negative amounts (charges) on statements
        if ((pattern === 'annual membership fee' || pattern === 'annual fee') && txn.amount < 0) {
          const cardId = state.cardMappings[txn.last4];
          if (cardId && cardId !== 'skip') {
            // Extract year from transaction date
            let txnYear;
            if (txn.date.includes('-')) {
              txnYear = parseInt(txn.date.split('-')[0]);
            } else if (txn.date.includes('/')) {
              txnYear = parseInt(txn.date.split('/')[2]);
              if (txnYear < 100) txnYear += 2000; // Handle 2-digit years
            } else {
              txnYear = new Date().getFullYear();
            }

            // Store detected fee with full date (use absolute value since fees are negative in CSV)
            if (!state.detectedAnnualFees[cardId]) {
              state.detectedAnnualFees[cardId] = {};
            }
            // Store both amount and date for card year calculations
            state.detectedAnnualFees[cardId][txnYear] = {
              amount: Math.abs(txn.amount),
              date: txn.date
            };
          }
        }

        classifications[txn.id] = {
          subcategory: 'skip',
          source: 'skip-pattern',
          confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE,
          reason: `Skipped: "${pattern}"`
        };
        isSkipTransaction = true;
        break;
      }
    }
    if (isSkipTransaction) continue;

    // Check for single-transaction confirmation (takes precedence like merchant rules)
    if (state.confirmedTransactions[txn.id]) {
      classifications[txn.id] = {
        subcategory: state.confirmedTransactions[txn.id],
        source: 'confirmed',
        confidence: CONFIDENCE_ADJUSTMENTS.KNOWN_MERCHANT_OVERRIDE,
        reason: 'Manually confirmed'
      };
      continue;
    }

    // Look up cardId for card-specific rule matching
    const cardId = state.cardMappings[txn.last4];
    const effectiveCardId = (cardId && cardId !== 'skip') ? cardId : null;

    // Pass original statement for better pattern matching (e.g., "CL *Chase Travel")
    const result = classifyMerchant(txn.merchant, txn.monarchCategory, effectiveCardId, txn.original);
    if (result.subcategory) {
      classifications[txn.id] = result;
    } else {
      // Unknown merchant - default to 'other' with low confidence for review
      classifications[txn.id] = {
        subcategory: 'other',
        source: 'fallback',
        confidence: 0,
        reason: 'Unknown merchant - please review'
      };
    }
  }

  // ==========================================================================
  // SIBLING TRANSACTION SIGNAL (post-processing)
  // After individual classification, boost confidence for transactions with
  // vague CSV categories when other transactions from the exact same merchant
  // were classified with high confidence.
  // ==========================================================================

  // Step 1: Build merchant lookup - normalized merchant name → array of classifications
  const merchantLookup = {};
  for (const txn of transactions) {
    const normMerch = normalize(txn.merchant);
    if (!normMerch) continue;

    if (!merchantLookup[normMerch]) {
      merchantLookup[normMerch] = [];
    }

    const cls = classifications[txn.id];
    if (cls) {
      merchantLookup[normMerch].push({
        txnId: txn.id,
        subcategory: cls.subcategory,
        confidence: cls.confidence,
        monarchCategory: txn.monarchCategory
      });
    }
  }

  // Step 2: Loop through transactions and apply sibling boosts
  for (const txn of transactions) {
    const cls = classifications[txn.id];

    // Skip non-classified or skip transactions
    if (!cls || cls.subcategory === 'skip') continue;

    // Check if the CSV category is vague - if not vague, skip (CSV is authoritative)
    const csvCategory = (txn.monarchCategory || '').toLowerCase().trim();
    const isVagueCSV = !csvCategory || VAGUE_CSV_CATEGORIES.includes(csvCategory);
    if (!isVagueCSV) continue;

    // Look up siblings (same normalized merchant)
    const normMerch = normalize(txn.merchant);
    const allSiblings = merchantLookup[normMerch] || [];

    // Filter to qualifying siblings: not self, confidence >= 50
    const qualifyingSiblings = allSiblings.filter(s =>
      s.txnId !== txn.id && s.confidence >= 50
    );

    if (qualifyingSiblings.length === 0) continue;

    // Count agreeing siblings (same subcategory as current classification)
    const agreeingSiblings = qualifyingSiblings.filter(s =>
      s.subcategory === cls.subcategory
    );

    // Count disagreeing siblings (different subcategory, excluding 'other' and 'skip')
    const disagreeingSiblings = qualifyingSiblings.filter(s =>
      s.subcategory !== cls.subcategory &&
      s.subcategory !== 'other' &&
      s.subcategory !== 'skip'
    );

    if (agreeingSiblings.length > 0) {
      // Apply sibling boost, capped at SIBLING_MAX
      const rawBoost = agreeingSiblings.length * CONFIDENCE_ADJUSTMENTS.SIBLING;
      const siblingBoost = Math.min(rawBoost, CONFIDENCE_ADJUSTMENTS.SIBLING_MAX);

      cls.confidence = Math.min(100, cls.confidence + siblingBoost);
      cls.reason += `; Sibling signal: ${agreeingSiblings.length} similar txns (+${siblingBoost})`;
    } else if (disagreeingSiblings.length > 0) {
      // Siblings exist but disagree - note the conflict but don't change classification
      // Find the most common disagreeing subcategory
      const subcategoryCounts = {};
      for (const s of disagreeingSiblings) {
        subcategoryCounts[s.subcategory] = (subcategoryCounts[s.subcategory] || 0) + 1;
      }
      const topDisagreeing = Object.entries(subcategoryCounts)
        .sort((a, b) => b[1] - a[1])[0];

      cls.reason += `; Sibling conflict: ${disagreeingSiblings.length} txns suggest ${topDisagreeing[0]}`;
    }
  }

  // Save cache
  safeLocalStorageSet('ccTracker_merchantCache', state.merchantCache);
  
  // Process each transaction (skip bank accounts and "skip" cards)
  const processed = transactions
    .filter(txn => {
      // Filter out bank accounts
      const acctLower = (txn.account || '').toLowerCase();
      if (SKIP_ACCOUNTS.some(skip => acctLower.includes(skip))) return false;
      // Filter out skipped cards
      if (state.cardMappings[txn.last4] === 'skip') return false;
      // Filter out transactions classified as 'skip' (transfers, payments, income)
      const cls = classifications[txn.id];
      if (cls && cls.subcategory === 'skip') return false;
      return true;
    })
    .map(txn => {
    const cls = classifications[txn.id] || { subcategory: 'other', source: 'fallback', confidence: 0 };
    const cardId = state.cardMappings[txn.last4];
    const card = CARDS[cardId];
    const isCredit = txn.amount > 0;

    // Detect if this is a payment or statement balance line (not a refund or statement credit)
    const upperMerchant = (txn.merchant + ' ' + txn.original).toUpperCase();

    // First, check if this looks like a statement credit (should NOT be treated as payment)
    const looksLikeStatementCredit = isCredit && (
      (upperMerchant.includes('CREDIT') && !upperMerchant.includes('CREDIT CARD')) ||
      upperMerchant.includes('REWARD') ||
      upperMerchant.includes('REDEEM') ||
      upperMerchant.includes('CASHBACK') ||
      upperMerchant.includes('CASH BACK')
    );

    const isPayment = isCredit && !looksLikeStatementCredit && (
      upperMerchant.includes('AUTOMATIC PAYMENT') ||
      upperMerchant.includes('PAYMENT - THANK') ||
      upperMerchant.includes('ONLINE PAYMENT') ||
      upperMerchant.includes('AUTOPAY') ||
      upperMerchant.includes('LAST STATEMENT BAL') ||
      upperMerchant.includes('STATEMENT BALANCE') ||
      upperMerchant.includes('PREVIOUS BALANCE') ||
      txn.monarchCategory?.toLowerCase().includes('credit card payment')
    );
    
    // Map the subcategory to a card-effective category via hierarchy
    // BUT: If source is 'rule', user explicitly chose this category - don't remap
    const cardCategory = (cls.source === 'rule' || !card) ? cls.subcategory : mapToCardCategory(cls.subcategory, cardId, txn.date);
    
    let multiplier = { rate: 1, reason: 'Card not mapped' };
    let creditMatch = null;
    let isRefund = false;
    
    if (card) {
      // Build merchant description for PayPal wrapper detection
      const merchantDesc = (txn.merchant || '') + ' ' + (txn.original || '');

      if (isPayment) {
        // Payments: don't count, gray styling
        multiplier = { rate: 0, reason: 'Payment' };
      } else if (isCredit) {
        creditMatch = detectCredit(txn.merchant, txn.original, cardId, txn.id, txn.date);
        if (creditMatch) {
          // Credit was identified — update confidence and reason
          const creditName = creditMatch.name;

          if (creditName === 'Statement Credit') {
            // Generic fallback - we know it's a credit but not which specific one
            cls.confidence = 50;
            cls.reason = 'Statement credit (unmatched — assign manually)';
          } else if (creditMatch.disabled) {
            // Specific credit matched but is disabled - still high confidence
            cls.confidence = 100;
            cls.reason = `Credit: ${creditName} (disabled in config)`;
          } else {
            // Specific credit matched and enabled
            cls.confidence = 100;
            cls.reason = `Credit: ${creditName}`;
          }

          if (creditMatch.disabled) {
            // Disabled credit - treat as refund (don't count toward credit tracking)
            isRefund = true;
            const categoryMult = getMultiplier(cardId, cardCategory, txn.date, merchantDesc);
            multiplier = { rate: categoryMult.rate, reason: `Credit: ${creditName} (disabled) -${categoryMult.rate}x` };
          } else {
            // Active credit - calculate points to subtract
            const categoryMult = getMultiplier(cardId, cardCategory, txn.date, merchantDesc);
            multiplier = { rate: categoryMult.rate, reason: `Credit: ${creditName} (-${categoryMult.rate}x)` };
          }
        } else {
          // This is a refund - apply same multiplier as a charge would get, but negative
          isRefund = true;
          multiplier = getMultiplier(cardId, cardCategory, txn.date, merchantDesc);
          multiplier.reason = `Refund: -${multiplier.rate}x ${cardCategory}`;
        }
      } else {
        multiplier = getMultiplier(cardId, cardCategory, txn.date, merchantDesc);
      }
    }
    
    // Calculate points
    let points = 0;
    if (isPayment) {
      points = 0; // Payments don't affect points
    } else if (isRefund || (isCredit && creditMatch)) {
      // Both refunds AND credits subtract points
      points = -Math.abs(txn.amount) * multiplier.rate;
    } else if (!isCredit) {
      points = Math.abs(txn.amount) * multiplier.rate; // Normal charge
    }
    
    const pointsValue = points * getPointValue(cardId);
    
    // For creditMatch: store just the name (string) for backward compatibility
    // Only store for active credits (not disabled ones) so credit tracking works correctly
    const creditMatchName = creditMatch && !creditMatch.disabled ? creditMatch.name : null;

    return {
      ...txn,
      cardId,
      cardName: card?.shortName || 'Unknown',
      subcategory: cls.subcategory,  // Original classification before hierarchy rollup
      category: cardCategory,         // After hierarchy rollup for this card
      categorySource: cls.source,
      confidence: cls.confidence || 0,
      classificationReason: cls.reason || '',  // Why it was classified this way
      multiplier: multiplier.rate,
      reason: multiplier.reason,
      points,
      pointsValue,
      isCredit,
      isPayment,
      isRefund,
      creditMatch: creditMatchName
    };
  });
  
  // Calculate summary
  const byCard = {};
  for (const txn of processed) {
    const cid = txn.cardId || 'unknown';
    if (!byCard[cid]) {
      const card = CARDS[cid] || {};
      byCard[cid] = {
        cardId: cid,
        cardName: card.shortName || 'Unknown',
        annualFee: 0, // Will be calculated after processing all transactions
        spend: 0, points: 0, pointsValue: 0, credits: 0, count: 0
      };
    }
    if (txn.isCredit && txn.creditMatch) byCard[cid].credits += Math.abs(txn.amount);
    else {
      byCard[cid].spend += Math.abs(txn.amount);
      byCard[cid].points += txn.points;
      byCard[cid].pointsValue += txn.pointsValue;
    }
    byCard[cid].count++;
  }

  // Calculate annual fees after processing all transactions (for date-aware fees like CSR)
  for (const cid of Object.keys(byCard)) {
    byCard[cid].annualFee = getEffectiveAnnualFee(cid, processed);
  }

  const cards = Object.values(byCard).map(c => ({
    ...c,
    netValue: c.pointsValue + c.credits - c.annualFee,
    effectiveRate: c.spend > 0 ? ((c.pointsValue + c.credits - c.annualFee) / c.spend * 100) : 0
  }));
  
  const totals = {
    spend: cards.reduce((s, c) => s + c.spend, 0),
    points: cards.reduce((s, c) => s + c.points, 0),
    pointsValue: cards.reduce((s, c) => s + c.pointsValue, 0),
    credits: cards.reduce((s, c) => s + c.credits, 0),
    fees: cards.reduce((s, c) => s + c.annualFee, 0),
    netValue: cards.reduce((s, c) => s + c.netValue, 0)
  };
  
  return { processed, cards, totals };
}

// =============================================================================
// UI RENDERING
// =============================================================================
function showLoading(show, status = '') {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
  if (status) document.getElementById('loadingStatus').textContent = status;
}

function showMapping(allLast4s) {
  document.getElementById('uploadSection').classList.add('hidden');
  document.getElementById('mappingSection').classList.remove('hidden');
  document.getElementById('resultsSection').classList.add('hidden');
  
  // Filter out bank accounts
  const creditCardLast4s = allLast4s.filter(last4 => {
    const txn = state.transactions.find(t => t.last4 === last4);
    if (!txn) return true;
    const acctLower = (txn.account || '').toLowerCase();
    return !SKIP_ACCOUNTS.some(skip => acctLower.includes(skip));
  });
  
  const container = document.getElementById('mappingRows');
  container.innerHTML = creditCardLast4s.map(last4 => {
    const txn = state.transactions.find(t => t.last4 === last4);
    // Prefer accountName if available, otherwise fall back to parsing account field
    const displayName = txn?.accountName || (txn ? txn.account.split('(')[0].trim() : '');
    return `
    <div class="card-mapping-row">
      <span class="card-last4">•••• ${escapeHtml(last4)}</span>
      <span style="font-size:12px;color:#57534e;min-width:180px;font-weight:500;">${escapeHtml(displayName)}</span>
      <select class="form-select" data-last4="${escapeHtml(last4)}" style="flex:1;max-width:300px;">
        <option value="">Select card...</option>
        ${Object.entries(CARDS)
          .sort(([,a], [,b]) => a.name.localeCompare(b.name))
          .map(([id, c]) =>
          `<option value="${escapeHtml(id)}" ${state.cardMappings[last4] === id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
        ).join('')}
      </select>
      ${state.cardMappings[last4] ? '<span class="badge badge-green">Mapped</span>' : '<span class="badge badge-yellow">Needs mapping</span>'}
    </div>
  `}).join('');
  
  container.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', e => {
      const l4 = e.target.dataset.last4;
      if (e.target.value) state.cardMappings[l4] = e.target.value;
      else delete state.cardMappings[l4];
      safeLocalStorageSet('ccTracker_cardMappings', state.cardMappings);
      showMapping(allLast4s);
    });
  });
  
  const unmapped = creditCardLast4s.filter(l4 => !state.cardMappings[l4]);
  document.getElementById('processBtn').disabled = unmapped.length > 0;
  document.getElementById('mappingError').textContent = unmapped.length > 0 ? `${unmapped.length} card(s) need mapping` : '';
}

function showCardConfigEditor(preselectedCardId = null) {
  document.getElementById('resultsSection').classList.add('hidden');
  document.getElementById('cardConfigSection').classList.remove('hidden');
  
  // Get cards that are actually in use, sorted alphabetically
  const usedCardIds = [...new Set(state.results?.processed.map(t => t.cardId).filter(id => id && id !== 'skip') || [])]
    .sort((a, b) => (CARDS[a]?.name || a).localeCompare(CARDS[b]?.name || b));
  
  const select = document.getElementById('configCardSelect');
  select.innerHTML = usedCardIds.map(cardId => {
    const card = CARDS[cardId];
    const selected = preselectedCardId === cardId ? 'selected' : '';
    return `<option value="${escapeHtml(cardId)}" ${selected}>${escapeHtml(card?.name || cardId)}</option>`;
  }).join('');
  
  // If preselectedCardId provided, make sure it's selected
  if (preselectedCardId && usedCardIds.includes(preselectedCardId)) {
    select.value = preselectedCardId;
  }

  // Helper: Get all last-4s mapped to a given cardId
  function getAllMappingsForCard(cardId) {
    const mappings = [];
    for (const [last4, mappedCardId] of Object.entries(state.cardMappings)) {
      if (mappedCardId === cardId) {
        mappings.push(last4);
      }
    }
    return mappings;
  }

  // Helper: Calculate points per last-4 from processed transactions
  function getPointsPerLast4(cardId) {
    const last4List = getAllMappingsForCard(cardId);
    const pointsByLast4 = {};

    // Initialize with 0 points
    for (const last4 of last4List) {
      pointsByLast4[last4] = 0;
    }

    // Sum points from processed transactions
    if (state.results?.processed) {
      for (const txn of state.results.processed) {
        if (txn.cardId === cardId && txn.last4 && pointsByLast4.hasOwnProperty(txn.last4)) {
          pointsByLast4[txn.last4] += txn.points || 0;
        }
      }
    }

    return pointsByLast4;
  }

  // Update the card mapping tooltip
  function updateCardMappingTooltip() {
    const cardId = select.value;
    const infoIcon = document.getElementById('cardMappingInfo');
    if (!infoIcon) return;

    const pointsByLast4 = getPointsPerLast4(cardId);
    const entries = Object.entries(pointsByLast4);

    if (entries.length === 0) {
      infoIcon.style.display = 'none';
      return;
    }

    // Build tooltip text
    const label = entries.length === 1 ? 'Card Number:' : 'Card Numbers:';
    const lines = entries.map(([last4, points]) => {
      const formattedPoints = Math.round(points).toLocaleString();
      return `...${last4} (${formattedPoints} pts)`;
    });

    infoIcon.setAttribute('data-tooltip', label + '\n' + lines.join('\n'));
    infoIcon.style.display = 'inline-flex';
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const CASH_PLUS_5_LABELS = {
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
  
  const CASH_PLUS_2_LABELS = {
    'gas': 'Gas Stations',
    'grocery': 'Grocery Stores',
    'dining': 'Restaurants'
  };
  
  // CFF quarterly 5% categories (historical list from past 5 years) - ALPHABETIZED
  const CFF_5_LABELS = {
    'amazon': 'Amazon.com',
    'car-rental': 'Car Rentals',
    'charity': 'Charity',
    'chase-travel': 'Chase Travel',
    'dining': 'Restaurants',
    'ebay': 'eBay',
    'ev-charging': 'EV Charging',
    'fitness': 'Gyms & Fitness',
    'gas': 'Gas Stations',
    'grocery': 'Grocery Stores',
    'home-improvement': 'Home Improvement',
    'hotels-direct': 'Hotels',
    'internet-cable-phone': 'Internet/Cable/Phone',
    'live-entertainment': 'Live Entertainment',
    'lowes': 'Lowe\'s',
    'mcdonalds': 'McDonald\'s',
    'movies': 'Movie Theaters',
    'paypal': 'PayPal',
    'pet': 'Pet Stores',
    'spa-self-care': 'Spa & Self Care',
    'streaming': 'Streaming Services',
    'target': 'Target',
    'walmart': 'Walmart',
    'whole-foods': 'Whole Foods',
    'wholesale-club': 'Wholesale Clubs'
  };
  
  // Quarter definitions with date bounds
  const QUARTERS = [
    { id: 'Q1', name: 'Q1 (Jan-Mar)', months: [0, 1, 2] },
    { id: 'Q2', name: 'Q2 (Apr-Jun)', months: [3, 4, 5] },
    { id: 'Q3', name: 'Q3 (Jul-Sep)', months: [6, 7, 8] },
    { id: 'Q4', name: 'Q4 (Oct-Dec)', months: [9, 10, 11] }
  ];
  
  function renderCardConfig() {
    const cardId = select.value;
    const card = CARDS[cardId];
    if (!card) return;

    // Editability gating
    const cardEditable = isCardEditable(cardId, 'config');
    const creditsEditable = isCardEditable(cardId, 'credits');
    const isCashPlus = cardId === 'us-bank-cash-plus';
    const isCFF = cardId === 'chase-freedom-flex';
    // Cash+ quarterly categories always editable; Bilt config always editable (except credits)
    const cashPlusEditable = isCashPlus || cardEditable;
    const biltEditable = (card.isBilt) || cardEditable;

    // Update save button and show locked notice
    const saveBtn = document.getElementById('saveCardConfig');
    if (!cardEditable && !cashPlusEditable && !biltEditable) {
      saveBtn.disabled = true;
      saveBtn.title = 'Unlock editing with Decision Pass or Pro';
    } else {
      saveBtn.disabled = false;
      saveBtn.title = '';
    }


    const currentPointValue = getPointValue(cardId) * 100;
    const defaultPointValue = card.pointValue * 100;
    const disabled = state.disabledCredits[cardId] || [];
    
    // Get available years from transactions
    const txnYears = [...new Set(state.transactions.map(t => getYearFromDateString(t.date)))].sort().reverse();
    const currentYear = new Date().getFullYear();
    const availableYears = txnYears.length > 0 ? txnYears : [currentYear];

    // Cash+ quarterly section - WITH YEAR SELECTOR
    let cashPlusSection = '';
    if (isCashPlus) {
      const selectedCashPlusYear = state.selectedCashPlusYear || availableYears[0];
      
      cashPlusSection = `
        <div id="quarterlySection">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h3 style="font-size:14px;font-weight:600;">Quarterly Category Selection</h3>
            <select id="cashPlusYearSelect" class="form-select" style="min-width:100px;padding:6px 10px;">
              ${availableYears.map(y => `<option value="${y}" ${y === selectedCashPlusYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <p style="font-size:12px;color:#78716c;margin-bottom:4px;">Select the bonus categories you activated with U.S. Bank for each quarter.</p>
          <p style="font-size:11px;color:#a8a29e;margin-bottom:12px;">This affects how points are calculated for transactions in that period. $2,000 cap on 5% categories per quarter.</p>
          
          <div id="cashPlusQuarters">
          ${QUARTERS.map(q => {
            const yearQuarterKey = `${selectedCashPlusYear}-${q.id}`;
            const quarterSelections = state.cashPlusCategories[yearQuarterKey] || state.cashPlusCategories[q.id] || { fivePercent: [], twoPercent: '' };
            const isCurrentQuarter = selectedCashPlusYear === currentYear && getCurrentQuarter() === q.id;
            
            return `
            <details style="margin-bottom:12px;border:1px solid #e7e5e4;border-radius:8px;${isCurrentQuarter ? 'border-color:#059669;' : ''}" ${isCurrentQuarter ? 'open' : ''}>
              <summary style="padding:12px;cursor:pointer;font-weight:500;font-size:13px;background:${isCurrentQuarter ? '#dcfce7' : '#fafaf9'};border-radius:7px;list-style:none;display:flex;justify-content:space-between;align-items:center;">
                <span>${q.name} ${isCurrentQuarter ? '(Current)' : ''}</span>
                <span style="font-size:11px;color:#78716c;">
                  ${quarterSelections.fivePercent?.length || 0}/2 categories selected
                </span>
              </summary>
              <div style="padding:12px;">
                <div style="margin-bottom:12px;">
                  <div style="font-size:12px;font-weight:500;margin-bottom:6px;">5% Categories (select up to 2):</div>
                  <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:6px;">
                    ${Object.entries(CASH_PLUS_5_LABELS).map(([key, label]) => `
                      <label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid #e7e5e4;border-radius:4px;cursor:pointer;font-size:11px;${quarterSelections.fivePercent?.includes(key) ? 'background:#dcfce7;border-color:#059669;' : ''}">
                        <input type="checkbox" class="cash-plus-5" data-year="${selectedCashPlusYear}" data-quarter="${q.id}" data-category="${key}" ${quarterSelections.fivePercent?.includes(key) ? 'checked' : ''}>
                        ${label}
                      </label>
                    `).join('')}
                  </div>
                </div>
                <div>
                  <div style="font-size:12px;font-weight:500;margin-bottom:6px;">2% Category (select 1):</div>
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;">
                    ${Object.entries(CASH_PLUS_2_LABELS).map(([key, label]) => `
                      <label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid #e7e5e4;border-radius:4px;cursor:pointer;font-size:11px;${quarterSelections.twoPercent === key ? 'background:#fef9c3;border-color:#eab308;' : ''}">
                        <input type="radio" name="cashPlus2-${q.id}" class="cash-plus-2" data-year="${selectedCashPlusYear}" data-quarter="${q.id}" data-category="${key}" ${quarterSelections.twoPercent === key ? 'checked' : ''}>
                        ${label}
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>
            </details>
          `}).join('')}
          </div>
        </div>
      `;
    }
    
    // CFF quarterly 5% section - read-only display from stored historical data
    let cffSection = '';
    if (isCFF) {
      const CFF_DATA = window.CardTracker.cffQuarterlyData || {};
      const storedYears = [...new Set(Object.keys(CFF_DATA).map(k => parseInt(k.split('-')[0])))].sort((a,b) => b-a);
      const allCFFYears = [...new Set([...availableYears, ...storedYears])].sort((a,b) => b-a);
      const selectedCFFYear = state.selectedCFFYear || allCFFYears[0];

      // All possible CFF category labels for greyed-out display
      const ALL_CFF_LABELS = {
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

      cffSection = `
        <div id="quarterlySection">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h3 style="font-size:14px;font-weight:600;">Quarterly Bonus Categories</h3>
            <select id="cffYearSelect" class="form-select" style="min-width:100px;padding:6px 10px;">
              ${allCFFYears.map(y => `<option value="${y}" ${y === selectedCFFYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <p style="font-size:12px;color:#78716c;margin-bottom:4px;">Chase Freedom Flex rotating bonus categories are automatically applied based on quarter.</p>
          <p style="font-size:11px;color:#a8a29e;margin-bottom:12px;">$1,500 cap per quarter. Card also earns 5x Chase Travel, 3x dining/drugstores.</p>

          <div id="cffQuarters">
          ${QUARTERS.map(q => {
            const yearQuarterKey = `${selectedCFFYear}-${q.id}`;
            const entries = CFF_DATA[yearQuarterKey] || [];
            const isCurrentQuarter = selectedCFFYear === currentYear && getCurrentQuarter() === q.id;
            const activeKeys = entries.map(e => e.key);

            return `
            <details style="margin-bottom:12px;border:1px solid #e7e5e4;border-radius:8px;${isCurrentQuarter ? 'border-color:#059669;' : ''}" ${isCurrentQuarter ? 'open' : ''}>
              <summary style="padding:12px;cursor:pointer;font-weight:500;font-size:13px;background:${isCurrentQuarter ? '#dcfce7' : '#fafaf9'};border-radius:7px;list-style:none;display:flex;justify-content:space-between;align-items:center;">
                <span>${q.name} ${isCurrentQuarter ? '(Current)' : ''}</span>
                <span style="font-size:11px;color:#78716c;">
                  ${entries.length > 0 ? entries.length + ' bonus categor' + (entries.length === 1 ? 'y' : 'ies') : 'No data'}
                </span>
              </summary>
              <div style="padding:12px;">
                ${entries.length > 0 ? `
                <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;">
                  ${Object.entries(ALL_CFF_LABELS).map(([key, genericLabel]) => {
                    const entry = entries.find(e => e.key === key);
                    const isActive = !!entry;
                    const displayLabel = entry ? entry.label : genericLabel;
                    const monthName = entry && entry.monthOnly ? new Date(2000, entry.monthOnly - 1).toLocaleString('en', {month: 'short'}) : '';
                    const rateLabel = entry ? entry.rate + '%' : '';
                    return `
                    <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid ${isActive ? '#059669' : '#f0eeec'};border-radius:4px;font-size:11px;${isActive ? 'background:#dcfce7;font-weight:600;color:#1a1a1a;' : 'background:#fafaf9;color:#c4c0bc;'}">
                      ${isActive ? '<span style="color:#059669;flex-shrink:0;">&#10003;</span>' : '<span style="flex-shrink:0;visibility:hidden;">&#10003;</span>'}
                      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(displayLabel)}${monthName ? ' (' + monthName + ' only)' : ''}">${escapeHtml(displayLabel)}</span>
                      ${isActive ? '<span style="margin-left:auto;font-size:10px;color:#059669;flex-shrink:0;white-space:nowrap;">' + rateLabel + (monthName ? ' <span style="font-size:9px;color:#78716c;">(' + monthName + ')</span>' : '') + '</span>' : ''}
                    </div>`;
                  }).join('')}
                </div>
                ` : '<div style="font-size:12px;color:#a8a29e;font-style:italic;">No quarterly category data available for this period.</div>'}
              </div>
            </details>
          `}).join('')}
          </div>
        </div>
      `;
    }
    
    // Bilt 2.0 configuration section
    let biltSection = '';
    if (card.isBilt) {
      const cfg = state.biltConfig[cardId] || { 
        rewardOption: 'flexible', 
        rentDetection: 'auto', 
        manualRentAmount: 2000, 
        manualRentDay: 1,
        rentMerchantKeyword: '',
        bonusCategory: 'dining',
        countBiltCashAsCredit: true
      };
      const isFlexible = cfg.rewardOption !== 'housing-only';
      const isManualRent = cfg.rentDetection === 'manual';
      
      // Get available years from processed transactions (raw transactions lack cardId)
      const processedTxns = state.results?.processed || [];
      const biltYears = [...new Set(processedTxns
        .filter(t => t.cardId && t.cardId.startsWith('bilt-'))
        .map(t => getYearFromDateString(t.date))
      )].sort().reverse();
      const currentYear = new Date().getFullYear();
      const availableBiltYears = biltYears.length > 0 ? biltYears : [currentYear];
      const selectedBiltYear = state.selectedBiltYear || 'all';

      // Calculate Bilt Cash earned (4% of non-rent Bilt card spend for selected year, post-Feb 7 2026)
      const bilt20Date = new Date(2026, 1, 7);
      const biltNonRentSpend = processedTxns
        .filter(t => {
          if (!t.cardId || !t.cardId.startsWith('bilt-')) return false;
          const d = new Date(t.date);
          if (d < bilt20Date) return false; // Only Bilt 2.0 earns Bilt Cash
          if (selectedBiltYear !== 'all' && getYearFromDateString(t.date) !== parseInt(selectedBiltYear)) return false;
          return t.category !== 'rent' && t.amount < 0; // Purchases only
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Also calculate refunds to subtract (positive amounts on Bilt cards)
      const biltRefunds = processedTxns
        .filter(t => {
          if (!t.cardId || !t.cardId.startsWith('bilt-')) return false;
          const d = new Date(t.date);
          if (d < bilt20Date) return false;
          if (selectedBiltYear !== 'all' && getYearFromDateString(t.date) !== parseInt(selectedBiltYear)) return false;
          return t.category !== 'rent' && t.amount > 0; // Refunds
        })
        .reduce((sum, t) => sum + t.amount, 0);
      
      const netBiltSpend = Math.max(0, biltNonRentSpend - biltRefunds);
      const biltCashEarned = netBiltSpend * 0.04; // 4% Bilt Cash
      
      // Calculate rent amount for helper text
      const rent = cfg.manualRentAmount || 2000;
      const monthlyBiltCashRedemption = cfg.monthlyBiltCashRedemption || 0;
      const cashFor100 = (rent / 100) * 3; // $3 per 100 pts on $100 rent
      const cashFor75 = cashFor100 * 0.75;
      const cashFor50 = cashFor100 * 0.50;
      const cashFor25 = cashFor100 * 0.25;
      
      biltSection = `
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:14px;font-weight:600;margin:0;">🏠 Bilt Rewards Configuration</h3>
            <select id="biltYearSelect" class="form-select" style="min-width:100px;padding:6px 10px;font-size:12px;">
              <option value="all" ${selectedBiltYear === 'all' ? 'selected' : ''}>All Years</option>
              ${availableBiltYears.map(y => `<option value="${y}" ${selectedBiltYear === y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <p style="font-size:11px;color:#78716c;margin-bottom:12px;">Bilt 2.0 began February 7, 2026. Transactions before this date use legacy earning rates.</p>
          
          <!-- Bilt Cash Earned (auto-calculated) -->
          <div style="margin-bottom:16px;padding:12px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:600;">💰 Bilt Cash Earned (${selectedBiltYear === 'all' ? 'All Time' : selectedBiltYear})</span>
              <span style="font-size:18px;font-weight:700;color:#166534;">$${biltCashEarned.toFixed(2)}</span>
            </div>
            <p style="font-size:10px;color:#78716c;margin-bottom:8px;">4% of $${netBiltSpend.toFixed(2)} non-rent Bilt card spend (post-Feb 7, 2026)</p>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;">
              <input type="checkbox" class="bilt-cash-as-credit" data-card="${cardId}" ${cfg.countBiltCashAsCredit !== false ? 'checked' : ''}>
              <span>Count Bilt Cash as statement credit</span>
            </label>
          </div>
          
          <!-- Reward Option -->
          <div style="margin-bottom:16px;padding:12px;border:1px solid #e7e5e4;border-radius:8px;">
            <label style="display:block;font-size:12px;font-weight:500;margin-bottom:8px;">Which reward option do you use? (for rent points)</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:8px;border-radius:6px;border:1px solid ${isFlexible ? '#d4d4d4' : 'transparent'};">
                <input type="radio" name="biltRewardOption-${cardId}" value="flexible" ${isFlexible ? 'checked' : ''} class="bilt-reward-option" data-card="${cardId}" style="margin-top:2px;">
                <div>
                  <span style="font-size:12px;font-weight:500;">Flexible Bilt Cash</span>
                  <p style="font-size:10px;color:#78716c;margin:2px 0 0 0;">Redeem Bilt Cash for up to 1x rent points</p>
                </div>
              </label>
              <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:8px;border-radius:6px;border:1px solid ${!isFlexible ? '#d4d4d4' : 'transparent'};">
                <input type="radio" name="biltRewardOption-${cardId}" value="housing-only" ${!isFlexible ? 'checked' : ''} class="bilt-reward-option" data-card="${cardId}" style="margin-top:2px;">
                <div>
                  <span style="font-size:12px;font-weight:500;">Housing-only Rewards</span>
                  <p style="font-size:10px;color:#78716c;margin:2px 0 0 0;">Earn rent points automatically based on spending ratio</p>
                </div>
              </label>
            </div>
          </div>
          
          <!-- Flexible Bilt Cash Section -->
          <div id="biltFlexibleSection-${cardId}" style="${isFlexible ? '' : 'display:none;'}margin-bottom:16px;padding:12px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label style="font-size:12px;font-weight:500;">How much Bilt Cash do you redeem monthly for rent?</label>
              <a href="#" class="bilt-calc-helper" data-card="${cardId}" style="font-size:11px;color:#2563eb;text-decoration:none;">How much do I need?</a>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:14px;">$</span>
              <input type="number" class="bilt-monthly-redemption form-input" data-card="${cardId}" value="${monthlyBiltCashRedemption}" style="width:100px;padding:6px;">
              <span style="font-size:11px;color:#78716c;">/ month</span>
            </div>
          </div>
          
          <!-- Bilt Cash Calculator Modal (hidden by default) -->
          <div id="biltCalcModal-${cardId}" style="display:none;margin-bottom:16px;padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:600;">🧮 Bilt Cash Calculator</span>
              <button class="bilt-calc-close" data-card="${cardId}" style="background:none;border:none;cursor:pointer;font-size:16px;color:#78716c;">×</button>
            </div>
            <div style="margin-bottom:8px;">
              <label style="font-size:11px;display:block;margin-bottom:4px;">What is your monthly rent?</label>
              <div style="display:flex;align-items:center;gap:4px;">
                <span>$</span>
                <input type="number" class="bilt-calc-rent form-input" data-card="${cardId}" value="${rent}" style="width:120px;padding:4px;">
              </div>
            </div>
            <div style="font-size:11px;color:#1e40af;background:#eff6ff;padding:8px;border-radius:4px;">
              <div style="font-weight:600;margin-bottom:4px;">Bilt Cash needed for rent points:</div>
              <div class="bilt-calc-results" data-card="${cardId}">
                <div>100% (1x): $<span class="calc-100">${cashFor100.toFixed(2)}</span>/mo</div>
                <div>75%: $<span class="calc-75">${cashFor75.toFixed(2)}</span>/mo</div>
                <div>50%: $<span class="calc-50">${cashFor50.toFixed(2)}</span>/mo</div>
                <div>25%: $<span class="calc-25">${cashFor25.toFixed(2)}</span>/mo</div>
              </div>
              <p style="margin-top:6px;font-size:10px;color:#3b82f6;">Formula: $3 Bilt Cash = 100 points on $100 rent</p>
            </div>
          </div>
          
          <!-- Housing-only Section -->
          <div id="biltHousingSection-${cardId}" style="${!isFlexible ? '' : 'display:none;'}margin-bottom:16px;padding:12px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;">
            <p style="font-size:11px;color:#78716c;margin-bottom:8px;"><strong>Housing-only mode:</strong> Your rent points multiplier is calculated automatically based on your everyday spend ratio.</p>
            <div style="font-size:10px;color:#78716c;">
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">
                <span>25-49% spend → 0.5x</span>
                <span>50-74% spend → 0.75x</span>
                <span>75-99% spend → 1x</span>
                <span>100%+ spend → 1.25x</span>
              </div>
              <p style="margin-top:6px;">Below 25% = 250 points floor</p>
            </div>
          </div>
          
          <!-- Rent Detection -->
          <div style="margin-bottom:16px;padding:12px;border:1px solid #e7e5e4;border-radius:8px;">
            <label style="display:block;font-size:12px;font-weight:500;margin-bottom:8px;">How should we detect rent payments?</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="radio" name="biltRentDetection-${cardId}" value="auto" ${!isManualRent ? 'checked' : ''} class="bilt-rent-detection" data-card="${cardId}">
                <span style="font-size:12px;">Auto-detect (uses rent/mortgage categories & common keywords)</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="radio" name="biltRentDetection-${cardId}" value="manual" ${isManualRent ? 'checked' : ''} class="bilt-rent-detection" data-card="${cardId}">
                <span style="font-size:12px;">Manual configuration</span>
              </label>
            </div>
            
            <div id="biltManualRent-${cardId}" style="${isManualRent ? '' : 'display:none;'}margin-top:12px;padding:10px;background:#f5f5f4;border-radius:6px;">
              <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:8px;">
                <div>
                  <label style="font-size:10px;display:block;margin-bottom:2px;">Monthly Amount:</label>
                  <div style="display:flex;align-items:center;gap:4px;">
                    <span>$</span>
                    <input type="number" class="bilt-manual-rent form-input" data-card="${cardId}" value="${cfg.manualRentAmount || 2000}" style="width:100px;padding:4px;">
                  </div>
                </div>
                <div>
                  <label style="font-size:10px;display:block;margin-bottom:2px;">Day of month:</label>
                  <select class="bilt-rent-day form-select" data-card="${cardId}" style="padding:4px;">
                    ${Array.from({length:28},(_,i)=>i+1).map(d => 
                      `<option value="${d}" ${parseInt(cfg.manualRentDay) === d ? 'selected' : ''}>${d}${d===1?'st':d===2?'nd':d===3?'rd':'th'}</option>`
                    ).join('')}
                  </select>
                </div>
              </div>
              <div>
                <label style="font-size:10px;display:block;margin-bottom:2px;">Merchant keyword (optional, e.g. "BILT" or your landlord name):</label>
                <input type="text" class="bilt-rent-keyword form-input" data-card="${cardId}" value="${escapeHtml(cfg.rentMerchantKeyword || '')}" placeholder="Leave blank to use amount+date" style="width:100%;padding:4px;font-size:11px;">
              </div>
            </div>
          </div>
          
          ${card.hasObsidianBonus ? `
          <!-- Obsidian Bonus Category -->
          <div style="margin-bottom:12px;padding:12px;border:1px solid #e7e5e4;border-radius:8px;">
            <label style="display:block;font-size:12px;font-weight:500;margin-bottom:8px;">Which category gets your 3x bonus? (annual choice)</label>
            <div style="display:flex;gap:16px;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="radio" name="biltBonus-${cardId}" value="dining" ${cfg.bonusCategory !== 'grocery' ? 'checked' : ''} class="bilt-bonus-cat" data-card="${cardId}">
                <span style="font-size:12px;">Dining</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="radio" name="biltBonus-${cardId}" value="grocery" ${cfg.bonusCategory === 'grocery' ? 'checked' : ''} class="bilt-bonus-cat" data-card="${cardId}">
                <span style="font-size:12px;">Grocery (up to $25k/yr)</span>
              </label>
            </div>
          </div>
          ` : ''}
        </div>
      `;
    }
    
    // Build credits section with monthly claiming for manual credits - NOW YEAR-SPECIFIC
    let creditsSection = '';

    // Helper function to render a single credit row
    const renderCreditRow = (cr, selectedCreditYear) => {
      const isDisabled = disabled.includes(cr.name);
      const isManual = cr.manual === true;
      const monthlyAmount = cr.amount / 12;
      // Year-specific claimed months
      const yearCredits = state.monthlyCredits?.[cardId]?.[cr.name];
      const claimedMonths = (typeof yearCredits === 'object' && !Array.isArray(yearCredits))
        ? (yearCredits[selectedCreditYear] || [])
        : (Array.isArray(yearCredits) ? yearCredits : []); // Legacy support
      const totalClaimed = isManual ? claimedMonths.length * monthlyAmount : 0;

      let monthsHtml = '';
      if (isManual && !isDisabled) {
        monthsHtml = MONTHS.map((month, idx) => `
          <label style="display:flex;align-items:center;justify-content:center;width:42px;padding:6px 0;border:1px solid #e7e5e4;border-radius:4px;cursor:pointer;font-size:11px;background:${claimedMonths.includes(idx) ? '#dcfce7' : '#fff'};" title="Click to mark ${month} as claimed">
            <input type="checkbox" class="month-claim" data-credit="${escapeHtml(cr.name)}" data-month="${idx}" ${claimedMonths.includes(idx) ? 'checked' : ''} style="display:none;">
            ${month}
          </label>
        `).join('');
      }

      return `
        <div class="${isManual && !isDisabled ? 'manual-credit-row' : ''}" style="padding:12px;background:${isDisabled ? '#fafaf9' : '#fff'};border:1px solid #e7e5e4;border-radius:8px;${isDisabled ? 'opacity:0.5;' : ''}">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:${isManual && !isDisabled ? '12px' : '0'};">
            <input type="checkbox" class="credit-toggle-checkbox" data-credit-name="${escapeHtml(cr.name)}" ${!isDisabled ? 'checked' : ''} title="Include this credit in ROI calculation">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:500;${isDisabled ? 'text-decoration:line-through;' : ''}">${escapeHtml(cr.name)}${isManual ? ' ⚡' : ''}</div>
              <div style="font-size:11px;color:#78716c;">$${cr.amount}/yr${isManual ? ` (~$${monthlyAmount.toFixed(0)}/mo)` : ' — Auto-detected from transactions'}</div>
            </div>
            ${isManual && !isDisabled ? `<span style="font-size:12px;color:#059669;font-weight:500;">$${totalClaimed.toFixed(0)} claimed</span>` : ''}
          </div>
          ${isManual && !isDisabled ? `
            <div style="display:flex;flex-wrap:wrap;gap:4px;padding-top:8px;border-top:1px solid #f5f5f4;">
              ${monthsHtml}
            </div>
          ` : ''}
        </div>
      `;
    };

    if (card.credits && card.credits.length > 0) {
      // Get available years from transactions
      const txnYears = [...new Set(state.transactions.map(t => getYearFromDateString(t.date)))].sort().reverse();
      const currentYear = new Date().getFullYear();
      const availableYears = txnYears.length > 0 ? txnYears : [currentYear];
      const selectedCreditYear = state.selectedCreditYear || availableYears[0];

      // Build credits grid HTML
      const creditsHtml = card.credits.map(cr => renderCreditRow(cr, selectedCreditYear)).join('');

      creditsSection = `
        <div id="configCreditsSection">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h3 style="font-size:14px;font-weight:600;">Statement Credits</h3>
            <select id="creditYearSelect" class="form-select" style="min-width:100px;padding:6px 10px;">
              ${availableYears.map(y => `<option value="${y}" ${y === selectedCreditYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <p style="font-size:12px;color:#78716c;margin-bottom:4px;">Toggle credits on/off to include/exclude from ROI calculation.</p>
          <p style="font-size:11px;color:#a8a29e;margin-bottom:12px;">⚡ = Credits your account automatically (like Uber Cash). Click months you've received to track them.</p>
          <div id="creditsGrid" style="display:grid;gap:12px;">
            ${creditsHtml}
          </div>
        </div>
      `;
    } else {
      creditsSection = '';
    }

    // COMING SOON: Banners hidden for free-only launch. Restore this block when paid plans go live.
    // Locked notice for non-editable cards (dismissable per card)
    const configBannerKey = 'config_' + cardId;
    const lockedNotice = '';
    /* COMING SOON: Uncomment to restore upgrade banners
    const configBannerDismissed = state.dpBannersDismissed[configBannerKey];
    const lockedNotice = configBannerDismissed ? '' : ((!cardEditable && !cashPlusEditable && !biltEditable) ? `
      <div class="dp-banner" data-banner-key="${configBannerKey}" style="position:relative;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;padding-right:32px;margin-bottom:16px;font-size:13px;color:#92400e;">
        Card configuration is read-only. Unlock editing with a <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Decision Pass</a> or <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Pro</a>.
        <button class="dp-banner-close" data-banner-key="${configBannerKey}" style="position:absolute;top:8px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;color:#92400e;opacity:0.6;line-height:1;" title="Dismiss">&times;</button>
      </div>
    ` : (!cardEditable ? `
      <div class="dp-banner" data-banner-key="${configBannerKey}" style="position:relative;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;padding-right:32px;margin-bottom:16px;font-size:12px;color:#057a55;">
        ${isCashPlus ? 'Quarterly categories are editable. Other settings require a <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Decision Pass</a> or <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Pro</a>.' : ''}
        ${card.isBilt ? 'Bilt configuration is editable. Point values and credits require a <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Decision Pass</a> or <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Pro</a>.' : ''}
        <button class="dp-banner-close" data-banner-key="${configBannerKey}" style="position:absolute;top:6px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;color:#057a55;opacity:0.6;line-height:1;" title="Dismiss">&times;</button>
      </div>
    ` : ''));
    */

    // Locked style for non-editable sections
    const lockedStyle = !cardEditable ? 'pointer-events:none;opacity:0.55;' : '';
    // Bilt config sections are always editable, credits are not (unless DP active)
    const biltLockedStyle = !biltEditable ? 'pointer-events:none;opacity:0.55;' : '';
    const creditsLockedStyle = !creditsEditable ? 'pointer-events:none;opacity:0.55;' : '';

    document.getElementById('cardConfigContent').innerHTML = `
      ${lockedNotice}
      <div style="display:grid;gap:24px;">
        <!-- Point Value -->
        <div style="${lockedStyle}">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Point Value</h3>
          <div class="card-mapping-row">
            <span style="min-width:120px;">Value per point:</span>
            <input type="number" step="0.1" min="0" max="10" value="${currentPointValue.toFixed(1)}"
                   id="configPointValue" class="form-select" style="width:100px;" ${!cardEditable ? 'disabled' : ''}>
            <span style="font-size:13px;color:#78716c;">¢</span>
            <span style="font-size:12px;color:#a8a29e;">(default: ${defaultPointValue.toFixed(1)}¢)</span>
          </div>
        </div>

        ${card.annualBonusPoints ? `
        <!-- Anniversary Bonus Points -->
        <div style="${lockedStyle}">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Anniversary Bonus Miles</h3>
          <p style="font-size:12px;color:#78716c;margin-bottom:8px;">Bonus miles awarded each cardholder anniversary (not a statement credit). Included in ROI calculation.</p>
          <div class="card-mapping-row">
            <span style="min-width:120px;">Bonus points:</span>
            <input type="number" step="1000" min="0" max="999999" value="${getAnnualBonusPoints(cardId)}"
                   id="configAnnualBonusPoints" class="form-select" style="width:120px;">
            <span style="font-size:12px;color:#a8a29e;">(default: ${formatNumber(card.annualBonusPoints)})</span>
          </div>
          <div style="font-size:12px;color:#059669;margin-top:4px;">
            Value: ${formatCurrencyPrecise(getAnnualBonusPoints(cardId) * getPointValue(cardId))} (${formatNumber(getAnnualBonusPoints(cardId))} pts × ${(getPointValue(cardId) * 100).toFixed(1)}¢)
          </div>
          <div style="font-size:11px;color:#78716c;margin-top:2px;">
            ${hasDetectedAnnualFee(cardId) ? '✓ Annual fee detected — bonus included in ROI' : 'Bonus is included in ROI only when an annual fee is detected in your transactions.'}
          </div>
        </div>
        ` : ''}

        <div style="${isCashPlus ? '' : lockedStyle}">${cashPlusSection}</div>
        ${cffSection}
        <div style="${card.isBilt ? '' : lockedStyle}">${biltSection}</div>

        <!-- Multipliers (read-only) -->
        <div>
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Earning Rates</h3>
          <div style="display:grid;gap:8px;">
            ${Object.keys(card.multipliers).length > 0 ? Object.entries(card.multipliers).map(([cat, rate]) => `
              <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f5f5f4;border-radius:6px;">
                <span style="font-size:13px;">${escapeHtml(cat)}</span>
                <span style="font-size:13px;font-weight:600;">${rate}x</span>
              </div>
            `).join('') : (isCashPlus ? '<div style="font-size:12px;color:#78716c;font-style:italic;">Based on quarterly selections above</div>' : '')}
            ${isCFF ? '<div style="font-size:12px;color:#78716c;font-style:italic;">+ quarterly bonus categories shown above</div>' : ''}
            <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#fafaf9;border-radius:6px;border:1px dashed #d6d3d1;">
              <span style="font-size:13px;color:#78716c;">Everything else</span>
              <span style="font-size:13px;font-weight:600;color:#78716c;">${card.baseRate}x</span>
            </div>
          </div>
        </div>
        
        <!-- Credits -->
        <!-- COMING SOON: Uncomment to restore Bilt credits upgrade banner
        ${(!creditsEditable && card.isBilt && creditsSection && !state.dpBannersDismissed['biltcredits_' + cardId]) ? `
        <div class="dp-banner" data-banner-key="biltcredits_${cardId}" style="position:relative;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;padding-right:32px;margin-bottom:8px;font-size:12px;color:#92400e;">
          Credits are read-only. Unlock with a <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Decision Pass</a> or <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Pro</a> to track monthly claims.
          <button class="dp-banner-close" data-banner-key="biltcredits_${cardId}" style="position:absolute;top:6px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;color:#92400e;opacity:0.6;line-height:1;" title="Dismiss">&times;</button>
        </div>
        ` : ''}
        -->
        <div style="${creditsLockedStyle}">${creditsSection}</div>
      </div>
    `;
    
    // Add event listeners for month claiming
    document.querySelectorAll('.month-claim').forEach(cb => {
      cb.addEventListener('change', () => {
        const label = cb.closest('label');
        label.style.background = cb.checked ? '#dcfce7' : '#fff';
      });
    });

    // CFF quarterly categories are now read-only from stored data (no event listeners needed)
    
    // Limit Cash+ 5% selections to 2 PER QUARTER
    if (isCashPlus) {
      document.querySelectorAll('.cash-plus-5').forEach(cb => {
        cb.addEventListener('change', () => {
          const quarter = cb.dataset.quarter;
          const checked = document.querySelectorAll(`.cash-plus-5[data-quarter="${quarter}"]:checked`);
          if (checked.length > 2) {
            cb.checked = false;
            alert('You can only select 2 categories for 5% cashback per quarter');
          }
          // Update visual
          cb.closest('label').style.background = cb.checked ? '#dcfce7' : '';
          cb.closest('label').style.borderColor = cb.checked ? '#059669' : '#e7e5e4';
        });
      });
      document.querySelectorAll('.cash-plus-2').forEach(cb => {
        cb.addEventListener('change', () => {
          const quarter = cb.dataset.quarter;
          document.querySelectorAll(`.cash-plus-2[data-quarter="${quarter}"]`).forEach(r => {
            r.closest('label').style.background = r.checked ? '#fef9c3' : '';
            r.closest('label').style.borderColor = r.checked ? '#eab308' : '#e7e5e4';
          });
        });
      });
    }
    
    // Credit year selector - re-render to update months display
    const creditYearSelect = document.getElementById('creditYearSelect');
    if (creditYearSelect) {
      creditYearSelect.addEventListener('change', (e) => {
        state.selectedCreditYear = parseInt(e.target.value);
        renderCardConfig(); // Re-render to show correct year's claimed months
      });
    }
    
    // Cash+ year selector
    const cashPlusYearSelect = document.getElementById('cashPlusYearSelect');
    if (cashPlusYearSelect) {
      cashPlusYearSelect.addEventListener('change', (e) => {
        state.selectedCashPlusYear = parseInt(e.target.value);
        renderCardConfig();
      });
    }
    
    // CFF year selector
    const cffYearSelect = document.getElementById('cffYearSelect');
    if (cffYearSelect) {
      cffYearSelect.addEventListener('change', (e) => {
        state.selectedCFFYear = parseInt(e.target.value);
        renderCardConfig();
      });
    }
    
    // Bilt 2.0 configuration handlers
    if (card.isBilt) {
      // Year dropdown
      const biltYearSelect = document.getElementById('biltYearSelect');
      if (biltYearSelect) {
        biltYearSelect.addEventListener('change', () => {
          state.selectedBiltYear = biltYearSelect.value === 'all' ? 'all' : parseInt(biltYearSelect.value);
          renderCardConfig();
        });
      }
      // Calculator helper link
      document.querySelectorAll('.bilt-calc-helper').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const cid = link.dataset.card;
          document.getElementById(`biltCalcModal-${cid}`).style.display = '';
        });
      });
      // Calculator close button
      document.querySelectorAll('.bilt-calc-close').forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.card;
          document.getElementById(`biltCalcModal-${cid}`).style.display = 'none';
        });
      });
      // Calculator rent input - recalculate on change (debounced for storage, immediate for UI)
      document.querySelectorAll('.bilt-calc-rent').forEach(input => {
        // Debounced save to prevent excessive localStorage writes
        const debouncedSave = debounce((cid, rentVal) => {
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].manualRentAmount = rentVal;
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        }, 300);

        input.addEventListener('input', () => {
          const cid = input.dataset.card;
          const rentVal = parseFloat(input.value) || 0;
          const cashFor100 = (rentVal / 100) * 3;

          // Immediate UI update for responsiveness
          const results = document.querySelector(`.bilt-calc-results[data-card="${cid}"]`);
          if (results) {
            results.querySelector('.calc-100').textContent = cashFor100.toFixed(2);
            results.querySelector('.calc-75').textContent = (cashFor100 * 0.75).toFixed(2);
            results.querySelector('.calc-50').textContent = (cashFor100 * 0.50).toFixed(2);
            results.querySelector('.calc-25').textContent = (cashFor100 * 0.25).toFixed(2);
          }

          // Debounced storage save
          debouncedSave(cid, rentVal);
        });
      });
      // Bilt Cash as credit checkbox
      document.querySelectorAll('.bilt-cash-as-credit').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          const cid = checkbox.dataset.card;
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].countBiltCashAsCredit = checkbox.checked;
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        });
      });
      // Monthly Bilt Cash redemption for rent
      document.querySelectorAll('.bilt-monthly-redemption').forEach(input => {
        input.addEventListener('change', () => {
          const cid = input.dataset.card;
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].monthlyBiltCashRedemption = parseFloat(input.value) || 0;
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        });
      });
      // Reward option
      document.querySelectorAll('.bilt-reward-option').forEach(radio => {
        radio.addEventListener('change', () => {
          const cid = radio.dataset.card;
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].rewardOption = radio.value;
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
          document.getElementById(`biltFlexibleSection-${cid}`).style.display = radio.value === 'flexible' ? '' : 'none';
          document.getElementById(`biltHousingSection-${cid}`).style.display = radio.value === 'housing-only' ? '' : 'none';
          // Update radio label backgrounds
          document.querySelectorAll(`[name="biltRewardOption-${cid}"]`).forEach(r => {
            r.closest('label').style.background = r.checked ? (r.value === 'flexible' ? '#fef9c3' : '#dcfce7') : '';
          });
        });
      });
      // Rent detection mode
      document.querySelectorAll('.bilt-rent-detection').forEach(radio => {
        radio.addEventListener('change', () => {
          const cid = radio.dataset.card;
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].rentDetection = radio.value;
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
          document.getElementById(`biltManualRent-${cid}`).style.display = radio.value === 'manual' ? '' : 'none';
        });
      });
      // Manual rent amount
      document.querySelectorAll('.bilt-manual-rent').forEach(input => {
        input.addEventListener('change', () => {
          const cid = input.dataset.card;
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].manualRentAmount = parseFloat(input.value) || 2000;
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
          renderCardConfig(); // Re-render to update helper text
        });
      });
      // Rent day
      document.querySelectorAll('.bilt-rent-day').forEach(sel => {
        sel.addEventListener('change', () => {
          const cid = sel.dataset.card;
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].manualRentDay = parseInt(sel.value);
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        });
      });
      // Rent merchant keyword
      document.querySelectorAll('.bilt-rent-keyword').forEach(input => {
        input.addEventListener('change', () => {
          const cid = input.dataset.card;
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].rentMerchantKeyword = input.value.trim();
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        });
      });
      // Bonus category (Obsidian)
      document.querySelectorAll('.bilt-bonus-cat').forEach(radio => {
        radio.addEventListener('change', () => {
          const cid = radio.dataset.card;
          if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
          state.biltConfig[cid].bonusCategory = radio.value;
          safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        });
      });
    }
  }
  
  select.addEventListener('change', () => {
    renderCardConfig();
    updateCardMappingTooltip();
  });
  renderCardConfig();
  updateCardMappingTooltip();
}

// Helper to get current quarter string
function getCurrentQuarter() {
  const now = new Date();
  return `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
}

// Helper to get quarter for a date (just Q1, Q2, Q3, Q4 - year independent)
// Uses date parts to avoid timezone issues with ISO date strings
function getQuarterForDate(dateStr) {
  // Parse as local date to avoid timezone shifts
  // Handle both '2026-01-01' and '01/01/2026' formats
  let month;
  if (dateStr.includes('-')) {
    // ISO format: 2026-01-01
    const parts = dateStr.split('-');
    month = parseInt(parts[1], 10);
  } else if (dateStr.includes('/')) {
    // US format: 01/01/2026
    const parts = dateStr.split('/');
    month = parseInt(parts[0], 10);
  } else {
    // Fallback to Date parsing
    const date = new Date(dateStr + 'T12:00:00'); // Add noon to avoid timezone issues
    month = date.getMonth() + 1;
  }
  return `Q${Math.ceil(month / 3)}`;
}

function showResults(results, isNewUpload = false) {
  state.results = results;
  document.getElementById('uploadSection').classList.add('hidden');
  document.getElementById('mappingSection').classList.add('hidden');
  document.getElementById('cardConfigSection').classList.add('hidden');
  document.getElementById('resultsSection').classList.remove('hidden');
  
  // Year selector - parse dates correctly
  const years = [...new Set(results.processed.map(t => {
    if (t.date.includes('-')) {
      // Format: 2026-01-25
      return parseInt(t.date.split('-')[0]);
    } else if (t.date.includes('/')) {
      // Format: 01/25/2026 or 01/25/26
      const parts = t.date.split('/');
      const yearPart = parts[2];
      return parseInt(yearPart.length === 2 ? '20' + yearPart : yearPart);
    }
    return new Date().getFullYear();
  }))].sort((a, b) => b - a);
  
  // Default to most recent year from transactions
  state.selectedYear = years.length > 0 ? years[0] : null;
  state.availableYears = years; // Store for use in filters
  
  document.getElementById('transactionCount').textContent = `${results.processed.length} transactions`;
  
  // Initial metrics (will be updated by filters)
  const t = results.totals;
  document.getElementById('metricSpend').textContent = formatCurrency(t.spend);
  document.getElementById('metricPoints').textContent = formatNumber(t.points);
  document.getElementById('metricPointsValue').textContent = formatCurrency(t.pointsValue);
  document.getElementById('metricCredits').textContent = formatCurrency(t.credits);
  const netEl = document.getElementById('metricNetValue');
  netEl.textContent = formatCurrency(t.netValue);
  netEl.className = `metric-value ${t.netValue >= 0 ? 'positive' : 'negative'}`;
  
  // Count low-confidence transactions (exclude payments which are always 0 confidence)
  const lowConfidenceCount = results.processed.filter(txn => 
    !txn.isPayment && txn.confidence < CONFIDENCE_THRESHOLD
  ).length;
  
  // Stats footer - include low-confidence count
  const lowConfBadge = lowConfidenceCount > 0 
    ? `<span style="color:#b45309;"> • ${lowConfidenceCount} need review</span>` 
    : '';
  document.getElementById('statsFooter').innerHTML = `
    <strong>Stats:</strong> ${Object.keys(state.merchantCache).length} merchants cached •
    ${results.cards.length} cards tracked${lowConfBadge}
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #d6d3d1;">
      <span style="background:#f59e0b;color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:9999px;letter-spacing:0.04em;">BETA</span>
      <span style="margin-left:6px;">This tool is in beta — features may change and bugs may exist. Feedback welcome: <span id="feedbackEmail" style="color:#2563eb;cursor:pointer;text-decoration:underline;" title="Click to send feedback"></span></span>
    </div>
  `;
  initFeedbackEmail();

  renderView('summary');

  // Show low-confidence review modal on new upload if there are items to review
  // BUT NOT during the tour - it will be explained later
  // COMING SOON: Restore this popup when editing features are available
  // if (isNewUpload && lowConfidenceCount > 0 && !state.tourActive) {
  //   document.getElementById('lowConfidenceCount').textContent = lowConfidenceCount;
  //   document.getElementById('lowConfidenceModal').classList.remove('hidden');
  // }

  // Newsletter popup: show on card performance page (not during tour)
  // New users (just uploaded): 5s delay. Returning users: 2s delay.
  if (typeof showNewsletterPopup === 'function') {
    showNewsletterPopup(isNewUpload ? 5000 : 2000);
  }
}

function renderView(view) {
  state.activeView = view;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  
  const container = document.getElementById('viewContainer');
  const r = state.results;
  
  // Helper to get year from date string
  function getYearFromDate(dateStr) {
    if (dateStr.includes('-')) return parseInt(dateStr.split('-')[0]);
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      const yearPart = parts[2];
      return parseInt(yearPart.length === 2 ? '20' + yearPart : yearPart);
    }
    return new Date().getFullYear();
  }
  
  if (view === 'summary') {
    // Filter transactions by selected year
    const displayYear = state.selectedYear;
    let filteredProcessed = r.processed;
    if (displayYear) {
      filteredProcessed = r.processed.filter(t => getYearFromDate(t.date) === displayYear);
    }

    // Apply per-card tier date filtering (Free=1yr, DP=all-time)
    filteredProcessed = applyTierDateFiltering(filteredProcessed);
    
    // Recalculate totals for filtered transactions
    const filteredTotals = filteredProcessed.reduce((acc, t) => {
      if (!t.isPayment) {
        if (t.isCredit && !t.isRefund) {
          acc.credits += Math.abs(t.amount);
        } else if (!t.isCredit) {
          acc.spend += Math.abs(t.amount);
          acc.points += t.points || 0;
          acc.pointsValue += t.pointsValue || 0;
        }
      }
      return acc;
    }, { spend: 0, points: 0, pointsValue: 0, credits: 0 });
    
    // Recalculate cards for filtered transactions
    const cardMap = {};
    filteredProcessed.forEach(t => {
      if (!t.cardId || t.cardId === 'skip' || t.isPayment) return;
      if (!cardMap[t.cardId]) {
        const card = CARDS[t.cardId];
        cardMap[t.cardId] = {
          cardId: t.cardId,
          cardName: card?.name || t.cardId,
          spend: 0,
          points: 0,
          pointsValue: 0,
          credits: 0,
          annualFee: card?.annualFee || 0,
          pointsByCategory: {} // Track points by category for breakdown
        };
      }
      if (t.isCredit && !t.isRefund) {
        cardMap[t.cardId].credits += Math.abs(t.amount);
      } else if (!t.isCredit) {
        cardMap[t.cardId].spend += Math.abs(t.amount);
        cardMap[t.cardId].points += t.points || 0;
        cardMap[t.cardId].pointsValue += t.pointsValue || 0;
        // Track points by category
        const cat = t.category || 'other';
        if (!cardMap[t.cardId].pointsByCategory[cat]) {
          cardMap[t.cardId].pointsByCategory[cat] = { points: 0, spend: 0 };
        }
        cardMap[t.cardId].pointsByCategory[cat].points += t.points || 0;
        cardMap[t.cardId].pointsByCategory[cat].spend += Math.abs(t.amount);
      }
    });

    // Update annual fees after processing (for date-aware fees like CSR legacy)
    for (const cardId of Object.keys(cardMap)) {
      cardMap[cardId].annualFee = getEffectiveAnnualFee(cardId, filteredProcessed);
    }

    // Pre-calculate totalCredits and netValue for each card (needed for sorting)
    let cards = Object.values(cardMap).map(c => {
      const cardDef = CARDS[c.cardId];
      const availableCredits = cardDef?.credits || [];
      
      // Calculate total credits including monthly claimed ones - YEAR-SPECIFIC
      let totalCredits = c.credits;
      const monthlyForCard = state.monthlyCredits[c.cardId] || {};
      for (const cr of availableCredits) {
        if (cr.manual) {
          const yearData = monthlyForCard[cr.name];
          let claimedMonths = [];
          if (Array.isArray(yearData)) {
            if (!displayYear || displayYear === new Date().getFullYear()) {
              claimedMonths = yearData;
            }
          } else if (typeof yearData === 'object') {
            if (displayYear) {
              claimedMonths = yearData[displayYear] || [];
            } else {
              for (const yr of Object.keys(yearData)) {
                claimedMonths = claimedMonths.concat(yearData[yr] || []);
              }
            }
          }
          const isDisabled = (state.disabledCredits[c.cardId] || []).includes(cr.name);
          if (!isDisabled && claimedMonths.length > 0) {
            totalCredits += claimedMonths.length * (cr.amount / 12);
          }
        }
      }
      
      // Add Bilt Cash as credit if enabled (for Bilt cards with Flexible option)
      let biltCashCredit = 0;
      if (cardDef?.isBilt) {
        const biltCfg = state.biltConfig[c.cardId] || {};
        if (biltCfg.countBiltCashAsCredit !== false && biltCfg.rewardOption !== 'housing-only') {
          const bilt20Date = new Date(2026, 1, 7);
          // Calculate Bilt Cash earned from processed transactions (which have cardId)
          const biltTxns = filteredProcessed.filter(t => {
            if (t.cardId !== c.cardId) return false;
            const d = new Date(t.date);
            if (d < bilt20Date) return false; // Only Bilt 2.0 earns Bilt Cash
            return t.category !== 'rent';
          });
          const purchases = biltTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
          const refunds = biltTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
          biltCashCredit = Math.max(0, purchases - refunds) * 0.04;
          totalCredits += biltCashCredit;
        }
      }
      
      // Add anniversary bonus points value (e.g., Venture X 10,000 bonus miles)
      // Only included when an annual fee was detected in the transaction data for this period
      const annualBonusValue = getAnnualBonusValue(c.cardId, displayYear);
      totalCredits += annualBonusValue;

      const netValue = c.pointsValue + totalCredits - c.annualFee;
      return { ...c, totalCredits, netValue, biltCashCredit, annualBonusValue };
    });
    
    // Apply sort based on sortState
    const sortState = state.summarySortState || { column: 'cardName', direction: 'asc' };
    
    const sortFn = (a, b) => {
      let aVal, bVal;
      switch (sortState.column) {
        case 'cardName': aVal = a.cardName; bVal = b.cardName; break;
        case 'spend': aVal = a.spend; bVal = b.spend; break;
        case 'points': aVal = a.points; bVal = b.points; break;
        case 'pointsValue': aVal = a.pointsValue; bVal = b.pointsValue; break;
        case 'credits': aVal = a.totalCredits; bVal = b.totalCredits; break;
        case 'annualFee': aVal = a.annualFee; bVal = b.annualFee; break;
        case 'netValue': aVal = a.netValue; bVal = b.netValue; break;
        default: aVal = a.cardName; bVal = b.cardName;
      }
      
      if (sortState.column === 'cardName') {
        return sortState.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
    };
    
    cards.sort(sortFn);

    // Pre-calculate card year display metrics for each card
    // This is needed to properly calculate top-level totals that respect CY capping
    const cardDisplayData = {};
    cards.forEach(c => {
      const cardDef = CARDS[c.cardId];
      const availableCredits = cardDef?.credits || [];
      const showCardYearToggle = displayYear && canShowCardYearToggle(c.cardId) && (isCardEditable(c.cardId, 'config') || CARDS[c.cardId]?.isBilt);
      const isCardYearActive = showCardYearToggle && state.cardYearToggles[c.cardId];

      if (isCardYearActive && displayYear) {
        const cardYearPeriod = getCardYearPeriod(c.cardId, displayYear);
        if (cardYearPeriod) {
          const cyMetrics = calculateCardYearMetrics(c.cardId, cardYearPeriod.startDate, cardYearPeriod.endDate, r.processed);
          if (cyMetrics) {
            const cyCreditsUsed = getCardYearCreditsUsed(c.cardId, cardYearPeriod.startDate, cardYearPeriod.endDate, r.processed);
            // Apply annual caps in card year mode
            let cyTotalCredits = 0;
            for (const cr of availableCredits) {
              const disabled = (state.disabledCredits[c.cardId] || []).includes(cr.name);
              if (disabled) continue;
              const used = cyCreditsUsed[cr.name] || 0;
              cyTotalCredits += Math.min(used, cr.amount);
            }
            // Include anniversary bonus in card year mode (tied to annual fee detection)
            cyTotalCredits += getAnnualBonusValue(c.cardId, displayYear);
            const cyNetValue = cyMetrics.pointsValue + cyTotalCredits - c.annualFee;
            cardDisplayData[c.cardId] = {
              isCardYearActive: true,
              cardYearPeriod,
              creditsUsed: cyCreditsUsed,
              displayMetrics: {
                ...c,
                spend: cyMetrics.spend,
                points: cyMetrics.points,
                pointsValue: cyMetrics.pointsValue,
                credits: cyMetrics.credits,
                totalCredits: cyTotalCredits,
                netValue: cyNetValue,
                pointsByCategory: cyMetrics.pointsByCategory
              }
            };
          }
        }
      }
      // If not CY active or CY failed, use calendar year metrics (no entry in cardDisplayData)
    });

    // Update top metrics
    document.getElementById('metricSpend').textContent = formatCurrency(filteredTotals.spend);
    document.getElementById('metricPoints').textContent = formatNumber(filteredTotals.points);
    document.getElementById('metricPointsValue').textContent = formatCurrency(filteredTotals.pointsValue);
    document.getElementById('metricCredits').textContent = formatCurrency(filteredTotals.credits);
    
    // Calculate net value including manual credits for the selected year
    let totalManualCredits = 0;
    let totalAnnualFees = 0;
    
    // Build credits used map per card (transaction-detected + manual)
    const creditsUsedByCard = {};
    filteredProcessed.forEach(txn => {
      if (txn.isCredit && txn.creditMatch && txn.cardId) {
        if (!creditsUsedByCard[txn.cardId]) creditsUsedByCard[txn.cardId] = {};
        if (!creditsUsedByCard[txn.cardId][txn.creditMatch]) creditsUsedByCard[txn.cardId][txn.creditMatch] = 0;
        creditsUsedByCard[txn.cardId][txn.creditMatch] += Math.abs(txn.amount);
      }
    });
    
    // Add monthly credits to the map (claimed months × monthly amount) - YEAR-SPECIFIC
    const creditYear = displayYear || new Date().getFullYear();
    for (const [cardId, creditMap] of Object.entries(state.monthlyCredits)) {
      if (!creditsUsedByCard[cardId]) creditsUsedByCard[cardId] = {};
      const cardDef = CARDS[cardId];
      if (!cardDef) continue;
      
      for (const [creditName, yearData] of Object.entries(creditMap)) {
        const credit = cardDef.credits.find(c => c.name === creditName);
        if (!credit || !credit.manual) continue;
        
        // Handle both legacy array format and new year-based object format
        let claimedMonths = [];
        if (Array.isArray(yearData)) {
          // Legacy format - treat as current year only if showing current year or all
          if (!displayYear || displayYear === new Date().getFullYear()) {
            claimedMonths = yearData;
          }
        } else if (typeof yearData === 'object') {
          // New year-specific format
          if (displayYear) {
            claimedMonths = yearData[displayYear] || [];
          } else {
            // All years - sum all
            for (const yr of Object.keys(yearData)) {
              claimedMonths = claimedMonths.concat(yearData[yr] || []);
            }
          }
        }
        
        if (claimedMonths.length > 0) {
          const monthlyAmount = credit.amount / 12;
          const totalClaimed = claimedMonths.length * monthlyAmount;
          if (!creditsUsedByCard[cardId][creditName]) creditsUsedByCard[cardId][creditName] = 0;
          creditsUsedByCard[cardId][creditName] += totalClaimed;
          totalManualCredits += totalClaimed;
        }
      }
    }
    
    // Calculate total annual fees (only count if we have transactions for that card in this period)
    // Uses date-aware fee calculation for cards like CSR with legacy rates
    const activeCardIds = new Set(filteredProcessed.map(t => t.cardId).filter(id => id && id !== 'skip'));
    activeCardIds.forEach(cardId => {
      totalAnnualFees += getEffectiveAnnualFee(cardId, filteredProcessed);
    });
    
    // Calculate total credits, respecting CY capping for toggled cards
    // For CY-active cards, use their capped totalCredits from cardDisplayData
    // For other cards, use their uncapped totalCredits
    let adjustedTotalCredits = 0;
    let adjustedTotalPointsValue = 0;
    cards.forEach(c => {
      const cyData = cardDisplayData[c.cardId];
      if (cyData) {
        // Card has CY active - use capped values
        adjustedTotalCredits += cyData.displayMetrics.totalCredits;
        adjustedTotalPointsValue += cyData.displayMetrics.pointsValue;
      } else {
        // Card using calendar year - use uncapped values
        adjustedTotalCredits += c.totalCredits;
        adjustedTotalPointsValue += c.pointsValue;
      }
    });

    const netValue = adjustedTotalPointsValue + adjustedTotalCredits - totalAnnualFees;
    document.getElementById('metricCredits').textContent = formatCurrency(adjustedTotalCredits);
    const netEl = document.getElementById('metricNetValue');
    netEl.textContent = formatCurrency(netValue);
    netEl.className = `metric-value ${netValue >= 0 ? 'positive' : 'negative'}`;
    
    // Update transaction count
    document.getElementById('transactionCount').textContent = `${filteredProcessed.length} transactions`;
    
    // Get available years for filter
    const summaryYears = state.availableYears.length > 0 ? state.availableYears : [...new Set(r.processed.map(t => getYearFromDateString(t.date)))].sort((a, b) => b - a);
    
    container.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 class="card-title" style="margin:0;">Card Performance Summary</h2>
            <p style="font-size:12px;color:#78716c;margin-top:4px;">Click column headers to sort • Click ▼ on Credits to see breakdown</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="help-icon tooltip" data-tooltip="'All Years' shows combined totals. Annual fees counted once per card.">?</span>
            <select id="summaryYearFilter" class="form-select" style="min-width:120px;">
              <option value="" ${!displayYear ? 'selected' : ''}>All Years</option>
              ${summaryYears.map(y => `<option value="${y}" ${displayYear == y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table id="summaryTable">
            <thead><tr>
              <th class="sortable" data-sort="cardName">Card${sortState.column === 'cardName' ? `<span class="sort-arrow">${sortState.direction === 'asc' ? '▲' : '▼'}</span>` : ''}</th>
              <th class="text-right sortable" data-sort="spend">Spend${sortState.column === 'spend' ? `<span class="sort-arrow">${sortState.direction === 'asc' ? '▲' : '▼'}</span>` : ''}</th>
              <th class="text-right sortable" data-sort="points">Points${sortState.column === 'points' ? `<span class="sort-arrow">${sortState.direction === 'asc' ? '▲' : '▼'}</span>` : ''}</th>
              <th class="text-right sortable" data-sort="pointsValue">Pts Value${sortState.column === 'pointsValue' ? `<span class="sort-arrow">${sortState.direction === 'asc' ? '▲' : '▼'}</span>` : ''}</th>
              <th class="text-right sortable" data-sort="credits">Credits${sortState.column === 'credits' ? `<span class="sort-arrow">${sortState.direction === 'asc' ? '▲' : '▼'}</span>` : ''}</th>
              <th class="text-right sortable" data-sort="annualFee">Ann. Fee${sortState.column === 'annualFee' ? `<span class="sort-arrow">${sortState.direction === 'asc' ? '▲' : '▼'}</span>` : ''}</th>
              <th class="text-right sortable" data-sort="netValue">Net Value${sortState.column === 'netValue' ? `<span class="sort-arrow">${sortState.direction === 'asc' ? '▲' : '▼'}</span>` : ''}</th>
            </tr></thead>
            <tbody>
              ${cards.map(c => {
                const cardDef = CARDS[c.cardId];
                const availableCredits = cardDef?.credits || [];
                const hasCredits = availableCredits.length > 0 || (cardDef?.annualBonusPoints || 0) > 0;

                const hasPointsBreakdown = Object.keys(c.pointsByCategory || {}).length > 0;
                const hasDetails = hasPointsBreakdown || hasCredits;
                const rowId = c.cardId.replace(/[^a-z0-9]/gi, '-');

                // Use pre-calculated card year data if available
                const cyData = cardDisplayData[c.cardId];
                const showCardYearToggle = displayYear && canShowCardYearToggle(c.cardId) && (isCardEditable(c.cardId, 'config') || CARDS[c.cardId]?.isBilt);
                const isCardYearActive = cyData?.isCardYearActive || false;
                const cardYearPeriod = cyData?.cardYearPeriod || null;
                const displayCreditsUsed = cyData?.creditsUsed || creditsUsedByCard[c.cardId] || {};
                const displayMetrics = cyData?.displayMetrics || c;

                // Row styling for card year mode
                const cardYearRowStyle = isCardYearActive ? 'color:#4b6bfb;' : '';
                const cardYearTooltip = cardYearPeriod
                  ? `Showing card year active Dec 31, ${displayYear} (${cardYearPeriod.startFormatted} – ${cardYearPeriod.endFormatted})`
                  : '';

                // Toggle indicator HTML - small CY text to the right of the card name
                const toggleHtml = showCardYearToggle ? `
                  <span class="card-year-toggle tooltip tooltip-multiline" data-card-id="${escapeHtml(c.cardId)}"
                    data-tooltip="${isCardYearActive ? cardYearTooltip : 'Switch to card anniversary year'}"
                    style="display:inline-block;font-size:9px;font-weight:600;padding:1px 4px;border-radius:3px;background:${isCardYearActive ? '#4b6bfb' : '#e7e5e4'};color:${isCardYearActive ? '#fff' : '#a8a29e'};cursor:pointer;margin-left:6px;vertical-align:middle;flex-shrink:0;">CY</span>
                ` : '';

                // Decision Pass indicator - shows when this card has an active Decision Pass
                const hasDPActive = hasActiveDecisionPass(c.cardId);
                const dpBadgeHtml = hasDPActive ? `
                  <span class="tooltip" data-tooltip="Decision Pass active — all-time data, editing unlocked"
                    style="display:inline-block;font-size:9px;font-weight:600;padding:1px 4px;border-radius:3px;background:#059669;color:#fff;margin-left:4px;vertical-align:middle;flex-shrink:0;">DP</span>
                ` : '';

                return `<tr data-row-id="${rowId}" style="${cardYearRowStyle}">
                  <td style="white-space:nowrap;"><span style="display:inline-flex;align-items:center;">${escapeHtml(c.cardName)}${toggleHtml}${dpBadgeHtml}</span></td>
                  <td class="text-right mono">${formatCurrencyPrecise(displayMetrics.spend)}</td>
                  <td class="text-right mono">
                    ${hasDetails ? `
                      <div class="detail-toggle" data-row="${rowId}" style="cursor:pointer;display:flex;align-items:center;justify-content:flex-end;gap:4px;">
                        ${formatNumber(displayMetrics.points)} <span class="toggle-arrow" style="font-size:10px;">▼</span>
                      </div>
                      <div class="detail-panel points-panel" data-row="${rowId}" style="display:none;text-align:left;font-size:11px;margin-top:8px;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">
                        ${Object.keys(displayMetrics.pointsByCategory || {}).length > 0 ? `
                          ${Object.entries(displayMetrics.pointsByCategory || {})
                            .sort((a, b) => b[1].points - a[1].points)
                            .map(([cat, data]) => `
                              <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                                <span style="text-transform:capitalize;">${escapeHtml(cat)}</span>
                                <span style="font-weight:500;">${formatNumber(data.points)} pts</span>
                              </div>
                            `).join('')}
                        ` : '<div style="color:#78716c;">No category breakdown</div>'}
                      </div>
                    ` : formatNumber(displayMetrics.points)}
                  </td>
                  <td class="text-right mono">${formatCurrencyPrecise(displayMetrics.pointsValue)}</td>
                  <td class="text-right mono">
                    ${hasDetails ? `
                      <div class="detail-toggle" data-row="${rowId}" style="cursor:pointer;display:flex;align-items:center;justify-content:flex-end;gap:4px;">
                        ${formatCurrencyPrecise(displayMetrics.totalCredits)} <span class="toggle-arrow" style="font-size:10px;">▼</span>
                      </div>
                      <div class="detail-panel credits-panel" data-row="${rowId}" style="display:none;text-align:left;font-size:11px;margin-top:8px;padding:8px;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:6px;">
                        ${hasCredits ? `
                          ${availableCredits.map(cr => {
                            const disabled = (state.disabledCredits[c.cardId] || []).includes(cr.name);
                            const isManual = cr.manual === true;
                            const used = disabled ? 0 : (displayCreditsUsed[cr.name] || 0);
                            // Only show cap/progress in card year mode
                            const showCap = isCardYearActive;
                            const pct = showCap ? Math.min(100, (used / cr.amount) * 100) : 100;
                            const amountDisplay = showCap ? `$${used.toFixed(0)} / $${cr.amount}` : `$${used.toFixed(0)}`;
                            return `
                              <div style="margin-bottom:6px;${disabled ? 'opacity:0.4;' : ''}">
                                <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                                  <span style="${disabled ? 'text-decoration:line-through;' : ''}">${escapeHtml(cr.name)}${disabled ? ' (off)' : ''}${isManual && !disabled ? ' ⚡' : ''}</span>
                                  <span>${amountDisplay}</span>
                                </div>
                                ${showCap ? `
                                <div style="background:#e7e5e4;border-radius:2px;height:4px;">
                                  <div style="background:${disabled ? '#a8a29e' : (pct >= 100 ? '#166534' : '#f59e0b')};width:${pct}%;height:100%;border-radius:2px;"></div>
                                </div>
                                ` : ''}
                              </div>
                            `;
                          }).join('')}
                        ` : '<div style="color:#78716c;">No credits available</div>'}
                        ${(displayMetrics.annualBonusValue || 0) > 0 ? `
                          <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #d6d3d1;">
                            <div style="display:flex;justify-content:space-between;">
                              <span style="color:#4b6bfb;">Anniversary bonus miles</span>
                              <span style="font-weight:500;color:#4b6bfb;">$${(displayMetrics.annualBonusValue).toFixed(0)}</span>
                            </div>
                            <div style="font-size:10px;color:#78716c;">${formatNumber(getAnnualBonusPoints(c.cardId))} pts × ${(getPointValue(c.cardId) * 100).toFixed(1)}¢</div>
                          </div>
                        ` : ''}
                      </div>
                    ` : formatCurrencyPrecise(displayMetrics.totalCredits)}
                  </td>
                  <td class="text-right mono" style="color:#dc2626;">-$${c.annualFee}</td>
                  <td class="text-right mono" style="font-weight:600;color:${displayMetrics.netValue >= 0 ? '#166534' : '#dc2626'};">${formatCurrencyPrecise(displayMetrics.netValue)}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:16px;font-size:12px;color:#78716c;">Net Value = Points Value + Credits Used${cards.some(c => (c.annualBonusValue || 0) > 0) ? ' + Anniversary Bonus' : ''} - Annual Fee</div>
      </div>`;
    
    // Add year filter event listener
    document.getElementById('summaryYearFilter').addEventListener('change', (e) => {
      const newYear = e.target.value ? parseInt(e.target.value) : null;

      // Reset card year toggles when calendar year changes
      if (newYear !== state.selectedYear) {
        state.cardYearToggles = {};
        safeLocalStorageSet('ccTracker_cardYearToggles', state.cardYearToggles);
      }

      state.selectedYear = newYear;
      renderView('summary');
    });

    // Add click handler for detail toggles - clicking either Points or Credits toggles both panels
    document.querySelectorAll('.detail-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const rowId = toggle.dataset.row;
        const panels = document.querySelectorAll(`.detail-panel[data-row="${rowId}"]`);
        const arrows = document.querySelectorAll(`.detail-toggle[data-row="${rowId}"] .toggle-arrow`);
        const isOpen = panels[0]?.style.display !== 'none';

        panels.forEach(panel => {
          panel.style.display = isOpen ? 'none' : 'block';
        });
        arrows.forEach(arrow => {
          arrow.textContent = isOpen ? '▼' : '▲';
        });
      });
    });

    // Add click handler for card year toggle buttons
    document.querySelectorAll('.card-year-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardId = btn.dataset.cardId;

        // Toggle the card year state
        if (state.cardYearToggles[cardId]) {
          delete state.cardYearToggles[cardId];
        } else {
          state.cardYearToggles[cardId] = true;
        }

        // Persist to localStorage
        safeLocalStorageSet('ccTracker_cardYearToggles', state.cardYearToggles);

        // Re-render the summary view
        renderView('summary');
      });
    });

    // Add sortable column click handlers
    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const column = th.dataset.sort;
        const currentState = state.summarySortState || { column: 'cardName', direction: 'asc' };
        
        // Toggle direction if same column, otherwise default to desc (except cardName which defaults to asc)
        let newDirection;
        if (currentState.column === column) {
          newDirection = currentState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          newDirection = column === 'cardName' ? 'asc' : 'desc';
        }
        
        state.summarySortState = { column, direction: newDirection };
        renderView('summary');
      });
    });
  }
  
  if (view === 'transactions') {
    // Get unique cards and categories for filters
    const uniqueCards = [...new Set(r.processed.map(t => t.cardName))].sort();
    const uniqueCategories = [...new Set(r.processed.map(t => t.category))].sort();
    
    // Get unique years and months for time filters
    const uniqueYears = [...new Set(r.processed.map(t => getYearFromDateString(t.date)))].sort().reverse();
    
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
    
    // COMING SOON: Transactions banner hidden for free-only launch. Restore when paid plans go live.
    const txnBannerKey = 'transactions';
    const txnDPBanner = '';
    /* COMING SOON: Uncomment to restore transactions upgrade banner
    const showTxnBanner = window.TIER_CONFIG !== 'pro' && getActiveDecisionPasses().length === 0 && !state.dpBannersDismissed[txnBannerKey];
    const txnDPBanner = showTxnBanner ? `
      <div class="dp-banner" data-banner-key="${txnBannerKey}" style="position:relative;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;padding-right:32px;margin-bottom:16px;font-size:12px;color:#057a55;">
        Transaction categories are read-only. Unlock editing with a <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Decision Pass</a> or <a href="#" class="dp-upgrade-link" style="color:#059669;font-weight:600;text-decoration:underline;cursor:pointer;">Pro</a> to recategorize transactions.
        <button class="dp-banner-close" data-banner-key="${txnBannerKey}" style="position:absolute;top:6px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;color:#057a55;opacity:0.6;line-height:1;" title="Dismiss">&times;</button>
      </div>
    ` : '';
    */

    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Transaction Detail</h2>
        ${txnDPBanner}
        <p style="font-size:12px;color:#78716c;margin-bottom:12px;">
          <span style="display:inline-block;width:12px;height:12px;background:#dcfce7;border-radius:3px;margin-right:4px;vertical-align:middle;"></span>Optimal card
          <span style="display:inline-block;width:12px;height:12px;background:#fef9c3;border-radius:3px;margin-left:12px;margin-right:4px;vertical-align:middle;"></span>Good, better exists
          <span style="display:inline-block;width:12px;height:12px;background:#fee2e2;border-radius:3px;margin-left:12px;margin-right:4px;vertical-align:middle;"></span>Suboptimal
          <span style="display:inline-block;width:12px;height:12px;background:#e0f2fe;border-radius:3px;margin-left:12px;margin-right:4px;vertical-align:middle;"></span>Credit
        </p>
        
        ${(() => {
          // Count low-confidence transactions
          const lowConfCount = r.processed.filter(t => !t.isPayment && t.confidence < CONFIDENCE_THRESHOLD).length;
          const needsReviewBadge = lowConfCount > 0 ? `<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:600;margin-left:4px;">${lowConfCount}</span>` : '';
          return `
        <div id="filterRow" style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
          <div class="search-input-wrapper" style="position:relative;">
            <input type="text" id="filterMerchant" class="form-select" placeholder="Search merchants..." style="min-width:180px;padding-right:28px;">
            <button type="button" id="clearMerchantSearch" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:14px;color:#a8a29e;padding:2px 4px;display:none;" title="Clear search">&times;</button>
          </div>
          <select id="filterYear" class="form-select" style="min-width:100px;">
            <option value="">All Years</option>
            ${uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
          <select id="filterMonth" class="form-select" style="min-width:120px;">
            <option value="">All Months</option>
            ${MONTH_NAMES.map((m, i) => `<option value="${i}">${m}</option>`).join('')}
          </select>
          <select id="filterCard" class="form-select" style="min-width:180px;">
            <option value="">All Cards</option>
            ${uniqueCards.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
          <select id="filterCategory" class="form-select" style="min-width:180px;">
            <option value="">All Categories</option>
            ${uniqueCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#78716c;">
            <input type="checkbox" id="filterCreditsOnly"> Credits
          </label>
          <label id="needsReviewFilter" style="display:flex;align-items:center;gap:6px;font-size:13px;color:#b45309;cursor:pointer;" title="Show transactions that need manual review">
            <input type="checkbox" id="filterNeedsReview"> 🔍 Needs Review${needsReviewBadge}
          </label>
        </div>`;
        })()}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span id="filteredCount" style="font-size:13px;color:#78716c;"></span>
          <button class="btn btn-secondary" id="clearFilters" style="font-size:12px;padding:4px 10px;">Clear Filters</button>
        </div>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr>
              ${(() => {
                const ss = state.txnSortState;
                const cols = [
                  { key: 'date', label: 'Date', cls: '' },
                  { key: 'merchant', label: 'Merchant', cls: '' },
                  { key: 'card', label: 'Card', cls: '' },
                  { key: 'category', label: 'Category', cls: '' },
                  { key: 'amount', label: 'Amount', cls: ' class="text-right"' },
                  { key: 'multiplier', label: 'Multi', cls: ' class="text-right"', title: 'Points multiplier for this category' },
                  { key: 'points', label: 'Points', cls: ' class="text-right"', title: 'Points earned (negative for refunds/credits)' },
                  { key: 'reason', label: 'Reason', cls: '', title: 'How the category/multiplier was determined' }
                ];
                return cols.map(c => {
                  const arrow = ss.column === c.key ? (ss.direction === 'asc' ? ' ▲' : ' ▼') : '';
                  const titleAttr = c.title ? ` title="${c.title}"` : '';
                  return `<th${c.cls} data-sort="${c.key}"${titleAttr} style="cursor:pointer;user-select:none;white-space:nowrap;">${c.label}${arrow}</th>`;
                }).join('');
              })()}
            </tr></thead>
            <tbody id="transactionsBody"></tbody>
          </table>
        </div>
        <div id="paginationControls"></div>
      </div>
      
      <!-- Credit Override Modal -->
      <div id="creditModal" class="loading-overlay hidden" style="cursor:pointer;">
        <div class="loading-modal" style="cursor:default;max-width:500px;text-align:left;">
          <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;">Classify This Transaction</h3>
          <div id="creditModalContent"></div>
        </div>
      </div>`;
    
    // Close modal when clicking outside
    document.getElementById('creditModal').addEventListener('click', () => {
      document.getElementById('creditModal').classList.add('hidden');
    });
    
    // Clear filters button
    document.getElementById('clearFilters').addEventListener('click', () => {
      document.getElementById('filterYear').value = '';
      document.getElementById('filterMonth').value = '';
      document.getElementById('filterCard').value = '';
      document.getElementById('filterCategory').value = '';
      document.getElementById('filterCreditsOnly').checked = false;
      document.getElementById('filterNeedsReview').checked = false;
      document.getElementById('filterMerchant').value = '';
      document.getElementById('clearMerchantSearch').style.display = 'none';
      renderTransactions();
    });
    
    function renderTransactions() {
      const yearFilter = document.getElementById('filterYear').value;
      const monthFilter = document.getElementById('filterMonth').value;
      const cardFilter = document.getElementById('filterCard').value;
      const catFilter = document.getElementById('filterCategory').value;
      const creditsOnly = document.getElementById('filterCreditsOnly').checked;
      const needsReview = document.getElementById('filterNeedsReview').checked;
      const merchantSearch = (document.getElementById('filterMerchant').value || '').toLowerCase().trim();

      // Apply per-card tier date filtering (Free=1yr, DP=all-time)
      let txns = applyTierDateFiltering([...r.processed]);

      // Apply year filter
      if (yearFilter) {
        txns = txns.filter(t => getYearFromDateString(t.date) === parseInt(yearFilter));
      }

      // Apply month filter
      if (monthFilter !== '') {
        txns = txns.filter(t => {
          const dateStr = t.date;
          let month;
          if (dateStr.includes('-')) month = parseInt(dateStr.split('-')[1]) - 1;
          else if (dateStr.includes('/')) month = parseInt(dateStr.split('/')[0]) - 1;
          else month = new Date(dateStr).getMonth();
          return month === parseInt(monthFilter);
        });
      }

      if (cardFilter) txns = txns.filter(t => t.cardName === cardFilter);
      if (catFilter) txns = txns.filter(t => t.category === catFilter);

      // Apply merchant search filter
      if (merchantSearch) {
        txns = txns.filter(t => (t.merchant || '').toLowerCase().includes(merchantSearch));
      }
      if (creditsOnly) txns = txns.filter(t => t.isCredit);
      if (needsReview) txns = txns.filter(t => !t.isPayment && t.confidence < CONFIDENCE_THRESHOLD);

      // Sort filtered transactions
      const sort = state.txnSortState;
      const dir = sort.direction === 'asc' ? 1 : -1;

      function compareDates(a, b) {
        return new Date(a.date) - new Date(b.date);
      }
      function compareMerchants(a, b) {
        return (a.merchant || '').localeCompare(b.merchant || '');
      }
      function compareStrings(keyFn) {
        return (a, b) => (keyFn(a) || '').localeCompare(keyFn(b) || '');
      }
      function compareNumbers(keyFn) {
        return (a, b) => (keyFn(a) || 0) - (keyFn(b) || 0);
      }

      const primaryComparators = {
        date: compareDates,
        merchant: compareMerchants,
        card: compareStrings(t => t.cardName),
        category: compareStrings(t => t.category),
        amount: compareNumbers(t => Math.abs(t.amount)),
        multiplier: compareNumbers(t => t.multiplier),
        points: compareNumbers(t => t.points),
        reason: compareStrings(t => t.reason)
      };

      const primaryCmp = primaryComparators[sort.column] || compareDates;

      txns.sort((a, b) => {
        const primary = primaryCmp(a, b) * dir;
        if (primary !== 0) return primary;
        // Secondary sort: Date primary → Merchant asc; all others → Date desc, then Merchant asc
        if (sort.column === 'date') {
          return compareMerchants(a, b);
        }
        const byDate = compareDates(a, b) * -1; // desc
        if (byDate !== 0) return byDate;
        return compareMerchants(a, b);
      });

      // Update top metrics based on filtered transactions
      const filteredTotals = txns.reduce((acc, t) => {
        if (!t.isPayment) {
          if (t.isCredit && !t.isRefund) {
            acc.credits += Math.abs(t.amount);
          } else if (!t.isCredit) {
            acc.spend += Math.abs(t.amount);
            acc.points += t.points || 0;
            acc.pointsValue += t.pointsValue || 0;
          }
        }
        return acc;
      }, { spend: 0, points: 0, pointsValue: 0, credits: 0 });
      
      // Calculate net value properly - include manual credits and subtract annual fees
      // Get unique cards in filtered transactions
      const filteredCardIds = [...new Set(txns.map(t => t.cardId).filter(id => id && id !== 'skip'))];
      
      // Add manual credits for filtered cards
      let totalManualCredits = 0;
      let totalAnnualFees = 0;
      
      for (const cardId of filteredCardIds) {
        const cardDef = CARDS[cardId];
        if (!cardDef) continue;

        // Use date-aware annual fee calculation for cards like CSR with legacy rates
        totalAnnualFees += getEffectiveAnnualFee(cardId, txns);

        // Add manual credits - respect year filter if active
        const monthlyForCard = state.monthlyCredits[cardId] || {};
        for (const cr of (cardDef.credits || [])) {
          if (cr.manual) {
            const yearData = monthlyForCard[cr.name];
            let claimedMonths = [];
            if (Array.isArray(yearData)) {
              // Legacy format - only include if no year filter or matching current year
              if (!yearFilter || parseInt(yearFilter) === new Date().getFullYear()) {
                claimedMonths = yearData;
              }
            } else if (typeof yearData === 'object') {
              if (yearFilter) {
                // Only include claimed months for the filtered year
                claimedMonths = yearData[yearFilter] || [];
              } else {
                // No year filter - sum all years
                for (const yr of Object.keys(yearData)) {
                  claimedMonths = claimedMonths.concat(yearData[yr] || []);
                }
              }
            }
            const isDisabled = (state.disabledCredits[cardId] || []).includes(cr.name);
            if (!isDisabled && claimedMonths.length > 0) {
              totalManualCredits += claimedMonths.length * (cr.amount / 12);
            }
          }
        }
      }
      
      // Add anniversary bonus points value for applicable cards (tied to annual fee detection)
      const bonusYear = yearFilter ? parseInt(yearFilter) : null;
      let totalAnnualBonus = 0;
      for (const cardId of filteredCardIds) {
        totalAnnualBonus += getAnnualBonusValue(cardId, bonusYear);
      }

      const netValue = filteredTotals.pointsValue + filteredTotals.credits + totalManualCredits + totalAnnualBonus - totalAnnualFees;

      document.getElementById('metricSpend').textContent = formatCurrency(filteredTotals.spend);
      document.getElementById('metricPoints').textContent = formatNumber(filteredTotals.points);
      document.getElementById('metricPointsValue').textContent = formatCurrency(filteredTotals.pointsValue);
      document.getElementById('metricCredits').textContent = formatCurrency(filteredTotals.credits + totalManualCredits);
      const netEl = document.getElementById('metricNetValue');
      netEl.textContent = formatCurrency(netValue);
      netEl.className = `metric-value ${netValue >= 0 ? 'positive' : 'negative'}`;
      
      // Pagination
      const pageSize = 100;
      const currentPage = parseInt(document.getElementById('txnPage')?.value || '1');
      const totalPages = Math.ceil(txns.length / pageSize);
      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      const pageTxns = txns.slice(startIdx, endIdx);
      
      document.getElementById('filteredCount').textContent = txns.length > 0 
        ? `Showing ${startIdx + 1}-${Math.min(endIdx, txns.length)} of ${txns.length} transactions`
        : 'No transactions match filters';
      
      // Update pagination controls
      document.getElementById('paginationControls').innerHTML = txns.length > pageSize ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
          <button class="btn btn-secondary" id="prevPage" ${currentPage <= 1 ? 'disabled' : ''} style="padding:6px 12px;">← Prev</button>
          <span style="font-size:13px;">Page 
            <select id="txnPage" class="form-select" style="width:70px;padding:4px 8px;">
              ${Array.from({length: totalPages}, (_, i) => `<option value="${i+1}" ${i+1 === currentPage ? 'selected' : ''}>${i+1}</option>`).join('')}
            </select>
            of ${totalPages}
          </span>
          <button class="btn btn-secondary" id="nextPage" ${currentPage >= totalPages ? 'disabled' : ''} style="padding:6px 12px;">Next →</button>
        </div>
      ` : '';
      
      // Add pagination event listeners
      document.getElementById('prevPage')?.addEventListener('click', () => {
        const sel = document.getElementById('txnPage');
        if (sel && parseInt(sel.value) > 1) {
          sel.value = parseInt(sel.value) - 1;
          renderTransactions();
        }
      });
      document.getElementById('nextPage')?.addEventListener('click', () => {
        const sel = document.getElementById('txnPage');
        if (sel && parseInt(sel.value) < totalPages) {
          sel.value = parseInt(sel.value) + 1;
          renderTransactions();
        }
      });
      document.getElementById('txnPage')?.addEventListener('change', renderTransactions);
      
      document.getElementById('transactionsBody').innerHTML = pageTxns.map(t => {
        // Determine amount color: gray for payments, green for credits, red for charges
        let amountColor = '#b91c1c'; // red for charges
        let amountWeight = '500';
        if (t.isPayment) {
          amountColor = '#9ca3af'; // gray for payments
          amountWeight = '400';
        } else if (t.isCredit) {
          amountColor = '#059669'; // green for credits/refunds
          amountWeight = '600';
        }
        
        // Determine points display
        let pointsDisplay = '—';
        let pointsColor = '#1c1917';
        if (t.isPayment) {
          pointsDisplay = '—';
        } else if (t.isRefund || (t.isCredit && t.creditMatch)) {
          // Both refunds and statement credits show negative points
          pointsDisplay = formatNumber(t.points); // Will be negative
          pointsColor = '#dc2626'; // red for negative points
        } else if (!t.isCredit) {
          pointsDisplay = formatNumber(t.points);
        }
        
        // Multiplier display
        let multiDisplay = '—';
        if (!t.isCredit && !t.isPayment) {
          multiDisplay = t.multiplier + 'x';
        } else if (t.isRefund || (t.isCredit && t.creditMatch)) {
          // Show negative multiplier for refunds and credits
          multiDisplay = '-' + t.multiplier + 'x';
        }
        
        // Get badge style and tooltip
        const badgeInfo = getCategoryBadgeStyle(t, true);
        
        return `<tr style="${t.isPayment ? 'opacity:0.6;' : ''}">
        <td style="white-space:nowrap;font-size:12px;">${escapeHtml(t.date)}</td>
        <td style="max-width:180px;"><div style="font-weight:500;">${escapeHtml(t.merchant)}</div></td>
        <td style="font-size:12px;">${escapeHtml(t.cardName)}</td>
        <td>
          ${isCardEditable(t.cardId, 'category') ? `
          <span class="badge category-badge"
                data-txn-id="${escapeHtml(t.id)}" data-merchant="${escapeHtml(t.merchant)}" data-current-cat="${escapeHtml(t.category)}" data-card-id="${escapeHtml(t.cardId)}"
                style="cursor:pointer;${badgeInfo.style}" title="${escapeHtml(badgeInfo.tooltip)} — Click to change">
            ${formatCategoryDebug(t)}
          </span>
          ` : `
          <span class="badge"
                style="${badgeInfo.style}opacity:0.7;" title="${escapeHtml(badgeInfo.tooltip)}">
            ${formatCategoryDebug(t)}
          </span>
          `}
        </td>
        <td class="text-right mono" style="color:${amountColor};font-weight:${amountWeight};">${t.isCredit ? '+' : '-'}${formatCurrencyPrecise(Math.abs(t.amount))}</td>
        <td class="text-right mono">${multiDisplay}</td>
        <td class="text-right mono" style="color:${pointsColor};">${pointsDisplay}</td>
        <td style="font-size:11px;color:#78716c;max-width:180px;">
          ${!t.isPayment && t.confidence < CONFIDENCE_THRESHOLD ? '<span title="Low confidence - may need review" style="color:#b45309;">⚠️ </span>' : ''}${t.isCredit && !t.isPayment && isCardEditable(t.cardId, 'category') ? `
            <span class="credit-toggle" data-txn-id="${escapeHtml(t.id)}" data-card-id="${escapeHtml(t.cardId)}"
                  style="cursor:pointer;text-decoration:underline;color:#2563eb;">
              ${escapeHtml(t.reason)}
            </span>
          ` : escapeHtml(t.reason)}
        </td>
      </tr>`;
      }).join('');
      
      // Add click handlers for category badges
      document.querySelectorAll('.category-badge').forEach(el => {
        el.addEventListener('click', () => showCategoryModal(el.dataset.txnId, el.dataset.merchant, el.dataset.currentCat, el.dataset.cardId));
      });
      
      // Add click handlers for credit toggles
      document.querySelectorAll('.credit-toggle').forEach(el => {
        el.addEventListener('click', () => showCreditModal(el.dataset.txnId, el.dataset.cardId));
      });
    }
    
    // Check if we need to restore filters (e.g., after recategorizing)
    if (state.pendingFilterRestore) {
      const f = state.pendingFilterRestore;
      document.getElementById('filterYear').value = f.year;
      document.getElementById('filterMonth').value = f.month;
      document.getElementById('filterCard').value = f.card;
      document.getElementById('filterCategory').value = f.category;
      document.getElementById('filterCreditsOnly').checked = f.creditsOnly;
      document.getElementById('filterNeedsReview').checked = f.needsReview;
      document.getElementById('filterMerchant').value = f.merchant || '';
      document.getElementById('clearMerchantSearch').style.display = f.merchant ? 'block' : 'none';
      // Clear the pending restore
      state.pendingFilterRestore = null;
      // Re-render with restored filters
      renderTransactions();
    } else {
      renderTransactions();
    }
    
    document.getElementById('filterYear').addEventListener('change', () => {
      // Reset page when filter changes
      const pageSelect = document.getElementById('txnPage');
      if (pageSelect) pageSelect.value = '1';
      renderTransactions();
    });
    document.getElementById('filterMonth').addEventListener('change', () => {
      const pageSelect = document.getElementById('txnPage');
      if (pageSelect) pageSelect.value = '1';
      renderTransactions();
    });
    document.getElementById('filterCard').addEventListener('change', () => {
      const pageSelect = document.getElementById('txnPage');
      if (pageSelect) pageSelect.value = '1';
      renderTransactions();
    });
    document.getElementById('filterCategory').addEventListener('change', () => {
      const pageSelect = document.getElementById('txnPage');
      if (pageSelect) pageSelect.value = '1';
      renderTransactions();
    });
    document.getElementById('filterCreditsOnly').addEventListener('change', () => {
      const pageSelect = document.getElementById('txnPage');
      if (pageSelect) pageSelect.value = '1';
      renderTransactions();
    });
    document.getElementById('filterNeedsReview').addEventListener('change', () => {
      const pageSelect = document.getElementById('txnPage');
      if (pageSelect) pageSelect.value = '1';
      renderTransactions();
    });

    // Merchant search input handler
    const merchantInput = document.getElementById('filterMerchant');
    const clearSearchBtn = document.getElementById('clearMerchantSearch');

    merchantInput.addEventListener('input', () => {
      const pageSelect = document.getElementById('txnPage');
      if (pageSelect) pageSelect.value = '1';
      // Show/hide clear button based on input content
      clearSearchBtn.style.display = merchantInput.value ? 'block' : 'none';
      renderTransactions();
    });

    clearSearchBtn.addEventListener('click', () => {
      merchantInput.value = '';
      clearSearchBtn.style.display = 'none';
      const pageSelect = document.getElementById('txnPage');
      if (pageSelect) pageSelect.value = '1';
      renderTransactions();
    });

    // Column sort click handlers
    document.querySelectorAll('thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        const cur = state.txnSortState;
        if (cur.column === col) {
          cur.direction = cur.direction === 'asc' ? 'desc' : 'asc';
        } else {
          // Default to desc for numeric / date, asc for text
          cur.column = col;
          cur.direction = (col === 'date' || col === 'amount' || col === 'multiplier' || col === 'points') ? 'desc' : 'asc';
        }
        // Preserve current filter state across re-render
        state.pendingFilterRestore = {
          year: document.getElementById('filterYear')?.value || '',
          month: document.getElementById('filterMonth')?.value || '',
          card: document.getElementById('filterCard')?.value || '',
          category: document.getElementById('filterCategory')?.value || '',
          creditsOnly: document.getElementById('filterCreditsOnly')?.checked || false,
          needsReview: document.getElementById('filterNeedsReview')?.checked || false,
          merchant: document.getElementById('filterMerchant')?.value || ''
        };
        renderView('transactions');
      });
    });
  }
}

function showCreditModal(txnId, cardId) {
  const txn = state.results.processed.find(t => t.id === txnId);
  const card = CARDS[cardId];
  const allCredits = card?.credits || [];
  const currentOverride = state.creditOverrides[txnId];
  
  // Filter to only show credits that are NOT disabled in Card Config
  const disabledForCard = state.disabledCredits[cardId] || [];
  const credits = allCredits.filter(cr => !disabledForCard.includes(cr.name));
  
  const modal = document.getElementById('creditModal');
  const content = document.getElementById('creditModalContent');
  
  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-weight:500;">${escapeHtml(txn.merchant)}</div>
      <div style="font-size:13px;color:#78716c;">${escapeHtml(txn.date)} • +${formatCurrencyPrecise(Math.abs(txn.amount))}</div>
      <div style="font-size:12px;color:#a8a29e;margin-top:4px;">${escapeHtml(txn.original || '')}</div>
    </div>

    <div style="margin-bottom:8px;font-size:13px;font-weight:500;">What is this?</div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e7e5e4;border-radius:6px;cursor:pointer;">
        <input type="radio" name="creditType" value="refund" ${currentOverride === 'refund' || (!currentOverride && !txn.creditMatch) ? 'checked' : ''}>
        <div>
          <div style="font-weight:500;">Refund / Not a credit</div>
          <div style="font-size:12px;color:#78716c;">Don't count toward card benefits</div>
        </div>
      </label>

      ${credits.map(cr => `
        <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e7e5e4;border-radius:6px;cursor:pointer;">
          <input type="radio" name="creditType" value="${escapeHtml(cr.name)}" ${(currentOverride === cr.name) || (!currentOverride && txn.creditMatch === cr.name) ? 'checked' : ''}>
          <div>
            <div style="font-weight:500;">${escapeHtml(cr.name)}</div>
            <div style="font-size:12px;color:#78716c;">$${cr.amount} annual credit</div>
          </div>
        </label>
      `).join('')}
      
      <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e7e5e4;border-radius:6px;cursor:pointer;">
        <input type="radio" name="creditType" value="Statement Credit" ${currentOverride === 'Statement Credit' || (!currentOverride && txn.creditMatch === 'Statement Credit') ? 'checked' : ''}>
        <div>
          <div style="font-weight:500;">Other Statement Credit</div>
          <div style="font-size:12px;color:#78716c;">Count as credit but not specific benefit</div>
        </div>
      </label>
    </div>
    
    <div style="margin-top:16px;font-size:11px;color:#78716c;background:#f5f5f4;padding:10px;border-radius:6px;">
      💡 Don't see a credit you want to track? Enable it in <strong>Card Config</strong> for this card.
    </div>
    
    <div style="margin-top:16px;display:flex;gap:12px;">
      <button class="btn btn-primary" id="saveCreditOverride">Save</button>
      <button class="btn btn-secondary" id="cancelCreditOverride">Cancel</button>
    </div>
  `;
  
  modal.classList.remove('hidden');
  
  document.getElementById('saveCreditOverride').addEventListener('click', async () => {
    const selected = document.querySelector('input[name="creditType"]:checked')?.value;
    if (selected) {
      state.creditOverrides[txnId] = selected;
      safeLocalStorageSet('ccTracker_creditOverrides', state.creditOverrides);
      modal.classList.add('hidden');
      // Reprocess to update totals
      await runProcessing();
      // Stay on transactions page
      renderView('transactions');
    }
  });
  
  document.getElementById('cancelCreditOverride').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
}

function showCategoryModal(txnId, merchant, currentCategory, cardId) {
  const modal = document.getElementById('creditModal');
  const content = document.getElementById('creditModalContent');
  const norm = normalize(merchant).substring(0, 50);
  // Card-specific rule key takes precedence over global rule
  const cardSpecificKey = `${cardId}:${norm}`;
  const hasCardRule = state.merchantRules[cardSpecificKey];
  const hasGlobalRule = state.merchantRules[norm];
  const hasRule = hasCardRule || hasGlobalRule;
  const activeRuleKey = hasCardRule ? cardSpecificKey : (hasGlobalRule ? norm : null);
  const hasConfirmed = state.confirmedTransactions[txnId];
  
  // Get only the valid categories for this card
  const txn = state.results?.processed.find(t => t.id === txnId);
  let validCategories = getCardCategories(cardId, txn?.date);
  const card = CARDS[cardId];
  
  // For CFF and Cash+, ONLY show the currently selected quarterly categories + base categories + other
  // (Don't show all possible selectable categories - only the ones user has actually selected)
  
  // Always ensure current category is in the list
  if (currentCategory && !validCategories.includes(currentCategory)) {
    validCategories.push(currentCategory);
  }
  
  // Get the quarter from the transaction date (for quarterly category cards)
  function getQuarterFromDate(dateStr) {
    let month;
    if (dateStr?.includes('-')) {
      month = parseInt(dateStr.split('-')[1]);
    } else if (dateStr?.includes('/')) {
      month = parseInt(dateStr.split('/')[0]);
    } else {
      month = new Date().getMonth() + 1;
    }
    return `Q${Math.ceil(month / 3)}`;
  }
  
  const txnQuarter = txn ? getQuarterFromDate(txn.date) : getCurrentQuarter();
  const txnYear = txn && txn.date ? (txn.date.includes('-') ? parseInt(txn.date.split('-')[0]) : parseInt(txn.date.split('/')[2])) : new Date().getFullYear();
  const cffQuarterKey = `${txnYear}-${txnQuarter}`;
  const cffEntries = (window.CardTracker.cffQuarterlyData || {})[cffQuarterKey] || [];
  const cashPlusSelected = state.cashPlusCategories[txnQuarter] || { fivePercent: [], twoPercent: '' };

  function getDisplayRate(cat) {
    if (cardId === 'chase-freedom-flex') {
      // Check stored quarterly bonus categories first
      const entry = cffEntries.find(e => e.key === cat);
      if (entry) return { rate: entry.rate, bonus: true };
      if (card.multipliers[cat]) return { rate: card.multipliers[cat], bonus: true };
      return { rate: card.baseRate, bonus: false };
    }
    if (cardId === 'us-bank-cash-plus') {
      if (cashPlusSelected.fivePercent?.includes(cat)) return { rate: 5, bonus: true };
      if (cashPlusSelected.twoPercent === cat) return { rate: 2, bonus: true };
      return { rate: 1, bonus: false };
    }
    // Bilt cards: check for legacy mode (before Feb 7, 2026)
    if (card?.isBilt) {
      const bilt2StartDate = new Date(2026, 1, 7); // Feb 7, 2026
      let txnDateObj;
      if (txn?.date) {
        if (txn.date.includes('-')) {
          const [year, month, day] = txn.date.split('-').map(Number);
          txnDateObj = new Date(year, month - 1, day);
        } else if (txn.date.includes('/')) {
          const parts = txn.date.split('/');
          const month = parseInt(parts[0]);
          const day = parseInt(parts[1]);
          let year = parseInt(parts[2]);
          if (year < 100) year += 2000;
          txnDateObj = new Date(year, month - 1, day);
        } else {
          txnDateObj = new Date(txn.date);
        }
      } else {
        txnDateObj = new Date();
      }
      const isLegacy = txnDateObj < bilt2StartDate;

      if (isLegacy) {
        // Legacy Bilt: 3x dining, 2x travel, 1x everything else (including rent)
        if (cat === 'rent') return { rate: 1, bonus: false };
        const legacyMult = card.legacy?.multipliers?.[cat];
        return { rate: legacyMult || card.legacy?.baseRate || 1, bonus: !!legacyMult };
      } else {
        // Bilt 2.0: rent has variable "up to" rate
        if (cat === 'rent') {
          const cfg = state.biltConfig[cardId] || {};
          if (cfg.rewardOption === 'housing-only') {
            return { rate: 'up to 1.25', bonus: true, isVariable: true };
          } else {
            return { rate: 'up to 1', bonus: true, isVariable: true };
          }
        }
        // Bilt 2.0: use current multipliers/baseRate
        const mult = card?.multipliers?.[cat];
        return { rate: mult || card?.baseRate || 1, bonus: !!mult };
      }
    }
    // CSR legacy mode (before Oct 26, 2025)
    if (cardId === 'chase-sapphire-reserve' && card.legacyCutoffDate) {
      let txnDateObj;
      if (txn?.date) {
        if (txn.date.includes('-')) {
          const [year, month, day] = txn.date.split('-').map(Number);
          txnDateObj = new Date(year, month - 1, day);
        } else if (txn.date.includes('/')) {
          const parts = txn.date.split('/');
          const month = parseInt(parts[0]);
          const day = parseInt(parts[1]);
          let year = parseInt(parts[2]);
          if (year < 100) year += 2000;
          txnDateObj = new Date(year, month - 1, day);
        } else {
          txnDateObj = new Date(txn.date);
        }
      } else {
        txnDateObj = new Date();
      }
      const cutoffParts = card.legacyCutoffDate.split('-').map(Number);
      const cutoffDate = new Date(cutoffParts[0], cutoffParts[1] - 1, cutoffParts[2]);
      const isLegacy = txnDateObj < cutoffDate;

      if (isLegacy) {
        // CSR Legacy: 10x chase-travel, 3x travel, 3x dining, 10x lyft, 1x base
        const legacyMult = card.legacy?.multipliers?.[cat];
        return { rate: legacyMult || card.legacy?.baseRate || 1, bonus: !!legacyMult };
      }
    }
    const mult = card?.multipliers?.[cat];
    return { rate: mult || card?.baseRate || 1, bonus: !!mult };
  }
  
  // Check if this is a low-confidence transaction
  const isLowConfidence = txn && txn.confidence < CONFIDENCE_THRESHOLD;
  
  // For Freedom Flex, filter to only show base + selected quarterly categories for this transaction's quarter
  if (cardId === 'chase-freedom-flex') {
    const baseCats = ['chase-travel', 'dining', 'drugstore'];
    const allowedCats = [...new Set([...baseCats, ...cffSelected, 'other'])];
    // Also include current category if not in list
    if (currentCategory && !allowedCats.includes(currentCategory)) {
      allowedCats.push(currentCategory);
    }
    validCategories = validCategories.filter(c => allowedCats.includes(c));
  }
  
  // For Cash+, filter to only show selected categories for this transaction's quarter
  if (cardId === 'us-bank-cash-plus') {
    const allowedCats = [...(cashPlusSelected.fivePercent || [])];
    if (cashPlusSelected.twoPercent) allowedCats.push(cashPlusSelected.twoPercent);
    allowedCats.push('other');
    // Also include current category if not in list
    if (currentCategory && !allowedCats.includes(currentCategory)) {
      allowedCats.push(currentCategory);
    }
    validCategories = validCategories.filter(c => allowedCats.includes(c));
  }
  
  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-weight:500;">${escapeHtml(merchant)}</div>
      <div style="font-size:13px;color:#78716c;">Card: ${escapeHtml(card?.shortName || cardId)} • Current: ${escapeHtml(currentCategory)}</div>
      ${hasRule ? '<div style="font-size:12px;color:#059669;margin-top:4px;">✓ Has saved rule (applies to all similar merchants)</div>' : ''}
      ${hasConfirmed && !hasRule ? '<div style="font-size:12px;color:#059669;margin-top:4px;">✓ Confirmed for this transaction only</div>' : ''}
      ${isLowConfidence && !hasRule && !hasConfirmed ? '<div style="font-size:12px;color:#b45309;margin-top:4px;">⚠️ Low confidence — click Save to confirm</div>' : ''}
    </div>

    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:500;display:block;margin-bottom:6px;">Change category to:</label>
      <div style="display:grid;gap:6px;max-height:300px;overflow-y:auto;">
        ${validCategories.map(cat => {
          const { rate, bonus, isVariable } = getDisplayRate(cat);
          const isSelected = cat === currentCategory;
          const rateDisplay = isVariable ? rate : `${rate}x`;
          return `
            <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid ${isSelected ? '#1c1917' : '#e7e5e4'};border-radius:6px;cursor:pointer;background:${isSelected ? '#f5f5f4' : '#fff'};">
              <input type="radio" name="newCategory" value="${escapeHtml(cat)}" ${isSelected ? 'checked' : ''}>
              <span style="flex:1;font-size:13px;">${escapeHtml(cat)}</span>
              <span style="font-size:12px;font-weight:600;color:${bonus ? '#059669' : '#78716c'};">${rateDisplay}</span>
            </label>
          `;
        }).join('')}
      </div>
    </div>

    <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
      <input type="checkbox" id="saveAsRule" ${hasRule ? 'checked' : ''}>
      <span style="font-size:13px;">Apply to all "${escapeHtml(merchant.substring(0, 25))}${merchant.length > 25 ? '...' : ''}" on ${escapeHtml(card?.shortName || 'this card')}</span>
    </label>
    ${(isLowConfidence || hasConfirmed) && !hasRule ? '<div style="font-size:11px;color:#78716c;margin-bottom:16px;margin-left:24px;">Uncheck to confirm only this transaction</div>' : '<div style="margin-bottom:16px;"></div>'}
    
    <div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;">
      <button class="btn btn-primary" id="saveCategoryChange">Save</button>
      <button class="btn btn-secondary" id="cancelCategoryChange">Cancel</button>
      ${hasRule ? '<button class="btn btn-secondary" id="deleteRule" style="color:#dc2626;">Delete Rule</button>' : ''}
      ${hasConfirmed && !hasRule ? '<button class="btn btn-secondary" id="deleteConfirmation" style="color:#dc2626;">Remove Confirmation</button>' : ''}
    </div>
  `;
  
  modal.classList.remove('hidden');
  
  document.getElementById('saveCategoryChange').addEventListener('click', async () => {
    const newCategory = document.querySelector('input[name="newCategory"]:checked')?.value;
    const saveAsRule = document.getElementById('saveAsRule').checked;
    
    if (newCategory) {
      if (saveAsRule) {
        // Save as card-specific merchant rule (applies to this merchant on this card only)
        state.merchantRules[cardSpecificKey] = newCategory;
        safeLocalStorageSet('ccTracker_merchantRules', state.merchantRules);
        // Remove any single-txn confirmation since rule takes precedence
        delete state.confirmedTransactions[txnId];
        safeLocalStorageSet('ccTracker_confirmedTxns', state.confirmedTransactions);
      } else {
        // Save as single-transaction confirmation only
        state.confirmedTransactions[txnId] = newCategory;
        safeLocalStorageSet('ccTracker_confirmedTxns', state.confirmedTransactions);
      }
    }
    
    // Capture current filter state before re-rendering
    const filterState = {
      year: document.getElementById('filterYear')?.value || '',
      month: document.getElementById('filterMonth')?.value || '',
      card: document.getElementById('filterCard')?.value || '',
      category: document.getElementById('filterCategory')?.value || '',
      creditsOnly: document.getElementById('filterCreditsOnly')?.checked || false,
      needsReview: document.getElementById('filterNeedsReview')?.checked || false,
      merchant: document.getElementById('filterMerchant')?.value || '',
      page: document.getElementById('txnPage')?.value || '1'
    };

    // Store filter state globally so renderView can use it
    state.pendingFilterRestore = filterState;
    
    modal.classList.add('hidden');
    await runProcessing();
    renderView('transactions');
  });
  
  document.getElementById('cancelCategoryChange').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  
  if (hasRule) {
    document.getElementById('deleteRule').addEventListener('click', async () => {
      // Capture current filter state before re-rendering
      const filterState = {
        year: document.getElementById('filterYear')?.value || '',
        month: document.getElementById('filterMonth')?.value || '',
        card: document.getElementById('filterCard')?.value || '',
        category: document.getElementById('filterCategory')?.value || '',
        creditsOnly: document.getElementById('filterCreditsOnly')?.checked || false,
        needsReview: document.getElementById('filterNeedsReview')?.checked || false,
        merchant: document.getElementById('filterMerchant')?.value || '',
        page: document.getElementById('txnPage')?.value || '1'
      };

      // Store filter state globally so renderView can use it
      state.pendingFilterRestore = filterState;

      // Delete the active rule (card-specific or global)
      if (activeRuleKey) {
        delete state.merchantRules[activeRuleKey];
        safeLocalStorageSet('ccTracker_merchantRules', state.merchantRules);
      }
      modal.classList.add('hidden');
      await runProcessing();
      renderView('transactions');
    });
  }
  
  if (hasConfirmed && !hasRule) {
    document.getElementById('deleteConfirmation').addEventListener('click', async () => {
      // Capture current filter state before re-rendering
      const filterState = {
        year: document.getElementById('filterYear')?.value || '',
        month: document.getElementById('filterMonth')?.value || '',
        card: document.getElementById('filterCard')?.value || '',
        category: document.getElementById('filterCategory')?.value || '',
        creditsOnly: document.getElementById('filterCreditsOnly')?.checked || false,
        needsReview: document.getElementById('filterNeedsReview')?.checked || false,
        merchant: document.getElementById('filterMerchant')?.value || '',
        page: document.getElementById('txnPage')?.value || '1'
      };

      // Store filter state globally so renderView can use it
      state.pendingFilterRestore = filterState;

      delete state.confirmedTransactions[txnId];
      safeLocalStorageSet('ccTracker_confirmedTxns', state.confirmedTransactions);
      modal.classList.add('hidden');
      await runProcessing();
      renderView('transactions');
    });
  }
}

// Build complete export data object
function buildExportData() {
  // Include processed transactions with subcategory and category to match table display
  const processedTransactions = (state.results?.processed || []).map(t => ({
    id: t.id,
    date: t.date,
    merchant: t.merchant,
    account: t.account,
    amount: t.amount,
    cardName: t.cardName,
    subcategory: t.subcategory || 'other',
    category: t.category || 'other',
    categorySource: t.categorySource,
    confidence: t.confidence,
    classificationReason: t.classificationReason || '',
    multiplier: t.multiplier,
    points: t.points,
    pointsValue: t.pointsValue,
    isPayment: t.isPayment,
    isCredit: t.isCredit,
    isRefund: t.isRefund
  }));

  return {
    version: '1.1',
    exportedAt: new Date().toISOString(),
    appName: 'Credit Card ROI Tracker',
    transactions: state.savedTransactions,
    processedTransactions: processedTransactions,
    cardMappings: state.cardMappings,
    customPointValues: state.customPointValues,
    creditOverrides: state.creditOverrides,
    disabledCredits: state.disabledCredits,
    monthlyCredits: state.monthlyCredits,
    merchantRules: state.merchantRules,
    confirmedTransactions: state.confirmedTransactions,
    cashPlusCategories: state.cashPlusCategories,
    cffCategories: state.cffCategories,
    biltConfig: state.biltConfig,
    columnMappings: state.columnMappings,
    customAnnualBonusPoints: state.customAnnualBonusPoints
  };
}

// Export transactions as CSV
function exportAsCSV() {
  // Use processed transactions which have proper subcategory and category
  const transactions = state.results?.processed || [];
  if (transactions.length === 0) {
    alert('No transactions to export.');
    return;
  }

  // Build CSV header - include both Subcategory and Card Category to match table display
  const headers = ['Date', 'Merchant', 'Account', 'Amount', 'Card', 'Subcategory', 'Card Category', 'Multiplier', 'Points Earned', 'Confidence', 'Reason'];

  // Sanitize a CSV cell to prevent formula injection in spreadsheet apps
  function sanitizeCSVCell(val) {
    const str = String(val ?? '');
    if (/^[=+\-@\t\r]/.test(str)) return "'" + str;
    return str;
  }

  // Wrap and escape a string CSV field (quote + double internal quotes + sanitize)
  function csvString(val) {
    const s = sanitizeCSVCell(val);
    return `"${s.replace(/"/g, '""')}"`;
  }

  // Build CSV rows using processed transaction data
  const rows = transactions.map(t => {
    // Use the already-computed values from processTransactions
    const subcategory = t.subcategory || 'other';
    const cardCategory = t.category || 'other';
    const multiplier = t.multiplier || 1;
    const pointsEarned = Math.round(t.points || 0);
    const confidence = t.confidence || 0;

    return [
      csvString(t.date),
      csvString(t.merchant || ''),
      csvString(t.account || ''),
      t.amount,
      csvString(t.cardName || 'Unknown'),
      csvString(subcategory),
      csvString(cardCategory),
      multiplier,
      t.isPayment ? 0 : pointsEarned,
      confidence,
      csvString(t.classificationReason || '')
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credit-card-transactions-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export full backup as JSON
function exportAsJSON() {
  const data = buildExportData();
  
  if (data.transactions.length === 0) {
    alert('No data to export.');
    return;
  }
  
  const json = JSON.stringify(data, null, 2);
  
  // Download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credit-card-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Update stored transaction count display
function updateStoredTxnCount() {
  // This function is now simplified since we don't have a separate data management section
  // Just update state.availableYears for use elsewhere
  if (state.savedTransactions.length > 0) {
    state.availableYears = [...new Set(state.savedTransactions.map(t => getYearFromDateString(t.date)))].sort((a, b) => b - a);
  } else {
    state.availableYears = [];
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================
async function handleFile(file) {
  if (!file) return;
  
  // Reset file inputs so the same file can be selected again
  document.getElementById('fileInput').value = '';
  document.getElementById('newFileInput').value = '';
  
  // Check if it's a JSON backup file
  if (file.name.endsWith('.json')) {
    showLoading(true, 'Restoring backup...');
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Validate it's a backup file
      if (!backup.version || !backup.exportedAt) {
        showLoading(false);
        alert('This doesn\'t appear to be a valid backup file. Please use a JSON file exported from this app.');
        return;
      }

      // Validate backup data structure to prevent malicious imports
      const validationErrors = [];
      if (backup.transactions && !Array.isArray(backup.transactions)) {
        validationErrors.push('transactions must be an array');
      }
      if (backup.transactions) {
        for (let i = 0; i < Math.min(backup.transactions.length, 10); i++) {
          const txn = backup.transactions[i];
          if (typeof txn !== 'object' || txn === null) {
            validationErrors.push(`transaction[${i}] is not an object`);
            break;
          }
          if (txn.amount !== undefined && typeof txn.amount !== 'number') {
            validationErrors.push(`transaction[${i}].amount must be a number`);
            break;
          }
        }
      }
      // Validate object types for settings
      const objectFields = ['cardMappings', 'customPointValues', 'creditOverrides',
                           'disabledCredits', 'monthlyCredits', 'merchantRules',
                           'confirmedTransactions', 'cashPlusCategories', 'cffCategories',
                           'biltConfig', 'columnMappings'];
      for (const field of objectFields) {
        if (backup[field] && (typeof backup[field] !== 'object' || Array.isArray(backup[field]))) {
          validationErrors.push(`${field} must be an object`);
        }
      }
      if (validationErrors.length > 0) {
        showLoading(false);
        alert('Invalid backup file structure:\\n' + validationErrors.slice(0, 3).join('\\n'));
        return;
      }

      // Confirm restore
      const txnCount = backup.transactions?.length || 0;
      if (!confirm(`This will restore ${txnCount} transactions and all settings from your backup.\n\nThis will REPLACE your current data. Continue?`)) {
        showLoading(false);
        return;
      }
      
      // Restore all state using safe localStorage operations
      if (backup.transactions) {
        state.savedTransactions = backup.transactions;
        state.transactions = backup.transactions;
        safeLocalStorageSet('ccTracker_transactions', backup.transactions);
      }
      if (backup.cardMappings) {
        state.cardMappings = backup.cardMappings;
        safeLocalStorageSet('ccTracker_cardMappings', backup.cardMappings);
      }
      if (backup.customPointValues) {
        state.customPointValues = backup.customPointValues;
        safeLocalStorageSet('ccTracker_pointValues', backup.customPointValues);
      }
      if (backup.creditOverrides) {
        state.creditOverrides = backup.creditOverrides;
        safeLocalStorageSet('ccTracker_creditOverrides', backup.creditOverrides);
      }
      if (backup.disabledCredits) {
        state.disabledCredits = backup.disabledCredits;
        safeLocalStorageSet('ccTracker_disabledCredits', backup.disabledCredits);
      }
      if (backup.monthlyCredits) {
        state.monthlyCredits = backup.monthlyCredits;
        safeLocalStorageSet('ccTracker_monthlyCredits', backup.monthlyCredits);
      }
      if (backup.merchantRules) {
        state.merchantRules = backup.merchantRules;
        safeLocalStorageSet('ccTracker_merchantRules', backup.merchantRules);
      }
      if (backup.confirmedTransactions) {
        state.confirmedTransactions = backup.confirmedTransactions;
        safeLocalStorageSet('ccTracker_confirmedTxns', backup.confirmedTransactions);
      }
      if (backup.cashPlusCategories) {
        state.cashPlusCategories = backup.cashPlusCategories;
        safeLocalStorageSet('ccTracker_cashPlusCategories', backup.cashPlusCategories);
      }
      if (backup.cffCategories) {
        state.cffCategories = backup.cffCategories;
        safeLocalStorageSet('ccTracker_cffCategories', backup.cffCategories);
      }
      if (backup.biltConfig) {
        state.biltConfig = backup.biltConfig;
        safeLocalStorageSet('ccTracker_biltConfig', backup.biltConfig);
      }
      if (backup.columnMappings) {
        state.columnMappings = backup.columnMappings;
        safeLocalStorageSet('ccTracker_columnMappings', backup.columnMappings);
      }
      if (backup.customAnnualBonusPoints) {
        state.customAnnualBonusPoints = backup.customAnnualBonusPoints;
        safeLocalStorageSet('ccTracker_annualBonusPoints', backup.customAnnualBonusPoints);
      }

      showLoading(false);
      updateStoredTxnCount();

      // Mark tour as complete since this is a returning user
      state.tourComplete = true;
      safeLocalStorageSet('ccTracker_tourComplete', true);
      
      alert(`Backup restored successfully!\n\n${txnCount} transactions and all settings have been restored.`);
      
      // Run processing
      if (state.transactions.length > 0) {
        await runProcessing();
      }
      
    } catch (e) {
      showLoading(false);
      console.error('Backup restore error:', e);
      alert('Error reading backup file. Please ensure it is a valid JSON backup exported from this app.');
    }
    return;
  }
  
  // Handle CSV file
  showLoading(true, 'Reading CSV...');
  const text = await file.text();
  showLoading(false);
  
  // Show column mapping UI instead of parsing directly
  showColumnMapping(text);
}

// Called after user confirms column mapping
async function processAfterColumnMapping() {
  showLoading(true, 'Parsing CSV...');
  
  const newTransactions = applyColumnMappingAndParse();
  
  // Migrate existing transactions if they have old-style IDs (txn-N format)
  // This ensures proper deduplication with the new content-based IDs
  state.savedTransactions = state.savedTransactions.map(t => {
    if (t.id && t.id.startsWith('txn-')) {
      // Regenerate ID using unified ID generation
      const newId = generateBaseTransactionId(t.date, t.merchant, t.amount, t.last4);
      return { ...t, id: newId };
    }
    return t;
  });
  
  // Merge with existing transactions (dedupe by ID)
  const existingIds = new Set(state.savedTransactions.map(t => t.id));
  const uniqueNew = newTransactions.filter(t => !existingIds.has(t.id));
  
  // Combine: new unique + existing
  state.transactions = [...uniqueNew, ...state.savedTransactions];
  
  // Sort by date descending
  state.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Save merged transactions to localStorage
  state.savedTransactions = state.transactions;
  safeLocalStorageSet('ccTracker_transactions', state.transactions);
  
  // Update the stored count display
  if (typeof updateStoredTxnCount === 'function') updateStoredTxnCount();
  
  // Show merge summary
  const addedCount = uniqueNew.length;
  const totalCount = state.transactions.length;
  
  const allLast4s = [...new Set(state.transactions.map(t => t.last4).filter(Boolean))];
  const unmapped = allLast4s.filter(l4 => !state.cardMappings[l4]);
  
  showLoading(false);
  
  // Hide column mapping section
  document.getElementById('columnMappingSection').classList.add('hidden');
  
  if (unmapped.length > 0) {
    showMapping(allLast4s);
  } else {
    await runProcessing(true); // true = this is a new upload
  }
}

async function runProcessing(isNewUpload = false) {
  if (state.transactions.length === 0) return;
  
  showLoading(true, 'Processing transactions...');
  try {
    const results = await processTransactions(state.transactions);
    showLoading(false);
    showResults(results, isNewUpload);
    
    // Continue tour if active
    if (state.tourActive) {
      const currentStep = TOUR_STEPS[state.tourStep];
      if (currentStep?.type === 'wait-for-upload' || currentStep?.type === 'wait-for-mapping') {
        // Advance past wait steps
        while (TOUR_STEPS[state.tourStep]?.type === 'wait-for-upload' || 
               TOUR_STEPS[state.tourStep]?.type === 'wait-for-mapping') {
          state.tourStep++;
        }
        // Small delay to let the UI render, then continue tour
        setTimeout(() => renderTourStep(), 500);
      }
    }
  } catch (e) {
    showLoading(false);
    alert('Error: ' + e.message);
  }
}

// Help, tour, and guidance functions are now in tutorial.js

// =============================================================================
// INIT
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Prevent clicks inside modals from closing the overlay
  document.querySelectorAll('.loading-modal').forEach(el => {
    el.addEventListener('click', e => e.stopPropagation());
  });

  // Dismiss guidance button
  document.getElementById('dismissMappingGuidance').addEventListener('click', () => dismissGuidance('mappingSection'));

  // Export option hover effects
  const exportCSV = document.getElementById('exportCSV');
  exportCSV.addEventListener('mouseover', () => { exportCSV.style.borderColor = '#3b82f6'; exportCSV.style.background = '#eff6ff'; });
  exportCSV.addEventListener('mouseout', () => { exportCSV.style.borderColor = '#e7e5e4'; exportCSV.style.background = 'white'; });
  const exportJSON = document.getElementById('exportJSON');
  exportJSON.addEventListener('mouseover', () => { exportJSON.style.borderColor = '#10b981'; exportJSON.style.background = '#ecfdf5'; });
  exportJSON.addEventListener('mouseout', () => { exportJSON.style.borderColor = '#e7e5e4'; exportJSON.style.background = 'white'; });

  document.getElementById('fileInput').addEventListener('change', e => handleFile(e.target.files[0]));
  document.getElementById('newFileInput').addEventListener('change', e => handleFile(e.target.files[0]));
  
  const zone = document.getElementById('uploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = '#1c1917'; });
  zone.addEventListener('dragleave', () => zone.style.borderColor = '#d6d3d1');
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = '#d6d3d1'; handleFile(e.dataTransfer.files[0]); });
  
  // Column mapping buttons
  document.getElementById('confirmColumnsBtn').addEventListener('click', processAfterColumnMapping);
  document.getElementById('cancelColumnsBtn').addEventListener('click', () => {
    document.getElementById('columnMappingSection').classList.add('hidden');
    state.pendingCSVData = null;
    // Reset file inputs so the same file can be re-selected
    document.getElementById('fileInput').value = '';
    document.getElementById('newFileInput').value = '';
    if (state.savedTransactions.length > 0 && state.results) {
      document.getElementById('resultsSection').classList.remove('hidden');
    } else {
      document.getElementById('uploadSection').classList.remove('hidden');
    }
  });
  
  document.getElementById('processBtn').addEventListener('click', () => runProcessing(true));
  document.getElementById('configBtn').addEventListener('click', () => {
    const allLast4s = [...new Set(state.transactions.map(t => t.last4).filter(Boolean))];
    showMapping(allLast4s);
  });
  
  // Manage Data dropdown - declare early so clear handlers can use it
  const manageDataBtn = document.getElementById('manageDataBtn');
  const manageDataDropdown = document.getElementById('manageDataDropdown');
  
  // Clear all transactions button
  document.getElementById('clearAllTxns').addEventListener('click', () => {
    manageDataDropdown.classList.add('hidden');
    if (confirm('Are you sure you want to delete ALL stored transactions? This cannot be undone.')) {
      state.transactions = [];
      state.savedTransactions = [];
      state.results = null;
      state.detectedAnnualFees = {}; // Clear detected fees
      localStorage.removeItem('ccTracker_transactions');
      updateStoredTxnCount();
      document.getElementById('resultsSection').classList.add('hidden');
      document.getElementById('uploadSection').classList.remove('hidden');
      // Reset file inputs so the same file can be re-uploaded
      document.getElementById('fileInput').value = '';
      document.getElementById('newFileInput').value = '';
      // Reset tour so it shows again for fresh start
      state.tourComplete = false;
      state.tourStep = 0;
      localStorage.removeItem('ccTracker_tourComplete');
      localStorage.removeItem('ccTracker_tourStep');
      // Start the tour
      startTour();
    }
  });
  
  // Clear by year button
  document.getElementById('clearByYear').addEventListener('click', () => {
    manageDataDropdown.classList.add('hidden');
    // Get available years
    const years = [...new Set(state.savedTransactions.map(t => getYearFromDateString(t.date)))].sort((a, b) => b - a);
    
    if (years.length === 0) {
      alert('No transactions to delete.');
      return;
    }
    
    const yearToDelete = prompt(`Enter year to delete (available: ${years.join(', ')}):`);
    if (!yearToDelete) return;
    
    const year = parseInt(yearToDelete);
    if (!years.includes(year)) {
      alert(`Year ${yearToDelete} not found in transactions.`);
      return;
    }
    
    if (confirm(`Are you sure you want to delete all transactions from ${year}? This cannot be undone.`)) {
      const beforeCount = state.savedTransactions.length;
      state.savedTransactions = state.savedTransactions.filter(t => getYearFromDateString(t.date) !== year);
      state.transactions = state.savedTransactions;
      safeLocalStorageSet('ccTracker_transactions', state.savedTransactions);

      // Clear detected annual fees for the deleted year
      for (const cardId of Object.keys(state.detectedAnnualFees)) {
        if (state.detectedAnnualFees[cardId][year]) {
          delete state.detectedAnnualFees[cardId][year];
        }
      }
      
      const deleted = beforeCount - state.savedTransactions.length;
      alert(`Deleted ${deleted} transactions from ${year}.`);
      updateStoredTxnCount();
      
      if (state.savedTransactions.length > 0) {
        runProcessing();
      } else {
        state.results = null;
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('uploadSection').classList.remove('hidden');
        // Reset file inputs so the same file can be re-uploaded
        document.getElementById('fileInput').value = '';
        document.getElementById('newFileInput').value = '';
        // Reset tour so it shows again for fresh start
        state.tourComplete = false;
        state.tourStep = 0;
        localStorage.removeItem('ccTracker_tourComplete');
        localStorage.removeItem('ccTracker_tourStep');
        // Start the tour
        startTour();
      }
    }
  });
  
  // Clear all settings button
  document.getElementById('clearAllSettings').addEventListener('click', () => {
    manageDataDropdown.classList.add('hidden');
    if (confirm('Are you sure you want to clear all settings (card mappings, point values, category selections, credit claims)? Transactions will be kept.')) {
      state.cardMappings = {};
      state.customPointValues = {};
      state.creditOverrides = {};
      state.disabledCredits = {};
      state.monthlyCredits = {};
      state.merchantRules = {};
      state.merchantCache = {};
      state.confirmedTransactions = {};
      state.cashPlusCategories = {};
      state.cffCategories = {};
      state.cffPaypalDecemberOnly = {};
      state.biltConfig = {};
      state.customAnnualBonusPoints = {};
      state.columnMappings = {};
      state.cardYearToggles = {};

      localStorage.removeItem('ccTracker_cardMappings');
      localStorage.removeItem('ccTracker_pointValues');
      localStorage.removeItem('ccTracker_creditOverrides');
      localStorage.removeItem('ccTracker_disabledCredits');
      localStorage.removeItem('ccTracker_monthlyCredits');
      localStorage.removeItem('ccTracker_merchantRules');
      localStorage.removeItem('ccTracker_merchantCache');
      localStorage.removeItem('ccTracker_confirmedTxns');
      localStorage.removeItem('ccTracker_cashPlusCategories');
      localStorage.removeItem('ccTracker_cffCategories');
      localStorage.removeItem('ccTracker_cffPaypalDecemberOnly');
      localStorage.removeItem('ccTracker_biltConfig');
      localStorage.removeItem('ccTracker_annualBonusPoints');
      localStorage.removeItem('ccTracker_columnMappings');
      localStorage.removeItem('ccTracker_cardYearToggles');

      alert('All settings cleared. You will need to re-map your cards.');
      
      if (state.transactions.length > 0) {
        const allLast4s = [...new Set(state.transactions.map(t => t.last4).filter(Boolean))];
        showMapping(allLast4s);
      }
    }
  });
  
  // Clear everything button
  document.getElementById('clearEverything').addEventListener('click', () => {
    manageDataDropdown.classList.add('hidden');
    if (confirm('⚠️ This will delete ALL data including transactions, settings, and card mappings. Are you absolutely sure?')) {
      if (confirm('This action CANNOT be undone. Type "DELETE" in the next prompt to confirm.')) {
        const confirmation = prompt('Type DELETE to confirm:');
        if (confirmation === 'DELETE') {
          // Clear all state
          state.cardMappings = {};
          state.merchantCache = {};
          state.customPointValues = {};
          state.creditOverrides = {};
          state.disabledCredits = {};
          state.monthlyCredits = {};
          state.merchantRules = {};
          state.confirmedTransactions = {};
          state.cashPlusCategories = {};
          state.cffCategories = {};
          state.biltConfig = {};
          state.customAnnualBonusPoints = {};
          state.columnMappings = {};
          state.savedTransactions = [];
          state.transactions = [];
          state.results = null;
          state.detectedAnnualFees = {};
          state.dpBannersDismissed = {};

          // Clear all localStorage EXCEPT tier access keys
          const tierKeys = ['ccTracker_decisionPasses', 'ccTracker_proAccess'];
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ccTracker_') && !tierKeys.includes(key)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));

          alert('All data has been deleted. Your upgrade access has been preserved.');
          updateStoredTxnCount();
          document.getElementById('resultsSection').classList.add('hidden');
          document.getElementById('uploadSection').classList.remove('hidden');
          // Reset file inputs
          document.getElementById('fileInput').value = '';
          document.getElementById('newFileInput').value = '';
          // Reset tour state in memory and start tour
          state.tourComplete = false;
          state.tourStep = 0;
          state.tourActive = false;
          state.featureEducation = {};
          startTour();
        } else if (confirmation === 'SWITCH') {
          // Secret dev tool: switch versions without clearing data
          const versionChoice = prompt('Switch to which version?\n\n1 = Base (app.html - free)\n2 = Decision Pass (app.html with Decision Pass)\n3 = Pro (app-pro.html)\n\nEnter 1, 2, or 3:');

          // Clear tier keys first
          localStorage.removeItem('ccTracker_decisionPasses');
          localStorage.removeItem('ccTracker_proAccess');

          if (versionChoice === '2') {
            // Set up Decision Pass access
            const testDP = {
              key: 'TESTDP-SWITCH',
              cardId: 'chase-sapphire-reserve',
              activatedAt: Date.now()
            };
            state.decisionPasses = [testDP];
            state.proAccess = null;
            localStorage.setItem('ccTracker_decisionPasses', JSON.stringify([testDP]));
            alert('Switched to Decision Pass. Reloading...');
            window.location.reload();
          } else if (versionChoice === '3') {
            // Set up Pro access
            const testPro = {
              key: 'TESTPRO-SWITCH',
              activatedAt: Date.now()
            };
            state.proAccess = testPro;
            state.decisionPasses = [];
            localStorage.setItem('ccTracker_proAccess', JSON.stringify(testPro));
            alert('Switched to Pro. Redirecting...');
            window.location.href = 'app-pro.html';
          } else {
            // Base version - clear all tier access
            state.decisionPasses = [];
            state.proAccess = null;
            alert('Switched to Base version. Reloading...');
            window.location.reload();
          }
        } else if (confirmation === 'TESTDP-PASS-001' || confirmation === 'TESTPRO-PASS-001') {
          // Secret reset: revert to free tier (clear DP and Pro access only)
          state.decisionPasses = [];
          state.proAccess = null;
          state.dpBannersDismissed = {};
          localStorage.removeItem('ccTracker_decisionPasses');
          localStorage.removeItem('ccTracker_proAccess');
          localStorage.removeItem('ccTracker_dpBannersDismissed');
          alert('Tier access reset. You are now on the free plan.');
          if (state.results) renderView(state.activeView);
        } else {
          alert('Deletion cancelled.');
        }
      }
    }
  });
  
  // Export Data button and modal handlers
  document.getElementById('exportData').addEventListener('click', () => {
    manageDataDropdown.classList.add('hidden');

    // Gate export: require at least one active Decision Pass or Pro
    if (window.TIER_CONFIG !== 'pro' && getActiveDecisionPasses().length === 0) {
      // COMING SOON: Change this alert back when paid plans launch
      document.getElementById('comingSoonModal').classList.remove('hidden');
      return;
    }

    // Update stats in modal
    const txnCount = state.savedTransactions.length;
    document.getElementById('exportTxnCount').textContent = txnCount.toLocaleString();
    
    // Estimate data size
    const jsonData = JSON.stringify(buildExportData());
    const sizeKB = Math.round(jsonData.length / 1024);
    document.getElementById('exportDataSize').textContent = sizeKB > 1000 ? `${(sizeKB/1024).toFixed(1)} MB` : `${sizeKB} KB`;
    
    document.getElementById('exportModal').classList.remove('hidden');
  });
  
  document.getElementById('closeExportModal').addEventListener('click', () => {
    document.getElementById('exportModal').classList.add('hidden');
  });
  
  document.getElementById('exportModal').addEventListener('click', (e) => {
    if (e.target.id === 'exportModal') {
      document.getElementById('exportModal').classList.add('hidden');
    }
  });
  
  document.getElementById('exportCSV').addEventListener('click', () => {
    exportAsCSV();
    document.getElementById('exportModal').classList.add('hidden');
  });
  
  document.getElementById('exportJSON').addEventListener('click', () => {
    exportAsJSON();
    document.getElementById('exportModal').classList.add('hidden');
  });
  
  // Initialize stored transaction count display
  updateStoredTxnCount();
  
  // Manage Data dropdown toggle
  manageDataBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    manageDataDropdown.classList.toggle('hidden');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    manageDataDropdown.classList.add('hidden');
  });
  
  // Prevent dropdown from closing when clicking inside it
  manageDataDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  document.getElementById('backFromMapping').addEventListener('click', async () => {
    document.getElementById('mappingSection').classList.add('hidden');
    if (state.results) {
      document.getElementById('resultsSection').classList.remove('hidden');
      renderView('summary');
    } else if (state.transactions.length > 0) {
      await runProcessing();
    } else {
      document.getElementById('uploadSection').classList.remove('hidden');
      // Reset file inputs so the same file can be re-selected
      document.getElementById('fileInput').value = '';
      document.getElementById('newFileInput').value = '';
    }
  });
  
  document.getElementById('cardConfigBtn').addEventListener('click', showCardConfigEditor);
  
  // Low-confidence review modal handlers
  document.getElementById('lowConfidenceModal').addEventListener('click', () => {
    document.getElementById('lowConfidenceModal').classList.add('hidden');
  });
  
  document.getElementById('skipLowConfidenceReview').addEventListener('click', () => {
    document.getElementById('lowConfidenceModal').classList.add('hidden');
  });
  
  document.getElementById('startLowConfidenceReview').addEventListener('click', () => {
    document.getElementById('lowConfidenceModal').classList.add('hidden');
    // Switch to transactions view with needs review filter enabled
    renderView('transactions');
    // Small delay to ensure the view is rendered before checking the checkbox
    setTimeout(() => {
      const needsReviewCheckbox = document.getElementById('filterNeedsReview');
      if (needsReviewCheckbox) {
        needsReviewCheckbox.checked = true;
        needsReviewCheckbox.dispatchEvent(new Event('change'));
      }
    }, 100);
  });
  
  // Load saved transactions and show results if available - ALWAYS go to Summary
  if (state.savedTransactions && state.savedTransactions.length > 0) {
    // Hide upload section immediately to prevent flash
    document.getElementById('uploadSection').classList.add('hidden');
    
    state.transactions = state.savedTransactions;
    const allLast4s = [...new Set(state.transactions.map(t => t.last4).filter(Boolean))];
    const unmapped = allLast4s.filter(l4 => !state.cardMappings[l4]);
    
    // Always process and show Summary, even if some cards unmapped
    // User can click Card Mapping to map them
    await runProcessing();
  }
  
  document.getElementById('saveCardConfig').addEventListener('click', async () => {
    const cardId = document.getElementById('configCardSelect').value;
    const cardFullyEditable = isCardEditable(cardId, 'config');

    // Save point value (only if card is editable)
    if (cardFullyEditable) {
      const pointVal = parseFloat(document.getElementById('configPointValue')?.value) / 100;
      if (!isNaN(pointVal) && pointVal > 0) {
        state.customPointValues[cardId] = pointVal;
        safeLocalStorageSet('ccTracker_pointValues', state.customPointValues);
      }
    }

    // Save annual bonus points override (only if card is editable)
    if (cardFullyEditable) {
      const bonusInput = document.getElementById('configAnnualBonusPoints');
      if (bonusInput) {
        const bonusVal = parseInt(bonusInput.value);
        if (!isNaN(bonusVal) && bonusVal >= 0) {
          state.customAnnualBonusPoints[cardId] = bonusVal;
        } else {
          delete state.customAnnualBonusPoints[cardId];
        }
        safeLocalStorageSet('ccTracker_annualBonusPoints', state.customAnnualBonusPoints);
      }
    }

    // Save disabled credits (only if card credits are editable)
    if (isCardEditable(cardId, 'credits')) {
      const disabledList = [];
      document.querySelectorAll('.credit-toggle-checkbox').forEach(cb => {
        if (!cb.checked) {
          disabledList.push(cb.dataset.creditName);
        }
      });
      state.disabledCredits[cardId] = disabledList;
      safeLocalStorageSet('ccTracker_disabledCredits', state.disabledCredits);
    }

    // Save monthly credit claims - NOW YEAR-SPECIFIC (only if credits editable)
    if (isCardEditable(cardId, 'credits')) {
      const selectedYear = state.selectedCreditYear || new Date().getFullYear();
      if (!state.monthlyCredits[cardId]) state.monthlyCredits[cardId] = {};

      document.querySelectorAll('.month-claim').forEach(cb => {
        const creditName = cb.dataset.credit;
        const month = parseInt(cb.dataset.month);

        // Initialize structure if needed
        if (!state.monthlyCredits[cardId][creditName]) {
          state.monthlyCredits[cardId][creditName] = {};
        }
        // Migrate legacy array format to year-based object
        if (Array.isArray(state.monthlyCredits[cardId][creditName])) {
          const legacyMonths = state.monthlyCredits[cardId][creditName];
          state.monthlyCredits[cardId][creditName] = { [selectedYear]: legacyMonths };
        }
        if (!state.monthlyCredits[cardId][creditName][selectedYear]) {
          state.monthlyCredits[cardId][creditName][selectedYear] = [];
        }

        const yearMonths = state.monthlyCredits[cardId][creditName][selectedYear];
        if (cb.checked && !yearMonths.includes(month)) {
          yearMonths.push(month);
        } else if (!cb.checked) {
          state.monthlyCredits[cardId][creditName][selectedYear] = yearMonths.filter(m => m !== month);
        }
      });
      safeLocalStorageSet('ccTracker_monthlyCredits', state.monthlyCredits);
    }
    
    // Save Cash+ quarterly categories for selected year
    // Use consistent fallback: most recent transaction year, or current year if no transactions
    if (cardId === 'us-bank-cash-plus') {
      const defaultYear = state.availableYears.length > 0 ? state.availableYears[0] : new Date().getFullYear();
      const cashPlusYear = state.selectedCashPlusYear || defaultYear;
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarterKey => {
        const yearQuarterKey = `${cashPlusYear}-${quarterKey}`;
        const fivePercent = [];
        document.querySelectorAll(`.cash-plus-5[data-quarter="${quarterKey}"]:checked`).forEach(cb => {
          fivePercent.push(cb.dataset.category);
        });
        const twoPercentCb = document.querySelector(`.cash-plus-2[data-quarter="${quarterKey}"]:checked`);
        const twoPercent = twoPercentCb ? twoPercentCb.dataset.category : '';

        state.cashPlusCategories[yearQuarterKey] = { fivePercent, twoPercent };
      });
      safeLocalStorageSet('ccTracker_cashPlusCategories', state.cashPlusCategories);
    }

    // CFF quarterly categories are now read from stored data (no user selections to save)
    
    // Save Bilt-specific config from the DOM (matches pattern of other card-specific saves)
    const card = CARDS[cardId];
    if (card?.isBilt) {
      if (!state.biltConfig[cardId]) state.biltConfig[cardId] = {};
      const cfg = state.biltConfig[cardId];
      const rewardRadio = document.querySelector(`.bilt-reward-option[data-card="${cardId}"]:checked`);
      if (rewardRadio) cfg.rewardOption = rewardRadio.value;
      const rentRadio = document.querySelector(`.bilt-rent-detection[data-card="${cardId}"]:checked`);
      if (rentRadio) cfg.rentDetection = rentRadio.value;
      const cashCheckbox = document.querySelector(`.bilt-cash-as-credit[data-card="${cardId}"]`);
      if (cashCheckbox) cfg.countBiltCashAsCredit = cashCheckbox.checked;
      const redemptionInput = document.querySelector(`.bilt-monthly-redemption[data-card="${cardId}"]`);
      if (redemptionInput) cfg.monthlyBiltCashRedemption = parseFloat(redemptionInput.value) || 0;
      const manualRentInput = document.querySelector(`.bilt-manual-rent[data-card="${cardId}"]`);
      if (manualRentInput) cfg.manualRentAmount = parseFloat(manualRentInput.value) || 2000;
      const rentDaySelect = document.querySelector(`.bilt-rent-day[data-card="${cardId}"]`);
      if (rentDaySelect) cfg.manualRentDay = parseInt(rentDaySelect.value);
      const keywordInput = document.querySelector(`.bilt-rent-keyword[data-card="${cardId}"]`);
      if (keywordInput) cfg.rentMerchantKeyword = keywordInput.value.trim();
      const bonusRadio = document.querySelector(`.bilt-bonus-cat[data-card="${cardId}"]:checked`);
      if (bonusRadio) cfg.bonusCategory = bonusRadio.value;
      safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
    }

    // Reprocess transactions without navigating away from config page
    if (state.transactions.length > 0) {
      showLoading(true, 'Processing transactions...');
      try {
        const results = await processTransactions(state.transactions);
        showLoading(false);
        state.results = results;
        // Update available years for filters
        const years = [...new Set(results.processed.map(t => getYearFromDateString(t.date)))].sort((a, b) => b - a);
        state.availableYears = years;
      } catch (e) {
        showLoading(false);
        alert('Error reprocessing: ' + e.message);
      }
    }
    // Re-render config but stay on the same card
    showCardConfigEditor(cardId);
  });
  
  document.getElementById('backToSummary').addEventListener('click', () => {
    document.getElementById('cardConfigSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');
    renderView(state.activeView);
  });
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => renderView(tab.dataset.view));
  });
  
  // =============================================================================
  // UPGRADE / TIER MODAL HANDLERS
  // =============================================================================

  // COMING SOON: Intercept all upgrade entry points with coming-soon modal
  // To restore paid flow: remove comingSoonModal HTML, delete this block,
  // and uncomment the original handlers below.
  (function() {
    var u = 'creditcardvaluetracker';
    var d = 'gmail';
    var t = 'com';
    var addr = u + '\u0040' + d + '.' + t;
    var el = document.getElementById('comingSoonEmail');
    if (el) {
      el.textContent = addr;
      el.onclick = function() {
        window.location.href = 'mai' + 'lto:' + addr + '?subject=' + encodeURIComponent('Feature Request — Credit Card Value Tracker');
      };
    }
  })();
  document.getElementById('closeComingSoon').addEventListener('click', () => {
    document.getElementById('comingSoonModal').classList.add('hidden');
  });
  document.getElementById('comingSoonModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // Decision Pass banner links → open coming-soon modal (delegated)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.dp-upgrade-link');
    if (link) {
      e.preventDefault();
      document.getElementById('comingSoonModal').classList.remove('hidden');
    }
  });

  // Decision Pass banner dismiss X buttons (delegated, per-page persistence)
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.dp-banner-close');
    if (closeBtn) {
      const bannerKey = closeBtn.dataset.bannerKey;
      if (bannerKey) {
        state.dpBannersDismissed[bannerKey] = true;
        safeLocalStorageSet('ccTracker_dpBannersDismissed', state.dpBannersDismissed);
      }
      const banner = closeBtn.closest('.dp-banner');
      if (banner) banner.remove();
    }
  });

  // Upgrade button opens coming-soon modal (COMING SOON: change back to upgradeModal)
  document.getElementById('upgradeBtn').addEventListener('click', () => {
    document.getElementById('comingSoonModal').classList.remove('hidden');
  });

  // Close upgrade modal
  document.getElementById('closeUpgradeModal').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.add('hidden');
  });
  document.getElementById('upgradeModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // Purchase buttons → open detail modals
  document.getElementById('upgradeChoiceDP').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.add('hidden');
    document.getElementById('dpInfoModal').classList.remove('hidden');
  });
  document.getElementById('upgradeChoicePro').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.add('hidden');
    document.getElementById('proInfoModal').classList.remove('hidden');
  });

  // Close detail modals
  document.getElementById('closeDPInfoModal').addEventListener('click', () => {
    document.getElementById('dpInfoModal').classList.add('hidden');
  });
  document.getElementById('dpInfoModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });
  document.getElementById('closeProInfoModal').addEventListener('click', () => {
    document.getElementById('proInfoModal').classList.add('hidden');
  });
  document.getElementById('proInfoModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // Decision Pass key activation - Step 1: validate key and show card selector
  document.getElementById('dpActivateBtn').addEventListener('click', () => {
    const key = document.getElementById('dpKeyInput').value.trim();
    const errorEl = document.getElementById('dpKeyError');

    if (!isValidLicenseKeyFormat(key)) {
      errorEl.textContent = 'Invalid key format. Keys are 8-35 characters (letters, numbers, hyphens).';
      errorEl.style.display = 'block';
      return;
    }

    // Test keys (TESTDP-xxxx) bypass duplicate check
    const isTestKey = /^TESTDP-/i.test(key);
    if (!isTestKey && state.decisionPasses.some(dp => dp.key === key)) {
      errorEl.textContent = 'This key has already been activated.';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';

    // Populate card selector with mapped cards
    const cardSelect = document.getElementById('dpCardSelect');
    // Show only cards the user actually has mapped
    const mappedCardIds = [...new Set(Object.values(state.cardMappings))].filter(id => id !== 'skip');
    const allCardIds = mappedCardIds.length > 0 ? mappedCardIds : Object.keys(CARDS).filter(id => id !== 'skip');
    cardSelect.innerHTML = '<option value="">Select a card...</option>' + allCardIds.map(id => {
      const card = CARDS[id];
      if (!card) return '';
      const alreadyHasDP = hasActiveDecisionPass(id);
      const label = alreadyHasDP ? `${escapeHtml(card.name)} (already upgraded)` : escapeHtml(card.name);
      return `<option value="${escapeHtml(id)}" ${alreadyHasDP ? 'disabled' : ''}>${label}</option>`;
    }).join('');

    document.getElementById('dpCardSelector').style.display = 'block';
  });

  // Decision Pass key activation - Step 2: confirm card and activate
  document.getElementById('dpConfirmActivation').addEventListener('click', () => {
    const key = document.getElementById('dpKeyInput').value.trim();
    const cardId = document.getElementById('dpCardSelect').value;
    const errorEl = document.getElementById('dpKeyError');

    if (!cardId) {
      errorEl.textContent = 'Please select a card.';
      errorEl.style.display = 'block';
      return;
    }

    const success = activateDecisionPass(key, cardId);
    if (success) {
      document.getElementById('upgradeModal').classList.add('hidden');
      // Re-render whichever view is active
      if (state.results) renderView(state.activeView);
      // Also re-render card config if it's currently visible
      const configSection = document.getElementById('cardConfigSection');
      if (configSection && !configSection.classList.contains('hidden')) {
        const currentConfigCard = document.getElementById('configCardSelect')?.value;
        if (currentConfigCard) showCardConfigEditor(currentConfigCard);
      }
    } else {
      errorEl.textContent = 'Activation failed. Please check your key and try again.';
      errorEl.style.display = 'block';
    }
  });

  // Pro key activation
  document.getElementById('proActivateBtn').addEventListener('click', () => {
    const key = document.getElementById('proKeyInput').value.trim();
    const errorEl = document.getElementById('proKeyError');

    if (!isValidLicenseKeyFormat(key)) {
      errorEl.textContent = 'Invalid key format. Keys are 8-35 characters (letters, numbers, hyphens).';
      errorEl.style.display = 'block';
      return;
    }

    const success = activateProAccess(key);
    if (success) {
      document.getElementById('upgradeModal').classList.add('hidden');
      window.location.href = 'app-pro.html';
    } else {
      errorEl.textContent = 'Activation failed. Please check your key and try again.';
      errorEl.style.display = 'block';
    }
  });

  // Newsletter popup setup (free mode only, once per session, after tour completes)
  initNewsletterPopup();

  // Initialize tutorial system (help, tour, guidance - defined in tutorial.js)
  initTutorial();
});

// Newsletter popup (free mode only, deferred until tour completes)
// Uses Buttondown's embed form (no API key needed — posts to hidden iframe)
function initNewsletterPopup() {
  const popup = document.getElementById('newsletterPopup');

  function closeNewsletter() {
    popup.classList.add('hidden');
  }

  document.getElementById('newsletterClose').addEventListener('click', closeNewsletter);
  document.getElementById('newsletterSkip').addEventListener('click', closeNewsletter);
  popup.addEventListener('click', (e) => { if (e.target === popup) closeNewsletter(); });

  document.getElementById('newsletterForm').addEventListener('submit', (e) => {
    const emailInput = document.getElementById('newsletterEmail');
    const email = emailInput.value.trim();
    const msgEl = document.getElementById('newsletterMsg');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.preventDefault();
      msgEl.textContent = 'Please enter a valid email address.';
      msgEl.className = 'newsletter-msg error';
      msgEl.classList.remove('hidden');
      return;
    }

    // Form submits to hidden iframe — mark as subscribed
    safeLocalStorageSet('ccTracker_newsletterSubmitted', 'true');
    msgEl.textContent = 'You\'re in! We\'ll keep you posted.';
    msgEl.className = 'newsletter-msg success';
    msgEl.classList.remove('hidden');
    document.getElementById('newsletterSubmit').disabled = true;
    setTimeout(closeNewsletter, 2000);
  });
}

// Show the newsletter popup if the user hasn't already submitted their email.
// Called from showResults() (with appropriate delay) or from endTour() in tutorial.js.
// Only shows when the card performance / results page is visible.
function showNewsletterPopup(delayMs) {
  // Don't show if user already subscribed (persists across sessions, cleared by Clear Everything)
  if (localStorage.getItem('ccTracker_newsletterSubmitted')) return;
  if (sessionStorage.getItem('ccTracker_newsletterShown')) return;
  // Don't show while tour is active — endTour() will call us when it's done
  if (state.tourActive) return;
  // Only show on the card performance page, not the upload/CSV page
  var results = document.getElementById('resultsSection');
  if (!results || results.classList.contains('hidden')) return;
  sessionStorage.setItem('ccTracker_newsletterShown', 'true');
  setTimeout(() => {
    document.getElementById('newsletterPopup').classList.remove('hidden');
  }, delayMs || 2000);
}

// Assemble feedback email dynamically to prevent scraping
function initFeedbackEmail() {
  var u = 'creditcardvaluetracker';
  var d = 'gmail';
  var t = 'com';
  var addr = u + '\u0040' + d + '.' + t;
  var el = document.getElementById('feedbackEmail');
  if (el) {
    el.textContent = addr;
    el.onclick = function() {
      window.location.href = 'mai' + 'lto:' + addr + '?subject=' + encodeURIComponent('Credit Card Value Tracker Feedback');
    };
  }
}
