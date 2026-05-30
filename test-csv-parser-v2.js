// Test script for csv-parser.js three-pass detection overhaul
// Run: node test-csv-parser-v2.js

// Simulate browser environment
global.window = {};
require('./csv-parser.js');

const { detectCSVFormat, detectColumnDataType, detectAccountColumnType } = window.CardTracker.csvParser;

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

// =============================================================================
// Test 1: detectColumnDataType
// =============================================================================
console.log('\n=== Test 1: detectColumnDataType ===');

assertEq(detectColumnDataType(['01/15/2024', '02/28/2024', '03/01/2024']), 'date', 'dates MM/DD/YYYY → date');
assertEq(detectColumnDataType(['2024-01-15', '2024-02-28', '2024-03-01']), 'date', 'dates YYYY-MM-DD → date');
assertEq(detectColumnDataType(['45.99', '-12.50', '100.00']), 'amount', 'plain numbers → amount');
assertEq(detectColumnDataType(['$45.99', '-$12.50', '$100.00']), 'amount', 'dollar amounts → amount');
assertEq(detectColumnDataType(['1,234.56', '-45.99', '($100.00)']), 'amount', 'mixed amount formats → amount');
assertEq(detectColumnDataType(['1234', '5678', '9012']), 'account', 'four-digit numbers → account (card number)');
assertEq(detectColumnDataType(['...1234', '...5678', '...9012']), 'account', 'masked card numbers → account');
assertEq(detectColumnDataType(['Chase Sapphire Reserve', 'Amex Gold', 'Citi Double Cash']), 'accountName', 'card names → accountName');
assertEq(detectColumnDataType(['Credit Card', 'Checking', 'Savings']), 'accountType', 'account types → accountType');
assertEq(detectColumnDataType(['Chase Sapphire (...1234)', 'Amex Gold (...5678)']), 'accountCombined', 'combined format → accountCombined');
assertEq(detectColumnDataType(['Groceries', 'Gas Station', 'Coffee Shop']), 'unknown', 'merchant-like text → unknown');
assertEq(detectColumnDataType([]), 'unknown', 'empty array → unknown');
assertEq(detectColumnDataType([null, undefined, '']), 'unknown', 'null/empty values → unknown');

// =============================================================================
// Test 2: Known format headers still auto-detect (no CSV_FORMATS needed)
// =============================================================================
console.log('\n=== Test 2: Known formats via generic detection ===');

// Chase: has "Transaction Date", "Post Date", "Description", "Category", "Amount"
const chaseHeaders = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo'];
const chasePreview = [
  ['01/15/2024', '01/16/2024', 'AMAZON PRIME', 'Shopping', 'Sale', '-45.99', ''],
  ['01/14/2024', '01/15/2024', 'STARBUCKS', 'Food & Drink', 'Sale', '-5.50', '']
];
const chaseResult = detectCSVFormat(chaseHeaders, chasePreview);
assertEq(chaseResult.formatId, 'generic', 'Chase → formatId: generic');
assertEq(chaseResult.formatName, 'Auto-detected', 'Chase → formatName: Auto-detected');
assertEq(chaseResult.mapping.date, 'post date', 'Chase → date mapped to "post date"');
assertEq(chaseResult.mapping.merchant, 'description', 'Chase → merchant mapped to "description"');
assertEq(chaseResult.mapping.amount, 'amount', 'Chase → amount mapped');
assertEq(chaseResult.mapping.category, 'category', 'Chase → category mapped');
assertEq(chaseResult.mapping.original, 'memo', 'Chase → original mapped to "memo"');

// Monarch: has "Date", "Merchant", "Category", "Account", "Original Statement", "Notes", "Amount", "Tags"
const monarchHeaders = ['Date', 'Merchant', 'Category', 'Account', 'Original Statement', 'Notes', 'Amount', 'Tags'];
const monarchPreview = [
  ['01/15/2024', 'Amazon', 'Shopping', 'Chase Sapphire Reserve', 'AMAZON.COM*1234', '', '-45.99', ''],
  ['01/14/2024', 'Starbucks', 'Food', 'Amex Gold', 'STARBUCKS #123', '', '-5.50', '']
];
const monarchResult = detectCSVFormat(monarchHeaders, monarchPreview);
assertEq(monarchResult.mapping.date, 'date', 'Monarch → date mapped');
assertEq(monarchResult.mapping.merchant, 'merchant', 'Monarch → merchant mapped');
assertEq(monarchResult.mapping.category, 'category', 'Monarch → category mapped');
assertEq(monarchResult.mapping.original, 'original statement', 'Monarch → original mapped to "original statement"');
assertEq(monarchResult.mapping.amount, 'amount', 'Monarch → amount mapped');
// Account column has card names → post-pass reclassification should move to accountName
assertEq(monarchResult.mapping.accountName, 'account', 'Monarch → account reclassified to accountName');
assertEq(monarchResult.mapping.account, null, 'Monarch → account field nulled after reclassification');

