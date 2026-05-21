window.CardTracker = window.CardTracker || {};
window.CardTracker.csvParser = window.CardTracker.csvParser || {};

// =============================================================================
// CSV PARSING WITH COLUMN MAPPING
// =============================================================================

// Detect if a row looks like data (not headers) - for headerless CSVs
// Returns true if row appears to contain transaction data
window.CardTracker.csvParser.isDataRow = function(fields) {
  if (!fields || fields.length < 2) return false;

  // Check if first field looks like a date (MM/DD/YYYY, YYYY-MM-DD, etc.)
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,  // MM/DD/YYYY or M/D/YY
    /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
    /^\d{1,2}-\d{1,2}-\d{2,4}$/      // MM-DD-YYYY
  ];
  const firstField = (fields[0] || '').trim();
  const looksLikeDate = datePatterns.some(p => p.test(firstField));

  // Check if second field looks like an amount (number, possibly negative, with optional decimals)
  const secondField = (fields[1] || '').trim();
  const looksLikeAmount = /^-?\d+\.?\d*$/.test(secondField) || /^-?\$?\d+\.?\d*$/.test(secondField);

  // If both match, this is likely a data row, not a header
  return looksLikeDate && looksLikeAmount;
};

// Detect Wells Fargo headerless format from first data row
// Wells Fargo format: date, amount, *, empty, merchant (5 columns, no headers)
window.CardTracker.csvParser.isWellsFargoFormat = function(fields) {
  if (!fields || fields.length !== 5) return false;

  const [date, amount, asterisk, empty, merchant] = fields;

  // Check pattern: date, numeric amount, asterisk, empty string, non-empty merchant
  const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  const isDate = datePattern.test((date || '').trim());
  const isAmount = /^-?\d+\.?\d*$/.test((amount || '').trim());
  const isAsterisk = (asterisk || '').trim() === '*';
  const isEmpty = (empty || '').trim() === '';
  const hasMerchant = (merchant || '').trim().length > 0;

  return isDate && isAmount && isAsterisk && isEmpty && hasMerchant;
};

// Generate a "shape" key for a CSV based on headers (used to remember mappings)
window.CardTracker.csvParser.getCSVShapeKey = function(headers) {
  return headers.map(h => h.toLowerCase().trim()).sort().join('|').substring(0, 200);
};

// Auto-detect CSV format and suggest column mappings
window.CardTracker.csvParser.detectCSVFormat = function(headers, previewRows) {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  const detectColumnDataType = window.CardTracker.csvParser.detectColumnDataType;

  // Three-pass approach: (1) exact phrase within header, (2) data format inspection, (3) word-boundary partial
  // Detection order: specific multi-word fields first, then generic single-word fields
  const alreadyMapped = new Set();

  const findHeader = (patterns, expectedDataType) => {
    // Pass 1: Exact phrase within header — h.includes(pattern)
    for (const pattern of patterns) {
      const found = normalizedHeaders.find(h => h.includes(pattern) && !alreadyMapped.has(h));
      if (found) { alreadyMapped.add(found); return found; }
    }
    // Pass 2: Data format inspection — check actual cell values in unmapped columns
    if (expectedDataType && previewRows && previewRows.length > 0) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (alreadyMapped.has(normalizedHeaders[i])) continue;
        const sampleValues = previewRows.map(row => row[i]);
        if (detectColumnDataType(sampleValues) === expectedDataType) {
          alreadyMapped.add(normalizedHeaders[i]);
          return normalizedHeaders[i];
        }
      }
    }
    // Pass 3: Word-boundary partial match
    for (const pattern of patterns) {
      const re = new RegExp('(?:^|\\W)' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\W)');
      const found = normalizedHeaders.find(h => re.test(h) && !alreadyMapped.has(h));
      if (found) { alreadyMapped.add(found); return found; }
    }
    return null;
  };

  // Detect specific multi-word fields FIRST (before generic single-word fields can steal them)
  const original = findHeader(['original statement', 'original description', 'memo', 'original']);
  const accountName = findHeader(['account name', 'card name', 'account nickname'], 'accountName');
  const accountType = findHeader(['account type'], 'accountType');

  // Then detect generic fields
  const date = findHeader(['post date', 'posting date', 'date', 'transaction date', 'trans date'], 'date');
  const merchant = findHeader(['merchant', 'description', 'payee', 'name']);
  const category = findHeader(['category']);
  const account = findHeader(['account number', 'card number', 'account', 'card', 'card no'], 'account');
  const amount = findHeader(['amount', 'debit', 'credit'], 'amount');

  // Only fall back to bare "type" for accountType if it wasn't already detected
  const finalAccountType = accountType || findHeader(['type'], 'accountType');

  const genericMapping = {
    date,
    merchant,
    category,
    account,
    accountName,
    accountType: finalAccountType,
    amount,
    original
  };

  // Post-pass: account subtype reclassification
  // If a column was mapped to generic 'account' by header name, inspect data
  // to determine if it's actually accountName, accountType, or accountCombined
  if (genericMapping.account && previewRows && previewRows.length > 0) {
    const accountIdx = normalizedHeaders.indexOf(genericMapping.account);
    if (accountIdx >= 0) {
      const sampleValues = previewRows.map(row => row[accountIdx]);
      const detectedType = detectColumnDataType(sampleValues);
      if (detectedType === 'accountName' && !genericMapping.accountName) {
        genericMapping.accountName = genericMapping.account;
        genericMapping.account = null;
      } else if (detectedType === 'accountType' && !genericMapping.accountType) {
        genericMapping.accountType = genericMapping.account;
        genericMapping.account = null;
      } else if (detectedType === 'accountCombined') {
        genericMapping.accountCombined = genericMapping.account;
        genericMapping.account = null;
      }
    }
  }

  return { formatId: 'generic', formatName: 'Auto-detected', mapping: genericMapping };
};

