// =============================================================================
// PRO TIER WRAPPER (app-pro.js)
// Validates Pro license, sets TIER_CONFIG = 'pro', then initializes core.
// All shared logic lives in app-core.js (loaded before this script).
// =============================================================================

// PRO TIER VALIDATION — redirect to free page if no valid license key
window.TIER_CONFIG = 'pro';
(function() {
  try {
    const proAccess = JSON.parse(localStorage.getItem('ccTracker_proAccess'));
    if (!proAccess || !proAccess.key) {
      window.location.href = 'app.html';
      return;
    }
  } catch(e) {
    window.location.href = 'app.html';
    return;
  }
})();

// =============================================================================
// PRO-ONLY INITIALIZATION (DOMContentLoaded)
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await initCore();
});