// Amex: has "Date", "Description", "Card Member", "Account #", "Amount", "Category"
const amexHeaders = ['Date', 'Description', 'Card Member', 'Account #', 'Amount', 'Category'];
const amexPreview = [
  ['01/15/2024', 'AMAZON PRIME', 'JOHN DOE', '1234', '-45.99', 'Shopping'],
  ['01/14/2024', 'STARBUCKS', 'JOHN DOE', '1234', '-5.50', 'Food']
];
const amexResult = detectCSVFormat(amexHeaders, amexPreview);
assertEq(amexResult.mapping.date, 'date', 'Amex → date mapped');
assertEq(amexResult.mapping.merchant, 'description', 'Amex → merchant mapped to "description"');
assertEq(amexResult.mapping.amount, 'amount', 'Amex → amount mapped');
assertEq(amexResult.mapping.category, 'category', 'Amex → category mapped');

// Bilt: has "Transaction Date", "Description", "Amount", "Member Since", "Category"
const biltHeaders = ['Transaction Date', 'Description', 'Amount', 'Member Since', 'Category'];
const biltPreview = [
  ['01/15/2024', 'AMAZON PRIME', '-45.99', '01/01/2020', 'Shopping'],
  ['01/14/2024', 'STARBUCKS', '-5.50', '01/01/2020', 'Food']
];
const biltResult = detectCSVFormat(biltHeaders, biltPreview);
assertEq(biltResult.mapping.date, 'transaction date', 'Bilt → date mapped to "transaction date"');
assertEq(biltResult.mapping.merchant, 'description', 'Bilt → merchant mapped to "description"');
assertEq(biltResult.mapping.amount, 'amount', 'Bilt → amount mapped');
assertEq(biltResult.mapping.category, 'category', 'Bilt → category mapped');

// Bilt V2: has "Transaction Date", "Posted Date", "Description", "Amount", "Card Last 4", "Name on Card", "Raw Merchant Name"
const biltV2Headers = ['Transaction Date', 'Posted Date', 'Description', 'Amount', 'Card Last 4', 'Name on Card', 'Raw Merchant Name'];
const biltV2Preview = [
  ['2026-05-29', '2026-05-29', 'MTA', '3.00', '3798', 'Christopher Scott', 'MTA*NYCT PAYGO']
];
const biltV2Result = detectCSVFormat(biltV2Headers, biltV2Preview);
assertEq(biltV2Result.mapping.date, 'posted date', 'Bilt V2 → date mapped to "posted date"');
assertEq(biltV2Result.mapping.merchant, 'description', 'Bilt V2 → merchant mapped to "description"');
assertEq(biltV2Result.mapping.amount, 'amount', 'Bilt V2 → amount mapped');
assertEq(biltV2Result.mapping.account, 'card last 4', 'Bilt V2 → account mapped to "card last 4"');
assertEq(biltV2Result.mapping.original, 'raw merchant name', 'Bilt V2 → original mapped to "raw merchant name"');

// =============================================================================
// Test 3: Post-pass account reclassification
// =============================================================================
console.log('\n=== Test 3: Post-pass account reclassification ===');

// "Account" header with card number data → stays as account
const cardNumHeaders = ['Date', 'Description', 'Account', 'Amount'];
const cardNumPreview = [
  ['01/15/2024', 'AMAZON', '1234', '-45.99'],
  ['01/14/2024', 'STARBUCKS', '5678', '-5.50']
];
const cardNumResult = detectCSVFormat(cardNumHeaders, cardNumPreview);
assertEq(cardNumResult.mapping.account, 'account', 'Card number data → account stays');
assertEq(cardNumResult.mapping.accountName, null, 'Card number data → accountName null');

// "Account" header with account name data → reclassified to accountName
const acctNameHeaders = ['Date', 'Description', 'Account', 'Amount'];
const acctNamePreview = [
  ['01/15/2024', 'AMAZON', 'Chase Sapphire Reserve', '-45.99'],
  ['01/14/2024', 'STARBUCKS', 'Amex Gold Card', '-5.50']
];
const acctNameResult = detectCSVFormat(acctNameHeaders, acctNamePreview);
assertEq(acctNameResult.mapping.accountName, 'account', 'Account name data → reclassified to accountName');
assertEq(acctNameResult.mapping.account, null, 'Account name data → account nulled');