// Determine if a column value represents a Card Number, Account Type, Account Name, or Combined
// Returns: 'cardNumber' | 'accountType' | 'accountName' | 'combined' | 'unknown'
window.CardTracker.csvParser.detectAccountColumnType = function(sampleValue) {
  if (!sampleValue || typeof sampleValue !== 'string') return 'unknown';

  const value = sampleValue.trim();
  const lowerValue = value.toLowerCase();

  // Check for numeric patterns (Card Number): "1234", "...1234", "(1234)"
  if (/^\(?\.{0,3}\d{4}\)?\s*$/.test(value)) {
    return 'cardNumber';
  }

  // Check for combined format: "Chase Sapphire Reserve (...1234)" or "Credit Card (1234)"
  const combinedMatch = value.match(/.*\(?\.{0,3}(\d{4})\)?$/);
  const hasText = value.replace(/[^\w\s]/g, '').replace(/\d+/g, '').trim().length > 0;
  if (combinedMatch && hasText) {
    return 'combined';
  }

  // Check for account type keywords (generic account types used for filtering)
  const accountTypeKeywords = ['checking', 'savings', 'investment', 'brokerage', 'money market', 'debit'];
  if (accountTypeKeywords.some(keyword => lowerValue.includes(keyword))) {
    return 'accountType';
  }

  // "Credit Card" alone is an account type
  if (lowerValue === 'credit card' || lowerValue === 'credit') {
    return 'accountType';
  }

  // Check if the value contains card name patterns (specific card names)
  // e.g., "Chase Sapphire Reserve", "Amex Gold", "Citi Double Cash"
  const cardNamePatterns = ['visa', 'mastercard', 'amex', 'american express', 'discover',
                           'sapphire', 'reserve', 'freedom', 'unlimited', 'preferred',
                           'gold', 'platinum', 'rewards', 'cash back', 'cashback',
                           'venture', 'quicksilver', 'double cash', 'custom cash',
                           'blue cash', 'everyday', 'boundless', 'world elite'];
  if (cardNamePatterns.some(pattern => lowerValue.includes(pattern))) {
    return 'accountName'; // It's a card name like "Chase Sapphire Reserve"
  }

  // If it's mostly text (not numbers) and longer than a few words, likely account name
  const numericContent = value.replace(/[^\d]/g, '');
  const textContent = value.replace(/[\d\s\W]/g, '');
  if (textContent.length > 5 && textContent.length > numericContent.length) {
    return 'accountName';
  }

  return 'unknown';
};

