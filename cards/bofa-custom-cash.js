window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['bofa-custom-cash'] = {
  name: 'Bank of America Customized Cash Rewards',
  shortName: 'BofA Custom Cash',
  annualFee: 0,
  pointValue: 0.01,
  multipliers: {}, // Dynamic based on monthly selection
  baseRate: 1,
  earningRatesNote: 'Based on monthly selections above',
  credits: [],
  // All possible categories shown so user can always recategorize.
  // streaming/cable/internet/cell-phone are included because BofA's Online Shopping
  // choice category covers these when paid as recurring online subscriptions/bills.
  categories: ['gas', 'online-shopping', 'streaming', 'cable', 'internet', 'cell-phone', 'dining', 'travel', 'drugstore', 'home-improvement', 'grocery', 'other'],

  // BofA Custom Cash choice categories (3%, or 6% in first 365 days)
  // User picks ONE per statement period (changeable once/month via BofA online banking)
  choiceCategories: {
    'gas':              'Gas & EV Charging Stations',
    'online-shopping':  'Online Shopping',
    'dining':           'Dining',
    'travel':           'Travel',
    'drugstore':        'Drug Stores',
    'home-improvement': 'Home Improvement',
  },

  // $2,500/quarter combined cap on 2%+3% earnings (choice + grocery combined)
  bonusCategoryCapPerQuarter: 2500,

  // -------------------------------------------------------------------------
  // Helper: given a transaction date string and a billing-close day (1–28),
  // return a "YYYY-MM" billing-period key.
  //
  // Convention: if closing day is 15, the period 2026-04-16 → 2026-05-15
  // is labeled "2026-05" (the month in which it closes).
  // -------------------------------------------------------------------------
  _getBillingPeriodKey: function(dateStr, closingDay) {
    var year, month, day;
    if (dateStr && dateStr.indexOf('-') >= 0) {
      var parts = dateStr.split('-');
      year  = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day   = parseInt(parts[2], 10);
    } else if (dateStr && dateStr.indexOf('/') >= 0) {
      var parts2 = dateStr.split('/');
      // MM/DD/YYYY
      month = parseInt(parts2[0], 10);
      day   = parseInt(parts2[1], 10);
      var y = parts2[2];
      year  = parseInt(y.length === 2 ? '20' + y : y, 10);
    } else {
      var now = new Date();
      year  = now.getFullYear();
      month = now.getMonth() + 1;
      day   = now.getDate();
    }

    // Transactions after the closing day belong to the next month's billing period
    if (day > closingDay) {
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return year + '-' + (month < 10 ? '0' + month : '' + month);
  },

  // -------------------------------------------------------------------------
  // Helper: parse a YYYY-MM-DD date string into a JS Date (local, no timezone shift)
  // -------------------------------------------------------------------------
  _parseDate: function(dateStr) {
    if (!dateStr) return null;
    if (dateStr.indexOf('-') >= 0) {
      var p = dateStr.split('-');
      return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    }
    if (dateStr.indexOf('/') >= 0) {
      var p2 = dateStr.split('/');
      var yr = p2[2];
      return new Date(parseInt(yr.length === 2 ? '20' + yr : yr), parseInt(p2[0]) - 1, parseInt(p2[1]));
    }
    return null;
  },

  // -------------------------------------------------------------------------
  // Plugin hooks
  // -------------------------------------------------------------------------

  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    var self = window.CardTracker.cards['bofa-custom-cash'];
    var config     = ctx.state.bofaCustomCashData || {};
    var closingDay = parseInt(config.closingDay) || 1;
    var selections = config.selections || {};

    var periodKey      = self._getBillingPeriodKey(txnDate, closingDay);
    var choiceCategory = selections[periodKey] || '';

    // BofA's Online Shopping choice category also covers streaming, cable, internet,
    // and phone plan bills (recurring online subscriptions/services).
    // These don't walk up to online-shopping in the general hierarchy, so check explicitly.
    var onlineShoppingExtras = ['streaming', 'cable', 'internet', 'cell-phone', 'phone'];
    var isOnlineExtra = (choiceCategory === 'online-shopping' && onlineShoppingExtras.indexOf(category) >= 0);

    // Walk hierarchy for choice category (3%, or 6% during first-year bonus)
    if (choiceCategory) {
      var checkCat = category;
      var matched = false;
      while (checkCat) {
        if (checkCat === choiceCategory) { matched = true; break; }
        checkCat = ctx.CATEGORY_HIERARCHY[checkCat];
      }
      if (!matched && isOnlineExtra) { matched = true; }

      if (matched) {
        var choiceLabel = self.choiceCategories[choiceCategory] || choiceCategory;

        // Check first-year bonus: extra 3% for transactions within 365 days of account open
        var rate = 3;
        var reason = '3% choice category (' + choiceLabel + ', ' + periodKey + ')';
        if (config.accountOpenDate) {
          var openDate = self._parseDate(config.accountOpenDate);
          var txnDateObj = self._parseDate(txnDate);
          if (openDate && txnDateObj) {
            var daysSinceOpen = Math.floor((txnDateObj - openDate) / 86400000);
            if (daysSinceOpen >= 0 && daysSinceOpen < 365) {
              rate = 6;
              reason = '6% choice category — first-year bonus (' + choiceLabel + ', ' + periodKey + ')';
            }
          }
        }
        return { rate: rate, reason: reason };
      }
    }

    // Walk hierarchy for 2% grocery / wholesale clubs
    var checkCat2 = category;
    while (checkCat2) {
      if (checkCat2 === 'grocery') {
        return { rate: 2, reason: '2% grocery / wholesale clubs' };
      }
      checkCat2 = ctx.CATEGORY_HIERARCHY[checkCat2];
    }

    return null; // Fall through to baseRate (1%)
  },

  getCategories: function(txnDate, ctx) {
    // Always show all possible categories so the user can recategorize.
    // streaming/cable/internet/cell-phone included because BofA's Online Shopping
    // choice category covers these recurring online services.
    return ['gas', 'online-shopping', 'streaming', 'cable', 'internet', 'cell-phone', 'dining', 'travel', 'drugstore', 'home-improvement', 'grocery', 'other'];
  },

  renderConfigSection: function(cardId, ctx) {
    var self = window.CardTracker.cards['bofa-custom-cash'];
    var config     = ctx.state.bofaCustomCashData || {};
    var closingDay = config.closingDay || '';
    var accountOpenDate = config.accountOpenDate || '';
    var selections = config.selections  || {};

    // Check whether first-year bonus is still active
    var firstYearActive = false;
    var firstYearDaysLeft = 0;
    if (accountOpenDate) {
      var openDate = self._parseDate(accountOpenDate);
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      if (openDate) {
        var daysSinceOpen = Math.floor((today - openDate) / 86400000);
        if (daysSinceOpen >= 0 && daysSinceOpen < 365) {
          firstYearActive = true;
          firstYearDaysLeft = 365 - daysSinceOpen;
        }
      }
    }

    // Derive available years from transactions
    var txns = ctx.state.transactions || [];
    var seenYears = {};
    for (var i = 0; i < txns.length; i++) {
      var y = ctx.getYearFromDateString(txns[i].date);
      if (y) seenYears[y] = true;
    }
    var currentYear = new Date().getFullYear();
    seenYears[currentYear] = true;
    var availableYears = Object.keys(seenYears).map(Number).sort(function(a, b) { return b - a; });
    var selectedYear = ctx.state.selectedBofaCustomCashYear || availableYears[0];

    // ---- Billing period config row ----
    var closingDayOptions = '';
    for (var d = 1; d <= 28; d++) {
      var suffix = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
      closingDayOptions += '<option value="' + d + '"' + (parseInt(closingDay) === d ? ' selected' : '') + '>' + d + suffix + '</option>';
    }

    var html = '<div id="bofaCustomCashSection">' +

      // Account config box (closing day + open date)
      '<div style="margin-bottom:16px;padding:12px;border:1px solid #e7e5e4;border-radius:8px;background:#fafaf9;">' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:10px;">Account Settings</div>' +

        // Closing day
        '<div style="margin-bottom:10px;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<label style="font-size:12px;font-weight:500;white-space:nowrap;" for="bofaClosingDay">Statement closes on the</label>' +
            '<select id="bofaClosingDay" class="form-select" style="width:90px;padding:6px 8px;font-size:12px;">' +
              '<option value="">— day —</option>' +
              closingDayOptions +
            '</select>' +
            '<span style="font-size:12px;color:#78716c;">of each month</span>' +
          '</div>' +
          '<p style="font-size:11px;color:#78716c;margin-top:4px;">' +
            'Transactions after this day are assigned to the following month\'s billing period.' +
          '</p>' +
          (closingDay ? '' :
            '<p style="font-size:11px;color:#f59e0b;margin-top:2px;">&#9888; Set your closing day so billing period windows display correctly below.</p>') +
        '</div>' +

        // Account open date
        '<div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<label style="font-size:12px;font-weight:500;white-space:nowrap;" for="bofaAccountOpenDate">Account opened on</label>' +
            '<input type="date" id="bofaAccountOpenDate" class="form-control" ' +
              'style="width:160px;padding:6px 8px;font-size:12px;border:1px solid #e7e5e4;border-radius:4px;" ' +
              'value="' + accountOpenDate + '">' +
          '</div>' +
          '<p style="font-size:11px;color:#78716c;margin-top:4px;">' +
            'Used to calculate the first-year 6% bonus on your choice category (extra 3% for 365 days from account opening).' +
          '</p>' +
          (firstYearActive ?
            '<p style="font-size:11px;color:#059669;margin-top:2px;font-weight:500;">&#10003; First-year 6% bonus active — ' + firstYearDaysLeft + ' days remaining.</p>' :
            (accountOpenDate ? '<p style="font-size:11px;color:#78716c;margin-top:2px;">First-year bonus period has ended.</p>' : '')) +
        '</div>' +
      '</div>' +

      // Year selector + heading
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<h3 style="font-size:14px;font-weight:600;">Monthly Choice Category</h3>' +
        '<select id="bofaCustomCashYearSelect" class="form-select" style="min-width:100px;padding:6px 10px;">';

    for (var yi = 0; yi < availableYears.length; yi++) {
      html += '<option value="' + availableYears[yi] + '"' + (availableYears[yi] === selectedYear ? ' selected' : '') + '>' + availableYears[yi] + '</option>';
    }

    html += '</select></div>' +
      '<p style="font-size:12px;color:#78716c;margin-bottom:4px;">Select the 3% choice category you activated for each billing period.</p>' +
      '<p style="font-size:11px;color:#a8a29e;margin-bottom:12px;">' +
        'Grocery &amp; wholesale clubs always earn 2%. All other purchases earn 1%. ' +
        '$2,500/quarter combined cap on 2% + 3% categories.' +
      '</p>' +
      '<div id="bofaCustomCashMonths">';

    // Build per-billing-period rows for the selected year
    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    var parsedClosingDay = parseInt(closingDay) || 1;
    var nowDate  = new Date();
    var nowYear  = nowDate.getFullYear();
    var nowMonth = nowDate.getMonth() + 1;
    var nowDay   = nowDate.getDate();

    // Figure out which billing period key "today" falls into
    var todayStr = nowYear + '-' +
      (nowMonth < 10 ? '0' + nowMonth : '' + nowMonth) + '-' +
      (nowDay   < 10 ? '0' + nowDay   : '' + nowDay);
    var currentPeriodKey = self._getBillingPeriodKey(todayStr, parsedClosingDay);

    // Determine first-year bonus date range for badge display
    var firstYearEnd = null;
    if (accountOpenDate) {
      var openD = self._parseDate(accountOpenDate);
      if (openD) {
        firstYearEnd = new Date(openD.getTime() + 365 * 86400000);
      }
    }

    for (var m = 1; m <= 12; m++) {
      var periodKey  = selectedYear + '-' + (m < 10 ? '0' + m : '' + m);
      var chosenCat  = selections[periodKey] || '';
      var isCurrent  = (periodKey === currentPeriodKey);

      // Build period date range label
      var closeDay  = parsedClosingDay;
      var openDay   = closeDay + 1;
      var openMonth = m - 1 < 1 ? 12 : m - 1;
      var openYear  = m - 1 < 1 ? selectedYear - 1 : selectedYear;
      var rangeLbl  = MONTH_NAMES[openMonth - 1] + ' ' + openDay + ', ' + openYear +
                      ' – ' + MONTH_NAMES[m - 1] + ' ' + closeDay + ', ' + selectedYear;

      // Determine if any part of this billing period falls within the first-year bonus window
      var periodIsBonus = false;
      if (firstYearEnd && accountOpenDate) {
        var openD2   = self._parseDate(accountOpenDate);
        var periodStart = new Date(openYear, openMonth - 1, openDay);
        var periodEnd   = new Date(selectedYear, m - 1, closeDay);
        periodIsBonus = openD2 <= periodEnd && firstYearEnd > periodStart;
      }

      var summaryLabel = chosenCat ? (self.choiceCategories[chosenCat] || chosenCat) : 'No category selected';
      if (chosenCat && periodIsBonus) summaryLabel += ' (6%)';

      html += '<details style="margin-bottom:8px;border:1px solid ' + (isCurrent ? '#059669' : '#e7e5e4') + ';border-radius:8px;"' + (isCurrent ? ' open' : '') + '>' +
        '<summary style="padding:10px 12px;cursor:pointer;font-weight:500;font-size:13px;background:' + (isCurrent ? '#dcfce7' : '#fafaf9') + ';border-radius:7px;list-style:none;display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + MONTH_NAMES[m - 1] + ' ' + selectedYear + (isCurrent ? ' (Current)' : '') + '</span>' +
          '<span style="font-size:11px;color:' + (periodIsBonus && chosenCat ? '#059669' : '#78716c') + ';">' + summaryLabel + '</span>' +
        '</summary>' +
        '<div style="padding:12px;">' +
          '<div style="font-size:11px;color:#78716c;margin-bottom:6px;">' + rangeLbl + '</div>' +
          (periodIsBonus ? '<div style="font-size:11px;color:#059669;font-weight:500;margin-bottom:8px;">&#9733; First-year bonus active — choice category earns 6% this period.</div>' : '') +
          '<div style="font-size:12px;font-weight:500;margin-bottom:6px;">' + (periodIsBonus ? '6%' : '3%') + ' Choice Category (select one):</div>' +
          '<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:6px;">';

      var choiceKeys = Object.keys(self.choiceCategories);
      for (var ci = 0; ci < choiceKeys.length; ci++) {
        var ck   = choiceKeys[ci];
        var cl   = self.choiceCategories[ck];
        var isChk = (chosenCat === ck);
        html += '<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid ' +
          (isChk ? '#2563eb' : '#e7e5e4') + ';border-radius:4px;cursor:pointer;font-size:11px;background:' +
          (isChk ? '#eff6ff' : '') + ';">' +
          '<input type="radio" name="bofaCustomCash-' + periodKey + '" class="bofa-custom-cash-choice" ' +
            'data-period="' + periodKey + '" data-category="' + ck + '"' + (isChk ? ' checked' : '') + '>' +
          cl + '</label>';
      }
      // "None" option
      var noneChk = !chosenCat;
      html += '<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid #e7e5e4;border-radius:4px;cursor:pointer;font-size:11px;color:#78716c;">' +
        '<input type="radio" name="bofaCustomCash-' + periodKey + '" class="bofa-custom-cash-choice" ' +
          'data-period="' + periodKey + '" data-category=""' + (noneChk ? ' checked' : '') + '>' +
        'None / not set</label>';

      html += '</div>' +
        '<div style="margin-top:10px;padding:8px;background:#f0fdf4;border-radius:4px;font-size:11px;color:#065f46;">' +
          '&#128722; <strong>2% always:</strong> Grocery stores &amp; wholesale clubs' +
        '</div>' +
      '</div></details>';
    }

    html += '</div></div>';
    return html;
  },

  attachConfigListeners: function(cardId, ctx) {
    var self = window.CardTracker.cards['bofa-custom-cash'];

    // Year selector
    var yearSelect = document.getElementById('bofaCustomCashYearSelect');
    if (yearSelect) {
      yearSelect.addEventListener('change', function(e) {
        ctx.state.selectedBofaCustomCashYear = parseInt(e.target.value);
        ctx.renderCardConfig();
      });
    }

    // Closing day — persist immediately and re-render so period labels update
    var closingDaySelect = document.getElementById('bofaClosingDay');
    if (closingDaySelect) {
      closingDaySelect.addEventListener('change', function(e) {
        var data = ctx.state.bofaCustomCashData || {};
        data.closingDay = e.target.value ? parseInt(e.target.value) : '';
        ctx.state.bofaCustomCashData = data;
        ctx.safeLocalStorageSet('ccTracker_bofaCustomCashData', data);
        ctx.renderCardConfig();
      });
    }

    // Account open date — persist immediately and re-render so bonus badges update
    var openDateInput = document.getElementById('bofaAccountOpenDate');
    if (openDateInput) {
      openDateInput.addEventListener('change', function(e) {
        var data = ctx.state.bofaCustomCashData || {};
        data.accountOpenDate = e.target.value || '';
        ctx.state.bofaCustomCashData = data;
        ctx.safeLocalStorageSet('ccTracker_bofaCustomCashData', data);
        ctx.renderCardConfig();
      });
    }

    // Radio button highlight
    document.querySelectorAll('.bofa-custom-cash-choice').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var period = radio.dataset.period;
        document.querySelectorAll('.bofa-custom-cash-choice[data-period="' + period + '"]').forEach(function(r) {
          var lbl = r.closest('label');
          if (lbl) {
            var hasCategory = r.dataset.category && r.dataset.category !== '';
            lbl.style.background  = (r.checked && hasCategory) ? '#eff6ff' : '';
            lbl.style.borderColor = (r.checked && hasCategory) ? '#2563eb' : '#e7e5e4';
          }
        });
      });
    });
  },

  saveConfigSection: function(cardId, ctx) {
    var data = ctx.state.bofaCustomCashData || {};

    // Closing day
    var closingDayEl = document.getElementById('bofaClosingDay');
    if (closingDayEl && closingDayEl.value) {
      data.closingDay = parseInt(closingDayEl.value);
    }

    // Account open date
    var openDateEl = document.getElementById('bofaAccountOpenDate');
    if (openDateEl) {
      data.accountOpenDate = openDateEl.value || '';
    }

    // Monthly choice selections
    var selections = data.selections || {};
    document.querySelectorAll('.bofa-custom-cash-choice:checked').forEach(function(radio) {
      var period = radio.dataset.period;
      var cat    = radio.dataset.category;
      if (period) {
        if (cat) {
          selections[period] = cat;
        } else {
          delete selections[period];
        }
      }
    });
    data.selections = selections;
    ctx.state.bofaCustomCashData = data;
    ctx.safeLocalStorageSet('ccTracker_bofaCustomCashData', data);
  },

  pluginState: {
    stateFields: [
      { key: 'bofaCustomCashData', storageKey: 'ccTracker_bofaCustomCashData', defaultValue: {} }
    ],
    exportState: function(ctx) {
      return { bofaCustomCashData: ctx.state.bofaCustomCashData };
    },
    importState: function(data, ctx) {
      if (data.bofaCustomCashData) {
        ctx.state.bofaCustomCashData = data.bofaCustomCashData;
        ctx.safeLocalStorageSet('ccTracker_bofaCustomCashData', data.bofaCustomCashData);
      }
    },
    clearState: function(ctx) {
      ctx.state.bofaCustomCashData = {};
      localStorage.removeItem('ccTracker_bofaCustomCashData');
    }
  },
};
