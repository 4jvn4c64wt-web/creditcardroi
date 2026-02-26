// =============================================================================
// BILT SHARED PLUGIN
// =============================================================================
// Shared logic for all Bilt cards (Blue, Obsidian, Palladium).
// Individual Bilt card files reference these hooks via window.CardTracker.biltPlugin.
// This file must load BEFORE individual Bilt card files in the HTML.

window.CardTracker = window.CardTracker || {};

window.CardTracker.biltPlugin = {

  // =========================================================================
  // getMultiplier hook — handles legacy vs 2.0, rent calculation
  // =========================================================================
  getMultiplier: function(category, txnDate, merchantDesc, ctx) {
    // Determine which card is calling (passed via _pluginCardId set by dispatch)
    const cardId = this._pluginCardId;
    const card = ctx.CARDS[cardId];
    if (!card) return null;

    const cfg = ctx.state.biltConfig[cardId] || {};

    // Bilt 2.0 universally starts Feb 7, 2026
    const bilt2StartDate = new Date(2026, 1, 7);

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
    const isLegacy = txnDateObj < bilt2StartDate;

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

      if (cfg.rewardOption === 'housing-only') {
        // Calculate NET spending ratio from transactions in the same month
        const txnMonth = txnDateObj.getMonth();
        const txnYear = txnDateObj.getFullYear();
        const monthTxns = ctx.state.transactions.filter(t => {
          const mappedCardId = ctx.state.cardMappings[t.last4];
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
        // Flexible Bilt Cash option
        const monthlyRedemption = cfg.monthlyBiltCashRedemption || 0;
        const maxPts = (monthlyRedemption / 3) * 100;
        const rate = rentAmt > 0 ? Math.min(1, maxPts / rentAmt) : 0;
        if (rate <= 0) {
          const isConfigured = ctx.isBiltCardConfigured(cardId);
          if (!isConfigured) {
            return { rate: 1, reason: '1x rent (estimated - configure card for actual rate)' };
          }
          return { rate: 0, reason: 'Rent: No Bilt Cash redemption configured' };
        }
        return { rate, reason: `Rent: ${(rate * 100).toFixed(0)}% via $${monthlyRedemption.toFixed(0)} Bilt Cash/mo` };
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

    const bilt2StartDate = new Date(2026, 1, 7);
    const txnDateObj = txnDate ? new Date(txnDate) : new Date();
    if (txnDateObj < bilt2StartDate) {
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
};