// Inspect sample cell values to classify a column's data type
// Returns: 'date' | 'amount' | 'account' | 'accountName' | 'accountType' | 'accountCombined' | 'unknown'
window.CardTracker.csvParser.detectColumnDataType = function(sampleValues) {
  if (!sampleValues || sampleValues.length === 0) return 'unknown';

  const values = sampleValues.map(v => (v || '').trim()).filter(v => v.length > 0);
  if (values.length === 0) return 'unknown';

  const total = values.length;
  const threshold = 0.5;

  // Check for date patterns (most specific)
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,   // MM/DD/YYYY
    /^\d{4}-\d{2}-\d{2}$/,             // YYYY-MM-DD
    /^\d{1,2}-\d{1,2}-\d{2,4}$/,      // MM-DD-YYYY
    /^\d{4}\/\d{2}\/\d{2}$/            // YYYY/MM/DD
  ];
  const dateCount = values.filter(v => datePatterns.some(p => p.test(v))).length;
  if (dateCount / total >= threshold) return 'date';

  // Check for account-related types BEFORE amounts (since "1234" is both a valid amount and card number)
  // Use detectAccountColumnType but only trust strong signals, not the text-length fallback
  const detectAccountColumnType = window.CardTracker.csvParser.detectAccountColumnType;
  const cardNameKeywords = ['visa', 'mastercard', 'amex', 'american express', 'discover',
                            'sapphire', 'reserve', 'freedom', 'unlimited', 'preferred',
                            'gold', 'platinum', 'rewards', 'cash back', 'cashback',
                            'venture', 'quicksilver', 'double cash', 'custom cash',
                            'blue cash', 'everyday', 'boundless', 'world elite'];
  const typeCounts = { cardNumber: 0, accountName: 0, accountType: 0, combined: 0 };
  values.forEach(v => {
    const t = detectAccountColumnType(v);
    if (t === 'cardNumber' || t === 'accountType' || t === 'combined') {
      typeCounts[t]++;
    } else if (t === 'accountName') {
      // Only count keyword-based matches, not the generic text-length heuristic
      // This prevents merchant names like "AMAZON PRIME" from being classified as account names
      if (cardNameKeywords.some(k => v.toLowerCase().includes(k))) {
        typeCounts.accountName++;
      }
    }
  });

  if (typeCounts.cardNumber / total >= threshold) return 'account';
  if (typeCounts.combined / total >= threshold) return 'accountCombined';
  if (typeCounts.accountName / total >= threshold) return 'accountName';
  if (typeCounts.accountType / total >= threshold) return 'accountType';

  // Check for amount/currency patterns (after account checks)
  const isAmountValue = (v) => {
    const cleaned = v.replace(/[$,\s]/g, '');
    return /^-?\d+(\.\d+)?$/.test(cleaned) || /^\(\d+(\.\d+)?\)$/.test(cleaned);
  };
  const amountCount = values.filter(v => isAmountValue(v)).length;
  if (amountCount / total >= threshold) return 'amount';

  return 'unknown';
};

// Split a raw CSV string into logical rows, respecting quoted fields that may
// contain embedded newlines (e.g. Monarch's Amazon Retail Sync notes field).
window.CardTracker.csvParser.splitCSVLines = function(csvText) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  // Normalise \r\n and bare \r to \n so we only deal with one kind
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      if (current.trim()) rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) rows.push(current);
  return rows;
};

// Parse a single CSV line handling quotes
window.CardTracker.csvParser.parseCSVLine = function(line) {
  const fields = [];
  let current = '', inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else current += char;
  }
  fields.push(current.trim());
  return fields;
};

