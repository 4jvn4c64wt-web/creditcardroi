window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

(function() {
  var biltPlugin = window.CardTracker.biltPlugin;

  window.CardTracker.cards['bilt-obsidian'] = {
    name: 'Bilt Obsidian',
    shortName: 'Bilt Obsidian',
    annualFee: 95,
    annualFeeStartDate: '2026-02-07', // No annual fee charged before this date
    pointValue: 0.018,
    // Bilt 2.0: 3x dining OR grocery (user choice), 2x travel, 1x other
    multipliers: { 'dining': 3, 'travel': 2 },
    baseRate: 1,
    credits: [
      // $50 per semi-annual period (Jan–Jun, Jul–Dec) toward hotel bookings on Bilt Travel Portal
      // (min. 2-night stay). Applied at checkout — not a statement credit. Does not roll over.
      { name: 'Bilt Hotel Credit', amount: 100, manual: true, frequency: 'semi-annual' }
    ],
    hasTravelCredit: true,       // flag used by bilt-plugin to show hotel credit ledger in Card Config
    travelCreditPerPeriod: 50,   // semi-annual cap ($100/year, non-rollover)
    categories: ['rent', 'dining', 'grocery', 'travel', 'other'],
    isBilt: true,
    hasObsidianBonus: true, // Can choose 3x dining OR grocery
    // Legacy (before Feb 7, 2026): same as all Bilt cards - 3x dining, 2x travel, 1x everything else
    legacy: {
      multipliers: { 'dining': 3, 'travel': 2 },
      baseRate: 1,
      categories: ['dining', 'travel', 'rent', 'other']
    },

    // Plugin hooks — delegate to shared Bilt plugin
    getMultiplier: function(category, txnDate, merchantDesc, ctx) {
      this._pluginCardId = 'bilt-obsidian';
      return biltPlugin.getMultiplier.call(this, category, txnDate, merchantDesc, ctx);
    },
    getCategories: function(txnDate, ctx) {
      this._pluginCardId = 'bilt-obsidian';
      return biltPlugin.getCategories.call(this, txnDate, ctx);
    },
    getScenarioMultiplier: function(category, ctx) {
      this._pluginCardId = 'bilt-obsidian';
      return biltPlugin.getScenarioMultiplier.call(this, category, ctx);
    },
    getDisplayRate: function(category, txnDate, ctx) {
      this._pluginCardId = 'bilt-obsidian';
      return biltPlugin.getDisplayRate.call(this, category, txnDate, ctx);
    },
    renderConfigSection: function(cardId, ctx) {
      this._pluginCardId = cardId;
      return biltPlugin.renderConfigSection.call(this, cardId, ctx);
    },
    attachConfigListeners: function(cardId, ctx) {
      this._pluginCardId = cardId;
      return biltPlugin.attachConfigListeners.call(this, cardId, ctx);
    },
    saveConfigSection: function(cardId, ctx) {
      this._pluginCardId = cardId;
      return biltPlugin.saveConfigSection.call(this, cardId, ctx);
    },
    scenarioPrompt: biltPlugin.scenarioPrompt,
    pluginState: biltPlugin.pluginState,
  };
})();
