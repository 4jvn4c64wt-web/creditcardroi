// Chase Freedom Flex - Historical Quarterly 5% Bonus Categories
// Update this file each quarter when Chase announces new rotating categories.
//
// Each entry has:
//   key:              Category key for matching against classified transactions
//   label:            Display label shown in the UI
//   rate:             Multiplier rate (usually 5, elevated 7 or 9 for some promos)
//   merchantKeywords: (optional) Match by merchant description instead of category hierarchy
//   monthOnly:        (optional) Month number (1-12) when this category is exclusively active

window.CardTracker = window.CardTracker || {};

window.CardTracker.cffQuarterlyData = {

  // ─── 2026 ───────────────────────────────────────────────

  '2026-Q1': [
    { key: 'charity', label: 'American Heart Association', rate: 5, merchantKeywords: ['american heart'] },
    { key: 'dining', label: 'Dining', rate: 7 },
    { key: 'cruise', label: 'Norwegian Cruise Line', rate: 5, merchantKeywords: ['norwegian cruise', 'ncl '] }
  ],

  // ─── 2025 ───────────────────────────────────────────────

  '2025-Q4': [
    { key: 'chase-travel', label: 'Chase Travel', rate: 9 },
    { key: 'department-stores', label: 'Department Stores', rate: 5 },
    { key: 'clothing', label: 'Old Navy', rate: 5, merchantKeywords: ['old navy'] },
    { key: 'paypal', label: 'PayPal', rate: 5, monthOnly: 12 }
  ],

  '2025-Q3': [
    { key: 'gas', label: 'Gas Stations', rate: 5 },
    { key: 'ev-charging', label: 'EV Charging Stations', rate: 5 },
    { key: 'online-grocery', label: 'Instacart', rate: 5, merchantKeywords: ['instacart'] },
    { key: 'live-entertainment', label: 'Select Live Entertainment', rate: 5 }
  ],

  '2025-Q2': [
    { key: 'amazon', label: 'Amazon', rate: 5 },
    { key: 'streaming', label: 'Select Streaming Services', rate: 5 },
    { key: 'internet-cable-phone', label: 'Internet, Cable & Phone', rate: 5, monthOnly: 6 }
  ],

  '2025-Q1': [
    { key: 'grocery', label: 'Select Grocery Stores', rate: 5 },
    { key: 'fitness', label: 'Fitness Clubs & Gym Memberships', rate: 5 },
    { key: 'spa-self-care', label: 'Self-Care & Spa Services', rate: 5 },
    { key: 'cruise', label: 'Norwegian Cruise Line', rate: 5, merchantKeywords: ['norwegian cruise', 'ncl '] },
    { key: 'tax', label: 'Tax Preparation', rate: 5, monthOnly: 3, merchantKeywords: ['turbotax', 'h&r block', 'hrblock', 'taxact', 'taxslayer', 'jackson hewitt', 'liberty tax', 'freetaxusa'] },
    { key: 'insurance', label: 'Insurance', rate: 5, monthOnly: 3 }
  ],

  // ─── 2024 ───────────────────────────────────────────────

  '2024-Q4': [
    { key: 'fast-food', label: "McDonald's", rate: 7, merchantKeywords: ['mcdonald'] },
    { key: 'paypal', label: 'PayPal', rate: 5 },
    { key: 'pet', label: 'Pet Shops & Veterinary Services', rate: 5 },
    { key: 'charity', label: 'Select Charities', rate: 5 }
  ],

  '2024-Q3': [
    { key: 'gas', label: 'Gas Stations', rate: 5 },
    { key: 'ev-charging', label: 'EV Charging Stations', rate: 5 },
    { key: 'movies', label: 'Movie Theaters', rate: 5 },
    { key: 'live-entertainment', label: 'Select Live Entertainment', rate: 5 }
  ],

  '2024-Q2': [
    { key: 'chase-travel', label: 'Hotels (Chase Travel)', rate: 9 },
    { key: 'dining', label: 'Dining', rate: 7 },
    { key: 'amazon', label: 'Amazon', rate: 5 }
  ],

  '2024-Q1': [
    { key: 'grocery', label: 'Select Grocery Stores', rate: 5 },
    { key: 'fitness', label: 'Fitness Clubs & Gym Memberships', rate: 5 },
    { key: 'spa-self-care', label: 'Self-Care & Spa Services', rate: 5 }
  ],

  // ─── 2023 ───────────────────────────────────────────────

  '2023-Q4': [
    { key: 'paypal', label: 'PayPal', rate: 5 },
    { key: 'charity', label: 'Select Charities', rate: 5 },
    { key: 'wholesale-club', label: 'Wholesale Clubs', rate: 5 }
  ],

  '2023-Q3': [
    { key: 'gas', label: 'Gas Stations', rate: 5 },
    { key: 'ev-charging', label: 'EV Charging Stations', rate: 5 },
    { key: 'live-entertainment', label: 'Select Live Entertainment', rate: 5 }
  ],

  '2023-Q2': [
    { key: 'amazon', label: 'Amazon', rate: 5 },
    { key: 'lowes', label: "Lowe's", rate: 5, merchantKeywords: ['lowes', "lowe's"] }
  ],

  '2023-Q1': [
    { key: 'grocery', label: 'Grocery Stores', rate: 5 },
    { key: 'fitness', label: 'Gym Memberships & Fitness Clubs', rate: 5 },
    { key: 'target', label: 'Target', rate: 5, merchantKeywords: ['target'] }
  ],

  // ─── 2022 ───────────────────────────────────────────────

  '2022-Q4': [
    { key: 'paypal', label: 'PayPal', rate: 5 },
    { key: 'walmart', label: 'Walmart', rate: 5, merchantKeywords: ['walmart', 'wal-mart'] }
  ],

  '2022-Q3': [
    { key: 'gas', label: 'Gas Stations', rate: 5 },
    { key: 'car-rental', label: 'Rental Cars', rate: 5 },
    { key: 'movies', label: 'Movie Theaters', rate: 5 },
    { key: 'live-entertainment', label: 'Select Live Entertainment', rate: 5 }
  ],

  '2022-Q2': [
    { key: 'amazon', label: 'Amazon', rate: 5 },
    { key: 'streaming', label: 'Select Streaming Services', rate: 5 }
  ],

  '2022-Q1': [
    { key: 'grocery', label: 'Grocery Stores', rate: 5 },
    { key: 'ebay', label: 'eBay', rate: 5, merchantKeywords: ['ebay'] }
  ],

  // ─── 2021 ───────────────────────────────────────────────

  '2021-Q4': [
    { key: 'paypal', label: 'PayPal', rate: 5 },
    { key: 'walmart', label: 'Walmart', rate: 5, merchantKeywords: ['walmart', 'wal-mart'] }
  ],

  '2021-Q3': [
    { key: 'grocery', label: 'Grocery Stores', rate: 5 },
    { key: 'streaming', label: 'Select Streaming Services', rate: 5 }
  ],

  '2021-Q2': [
    { key: 'gas', label: 'Gas Stations', rate: 5 },
    { key: 'home-improvement', label: 'Home Improvement Stores', rate: 5 }
  ],

  '2021-Q1': [
    { key: 'wholesale-club', label: 'Wholesale Clubs', rate: 5 },
    { key: 'streaming', label: 'Select Streaming Services', rate: 5 },
    { key: 'internet-cable-phone', label: 'Internet, Cable & Phone', rate: 5 }
  ],

  // ─── 2020 ───────────────────────────────────────────────

  '2020-Q4': [
    { key: 'paypal', label: 'PayPal', rate: 5 },
    { key: 'walmart', label: 'Walmart', rate: 5, merchantKeywords: ['walmart', 'wal-mart'] }
  ],

  '2020-Q3': [
    { key: 'amazon', label: 'Amazon', rate: 5 },
    { key: 'whole-foods', label: 'Whole Foods Market', rate: 5 }
  ],

  '2020-Q2': [
    { key: 'grocery', label: 'Grocery Stores', rate: 5 },
    { key: 'fitness', label: 'Gym Memberships & Fitness Clubs', rate: 5 },
    { key: 'streaming', label: 'Select Streaming Services', rate: 5 }
  ],

  '2020-Q1': [
    { key: 'gas', label: 'Gas Stations', rate: 5 },
    { key: 'internet-cable-phone', label: 'Internet, Cable & Phone', rate: 5 },
    { key: 'streaming', label: 'Select Streaming Services', rate: 5 }
  ]
};
