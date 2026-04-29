// =============================================================================
// BILT SHARED PLUGIN
// =============================================================================
// Shared logic for all Bilt cards (Blue, Obsidian, Palladium).
// Individual Bilt card files reference these hooks via window.CardTracker.biltPlugin.
// This file must load BEFORE individual Bilt card files in the HTML.

window.CardTracker = window.CardTracker || {};

// Simple debounce helper (used by Bilt config calculator input)
function _biltDebounce(fn, delay) {
  var timer;
  return function() {
    var args = arguments;
    var self = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(self, args); }, delay);
  };
}

window.CardTracker.biltPlugin = {

  // =========================================================================
  // BILT PROGRAM CONSTANTS — update here when Bilt changes program terms
  // =========================================================================

  BILT_2_START: new Date(2026, 1, 7),   // Feb 7, 2026 — Bilt 2.0 program launch date

  BILT_CASH_RATE: 0.04,                  // 4% Bilt Cash earned on non-rent spend

  RENT_POINTS_FLOOR: 250,                // Minimum rent points awarded when below spend threshold

  RENT_TIERS: [
    { minRatio: 1.00, rate: 1.25, label: '100%+' },
    { minRatio: 0.75, rate: 1.00, label: '75-99%' },
    { minRatio: 0.50, rate: 0.75, label: '50-74%' },
    { minRatio: 0.25, rate: 0.50, label: '25-49%' },
    // Below 0.25: rate = 0, floor applies
  ],

  // =========================================================================
  // getMultiplier hook — handles legacy vs 2.0, rent calculation
  // =========================================================================
  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    // Determine which card is calling (passed via _pluginCardId set by dispatch)
    const cardId = this._pluginCardId;
    const card = ctx.CARDS[cardId];
    if (!card) return null;

    const cfg = ctx.state.biltConfig[cardId] || {};

    // Parse transaction date to avoid timezone issues
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
    const isLegacy = txnDateObj.getTime() < window.CardTracker.biltPlugin.BILT_2_START.getTime();

    // LEGACY MODE (before Feb 7, 2026)
    // All Bilt cards had identical rates: 3x dining, 2x travel, 1x everything else
    if (isLegacy) {
      if (category === 'rent') {
        return { rate: 1, reason: '1x rent (Legacy Bilt — 5 txn requirement)' };
      }
      if (category === 'dining') return { rate: 3, reason: '3x dining (Legacy Bilt)' };
      if (category === 'travel') return { rate: 2, reason: '2x travel (Legacy Bilt)' };
      return { rate: 1, reason: '1x base (Legacy Bilt)' };
    }

    // BILT 2.0 MODE (Feb 7, 2026+)
    if (category === 'rent') {
      const rentAmt = cfg.manualRentAmount || 2000;
      const txnMonth = txnDateObj.getMonth();
      const txnYear = txnDateObj.getFullYear();

      if (cfg.rewardOption === 'housing-only') {
        // Spend on this card between rent payments (same calendar month),
        // excluding rent itself. Falls back to raw txns if processed not yet available.
        let monthSpend = 0;
        const processed = (ctx.state.results && ctx.state.results.processed) || null;
        if (processed) {
          const sameMonth = processed.filter(t => {
            if (t.cardId !== cardId) return false;
            if (t.category === 'rent') return false;
            if (t.isPayment || t.isAnnualFee) return false;
            const p = ctx.parseDateString(t.date);
            if (!p) return false;
            return p.year === txnYear && (p.month - 1) === txnMonth;
          });
          const purchases = sameMonth.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
          const refunds = sameMonth.filter(t => t.amount > 0 && !t.isCredit).reduce((s, t) => s + t.amount, 0);
          monthSpend = Math.max(0, purchases - refunds);
        } else {
          const monthTxns = ctx.state.transactions.filter(t => {
            const mappedCardId = ctx.state.cardMappings[t.last4];
            if (mappedCardId !== cardId) return false;
            const p = ctx.parseDateString(t.date);
            if (!p) return false;
            return p.year === txnYear && (p.month - 1) === txnMonth;
          });
          const purchases = monthTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
          const refunds = monthTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
          monthSpend = Math.max(0, purchases - refunds - rentAmt);
        }

        const ratio = rentAmt > 0 ? monthSpend / rentAmt : 0;
        var tiers = window.CardTracker.biltPlugin.RENT_TIERS;
        let rate = 0, tierName = '<25%';
        for (var ti = 0; ti < tiers.length; ti++) {
          if (ratio >= tiers[ti].minRatio) { rate = tiers[ti].rate; tierName = tiers[ti].label; break; }
        }

        if (rate === 0) {
          return { rate: 0, reason: `Rent: ${window.CardTracker.biltPlugin.RENT_POINTS_FLOOR}pt floor (${tierName}, $${monthSpend.toFixed(0)}/$${rentAmt} non-rent spend)` };
        }
        return { rate, reason: `Rent: ${rate}x Housing-only (${tierName}: $${monthSpend.toFixed(0)}/$${rentAmt} non-rent spend)` };
      } else {
        // Bilt Cash mode: assume the user redeems enough Bilt Cash to fully
        // fund 1x rent points, unless the user has marked this month as
        // not redeemed in the Bilt Card Config.
        const unredeemed = (cfg.biltCashUnredeemedMonths && cfg.biltCashUnredeemedMonths[txnYear]) || [];
        if (unredeemed.indexOf(txnMonth) !== -1) {
          return { rate: 0, reason: 'Rent: Bilt Cash not redeemed this month (config)' };
        }
        return { rate: 1, reason: '1x rent (Bilt Cash redeemed for full value)' };
      }
    }

    // Obsidian 3x bonus category choice (dining OR grocery)
    if (card.hasObsidianBonus) {
      if (cfg.bonusCategory === 'grocery') {
        if (category === 'grocery') return { rate: 3, reason: '3x grocery (Obsidian bonus)' };
        if (category === 'dining') return { rate: 1, reason: '1x dining (grocery selected)' };
      } else {
        if (category === 'dining') return { rate: 3, reason: '3x dining (Obsidian bonus)' };
        if (category === 'grocery') return { rate: 1, reason: '1x grocery (dining selected)' };
      }
    }

    // Standard multipliers from card definition
    if (card.multipliers[category]) {
      return { rate: card.multipliers[category], reason: `${card.multipliers[category]}x ${category}` };
    }
    return { rate: card.baseRate, reason: `${card.baseRate}x base rate` };
  },

  // =========================================================================
  // getCategories hook — legacy categories before Bilt 2.0
  // =========================================================================
  getCategories: function(txnDate, ctx) {
    const cardId = this._pluginCardId;
    const card = ctx.CARDS[cardId];
    if (!card) return null;

    const txnDateObj = txnDate ? new Date(txnDate) : new Date();
    if (txnDateObj.getTime() < window.CardTracker.biltPlugin.BILT_2_START.getTime()) {
      return card.legacy?.categories || ['dining', 'travel', 'rent', 'other'];
    }
    return card.categories || ['other'];
  },

  // =========================================================================
  // getScenarioMultiplier — forward-looking (today's rates, no date logic)
  // =========================================================================
  getScenarioMultiplier: function(category, ctx) {
    const cardId = this._pluginCardId;
    const card = ctx.CARDS[cardId];
    if (!card) return null;

    // For scenarios, use Bilt 2.0 rates (current)
    // Rent: use conservative 1x estimate for scenarios
    if (category === 'rent') {
      return { rate: 1, reason: '1x rent (estimated - configure card for actual rate)' };
    }

    // Obsidian bonus
    if (card.hasObsidianBonus) {
      const cfg = ctx.state.biltConfig[cardId] || {};
      if (cfg.bonusCategory === 'grocery') {
        if (category === 'grocery') return { rate: 3, reason: '3x grocery (Obsidian bonus)' };
        if (category === 'dining') return { rate: 1, reason: '1x dining (grocery selected)' };
      } else {
        if (category === 'dining') return { rate: 3, reason: '3x dining (Obsidian bonus)' };
        if (category === 'grocery') return { rate: 1, reason: '1x grocery (dining selected)' };
      }
    }

    if (card.multipliers[category]) {
      return { rate: card.multipliers[category], reason: `${card.multipliers[category]}x ${category}` };
    }
    return { rate: card.baseRate, reason: `${card.baseRate}x base rate` };
  },

  // =========================================================================
  // renderConfigSection — Bilt 2.0 config UI HTML
  // =========================================================================
  renderConfigSection: function(cardId, ctx) {
    var card = ctx.CARDS[cardId];
    if (!card) return '';
    var state = ctx.state;
    var cfg = state.biltConfig[cardId] || {
      rewardMode: 'bilt-cash',
      rewardOption: 'flexible',
      rentDetection: 'auto',
      manualRentAmount: 2000,
      manualRentDay: 1,
      rentMerchantKeyword: '',
      bonusCategory: 'dining',
      countBiltCashAsCredit: true,
      biltCashRedemptions: []
    };
    // Backwards compat: rewardMode is the new top-level toggle. Map from legacy rewardOption.
    var rewardMode = cfg.rewardMode;
    if (!rewardMode) rewardMode = (cfg.rewardOption === 'housing-only') ? 'housing-only' : 'bilt-cash';
    var isHousingOnly = rewardMode === 'housing-only';
    var isManualRent = cfg.rentDetection === 'manual';

    // Get available years from processed transactions
    var processedTxns = (state.results && state.results.processed) || [];
    var biltYearsSeen = {};
    var biltYears = [];
    for (var i = 0; i < processedTxns.length; i++) {
      var t = processedTxns[i];
      if (t.cardId && t.cardId.indexOf('bilt-') === 0) {
        var y = ctx.getYearFromDateString(t.date);
        if (!biltYearsSeen[y]) { biltYearsSeen[y] = true; biltYears.push(y); }
      }
    }
    biltYears.sort(function(a, b) { return b - a; });
    var currentYear = new Date().getFullYear();
    var availableBiltYears = biltYears.length > 0 ? biltYears : [currentYear];
    var selectedBiltYear = state.selectedBiltYear || 'all';

    // Calculate Bilt Cash earned (BILT_CASH_RATE of non-rent Bilt card spend, post-Bilt 2.0)
    var biltNonRentSpend = 0;
    var biltRefunds = 0;
    for (var j = 0; j < processedTxns.length; j++) {
      var pt = processedTxns[j];
      if (!pt.cardId || pt.cardId.indexOf('bilt-') !== 0) continue;
      var d = new Date(pt.date);
      if (d.getTime() < window.CardTracker.biltPlugin.BILT_2_START.getTime()) continue;
      if (selectedBiltYear !== 'all' && ctx.getYearFromDateString(pt.date) !== parseInt(selectedBiltYear)) continue;
      if (pt.category === 'rent') continue;
      if (pt.amount < 0) biltNonRentSpend += Math.abs(pt.amount);
      else biltRefunds += pt.amount;
    }
    var netBiltSpend = Math.max(0, biltNonRentSpend - biltRefunds);
    var biltCashEarned = netBiltSpend * window.CardTracker.biltPlugin.BILT_CASH_RATE;

    // Calculate rent amount for helper text. The Monthly Rent Payment input at the
    // top of the section is the canonical rent amount (cfg.manualRentAmount).
    var rent = cfg.manualRentAmount || 0;
    var cashFor100 = (rent / 100) * 3;
    // In Bilt Cash mode the monthly Bilt Cash redemption is always derived from
    // rent (enough to fully fund 1x rent points). Housing-only mode does not use it.
    // (cashFor100 is reused below for the inline display.)

    var yearOptions = '<option value="all"' + (selectedBiltYear === 'all' ? ' selected' : '') + '>All Years</option>';
    for (var yi = 0; yi < availableBiltYears.length; yi++) {
      yearOptions += '<option value="' + availableBiltYears[yi] + '"' + (selectedBiltYear === availableBiltYears[yi] ? ' selected' : '') + '>' + availableBiltYears[yi] + '</option>';
    }

    var dayOptions = '';
    for (var di = 1; di <= 28; di++) {
      var suffix = di === 1 ? 'st' : di === 2 ? 'nd' : di === 3 ? 'rd' : 'th';
      dayOptions += '<option value="' + di + '"' + (parseInt(cfg.manualRentDay) === di ? ' selected' : '') + '>' + di + suffix + '</option>';
    }

    // Build redemption ledger for the selected year
    var allRedemptions = Array.isArray(cfg.biltCashRedemptions) ? cfg.biltCashRedemptions.slice() : [];
    var filteredRedemptions = allRedemptions.filter(function(r) {
      if (selectedBiltYear === 'all') return true;
      if (!r || !r.date) return false;
      var ry = ctx.getYearFromDateString(r.date);
      return ry === parseInt(selectedBiltYear);
    });
    filteredRedemptions.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var redemptionsTotal = filteredRedemptions.reduce(function(sum, r) { return sum + (parseFloat(r.amount) || 0); }, 0);

    var redemptionsListHtml;
    if (filteredRedemptions.length === 0) {
      redemptionsListHtml = '<div style="font-size:11px;color:#a8a29e;font-style:italic;padding:8px 4px;">No redemptions recorded' + (selectedBiltYear === 'all' ? '.' : ' for ' + selectedBiltYear + '.') + '</div>';
    } else {
      redemptionsListHtml = filteredRedemptions.map(function(r) {
        var amt = parseFloat(r.amount) || 0;
        return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 8px;border-bottom:1px solid #f1f0ed;font-size:11px;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:500;color:#44403c;">' + ctx.escapeHtml(r.description || '(no description)') + '</div>' +
            '<div style="font-size:10px;color:#a8a29e;">' + ctx.escapeHtml(r.date || '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="font-weight:600;color:#166534;white-space:nowrap;">$' + amt.toFixed(2) + '</span>' +
            '<button class="bilt-redemption-remove" data-card="' + cardId + '" data-id="' + ctx.escapeHtml(r.id || '') + '" title="Remove" style="background:none;border:none;cursor:pointer;color:#a8a29e;font-size:14px;line-height:1;padding:0 2px;">&times;</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    var todayStr = (function() {
      var dt = new Date();
      var mm = String(dt.getMonth() + 1).padStart(2, '0');
      var dd = String(dt.getDate()).padStart(2, '0');
      return dt.getFullYear() + '-' + mm + '-' + dd;
    })();

    var html = '<div style="margin-bottom:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<h3 style="font-size:14px;font-weight:600;margin:0;">&#127968; Bilt Rewards Configuration</h3>' +
        '<select id="biltYearSelect" class="form-select" style="min-width:100px;padding:6px 10px;font-size:12px;">' + yearOptions + '</select>' +
      '</div>' +
      '<p style="font-size:11px;color:#78716c;margin-bottom:12px;">Bilt 2.0 began February 7, 2026. Transactions before this date use legacy earning rates.</p>' +

      // Primary Selection — Reward Mode (top of section)
      '<div style="margin-bottom:16px;padding:12px;border:1px solid #e7e5e4;border-radius:8px;background:#fff;">' +
        '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:8px;">Reward Mode</label>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:8px;border-radius:6px;border:1px solid ' + (isHousingOnly ? '#059669' : '#d4d4d4') + ';background:' + (isHousingOnly ? '#f0fdf4' : '#fff') + ';">' +
            '<input type="radio" name="biltRewardMode-' + cardId + '" value="housing-only"' + (isHousingOnly ? ' checked' : '') + ' class="bilt-reward-mode" data-card="' + cardId + '" style="margin-top:2px;accent-color:#059669;">' +
            '<div>' +
              '<span style="font-size:12px;font-weight:600;">Housing Only Rewards</span>' +
              '<p style="font-size:10px;color:#78716c;margin:2px 0 0 0;">Earn rent points automatically based on monthly spending ratio. Bilt Cash earning and redemption are not used.</p>' +
            '</div>' +
          '</label>' +
          '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:8px;border-radius:6px;border:1px solid ' + (!isHousingOnly ? '#059669' : '#d4d4d4') + ';background:' + (!isHousingOnly ? '#f0fdf4' : '#fff') + ';">' +
            '<input type="radio" name="biltRewardMode-' + cardId + '" value="bilt-cash"' + (!isHousingOnly ? ' checked' : '') + ' class="bilt-reward-mode" data-card="' + cardId + '" style="margin-top:2px;accent-color:#059669;">' +
            '<div>' +
              '<span style="font-size:12px;font-weight:600;">Bilt Cash</span>' +
              '<p style="font-size:10px;color:#78716c;margin:2px 0 0 0;">Earn 4% Bilt Cash on non-rent spend and redeem it for rent points or other rewards.</p>' +
            '</div>' +
          '</label>' +
        '</div>' +
      '</div>' +

      // Rent & Automation header (Monthly Rent Payment with auto-derived Bilt Cash hint)
      '<div style="margin-bottom:16px;padding:12px;border:1px solid #e7e5e4;border-radius:8px;background:#fff;">' +
        '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:8px;">Monthly Rent Payment</label>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">' +
          '<span style="font-size:14px;color:#44403c;">$</span>' +
          '<input type="number" min="0" step="1" class="bilt-rent-amount-top form-input" data-card="' + cardId + '" value="' + (rent || '') + '" placeholder="0" style="width:140px;padding:6px;">' +
          '<span style="font-size:11px;color:#78716c;">/ month</span>' +
          (isHousingOnly ? '' :
            '<span class="bilt-monthly-redemption-display" data-card="' + cardId + '" style="font-size:11px;color:#a8a29e;font-style:italic;margin-left:4px;">' +
              '&rarr; $<span class="bilt-cash-needed-display">' + cashFor100.toFixed(2) + '</span> Bilt Cash redeemed/mo' +
            '</span>'
          ) +
        '</div>' +
        '<p style="font-size:11px;color:#78716c;margin:0;">' +
          (isHousingOnly
            ? 'Used to compute your monthly spend ratio for housing-only rent points.'
            : 'Bilt Cash redeemed for rent points is auto-calculated from rent ($3 Bilt Cash = 100 points per $100 rent).'
          ) +
        '</p>' +
      '</div>';

    // ====================== HOUSING-ONLY SECTION ======================
    if (isHousingOnly) {
      html +=
        '<div style="margin-bottom:16px;padding:12px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;">' +
          '<p style="font-size:11px;color:#78716c;margin-bottom:8px;"><strong>Housing-only mode:</strong> Your rent points multiplier is calculated automatically based on your everyday spend ratio.</p>' +
          '<div style="font-size:10px;color:#78716c;">' +
            '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">' +
              (function() {
                var tiers = window.CardTracker.biltPlugin.RENT_TIERS;
                return tiers.map(function(t) { return '<span>' + t.label + ' spend &rarr; ' + t.rate + 'x</span>'; }).join('');
              })() +
            '</div>' +
            '<p style="margin-top:6px;">Below 25% = ' + window.CardTracker.biltPlugin.RENT_POINTS_FLOOR + ' points floor</p>' +
          '</div>' +
        '</div>';
    } else {
      // ====================== BILT CASH SECTION ======================

      var pastExpanded = state.biltPastRedemptionsExpanded && state.biltPastRedemptionsExpanded[cardId];
      var arrowChar = pastExpanded ? '&#9662;' : '&#9656;'; // ▼ vs ▶

      // Unredeemed months grid (which months the user did NOT redeem
      // Bilt Cash for rent points → those months earn 0 rent points).
      var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var unredeemedYearMap = (cfg.biltCashUnredeemedMonths && typeof cfg.biltCashUnredeemedMonths === 'object') ? cfg.biltCashUnredeemedMonths : {};
      var unredeemedYear = selectedBiltYear === 'all' ? currentYear : parseInt(selectedBiltYear);
      var unredeemedList = unredeemedYearMap[unredeemedYear] || [];
      var unredeemedMonthsHtml = MONTHS_SHORT.map(function(m, idx) {
        var marked = unredeemedList.indexOf(idx) !== -1;
        return '<label class="bilt-unredeemed-month" data-card="' + cardId + '" data-year="' + unredeemedYear + '" data-month="' + idx + '" ' +
          'style="display:flex;align-items:center;justify-content:center;width:42px;padding:6px 0;border:1px solid ' + (marked ? '#fca5a5' : '#e7e5e4') + ';border-radius:4px;cursor:pointer;font-size:11px;background:' + (marked ? '#fee2e2' : '#fff') + ';color:' + (marked ? '#991b1b' : '#44403c') + ';" ' +
          'title="Click to ' + (marked ? 'mark ' + m + ' as redeemed' : 'mark ' + m + ' as NOT redeemed for rent points') + '">' +
          '<input type="checkbox" class="bilt-unredeemed-month-input" data-card="' + cardId + '" data-year="' + unredeemedYear + '" data-month="' + idx + '" ' + (marked ? 'checked' : '') + ' style="display:none;">' +
          m +
          '</label>';
      }).join('');
      html +=
        '<div style="margin-bottom:16px;padding:12px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<span style="font-size:12px;font-weight:600;">&#128197; Months Bilt Cash Not Redeemed for Rent (' + unredeemedYear + ')</span>' +
            '<span style="font-size:11px;color:#78716c;">' + unredeemedList.length + ' selected</span>' +
          '</div>' +
          '<p style="font-size:10px;color:#78716c;margin:0 0 8px 0;">Click a month if you did not redeem Bilt Cash for rent points that month. Rent points for selected months will be reduced to 0.</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + unredeemedMonthsHtml + '</div>' +
        '</div>';

      // Bilt Cash Redeemed ledger (replaces "Bilt Cash Earned" box)
      html +=
        '<div style="margin-bottom:16px;padding:12px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
            '<span style="font-size:12px;font-weight:600;">&#128176; Bilt Cash Redeemed (' + (selectedBiltYear === 'all' ? 'All Time' : selectedBiltYear) + ')</span>' +
            '<span style="font-size:18px;font-weight:700;color:#166534;">$' + redemptionsTotal.toFixed(2) + '</span>' +
          '</div>' +
          '<p style="font-size:10px;color:#78716c;margin-bottom:8px;">Bilt Cash earned in this window: $' + biltCashEarned.toFixed(2) + ' (' + (window.CardTracker.biltPlugin.BILT_CASH_RATE * 100) + '% of $' + netBiltSpend.toFixed(2) + ' non-rent Bilt spend, post-Feb 7, 2026).</p>' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;margin-bottom:10px;">' +
            '<input type="checkbox" class="bilt-cash-as-credit" data-card="' + cardId + '"' + (cfg.countBiltCashAsCredit !== false ? ' checked' : '') + '>' +
            '<span>Count Bilt Cash as statement credit</span>' +
          '</label>' +

          // Add redemption form
          '<div style="border-top:1px solid #e7e5e4;padding-top:10px;margin-top:6px;">' +
            '<div style="font-size:11px;font-weight:600;color:#44403c;margin-bottom:6px;">Add a redemption</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;">' +
              '<div style="display:flex;align-items:center;gap:4px;">' +
                '<span style="font-size:12px;">$</span>' +
                '<input type="number" min="0" step="0.01" class="bilt-redemption-amount form-input" data-card="' + cardId + '" placeholder="0.00" style="width:90px;padding:5px;font-size:11px;">' +
              '</div>' +
              '<input type="text" class="bilt-redemption-desc form-input" data-card="' + cardId + '" placeholder="Description" style="flex:1;min-width:140px;padding:5px;font-size:11px;">' +
              '<input type="date" class="bilt-redemption-date form-input" data-card="' + cardId + '" value="' + todayStr + '" style="padding:5px;font-size:11px;">' +
              '<button class="bilt-redemption-add" data-card="' + cardId + '" type="button" style="padding:6px 12px;font-size:11px;font-weight:600;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;">Add</button>' +
            '</div>' +
          '</div>' +

          // Past redemptions (collapsible)
          '<div style="margin-top:10px;">' +
            '<button type="button" class="bilt-past-toggle" data-card="' + cardId + '" style="display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;padding:4px 0;cursor:pointer;font-size:11px;font-weight:600;color:#44403c;text-align:left;">' +
              '<span class="bilt-past-arrow">' + arrowChar + '</span>' +
              '<span>Past Redemptions (' + filteredRedemptions.length + ')</span>' +
            '</button>' +
            '<div class="bilt-past-list" data-card="' + cardId + '" style="' + (pastExpanded ? '' : 'display:none;') + 'margin-top:4px;max-height:140px;overflow-y:auto;border:1px solid #e7e5e4;border-radius:6px;background:#fff;">' +
              redemptionsListHtml +
            '</div>' +
          '</div>' +
        '</div>';
    }

    // Rent Detection (kept for both modes — drives transaction matching)
    html +=
      '<div style="margin-bottom:16px;padding:12px;border:1px solid #e7e5e4;border-radius:8px;">' +
        '<label style="display:block;font-size:12px;font-weight:500;margin-bottom:8px;">How should we detect rent payments?</label>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
            '<input type="radio" name="biltRentDetection-' + cardId + '" value="auto"' + (!isManualRent ? ' checked' : '') + ' class="bilt-rent-detection" data-card="' + cardId + '">' +
            '<span style="font-size:12px;">Auto-detect (uses rent/mortgage categories &amp; common keywords)</span>' +
          '</label>' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
            '<input type="radio" name="biltRentDetection-' + cardId + '" value="manual"' + (isManualRent ? ' checked' : '') + ' class="bilt-rent-detection" data-card="' + cardId + '">' +
            '<span style="font-size:12px;">Manual configuration</span>' +
          '</label>' +
        '</div>' +
        '<div id="biltManualRent-' + cardId + '" style="' + (isManualRent ? '' : 'display:none;') + 'margin-top:12px;padding:10px;background:#f5f5f4;border-radius:6px;">' +
          '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:8px;">' +
            '<div>' +
              '<label style="font-size:10px;display:block;margin-bottom:2px;">Day of month:</label>' +
              '<select class="bilt-rent-day form-select" data-card="' + cardId + '" style="padding:4px;">' + dayOptions + '</select>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:10px;display:block;margin-bottom:2px;">Merchant keyword (optional, e.g. &quot;BILT&quot; or your landlord name):</label>' +
            '<input type="text" class="bilt-rent-keyword form-input" data-card="' + cardId + '" value="' + ctx.escapeHtml(cfg.rentMerchantKeyword || '') + '" placeholder="Leave blank to use amount+date" style="width:100%;padding:4px;font-size:11px;">' +
          '</div>' +
          '<p style="font-size:10px;color:#a8a29e;margin:6px 0 0 0;">Monthly rent amount is set at the top of this section.</p>' +
        '</div>' +
      '</div>';

    // Obsidian Bonus Category
    if (card.hasObsidianBonus) {
      html += '<div style="margin-bottom:12px;padding:12px;border:1px solid #e7e5e4;border-radius:8px;">' +
        '<label style="display:block;font-size:12px;font-weight:500;margin-bottom:8px;">Which category gets your 3x bonus? (annual choice)</label>' +
        '<div style="display:flex;gap:16px;">' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
            '<input type="radio" name="biltBonus-' + cardId + '" value="dining"' + (cfg.bonusCategory !== 'grocery' ? ' checked' : '') + ' class="bilt-bonus-cat" data-card="' + cardId + '">' +
            '<span style="font-size:12px;">Dining</span>' +
          '</label>' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
            '<input type="radio" name="biltBonus-' + cardId + '" value="grocery"' + (cfg.bonusCategory === 'grocery' ? ' checked' : '') + ' class="bilt-bonus-cat" data-card="' + cardId + '">' +
            '<span style="font-size:12px;">Grocery (up to $25k/yr)</span>' +
          '</label>' +
        '</div>' +
      '</div>';
    }

    html += '</div>';
    return html;
  },

  // =========================================================================
  // attachConfigListeners — Bilt 2.0 config event handlers
  // =========================================================================
  attachConfigListeners: function(cardId, ctx) {
    var state = ctx.state;

    // Year dropdown
    var biltYearSelect = document.getElementById('biltYearSelect');
    if (biltYearSelect) {
      biltYearSelect.addEventListener('change', function() {
        state.selectedBiltYear = biltYearSelect.value === 'all' ? 'all' : parseInt(biltYearSelect.value);
        ctx.renderCardConfig();
      });
    }

    // Bilt Cash as credit checkbox
    document.querySelectorAll('.bilt-cash-as-credit').forEach(function(checkbox) {
      checkbox.addEventListener('change', function() {
        var cid = checkbox.dataset.card;
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        state.biltConfig[cid].countBiltCashAsCredit = checkbox.checked;
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
      });
    });

    // Primary reward mode toggle (Housing Only / Bilt Cash)
    document.querySelectorAll('.bilt-reward-mode').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var cid = radio.dataset.card;
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        state.biltConfig[cid].rewardMode = radio.value;
        // Keep legacy rewardOption synced for downstream multiplier logic
        state.biltConfig[cid].rewardOption = radio.value === 'housing-only' ? 'housing-only' : 'flexible';
        // In Bilt Cash mode, derive monthly redemption from rent automatically.
        if (radio.value !== 'housing-only') {
          var rentNow = state.biltConfig[cid].manualRentAmount || 0;
          state.biltConfig[cid].monthlyBiltCashRedemption = (rentNow / 100) * 3;
        }
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        ctx.renderCardConfig();
      });
    });

    // Monthly Rent Payment input (top of section — canonical rent amount).
    // In Bilt Cash mode, derives monthlyBiltCashRedemption automatically.
    document.querySelectorAll('.bilt-rent-amount-top').forEach(function(input) {
      var debouncedSave = _biltDebounce(function(cid, rentVal) {
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        state.biltConfig[cid].manualRentAmount = rentVal;
        var mode = state.biltConfig[cid].rewardMode
          || (state.biltConfig[cid].rewardOption === 'housing-only' ? 'housing-only' : 'bilt-cash');
        if (mode !== 'housing-only') {
          state.biltConfig[cid].monthlyBiltCashRedemption = (rentVal / 100) * 3;
        }
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
      }, 300);

      input.addEventListener('input', function() {
        var cid = input.dataset.card;
        var rentVal = parseFloat(input.value) || 0;
        var cashFor100 = (rentVal / 100) * 3;

        // Immediate UI: update the grey-text monthly Bilt Cash display
        var displaySpan = document.querySelector('.bilt-monthly-redemption-display[data-card="' + cid + '"] .bilt-cash-needed-display');
        if (displaySpan) displaySpan.textContent = cashFor100.toFixed(2);

        debouncedSave(cid, rentVal);
      });
    });

    // Past Redemptions collapsible toggle
    document.querySelectorAll('.bilt-past-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var cid = btn.dataset.card;
        if (!state.biltPastRedemptionsExpanded) state.biltPastRedemptionsExpanded = {};
        var expanded = !state.biltPastRedemptionsExpanded[cid];
        state.biltPastRedemptionsExpanded[cid] = expanded;
        var list = document.querySelector('.bilt-past-list[data-card="' + cid + '"]');
        if (list) list.style.display = expanded ? '' : 'none';
        var arrow = btn.querySelector('.bilt-past-arrow');
        if (arrow) arrow.innerHTML = expanded ? '&#9662;' : '&#9656;';
      });
    });

    // Add a Bilt Cash redemption (ledger)
    document.querySelectorAll('.bilt-redemption-add').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var cid = btn.dataset.card;
        var amtInput = document.querySelector('.bilt-redemption-amount[data-card="' + cid + '"]');
        var descInput = document.querySelector('.bilt-redemption-desc[data-card="' + cid + '"]');
        var dateInput = document.querySelector('.bilt-redemption-date[data-card="' + cid + '"]');
        var amt = parseFloat(amtInput && amtInput.value) || 0;
        var desc = (descInput && descInput.value || '').trim();
        var date = (dateInput && dateInput.value || '').trim();
        if (amt <= 0 || !date) {
          if (amtInput) amtInput.focus();
          return;
        }
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        if (!Array.isArray(state.biltConfig[cid].biltCashRedemptions)) state.biltConfig[cid].biltCashRedemptions = [];
        state.biltConfig[cid].biltCashRedemptions.push({
          id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
          amount: amt,
          description: desc,
          date: date
        });
        if (!state.biltPastRedemptionsExpanded) state.biltPastRedemptionsExpanded = {};
        state.biltPastRedemptionsExpanded[cid] = true;
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        ctx.renderCardConfig();
      });
    });

    // Remove a Bilt Cash redemption
    document.querySelectorAll('.bilt-redemption-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var cid = btn.dataset.card;
        var rid = btn.dataset.id;
        var cfg = state.biltConfig[cid];
        if (!cfg || !Array.isArray(cfg.biltCashRedemptions)) return;
        cfg.biltCashRedemptions = cfg.biltCashRedemptions.filter(function(r) { return r.id !== rid; });
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        ctx.renderCardConfig();
      });
    });

    // Unredeemed months grid (Bilt Cash mode only): toggle a month as
    // "not redeemed" → rent points for that month become 0 on next reprocess.
    document.querySelectorAll('.bilt-unredeemed-month').forEach(function(label) {
      label.addEventListener('click', function(e) {
        e.preventDefault();
        var cid = label.dataset.card;
        var year = parseInt(label.dataset.year);
        var month = parseInt(label.dataset.month);
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        var cfg = state.biltConfig[cid];
        if (!cfg.biltCashUnredeemedMonths || typeof cfg.biltCashUnredeemedMonths !== 'object') {
          cfg.biltCashUnredeemedMonths = {};
        }
        var list = Array.isArray(cfg.biltCashUnredeemedMonths[year]) ? cfg.biltCashUnredeemedMonths[year].slice() : [];
        var idx = list.indexOf(month);
        if (idx === -1) list.push(month);
        else list.splice(idx, 1);
        list.sort(function(a, b) { return a - b; });
        cfg.biltCashUnredeemedMonths[year] = list;
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        ctx.renderCardConfig();
      });
    });

    // Rent detection mode
    document.querySelectorAll('.bilt-rent-detection').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var cid = radio.dataset.card;
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        state.biltConfig[cid].rentDetection = radio.value;
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
        var manualBlock = document.getElementById('biltManualRent-' + cid);
        if (manualBlock) manualBlock.style.display = radio.value === 'manual' ? '' : 'none';
      });
    });

    // Rent day
    document.querySelectorAll('.bilt-rent-day').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var cid = sel.dataset.card;
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        state.biltConfig[cid].manualRentDay = parseInt(sel.value);
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
      });
    });

    // Rent merchant keyword
    document.querySelectorAll('.bilt-rent-keyword').forEach(function(input) {
      input.addEventListener('change', function() {
        var cid = input.dataset.card;
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        state.biltConfig[cid].rentMerchantKeyword = input.value.trim();
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
      });
    });

    // Bonus category (Obsidian)
    document.querySelectorAll('.bilt-bonus-cat').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var cid = radio.dataset.card;
        if (!state.biltConfig[cid]) state.biltConfig[cid] = {};
        state.biltConfig[cid].bonusCategory = radio.value;
        ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
      });
    });
  },

  // =========================================================================
  // saveConfigSection — save Bilt config from DOM on explicit save
  // =========================================================================
  saveConfigSection: function(cardId, ctx) {
    var state = ctx.state;
    if (!state.biltConfig[cardId]) state.biltConfig[cardId] = {};
    var cfg = state.biltConfig[cardId];

    var modeRadio = document.querySelector('.bilt-reward-mode[data-card="' + cardId + '"]:checked');
    if (modeRadio) {
      cfg.rewardMode = modeRadio.value;
      cfg.rewardOption = modeRadio.value === 'housing-only' ? 'housing-only' : 'flexible';
    }

    var rentRadio = document.querySelector('.bilt-rent-detection[data-card="' + cardId + '"]:checked');
    if (rentRadio) cfg.rentDetection = rentRadio.value;

    var cashCheckbox = document.querySelector('.bilt-cash-as-credit[data-card="' + cardId + '"]');
    if (cashCheckbox) cfg.countBiltCashAsCredit = cashCheckbox.checked;

    var rentTopInput = document.querySelector('.bilt-rent-amount-top[data-card="' + cardId + '"]');
    if (rentTopInput) cfg.manualRentAmount = parseFloat(rentTopInput.value) || 0;

    // In Bilt Cash mode, monthly redemption is always derived from rent.
    if (cfg.rewardMode !== 'housing-only' && cfg.rewardOption !== 'housing-only') {
      cfg.monthlyBiltCashRedemption = ((cfg.manualRentAmount || 0) / 100) * 3;
    }

    var rentDaySelect = document.querySelector('.bilt-rent-day[data-card="' + cardId + '"]');
    if (rentDaySelect) cfg.manualRentDay = parseInt(rentDaySelect.value);

    var keywordInput = document.querySelector('.bilt-rent-keyword[data-card="' + cardId + '"]');
    if (keywordInput) cfg.rentMerchantKeyword = keywordInput.value.trim();

    var bonusRadio = document.querySelector('.bilt-bonus-cat[data-card="' + cardId + '"]:checked');
    if (bonusRadio) cfg.bonusCategory = bonusRadio.value;

    ctx.safeLocalStorageSet('ccTracker_biltConfig', state.biltConfig);
  },

  // =========================================================================
  // scenarioPrompt — Card Scenarios integration (Bilt rent/plan prompt)
  // =========================================================================
  scenarioPrompt: {
    // Check if this card needs a special scenario prompt
    isNeeded: function(wi, ctx) {
      var involvedCards = [wi.addCardId, wi.removeCardId].filter(Boolean);
      for (var i = 0; i < involvedCards.length; i++) {
        var card = ctx.CARDS[involvedCards[i]];
        if (card && card.isBilt) return true;
      }
      return false;
    },

    // Render step 2b prompt HTML (rent amount + Bilt Cash plan)
    render: function(wi, ctx) {
      var CARDS = ctx.CARDS;
      var biltCardName = (wi.addCardId && CARDS[wi.addCardId] && CARDS[wi.addCardId].isBilt ? CARDS[wi.addCardId].name : null)
        || (wi.removeCardId && CARDS[wi.removeCardId] && CARDS[wi.removeCardId].isBilt ? CARDS[wi.removeCardId].name : null)
        || 'Bilt card';

      var existingBiltId = null;
      var activeIds = ctx.getActiveCardIds();
      for (var i = 0; i < activeIds.length; i++) {
        if (CARDS[activeIds[i]] && CARDS[activeIds[i]].isBilt) { existingBiltId = activeIds[i]; break; }
      }
      var existingRent = existingBiltId ? ((ctx.state.biltConfig[existingBiltId] || {}).manualRentAmount || '') : '';
      var prefillRent = wi.rentAmount || existingRent || '';
      var plan = wi.biltCashPlan || 'maximize';
      var customAmt = wi.biltCustomMonthlyRedemption || '';

      return '<div class="cardscenarios-step">' +
        '<div class="cardscenarios-step-header">Bilt Rewards Setup</div>' +
        '<p style="font-size:13px;color:#57534e;margin-bottom:16px;">' +
          'Bilt cards earn 4% Bilt Cash on all non-rent spending. You can redeem Bilt Cash to unlock rent points ($3 = 100 points per $100 of rent). ' +
          'The engine will optimize your spend routing based on these settings.' +
        '</p>' +
        '<div style="margin-bottom:16px;">' +
          '<label style="font-size:13px;font-weight:600;color:#44403c;display:block;margin-bottom:8px;">Monthly Rent Amount</label>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="font-size:16px;font-weight:500;color:#44403c;">$</span>' +
            '<input type="number" id="cardscenariosRentAmount" style="max-width:200px;font-size:16px;padding:10px 12px;border-radius:6px;border:1px solid #d6d3d1;font-family:inherit;" placeholder="0" min="0" step="1" value="' + prefillRent + '">' +
            '<span style="font-size:13px;color:#78716c;">/month</span>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:16px;">' +
          '<label style="font-size:13px;font-weight:600;color:#44403c;display:block;margin-bottom:8px;">Bilt Cash Plan</label>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:8px 10px;border-radius:6px;border:1px solid ' + (plan === 'maximize' ? '#059669' : '#d6d3d1') + ';background:' + (plan === 'maximize' ? '#f0fdf4' : '#fff') + ';">' +
              '<input type="radio" name="biltCashPlan" value="maximize"' + (plan === 'maximize' ? ' checked' : '') + ' style="margin-top:2px;accent-color:#059669;">' +
              '<div>' +
                '<div style="font-size:13px;font-weight:600;color:#44403c;">Maximize rent points</div>' +
                '<div style="font-size:12px;color:#78716c;">Route enough spend to Bilt to fully fund rent points. Cheapest-sacrifice categories routed first.</div>' +
              '</div>' +
            '</label>' +
            '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:8px 10px;border-radius:6px;border:1px solid ' + (plan === 'cash' ? '#059669' : '#d6d3d1') + ';background:' + (plan === 'cash' ? '#f0fdf4' : '#fff') + ';">' +
              '<input type="radio" name="biltCashPlan" value="cash"' + (plan === 'cash' ? ' checked' : '') + ' style="margin-top:2px;accent-color:#059669;">' +
              '<div>' +
                '<div style="font-size:13px;font-weight:600;color:#44403c;">Keep as cash</div>' +
                '<div style="font-size:12px;color:#78716c;">Don\'t redeem Bilt Cash for rent points. Bilt Cash is a tiebreaker only \u2014 no rent uplift in routing.</div>' +
              '</div>' +
            '</label>' +
            '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:8px 10px;border-radius:6px;border:1px solid ' + (plan === 'custom' ? '#059669' : '#d6d3d1') + ';background:' + (plan === 'custom' ? '#f0fdf4' : '#fff') + ';">' +
              '<input type="radio" name="biltCashPlan" value="custom"' + (plan === 'custom' ? ' checked' : '') + ' style="margin-top:2px;accent-color:#059669;">' +
              '<div>' +
                '<div style="font-size:13px;font-weight:600;color:#44403c;">Custom redemption amount</div>' +
                '<div style="font-size:12px;color:#78716c;">Specify how much Bilt Cash to redeem monthly toward rent.</div>' +
                '<div style="margin-top:6px;display:' + (plan === 'custom' ? 'flex' : 'none') + ';align-items:center;gap:6px;" id="biltCustomRedemptionRow">' +
                  '<span style="font-size:14px;color:#44403c;">$</span>' +
                  '<input type="number" id="cardscenariosBiltCustomRedemption" style="width:100px;padding:6px 8px;border:1px solid #d6d3d1;border-radius:4px;font-family:inherit;font-size:14px;" placeholder="0" min="0" step="1" value="' + customAmt + '">' +
                  '<span style="font-size:12px;color:#78716c;">/month</span>' +
                '</div>' +
              '</div>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<p style="font-size:11px;color:#a8a29e;margin-top:4px;line-height:1.4;">' +
          'Under Bilt 2.0, $3 of Bilt Cash unlocks 100 rent points (up to 1 point per $1 of rent). The engine routes your cheapest-sacrifice spend to Bilt first, up to the cap needed for your plan.' +
        '</p>' +
        '<div class="cardscenarios-nav">' +
          '<button class="btn btn-secondary" id="cardscenariosBack2b">\u2190 Back</button>' +
          '<button class="btn btn-primary" id="cardscenariosNext2b">Next \u2192</button>' +
        '</div>' +
      '</div>';
    },

    // Attach event listeners for step 2b prompt
    attachListeners: function(wi, ctx) {
      // Bilt Cash plan radio buttons
      document.querySelectorAll('input[name="biltCashPlan"]').forEach(function(radio) {
        radio.addEventListener('change', function(e) {
          wi.biltCashPlan = e.target.value;
          delete wi.biltCashKeptOverride;
          var customRow = document.getElementById('biltCustomRedemptionRow');
          if (customRow) customRow.style.display = e.target.value === 'custom' ? 'flex' : 'none';
          ctx.renderView('cardscenarios');
        });
      });

      // Custom redemption amount
      var customInput = document.getElementById('cardscenariosBiltCustomRedemption');
      if (customInput) {
        customInput.addEventListener('input', function(e) {
          wi.biltCustomMonthlyRedemption = parseFloat(e.target.value) || 0;
        });
      }
    },

    // Called when user clicks "Next" on step 2b
    onProceed: function(wi, ctx) {
      var input = document.getElementById('cardscenariosRentAmount');
      wi.rentAmount = input ? parseFloat(input.value) || 0 : 0;
      var customInp = document.getElementById('cardscenariosBiltCustomRedemption');
      if (customInp && wi.biltCashPlan === 'custom') {
        wi.biltCustomMonthlyRedemption = parseFloat(customInp.value) || 0;
      }
    },

    // Sacrifice-cost routing algorithm for Bilt Cash rent uplift optimization.
    // Determines which categories should route to the Bilt card (earning Bilt Cash
    // for rent) vs the alternative card, using a cheapest-sacrifice-first approach.
    computeRouting: function(candidates, routingCardId, existingRoutingSpend, ctx) {
      var wi = ctx.state.cardScenarios;
      var monthlyRent = wi.rentAmount || 0;
      var biltCashPlan = wi.biltCashPlan || 'maximize';
      var customMonthlyRedemption = wi.biltCustomMonthlyRedemption || 0;

      var biltPV = ctx.getPointValue(routingCardId);
      var biltCard = ctx.CARDS[routingCardId];
      var biltName = (biltCard && (biltCard.shortName || biltCard.name)) || routingCardId;

      // Step A: Rent uplift per dollar = (BILT_CASH_RATE / 3) × 100 × PV = 1.333 × PV
      var rentUpliftPerDollar = (window.CardTracker.biltPlugin.BILT_CASH_RATE / 3) * 100 * biltPV;

      // Step B: Calculate the annual Bilt spend cap
      var annualBiltSpendCap;
      if (biltCashPlan === 'cash' || monthlyRent <= 0) {
        annualBiltSpendCap = 0;
      } else if (biltCashPlan === 'custom') {
        var monthlyBiltCashNeeded = customMonthlyRedemption || 0;
        annualBiltSpendCap = Math.min(
          (monthlyBiltCashNeeded / window.CardTracker.biltPlugin.BILT_CASH_RATE) * 12,
          monthlyRent * 0.75 * 12
        );
      } else { // 'maximize'
        annualBiltSpendCap = monthlyRent * 0.75 * 12;
      }

      // Pre-load existing spend toward the cap
      var cumulativeBiltSpend = existingRoutingSpend || 0;

      // Step C: For each category, calculate sacrifice cost
      var categorized = candidates.map(function(c) {
        var biltBaseVal = c.biltRate * c.biltPV;
        var altVal = c.altRate * c.altPV;
        var merged = {};
        for (var k in c) { if (c.hasOwnProperty(k)) merged[k] = c[k]; }
        merged.biltBaseVal = biltBaseVal;
        merged.altVal = altVal;
        merged.sacrificeCost = altVal - biltBaseVal;
        return merged;
      });

      // Separate: Bilt wins on pure base rate (sacrifice <= 0) vs alt wins (sacrifice > 0)
      var biltWins = categorized.filter(function(c) { return c.sacrificeCost <= 0; });
      var altWins = categorized.filter(function(c) { return c.sacrificeCost > 0; });

      // Step D: Sort alt-wins by sacrifice cost ascending (cheapest sacrifice first)
      altWins.sort(function(a, b) { return a.sacrificeCost - b.sacrificeCost; });

      var routes = [];

      // Categories where Bilt wins on base rate — always route to Bilt
      for (var i = 0; i < biltWins.length; i++) {
        var c = biltWins[i];
        var reason = c.sacrificeCost < 0
          ? c.biltRate + 'x Bilt ($' + c.biltBaseVal.toFixed(4) + '/dollar) beats ' + c.altName + ' ' + c.altRate + 'x ($' + c.altVal.toFixed(4) + '/dollar)'
          : 'Tied on base rate \u2014 Bilt wins (earns Bilt Cash)';
        routes.push({
          sub: c.sub, spend: c.spend,
          destCardId: c.biltCardId || routingCardId, destRate: c.biltRate, destPV: c.biltPV,
          destCat: c.biltCat, destName: c.biltName || biltName,
          sourceRate: c.sourceRate, sourcePV: c.sourcePV, routeReason: reason
        });
        cumulativeBiltSpend += c.spend;
      }

      // Step E: Route cheapest-sacrifice categories to Bilt for rent uplift, up to cap
      var handledSubs = {};
      if (annualBiltSpendCap > 0) {
        for (var j = 0; j < altWins.length; j++) {
          var c2 = altWins[j];
          if (cumulativeBiltSpend >= annualBiltSpendCap) break;

          var netBenefit = rentUpliftPerDollar - c2.sacrificeCost;
          if (netBenefit <= 0) break; // Not worth sacrificing

          var availableToRoute = Math.min(c2.spend, annualBiltSpendCap - cumulativeBiltSpend);

          if (availableToRoute < c2.spend) {
            // Partial route — split this category
            routes.push({
              sub: c2.sub, spend: availableToRoute,
              destCardId: c2.biltCardId || routingCardId, destRate: c2.biltRate, destPV: c2.biltPV,
              destCat: c2.biltCat, destName: c2.biltName || biltName,
              sourceRate: c2.sourceRate, sourcePV: c2.sourcePV,
              routeReason: 'Rent uplift: ' + c2.biltRate + 'x ($' + c2.biltBaseVal.toFixed(4) + ') + rent uplift ($' + rentUpliftPerDollar.toFixed(4) + ') = $' + (c2.biltBaseVal + rentUpliftPerDollar).toFixed(4) + '/dollar vs ' + c2.altName + ' $' + c2.altVal.toFixed(4) + '/dollar (partial \u2014 rent cap reached)'
            });
            routes.push({
              sub: c2.sub, spend: c2.spend - availableToRoute,
              destCardId: c2.altCardId, destRate: c2.altRate, destPV: c2.altPV,
              destCat: c2.altCat, destName: c2.altName,
              sourceRate: c2.sourceRate, sourcePV: c2.sourcePV,
              routeReason: 'Post-cap: ' + c2.altName + ' ' + c2.altRate + 'x ($' + c2.altVal.toFixed(4) + '/dollar) \u2014 no rent uplift'
            });
            handledSubs[c2.sub] = true;
            cumulativeBiltSpend += availableToRoute;
          } else {
            routes.push({
              sub: c2.sub, spend: c2.spend,
              destCardId: c2.biltCardId || routingCardId, destRate: c2.biltRate, destPV: c2.biltPV,
              destCat: c2.biltCat, destName: c2.biltName || biltName,
              sourceRate: c2.sourceRate, sourcePV: c2.sourcePV,
              routeReason: 'Rent uplift: ' + c2.biltRate + 'x ($' + c2.biltBaseVal.toFixed(4) + ') + rent uplift ($' + rentUpliftPerDollar.toFixed(4) + ') = $' + (c2.biltBaseVal + rentUpliftPerDollar).toFixed(4) + '/dollar vs ' + c2.altName + ' $' + c2.altVal.toFixed(4) + '/dollar'
            });
            handledSubs[c2.sub] = true;
            cumulativeBiltSpend += c2.spend;
          }
        }
      }

      // Step F: Handle remaining spend (post-cap, not worth routing, or 'cash' plan)
      for (var m = 0; m < altWins.length; m++) {
        var c3 = altWins[m];
        if (handledSubs[c3.sub]) continue; // Already handled above
        // Post-cap: pure comparison, Bilt Cash as tiebreaker only
        if (c3.biltBaseVal >= c3.altVal) {
          routes.push({
            sub: c3.sub, spend: c3.spend,
            destCardId: c3.biltCardId || routingCardId, destRate: c3.biltRate, destPV: c3.biltPV,
            destCat: c3.biltCat, destName: c3.biltName || biltName,
            sourceRate: c3.sourceRate, sourcePV: c3.sourcePV,
            routeReason: c3.biltBaseVal === c3.altVal
              ? 'Tied \u2014 Bilt wins (Bilt Cash tiebreaker)'
              : c3.biltRate + 'x Bilt ($' + c3.biltBaseVal.toFixed(4) + '/dollar) beats ' + c3.altName + ' ($' + c3.altVal.toFixed(4) + '/dollar)'
          });
          cumulativeBiltSpend += c3.spend;
        } else {
          routes.push({
            sub: c3.sub, spend: c3.spend,
            destCardId: c3.altCardId, destRate: c3.altRate, destPV: c3.altPV,
            destCat: c3.altCat, destName: c3.altName,
            sourceRate: c3.sourceRate, sourcePV: c3.sourcePV,
            routeReason: c3.altName + ' ' + c3.altRate + 'x ($' + c3.altVal.toFixed(4) + '/dollar) beats Bilt ' + c3.biltRate + 'x ($' + c3.biltBaseVal.toFixed(4) + '/dollar)'
          });
        }
      }

      return { routes: routes, cumulativeBiltSpend: cumulativeBiltSpend, annualBiltSpendCap: annualBiltSpendCap, rentUpliftPerDollar: rentUpliftPerDollar };
    },

    // Calculate Bilt Cash / Rent Points impact for Card Scenarios.
    // Tracks final Bilt spend from routing results, computes rent points delta,
    // and determines Bilt Cash kept/redeemed.
    calculateImpact: function(wi, baseCalcData, ctx) {
      var spendingImpact = baseCalcData.spendingImpact;
      var currentWallet = baseCalcData.currentWallet;
      var walletAfter = baseCalcData.walletAfter;
      var year = baseCalcData.year;
      var CARDS = ctx.CARDS;
      var monthlyRent = wi.rentAmount || 0;
      var biltCashPlan = wi.biltCashPlan || 'maximize';
      var rentMotivatedImpact = 0;
      var rentMotivatedRows = [];

      // --- Current Bilt state ---
      var currentBiltSpend = 0;
      for (var i = 0; i < currentWallet.length; i++) {
        var cid = currentWallet[i];
        if (!CARDS[cid] || !CARDS[cid].isBilt) continue;
        var cardSpend = ctx.getAnnualizedCardSpend(cid, year);
        var subs = cardSpend.subcategories;
        for (var sub in subs) {
          if (sub === 'rent') continue;
          currentBiltSpend += subs[sub].spend || 0;
        }
      }
      var currentBiltCash = currentBiltSpend * window.CardTracker.biltPlugin.BILT_CASH_RATE;
      var currentBiltCardId = null;
      for (var j = 0; j < currentWallet.length; j++) {
        if (CARDS[currentWallet[j]] && CARDS[currentWallet[j]].isBilt) { currentBiltCardId = currentWallet[j]; break; }
      }
      var currentBiltPV = currentBiltCardId ? ctx.getPointValue(currentBiltCardId) : 0.018;

      // --- Find Bilt card in hypothetical wallet ---
      var biltCardAfter = null;
      for (var k = 0; k < walletAfter.length; k++) {
        if (CARDS[walletAfter[k]] && CARDS[walletAfter[k]].isBilt) { biltCardAfter = walletAfter[k]; break; }
      }
      var hasBiltAfter = !!biltCardAfter;
      var biltPVAfter = biltCardAfter ? ctx.getPointValue(biltCardAfter) : 0;

      // --- Track final Bilt spend from routing results ---
      var finalBiltSpend = 0;

      if (hasBiltAfter) {
        if (wi.scenarioType === 'remove') {
          var removeCard = CARDS[wi.removeCardId];
          if (removeCard && removeCard.isBilt) {
            var removeRows = ctx.getRemoveCardShiftRows(wi.removeCardId, year) || [];
            for (var ri = 0; ri < removeRows.length; ri++) {
              if (removeRows[ri].sourceCategory === 'rent') continue;
              if (CARDS[removeRows[ri].bestCardId] && CARDS[removeRows[ri].bestCardId].isBilt) {
                finalBiltSpend += removeRows[ri].actualSpend || 0;
              }
            }
            for (var ci = 0; ci < currentWallet.length; ci++) {
              if (currentWallet[ci] === wi.removeCardId) continue;
              if (!CARDS[currentWallet[ci]] || !CARDS[currentWallet[ci]].isBilt) continue;
              var cSubs = ctx.getAnnualizedCardSpend(currentWallet[ci], year).subcategories;
              for (var s in cSubs) {
                if (s === 'rent') continue;
                finalBiltSpend += cSubs[s].spend || 0;
              }
            }
          } else {
            finalBiltSpend = currentBiltSpend;
          }
        } else if (wi.scenarioType === 'swap') {
          var swapResult = ctx.calculateSwapValue(wi.removeCardId, wi.addCardId, year);

          // Component 1: removed card's spend redistributed
          for (var si = 0; si < swapResult.removeRows.length; si++) {
            var row = swapResult.removeRows[si];
            if (row.subcategory === 'rent') continue;
            if (row.bestCardId && CARDS[row.bestCardId] && CARDS[row.bestCardId].isBilt) {
              finalBiltSpend += row.spend || 0;
            }
          }

          // Component 2: other cards' spend shifting to the new card
          if (CARDS[wi.addCardId] && CARDS[wi.addCardId].isBilt) {
            for (var ai = 0; ai < swapResult.addRows.length; ai++) {
              var aRow = swapResult.addRows[ai];
              if (aRow.subcategory === 'rent') continue;
              if (!CARDS[aRow.sourceCardId] || !CARDS[aRow.sourceCardId].isBilt) {
                finalBiltSpend += aRow.spend || 0;
              }
            }
          }

          // Unchanged Bilt spend
          for (var ui = 0; ui < currentWallet.length; ui++) {
            var uid = currentWallet[ui];
            if (uid === wi.removeCardId || uid === wi.addCardId) continue;
            if (!CARDS[uid] || !CARDS[uid].isBilt) continue;
            var uSubs = ctx.getAnnualizedCardSpend(uid, year).subcategories;
            for (var us in uSubs) {
              if (us === 'rent') continue;
              finalBiltSpend += uSubs[us].spend || 0;
            }
          }

          // Extract rent-motivated impact for display reallocation
          rentMotivatedImpact = swapResult.rentMotivatedImpact || 0;
          rentMotivatedRows = swapResult.rentMotivatedRows || [];

          // Override spendingImpact with swap's totalSpendChange
          spendingImpact = swapResult.totalSpendChange;

        } else if (wi.scenarioType === 'add') {
          finalBiltSpend = currentBiltSpend;
          if (CARDS[wi.addCardId] && CARDS[wi.addCardId].isBilt) {
            var addRows = ctx.getAddCardShiftRows(wi.addCardId, year) || [];
            for (var ari = 0; ari < addRows.length; ari++) {
              if (addRows[ari].newCategory === 'rent') continue;
              if (!CARDS[addRows[ari].sourceCardId] || !CARDS[addRows[ari].sourceCardId].isBilt) {
                finalBiltSpend += addRows[ari].actualSpend || 0;
              }
            }
          }
        }
      } else {
        finalBiltSpend = 0;
      }

      // --- Compute Bilt Cash and Rent Points ---
      var annualBiltSpendCap = monthlyRent * 0.75 * 12;
      var finalBiltCashEarned = finalBiltSpend * window.CardTracker.biltPlugin.BILT_CASH_RATE;
      var currentBiltCashEarned = currentBiltSpend * window.CardTracker.biltPlugin.BILT_CASH_RATE;
      var maxBiltCashForRent = monthlyRent > 0 ? monthlyRent * 0.03 * 12 : 0;

      // Determine how much Bilt Cash is redeemed
      var finalBiltCashRedeemed;
      if (wi.biltCashKeptOverride !== undefined) {
        var kept = Math.max(0, Math.min(wi.biltCashKeptOverride, finalBiltCashEarned));
        finalBiltCashRedeemed = Math.min(finalBiltCashEarned - kept, maxBiltCashForRent);
      } else if (biltCashPlan === 'cash') {
        finalBiltCashRedeemed = 0;
      } else if (biltCashPlan === 'custom') {
        var customAnnual = (wi.biltCustomMonthlyRedemption || 0) * 12;
        finalBiltCashRedeemed = Math.max(0, Math.min(customAnnual, finalBiltCashEarned, maxBiltCashForRent));
      } else { // 'maximize'
        finalBiltCashRedeemed = Math.min(maxBiltCashForRent, finalBiltCashEarned);
      }

      // Current state redemption
      var currentBiltCashRedeemed;
      if (biltCashPlan === 'cash') {
        currentBiltCashRedeemed = 0;
      } else if (biltCashPlan === 'custom') {
        var customAnnualCurrent = (wi.biltCustomMonthlyRedemption || 0) * 12;
        currentBiltCashRedeemed = Math.max(0, Math.min(customAnnualCurrent, currentBiltCashEarned, maxBiltCashForRent));
      } else {
        currentBiltCashRedeemed = Math.min(maxBiltCashForRent, currentBiltCashEarned);
      }

      // Rent points
      var finalRentPointsAnnual = monthlyRent > 0
        ? Math.min(finalBiltCashRedeemed * (100 / 3), monthlyRent * 12) : 0;
      var finalRentPointsValue = finalRentPointsAnnual * biltPVAfter;

      var currentRentPointsAnnual = monthlyRent > 0
        ? Math.min(currentBiltCashRedeemed * (100 / 3), monthlyRent * 12) : 0;
      var currentRentPointsValue = currentRentPointsAnnual * currentBiltPV;

      // Remaining Bilt Cash
      var finalBiltCashRemaining = finalBiltCashEarned - finalBiltCashRedeemed;
      var currentBiltCashRemaining = currentBiltCashEarned - currentBiltCashRedeemed;

      var countCashAsValue = biltCashPlan !== 'maximize';

      // Deltas
      var rentPointsValueDelta = finalRentPointsValue - currentRentPointsValue;
      var biltCashKeptDelta = finalBiltCashRemaining - currentBiltCashRemaining;

      // Rent cap usage
      var rentCapUsedPct = annualBiltSpendCap > 0 ? Math.min(100, (finalBiltSpend / annualBiltSpendCap) * 100) : 0;

      return {
        spendingImpact: spendingImpact,
        rentPointsValueDelta: rentPointsValueDelta,
        biltCashKeptDelta: biltCashKeptDelta,
        finalBiltCashEarned: finalBiltCashEarned,
        finalBiltCashRedeemed: finalBiltCashRedeemed,
        finalMaxRedemption: maxBiltCashForRent,
        finalRentPointsAnnual: finalRentPointsAnnual,
        finalRentPointsValue: finalRentPointsValue,
        finalBiltCashRemaining: finalBiltCashRemaining,
        currentBiltCashEarned: currentBiltCashEarned,
        currentBiltCashRedeemed: currentBiltCashRedeemed,
        currentRentPointsValue: currentRentPointsValue,
        currentBiltCashRemaining: currentBiltCashRemaining,
        currentBiltSpend: currentBiltSpend,
        finalBiltSpend: finalBiltSpend,
        monthlyRent: monthlyRent,
        biltCashPlan: biltCashPlan,
        countCashAsValue: countCashAsValue,
        annualBiltSpendCap: annualBiltSpendCap,
        rentCapUsedPct: rentCapUsedPct,
        rentMotivatedImpact: rentMotivatedImpact,
        rentMotivatedRows: rentMotivatedRows
      };
    },

    // Render extra content below the point value table (e.g., rent points row)
    renderPointValueExtra: function(impact, prefix, ctx) {
      if (!impact) return '';
      var rentPtsDelta = impact.rentPointsValueDelta || 0;
      var finalRentPts = impact.finalRentPointsAnnual || 0;
      var biltPV = finalRentPts > 0 ? (impact.finalRentPointsValue || 0) / finalRentPts : 0.018;
      var rentColor = rentPtsDelta >= 0 ? '#059669' : '#dc2626';

      if (rentPtsDelta !== 0 || finalRentPts > 0) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;margin-top:8px;border-top:1px solid #e7e5e4;font-size:13px;" id="cardscenarios' + prefix + 'RentPointsLine">' +
          '<span style="color:#57534e;" id="cardscenarios' + prefix + 'RentPointsLabel">Rent points (' + Math.round(finalRentPts).toLocaleString() + ' pts @ $' + biltPV.toFixed(3) + ')</span>' +
          '<span class="mono" style="font-weight:600;color:' + rentColor + ';" id="cardscenarios' + prefix + 'RentPointsDelta">' + (rentPtsDelta >= 0 ? '+' : '-') + ctx.formatCurrencyPrecise(Math.abs(rentPtsDelta)) + '</span>' +
        '</div>';
      }
      return '';
    },

    // Render the "Bilt Cash (kept)" summary line in the compact summary
    renderSummaryLines: function(impact, prefix, ctx) {
      if (!impact) return '';
      var biltCashDelta = impact.biltCashKeptDelta || 0;
      return '<div style="display:flex;justify-content:space-between;">' +
        '<span>Bilt Cash <span style="font-size:11px;color:#78716c;font-weight:400;">(kept)</span></span>' +
        '<span class="mono" style="font-weight:600;color:' + (biltCashDelta >= 0 ? '#059669' : '#dc2626') + ';" id="cardscenarios' + prefix + 'BiltCashTopLine">' + (biltCashDelta >= 0 ? '+' : '-') + ctx.formatCurrencyPrecise(Math.abs(biltCashDelta)) + '</span>' +
      '</div>';
    },

    // Render the editable Bilt Cash input in the ledger section
    renderLedgerSection: function(impact, prefix, ctx) {
      if (!impact) return '';
      var biltCashEarned = impact.finalBiltCashEarned || 0;
      var biltCashKept = impact.finalBiltCashRemaining || 0;
      return '<div style="margin-top:12px;border-top:1px solid #e7e5e4;padding-top:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">' +
          '<span style="font-weight:600;color:#57534e;">Bilt Cash <span style="font-weight:400;color:#78716c;">(kept)</span></span>' +
          '<span style="display:flex;align-items:center;gap:4px;">' +
            '<span class="mono" style="font-size:12px;color:#78716c;">$</span>' +
            '<input type="number" id="cardscenarios' + prefix + 'BiltCashInput" min="0" max="' + biltCashEarned.toFixed(2) + '" step="0.01" value="' + biltCashKept.toFixed(2) + '"' +
              ' style="width:72px;padding:2px 4px;border:1px solid #d6d3d1;border-radius:4px;font-size:13px;text-align:right;font-family:monospace;" />' +
            '<span style="font-size:11px;color:#a8a29e;">of ' + ctx.formatCurrencyPrecise(biltCashEarned) + '</span>' +
          '</span>' +
        '</div>' +
      '</div>';
    },

    // Attach event listeners for the Bilt Cash input in step 4 results
    attachResultListeners: function(impact, prefix, ctx) {
      var biltCashInput = document.getElementById('cardscenarios' + prefix + 'BiltCashInput');
      if (!biltCashInput) return;
      var wi = ctx.state.cardScenarios;
      var handleChange = function() {
        var val = parseFloat(biltCashInput.value) || 0;
        var max = parseFloat(biltCashInput.max) || 0;
        val = Math.max(0, Math.min(val, max));
        biltCashInput.value = val.toFixed(2);
        wi.biltCashKeptOverride = val;
        if (wi.scenarioType === 'add') ctx.updateAddCardResult();
        else if (wi.scenarioType === 'remove') ctx.updateRemoveCardResult();
        else if (wi.scenarioType === 'swap') ctx.updateSwapCardResult();
      };
      biltCashInput.addEventListener('blur', handleChange);
      biltCashInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); biltCashInput.blur(); }
      });
    },

    // Live-update Bilt Cash display and rent points when credits/toggles change
    updateResult: function(pluginImpact, prefix, ctx) {
      if (!pluginImpact) return;

      // Update Bilt Cash input
      var input = document.getElementById('cardscenarios' + prefix + 'BiltCashInput');
      if (input) {
        var earned = pluginImpact.finalBiltCashEarned || 0;
        input.max = earned.toFixed(2);
        var ofLabel = input.parentElement && input.parentElement.querySelector('span:last-child');
        if (ofLabel) ofLabel.textContent = 'of ' + ctx.formatCurrencyPrecise(earned);
      }

      // Update rent points row
      var rentPtsDelta = pluginImpact.rentPointsValueDelta || 0;
      var finalRentPts = pluginImpact.finalRentPointsAnnual || 0;
      var biltPV = finalRentPts > 0 ? (pluginImpact.finalRentPointsValue || 0) / finalRentPts : 0.018;

      var rentDeltaEl = document.getElementById('cardscenarios' + prefix + 'RentPointsDelta');
      if (rentDeltaEl) {
        rentDeltaEl.textContent = (rentPtsDelta >= 0 ? '+' : '-') + ctx.formatCurrencyPrecise(Math.abs(rentPtsDelta));
        rentDeltaEl.style.color = rentPtsDelta >= 0 ? '#059669' : '#dc2626';
      }
      var rentLabelEl = document.getElementById('cardscenarios' + prefix + 'RentPointsLabel');
      if (rentLabelEl) {
        rentLabelEl.textContent = 'Rent points (' + Math.round(finalRentPts).toLocaleString() + ' pts @ $' + biltPV.toFixed(3) + ')';
      }
    },
  },

  // =========================================================================
  // pluginState — export/import/clear for biltConfig
  // =========================================================================
  pluginState: {
    keys: [{ stateKey: 'biltConfig', localStorageKey: 'ccTracker_biltConfig', default: {} }],
    exportState: function(ctx) {
      return { biltConfig: ctx.state.biltConfig };
    },
    importState: function(data, ctx) {
      if (data.biltConfig) {
        ctx.state.biltConfig = data.biltConfig;
        ctx.safeLocalStorageSet('ccTracker_biltConfig', data.biltConfig);
      }
    },
    clearState: function(ctx) {
      ctx.state.biltConfig = {};
      localStorage.removeItem('ccTracker_biltConfig');
    },
  },
};
