// =============================================================================
// PRO TIER WRAPPER (app-pro.js)
// Validates Pro license via Gumroad re-verification (7-day window),
// sets TIER_CONFIG = 'pro', then initializes core.
// Subscription validity is controlled by Gumroad membership — if the
// membership lapses, the weekly re-verification will fail and access stops.
// All shared logic lives in app-core.js (loaded before this script).
// =============================================================================

window.TIER_CONFIG = 'pro';

// Immediate check: redirect if no proAccess stored at all
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
// PRO VALIDATION + INITIALIZATION (DOMContentLoaded)
// Re-verification: lastVerified > 7 days → call Gumroad
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  const proAccess = JSON.parse(localStorage.getItem('ccTracker_proAccess'));

  // --- Re-verification (lastVerified) ---
  if (proNeedsReverification()) {
    const result = await verifyGumroadLicense(proAccess.key);
    if (result.success) {
      updateProLastVerified();
    } else {
      // Show connectivity modal — no way to dismiss except OK → app.html
      const modal = document.getElementById('proVerifyModal');
      modal.style.display = '';
      modal.classList.remove('hidden');
      document.getElementById('proVerifyOK').addEventListener('click', () => {
        window.location.href = 'app.html';
      });
      return; // Do not proceed to initCore
    }
  }

  // --- Verification passed: initialize ---
  await initCore();
});
