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

/**
 * Generate a short hash from CSV headers to identify the source format.
 * Same CSV structure always produces the same hash. For headerless CSVs,
 * synthetic column names (e.g., "Column 1", "Column 2") are used.
 * @param {string[]} headers - Array of CSV column headers
 * @returns {string} 8-character hex hash string
 */
function generateSourceFormatHash(headers) {
  const normalized = headers.map(h => h.toLowerCase().trim()).sort().join('|');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  // Convert to unsigned 32-bit and return as 8-char hex
  return (hash >>> 0).toString(16).padStart(8, '0');
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
  streamingCredits: safeLocalStorageGet('ccTracker_streamingCredits', {}),
  activeStreamingService: 'paramount',
  streamingSectionExpanded: false,
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

  // What If state (session-only)
  whatif: {
    step: 1,                // Current wizard step (1-6)
    scenarioType: null,     // 'add', 'remove', 'swap'
    addCardId: null,        // Card being added
    removeCardId: null,     // Card being removed
    selectedYear: null,     // Year for analysis
    optimizationRate: null, // Current slider value (0-100), null = auto-detect
    isCustomMode: false,    // Whether user manually edited amounts (slider inactive)
    shiftAmounts: {},       // { 'cardId|category': amount } confirmed shift amounts
    creditToggles: {},      // { creditName: true/false } for new card credits
    creditAmounts: {},      // { creditName: amount } for new card credit amounts
    removeCreditToggles: {},  // For removed card's lost credits
    removeCreditAmounts: {},  // For removed card's lost credit amounts
    walletMismatch: {},     // Step 3b: { cardId: { estimated: true, ... } }
    resultCalculated: false // Whether results have been calculated
  },

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
const PRO_DATA_MONTHS = 72; // Pro users see 6 years of data

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
 * Apply per-card tier-based date filtering to a set of transactions (display-time safety net)
 * Free users: 12 months of data (DP cards: 6 years)
 * Pro: 6 years
 * @param {Array} transactions - Processed transactions to filter
 * @returns {Array} Filtered transactions
 */
function applyTierDateFiltering(transactions) {
  const isPro = window.TIER_CONFIG === 'pro';
  const dpLookup = getActiveDecisionPassLookup();
  const now = new Date();
  const proCutoff = new Date(now.getFullYear(), now.getMonth() - PRO_DATA_MONTHS, now.getDate());
  const freeCutoff = new Date(now.getFullYear(), now.getMonth() - FREE_DATA_MONTHS, now.getDate());
  const dpCutoff = new Date(now.getFullYear(), now.getMonth() - PRO_DATA_MONTHS, now.getDate());

  return transactions.filter(t => {
    if (!t.cardId || t.cardId === 'skip') return true;
    const parsed = parseDateString(t.date);
    if (!parsed) return true;

    if (isPro) {
      return parsed.date >= proCutoff;
    }
    // Free tier: Decision Pass cards get 4-year window
    if (dpLookup[t.cardId]) {
      return parsed.date >= dpCutoff;
    }
    return parsed.date >= freeCutoff;
  });
}

/**
 * Prune transactions for storage based on tier-appropriate data windows.
 * Called before saving to localStorage to prevent unbounded growth.
 * Free: 1 year (DP cards: 6 years). Pro: 6 years.
 * @param {Array} transactions - Raw transactions to prune
 * @returns {Array} Pruned transactions
 */
function pruneTransactionsForStorage(transactions) {
  const now = new Date();
  const isPro = window.TIER_CONFIG === 'pro';
  const dpLookup = getActiveDecisionPassLookup();

  const proCutoff = new Date(now.getFullYear(), now.getMonth() - PRO_DATA_MONTHS, now.getDate());
  const freeCutoff = new Date(now.getFullYear(), now.getMonth() - FREE_DATA_MONTHS, now.getDate());
  const dpCutoff = new Date(now.getFullYear(), now.getMonth() - PRO_DATA_MONTHS, now.getDate());

  // For unmapped transactions, use the most generous cutoff so they survive
  // until the user maps them, but still cap at the tier's maximum window
  const unmappedCutoff = isPro || Object.keys(dpLookup).length > 0 ? proCutoff : freeCutoff;

  return transactions.filter(t => {
    const parsed = parseDateString(t.date);
    if (!parsed) return true;

    // Unmapped/skipped transactions: prune using the most generous applicable cutoff
    if (!t.cardId || t.cardId === 'skip') {
      return parsed.date >= unmappedCutoff;
    }

    if (isPro) {
      return parsed.date >= proCutoff;
    }
    // Free tier
    if (dpLookup[t.cardId]) {
      return parsed.date >= dpCutoff;
    }
    return parsed.date >= freeCutoff;
  });
}

/**
 * Check if a single transaction's low-confidence state should be visible.
 * Free/Pro: all low-confidence non-payment transactions visible.
 * DP: only visible if the transaction's card has an active Decision Pass.
 * @param {Object} t - A processed transaction
 * @param {Object} [dpLookup] - Optional pre-built DP lookup (avoids repeated calls)
 * @returns {boolean}
 */
function isNeedsReviewVisible(t, dpLookup) {
  if (t.isPayment || t.confidence >= CONFIDENCE_THRESHOLD) return false;
  if (window.TIER_CONFIG === 'pro' || window.TIER_CONFIG === 'free') return true;
  // Decision Pass: only for DP-activated cards
  const lookup = dpLookup || getActiveDecisionPassLookup();
  return !!lookup[t.cardId];
}

/**
 * Get low-confidence transactions visible for the current tier.
 * Convenience wrapper around isNeedsReviewVisible for bulk filtering.
 * @param {Array} transactions - Processed transactions
 * @returns {Array} Visible low-confidence transactions
 */
function getVisibleLowConfidenceTransactions(transactions) {
  const dpLookup = getActiveDecisionPassLookup();
  return transactions.filter(t => isNeedsReviewVisible(t, dpLookup));
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

  // Streaming keyword validation: if card defines streamingKeywords, only give
  // the streaming bonus when the merchant matches an approved service
  if (category === 'streaming' && card.streamingKeywords && merchantDesc) {
    const normDesc = merchantDesc.toLowerCase().replace(/[^a-z0-9\s.+]/g, '');
    const matched = card.streamingKeywords.some(kw => normDesc.includes(kw));
    if (!matched) {
      return { rate: card.baseRate, reason: `${card.baseRate}x base rate (streaming service not in ${card.shortName || card.name} bonus list)` };
    }
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

  // Add streaming credits (Paramount+ or Peacock)
  if (card.credits?.some(cr => cr.streamingBenefit)) {
    const streamingForCard = state.streamingCredits[cardId] || {};
    for (const [yearStr, yearData] of Object.entries(streamingForCard)) {
      const year = parseInt(yearStr);
      if (typeof yearData !== 'object') continue;
      for (const [monthStr, svc] of Object.entries(yearData)) {
        const monthIndex = parseInt(monthStr);
        const claimDate = new Date(year, monthIndex, 15);
        if (claimDate >= startDate && claimDate < endDate) {
          total += svc === 'paramount' ? 7.99 : (svc === 'peacock' ? 10.99 : 0);
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

  // Add streaming credits (Paramount+ or Peacock)
  if (card.credits?.some(cr => cr.streamingBenefit)) {
    const streamingForCard = state.streamingCredits[cardId] || {};
    let streamingTotal = 0;
    for (const [yearStr, yearData] of Object.entries(streamingForCard)) {
      const year = parseInt(yearStr);
      if (typeof yearData !== 'object') continue;
      for (const [monthStr, svc] of Object.entries(yearData)) {
        const monthIndex = parseInt(monthStr);
        const claimDate = new Date(year, monthIndex, 15);
        if (claimDate >= startDate && claimDate < endDate) {
          streamingTotal += svc === 'paramount' ? 7.99 : (svc === 'peacock' ? 10.99 : 0);
        }
      }
    }
    if (streamingTotal > 0) {
      result['Paramount+ or Peacock'] = (result['Paramount+ or Peacock'] || 0) + streamingTotal;
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

      const hasStreamingSub = !!cr.streamingBenefit;
      return `
        <div class="${isManual && !isDisabled ? 'manual-credit-row' : ''}" style="padding:12px;background:${isDisabled ? '#fafaf9' : '#fff'};border:1px solid #e7e5e4;border-radius:${hasStreamingSub ? '8px 8px 0 0' : '8px'};${isDisabled ? 'opacity:0.5;' : ''}">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:${isManual && !isDisabled ? '12px' : '0'};">
            <input type="checkbox" class="credit-toggle-checkbox" data-credit-name="${escapeHtml(cr.name)}" ${!isDisabled ? 'checked' : ''} title="Include this credit in ROI calculation">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:500;${isDisabled ? 'text-decoration:line-through;' : ''}">${escapeHtml(cr.name)}${isManual ? ' ⚡' : ''}</div>
              <div style="font-size:11px;color:#78716c;">$${cr.amount}/yr${isManual ? ` (~$${monthlyAmount.toFixed(0)}/mo)` : ' — Auto-detected from transactions'}</div>
            </div>
            ${isManual && !isDisabled ? `<span class="credit-claimed-display" data-monthly-amount="${monthlyAmount}" style="font-size:12px;color:#059669;font-weight:500;">$${totalClaimed.toFixed(0)} claimed</span>` : ''}
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

      // Helper to render the Paramount+/Peacock streaming benefit sub-section
      const renderStreamingBenefitSection = (selectedCreditYear) => {
        const streamingData = state.streamingCredits?.[cardId]?.[selectedCreditYear] || {};
        const activeService = state.activeStreamingService || 'paramount';

        let paramountTotal = 0, peacockTotal = 0;
        for (const svc of Object.values(streamingData)) {
          if (svc === 'paramount') paramountTotal += 7.99;
          else if (svc === 'peacock') peacockTotal += 10.99;
        }
        const totalClaimed = paramountTotal + peacockTotal;

        const monthsHtml = MONTHS.map((month, idx) => {
          const service = streamingData[idx];
          let bg = '#fff', borderColor = '#e7e5e4';
          if (service === 'paramount') { bg = '#dbeafe'; borderColor = '#3b82f6'; }
          else if (service === 'peacock') { bg = '#ede9fe'; borderColor = '#7c3aed'; }
          return `
            <div class="streaming-month-toggle" data-month="${idx}"
              style="display:flex;align-items:center;justify-content:center;width:42px;padding:6px 0;border:2px solid ${borderColor};border-radius:4px;cursor:pointer;font-size:11px;background:${bg};user-select:none;"
              title="Click to toggle ${month}">
              ${month}
            </div>
          `;
        }).join('');

        return `
          <div style="padding:12px;background:#fafaf9;border:1px solid #e7e5e4;border-top:1px dashed #d6d3d1;border-radius:0 0 8px 8px;margin-top:-1px;">
            <div class="streaming-section-header" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="streaming-toggle-arrow" style="font-size:10px;color:#78716c;transition:transform 0.2s;display:inline-block;${state.streamingSectionExpanded ? 'transform:rotate(90deg);' : ''}">&#9654;</span>
                <div>
                  <div style="font-size:13px;font-weight:500;">Paramount+ and Peacock</div>
                  <div style="font-size:11px;color:#78716c;">Included with Walmart+ — select a service, then toggle months</div>
                </div>
              </div>
              <span id="streamingClaimedTotal" style="font-size:12px;color:#059669;font-weight:500;">$${totalClaimed.toFixed(2)} claimed</span>
            </div>
            <div class="streaming-section-content" style="display:${state.streamingSectionExpanded ? 'block' : 'none'};margin-top:10px;">
              <div style="display:flex;gap:8px;margin-bottom:12px;">
                <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;border:2px solid ${activeService === 'paramount' ? '#3b82f6' : '#e7e5e4'};border-radius:6px;cursor:pointer;background:${activeService === 'paramount' ? '#dbeafe' : '#fff'};font-size:12px;font-weight:500;color:${activeService === 'paramount' ? '#1d4ed8' : '#78716c'};">
                  <input type="radio" name="streamingService" value="paramount" ${activeService === 'paramount' ? 'checked' : ''} class="streaming-service-radio" style="display:none;">
                  <span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block;flex-shrink:0;"></span>
                  Paramount+ ($7.99/mo)
                </label>
                <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;border:2px solid ${activeService === 'peacock' ? '#7c3aed' : '#e7e5e4'};border-radius:6px;cursor:pointer;background:${activeService === 'peacock' ? '#ede9fe' : '#fff'};font-size:12px;font-weight:500;color:${activeService === 'peacock' ? '#5b21b6' : '#78716c'};">
                  <input type="radio" name="streamingService" value="peacock" ${activeService === 'peacock' ? 'checked' : ''} class="streaming-service-radio" style="display:none;">
                  <span style="width:8px;height:8px;border-radius:50%;background:#7c3aed;display:inline-block;flex-shrink:0;"></span>
                  Peacock ($10.99/mo)
                </label>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;padding-top:8px;border-top:1px solid #f5f5f4;">
                ${monthsHtml}
              </div>
            </div>
          </div>
        `;
      };

      // Build credits grid HTML
      const creditsHtml = card.credits.map(cr => {
        let html = renderCreditRow(cr, selectedCreditYear);
        if (cr.streamingBenefit) {
          html += renderStreamingBenefitSection(selectedCreditYear);
        }
        return html;
      }).join('');

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

        // Real-time update of claimed total
        const row = cb.closest('.manual-credit-row');
        if (row) {
          const checkedCount = row.querySelectorAll('.month-claim:checked').length;
          const claimedEl = row.querySelector('.credit-claimed-display');
          if (claimedEl) {
            const monthlyAmount = parseFloat(claimedEl.dataset.monthlyAmount);
            const total = checkedCount * monthlyAmount;
            claimedEl.textContent = `$${total.toFixed(0)} claimed`;
          }
        }
      });
    });

    // Streaming service radio selector - re-render to update styling
    document.querySelectorAll('.streaming-service-radio').forEach(radio => {
      radio.addEventListener('change', () => {
        state.activeStreamingService = radio.value;
        renderCardConfig();
      });
    });

    // Streaming month toggles (Paramount+/Peacock)
    document.querySelectorAll('.streaming-month-toggle').forEach(el => {
      el.addEventListener('click', () => {
        const month = parseInt(el.dataset.month);
        const selectedYear = state.selectedCreditYear || new Date().getFullYear();
        const activeService = state.activeStreamingService || 'paramount';

        if (!state.streamingCredits[cardId]) state.streamingCredits[cardId] = {};
        if (!state.streamingCredits[cardId][selectedYear]) state.streamingCredits[cardId][selectedYear] = {};

        const yearData = state.streamingCredits[cardId][selectedYear];

        if (yearData[month] === activeService) {
          delete yearData[month];
        } else {
          yearData[month] = activeService;
        }

        // Update visual
        const service = yearData[month];
        if (service === 'paramount') {
          el.style.background = '#dbeafe';
          el.style.borderColor = '#3b82f6';
        } else if (service === 'peacock') {
          el.style.background = '#ede9fe';
          el.style.borderColor = '#7c3aed';
        } else {
          el.style.background = '#fff';
          el.style.borderColor = '#e7e5e4';
        }

        // Update claimed total
        const totalEl = document.getElementById('streamingClaimedTotal');
        if (totalEl) {
          let pt = 0, pc = 0;
          const yd = state.streamingCredits?.[cardId]?.[selectedYear] || {};
          for (const s of Object.values(yd)) {
            if (s === 'paramount') pt += 7.99;
            else if (s === 'peacock') pc += 10.99;
          }
          totalEl.textContent = `$${(pt + pc).toFixed(2)} claimed`;
        }
      });
    });

    // Streaming section collapsible toggle
    document.querySelector('.streaming-section-header')?.addEventListener('click', () => {
      const content = document.querySelector('.streaming-section-content');
      const arrow = document.querySelector('.streaming-toggle-arrow');
      if (content && arrow) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
        state.streamingSectionExpanded = isHidden;
      }
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
  
  // Count low-confidence transactions actionable by this tier
  const actionableLowConf = getVisibleLowConfidenceTransactions(results.processed);
  const lowConfidenceCount = actionableLowConf.length;

  // Stats footer - include low-confidence count (only for tiers that can act on them)
  const lowConfBadge = lowConfidenceCount > 0
    ? `<span style="color:#b45309;"> • ${lowConfidenceCount} need review</span>`
    : '';
  const isPro = window.TIER_CONFIG === 'pro';
  const tierBadge = isPro
    ? `<span style="background:#1c1917;color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:9999px;letter-spacing:0.04em;">PRO</span>`
    : `<span style="background:#f59e0b;color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:9999px;letter-spacing:0.04em;">BETA</span>`;
  const tierMessage = isPro
    ? 'Thanks for supporting the tracker! Feedback welcome:'
    : 'This tool is in beta — features may change and bugs may exist. Feedback welcome:';
  document.getElementById('statsFooter').innerHTML = `
    <strong>Stats:</strong> ${Object.keys(state.merchantCache).length} merchants cached •
    ${results.cards.length} cards tracked${lowConfBadge}
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #d6d3d1;">
      ${tierBadge}
      <span style="margin-left:6px;">${tierMessage} <span id="feedbackEmail" style="color:#2563eb;cursor:pointer;text-decoration:underline;" title="Click to send feedback"></span> · <a href="https://docs.google.com/forms/d/e/1FAIpQLSdv50_OOmmuoArTW8FkmCuZhy7WuQH8A0GE1M8mYgTseakdOw/viewform?usp=publish-editor" target="_blank" rel="noopener" style="color:#78716c;text-decoration:underline;text-underline-offset:2px;" title="Submit feedback form">Feedback</a></span>
    </div>
  `;
  initFeedbackEmail();

  renderView('summary');

  // Show low-confidence review modal on new upload if there are items to review
  // BUT NOT during the tour - it will be explained later
  // Free users see badges but skip the popup (they can't reclassify — it's an upsell)
  if (isNewUpload && lowConfidenceCount > 0 && !state.tourActive && window.TIER_CONFIG !== 'free') {
    document.getElementById('lowConfidenceCount').textContent = lowConfidenceCount;
    document.getElementById('lowConfidenceModal').classList.remove('hidden');
  }

  // Newsletter popup: show on card performance page (not during tour)
  // New users (just uploaded): 5s delay. Returning users: 2s delay.
  if (typeof showNewsletterPopup === 'function') {
    showNewsletterPopup(isNewUpload ? 5000 : 2000);
  }
}

// =============================================================================
// WHAT IF CALCULATOR
// =============================================================================

/**
 * Get multiplier for What If scenarios. Uses current rates (today's date)
 * and skips CFF quarterly bonuses since those are unpredictable for future scenarios.
 * Falls back to CFF's static multipliers (chase-travel 5x, dining 3x, drugstore 3x, 1x base).
 */
function getWhatIfMultiplier(cardId, category) {
  const _today = new Date();
  const todayStr = `${_today.getFullYear()}-${String(_today.getMonth()+1).padStart(2,'0')}-${String(_today.getDate()).padStart(2,'0')}`;

  if (cardId === 'chase-freedom-flex') {
    // Skip quarterly bonus lookup — use only static multipliers
    const card = CARDS[cardId];
    if (!card) return { rate: 1, reason: 'Unknown card' };
    const effectiveCat = getEffectiveCategory(category, cardId);
    if (card.multipliers[effectiveCat]) {
      const rate = card.multipliers[effectiveCat];
      return { rate, reason: `${rate}x ${effectiveCat}` };
    }
    return { rate: card.baseRate, reason: `${card.baseRate}x base rate` };
  }

  return getMultiplier(cardId, category, todayStr);
}

/**
 * Reset What If state for a new scenario
 */
function resetWhatIfState() {
  state.whatif = {
    step: 1,
    scenarioType: null,
    addCardId: null,
    removeCardId: null,
    selectedYear: null,
    optimizationRate: null,
    isCustomMode: false,
    shiftAmounts: {},
    creditToggles: {},
    creditAmounts: {},
    removeCreditToggles: {},
    removeCreditAmounts: {},
    walletMismatch: {},
    resultCalculated: false
  };
}

/**
 * Calculate user's current optimization rate from actual spending data.
 * This measures how often users already use the best card for each category.
 * Returns a percentage 0-100.
 */
function calculateOptimizationRate() {
  if (!state.results || !state.results.processed) return 85;
  const year = state.whatif.selectedYear || state.selectedYear;
  const txns = state.results.processed.filter(t => {
    if (t.isPayment || t.isCredit) return false;
    if (year) return getYearFromDateString(t.date) === year;
    return true;
  });
  if (txns.length === 0) return 85;

  // Get all active cards from transactions
  const activeCards = [...new Set(txns.map(t => t.cardId).filter(c => c && c !== 'skip' && CARDS[c]))];
  if (activeCards.length < 2) return 100; // Only one card, always optimal

  let optimalSpend = 0;
  let totalSpend = 0;

  // Group transactions by subcategory
  const byCat = {};
  txns.forEach(t => {
    const sub = t.subcategory || t.category || 'other';
    if (!byCat[sub]) byCat[sub] = [];
    byCat[sub].push(t);
  });

  for (const [sub, catTxns] of Object.entries(byCat)) {
    // Find the best card for this category
    let bestValue = 0;
    for (const cardId of activeCards) {
      const mapped = mapToCardCategory(sub, cardId, catTxns[0]?.date);
      const mult = getMultiplier(cardId, mapped, catTxns[0]?.date);
      const pv = getPointValue(cardId);
      const value = mult.rate * pv;
      if (value > bestValue) bestValue = value;
    }

    for (const t of catTxns) {
      const amt = Math.abs(t.amount);
      totalSpend += amt;
      const mapped = mapToCardCategory(sub, t.cardId, t.date);
      const mult = getMultiplier(t.cardId, mapped, t.date);
      const pv = getPointValue(t.cardId);
      const actualValue = mult.rate * pv;
      if (bestValue > 0 && actualValue >= bestValue) {
        optimalSpend += amt;
      }
    }
  }

  return totalSpend > 0 ? Math.round((optimalSpend / totalSpend) * 100) : 85;
}

/**
 * Calculate the additional rewards value from adding a card.
 * For each transaction where the new card earns more, computes the value difference.
 * Returns { totalGain, rows[], annualizationFactor }
 * rows: { sourceCardId, sourceCardName, subcategory, sourceRate, sourcePointValue,
 *         newCategory, newRate, newPointValue, spend, additionalValue }
 */
function calculateAddCardValue(newCardId, year) {
  if (!state.results || !state.results.processed) return { totalGain: 0, rows: [], annualizationFactor: 1 };
  const newCard = CARDS[newCardId];
  if (!newCard) return { totalGain: 0, rows: [], annualizationFactor: 1 };
  const newPV = getPointValue(newCardId);

  const txns = state.results.processed.filter(t =>
    !t.isPayment && !t.isCredit && !t.isRefund && t.cardId && t.cardId !== 'skip' &&
    t.cardId !== newCardId && CARDS[t.cardId] &&
    getYearFromDateString(t.date) === year
  );

  // Annualization factor
  const months = new Set();
  txns.forEach(t => { const p = parseDateString(t.date); if (p) months.add(p.month); });
  const monthCount = months.size;
  const annualizationFactor = monthCount > 0 && monthCount < 12 ? 12 / monthCount : 1;

  // Use today's date for all category mapping — What If is forward-looking
  const _today = new Date();
  const todayStr = `${_today.getFullYear()}-${String(_today.getMonth()+1).padStart(2,'0')}-${String(_today.getDate()).padStart(2,'0')}`;

  // Aggregate by [sourceCardId + subcategory]
  const buckets = {};
  for (const t of txns) {
    const sub = t.subcategory || t.category || 'other';
    const cardId = t.cardId;
    const cardPV = getPointValue(cardId);
    // Use current rates, not historical
    const currentCat = mapToCardCategory(sub, cardId, todayStr);
    const currentMult = getWhatIfMultiplier(cardId, currentCat);
    const actualRate = currentMult.rate;
    const actualValue = actualRate * cardPV;

    const newCat = mapToCardCategory(sub, newCardId, todayStr);
    const newMult = getWhatIfMultiplier(newCardId, newCat);
    const newValue = newMult.rate * newPV;

    // Only count if the new card has a strictly higher multiplier rate
    if (newMult.rate > actualRate && newValue > actualValue) {
      const key = `${cardId}|${sub}`;
      if (!buckets[key]) {
        buckets[key] = {
          sourceCardId: cardId,
          sourceCardName: CARDS[cardId]?.shortName || CARDS[cardId]?.name || cardId,
          subcategory: sub,
          sourceRate: actualRate,
          sourcePointValue: cardPV,
          newCategory: newCat,
          newRate: newMult.rate,
          newPointValue: newPV,
          spend: 0,
          additionalValue: 0
        };
      }
      const amt = Math.abs(t.amount);
      buckets[key].spend += amt;
      buckets[key].additionalValue += amt * (newValue - actualValue);
    }
  }

  const rows = Object.values(buckets);
  // Apply annualization
  if (annualizationFactor > 1) {
    for (const r of rows) {
      r.spend *= annualizationFactor;
      r.additionalValue *= annualizationFactor;
    }
  }
  // Sort by additional value descending
  rows.sort((a, b) => b.additionalValue - a.additionalValue);

  const totalGain = rows.reduce((sum, r) => sum + r.additionalValue, 0);
  return { totalGain, rows, annualizationFactor };
}

/**
 * Get total credits value for add card based on user toggles/amounts.
 */
function getAddCardCreditsTotal() {
  const wi = state.whatif;
  const card = CARDS[wi.addCardId];
  if (!card || !card.credits) return 0;
  let total = 0;
  for (const cr of card.credits) {
    if (wi.creditToggles[cr.name] !== false) {
      total += (wi.creditAmounts[cr.name] !== undefined ? wi.creditAmounts[cr.name] : cr.amount);
    }
  }
  return total;
}

/**
 * Get annualized spending data for a card in a given year, grouped by subcategory.
 * Returns { factor, categories, subcategories } where subcategories maps
 * subcategory → { spend, points, rate, category (card-effective) }
 */
function getAnnualizedCardSpend(cardId, year) {
  if (!state.results || !state.results.processed) return { factor: 1, categories: {}, subcategories: {} };
  const txns = state.results.processed.filter(t =>
    t.cardId === cardId && !t.isPayment && !t.isCredit &&
    getYearFromDateString(t.date) === year
  );

  // Determine annualization factor
  const months = new Set();
  txns.forEach(t => {
    const parsed = parseDateString(t.date);
    if (parsed) months.add(parsed.month);
  });
  const monthCount = months.size;
  const factor = monthCount > 0 && monthCount < 12 ? 12 / monthCount : 1;

  // Aggregate by card-effective category (kept for backward compat)
  const categories = {};
  // Aggregate by subcategory for granular comparison
  const subcategories = {};
  txns.forEach(t => {
    const cat = t.category || 'other';
    const sub = t.subcategory || cat;
    const amt = Math.abs(t.amount);
    const pts = t.points || 0;
    const mult = t.multiplier || { rate: 1 };

    if (!categories[cat]) categories[cat] = { spend: 0, points: 0 };
    categories[cat].spend += amt;
    categories[cat].points += pts;

    if (!subcategories[sub]) subcategories[sub] = { spend: 0, points: 0, rate: mult.rate, category: cat };
    subcategories[sub].spend += amt;
    subcategories[sub].points += pts;
  });

  // Annualize
  if (factor > 1) {
    for (const d of [...Object.values(categories), ...Object.values(subcategories)]) {
      d.spend *= factor;
      d.points *= factor;
    }
  }

  return { factor, categories, subcategories };
}

/**
 * Format a subcategory name for display: "flights-direct" → "Flights Direct"
 */
function formatSubcategoryName(sub) {
  return sub.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get spending shift rows for "Add a Card" scenario.
 * Compares at subcategory level. Only shows rows where new card earns more value.
 */
function getAddCardShiftRows(newCardId, year) {
  if (!state.results || !state.results.processed) return [];
  const newCard = CARDS[newCardId];
  if (!newCard) return [];

  const activeCardIds = getActiveCardIds(year);
  const newPV = getPointValue(newCardId);
  const rows = [];
  const today = new Date();
  const sampleDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  for (const cardId of activeCardIds) {
    if (cardId === newCardId) continue;
    const card = CARDS[cardId];
    if (!card) continue;
    const cardPV = getPointValue(cardId);
    const { subcategories } = getAnnualizedCardSpend(cardId, year);

    for (const [sub, data] of Object.entries(subcategories)) {
      if (data.spend <= 0) continue;

      // Current card's value for this subcategory
      const currentCat = mapToCardCategory(sub, cardId, sampleDate);
      const currentMult = getWhatIfMultiplier(cardId, currentCat);
      const currentValue = currentMult.rate * cardPV;

      // New card's value for this subcategory
      const newCat = mapToCardCategory(sub, newCardId, sampleDate);
      const newMult = getWhatIfMultiplier(newCardId, newCat);
      const newValue = newMult.rate * newPV;

      // Only count if the new card has a strictly higher multiplier rate
      if (newMult.rate > currentMult.rate && newValue > currentValue) {
        rows.push({
          sourceCardId: cardId,
          sourceCardName: card.shortName || card.name,
          sourceCategory: sub,
          sourceRate: currentMult.rate,
          sourcePointValue: cardPV,
          newCategory: newCat,
          newRate: newMult.rate,
          newPointValue: newPV,
          actualSpend: data.spend
        });
      }
    }
  }

  return rows;
}

/**
 * Get spending shift rows for "Remove a Card" scenario.
 * Compares at subcategory level. Shows ALL subcategories — every dollar must go somewhere.
 * @param {string} removeCardId - Card being removed
 * @param {number} year - Year to analyze
 * @param {string[]} [extraCardIds] - Additional card IDs in the hypothetical wallet (e.g. newly added card in swap)
 */
function getRemoveCardShiftRows(removeCardId, year, extraCardIds) {
  if (!state.results || !state.results.processed) return [];
  const removeCard = CARDS[removeCardId];
  if (!removeCard) return [];

  // Build hypothetical wallet card IDs: current cards minus removed, plus any extras
  let walletCardIds = getActiveCardIds(year).filter(id => id !== removeCardId);
  if (extraCardIds) {
    for (const id of extraCardIds) {
      if (!walletCardIds.includes(id) && CARDS[id]) walletCardIds.push(id);
    }
  }

  const removePV = getPointValue(removeCardId);
  const { subcategories } = getAnnualizedCardSpend(removeCardId, year);
  const today = new Date();
  const sampleDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const rows = [];

  for (const [sub, data] of Object.entries(subcategories)) {
    if (data.spend <= 0) continue;

    // Value on the removed card
    const removeCat = mapToCardCategory(sub, removeCardId, sampleDate);
    const removeMult = getWhatIfMultiplier(removeCardId, removeCat);

    // Find best destination card in hypothetical wallet for this subcategory
    let bestCardId = null;
    let bestValue = 0;
    let bestCat = 'other';
    let bestRate = 1;
    let bestPV = 0.01;

    for (const cardId of walletCardIds) {
      const cardPV = getPointValue(cardId);
      const mapped = mapToCardCategory(sub, cardId, sampleDate);
      const mult = getWhatIfMultiplier(cardId, mapped);
      const val = mult.rate * cardPV;
      if (val > bestValue) {
        bestValue = val;
        bestCardId = cardId;
        bestCat = mapped;
        bestRate = mult.rate;
        bestPV = cardPV;
      }
    }

    // Always show the row — every dollar of removed card spending must be accounted for
    if (bestCardId) {
      rows.push({
        sourceCategory: sub,
        sourceRate: removeMult.rate,
        sourcePointValue: removePV,
        actualSpend: data.spend,
        bestCardId,
        bestCardName: (CARDS[bestCardId]?.shortName || CARDS[bestCardId]?.name || bestCardId),
        bestCategory: bestCat,
        bestRate,
        bestPointValue: bestPV
      });
    }
  }

  return rows;
}

/**
 * Get list of active card IDs from transactions for a given year
 */
function getActiveCardIds(year) {
  if (!state.results || !state.results.processed) return [];
  const txns = state.results.processed.filter(t => {
    if (t.isPayment || !t.cardId || t.cardId === 'skip') return false;
    if (year) return getYearFromDateString(t.date) === year;
    return true;
  });
  return [...new Set(txns.map(t => t.cardId))].filter(id => CARDS[id]);
}

/**
 * Calculate net impact from the confirmed shift amounts and credit settings.
 * Returns { spendingImpact, creditsImpact, feeImpact, totalImpact,
 *   addCreditsTotal, removeFee, addFee, removeCreditsTotal }
 */
function calculateWhatIfNetImpact() {
  const wi = state.whatif;
  let spendingImpact = 0;

  // Spending shifts
  for (const [key, amount] of Object.entries(wi.shiftAmounts)) {
    if (amount <= 0) continue;
    const parts = key.split('|');
    // For add scenario: key = 'sourceCardId|sourceCategory'
    // For remove scenario: key = 'sourceCategory'
    // The row data is needed to compute values - we re-derive from the rows
  }

  // Re-derive from rows for accuracy
  const year = wi.selectedYear;
  const _today = new Date();
  const sampleDate = `${_today.getFullYear()}-${String(_today.getMonth()+1).padStart(2,'0')}-${String(_today.getDate()).padStart(2,'0')}`;

  if (wi.scenarioType === 'add' || wi.scenarioType === 'swap') {
    const addRows = wi.addCardId ? getAddCardShiftRows(wi.addCardId, year) : [];
    for (const row of addRows) {
      const key = `${row.sourceCardId}|${row.sourceCategory}`;
      const amount = wi.shiftAmounts[key] || 0;
      if (amount <= 0) continue;
      const oldValue = amount * row.sourceRate * row.sourcePointValue;
      const newValue = amount * row.newRate * row.newPointValue;
      spendingImpact += (newValue - oldValue);
    }
  }

  if (wi.scenarioType === 'remove' || wi.scenarioType === 'swap') {
    const swapExtras = wi.scenarioType === 'swap' && wi.addCardId ? [wi.addCardId] : undefined;
    const removeRows = wi.removeCardId ? getRemoveCardShiftRows(wi.removeCardId, year, swapExtras) : [];

    // Pre-compute best base-rate value among remaining cards for unshifted spending
    const remainingCards = getActiveCardIds(year).filter(id => id !== wi.removeCardId);
    if (swapExtras) swapExtras.forEach(id => { if (!remainingCards.includes(id) && CARDS[id]) remainingCards.push(id); });
    let bestBaseValue = 0;
    for (const cid of remainingCards) {
      const card = CARDS[cid];
      if (card) {
        const baseVal = (card.baseRate || 1) * getPointValue(cid);
        if (baseVal > bestBaseValue) bestBaseValue = baseVal;
      }
    }

    for (const row of removeRows) {
      const key = `remove|${row.sourceCategory}`;
      const shiftedAmount = wi.shiftAmounts[key] || 0;
      const unshifted = row.actualSpend - shiftedAmount;
      // All spending on removed card loses its current value
      const lostValue = row.actualSpend * row.sourceRate * row.sourcePointValue;
      // Shifted portion earns best-destination value
      const shiftedGain = shiftedAmount * row.bestRate * row.bestPointValue;
      // Unshifted portion falls to catch-all base rate
      const unshiftedGain = unshifted > 0 ? unshifted * bestBaseValue : 0;
      spendingImpact += (shiftedGain + unshiftedGain - lostValue);
    }
  }

  // Credits for added card
  let addCreditsTotal = 0;
  if (wi.addCardId && (wi.scenarioType === 'add' || wi.scenarioType === 'swap')) {
    const addCard = CARDS[wi.addCardId];
    if (addCard && addCard.credits) {
      for (const cr of addCard.credits) {
        const enabled = wi.creditToggles[cr.name] !== false; // default on
        if (enabled) {
          addCreditsTotal += (wi.creditAmounts[cr.name] !== undefined ? wi.creditAmounts[cr.name] : cr.amount);
        }
      }
    }
  }

  // Credits lost from removed card
  let removeCreditsTotal = 0;
  if (wi.removeCardId && (wi.scenarioType === 'remove' || wi.scenarioType === 'swap')) {
    const removeCard = CARDS[wi.removeCardId];
    if (removeCard && removeCard.credits) {
      for (const cr of removeCard.credits) {
        const enabled = wi.removeCreditToggles[cr.name] !== false;
        if (enabled) {
          removeCreditsTotal += (wi.removeCreditAmounts[cr.name] !== undefined ? wi.removeCreditAmounts[cr.name] : cr.amount);
        }
      }
    }
  }

  // Annual fees
  let addFee = 0;
  if (wi.addCardId && (wi.scenarioType === 'add' || wi.scenarioType === 'swap')) {
    addFee = CARDS[wi.addCardId]?.annualFee || 0;
  }
  let removeFee = 0;
  if (wi.removeCardId && (wi.scenarioType === 'remove' || wi.scenarioType === 'swap')) {
    removeFee = CARDS[wi.removeCardId]?.annualFee || 0;
  }

  const creditsImpact = addCreditsTotal - removeCreditsTotal;
  const feeImpact = removeFee - addFee; // Saved fee is positive, new fee is negative
  const totalImpact = spendingImpact + creditsImpact + feeImpact;

  return { spendingImpact, creditsImpact, feeImpact, totalImpact, addCreditsTotal, removeFee, addFee, removeCreditsTotal };
}

/**
 * Get the current wallet value for the selected year (annualized if needed).
 */
function getCurrentWalletValue(year) {
  if (!state.results || !state.results.processed) return 0;
  const txns = state.results.processed.filter(t => {
    if (t.isPayment) return false;
    if (year) return getYearFromDateString(t.date) === year;
    return true;
  });

  let pointsValue = 0;
  let credits = 0;
  txns.forEach(t => {
    if (t.isCredit && !t.isRefund) {
      credits += Math.abs(t.amount);
    } else if (!t.isCredit) {
      pointsValue += t.pointsValue || 0;
    }
  });

  // Annual fees for active cards
  const activeCards = getActiveCardIds(year);
  let totalFees = 0;
  for (const cardId of activeCards) {
    totalFees += CARDS[cardId]?.annualFee || 0;
  }

  // Annualize if partial year
  const months = new Set();
  txns.forEach(t => {
    const parsed = parseDateString(t.date);
    if (parsed) months.add(parsed.month);
  });
  const monthCount = months.size;
  const factor = monthCount > 0 && monthCount < 12 ? 12 / monthCount : 1;

  return (pointsValue + credits) * factor - totalFees;
}

/**
 * Pre-fill shift amounts based on optimization rate.
 */
function prefillShiftAmounts() {
  const wi = state.whatif;
  const rate = (wi.optimizationRate !== null ? wi.optimizationRate : calculateOptimizationRate()) / 100;

  if (wi.scenarioType === 'add' || wi.scenarioType === 'swap') {
    const addRows = wi.addCardId ? getAddCardShiftRows(wi.addCardId, wi.selectedYear) : [];
    for (const row of addRows) {
      const key = `${row.sourceCardId}|${row.sourceCategory}`;
      wi.shiftAmounts[key] = Math.round(row.actualSpend * rate * 100) / 100;
    }
  }

  if (wi.scenarioType === 'remove' || wi.scenarioType === 'swap') {
    const swapExtras = wi.scenarioType === 'swap' && wi.addCardId ? [wi.addCardId] : undefined;
    const removeRows = wi.removeCardId ? getRemoveCardShiftRows(wi.removeCardId, wi.selectedYear, swapExtras) : [];
    for (const row of removeRows) {
      const key = `remove|${row.sourceCategory}`;
      wi.shiftAmounts[key] = Math.round(row.actualSpend * rate * 100) / 100;
    }
  }
}

/**
 * Initialize credit toggles/amounts with defaults for a card.
 */
function initCreditDefaults(cardId, togglesObj, amountsObj) {
  const card = CARDS[cardId];
  if (!card || !card.credits) return;
  for (const cr of card.credits) {
    if (togglesObj[cr.name] === undefined) togglesObj[cr.name] = true;
    if (amountsObj[cr.name] === undefined) amountsObj[cr.name] = cr.amount;
  }
}

/**
 * Build per-row impact value for a shift row.
 */
function getRowImpact(amount, oldRate, oldPV, newRate, newPV) {
  if (amount <= 0) return 0;
  return (amount * newRate * newPV) - (amount * oldRate * oldPV);
}

/**
 * Render the What If view inside viewContainer.
 */
function renderWhatIf() {
  const container = document.getElementById('viewContainer');
  const wi = state.whatif;

  // Pro gate check
  if (window.TIER_CONFIG !== 'pro') {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:48px 24px;">
        <div style="font-size:36px;margin-bottom:12px;">🔮</div>
        <h2 class="card-title" style="margin:0 0 8px;">What If Calculator</h2>
        <p style="color:#78716c;margin-bottom:20px;">Model how adding or removing a card would change your wallet's value.</p>
        <p style="color:#b45309;font-weight:500;">This feature requires Pro access.</p>
      </div>`;
    return;
  }

  if (!state.results || !state.results.processed || state.results.processed.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:48px 24px;">
        <div style="font-size:36px;margin-bottom:12px;">🔮</div>
        <h2 class="card-title" style="margin:0 0 8px;">What If Calculator</h2>
        <p style="color:#78716c;">Upload transaction data first to model scenarios.</p>
      </div>`;
    return;
  }

  // Build breadcrumb — Add goes straight to result at step 4; Remove/Swap keep assumptions step
  const stepLabels = wi.scenarioType === 'add'
    ? ['Scenario', 'Card', 'Year', 'Result']
    : ['Scenario', 'Card', 'Year', 'Assumptions', 'Result'];
  const breadcrumb = stepLabels.map((label, i) => {
    const stepNum = i + 1;
    const cls = stepNum === wi.step ? 'active' : (stepNum < wi.step ? 'done' : '');
    return `<span class="whatif-breadcrumb-step ${cls}">${label}</span>`;
  }).join('<span class="whatif-breadcrumb-sep">›</span>');

  let html = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2 class="card-title" style="margin:0;">What If Calculator</h2>
      ${wi.step > 1 ? '<button class="btn btn-secondary" onclick="resetWhatIfState(); renderView(\'whatif\');" style="font-size:12px;padding:6px 12px;">Start Over</button>' : ''}
    </div>
    <div class="whatif-breadcrumb">${breadcrumb}</div>`;

  if (wi.step === 1) {
    html += renderWhatIfStep1();
  } else if (wi.step === 2) {
    html += renderWhatIfStep2();
  } else if (wi.step === 3) {
    html += renderWhatIfStep3();
  } else if (wi.step === 4) {
    html += renderWhatIfStep4();
  } else if (wi.step === 5) {
    html += renderWhatIfStep5();
  }

  html += '</div>';
  container.innerHTML = html;
  attachWhatIfListeners();
}

function renderWhatIfStep1() {
  const wi = state.whatif;
  return `
    <div class="whatif-step">
      <div class="whatif-step-header">Step 1: What scenario do you want to model?</div>
      <div class="whatif-options">
        <div class="whatif-option ${wi.scenarioType === 'add' ? 'selected' : ''}" data-scenario="add">
          <div class="whatif-option-icon">➕</div>
          <div class="whatif-option-label">Add a Card</div>
          <div class="whatif-option-desc">See if a new card improves your wallet</div>
        </div>
        <div class="whatif-option ${wi.scenarioType === 'remove' ? 'selected' : ''}" data-scenario="remove">
          <div class="whatif-option-icon">➖</div>
          <div class="whatif-option-label">Remove a Card</div>
          <div class="whatif-option-desc">See if dropping a card saves money</div>
        </div>
        <div class="whatif-option ${wi.scenarioType === 'swap' ? 'selected' : ''}" data-scenario="swap">
          <div class="whatif-option-icon">🔄</div>
          <div class="whatif-option-label">Swap a Card</div>
          <div class="whatif-option-desc">Replace one card with another</div>
        </div>
      </div>
      <div class="whatif-nav">
        <div></div>
        <button class="btn btn-primary" id="whatifNext1" ${!wi.scenarioType ? 'disabled' : ''}>Next →</button>
      </div>
    </div>`;
}

function renderWhatIfStep2() {
  const wi = state.whatif;
  const activeCardIds = getActiveCardIds(wi.selectedYear || state.selectedYear);

  // All available cards for adding (not already in wallet)
  const allCardIds = Object.keys(CARDS).filter(id => id !== 'skip');
  const addOptions = allCardIds.filter(id => !activeCardIds.includes(id));
  const removeOptions = activeCardIds;

  let cardSelectors = '';

  if (wi.scenarioType === 'add') {
    cardSelectors = `
      <div class="whatif-step-header">Step 2: Which card would you add?</div>
      <select class="form-select whatif-card-select" id="whatifAddCard">
        <option value="">Select a card...</option>
        ${addOptions.map(id => `<option value="${id}" ${wi.addCardId === id ? 'selected' : ''}>${escapeHtml(CARDS[id].name)} (${formatCurrency(CARDS[id].annualFee)}/yr)</option>`).join('')}
        ${activeCardIds.length > 0 ? `<optgroup label="Already in wallet">${activeCardIds.map(id => `<option value="${id}" ${wi.addCardId === id ? 'selected' : ''}>${escapeHtml(CARDS[id].name)} (already have)</option>`).join('')}</optgroup>` : ''}
      </select>`;
  } else if (wi.scenarioType === 'remove') {
    cardSelectors = `
      <div class="whatif-step-header">Step 2: Which card would you remove?</div>
      <select class="form-select whatif-card-select" id="whatifRemoveCard">
        <option value="">Select a card...</option>
        ${removeOptions.map(id => `<option value="${id}" ${wi.removeCardId === id ? 'selected' : ''}>${escapeHtml(CARDS[id].name)}</option>`).join('')}
      </select>`;
  } else if (wi.scenarioType === 'swap') {
    cardSelectors = `
      <div class="whatif-step-header">Step 2: Which cards are you swapping?</div>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:500;color:#57534e;display:block;margin-bottom:4px;">Card to remove:</label>
        <select class="form-select whatif-card-select" id="whatifRemoveCard">
          <option value="">Select a card...</option>
          ${removeOptions.map(id => `<option value="${id}" ${wi.removeCardId === id ? 'selected' : ''}>${escapeHtml(CARDS[id].name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:13px;font-weight:500;color:#57534e;display:block;margin-bottom:4px;">Card to add:</label>
        <select class="form-select whatif-card-select" id="whatifAddCard">
          <option value="">Select a card...</option>
          ${allCardIds.map(id => `<option value="${id}" ${wi.addCardId === id ? 'selected' : ''}>${escapeHtml(CARDS[id].name)} (${formatCurrency(CARDS[id].annualFee)}/yr)</option>`).join('')}
        </select>
      </div>`;
  }

  const canProceed = (wi.scenarioType === 'add' && wi.addCardId) ||
                     (wi.scenarioType === 'remove' && wi.removeCardId) ||
                     (wi.scenarioType === 'swap' && wi.addCardId && wi.removeCardId);

  return `
    <div class="whatif-step">
      ${cardSelectors}
      <div class="whatif-nav">
        <button class="btn btn-secondary" id="whatifBack2">← Back</button>
        <button class="btn btn-primary" id="whatifNext2" ${!canProceed ? 'disabled' : ''}>Next →</button>
      </div>
    </div>`;
}

function renderWhatIfStep3() {
  const wi = state.whatif;
  const years = state.availableYears.length > 0
    ? state.availableYears
    : [...new Set(state.results.processed.map(t => getYearFromDateString(t.date)))].sort((a, b) => b - a);

  return `
    <div class="whatif-step">
      <div class="whatif-step-header">Step 3: Which year's spending should we analyze?</div>
      <select class="form-select whatif-card-select" id="whatifYear">
        ${years.map(y => `<option value="${y}" ${wi.selectedYear === y ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
      <p style="font-size:12px;color:#78716c;margin-top:8px;">We'll use your actual spending from this year to model the scenario.</p>
      <div class="whatif-nav">
        <button class="btn btn-secondary" id="whatifBack3">← Back</button>
        <button class="btn btn-primary" id="whatifNext3">Next →</button>
      </div>
    </div>`;
}

function renderWhatIfStep4() {
  const wi = state.whatif;

  if (wi.scenarioType === 'add') {
    // Add scenario goes straight to result — no assumption review
    return renderStep4Add();
  }

  // Remove/Swap: initialize optimization rate and pre-fill shift amounts
  if (wi.optimizationRate === null) {
    wi.optimizationRate = calculateOptimizationRate();
  }
  if (!wi.isCustomMode) {
    prefillShiftAmounts();
  }

  if (wi.scenarioType === 'remove') {
    return renderStep4Remove();
  } else if (wi.scenarioType === 'swap') {
    return renderStep4Swap();
  }
  return '';
}

function renderStep4Add() {
  const wi = state.whatif;
  const addCard = CARDS[wi.addCardId];
  if (!addCard) return '<p>Card not found.</p>';

  // Initialize credit defaults
  initCreditDefaults(wi.addCardId, wi.creditToggles, wi.creditAmounts);

  // Calculate value
  const { totalGain, rows, annualizationFactor } = calculateAddCardValue(wi.addCardId, wi.selectedYear);
  const creditsTotal = getAddCardCreditsTotal();
  const annualFee = addCard.annualFee || 0;
  const netImpact = totalGain + creditsTotal - annualFee;
  const isPositive = netImpact >= 0;
  const cardName = addCard.shortName || addCard.name;

  let html = `<div class="whatif-step">`;

  // Headline
  html += `<div class="whatif-result-headline">
    <div style="font-size:16px;color:#57534e;margin-bottom:8px;">
      Adding ${escapeHtml(cardName)} could ${isPositive ? 'earn you an estimated' : 'cost you an estimated'}
    </div>
    <div class="whatif-result-amount ${isPositive ? 'positive' : 'negative'}" id="whatifAddHeadline">
      ~${isPositive ? '+' : '-'}${formatCurrencyPrecise(Math.abs(netImpact))}/yr
    </div>
  </div>`;

  // Compact summary
  html += `<div style="max-width:360px;margin:0 auto 20px;font-size:14px;line-height:2;">
    <div style="display:flex;justify-content:space-between;">
      <span>Credits</span>
      <span class="mono" style="font-weight:600;color:#059669;" id="whatifAddCreditsLine">+${formatCurrencyPrecise(creditsTotal)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>Spend rewards</span>
      <span class="mono" style="font-weight:600;color:#059669;" id="whatifAddRewardsLine">+${formatCurrencyPrecise(totalGain)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>Annual fee</span>
      <span class="mono" style="font-weight:600;color:#dc2626;">-${formatCurrencyPrecise(annualFee)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;border-top:2px solid #e7e5e4;padding-top:4px;margin-top:4px;">
      <span style="font-weight:600;">Estimated net impact</span>
      <span class="mono" style="font-weight:700;color:${isPositive ? '#059669' : '#dc2626'};" id="whatifAddNetTop">~${isPositive ? '+' : '-'}${formatCurrencyPrecise(Math.abs(netImpact))}</span>
    </div>
  </div>`;

  // Disclosure note
  html += `<p style="font-size:12px;color:#78716c;text-align:center;max-width:480px;margin:0 auto 24px;line-height:1.5;">
    This estimate assumes you always use the new card when it earns more. The actual value will likely be lower due to a small amount of sub-optimal spend throughout the year.
  </p>`;

  // === Ledger section: Credits, Spend Rewards (collapsible), Annual Fee, Total ===
  html += `<div style="max-width:540px;margin:0 auto;">`;

  // Credits (with toggles)
  html += renderCreditAssumptions(wi.addCardId, wi.creditToggles, wi.creditAmounts, 'add');

  // Spend Rewards — collapsible row with value on the right
  html += `<div style="margin-top:16px;border-top:1px solid #e7e5e4;padding-top:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" id="whatifAddRewardsToggle">
      <span style="font-size:13px;font-weight:600;color:#57534e;">
        <span class="toggle-arrow" style="font-size:10px;margin-right:4px;">▼</span>Additional Spend Rewards
      </span>
      <span class="mono" style="font-weight:600;color:#059669;font-size:14px;" id="whatifAddRewardsValue">+${formatCurrencyPrecise(totalGain)}</span>
    </div>
    <div class="hidden" id="whatifAddRewardsDetail" style="margin-top:12px;">`;

  if (rows.length > 0) {
    html += `<div class="whatif-shift-table-wrap"><table class="whatif-shift-table">
      <thead><tr>
        <th>Source Card</th><th>Subcategory</th><th>Actual Rate</th>
        <th>New Rate</th>
        <th class="text-right">Spend</th><th class="text-right">Additional Value</th>
      </tr></thead><tbody>`;

    for (const row of rows) {
      html += `<tr>
        <td>${escapeHtml(row.sourceCardName)}</td>
        <td>${escapeHtml(formatSubcategoryName(row.subcategory))}</td>
        <td class="mono">${row.sourceRate}x</td>
        <td class="mono">${row.newRate}x</td>
        <td class="text-right mono">${formatCurrencyPrecise(row.spend)}</td>
        <td class="text-right whatif-impact positive">+${formatCurrencyPrecise(row.additionalValue)}</td>
      </tr>`;
    }

    html += `<tr style="font-weight:600;border-top:2px solid #e7e5e4;">
      <td colspan="4"></td>
      <td class="text-right mono">${formatCurrencyPrecise(rows.reduce((s, r) => s + r.spend, 0))}</td>
      <td class="text-right whatif-impact positive">+${formatCurrencyPrecise(totalGain)}</td>
    </tr></tbody></table></div>`;
  } else {
    html += `<div style="padding:16px;text-align:center;color:#78716c;background:#f5f5f4;border-radius:8px;font-size:13px;">
      No spending categories where ${escapeHtml(cardName)} earns more value than your current cards.
    </div>`;
  }

  if (annualizationFactor > 1) {
    html += `<p style="font-size:11px;color:#a8a29e;margin-top:8px;">Amounts annualized from ${Math.round(12 / annualizationFactor)} months of data.</p>`;
  }

  html += `</div></div>`; // end rewards detail + rewards section

  // Annual fee
  html += `<div class="whatif-annual-fee" style="margin-top:12px;">
    <span class="whatif-annual-fee-label">Annual Fee</span>
    <span class="whatif-annual-fee-value">-${formatCurrencyPrecise(annualFee)}</span>
  </div>`;

  // Total line
  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:2px solid #1c1917;margin-top:8px;">
    <span style="font-size:14px;font-weight:700;">Estimated Net Impact</span>
    <span class="mono" style="font-weight:700;font-size:16px;color:${isPositive ? '#059669' : '#dc2626'};" id="whatifAddNetLine">~${isPositive ? '+' : '-'}${formatCurrencyPrecise(Math.abs(netImpact))}</span>
  </div>`;

  html += `</div>`; // end ledger

  html += `<div class="whatif-nav">
    <button class="btn btn-secondary" id="whatifBack4">← Back</button>
    <button class="btn btn-secondary" onclick="resetWhatIfState(); renderView('whatif');">Start New Scenario</button>
  </div></div>`;

  return html;
}

function renderStep4Remove() {
  const wi = state.whatif;
  const removeCard = CARDS[wi.removeCardId];
  if (!removeCard) return '<p>Card not found.</p>';

  const rows = getRemoveCardShiftRows(wi.removeCardId, wi.selectedYear);
  const sliderVal = wi.optimizationRate;

  // Initialize credit defaults for removed card
  initCreditDefaults(wi.removeCardId, wi.removeCreditToggles, wi.removeCreditAmounts);

  let html = `
    <div class="whatif-step">
      <div class="whatif-step-header">Step 4: Review Assumptions — Removing ${escapeHtml(removeCard.shortName || removeCard.name)}</div>`;

  // Optimization slider
  html += renderOptimizationSlider(sliderVal, wi.isCustomMode);

  // Spending redistribution table
  if (rows.length > 0) {
    html += `<div class="whatif-shift-table-wrap"><table class="whatif-shift-table">
      <thead><tr>
        <th>From Card</th><th>Category</th><th>Rate</th><th>Redirect Amount</th>
        <th></th>
        <th>To Card</th><th>Category</th><th>Rate</th>
        <th class="text-right">Impact</th>
      </tr></thead><tbody>`;

    let totalImpact = 0;
    for (const row of rows) {
      const key = `remove|${row.sourceCategory}`;
      const amount = wi.shiftAmounts[key] || 0;
      const rowImpact = getRowImpact(amount, row.sourceRate, row.sourcePointValue, row.bestRate, row.bestPointValue);
      totalImpact += rowImpact;

      html += `<tr>
        <td>${escapeHtml(removeCard.shortName || removeCard.name)}</td>
        <td>${escapeHtml(formatSubcategoryName(row.sourceCategory))}</td>
        <td class="mono">${row.sourceRate}x</td>
        <td><input type="number" class="whatif-shift-input" data-key="${escapeHtml(key)}" data-max="${row.actualSpend.toFixed(2)}" value="${amount.toFixed(0)}" min="0" max="${row.actualSpend.toFixed(2)}" step="1"></td>
        <td class="whatif-shift-arrow">→</td>
        <td>${escapeHtml(row.bestCardName)}</td>
        <td>${escapeHtml(formatSubcategoryName(row.bestCategory))}</td>
        <td class="mono">${row.bestRate}x</td>
        <td class="text-right whatif-impact ${rowImpact >= 0 ? 'positive' : 'negative'}">${rowImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(rowImpact)}</td>
      </tr>`;
    }

    html += `<tr style="font-weight:600;border-top:2px solid #e7e5e4;">
      <td colspan="8" class="text-right">Total spending shift impact:</td>
      <td class="text-right whatif-impact ${totalImpact >= 0 ? 'positive' : 'negative'}">${totalImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(totalImpact)}</td>
    </tr></tbody></table></div>`;
  } else {
    html += `<div style="padding:20px;text-align:center;color:#78716c;background:#f5f5f4;border-radius:8px;">
      No spending found on ${escapeHtml(removeCard.shortName || removeCard.name)} for ${wi.selectedYear}.
    </div>`;
  }

  // Lost credits
  html += renderCreditAssumptions(wi.removeCardId, wi.removeCreditToggles, wi.removeCreditAmounts, 'remove');

  // Saved annual fee
  html += `<div class="whatif-annual-fee">
    <span class="whatif-annual-fee-label">Saved Annual Fee</span>
    <span class="whatif-annual-fee-value" style="color:#059669;">+${formatCurrency(removeCard.annualFee)}</span>
  </div>`;

  // Summary line
  const impact = calculateWhatIfNetImpact();
  html += renderSummaryLine('remove', impact);

  html += `<div class="whatif-nav">
    <button class="btn btn-secondary" id="whatifBack4">← Back</button>
    <button class="btn btn-primary" id="whatifCalculate">See Results →</button>
  </div></div>`;

  return html;
}

function renderStep4Swap() {
  const wi = state.whatif;
  const addCard = CARDS[wi.addCardId];
  const removeCard = CARDS[wi.removeCardId];
  if (!addCard || !removeCard) return '<p>Cards not found.</p>';

  const sliderVal = wi.optimizationRate;
  initCreditDefaults(wi.addCardId, wi.creditToggles, wi.creditAmounts);
  initCreditDefaults(wi.removeCardId, wi.removeCreditToggles, wi.removeCreditAmounts);

  let html = `
    <div class="whatif-step">
      <div class="whatif-step-header">Step 4: Review Assumptions — Swapping ${escapeHtml(removeCard.shortName || removeCard.name)} → ${escapeHtml(addCard.shortName || addCard.name)}</div>`;

  html += renderOptimizationSlider(sliderVal, wi.isCustomMode);

  // Section 1: Spending leaving the removed card
  html += `<h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;color:#dc2626;">Spending leaving ${escapeHtml(removeCard.shortName || removeCard.name)}</h3>`;
  const removeRows = getRemoveCardShiftRows(wi.removeCardId, wi.selectedYear, wi.addCardId ? [wi.addCardId] : undefined);
  if (removeRows.length > 0) {
    html += `<div class="whatif-shift-table-wrap"><table class="whatif-shift-table">
      <thead><tr><th>Category</th><th>Rate</th><th>Redirect Amount</th><th></th><th>To Card</th><th>Category</th><th>Rate</th><th class="text-right">Impact</th></tr></thead><tbody>`;
    for (const row of removeRows) {
      const key = `remove|${row.sourceCategory}`;
      const amount = wi.shiftAmounts[key] || 0;
      const rowImpact = getRowImpact(amount, row.sourceRate, row.sourcePointValue, row.bestRate, row.bestPointValue);
      html += `<tr>
        <td>${escapeHtml(formatSubcategoryName(row.sourceCategory))}</td>
        <td class="mono">${row.sourceRate}x</td>
        <td><input type="number" class="whatif-shift-input" data-key="${escapeHtml(key)}" data-max="${row.actualSpend.toFixed(2)}" value="${amount.toFixed(0)}" min="0" max="${row.actualSpend.toFixed(2)}" step="1"></td>
        <td class="whatif-shift-arrow">→</td>
        <td>${escapeHtml(row.bestCardName)}</td>
        <td>${escapeHtml(formatSubcategoryName(row.bestCategory))}</td>
        <td class="mono">${row.bestRate}x</td>
        <td class="text-right whatif-impact ${rowImpact >= 0 ? 'positive' : 'negative'}">${rowImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(rowImpact)}</td>
      </tr>`;
    }
    html += '</tbody></table></div>';
  }

  // Lost credits from removed card
  html += renderCreditAssumptions(wi.removeCardId, wi.removeCreditToggles, wi.removeCreditAmounts, 'remove');
  html += `<div class="whatif-annual-fee">
    <span class="whatif-annual-fee-label">Saved Annual Fee (${escapeHtml(removeCard.shortName || removeCard.name)})</span>
    <span class="whatif-annual-fee-value" style="color:#059669;">+${formatCurrency(removeCard.annualFee)}</span>
  </div>`;

  html += '<hr class="whatif-section-sep">';

  // Section 2: Spending shifting to new card
  html += `<h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;color:#059669;">Spending shifting to ${escapeHtml(addCard.shortName || addCard.name)}</h3>`;
  const addRows = getAddCardShiftRows(wi.addCardId, wi.selectedYear);
  if (addRows.length > 0) {
    html += `<div class="whatif-shift-table-wrap"><table class="whatif-shift-table">
      <thead><tr><th>From Card</th><th>Category</th><th>Rate</th><th>Shift Amount</th><th></th><th>Category</th><th>Rate</th><th class="text-right">Impact</th></tr></thead><tbody>`;
    for (const row of addRows) {
      const key = `${row.sourceCardId}|${row.sourceCategory}`;
      const amount = wi.shiftAmounts[key] || 0;
      const rowImpact = getRowImpact(amount, row.sourceRate, row.sourcePointValue, row.newRate, row.newPointValue);
      html += `<tr>
        <td>${escapeHtml(row.sourceCardName)}</td>
        <td>${escapeHtml(formatSubcategoryName(row.sourceCategory))}</td>
        <td class="mono">${row.sourceRate}x</td>
        <td><input type="number" class="whatif-shift-input" data-key="${escapeHtml(key)}" data-max="${row.actualSpend.toFixed(2)}" value="${amount.toFixed(0)}" min="0" max="${row.actualSpend.toFixed(2)}" step="1"></td>
        <td class="whatif-shift-arrow">→</td>
        <td>${escapeHtml(formatSubcategoryName(row.newCategory))}</td>
        <td class="mono">${row.newRate}x</td>
        <td class="text-right whatif-impact ${rowImpact >= 0 ? 'positive' : 'negative'}">${rowImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(rowImpact)}</td>
      </tr>`;
    }
    html += '</tbody></table></div>';
  }

  // New card credits
  html += renderCreditAssumptions(wi.addCardId, wi.creditToggles, wi.creditAmounts, 'add');
  html += `<div class="whatif-annual-fee">
    <span class="whatif-annual-fee-label">Annual Fee (${escapeHtml(addCard.shortName || addCard.name)})</span>
    <span class="whatif-annual-fee-value">-${formatCurrency(addCard.annualFee)}</span>
  </div>`;

  // Combined summary
  const impact = calculateWhatIfNetImpact();
  html += renderSummaryLine('swap', impact);

  html += `<div class="whatif-nav">
    <button class="btn btn-secondary" id="whatifBack4">← Back</button>
    <button class="btn btn-primary" id="whatifCalculate">See Results →</button>
  </div></div>`;

  return html;
}

function renderOptimizationSlider(value, isCustom) {
  return `
    <div class="whatif-slider-wrap">
      <div class="whatif-slider-label">
        <span>How often would you use the best card for each category?</span>
        <span class="whatif-slider-value ${isCustom ? 'custom' : ''}" id="whatifSliderLabel">${isCustom ? 'Custom' : value + '%'}</span>
      </div>
      <input type="range" class="whatif-slider ${isCustom ? 'inactive' : ''}" id="whatifSlider" min="0" max="100" step="5" value="${value}">
      ${isCustom ? '<span class="whatif-slider-reset" id="whatifSliderReset">Reset to slider</span>' : ''}
    </div>`;
}

function renderCreditAssumptions(cardId, toggles, amounts, mode) {
  const card = CARDS[cardId];
  if (!card || !card.credits || card.credits.length === 0) return '';
  const label = mode === 'remove' ? 'Lost Credits' : 'Credit Assumptions';
  const prefix = mode === 'remove' ? 'remove-' : 'add-';

  let html = `<div class="whatif-credits">
    <div style="font-size:13px;font-weight:600;color:#57534e;margin-bottom:8px;">${label} — ${escapeHtml(card.shortName || card.name)}</div>`;

  for (const cr of card.credits) {
    const enabled = toggles[cr.name] !== false;
    const amount = amounts[cr.name] !== undefined ? amounts[cr.name] : cr.amount;
    html += `<div class="whatif-credit-row">
      <div class="whatif-credit-toggle ${enabled ? 'on' : ''}" data-credit="${escapeHtml(cr.name)}" data-prefix="${prefix}"></div>
      <span class="whatif-credit-name">${escapeHtml(cr.name)}</span>
      <input type="number" class="whatif-credit-amount" data-credit="${escapeHtml(cr.name)}" data-prefix="${prefix}" value="${amount.toFixed(0)}" min="0" max="${cr.amount}" step="1" ${!enabled ? 'disabled' : ''}>
    </div>`;
  }

  html += '</div>';
  return html;
}

function renderSummaryLine(scenarioType, impact) {
  const isPositive = impact.totalImpact >= 0;
  const wi = state.whatif;
  let cardName = '';
  if (scenarioType === 'add') cardName = CARDS[wi.addCardId]?.shortName || CARDS[wi.addCardId]?.name || '';
  else if (scenarioType === 'remove') cardName = CARDS[wi.removeCardId]?.shortName || CARDS[wi.removeCardId]?.name || '';
  else cardName = (CARDS[wi.removeCardId]?.shortName || CARDS[wi.removeCardId]?.name || '') + ' → ' + (CARDS[wi.addCardId]?.shortName || CARDS[wi.addCardId]?.name || '');

  const verb = scenarioType === 'add' ? 'adding' : scenarioType === 'remove' ? 'removing' : 'swapping';

  let parts = [];
  if (impact.spendingImpact !== 0) parts.push(`~${impact.spendingImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(impact.spendingImpact)} from spending shifts`);

  if (scenarioType === 'add' || scenarioType === 'swap') {
    if (impact.addCreditsTotal > 0) parts.push(`+${formatCurrencyPrecise(impact.addCreditsTotal)} from credits`);
    if (impact.addFee > 0) parts.push(`-${formatCurrencyPrecise(impact.addFee)} annual fee`);
  }
  if (scenarioType === 'remove' || scenarioType === 'swap') {
    if (impact.removeCreditsTotal > 0) parts.push(`-${formatCurrencyPrecise(impact.removeCreditsTotal)} lost credits`);
    if (impact.removeFee > 0) parts.push(`+${formatCurrencyPrecise(impact.removeFee)} saved annual fee`);
  }

  return `
    <div class="whatif-summary-line ${isPositive ? '' : 'negative'}" id="whatifSummary">
      Net impact of ${verb} ${escapeHtml(cardName)}: ${parts.join(' + ')} = <strong>${impact.totalImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(impact.totalImpact)} estimated annual change</strong>
    </div>`;
}

function renderWhatIfStep5() {
  const wi = state.whatif;
  const impact = calculateWhatIfNetImpact();
  const currentValue = getCurrentWalletValue(wi.selectedYear);
  const hypotheticalValue = currentValue + impact.totalImpact;
  const isPositive = impact.totalImpact >= 0;

  let cardName = '';
  let verb = '';
  if (wi.scenarioType === 'add') {
    cardName = CARDS[wi.addCardId]?.shortName || CARDS[wi.addCardId]?.name || '';
    verb = 'Adding';
  } else if (wi.scenarioType === 'remove') {
    cardName = CARDS[wi.removeCardId]?.shortName || CARDS[wi.removeCardId]?.name || '';
    verb = 'Removing';
  } else {
    cardName = (CARDS[wi.removeCardId]?.shortName || '') + ' → ' + (CARDS[wi.addCardId]?.shortName || '');
    verb = 'Swapping';
  }

  // Annualization info
  const txns = state.results.processed.filter(t =>
    !t.isPayment && wi.selectedYear && getYearFromDateString(t.date) === wi.selectedYear
  );
  const monthSet = new Set();
  txns.forEach(t => { const p = parseDateString(t.date); if (p) monthSet.add(p.month); });
  const annualized = monthSet.size > 0 && monthSet.size < 12;

  let html = `
    <div class="whatif-step">
      <div class="whatif-result-headline">
        <div style="font-size:16px;color:#57534e;margin-bottom:8px;">${verb} ${escapeHtml(cardName)} could ${isPositive ? 'increase' : 'decrease'} your estimated annual value by</div>
        <div class="whatif-result-amount ${isPositive ? 'positive' : 'negative'}">~${isPositive ? '+' : ''}${formatCurrencyPrecise(impact.totalImpact)}</div>
        <div class="whatif-result-compact">
          <div>Current wallet: <span>${formatCurrencyPrecise(currentValue)}</span></div>
          <div>→</div>
          <div>Hypothetical wallet: <span>${formatCurrencyPrecise(hypotheticalValue)}</span></div>
        </div>
      </div>
      <div class="whatif-context">
        Optimization rate: ${wi.optimizationRate}%${wi.isCustomMode ? ' (custom adjustments)' : ''} • Year: ${wi.selectedYear}${annualized ? ` (annualized from ${monthSet.size} months)` : ''}
      </div>`;

  // Detail section (collapsed by default)
  html += `
    <div class="whatif-detail-toggle" id="whatifDetailToggle">▼ See the details</div>
    <div class="whatif-detail-section hidden" id="whatifDetailSection">
      ${renderDetailSection()}
    </div>`;

  html += `<div class="whatif-nav">
    <button class="btn btn-secondary" id="whatifBack5">← Edit Assumptions</button>
    <button class="btn btn-secondary" onclick="resetWhatIfState(); renderView('whatif');">Start New Scenario</button>
  </div></div>`;

  return html;
}

/**
 * Render the detailed per-card breakdown for current vs hypothetical wallets.
 */
function renderDetailSection() {
  const wi = state.whatif;
  const year = wi.selectedYear;
  const activeCards = getActiveCardIds(year);
  const _today = new Date();
  const sampleDate = `${_today.getFullYear()}-${String(_today.getMonth()+1).padStart(2,'0')}-${String(_today.getDate()).padStart(2,'0')}`;

  // Build current wallet data
  const currentWallet = [];
  for (const cardId of activeCards) {
    const card = CARDS[cardId];
    if (!card) continue;
    const { factor, categories } = getAnnualizedCardSpend(cardId, year);
    let spend = 0, points = 0, pointsValue = 0;
    for (const [cat, data] of Object.entries(categories)) {
      spend += data.spend;
      points += data.points;
    }
    const pv = getPointValue(cardId);
    pointsValue = points * pv;
    const annualFee = card.annualFee || 0;

    // Calculate credits (simple — use actual detected credits for this year)
    let credits = 0;
    const txns = state.results.processed.filter(t =>
      t.cardId === cardId && t.isCredit && !t.isRefund && !t.isPayment &&
      getYearFromDateString(t.date) === year
    );
    txns.forEach(t => credits += Math.abs(t.amount));
    if (factor > 1) credits *= factor;

    const netValue = pointsValue + credits - annualFee;
    currentWallet.push({ cardId, cardName: card.shortName || card.name, spend, points, pointsValue, credits, annualFee, netValue, categories });
  }

  // Build hypothetical wallet
  const hypotheticalWallet = currentWallet.map(c => ({
    ...c,
    categories: { ...c.categories },
    hypothetical: false,
    estimated: !!wi.walletMismatch[c.cardId]
  }));

  // Apply shifts for "add" scenario
  if (wi.scenarioType === 'add' || wi.scenarioType === 'swap') {
    const addRows = wi.addCardId ? getAddCardShiftRows(wi.addCardId, wi.selectedYear) : [];
    let newCardSpend = 0, newCardPoints = 0, newCardPointsValue = 0;
    const newCardCategories = {};

    for (const row of addRows) {
      const key = `${row.sourceCardId}|${row.sourceCategory}`;
      const amount = wi.shiftAmounts[key] || 0;
      if (amount <= 0) continue;

      // Deduct from source card in hypothetical
      const sourceEntry = hypotheticalWallet.find(c => c.cardId === row.sourceCardId);
      if (sourceEntry) {
        if (sourceEntry.categories[row.sourceCategory]) {
          sourceEntry.categories[row.sourceCategory] = {
            spend: Math.max(0, sourceEntry.categories[row.sourceCategory].spend - amount),
            points: Math.max(0, sourceEntry.categories[row.sourceCategory].points - (amount * row.sourceRate))
          };
        }
        sourceEntry.spend = Math.max(0, sourceEntry.spend - amount);
        const reducedPoints = amount * row.sourceRate;
        sourceEntry.points = Math.max(0, sourceEntry.points - reducedPoints);
        sourceEntry.pointsValue = sourceEntry.points * getPointValue(row.sourceCardId);
        sourceEntry.netValue = sourceEntry.pointsValue + sourceEntry.credits - sourceEntry.annualFee;
      }

      // Add to new card
      if (!newCardCategories[row.newCategory]) newCardCategories[row.newCategory] = { spend: 0, points: 0 };
      newCardCategories[row.newCategory].spend += amount;
      newCardCategories[row.newCategory].points += amount * row.newRate;
      newCardSpend += amount;
      newCardPoints += amount * row.newRate;
    }

    const addCard = CARDS[wi.addCardId];
    const addPV = getPointValue(wi.addCardId);
    newCardPointsValue = newCardPoints * addPV;

    // Credits for new card
    let addCredits = 0;
    if (addCard && addCard.credits) {
      for (const cr of addCard.credits) {
        if (wi.creditToggles[cr.name] !== false) {
          addCredits += (wi.creditAmounts[cr.name] !== undefined ? wi.creditAmounts[cr.name] : cr.amount);
        }
      }
    }

    const addFee = addCard?.annualFee || 0;
    const addNetValue = newCardPointsValue + addCredits - addFee;

    hypotheticalWallet.push({
      cardId: wi.addCardId,
      cardName: (addCard?.shortName || addCard?.name || wi.addCardId) + ' (new)',
      spend: newCardSpend,
      points: newCardPoints,
      pointsValue: newCardPointsValue,
      credits: addCredits,
      annualFee: addFee,
      netValue: addNetValue,
      categories: newCardCategories,
      hypothetical: true
    });
  }

  // Apply shifts for "remove" scenario
  if (wi.scenarioType === 'remove' || wi.scenarioType === 'swap') {
    // Remove the card from hypothetical wallet
    const removeIdx = hypotheticalWallet.findIndex(c => c.cardId === wi.removeCardId);
    if (removeIdx >= 0) {
      hypotheticalWallet.splice(removeIdx, 1);
    }

    // Apply spending redistribution
    const swapExtrasDetail = wi.scenarioType === 'swap' && wi.addCardId ? [wi.addCardId] : undefined;
    const removeRows = getRemoveCardShiftRows(wi.removeCardId, wi.selectedYear, swapExtrasDetail);
    for (const row of removeRows) {
      const key = `remove|${row.sourceCategory}`;
      const amount = wi.shiftAmounts[key] || 0;
      if (amount <= 0) continue;

      const destEntry = hypotheticalWallet.find(c => c.cardId === row.bestCardId);
      if (destEntry) {
        if (!destEntry.categories[row.bestCategory]) destEntry.categories[row.bestCategory] = { spend: 0, points: 0 };
        destEntry.categories[row.bestCategory].spend += amount;
        destEntry.categories[row.bestCategory].points += amount * row.bestRate;
        destEntry.spend += amount;
        destEntry.points += amount * row.bestRate;
        destEntry.pointsValue = destEntry.points * getPointValue(row.bestCardId);
        destEntry.netValue = destEntry.pointsValue + destEntry.credits - destEntry.annualFee;
      }
    }
  }

  // Render tables
  let html = `
    <div class="whatif-detail-wallet">
      <div class="whatif-detail-wallet-title">Current Wallet</div>
      ${renderWalletTable(currentWallet)}
    </div>
    <div class="whatif-detail-wallet">
      <div class="whatif-detail-wallet-title">Hypothetical Wallet</div>
      ${renderWalletTable(hypotheticalWallet)}
    </div>`;

  return html;
}

function renderWalletTable(walletEntries) {
  if (walletEntries.length === 0) return '<p style="color:#78716c;font-size:13px;">No cards.</p>';
  let totalSpend = 0, totalPtsVal = 0, totalCredits = 0, totalFees = 0, totalNet = 0;

  let html = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr>
      <th style="text-align:left;padding:8px 6px;border-bottom:2px solid #e7e5e4;font-size:11px;text-transform:uppercase;color:#78716c;">Card</th>
      <th class="text-right" style="padding:8px 6px;border-bottom:2px solid #e7e5e4;font-size:11px;text-transform:uppercase;color:#78716c;">Spend</th>
      <th class="text-right" style="padding:8px 6px;border-bottom:2px solid #e7e5e4;font-size:11px;text-transform:uppercase;color:#78716c;">Pts Value</th>
      <th class="text-right" style="padding:8px 6px;border-bottom:2px solid #e7e5e4;font-size:11px;text-transform:uppercase;color:#78716c;">Credits</th>
      <th class="text-right" style="padding:8px 6px;border-bottom:2px solid #e7e5e4;font-size:11px;text-transform:uppercase;color:#78716c;">Ann. Fee</th>
      <th class="text-right" style="padding:8px 6px;border-bottom:2px solid #e7e5e4;font-size:11px;text-transform:uppercase;color:#78716c;">Net Value</th>
    </tr></thead><tbody>`;

  for (const c of walletEntries) {
    totalSpend += c.spend;
    totalPtsVal += c.pointsValue;
    totalCredits += c.credits;
    totalFees += c.annualFee;
    totalNet += c.netValue;
    const nameExtra = c.estimated ? ' <span style="font-size:10px;color:#b45309;">(estimated)</span>' : '';
    const nameStyle = c.hypothetical ? 'color:#059669;font-weight:600;' : '';

    html += `<tr>
      <td style="padding:8px 6px;border-bottom:1px solid #f5f5f4;${nameStyle}">${escapeHtml(c.cardName)}${nameExtra}</td>
      <td class="text-right mono" style="padding:8px 6px;border-bottom:1px solid #f5f5f4;">${formatCurrencyPrecise(c.spend)}</td>
      <td class="text-right mono" style="padding:8px 6px;border-bottom:1px solid #f5f5f4;">${formatCurrencyPrecise(c.pointsValue)}</td>
      <td class="text-right mono" style="padding:8px 6px;border-bottom:1px solid #f5f5f4;">${formatCurrencyPrecise(c.credits)}</td>
      <td class="text-right mono" style="padding:8px 6px;border-bottom:1px solid #f5f5f4;color:#dc2626;">-${formatCurrency(c.annualFee)}</td>
      <td class="text-right mono" style="padding:8px 6px;border-bottom:1px solid #f5f5f4;font-weight:600;color:${c.netValue >= 0 ? '#166534' : '#dc2626'};">${formatCurrencyPrecise(c.netValue)}</td>
    </tr>`;
  }

  html += `<tr style="font-weight:600;border-top:2px solid #e7e5e4;">
    <td style="padding:8px 6px;">Total</td>
    <td class="text-right mono" style="padding:8px 6px;">${formatCurrencyPrecise(totalSpend)}</td>
    <td class="text-right mono" style="padding:8px 6px;">${formatCurrencyPrecise(totalPtsVal)}</td>
    <td class="text-right mono" style="padding:8px 6px;">${formatCurrencyPrecise(totalCredits)}</td>
    <td class="text-right mono" style="padding:8px 6px;color:#dc2626;">-${formatCurrency(totalFees)}</td>
    <td class="text-right mono" style="padding:8px 6px;color:${totalNet >= 0 ? '#166534' : '#dc2626'};">${formatCurrencyPrecise(totalNet)}</td>
  </tr></tbody></table></div>`;

  return html;
}

/**
 * Attach all event listeners for the current What If step.
 */
function attachWhatIfListeners() {
  const wi = state.whatif;

  // Step 1: Scenario selection
  document.querySelectorAll('.whatif-option[data-scenario]').forEach(opt => {
    opt.addEventListener('click', () => {
      wi.scenarioType = opt.dataset.scenario;
      renderView('whatif');
    });
  });

  // Step 1 Next
  const next1 = document.getElementById('whatifNext1');
  if (next1) next1.addEventListener('click', () => { wi.step = 2; renderView('whatif'); });

  // Step 2: Card selection
  const addCardSel = document.getElementById('whatifAddCard');
  if (addCardSel) addCardSel.addEventListener('change', (e) => {
    wi.addCardId = e.target.value || null;
    const next2 = document.getElementById('whatifNext2');
    if (next2) next2.disabled = !canProceedStep2();
  });

  const removeCardSel = document.getElementById('whatifRemoveCard');
  if (removeCardSel) removeCardSel.addEventListener('change', (e) => {
    wi.removeCardId = e.target.value || null;
    const next2 = document.getElementById('whatifNext2');
    if (next2) next2.disabled = !canProceedStep2();
  });

  // Step 2 navigation
  const back2 = document.getElementById('whatifBack2');
  if (back2) back2.addEventListener('click', () => { wi.step = 1; renderView('whatif'); });
  const next2 = document.getElementById('whatifNext2');
  if (next2) next2.addEventListener('click', () => {
    wi.step = 3;
    // Default year to most recent
    if (!wi.selectedYear && state.availableYears.length > 0) {
      wi.selectedYear = state.availableYears[0];
    }
    renderView('whatif');
  });

  // Step 3: Year selection
  const yearSel = document.getElementById('whatifYear');
  if (yearSel) yearSel.addEventListener('change', (e) => {
    wi.selectedYear = parseInt(e.target.value);
  });

  const back3 = document.getElementById('whatifBack3');
  if (back3) back3.addEventListener('click', () => { wi.step = 2; renderView('whatif'); });
  const next3 = document.getElementById('whatifNext3');
  if (next3) next3.addEventListener('click', () => {
    if (!wi.selectedYear && state.availableYears.length > 0) {
      wi.selectedYear = state.availableYears[0];
    }
    // Reset shift amounts and custom mode when entering step 4
    wi.isCustomMode = false;
    wi.optimizationRate = null;
    wi.shiftAmounts = {};
    wi.step = 4;
    renderView('whatif');
  });

  // Step 4: Assumption review
  const back4 = document.getElementById('whatifBack4');
  if (back4) back4.addEventListener('click', () => { wi.step = 3; renderView('whatif'); });

  // Optimization slider
  const slider = document.getElementById('whatifSlider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      wi.optimizationRate = val;
      wi.isCustomMode = false;
      wi.shiftAmounts = {};
      renderView('whatif');
    });
  }

  // Reset to slider button
  const resetBtn = document.getElementById('whatifSliderReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      wi.isCustomMode = false;
      wi.shiftAmounts = {};
      renderView('whatif');
    });
  }

  // Shift amount inputs
  document.querySelectorAll('.whatif-shift-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const key = e.target.dataset.key;
      const max = parseFloat(e.target.dataset.max);
      let val = parseFloat(e.target.value) || 0;

      // Validation: clamp to 0..max
      if (val < 0) val = 0;
      if (val > max) val = max;
      e.target.value = val.toFixed(0);

      if (val < 0 || val > max) {
        e.target.classList.add('invalid');
      } else {
        e.target.classList.remove('invalid');
      }

      wi.shiftAmounts[key] = val;
      wi.isCustomMode = true;

      // Update summary and impacts without full re-render
      updateWhatIfSummary();
    });
  });

  // Credit toggles
  document.querySelectorAll('.whatif-credit-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const creditName = toggle.dataset.credit;
      const prefix = toggle.dataset.prefix;
      const togglesObj = prefix === 'remove-' ? wi.removeCreditToggles : wi.creditToggles;

      togglesObj[creditName] = !toggle.classList.contains('on');
      toggle.classList.toggle('on');

      // Enable/disable amount input
      const row = toggle.parentElement;
      const amountInput = row.querySelector('.whatif-credit-amount');
      if (amountInput) amountInput.disabled = !togglesObj[creditName];

      if (wi.scenarioType === 'add') { updateAddCardResult(); } else { updateWhatIfSummary(); }
    });
  });

  // Credit amount inputs
  document.querySelectorAll('.whatif-credit-amount').forEach(input => {
    input.addEventListener('change', (e) => {
      const creditName = e.target.dataset.credit;
      const prefix = e.target.dataset.prefix;
      const amountsObj = prefix === 'remove-' ? wi.removeCreditAmounts : wi.creditAmounts;
      let val = parseFloat(e.target.value) || 0;
      if (val < 0) val = 0;
      const max = parseFloat(e.target.max) || Infinity;
      if (val > max) val = max;
      e.target.value = val.toFixed(0);
      amountsObj[creditName] = val;
      if (wi.scenarioType === 'add') { updateAddCardResult(); } else { updateWhatIfSummary(); }
    });
  });

  // Calculate button
  const calcBtn = document.getElementById('whatifCalculate');
  if (calcBtn) calcBtn.addEventListener('click', () => {
    wi.resultCalculated = true;
    wi.step = 5;
    renderView('whatif');
  });

  // Step 5 navigation
  const back5 = document.getElementById('whatifBack5');
  if (back5) back5.addEventListener('click', () => { wi.step = 4; renderView('whatif'); });

  // Detail toggles
  const detailToggle = document.getElementById('whatifDetailToggle');
  if (detailToggle) {
    detailToggle.addEventListener('click', () => {
      const section = document.getElementById('whatifDetailSection');
      if (section) {
        const isHidden = section.classList.contains('hidden');
        section.classList.toggle('hidden');
        detailToggle.textContent = isHidden ? '▲ Hide the details' : '▼ See the details';
      }
    });
  }

  // Spend rewards collapsible toggle
  const rewardsToggle = document.getElementById('whatifAddRewardsToggle');
  if (rewardsToggle) {
    rewardsToggle.addEventListener('click', () => {
      const detail = document.getElementById('whatifAddRewardsDetail');
      const arrow = rewardsToggle.querySelector('.toggle-arrow');
      if (detail) {
        const isHidden = detail.classList.contains('hidden');
        detail.classList.toggle('hidden');
        if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
      }
    });
  }
}

function canProceedStep2() {
  const wi = state.whatif;
  if (wi.scenarioType === 'add') return !!wi.addCardId;
  if (wi.scenarioType === 'remove') return !!wi.removeCardId;
  if (wi.scenarioType === 'swap') return !!wi.addCardId && !!wi.removeCardId;
  return false;
}

/**
 * Update the summary line and per-row impacts without a full re-render.
 */
/**
 * Update Add card result headline and breakdown dynamically when credits change.
 */
function updateAddCardResult() {
  const wi = state.whatif;
  const addCard = CARDS[wi.addCardId];
  if (!addCard) return;

  const { totalGain } = calculateAddCardValue(wi.addCardId, wi.selectedYear);
  const creditsTotal = getAddCardCreditsTotal();
  const annualFee = addCard.annualFee || 0;
  const netImpact = totalGain + creditsTotal - annualFee;
  const isPositive = netImpact >= 0;

  // Update headline
  const headlineEl = document.getElementById('whatifAddHeadline');
  if (headlineEl) {
    headlineEl.textContent = `~${isPositive ? '+' : '-'}${formatCurrencyPrecise(Math.abs(netImpact))}/yr`;
    headlineEl.className = `whatif-result-amount ${isPositive ? 'positive' : 'negative'}`;
  }

  // Update top compact summary
  const creditsLineEl = document.getElementById('whatifAddCreditsLine');
  if (creditsLineEl) creditsLineEl.textContent = `+${formatCurrencyPrecise(creditsTotal)}`;

  const netTopEl = document.getElementById('whatifAddNetTop');
  if (netTopEl) {
    netTopEl.textContent = `~${isPositive ? '+' : '-'}${formatCurrencyPrecise(Math.abs(netImpact))}`;
    netTopEl.style.color = isPositive ? '#059669' : '#dc2626';
  }

  // Update bottom ledger total
  const netLineEl = document.getElementById('whatifAddNetLine');
  if (netLineEl) {
    netLineEl.textContent = `~${isPositive ? '+' : '-'}${formatCurrencyPrecise(Math.abs(netImpact))}`;
    netLineEl.style.color = isPositive ? '#059669' : '#dc2626';
  }
}

function updateWhatIfSummary() {
  const impact = calculateWhatIfNetImpact();
  const summaryEl = document.getElementById('whatifSummary');
  if (summaryEl) {
    const wi = state.whatif;
    const isPositive = impact.totalImpact >= 0;
    summaryEl.className = 'whatif-summary-line' + (isPositive ? '' : ' negative');

    let cardName = '';
    let verb = '';
    if (wi.scenarioType === 'add') { cardName = CARDS[wi.addCardId]?.shortName || CARDS[wi.addCardId]?.name || ''; verb = 'adding'; }
    else if (wi.scenarioType === 'remove') { cardName = CARDS[wi.removeCardId]?.shortName || CARDS[wi.removeCardId]?.name || ''; verb = 'removing'; }
    else { cardName = (CARDS[wi.removeCardId]?.shortName || '') + ' → ' + (CARDS[wi.addCardId]?.shortName || ''); verb = 'swapping'; }

    let parts = [];
    if (impact.spendingImpact !== 0) parts.push(`~${impact.spendingImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(impact.spendingImpact)} from spending shifts`);
    if (wi.scenarioType === 'add' || wi.scenarioType === 'swap') {
      if (impact.addCreditsTotal > 0) parts.push(`+${formatCurrencyPrecise(impact.addCreditsTotal)} from credits`);
      if (impact.addFee > 0) parts.push(`-${formatCurrencyPrecise(impact.addFee)} annual fee`);
    }
    if (wi.scenarioType === 'remove' || wi.scenarioType === 'swap') {
      if (impact.removeCreditsTotal > 0) parts.push(`-${formatCurrencyPrecise(impact.removeCreditsTotal)} lost credits`);
      if (impact.removeFee > 0) parts.push(`+${formatCurrencyPrecise(impact.removeFee)} saved annual fee`);
    }

    summaryEl.innerHTML = `Net impact of ${verb} ${escapeHtml(cardName)}: ${parts.join(' + ')} = <strong>${impact.totalImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(impact.totalImpact)} estimated annual change</strong>`;
  }

  // Update per-row impacts
  document.querySelectorAll('.whatif-shift-input').forEach(input => {
    const key = input.dataset.key;
    const amount = parseFloat(input.value) || 0;
    const row = input.closest('tr');
    if (!row) return;
    const impactCell = row.querySelector('.whatif-impact');
    if (!impactCell) return;

    // Re-derive the rates from the row data
    // We need to find the matching row in our data
    const wi = state.whatif;
    let rowImpact = 0;

    if (key.startsWith('remove|')) {
      const cat = key.replace('remove|', '');
      const swapExtrasUpd = wi.scenarioType === 'swap' && wi.addCardId ? [wi.addCardId] : undefined;
      const removeRows = getRemoveCardShiftRows(wi.removeCardId, wi.selectedYear, swapExtrasUpd);
      const matchRow = removeRows.find(r => r.sourceCategory === cat);
      if (matchRow) {
        rowImpact = getRowImpact(amount, matchRow.sourceRate, matchRow.sourcePointValue, matchRow.bestRate, matchRow.bestPointValue);
      }
    } else {
      const [srcCard, srcCat] = key.split('|');
      const addRows = getAddCardShiftRows(wi.addCardId, wi.selectedYear);
      const matchRow = addRows.find(r => r.sourceCardId === srcCard && r.sourceCategory === srcCat);
      if (matchRow) {
        rowImpact = getRowImpact(amount, matchRow.sourceRate, matchRow.sourcePointValue, matchRow.newRate, matchRow.newPointValue);
      }
    }

    impactCell.className = 'text-right whatif-impact ' + (rowImpact >= 0 ? 'positive' : 'negative');
    impactCell.textContent = `${rowImpact >= 0 ? '+' : ''}${formatCurrencyPrecise(rowImpact)}`;
  });
}

// =============================================================================
// END WHAT IF CALCULATOR
// =============================================================================

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

      // Add streaming credits (Paramount+ or Peacock)
      if (availableCredits.some(cr => cr.streamingBenefit)) {
        const streamingForCard = state.streamingCredits[c.cardId] || {};
        let streamingTotal = 0;
        if (displayYear) {
          const yd = streamingForCard[displayYear] || {};
          for (const svc of Object.values(yd)) {
            streamingTotal += svc === 'paramount' ? 7.99 : (svc === 'peacock' ? 10.99 : 0);
          }
        } else {
          for (const yd of Object.values(streamingForCard)) {
            if (typeof yd === 'object') {
              for (const svc of Object.values(yd)) {
                streamingTotal += svc === 'paramount' ? 7.99 : (svc === 'peacock' ? 10.99 : 0);
              }
            }
          }
        }
        totalCredits += streamingTotal;
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
      const showCardYearToggle = displayYear && canShowCardYearToggle(c.cardId) && isCardEditable(c.cardId, 'config');
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

    // Add streaming credits (Paramount+ or Peacock) to credits used map
    for (const [cardId, yearMap] of Object.entries(state.streamingCredits)) {
      if (!creditsUsedByCard[cardId]) creditsUsedByCard[cardId] = {};
      const cardDef = CARDS[cardId];
      if (!cardDef || !cardDef.credits?.some(cr => cr.streamingBenefit)) continue;

      let streamingTotal = 0;
      if (displayYear) {
        const yd = yearMap[displayYear] || {};
        for (const svc of Object.values(yd)) {
          streamingTotal += svc === 'paramount' ? 7.99 : (svc === 'peacock' ? 10.99 : 0);
        }
      } else {
        for (const yd of Object.values(yearMap)) {
          if (typeof yd === 'object') {
            for (const svc of Object.values(yd)) {
              streamingTotal += svc === 'paramount' ? 7.99 : (svc === 'peacock' ? 10.99 : 0);
            }
          }
        }
      }
      if (streamingTotal > 0) {
        creditsUsedByCard[cardId]['Paramount+ or Peacock'] = (creditsUsedByCard[cardId]['Paramount+ or Peacock'] || 0) + streamingTotal;
        totalManualCredits += streamingTotal;
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
                const showCardYearToggle = displayYear && canShowCardYearToggle(c.cardId) && isCardEditable(c.cardId, 'config');
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

                // Decision Pass indicator - shows when this card has an active Decision Pass (free tier only)
                const hasDPActive = hasActiveDecisionPass(c.cardId);
                const dpBadgeHtml = (window.TIER_CONFIG !== 'pro' && hasDPActive) ? `
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
                        ${availableCredits.some(cr => cr.streamingBenefit) ? (() => {
                          const streamUsed = displayCreditsUsed['Paramount+ or Peacock'] || 0;
                          return `
                          <div style="margin-bottom:6px;">
                            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                              <span>Paramount+ / Peacock ⚡</span>
                              <span>$${streamUsed.toFixed(0)}</span>
                            </div>
                          </div>`;
                        })() : ''}
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
          // Count low-confidence transactions actionable by this tier
          const lowConfCount = getVisibleLowConfidenceTransactions(r.processed).length;
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
      if (needsReview) txns = txns.filter(t => isNeedsReviewVisible(t));

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

      // Add streaming credits (Paramount+ or Peacock) for transaction view
      for (const cardId of filteredCardIds) {
        const cardDef = CARDS[cardId];
        if (!cardDef?.credits?.some(cr => cr.streamingBenefit)) continue;
        const streamingForCard = state.streamingCredits[cardId] || {};
        let streamingTotal = 0;
        if (yearFilter) {
          const yd = streamingForCard[yearFilter] || {};
          for (const svc of Object.values(yd)) {
            streamingTotal += svc === 'paramount' ? 7.99 : (svc === 'peacock' ? 10.99 : 0);
          }
        } else {
          for (const yd of Object.values(streamingForCard)) {
            if (typeof yd === 'object') {
              for (const svc of Object.values(yd)) {
                streamingTotal += svc === 'paramount' ? 7.99 : (svc === 'peacock' ? 10.99 : 0);
              }
            }
          }
        }
        totalManualCredits += streamingTotal;
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
          ${isNeedsReviewVisible(t) ? '<span title="Low confidence - may need review" style="color:#b45309;">⚠️ </span>' : ''}${t.isCredit && !t.isPayment && isCardEditable(t.cardId, 'category') ? `
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

  if (view === 'whatif') {
    renderWhatIf();
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
    customAnnualBonusPoints: state.customAnnualBonusPoints,
    streamingCredits: state.streamingCredits
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
                           'biltConfig', 'columnMappings', 'streamingCredits'];
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
        const prunedTxns = pruneTransactionsForStorage(backup.transactions);
        state.savedTransactions = prunedTxns;
        state.transactions = prunedTxns;
        safeLocalStorageSet('ccTracker_transactions', prunedTxns);
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
      if (backup.streamingCredits) {
        state.streamingCredits = backup.streamingCredits;
        safeLocalStorageSet('ccTracker_streamingCredits', backup.streamingCredits);
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

// Check for cross-source overlap: incoming transactions from a different CSV format
// for the same card(s) and overlapping date range as stored transactions.
// Returns an array of warning messages (empty if no overlap detected).
function detectCrossSourceOverlap(newTransactions, savedTransactions) {
  const warnings = [];
  const suppressWarning = safeLocalStorageGet('ccTracker_suppressSourceWarning', false);
  if (suppressWarning) return warnings;

  // Group incoming transactions by last4
  const newByCard = {};
  for (const t of newTransactions) {
    if (!t.last4 || !t.sourceFormat || !t.date) continue;
    if (!newByCard[t.last4]) newByCard[t.last4] = [];
    newByCard[t.last4].push(t);
  }

  for (const [last4, incoming] of Object.entries(newByCard)) {
    // Get the source format(s) of incoming transactions for this card
    const incomingFormats = new Set(incoming.map(t => t.sourceFormat));

    // Get stored transactions for this card that have a sourceFormat
    const stored = savedTransactions.filter(t => t.last4 === last4 && t.sourceFormat);
    if (stored.length === 0) continue;

    // Check if stored transactions have a different format
    const storedFormats = new Set(stored.map(t => t.sourceFormat));
    const hasDifferentFormat = [...incomingFormats].some(f => !storedFormats.has(f));
    if (!hasDifferentFormat) continue;

    // Check date range overlap (±2 days tolerance)
    const incomingDates = incoming.map(t => new Date(t.date).getTime()).filter(d => !isNaN(d));
    const storedDates = stored.map(t => new Date(t.date).getTime()).filter(d => !isNaN(d));
    if (incomingDates.length === 0 || storedDates.length === 0) continue;

    const inMin = Math.min(...incomingDates);
    const inMax = Math.max(...incomingDates);
    const stMin = Math.min(...storedDates);
    const stMax = Math.max(...storedDates);

    const twoDays = 2 * 24 * 60 * 60 * 1000;

    // Overlap if incoming range is within ±2 days of stored range
    if (inMin <= stMax + twoDays && inMax >= stMin - twoDays) {
      warnings.push(last4);
    }
  }

  return warnings;
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

  // Prune stored transactions BEFORE conflict detection so expired data
  // outside the tier's time window can't trigger false overlap warnings
  state.savedTransactions = pruneTransactionsForStorage(state.savedTransactions);
  safeLocalStorageSet('ccTracker_transactions', state.savedTransactions);

  // Check for cross-source duplicate risk before merging
  const overlapCards = detectCrossSourceOverlap(newTransactions, state.savedTransactions);
  if (overlapCards.length > 0) {
    showLoading(false);
    const cardList = overlapCards.map(l4 => '...' + l4).join(', ');
    const proceed = await showSourceFormatWarning(cardList);
    if (!proceed) {
      // User cancelled — do not merge; replicate full cancelColumnsBtn cleanup
      document.getElementById('columnMappingSection').classList.add('hidden');
      // Reset file inputs so the same file can be re-selected
      document.getElementById('fileInput').value = '';
      document.getElementById('newFileInput').value = '';
      // Restore the prior visible section
      if (state.savedTransactions.length > 0 && state.results) {
        document.getElementById('resultsSection').classList.remove('hidden');
      } else {
        document.getElementById('uploadSection').classList.remove('hidden');
      }
      return;
    }
    showLoading(true, 'Merging transactions...');
  }

  // Merge with existing transactions (dedupe by ID)
  const existingIds = new Set(state.savedTransactions.map(t => t.id));
  const uniqueNew = newTransactions.filter(t => !existingIds.has(t.id));

  // Combine: new unique + existing
  state.transactions = [...uniqueNew, ...state.savedTransactions];

  // Sort by date descending
  state.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Prune transactions outside the tier-appropriate data window before saving
  state.transactions = pruneTransactionsForStorage(state.transactions);

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

// Show the cross-source format warning modal and return a promise
// that resolves to true (proceed) or false (cancel).
function showSourceFormatWarning(cardList) {
  return new Promise((resolve) => {
    const modal = document.getElementById('sourceFormatWarningModal');
    const cardSpan = document.getElementById('sourceFormatCardList');
    const proceedBtn = document.getElementById('sourceFormatProceed');
    const cancelBtn = document.getElementById('sourceFormatCancel');
    const closeBtn = document.getElementById('closeSourceFormatWarning');
    const checkbox = document.getElementById('sourceFormatDontShow');

    cardSpan.textContent = cardList;
    if (checkbox) checkbox.checked = false;
    modal.classList.remove('hidden');

    function cleanup(result) {
      modal.classList.add('hidden');
      proceedBtn.removeEventListener('click', onProceed);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      resolve(result);
    }

    function onProceed() {
      if (checkbox && checkbox.checked) {
        safeLocalStorageSet('ccTracker_suppressSourceWarning', true);
      }
      cleanup(true);
    }

    function onCancel() {
      cleanup(false);
    }

    function onBackdrop(e) {
      if (e.target === modal) cleanup(false);
    }

    proceedBtn.addEventListener('click', onProceed);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
  });
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
async function initCore() {
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
      state.streamingCredits = {};
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
      localStorage.removeItem('ccTracker_streamingCredits');
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
          state.streamingCredits = {};
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
            alert('Switched to Decision Pass. ' + (window.TIER_CONFIG === 'free' ? 'Reloading...' : 'Redirecting...'));
            if (window.TIER_CONFIG === 'free') { window.location.reload(); } else { window.location.href = 'app.html'; }
          } else if (versionChoice === '3') {
            // Set up Pro access
            const testPro = {
              key: 'TESTPRO-SWITCH',
              activatedAt: Date.now()
            };
            state.proAccess = testPro;
            state.decisionPasses = [];
            localStorage.setItem('ccTracker_proAccess', JSON.stringify(testPro));
            alert('Switched to Pro. ' + (window.TIER_CONFIG === 'pro' ? 'Reloading...' : 'Redirecting...'));
            if (window.TIER_CONFIG === 'pro') { window.location.reload(); } else { window.location.href = 'app-pro.html'; }
          } else {
            // Base version - clear all tier access
            state.decisionPasses = [];
            state.proAccess = null;
            alert('Switched to Base version. ' + (window.TIER_CONFIG === 'free' ? 'Reloading...' : 'Redirecting...'));
            if (window.TIER_CONFIG === 'free') { window.location.reload(); } else { window.location.href = 'app.html'; }
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
      const comingSoonModal = document.getElementById('comingSoonModal');
      if (comingSoonModal) {
        comingSoonModal.classList.remove('hidden');
      }
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
    // Re-prune stored transactions against current date window (rolls forward daily)
    const prunedCount = state.savedTransactions.length;
    state.savedTransactions = pruneTransactionsForStorage(state.savedTransactions);
    if (state.savedTransactions.length < prunedCount) {
      safeLocalStorageSet('ccTracker_transactions', state.savedTransactions);
    }

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

      // Save streaming credits (Paramount+/Peacock)
      safeLocalStorageSet('ccTracker_streamingCredits', state.streamingCredits);
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
  
  // Initialize tutorial system (help, tour, guidance - defined in tutorial.js)
  initTutorial();
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