// Show column mapping UI
// References state, escapeHtml, DOM elements from global scope (available at call time)
window.CardTracker.csvParser.showColumnMapping = function(csvText) {
  const parseCSVLine = window.CardTracker.csvParser.parseCSVLine;
  const isDataRow = window.CardTracker.csvParser.isDataRow;
  const isWellsFargoFormat = window.CardTracker.csvParser.isWellsFargoFormat;
  const detectCSVFormat = window.CardTracker.csvParser.detectCSVFormat;
  const detectAccountColumnType = window.CardTracker.csvParser.detectAccountColumnType;
  const getCSVShapeKey = window.CardTracker.csvParser.getCSVShapeKey;

  const splitCSVLines = window.CardTracker.csvParser.splitCSVLines;
  const lines = splitCSVLines(csvText);
  if (lines.length < 1) {
    alert('CSV file appears to be empty or invalid.');
    return;
  }

  // Parse first row to check if it's data or headers
  const firstRowFields = parseCSVLine(lines[0]);
  const isHeaderless = isDataRow(firstRowFields);

  let headers, previewRows, dataLines;

  if (isHeaderless) {
    // Headerless CSV - generate synthetic column names
    headers = firstRowFields.map((_, i) => `Column ${i + 1}`);
    // All lines are data (including first line)
    previewRows = lines.slice(0, 5).map(line => parseCSVLine(line));
    dataLines = lines; // All lines are data
  } else {
    // Normal CSV with headers
    headers = firstRowFields;
    previewRows = lines.slice(1, 6).map(line => parseCSVLine(line));
    dataLines = lines.slice(1); // Skip header row
  }

  // Store for later use - include isHeaderless flag
  state.pendingCSVData = { text: csvText, headers, lines, isHeaderless, dataLines };

  // Check if we have a saved mapping for this CSV shape
  const shapeKey = getCSVShapeKey(headers);
  const savedMapping = state.columnMappings[shapeKey];

  // Auto-detect format
  let detected;

  // Check for Wells Fargo headerless format first
  if (isHeaderless && isWellsFargoFormat(firstRowFields)) {
    detected = {
      formatId: 'wellsfargo',
      formatName: 'Wells Fargo (no headers)',
      isHeaderless: true,
      mapping: {
        date: 'Column 1',
        amount: 'Column 2',
        merchant: 'Column 5'
        // No category or account columns in Wells Fargo CSVs
      }
    };
  } else if (isHeaderless) {
    // Generic headerless - try to guess based on column count
    detected = {
      formatId: 'headerless',
      formatName: 'Unknown Format (no headers)',
      isHeaderless: true,
      mapping: {
        date: 'Column 1',
        amount: firstRowFields.length >= 2 ? 'Column 2' : null,
        merchant: firstRowFields.length >= 5 ? 'Column 5' : (firstRowFields.length >= 3 ? 'Column 3' : null)
      }
    };
  } else {
    detected = detectCSVFormat(headers, previewRows);
  }

  // Use saved mapping if available, but MERGE with detected mapping
  // This ensures that if the saved mapping is missing optional fields (like category),
  // they get filled in from the detected mapping
  const currentMapping = savedMapping
    ? { ...detected.mapping, ...savedMapping }  // detected as base, saved as override
    : detected.mapping;

  // Build the preview UI
  const container = document.getElementById('csvPreview');

  const fieldOptions = [
    { value: '', label: '— Skip (not needed) —' },
    { value: 'date', label: '📅 Date', required: true },
    { value: 'merchant', label: '🏪 Merchant/Description', required: true },
    { value: 'amount', label: '💰 Amount', required: true },
    { value: 'account', label: '💳 Card Number (last 4 digits like "1234" or "...1234")' },
    { value: 'accountName', label: '🏷️ Account Name (e.g., "Chase Sapphire Reserve")' },
    { value: 'accountType', label: '🏦 Account Type (Credit Card, Checking, Savings)' },
    { value: 'accountCombined', label: '💳🏷️ Account Name + Number (e.g., "Sapphire Reserve ...1234")' },
    { value: 'category', label: '📁 Category (optional, improves accuracy)' },
    { value: 'original', label: '📝 Original Statement (optional, improves accuracy)' }
  ];

  // Find which column is mapped to which field
  function getSelectedField(colHeader) {
    const normalizedHeader = colHeader.toLowerCase().trim();
    for (const [field, mappedHeader] of Object.entries(currentMapping)) {
      if (mappedHeader && normalizedHeader === mappedHeader.toLowerCase().trim()) {
        return field;
      }
    }
    return '';
  }

  // Build status message based on detection
  let statusMessage;
  if (savedMapping) {
    statusMessage = '✓ Using your saved mapping for this format';
  } else if (isHeaderless) {
    statusMessage = `Detected: <strong>${detected.formatName}</strong> — using column positions (no headers found)`;
  } else {
    statusMessage = `Detected: <strong>${detected.formatName}</strong> — please verify below`;
  }

  // Calculate total transactions (dataLines for headerless, lines-1 for normal)
  const totalTransactions = dataLines.length;

  container.innerHTML = `
    <div style="padding:12px;background:${isHeaderless ? '#fef3c7' : '#fefce8'};border-bottom:1px solid #e7e5e4;">
      <span style="font-size:13px;">
        ${statusMessage}
      </span>
      ${isHeaderless ? '<div style="font-size:11px;color:#92400e;margin-top:4px;">This file has no header row. First row contains data.</div>' : ''}
    </div>
    <div style="overflow-x:auto;">
      <table style="min-width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f4;">
            ${headers.map((h, i) => `
              <th style="padding:8px 12px;border-bottom:1px solid #e7e5e4;min-width:140px;">
                <select class="form-select column-mapping-select" data-col-index="${i}" style="width:100%;font-size:12px;padding:6px;">
                  ${fieldOptions.map(opt => `
                    <option value="${opt.value}" ${getSelectedField(h) === opt.value ? 'selected' : ''}>
                      ${opt.label}
                    </option>
                  `).join('')}
                </select>
              </th>
            `).join('')}
          </tr>
          <tr style="background:#fafaf9;">
            ${headers.map(h => `
              <th style="padding:6px 12px;border-bottom:2px solid #e7e5e4;font-size:11px;color:#78716c;font-weight:normal;">
                "${escapeHtml(h)}"
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${previewRows.map(row => `
            <tr>
              ${headers.map((_, i) => `
                <td style="padding:8px 12px;border-bottom:1px solid #f5f5f4;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${row[i] ? escapeHtml(row[i]) : '<em style="color:#a8a29e;">empty</em>'}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:12px;background:#f5f5f4;font-size:11px;color:#78716c;">
      Showing first ${previewRows.length} rows of ${totalTransactions} total transactions
    </div>
  `;

  // Show the section
  document.getElementById('uploadSection').classList.add('hidden');
  document.getElementById('columnMappingSection').classList.remove('hidden');

  // Validate on change
  container.querySelectorAll('.column-mapping-select').forEach(sel => {
    sel.addEventListener('change', validateColumnMapping);
  });

  // Also validate when default account input changes
  const defaultAccountInput = document.getElementById('defaultAccountInput');
  if (defaultAccountInput) {
    defaultAccountInput.addEventListener('input', (e) => {
      // Only allow digits
      e.target.value = e.target.value.replace(/\D/g, '');
      validateColumnMapping();
    });
  }

  validateColumnMapping();
};

// Validate that required columns are mapped
window.CardTracker.csvParser.validateColumnMapping = function() {
  const selects = document.querySelectorAll('.column-mapping-select');
  const mappings = {};
  const usedFields = new Set();

  selects.forEach(sel => {
    const field = sel.value;
    if (field) {
      // Check for duplicates
      if (usedFields.has(field)) {
        sel.style.borderColor = '#dc2626';
      } else {
        sel.style.borderColor = '';
        mappings[field] = parseInt(sel.dataset.colIndex);
        usedFields.add(field);
      }
    }
  });

  // Core required fields (account is optional if user provides default)
  const coreRequired = ['date', 'merchant', 'amount'];
  const missing = coreRequired.filter(f => !usedFields.has(f));

  const errorEl = document.getElementById('columnError');
  const confirmBtn = document.getElementById('confirmColumnsBtn');
  const defaultAccountSection = document.getElementById('defaultAccountSection');
  const defaultAccountInput = document.getElementById('defaultAccountInput');

  // Show/hide default account input based on whether account column is mapped
  // Account can come from: 'account' (card number), or 'accountCombined' (combined field)
  const hasAccountColumn = usedFields.has('account') || usedFields.has('accountCombined');
  if (defaultAccountSection) {
    defaultAccountSection.classList.toggle('hidden', hasAccountColumn);
  }

  // Check if we need a default account value
  const needsDefaultAccount = !hasAccountColumn;
  const hasValidDefaultAccount = defaultAccountInput && /^\d{4}$/.test(defaultAccountInput.value.trim());

  if (missing.length > 0) {
    errorEl.textContent = `Missing required: ${missing.join(', ')}`;
    confirmBtn.disabled = true;
  } else if (needsDefaultAccount && !hasValidDefaultAccount) {
    errorEl.textContent = 'Enter the last 4 digits of the card for this file';
    confirmBtn.disabled = true;
  } else {
    errorEl.textContent = '';
    confirmBtn.disabled = false;
  }

  return mappings;
};

// Apply column mapping and parse CSV
// References state, parseCSVLine, getCSVShapeKey, safeLocalStorageSet,
// parseCombinedAccountField, extractLast4, shouldSkipByAccountType,
// generateTransactionId from global scope (available at call time)
window.CardTracker.csvParser.applyColumnMappingAndParse = function() {
  const parseCSVLine = window.CardTracker.csvParser.parseCSVLine;
  const getCSVShapeKey = window.CardTracker.csvParser.getCSVShapeKey;

  const selects = document.querySelectorAll('.column-mapping-select');
  const columnIndices = {};
  const headerMapping = {};

  selects.forEach((sel, idx) => {
    const field = sel.value;
    const colIndex = parseInt(sel.dataset.colIndex);
    if (field) {
      columnIndices[field] = colIndex;
      headerMapping[field] = state.pendingCSVData.headers[colIndex].toLowerCase().trim();
    }
  });

  // Determine account column configuration
  const hasAccountColumn = columnIndices.account !== undefined;
  const hasAccountNameColumn = columnIndices.accountName !== undefined;
  const hasAccountTypeColumn = columnIndices.accountType !== undefined;
  const hasAccountCombinedColumn = columnIndices.accountCombined !== undefined;
  const defaultAccountInput = document.getElementById('defaultAccountInput');
  const defaultLast4 = (!hasAccountColumn && !hasAccountCombinedColumn && defaultAccountInput)
    ? defaultAccountInput.value.trim()
    : null;

  // Save this mapping for future use
  const shapeKey = getCSVShapeKey(state.pendingCSVData.headers);
  state.columnMappings[shapeKey] = headerMapping;
  safeLocalStorageSet('ccTracker_columnMappings', state.columnMappings);

  // Compute source format hash from all CSV headers
  const sourceFormat = generateSourceFormatHash(state.pendingCSVData.headers);

  // Parse the CSV using the mapping
  // Use dataLines which already accounts for headerless CSVs (includes all data rows)
  const transactions = [];
  const skippedByAccountType = [];
  const dataLines = state.pendingCSVData.dataLines || state.pendingCSVData.lines.slice(1);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    // Skip malformed rows — e.g. Amazon Retail Sync URL-only continuation lines.
    // A valid transaction must have a recognisable date in the date column.
    const _rawDate = (fields[columnIndices.date] || '').trim();
    const _looksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(_rawDate) ||
                           /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(_rawDate) ||
                           /^\d{1,2}-\d{1,2}-\d{2,4}$/.test(_rawDate);
    if (!_looksLikeDate) continue;

    const amount = parseFloat((fields[columnIndices.amount] || '0').replace(/[$,]/g, '')) || 0;
    const date = fields[columnIndices.date] || '';
    const merchant = fields[columnIndices.merchant] || '';
    const category = columnIndices.category !== undefined ? (fields[columnIndices.category] || '') : '';
    const original = columnIndices.original !== undefined ? (fields[columnIndices.original] || '') : '';

    // Handle account information based on column configuration
    let account = '';
    let accountName = null;
    let last4 = null;
    let accountType = null;

    if (hasAccountCombinedColumn) {
      // Combined field: "Chase Sapphire Reserve (...1234)" or "Credit Card (1234)"
      const combinedValue = fields[columnIndices.accountCombined] || '';
      const parsed = parseCombinedAccountField(combinedValue);
      account = combinedValue;
      last4 = parsed.cardNumber;
      accountName = parsed.accountType; // The text part is the account name
    } else if (hasAccountColumn) {
      // Dedicated card number column
      account = fields[columnIndices.account] || '';
      last4 = extractLast4(account);
    } else if (defaultLast4) {
      // User-provided default last 4
      account = `Card (...${defaultLast4})`;
      last4 = defaultLast4;
    }

    // Get account name from dedicated column if present (overrides combined field)
    if (hasAccountNameColumn) {
      accountName = fields[columnIndices.accountName] || null;
    }

    // Get account type from dedicated column if present
    if (hasAccountTypeColumn) {
      accountType = fields[columnIndices.accountType] || null;
    }

    // Skip transactions from non-credit accounts based on account type
    if (shouldSkipByAccountType(accountType)) {
      skippedByAccountType.push({ date, merchant, amount, accountType });
      continue; // Don't import this transaction
    }

    // Create unique ID with collision handling for same-batch duplicates
    const usedIds = new Set(transactions.map(t => t.id));
    const uniqueId = generateTransactionId(date, merchant, amount, last4, usedIds);

    transactions.push({
      id: uniqueId,
      date,
      merchant,
      monarchCategory: category,
      account,
      original,
      amount,
      last4,
      accountName,  // Card name like "Chase Sapphire Reserve"
      accountType,  // Account type like "Credit Card", "Checking"
      sourceFormat  // Hash of CSV headers identifying the source format
    });
  }

  // Log skipped transactions for debugging (if any)
  if (skippedByAccountType.length > 0) {
    console.log(`Skipped ${skippedByAccountType.length} non-credit card transactions based on account type:`, skippedByAccountType);
  }

  // Sign convention auto-detection
  // Monarch/Chase use "charges are negative", Rocket Money uses "charges are positive"
  // If >60% of non-zero amounts are positive, flip all amounts to normalize
  const nonZeroAmounts = transactions.filter(t => t.amount !== 0);
  if (nonZeroAmounts.length > 0) {
    const positiveCount = nonZeroAmounts.filter(t => t.amount > 0).length;
    const positivePercent = (positiveCount / nonZeroAmounts.length) * 100;

    if (positivePercent > 60) {
      // CSV uses "charges are positive" convention - flip to "charges are negative"
      for (const txn of transactions) {
        txn.amount = txn.amount * -1;
      }
      console.log(`Sign convention: detected charges-as-positive (${positivePercent.toFixed(1)}% positive), flipping all amounts`);
    } else {
      console.log(`Sign convention: charges-as-negative (${positivePercent.toFixed(1)}% positive), no flip needed`);
    }
  }

  // Clear pending data
  state.pendingCSVData = null;

  return transactions;
};

// Legacy parseCSV for backward compatibility (used when loading saved transactions)
// References parseCSVLine, extractLast4, generateTransactionId from global scope
window.CardTracker.csvParser.parseCSV = function(text) {
  const parseCSVLine = window.CardTracker.csvParser.parseCSVLine;

  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const idx = {
    date: headers.findIndex(h => h === 'date'),
    merchant: headers.findIndex(h => h === 'merchant'),
    category: headers.findIndex(h => h === 'category'),
    account: headers.findIndex(h => h === 'account'),
    amount: headers.findIndex(h => h === 'amount'),
    original: headers.findIndex(h => h.includes('original') || h.includes('statement'))
  };

  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse with quote handling
    const fields = parseCSVLine(line);

    const amount = parseFloat((fields[idx.amount] || '0').replace(/[$,]/g, '')) || 0;
    const date = fields[idx.date] || '';
    const merchant = fields[idx.merchant] || '';
    const account = fields[idx.account] || '';
    const original = fields[idx.original] || '';

    // Create unique ID with collision handling for same-batch duplicates
    // Content-based IDs ensure proper deduplication across uploads
    const last4 = extractLast4(account);
    const usedIds = new Set(transactions.map(t => t.id));
    const uniqueId = generateTransactionId(date, merchant, amount, last4, usedIds);

    transactions.push({
      id: uniqueId,
      date,
      merchant,
      monarchCategory: fields[idx.category] || '',
      account,
      original,
      amount,
      last4
    });
  }

  return transactions;
};
