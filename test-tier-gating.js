// Test script for Decision Pass tier gating
// Verifies: DP cards get pro features, non-DP cards retain free-tier behavior
// Run: node test-tier-gating.js

// ─── Minimal browser environment mock ────────────────────────────────────────
global.window = { CardTracker: { cards: {}, classification: {} } };
global.localStorage = { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = v; } };
global.Date._realNow = Date.now;

// Stub card definitions (only need IDs to exist)
window.CardTracker.cards['chase-sapphire-reserve'] = { name: 'Chase Sapphire Reserve' };
window.CardTracker.cards['amex-gold'] = { name: 'Amex Gold' };
window.CardTracker.cards['chase-freedom-flex'] = { name: 'Chase Freedom Flex' };

// Classification constants
const CONFIDENCE_THRESHOLD = 50;
window.CardTracker.classification.CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLD;

// ─── Mutable state (reset between test groups) ──────────────────────────────
const DECISION_PASS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

let state;
function resetState() {
  state = {
    decisionPasses: [],
    proAccess: null,
  };
}
resetState();

// ─── Functions under test (copied from app-core.js to avoid loading 5900-line file) ──
function getActiveDecisionPasses() {
  const now = Date.now();
  return state.decisionPasses.filter(dp => (now - dp.activatedAt) <= DECISION_PASS_DURATION_MS);
}

function hasActiveDecisionPass(cardId) {
  return getActiveDecisionPasses().some(dp => dp.cardId === cardId);
}

function getActiveDecisionPassLookup() {
  const lookup = {};
  getActiveDecisionPasses().forEach(dp => { lookup[dp.cardId] = true; });
  return lookup;
}

function isCardEditable(cardId, editType = 'config') {
  if (window.TIER_CONFIG === 'pro') return true;
  if (hasActiveDecisionPass(cardId)) return true;
  return false;
}

function isNeedsReviewVisible(t, dpLookup) {
  if (t.isPayment || t.confidence >= CONFIDENCE_THRESHOLD) return false;
  if (window.TIER_CONFIG === 'pro' || window.TIER_CONFIG === 'free') return true;
  const lookup = dpLookup || getActiveDecisionPassLookup();
  return !!lookup[t.cardId];
}

function getVisibleLowConfidenceTransactions(transactions) {
  const dpLookup = getActiveDecisionPassLookup();
  return transactions.filter(t => isNeedsReviewVisible(t, dpLookup));
}

function parseDateString(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return { date: d };
}

const FREE_DATA_MONTHS = 12;
const PRO_DATA_MONTHS = 72;

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
    if (isPro) return parsed.date >= proCutoff;
    if (dpLookup[t.cardId]) return parsed.date >= dpCutoff;
    return parsed.date >= freeCutoff;
  });
}

// ─── Test harness (matches project style) ────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

