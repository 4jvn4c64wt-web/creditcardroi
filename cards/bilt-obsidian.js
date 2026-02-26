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
    credits: [{ name: 'Bilt Travel Credit', amount: 100, keywords: ['BILT TRAVEL'], manual: false }],
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
  };
})();
