window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

window.CardTracker.cards['bofa-unlimited-cash'] = {
  name: 'Bank of America Unlimited Cash Rewards',
  shortName: 'BofA Unlimited Cash',
  annualFee: 0,
  // Flat 1.5% on everything; 2% during first 365 days (extra 0.5% first-year bonus).
  pointValue: 0.01,
  multipliers: {},
  baseRate: 1.5,
  credits: [],
  categories: ['other'],

  // -------------------------------------------------------------------------
  // Helper: parse a date string into a JS Date (local, no timezone shift)
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
    var self = window.CardTracker.cards['bofa-unlimited-cash'];
    var config = ctx.state.bofaUnlimitedCashData || {};
    if (!config.accountOpenDate) return null; // Fall through to baseRate (1.5%)

    var openDate   = self._parseDate(config.accountOpenDate);
    var txnDateObj = self._parseDate(txnDate);
    if (!openDate || !txnDateObj) return null;

    var daysSinceOpen = Math.floor((txnDateObj - openDate) / 86400000);
    if (daysSinceOpen >= 0 && daysSinceOpen < 365) {
      return { rate: 2, reason: '2% — first-year bonus (base 1.5% + extra 0.5%)' };
    }
    return null; // Fall through to baseRate (1.5%)
  },

  renderConfigSection: function(cardId, ctx) {
    var self = window.CardTracker.cards['bofa-unlimited-cash'];
    var config = ctx.state.bofaUnlimitedCashData || {};
    var accountOpenDate = config.accountOpenDate || '';

    var firstYearActive = false;
    var firstYearDaysLeft = 0;
    if (accountOpenDate) {
      var openDate = self._parseDate(accountOpenDate);
      var today = new Date(); today.setHours(0, 0, 0, 0);
      if (openDate) {
        var daysSinceOpen = Math.floor((today - openDate) / 86400000);
        if (daysSinceOpen >= 0 && daysSinceOpen < 365) {
          firstYearActive = true;
          firstYearDaysLeft = 365 - daysSinceOpen;
        }
      }
    }

    return '<div id="bofaUnlimitedCashSection">' +
      '<div style="padding:12px;border:1px solid #e7e5e4;border-radius:8px;background:#fafaf9;">' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">First-Year Bonus</div>' +
        '<p style="font-size:12px;color:#78716c;margin-bottom:8px;">' +
          'Earn 2% on all purchases (extra 0.5%) for 365 days from account opening. Enter your open date to activate.' +
        '</p>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<label style="font-size:12px;font-weight:500;white-space:nowrap;" for="bofaUnlimitedOpenDate">Account opened on</label>' +
          '<input type="date" id="bofaUnlimitedOpenDate" class="form-control" ' +
            'style="width:160px;padding:6px 8px;font-size:12px;border:1px solid #e7e5e4;border-radius:4px;" ' +
            'value="' + accountOpenDate + '">' +
        '</div>' +
        (firstYearActive
          ? '<p style="font-size:11px;color:#059669;font-weight:500;margin-top:6px;">&#10003; First-year 2% bonus active — ' + firstYearDaysLeft + ' days remaining.</p>'
          : (accountOpenDate
              ? '<p style="font-size:11px;color:#78716c;margin-top:6px;">First-year bonus period has ended. Earning standard 1.5%.</p>'
              : '')) +
      '</div>' +
    '</div>';
  },

  attachConfigListeners: function(cardId, ctx) {
    var openDateInput = document.getElementById('bofaUnlimitedOpenDate');
    if (openDateInput) {
      openDateInput.addEventListener('change', function(e) {
        var data = ctx.state.bofaUnlimitedCashData || {};
        data.accountOpenDate = e.target.value || '';
        ctx.state.bofaUnlimitedCashData = data;
        ctx.safeLocalStorageSet('ccTracker_bofaUnlimitedCashData', data);
        ctx.renderCardConfig();
      });
    }
  },

  saveConfigSection: function(cardId, ctx) {
    var data = ctx.state.bofaUnlimitedCashData || {};
    var openDateEl = document.getElementById('bofaUnlimitedOpenDate');
    if (openDateEl) {
      data.accountOpenDate = openDateEl.value || '';
    }
    ctx.state.bofaUnlimitedCashData = data;
    ctx.safeLocalStorageSet('ccTracker_bofaUnlimitedCashData', data);
  },

  pluginState: {
    stateFields: [
      { key: 'bofaUnlimitedCashData', storageKey: 'ccTracker_bofaUnlimitedCashData', defaultValue: {} }
    ],
    exportState: function(ctx) {
      return { bofaUnlimitedCashData: ctx.state.bofaUnlimitedCashData };
    },
    importState: function(data, ctx) {
      if (data.bofaUnlimitedCashData) {
        ctx.state.bofaUnlimitedCashData = data.bofaUnlimitedCashData;
        ctx.safeLocalStorageSet('ccTracker_bofaUnlimitedCashData', data.bofaUnlimitedCashData);
      }
    },
    clearState: function(ctx) {
      ctx.state.bofaUnlimitedCashData = {};
      localStorage.removeItem('ccTracker_bofaUnlimitedCashData');
    }
  },
};