function assertEq(actual, expected, testName) {
  if (actual === expected) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${testName} — expected "${expected}", got "${actual}"`);
    failed++;
  }
}

// ─── Helper: make a transaction ──────────────────────────────────────────────
function makeTxn({ cardId, confidence = 30, isPayment = false, date = '2026-01-15' } = {}) {
  return { cardId, confidence, isPayment, date, id: `txn-${Math.random().toString(36).slice(2, 8)}` };
}

// Activate a DP for a card (active right now)
function activateDP(cardId) {
  state.decisionPasses.push({ key: 'TESTDP-001', cardId, activatedAt: Date.now() });
}

// Activate an expired DP (8 days ago)
function activateExpiredDP(cardId) {
  state.decisionPasses.push({ key: 'TESTDP-EXPIRED', cardId, activatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
}

// =============================================================================
// Test 1: DP card gets pro-level editability
// =============================================================================
console.log('\n=== Test 1: DP card gets pro-level editability ===');
resetState();
window.TIER_CONFIG = 'free';
activateDP('chase-sapphire-reserve');

assertEq(isCardEditable('chase-sapphire-reserve', 'config'), true,
  'DP card: config editable');
assertEq(isCardEditable('chase-sapphire-reserve', 'category'), true,
  'DP card: category editable (can reclassify)');
assertEq(isCardEditable('chase-sapphire-reserve', 'credits'), true,
  'DP card: credits editable');

// =============================================================================
// Test 2: Non-DP card stays read-only for free user
// =============================================================================
console.log('\n=== Test 2: Non-DP card stays read-only ===');
// state still has DP only for chase-sapphire-reserve

assertEq(isCardEditable('amex-gold', 'config'), false,
  'Non-DP card: config NOT editable');
assertEq(isCardEditable('amex-gold', 'category'), false,
  'Non-DP card: category NOT editable');
assertEq(isCardEditable('amex-gold', 'credits'), false,
  'Non-DP card: credits NOT editable');
assertEq(isCardEditable('chase-freedom-flex', 'config'), false,
  'Second non-DP card: config NOT editable');

// =============================================================================
// Test 3: Expired DP card reverts to read-only
// =============================================================================
console.log('\n=== Test 3: Expired DP reverts to read-only ===');
resetState();
window.TIER_CONFIG = 'free';
activateExpiredDP('chase-sapphire-reserve');

assertEq(isCardEditable('chase-sapphire-reserve', 'config'), false,
  'Expired DP card: config NOT editable');
assertEq(isCardEditable('chase-sapphire-reserve', 'category'), false,
  'Expired DP card: category NOT editable');

// =============================================================================
// Test 4: Pro tier — all cards editable regardless of DP
// =============================================================================
console.log('\n=== Test 4: Pro tier — all cards editable ===');
resetState();
window.TIER_CONFIG = 'pro';

assertEq(isCardEditable('chase-sapphire-reserve'), true,
  'Pro: CSR editable (no DP needed)');
assertEq(isCardEditable('amex-gold'), true,
  'Pro: Amex Gold editable (no DP needed)');
assertEq(isCardEditable('chase-freedom-flex'), true,
  'Pro: CFF editable (no DP needed)');

// =============================================================================
// Test 5: Low-confidence badges visible for FREE on all cards
// =============================================================================
console.log('\n=== Test 5: Free tier — low-confidence badges visible on ALL cards ===');
resetState();
window.TIER_CONFIG = 'free';

const freeTxns = [
  makeTxn({ cardId: 'chase-sapphire-reserve', confidence: 30 }),
  makeTxn({ cardId: 'amex-gold', confidence: 20 }),
  makeTxn({ cardId: 'chase-freedom-flex', confidence: 45 }),
  makeTxn({ cardId: 'amex-gold', confidence: 80 }),        // high confidence
  makeTxn({ cardId: 'chase-sapphire-reserve', isPayment: true, confidence: 0 }), // payment
];

assert(isNeedsReviewVisible(freeTxns[0]),
  'Free: low-conf CSR txn visible (badge shows)');
assert(isNeedsReviewVisible(freeTxns[1]),
  'Free: low-conf Amex Gold txn visible (badge shows)');
assert(isNeedsReviewVisible(freeTxns[2]),
  'Free: low-conf CFF txn visible (badge shows)');
assert(!isNeedsReviewVisible(freeTxns[3]),
  'Free: high-conf txn NOT visible');
assert(!isNeedsReviewVisible(freeTxns[4]),
  'Free: payment txn NOT visible');

const freeVisible = getVisibleLowConfidenceTransactions(freeTxns);
assertEq(freeVisible.length, 3,
  'Free: getVisibleLowConfidenceTransactions returns 3 (all low-conf non-payments)');

// =============================================================================
// Test 6: DP tier — badges only on DP-activated card
// =============================================================================
console.log('\n=== Test 6: DP tier — badges only on DP-activated card ===');
resetState();
window.TIER_CONFIG = 'free';
activateDP('chase-sapphire-reserve');  // Only CSR has DP

const dpTxns = [
  makeTxn({ cardId: 'chase-sapphire-reserve', confidence: 30 }),
  makeTxn({ cardId: 'amex-gold', confidence: 20 }),
  makeTxn({ cardId: 'chase-freedom-flex', confidence: 45 }),
  makeTxn({ cardId: 'chase-sapphire-reserve', confidence: 10 }),
];

// Wait — when TIER_CONFIG is 'free', isNeedsReviewVisible returns true for all.
// The DP gating only kicks in when TIER_CONFIG is neither 'free' nor 'pro'.
// But in the real app, free users with a DP still have TIER_CONFIG = 'free' (set by app.js).
// So free users always see ALL badges. The DP-only filtering is a "middle tier" that
// doesn't exist in the current app. Let me verify this is the intended behavior.
//
// Re-reading the code: the DP filtering in isNeedsReviewVisible triggers when
// TIER_CONFIG is not 'pro' and not 'free'. This would only apply if there's a
// third TIER_CONFIG value. Looking at the code, there isn't one — TIER_CONFIG is
// always 'free' or 'pro'. So the DP filtering on badges is future-proofing.
//
// For now, a DP user on the free app sees ALL badges (because TIER_CONFIG = 'free').

assert(isNeedsReviewVisible(dpTxns[0]),
  'DP user (free app): CSR low-conf visible');
assert(isNeedsReviewVisible(dpTxns[1]),
  'DP user (free app): Amex Gold low-conf visible (free sees all badges)');
assert(isNeedsReviewVisible(dpTxns[2]),
  'DP user (free app): CFF low-conf visible (free sees all badges)');

const dpVisible = getVisibleLowConfidenceTransactions(dpTxns);
assertEq(dpVisible.length, 4,
  'DP user (free app): all 4 low-conf txns visible as badges');

// =============================================================================
// Test 7: DP card editability is per-card (mixed scenario)
// =============================================================================
console.log('\n=== Test 7: Per-card editability — DP on one card only ===');
resetState();
window.TIER_CONFIG = 'free';
activateDP('chase-sapphire-reserve');

assertEq(isCardEditable('chase-sapphire-reserve', 'category'), true,
  'CSR (has DP): category editable — can reclassify');
assertEq(isCardEditable('amex-gold', 'category'), false,
  'Amex Gold (no DP): category NOT editable');
assertEq(isCardEditable('chase-freedom-flex', 'category'), false,
  'CFF (no DP): category NOT editable');

// Now activate DP on Amex Gold too
activateDP('amex-gold');
assertEq(isCardEditable('amex-gold', 'category'), true,
  'Amex Gold (now has DP): category editable');
assertEq(isCardEditable('chase-freedom-flex', 'category'), false,
  'CFF (still no DP): category still NOT editable');

// =============================================================================
// Test 8: Auto-popup gating (free suppressed, DP/pro allowed)
// =============================================================================
console.log('\n=== Test 8: Auto-popup gating by tier ===');

// Simulates the popup condition: isNewUpload && lowConfidenceCount > 0 && !tourActive && TIER_CONFIG !== 'free'
function wouldPopupShow(tier, lowConfidenceCount) {
  const isNewUpload = true;
  const tourActive = false;
  return isNewUpload && lowConfidenceCount > 0 && !tourActive && tier !== 'free';
}

assertEq(wouldPopupShow('free', 5), false,
  'Free: popup suppressed even with 5 low-conf txns');
assertEq(wouldPopupShow('free', 0), false,
  'Free: popup suppressed with 0 low-conf txns');
assertEq(wouldPopupShow('pro', 5), true,
  'Pro: popup shows with 5 low-conf txns');
assertEq(wouldPopupShow('pro', 0), false,
  'Pro: popup suppressed with 0 low-conf txns (nothing to review)');

// DP user on free app still has TIER_CONFIG = 'free', so popup is suppressed
// This is correct: the popup condition gates on TIER_CONFIG !== 'free'
// A DP user can still use the Needs Review filter manually
assertEq(wouldPopupShow('free', 3), false,
  'DP user (free app): popup suppressed (TIER_CONFIG still "free")');

// =============================================================================
// Test 9: Data retention — DP card gets 6-year window, others get 1 year
// =============================================================================
console.log('\n=== Test 9: Data retention — DP card gets extended window ===');
resetState();
window.TIER_CONFIG = 'free';
activateDP('chase-sapphire-reserve');

const now = new Date();
const recentDate = new Date(now.getFullYear(), now.getMonth() - 6, 15).toISOString().slice(0, 10);
const oldDate = new Date(now.getFullYear(), now.getMonth() - 18, 15).toISOString().slice(0, 10);
const veryOldDate = new Date(now.getFullYear(), now.getMonth() - 80, 15).toISOString().slice(0, 10);

const dateTxns = [
  makeTxn({ cardId: 'chase-sapphire-reserve', date: recentDate }),   // recent, DP card
  makeTxn({ cardId: 'chase-sapphire-reserve', date: oldDate }),      // 18mo ago, DP card (within 6yr)
  makeTxn({ cardId: 'amex-gold', date: recentDate }),                // recent, no DP
  makeTxn({ cardId: 'amex-gold', date: oldDate }),                   // 18mo ago, no DP (beyond 1yr)
  makeTxn({ cardId: 'chase-sapphire-reserve', date: veryOldDate }),  // 80mo ago, DP card (beyond 6yr)
];

const filtered = applyTierDateFiltering(dateTxns);
const filteredIds = filtered.map(t => `${t.cardId}:${t.date}`);

assert(filtered.some(t => t.cardId === 'chase-sapphire-reserve' && t.date === recentDate),
  'DP card: recent txn included');
assert(filtered.some(t => t.cardId === 'chase-sapphire-reserve' && t.date === oldDate),
  'DP card: 18-month-old txn included (within 6-year DP window)');
assert(filtered.some(t => t.cardId === 'amex-gold' && t.date === recentDate),
  'Non-DP card: recent txn included');
assert(!filtered.some(t => t.cardId === 'amex-gold' && t.date === oldDate),
  'Non-DP card: 18-month-old txn EXCLUDED (beyond 1-year free window)');
assert(!filtered.some(t => t.cardId === 'chase-sapphire-reserve' && t.date === veryOldDate),
  'DP card: 80-month-old txn EXCLUDED (beyond 6-year DP window)');

assertEq(filtered.length, 3,
  'Total: 3 of 5 txns survive tier date filtering');

// =============================================================================
// Test 10: Pro tier — all data retained within 6-year window
// =============================================================================
console.log('\n=== Test 10: Pro tier — all data retained within 6-year window ===');
resetState();
window.TIER_CONFIG = 'pro';

const proFiltered = applyTierDateFiltering(dateTxns);

assert(proFiltered.some(t => t.cardId === 'amex-gold' && t.date === oldDate),
  'Pro: 18-month-old Amex Gold txn included (no 1-year limit)');
assert(!proFiltered.some(t => t.cardId === 'chase-sapphire-reserve' && t.date === veryOldDate),
  'Pro: 80-month-old txn still excluded (beyond 6-year pro window)');

assertEq(proFiltered.length, 4,
  'Pro: 4 of 5 txns survive (only the 80-month one dropped)');

// =============================================================================
// Test 11: Multiple DPs on different cards
// =============================================================================
console.log('\n=== Test 11: Multiple DPs — each card independent ===');
resetState();
window.TIER_CONFIG = 'free';
activateDP('chase-sapphire-reserve');
activateDP('amex-gold');

assertEq(isCardEditable('chase-sapphire-reserve'), true,
  'CSR: editable (has DP)');
assertEq(isCardEditable('amex-gold'), true,
  'Amex Gold: editable (has DP)');
assertEq(isCardEditable('chase-freedom-flex'), false,
  'CFF: NOT editable (no DP)');

const multiDP = applyTierDateFiltering([
  makeTxn({ cardId: 'chase-sapphire-reserve', date: oldDate }),
  makeTxn({ cardId: 'amex-gold', date: oldDate }),
  makeTxn({ cardId: 'chase-freedom-flex', date: oldDate }),
]);
assertEq(multiDP.length, 2,
  'Multi-DP: 18-month txns kept for CSR and Amex Gold, dropped for CFF');

// =============================================================================
// Test 12: hasActiveDecisionPass returns false for wrong card
// =============================================================================
console.log('\n=== Test 12: hasActiveDecisionPass specificity ===');
resetState();
state.decisionPasses.push({ key: 'TESTDP-X', cardId: 'chase-sapphire-reserve', activatedAt: Date.now() });

assertEq(hasActiveDecisionPass('chase-sapphire-reserve'), true,
  'hasActiveDecisionPass: true for activated card');
assertEq(hasActiveDecisionPass('amex-gold'), false,
  'hasActiveDecisionPass: false for different card');
assertEq(hasActiveDecisionPass('nonexistent-card'), false,
  'hasActiveDecisionPass: false for nonexistent card');

// =============================================================================
// Test 13: getActiveDecisionPassLookup only includes active passes
// =============================================================================
console.log('\n=== Test 13: Lookup only includes active (non-expired) passes ===');
resetState();
activateDP('chase-sapphire-reserve');         // active
activateExpiredDP('amex-gold');               // expired

const lookup = getActiveDecisionPassLookup();
assertEq(lookup['chase-sapphire-reserve'], true,
  'Lookup: active DP card present');
assertEq(lookup['amex-gold'], undefined,
  'Lookup: expired DP card absent');

// =============================================================================
// Test 14: Edge case — payment with low confidence is never visible
// =============================================================================
console.log('\n=== Test 14: Edge cases — payments and high-confidence ===');
resetState();
window.TIER_CONFIG = 'free';

assert(!isNeedsReviewVisible({ isPayment: true, confidence: 0, cardId: 'chase-sapphire-reserve' }),
  'Payment with confidence=0: NOT visible');
assert(!isNeedsReviewVisible({ isPayment: false, confidence: 50, cardId: 'chase-sapphire-reserve' }),
  'Confidence exactly at threshold (50): NOT visible');
assert(isNeedsReviewVisible({ isPayment: false, confidence: 49, cardId: 'chase-sapphire-reserve' }),
  'Confidence just below threshold (49): visible');
assert(!isNeedsReviewVisible({ isPayment: false, confidence: 100, cardId: 'chase-sapphire-reserve' }),
  'High confidence (100): NOT visible');

// =============================================================================
// Summary
// =============================================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);