// "Account" header with account type data → reclassified to accountType
const acctTypeHeaders = ['Date', 'Description', 'Account', 'Amount'];
const acctTypePreview = [
  ['01/15/2024', 'AMAZON', 'Credit Card', '-45.99'],
  ['01/14/2024', 'STARBUCKS', 'Checking', '-5.50']
];
const acctTypeResult = detectCSVFormat(acctTypeHeaders, acctTypePreview);
assertEq(acctTypeResult.mapping.accountType, 'account', 'Account type data → reclassified to accountType');
assertEq(acctTypeResult.mapping.account, null, 'Account type data → account nulled');

// "Account" header with combined data → reclassified to accountCombined
const combinedHeaders = ['Date', 'Description', 'Account', 'Amount'];
const combinedPreview = [
  ['01/15/2024', 'AMAZON', 'Chase Sapphire (...1234)', '-45.99'],
  ['01/14/2024', 'STARBUCKS', 'Amex Gold (...5678)', '-5.50']
];
const combinedResult = detectCSVFormat(combinedHeaders, combinedPreview);
assertEq(combinedResult.mapping.accountCombined, 'account', 'Combined data → reclassified to accountCombined');
assertEq(combinedResult.mapping.account, null, 'Combined data → account nulled');

// =============================================================================
// Test 4: Pass 2 data format inspection (no header name match)
// =============================================================================
console.log('\n=== Test 4: Pass 2 — data format inspection fallback ===');

// Column with unrecognizable name but date-like data → detected as date via Pass 2
const weirdHeaders = ['col_a', 'col_b', 'col_c'];
const weirdPreview = [
  ['01/15/2024', 'AMAZON PRIME', '-45.99'],
  ['01/14/2024', 'STARBUCKS', '-5.50'],
  ['01/13/2024', 'TARGET', '-120.00']
];
const weirdResult = detectCSVFormat(weirdHeaders, weirdPreview);
assertEq(weirdResult.mapping.date, 'col_a', 'Unrecognized header with date data → mapped via Pass 2');
assertEq(weirdResult.mapping.amount, 'col_c', 'Unrecognized header with amount data → mapped via Pass 2');
// col_b has text data — no data type detection for merchant, so it stays unmapped
assertEq(weirdResult.mapping.merchant, null, 'Unrecognized header with text data → not mapped (no data type for merchant)');

// Pass 1 (h.includes) catches substring matches
const substringHeaders = ['my_date_field', 'txn_description', 'total_amount'];
const substringPreview = [
  ['01/15/2024', 'AMAZON', '-45.99'],
  ['01/14/2024', 'STARBUCKS', '-5.50']
];
const substringResult = detectCSVFormat(substringHeaders, substringPreview);
assertEq(substringResult.mapping.date, 'my_date_field', 'h.includes("date") catches "my_date_field"');
assertEq(substringResult.mapping.merchant, 'txn_description', 'h.includes("description") catches "txn_description"');
assertEq(substringResult.mapping.amount, 'total_amount', 'h.includes("amount") catches "total_amount"');

// =============================================================================
// Test 5: "original statement" not stolen by "statement" or "date"
// =============================================================================
console.log('\n=== Test 5: Specific multi-word fields detected before generic ===');

const multiWordHeaders = ['Date', 'Merchant', 'Original Statement', 'Category', 'Account Name', 'Amount'];
const multiWordPreview = [
  ['01/15/2024', 'Amazon', 'AMAZON.COM*1234', 'Shopping', 'Chase Sapphire', '-45.99']
];
const multiWordResult = detectCSVFormat(multiWordHeaders, multiWordPreview);
assertEq(multiWordResult.mapping.original, 'original statement', 'Original Statement detected before generic "date" can steal it');
assertEq(multiWordResult.mapping.date, 'date', 'Date still correctly mapped');
assertEq(multiWordResult.mapping.accountName, 'account name', 'Account Name detected as dedicated field');

// =============================================================================
// Test 6: No previewRows (backwards compatibility)
// =============================================================================
console.log('\n=== Test 6: No previewRows (header-only detection) ===');

const headerOnlyResult = detectCSVFormat(['Date', 'Description', 'Amount', 'Category']);
assertEq(headerOnlyResult.mapping.date, 'date', 'Header-only: date mapped');
assertEq(headerOnlyResult.mapping.merchant, 'description', 'Header-only: merchant mapped');
assertEq(headerOnlyResult.mapping.amount, 'amount', 'Header-only: amount mapped');
assertEq(headerOnlyResult.mapping.category, 'category', 'Header-only: category mapped');
assertEq(headerOnlyResult.formatName, 'Auto-detected', 'Header-only: formatName is Auto-detected');

// =============================================================================
// Test 7: CSV_FORMATS is removed
// =============================================================================
console.log('\n=== Test 7: CSV_FORMATS removed ===');
assertEq(window.CardTracker.csvParser.CSV_FORMATS, undefined, 'CSV_FORMATS no longer exists');

// =============================================================================
// Summary
// =============================================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);
