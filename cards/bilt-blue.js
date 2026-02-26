window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

(function() {
  var biltPlugin = window.CardTracker.biltPlugin;

  window.CardTracker.cards['bilt-blue'] = {
    name: 'Bilt Blue',
    shortName: 'Bilt Blue',
    annualFee: 0,
    pointValue: 0.018,
    // Bilt 2.0 (Feb 7, 2026+): 1x on ALL everyday spending, NO bonus categories
    multipliers: {},
    baseRate: 1,
    credits: [],
    categories: ['rent', 'other'],
    isBilt: true,
    // Legacy (before Feb 7, 2026): 3x dining, 2x travel, 1x everything else (including rent)
    // Note: rent is 1x (same as baseRate) - no special rent multiplier before 2.0
    legacy: {
      multipliers: { 'dining': 3, 'travel': 2 },
      baseRate: 1,
      categories: ['dining', 'travel', 'rent', 'other']
    },

    // Plugin hooks — delegate to shared Bilt plugin
    getMultiplier: function(category, txnDate, merchantDesc, ctx) {
      this._pluginCardId = 'bilt-blue';
      return biltPlugin.getMultiplier.call(this, category, txnDate, merchantDesc, ctx);
    },
    getCategories: function(txnDate, ctx) {
      this._pluginCardId = 'bilt-blue';
      return biltPlugin.getCategories.call(this, txnDate, ctx);
    },
    getScenarioMultiplier: function(category, ctx) {
      this._pluginCardId = 'bilt-blue';
      return biltPlugin.getScenarioMultiplier.call(this, category, ctx);
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
