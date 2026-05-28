    // Initialize sandboxed state
    window.state = {
      merchantRules: {},
      confirmedTransactions: {},
      merchantCache: {},
      creditOverrides: {},
      disabledCredits: {},
      detectedAnnualFees: {},
      cardMappings: {},
      columnMappings: {},
      pendingCSVData: null
    };

    // Bind shortcuts used in internal modules
    window.CARDS = window.CardTracker.cards;
    window.KNOWN_MERCHANTS = window.CardTracker.merchants;

    // Define simple string normalizer and HTML escape helpers
    function normalize(str) {
      return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }
    function escapeHtml(str) {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    function extractLast4(account) {
      const match = (account || '').match(/\(?\.{0,3}(\d{4})\)?\s*$/);
      return match ? match[1] : null;
    }
    // Mocks for standard app storage calls
    function safeLocalStorageSet() {}
    function generateSourceFormatHash() { return 'sandbox_format'; }
    function generateTransactionId() { return Math.random().toString(36).substring(2, 11); }
    function shouldSkipByAccountType() { return false; }

    // Spending categories - Templates of active multiplier categories
    const spendingCategories = [
      { id: 'dining', name: 'Dining & Restaurants', desc: 'Restaurants, cafes, bars, and delivery (CSR: 3x, Amex: 1x)', defaultSpend: 500, maxSpend: 3000 },
      { id: 'flights-direct', name: 'Flights (Direct)', desc: 'Flights booked directly with airlines (CSR: 4x, Amex: 5x)', defaultSpend: 200, maxSpend: 2000 },
      { id: 'hotels-direct', name: 'Hotels (Direct)', desc: 'Hotels booked directly with hotels (CSR: 4x, Amex: 1x)', defaultSpend: 150, maxSpend: 2000 },
      { id: 'portal-travel', name: 'Portal Travel (Amex/Chase)', desc: 'Bookings via Chase Travel (CSR: 8x) / Amex Travel (Amex: 5x flights & prepaid hotels)', defaultSpend: 100, maxSpend: 2000 },
      { id: 'lyft', name: 'Lyft', desc: 'Ridesharing with Lyft. CSR 5x multiplier is valid until Sept. 30, 2027.', defaultSpend: 50, maxSpend: 500 },
      { id: 'other', name: 'Everything Else', desc: 'Shopping, utilities, and general uncategorized spend (CSR: 1x, Amex: 1x)', defaultSpend: 1000, maxSpend: 5000 }
    ];

    const amexId = 'amex-platinum';
    const chaseId = 'chase-sapphire-reserve';

    const currentSpends = {};
    const checkedPerks = {
      [chaseId]: new Set(),
      [amexId]: new Set()
    };

    const amexCard = window.CardTracker.cards[amexId];
    const chaseCard = window.CardTracker.cards[chaseId];

    // Local getMultiplier implementation (replicating app-core.js pluggable hooks)
    function getMultiplier(cardId, category, txnDate = null, merchantDesc = '') {
      const card = window.CardTracker.cards[cardId];
      if (!card) return { rate: 1, reason: 'Unknown card' };

      // Execute actual card definition's pluggable hook
      if (typeof card.getMultiplier === 'function') {
        const ctx = {
          CATEGORY_HIERARCHY: window.CardTracker.classification.CATEGORY_HIERARCHY,
          getEffectiveCategory: window.CardTracker.classification.getEffectiveCategory
        };
        const result = card.getMultiplier(category, txnDate, merchantDesc, ctx);
        if (result != null) return result;
      }

      // Roll up categories using the standard classification hierarchy
      const cardCategory = window.CardTracker.classification.getEffectiveCategory(category, cardId);
      const mult = card.multipliers[cardCategory];
      return { rate: mult || card.baseRate || 1, reason: mult ? `${mult}x ${cardCategory}` : '1x base' };
    }

    // Dynamic Card Credit Detection matching app-core.js keywords
    function detectCredit(merchant, originalStatement, cardId) {
      const card = window.CardTracker.cards[cardId];
      if (!card || !card.credits) return null;

      const upper = ((merchant || '') + ' ' + (originalStatement || '')).toUpperCase();
      const excludeKeywords = ['PAYMENT', 'THANK YOU', 'AUTOMATIC PAYMENT', 'CREDIT CARD PAYMENT', 'TRANSFER',
                               'LAST STATEMENT BAL', 'STATEMENT BALANCE', 'PREVIOUS BALANCE'];
      if (excludeKeywords.some(kw => upper.includes(kw))) return null;

      const hasCredit = upper.includes('CREDIT') && !upper.includes('CREDIT CARD');
      for (const credit of card.credits) {
        if (credit.manual || !credit.keywords || credit.keywords.length === 0) continue;
        for (const kw of credit.keywords) {
          if (upper.includes(kw)) {
            if (!hasCredit) continue;
            return credit.name;
          }
        }
      }
      return null;
    }

    // Toggle All Credits helper
    window.toggleAllCredits = function(cardId, checkAll) {
      const card = window.CardTracker.cards[cardId];
      if (!card || !card.credits) return;

      const checkboxes = document.querySelectorAll(`input[data-card="${cardId}"]`);
      checkboxes.forEach(cb => {
        cb.checked = checkAll;
        const name = cb.dataset.name;
        if (checkAll) {
          checkedPerks[cardId].add(name);
        } else {
          checkedPerks[cardId].delete(name);
        }
      });
      calculateROI();
    };

    // Populate Dynamic Checklist UI
    function buildChecklists() {
      // Amex Checklist
      const amexContainer = document.getElementById('amexPerksContainer');
      amexContainer.innerHTML = '';
      amexCard.credits.forEach((credit) => {
        const isEnded = credit.endDate && new Date() > new Date(credit.endDate);
        if (isEnded) return;

        // Default value: mark auto-detected or monthly distributions as claimed by default
        const defaultValue = !credit.manual;
        if (defaultValue) checkedPerks[amexId].add(credit.name);

        const freqStr = (credit.frequency && credit.frequency.toLowerCase() !== 'none') ? ' (' + credit.frequency + ')' : '';

        const div = document.createElement('label');
        div.className = 'perk-item';
        div.innerHTML = `
          <input type="checkbox" data-card="${amexId}" data-name="${credit.name}" data-amount="${credit.amount}" ${defaultValue ? 'checked' : ''}>
          <div class="perk-info">
            <span class="perk-name">${credit.name}${freqStr}</span>
            <span class="perk-amount">+$${credit.amount.toFixed(0)}</span>
          </div>
        `;
        amexContainer.appendChild(div);
      });

      // Chase Checklist
      const chaseContainer = document.getElementById('chasePerksContainer');
      chaseContainer.innerHTML = '';
      chaseCard.credits.forEach((credit) => {
        const defaultValue = credit.name === 'Travel Credit' || !credit.manual;
        if (defaultValue) checkedPerks[chaseId].add(credit.name);

        const freqStr = (credit.frequency && credit.frequency.toLowerCase() !== 'none') ? ' (' + credit.frequency + ')' : '';

        const div = document.createElement('label');
        div.className = 'perk-item';
        div.innerHTML = `
          <input type="checkbox" data-card="${chaseId}" data-name="${credit.name}" data-amount="${credit.amount}" ${defaultValue ? 'checked' : ''}>
          <div class="perk-info">
            <span class="perk-name">${credit.name}${freqStr}</span>
            <span class="perk-amount">+$${credit.amount.toFixed(0)}</span>
          </div>
        `;
        chaseContainer.appendChild(div);
      });

      // Attach checkmark event listeners
      document.querySelectorAll('.perks-list input').forEach(input => {
        input.addEventListener('change', (e) => {
          const cardId = e.target.dataset.card;
          const name = e.target.dataset.name;
          if (e.target.checked) {
            checkedPerks[cardId].add(name);
          } else {
            checkedPerks[cardId].delete(name);
          }
          calculateROI();
        });
      });
    }

    // Build Earning Sliders
    function buildSliders() {
      const container = document.getElementById('slidersContainer');
      container.innerHTML = '';
      spendingCategories.forEach(cat => {
        currentSpends[cat.id] = cat.defaultSpend;
        const div = document.createElement('div');
        div.className = 'slider-container';
        div.innerHTML = `
          <div class="slider-header">
            <span class="slider-label"><strong>${cat.name}</strong></span>
            <span style="color: #2563eb; font-weight: 600; font-family: 'Fira Code', monospace; display: flex; align-items: center;">
              $
              <input type="number" class="slider-value-input" id="input_${cat.id}" value="${cat.defaultSpend}" min="0" style="font-family: 'Fira Code', monospace; font-weight: 600; color: #2563eb; border: none; background: transparent; text-align: right; width: 60px; font-size: 14px; outline: none; border-bottom: 1px dashed #cbd5e1; padding: 0; margin-left: 2px;">
            </span>
          </div>
          <div class="slider-subnote">${cat.desc}</div>
          <input type="range" class="slider-input slider-calc" id="slide_${cat.id}" min="0" max="${cat.maxSpend}" step="50" value="${cat.defaultSpend}">
        `;
        container.appendChild(div);
      });

      // Bind slider input events
      document.querySelectorAll('.slider-calc').forEach(slider => {
        slider.addEventListener('input', (e) => {
          const catId = e.target.id.replace('slide_', '');
          const val = parseFloat(e.target.value) || 0;
          currentSpends[catId] = val;
          document.getElementById('input_' + catId).value = val;
          calculateROI();
        });
      });

      // Bind text input events for manual editing
      document.querySelectorAll('.slider-value-input').forEach(input => {
        input.addEventListener('input', (e) => {
          const catId = e.target.id.replace('input_', '');
          const val = parseFloat(e.target.value) || 0;
          currentSpends[catId] = val;
          
          const slider = document.getElementById('slide_' + catId);
          if (slider) {
            const max = parseFloat(slider.max);
            slider.value = Math.min(val, max);
          }
          calculateROI();
        });
      });
    }

    // Mathematical ROI Calculation Engine (Phase 1 Sliders Math)
    function calculateROI() {
      const chaseValuation = parseFloat(document.getElementById('chasePointValue').value || 1.8) / 100;
      const amexValuation = parseFloat(document.getElementById('amexPointValue').value || 1.6) / 100;

      const chaseFee = chaseCard.annualFee;
      const amexFee = amexCard.annualFee;

      // 1. Chase Earning Calculations
      let chasePointsAnnual = 0;
      let chaseSpendAnnual = 0;
      for (const [catId, monthlySpend] of Object.entries(currentSpends)) {
        const annualSpend = monthlySpend * 12;
        chaseSpendAnnual += annualSpend;

        let calcCategory = catId;
        let merchantStr = '';
        if (catId === 'portal-travel') {
          calcCategory = 'chase-travel';
        }
        
        const mult = getMultiplier(chaseId, calcCategory, null, merchantStr).rate;
        chasePointsAnnual += annualSpend * mult;
      }
      const chasePointsValue = chasePointsAnnual * chaseValuation;

      // 2. Amex Earning Calculations
      let amexPointsAnnual = 0;
      let amexSpendAnnual = 0;
      for (const [catId, monthlySpend] of Object.entries(currentSpends)) {
        const annualSpend = monthlySpend * 12;
        amexSpendAnnual += annualSpend;

        let calcCategory = catId;
        let merchantStr = '';
        if (catId === 'portal-travel') {
          calcCategory = 'amex-travel';
          merchantStr = 'amextravel prepaid hotel';
        } else if (catId === 'flights-direct') {
          calcCategory = 'flights-direct';
        }

        const mult = getMultiplier(amexId, calcCategory, null, merchantStr).rate;
        amexPointsAnnual += annualSpend * mult;
      }
      const amexPointsValue = amexPointsAnnual * amexValuation;

      // 3. Sum Checked perks
      let chaseCreditsTotal = 0;
      chaseCard.credits.forEach(credit => {
        if (checkedPerks[chaseId].has(credit.name)) {
          chaseCreditsTotal += credit.amount;
        }
      });
      document.getElementById('chaseCreditsSum').textContent = '+$' + chaseCreditsTotal.toFixed(0);

      let amexCreditsTotal = 0;
      amexCard.credits.forEach(credit => {
        if (checkedPerks[amexId].has(credit.name)) {
          amexCreditsTotal += credit.amount;
        }
      });
      document.getElementById('amexCreditsSum').textContent = '+$' + amexCreditsTotal.toFixed(0);

      // 4. Net ROI Outcomes
      const chaseNetROI = chasePointsValue + chaseCreditsTotal - chaseFee;
      const amexNetROI = amexPointsValue + amexCreditsTotal - amexFee;

      // Update Panel Elements
      document.getElementById('chaseRoiDisplay').textContent = (chaseNetROI >= 0 ? '+$' : '-$') + Math.abs(chaseNetROI).toFixed(2);
      document.getElementById('chaseRoiDisplay').className = 'roi-value ' + (chaseNetROI >= 0 ? 'positive' : 'negative');
      document.getElementById('chasePointsVal').textContent = '$' + Math.abs(chasePointsValue).toFixed(0);
      document.getElementById('chaseCreditsVal').textContent = '$' + chaseCreditsTotal.toFixed(0);
      document.getElementById('chaseFeeVal').textContent = '-$' + chaseFee.toFixed(0);

      document.getElementById('amexRoiDisplay').textContent = (amexNetROI >= 0 ? '+$' : '-$') + Math.abs(amexNetROI).toFixed(2);
      document.getElementById('amexRoiDisplay').className = 'roi-value ' + (amexNetROI >= 0 ? 'positive' : 'negative');
      document.getElementById('amexPointsVal').textContent = '$' + Math.abs(amexPointsValue).toFixed(0);
      document.getElementById('amexCreditsVal').textContent = '$' + amexCreditsTotal.toFixed(0);
      document.getElementById('amexFeeVal').textContent = '-$' + amexFee.toFixed(0);

      // Sync real spend statement results dynamically if loaded
      if (window.state.parsedTransactions) {
        executeCalculationsOnParsedTransactions(window.state.parsedTransactions, false);
      }
    }

    // Phase 2: Drag & Drop Listener for CSV and JSON
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    function handleFile(file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const text = e.target.result;
        if (file.name.toLowerCase().endsWith('.json')) {
          handleJSONFile(text);
        } else {
          try {
            processCSVStatement(text);
          } catch (err) {
            console.error(err);
            alert('Error parsing CSV file. Please make sure it is a valid transaction statement export.');
          }
        }
      };
      reader.readAsText(file);
    }

    function handleJSONFile(jsonText) {
      try {
        const parsed = JSON.parse(jsonText);
        let rawTxns = [];
        
        if (parsed.processedTransactions && Array.isArray(parsed.processedTransactions)) {
          rawTxns = parsed.processedTransactions;
        } else if (parsed.transactions && Array.isArray(parsed.transactions)) {
          rawTxns = parsed.transactions;
        } else if (Array.isArray(parsed)) {
          rawTxns = parsed;
        } else {
          alert('Could not find any transaction list in the uploaded JSON.');
          return;
        }
        
        const parsedTxns = [];
        rawTxns.forEach(t => {
          const merchant = t.merchant || t.description || t.payee || '';
          const original = t.original || t.originalDescription || '';
          const amount = parseFloat(t.amount) || 0;
          const date = t.date || '';
          const subcategory = t.subcategory || t.subCategory || '';
          const category = t.category || '';
          
          const combinedText = normalize(merchant) + ' ' + normalize(original);
          const skipPatterns = window.CardTracker.classification.SPECIFIC_CATEGORY_KEYWORDS['skip'] || [];
          let isSkip = false;
          for (const pattern of skipPatterns) {
            if (combinedText.includes(pattern)) {
              isSkip = true;
              break;
            }
          }
          if (isSkip) return;
          
          parsedTxns.push({
            date,
            merchant,
            category,
            subcategory,
            original,
            amount
          });
        });
        
        const nonZero = parsedTxns.filter(t => t.amount !== 0);
        if (nonZero.length > 0) {
          const positiveCount = nonZero.filter(t => t.amount > 0).length;
          if (positiveCount / nonZero.length > 0.6) {
            parsedTxns.forEach(t => t.amount = t.amount * -1);
          }
        }
        
        executeCalculationsOnParsedTransactions(parsedTxns, true);
      } catch (err) {
        console.error(err);
        alert('Error parsing JSON file. Please make sure it is a valid Tracker export JSON.');
      }
    }

    // Column Mapping dynamic detection for dropped statements
    function processCSVStatement(csvText) {
      const parser = window.CardTracker.csvParser;
      const lines = parser.splitCSVLines(csvText);
      if (lines.length < 1) {
        alert('CSV statement is empty.');
        return;
      }

      const firstRowFields = parser.parseCSVLine(lines[0]);
      const isHeaderless = parser.isDataRow(firstRowFields);
      
      let headers;
      if (isHeaderless) {
        headers = firstRowFields.map((_, i) => `Column ${i + 1}`);
      } else {
        headers = firstRowFields;
      }

      const previewRows = lines.slice(1, 6).map(l => parser.parseCSVLine(l));
      const detected = parser.detectCSVFormat(headers, previewRows);
      const mapping = detected.mapping;

      const required = ['date', 'merchant', 'amount'];
      const missing = required.filter(f => !mapping[f]);

      if (missing.length > 0) {
        showInlineMappingDialog(headers, previewRows, mapping, csvText);
      } else {
        executeCalculationsOnMappedCSV(mapping, headers, lines, isHeaderless, csvText);
      }
    }

    // Render streamlined mapping dropdowns when auto-detect falls short
    function showInlineMappingDialog(headers, previewRows, mapping, csvText) {
      const container = document.getElementById('csvMappingContainer');
      container.classList.remove('hidden');
      
      let tableHtml = `
        <div class="mapping-dialog-title">Select CSV Column Mapping</div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">We couldn't fully map your columns automatically. Please tell us which column matches which field:</p>
        <table style="width:100%;font-size:12px;margin-bottom:12px;">
          <thead>
            <tr>
              ${headers.map((h, idx) => `
                <th style="padding:6px;border-bottom:1px solid #cbd5e1;text-align:left;">
                  <select class="map-sel" data-index="${idx}" style="font-size:11px;padding:4px;">
                    <option value="">— Skip —</option>
                    <option value="date" ${h.toLowerCase().includes('date') ? 'selected' : ''}>Date</option>
                    <option value="merchant" ${h.toLowerCase().includes('desc') || h.toLowerCase().includes('merchant') || h.toLowerCase().includes('payee') ? 'selected' : ''}>Merchant</option>
                    <option value="amount" ${h.toLowerCase().includes('amount') || h.toLowerCase().includes('charge') || h.toLowerCase().includes('debit') ? 'selected' : ''}>Amount</option>
                    <option value="category" ${h.toLowerCase().includes('cat') ? 'selected' : ''}>Category</option>
                  </select>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">"${escapeHtml(h)}"</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${headers.map((_, i) => `
                <td style="padding:6px;border-bottom:1px solid #e2e8f0;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${previewRows[0] && previewRows[0][i] ? escapeHtml(previewRows[0][i]) : ''}
                </td>
              `).join('')}
            </tr>
          </tbody>
        </table>
        <button id="btnConfirmMapping" style="padding:8px 16px;background:#1c1917;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;">Process Statement</button>
      `;

      container.innerHTML = tableHtml;

      document.getElementById('btnConfirmMapping').addEventListener('click', () => {
        const selectElements = container.querySelectorAll('.map-sel');
        const customMapping = {};
        selectElements.forEach(sel => {
          const val = sel.value;
          const idx = parseInt(sel.dataset.index);
          if (val) {
            customMapping[val] = headers[idx];
          }
        });

        if (!customMapping.date || !customMapping.merchant || !customMapping.amount) {
          alert('Please select mapping for Date, Merchant, and Amount.');
          return;
        }

        container.classList.add('hidden');
        const parser = window.CardTracker.csvParser;
        const lines = parser.splitCSVLines(csvText);
        const isHeaderless = parser.isDataRow(lines[0].split(','));
        executeCalculationsOnMappedCSV(customMapping, headers, lines, isHeaderless, csvText);
      });
    }

    // Execute Point rollups, statement credit matches, and Net ROI comparison
    function executeCalculationsOnMappedCSV(mapping, headers, lines, isHeaderless, csvText) {
      const parser = window.CardTracker.csvParser;
      
      const colIndices = {};
      headers.forEach((h, idx) => {
        const normH = h.toLowerCase().trim();
        for (const [field, mappedHeader] of Object.entries(mapping)) {
          if (mappedHeader && normH === mappedHeader.toLowerCase().trim()) {
            colIndices[field] = idx;
          }
        }
      });

      const dataRows = isHeaderless ? lines : lines.slice(1);
      const parsedTxns = [];

      dataRows.forEach(line => {
        if (!line.trim()) return;
        const fields = parser.parseCSVLine(line);

        const date = fields[colIndices.date] || '';
        const merchant = fields[colIndices.merchant] || '';
        const category = colIndices.category !== undefined ? (fields[colIndices.category] || '') : '';
        const original = colIndices.original !== undefined ? (fields[colIndices.original] || '') : '';
        const amount = parseFloat((fields[colIndices.amount] || '0').replace(/[$,]/g, '')) || 0;

        const combinedText = normalize(merchant) + ' ' + normalize(original);
        const skipPatterns = window.CardTracker.classification.SPECIFIC_CATEGORY_KEYWORDS['skip'] || [];
        let isSkip = false;
        for (const pattern of skipPatterns) {
          if (combinedText.includes(pattern)) {
            isSkip = true;
            break;
          }
        }
        if (isSkip) return;

        parsedTxns.push({ date, merchant, category, original, amount });
      });

      const nonZero = parsedTxns.filter(t => t.amount !== 0);
      if (nonZero.length > 0) {
        const positiveCount = nonZero.filter(t => t.amount > 0).length;
        if (positiveCount / nonZero.length > 0.6) {
          parsedTxns.forEach(t => t.amount = t.amount * -1);
        }
      }

      executeCalculationsOnParsedTransactions(parsedTxns, true);
    }

    function executeCalculationsOnParsedTransactions(parsedTxns, shouldScroll = true) {
      // Save parsed transactions to state so we can re-evaluate on any input updates!
      window.state.parsedTransactions = parsedTxns;

      // Hide / reset banners
      document.getElementById('uploadErrorBanner').classList.add('hidden');
      document.getElementById('uploadErrorBanner').textContent = '';

      const dates = parsedTxns.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
      let daysSpan = 0;
      if (dates.length > 1) {
        const minDate = Math.min.apply(null, dates);
        const maxDate = Math.max.apply(null, dates);
        daysSpan = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24));
      }

      if (daysSpan < 30) {
        document.getElementById('uploadErrorBanner').innerHTML = `<strong>Analysis Cannot Run:</strong> The uploaded transactions only span <strong>${daysSpan} days</strong>. We require at least <strong>30 days</strong> of statement data to project annual spending. Please upload a statement file covering a longer duration.`;
        document.getElementById('uploadErrorBanner').classList.remove('hidden');
        document.getElementById('csvResultsPanel').classList.add('hidden');
        return;
      }

      const annualizationFactor = 365 / daysSpan;

      const projNote = document.getElementById('projectionWarningNote');
      projNote.classList.add('hidden');
      if (daysSpan < 180) {
        projNote.innerHTML = `<strong>Annualized Projection:</strong> We detected <strong>${daysSpan} days</strong> of transaction data and have projected these earnings to a full 365-day year. <strong>We recommend uploading at least 6 months (180 days)</strong> of history for a more stable and accurate projection.`;
        projNote.classList.remove('hidden');
      } else if (daysSpan < 365) {
        projNote.innerHTML = `<strong>Annualized Projection:</strong> We detected <strong>${daysSpan} days</strong> of transaction data and have projected these earnings to a full 365-day year. Strong historical coverage.`;
        projNote.classList.remove('hidden');
      } else {
        projNote.innerHTML = `<strong>Annualized Average:</strong> We detected <strong>${daysSpan} days</strong> of transaction data and have scaled the average to a standard 12-month year. Excellent spending history coverage.`;
        projNote.classList.remove('hidden');
      }

      const chaseValuation = parseFloat(document.getElementById('chasePointValue').value || 1.8) / 100;
      const amexValuation = parseFloat(document.getElementById('amexPointValue').value || 1.6) / 100;

      let chaseTotalSpend = 0;
      let amexTotalSpend = 0;

      let chasePoints = 0;
      let amexPoints = 0;

      const chaseDetectedCredits = new Set();
      let chaseCreditsAmt = 0;

      const amexDetectedCredits = new Set();
      let amexCreditsAmt = 0;

      parsedTxns.forEach(txn => {
        const isCredit = txn.amount > 0;
        const absAmount = Math.abs(txn.amount);

        // Chase Sapphire Reserve Analysis
        if (!isCredit) {
          chaseTotalSpend += absAmount;
          let sub = txn.subcategory;
          if (!sub || sub === 'other') {
            const cls = window.CardTracker.classification.classifyMerchant(txn.merchant, txn.category, chaseId, txn.original);
            sub = cls.subcategory || 'other';
          }
          const cardCategory = window.CardTracker.classification.getEffectiveCategory(sub, chaseId);
          const mult = getMultiplier(chaseId, cardCategory, txn.date, txn.merchant).rate;
          chasePoints += absAmount * mult;
        } else {
          const creditName = detectCredit(txn.merchant, txn.original, chaseId);
          if (creditName && creditName !== 'Statement Credit' && creditName !== 'Rewards Redemption') {
            const creditObj = chaseCard.credits.find(c => c.name === creditName);
            if (creditObj && !chaseDetectedCredits.has(creditName)) {
              chaseCreditsAmt += creditObj.amount;
              chaseDetectedCredits.add(creditName);
            }
          }
        }

        // Amex Platinum Analysis
        if (!isCredit) {
          amexTotalSpend += absAmount;
          let sub = txn.subcategory;
          if (!sub || sub === 'other') {
            const cls = window.CardTracker.classification.classifyMerchant(txn.merchant, txn.category, amexId, txn.original);
            sub = cls.subcategory || 'other';
          }
          const cardCategory = window.CardTracker.classification.getEffectiveCategory(sub, amexId);
          
          let merchantStr = txn.merchant;
          if (sub === 'amex-travel') {
            merchantStr = 'amextravel prepaid hotel';
          }
          const mult = getMultiplier(amexId, cardCategory, txn.date, merchantStr).rate;
          amexPoints += absAmount * mult;
        } else {
          const creditName = detectCredit(txn.merchant, txn.original, amexId);
          if (creditName && creditName !== 'Statement Credit' && creditName !== 'Rewards Redemption') {
            const creditObj = amexCard.credits.find(c => c.name === creditName);
            if (creditObj && !amexDetectedCredits.has(creditName)) {
              amexCreditsAmt += creditObj.amount;
              amexDetectedCredits.add(creditName);
            }
          }
        }
      });

      // Annualize points and spend averages dynamically!
      chaseTotalSpend = chaseTotalSpend * annualizationFactor;
      amexTotalSpend = amexTotalSpend * annualizationFactor;
      chasePoints = chasePoints * annualizationFactor;
      amexPoints = amexPoints * annualizationFactor;

      const chaseFee = chaseCard.annualFee;
      const amexFee = amexCard.annualFee;

      const chasePointsValue = chasePoints * chaseValuation;
      const amexPointsValue = amexPoints * amexValuation;

      const chaseROI = chasePointsValue + chaseCreditsAmt - chaseFee;
      const amexROI = amexPointsValue + amexCreditsAmt - amexFee;

      document.getElementById('csvResultsPanel').classList.remove('hidden');

      document.getElementById('resChaseSpend').textContent = '$' + chaseTotalSpend.toFixed(2);
      document.getElementById('resAmexSpend').textContent = '$' + amexTotalSpend.toFixed(2);

      document.getElementById('resChasePoints').textContent = Math.round(chasePoints).toLocaleString() + ' pts';
      document.getElementById('resAmexPoints').textContent = Math.round(amexPoints).toLocaleString() + ' pts';

      document.getElementById('resChasePointsValue').textContent = '$' + chasePointsValue.toFixed(2);
      document.getElementById('resAmexPointsValue').textContent = '$' + amexPointsValue.toFixed(2);

      document.getElementById('resChaseCredits').textContent = '$' + chaseCreditsAmt.toFixed(2);
      document.getElementById('resAmexCredits').textContent = '$' + amexCreditsAmt.toFixed(2);

      document.getElementById('resChaseFee').textContent = '-$' + chaseFee.toFixed(2);
      document.getElementById('resAmexFee').textContent = '-$' + amexFee.toFixed(2);

      document.getElementById('resChaseRoi').textContent = (chaseROI >= 0 ? '+$' : '-$') + Math.abs(chaseROI).toFixed(2);
      document.getElementById('resChaseRoi').className = 'bold mono ' + (chaseROI >= 0 ? 'positive' : 'negative');

      document.getElementById('resAmexRoi').textContent = (amexROI >= 0 ? '+$' : '-$') + Math.abs(amexROI).toFixed(2);
      document.getElementById('resAmexRoi').className = 'bold mono ' + (amexROI >= 0 ? 'positive' : 'negative');

      const banner = document.getElementById('csvWinnerBanner');
      if (chaseROI > amexROI) {
        const diff = chaseROI - amexROI;
        banner.textContent = `Based on your real spend, Chase Sapphire Reserve wins by $${diff.toFixed(2)} !`;
        banner.style.background = '#dcfce7';
        banner.style.color = '#15803d';
        banner.style.borderColor = '#bbf7d0';
      } else {
        const diff = amexROI - chaseROI;
        banner.textContent = `Based on your real spend, Amex Platinum wins by $${diff.toFixed(2)} !`;
        banner.style.background = '#eff6ff';
        banner.style.color = '#1e40af';
        banner.style.borderColor = '#bfdbfe';
      }

      if (shouldScroll) {
        document.getElementById('csvResultsPanel').scrollIntoView({ behavior: 'smooth' });
      }
    }

    // 3D Card Hover Effect
    function initCardParallax(cardId) {
      const cardEl = document.getElementById(cardId);
      const parent = cardEl.parentElement;

      parent.addEventListener('mousemove', (e) => {
        const rect = parent.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const xc = rect.width / 2;
        const yc = rect.height / 2;
        const tiltX = (yc - y) / 10;
        const tiltY = (x - xc) / 10;

        cardEl.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.05)`;
      });

      parent.addEventListener('mouseleave', () => {
        cardEl.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
      });
    }

    window.addEventListener('DOMContentLoaded', () => {
      document.getElementById('chaseNameLabel').textContent = chaseCard.shortName || chaseCard.name;
      document.getElementById('amexNameLabel').textContent = amexCard.shortName || amexCard.name;

      buildChecklists();
      buildSliders();
      calculateROI();

      document.getElementById('chasePointValue').addEventListener('input', calculateROI);
      document.getElementById('amexPointValue').addEventListener('input', calculateROI);

      initCardParallax('chaseCard3D');
      initCardParallax('amexCard3D');
    });
