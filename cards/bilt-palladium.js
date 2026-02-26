window.CardTracker = window.CardTracker || {};
window.CardTracker.cards = window.CardTracker.cards || {};

(function() {
  var biltPlugin = window.CardTracker.biltPlugin;

  window.CardTracker.cards['bilt-palladium'] = {
    name: 'Bilt Palladium',
    shortName: 'Bilt Palladium',
    annualFee: 495,
    annualFeeStartDate: '2026-02-07', // No annual fee charged before this date
    pointValue: 0.018,
    // Bilt 2.0: 2x on ALL everyday spending (flat rate, no categories)
    multipliers: {},
    baseRate: 2,
    credits: [
      { name: 'Bilt Travel Credit', amount: 400, keywords: ['BILT TRAVEL'], manual: false }
    ],
    categories: ['rent', 'other'],
    isBilt: true,
    // Legacy (before Feb 7, 2026): same as all Bilt cards - 3x dining, 2x travel, 1x everything else
    legacy: {
      multipliers: { 'dining': 3, 'travel': 2 },
      baseRate: 1,
      categories: ['dining', 'travel', 'rent', 'other']
    },

    // Plugin hooks — delegate to shared Bilt plugin
    getMultiplier: function(category, txnDate, merchantDesc, ctx) {
      this._pluginCardId = 'bilt-palladium';
      return biltPlugin.getMultiplier.call(this, category, txnDate, merchantDesc, ctx);
    },
    getCategories: function(txnDate, ctx) {
      this._pluginCardId = 'bilt-palladium';
      return biltPlugin.getCategories.call(this, txnDate, ctx);
    },
    getScenarioMultiplier: function(category, ctx) {
      this._pluginCardId = 'bilt-palladium';
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
