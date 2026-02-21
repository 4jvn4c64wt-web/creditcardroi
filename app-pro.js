// =============================================================================
// PRO TIER WRAPPER (app-pro.js)
// Validates Pro license via Gumroad re-verification + subscription expiry,
// sets TIER_CONFIG = 'pro', then initializes core.
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
// Two independent checks run in order:
// 1. Re-verification (lastVerified > 7 days → call Gumroad)
// 2. Subscription expiry (activatedAt > 365 days → show expired modal)
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  const proAccess = JSON.parse(localStorage.getItem('ccTracker_proAccess'));

  // --- Check 1: Re-verification (lastVerified) ---
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

  // --- Check 2: Subscription expiry (activatedAt) ---
  if (!hasValidProAccess()) {
    // Show subscription expired modal
    const modal = document.getElementById('proExpiredModal');
    modal.style.display = '';
    modal.classList.remove('hidden');

    // "Return to Free" button
    document.getElementById('expiredReturnFree').addEventListener('click', () => {
      window.location.href = 'app.html';
    });

    // "Activate" button for new key
    document.getElementById('expiredActivateBtn').addEventListener('click', async () => {
      const key = document.getElementById('expiredKeyInput').value.trim();
      const errorEl = document.getElementById('expiredKeyError');
      const btn = document.getElementById('expiredActivateBtn');

      if (!key) {
        errorEl.textContent = 'Please enter a license key.';
        errorEl.style.display = 'block';
        return;
      }

      errorEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Verifying...';

      const result = await verifyGumroadLicense(key);

      if (result.success) {
        activateProAccess(key);
        window.location.href = 'app-pro.html'; // Reload with fresh timestamps
      } else {
        btn.disabled = false;
        btn.textContent = 'Activate';
        errorEl.textContent = 'Invalid license key. Please check your key and try again.';
        errorEl.style.display = 'block';
      }
    });

    return; // Do not proceed to initCore
  }

  // --- Both checks passed: initialize ---
  await initCore();
});
