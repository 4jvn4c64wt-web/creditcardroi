// =============================================================================
// FREE TIER WRAPPER (app.js)
// Sets TIER_CONFIG = 'free', registers free-only UI, then initializes core.
// All shared logic lives in app-core.js (loaded before this script).
// =============================================================================

window.TIER_CONFIG = 'free';

// =============================================================================
// NEWSLETTER POPUP (free mode only, deferred until tour completes)
// Uses Buttondown's embed form (no API key needed — posts to hidden iframe)
// =============================================================================

function initNewsletterPopup() {
  const popup = document.getElementById('newsletterPopup');

  function closeNewsletter() {
    popup.classList.add('hidden');
  }

  document.getElementById('newsletterClose').addEventListener('click', closeNewsletter);
  document.getElementById('newsletterSkip').addEventListener('click', closeNewsletter);
  popup.addEventListener('click', (e) => { if (e.target === popup) closeNewsletter(); });

  document.getElementById('newsletterForm').addEventListener('submit', (e) => {
    const emailInput = document.getElementById('newsletterEmail');
    const email = emailInput.value.trim();
    const msgEl = document.getElementById('newsletterMsg');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.preventDefault();
      msgEl.textContent = 'Please enter a valid email address.';
      msgEl.className = 'newsletter-msg error';
      msgEl.classList.remove('hidden');
      return;
    }

    // Form submits to hidden iframe — mark as subscribed
    safeLocalStorageSet('ccTracker_newsletterSubmitted', 'true');
    msgEl.textContent = 'You\'re in! We\'ll keep you posted.';
    msgEl.className = 'newsletter-msg success';
    msgEl.classList.remove('hidden');
    document.getElementById('newsletterSubmit').disabled = true;
    setTimeout(closeNewsletter, 2000);
  });
}

// Show the newsletter popup if the user hasn't already submitted their email.
// Called from showResults() (with appropriate delay) or from endTour() in tutorial.js.
// Only shows when the card performance / results page is visible.
function showNewsletterPopup(delayMs) {
  // Don't show if user already subscribed (persists across sessions, cleared by Clear Everything)
  if (localStorage.getItem('ccTracker_newsletterSubmitted')) return;
  if (sessionStorage.getItem('ccTracker_newsletterShown')) return;
  // Don't show while tour is active — endTour() will call us when it's done
  if (state.tourActive) return;
  // Only show on the card performance page, not the upload/CSV page
  var results = document.getElementById('resultsSection');
  if (!results || results.classList.contains('hidden')) return;
  sessionStorage.setItem('ccTracker_newsletterShown', 'true');
  setTimeout(() => {
    document.getElementById('newsletterPopup').classList.remove('hidden');
  }, delayMs || 2000);
}

// =============================================================================
// FREE-ONLY EVENT HANDLERS (DOMContentLoaded)
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {

  // --- Upgrade links → open upgrade modal directly (delegated) ---
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.dp-upgrade-link');
    if (link) {
      e.preventDefault();
      document.getElementById('upgradeModal').classList.remove('hidden');
    }
  });

  // --- Decision Pass banner dismiss X buttons (delegated, per-page persistence) ---
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.dp-banner-close');
    if (closeBtn) {
      const bannerKey = closeBtn.dataset.bannerKey;
      if (bannerKey) {
        state.dpBannersDismissed[bannerKey] = true;
        safeLocalStorageSet('ccTracker_dpBannersDismissed', state.dpBannersDismissed);
      }
      const banner = closeBtn.closest('.dp-banner');
      if (banner) banner.remove();
    }
  });

  // --- Upgrade button opens upgrade modal directly ---
  document.getElementById('upgradeBtn').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.remove('hidden');
  });

  // --- Close upgrade modal ---
  document.getElementById('closeUpgradeModal').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.add('hidden');
  });
  document.getElementById('upgradeModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // --- Pro purchase button → opens Gumroad in new tab ---
  document.getElementById('upgradeChoicePro').addEventListener('click', () => {
    window.open('https://creditcardvalue.gumroad.com/l/snzsfy', '_blank');
  });

  // --- Pro key activation (Gumroad API verification) ---
  document.getElementById('proActivateBtn').addEventListener('click', async () => {
    const key = document.getElementById('proKeyInput').value.trim();
    const errorEl = document.getElementById('proKeyError');
    const btn = document.getElementById('proActivateBtn');

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
      document.getElementById('upgradeModal').classList.add('hidden');
      window.location.href = 'app-pro.html';
    } else {
      btn.disabled = false;
      btn.textContent = 'Activate';
      errorEl.textContent = 'Invalid license key. Please check your key and try again.';
      errorEl.style.display = 'block';
    }
  });

  // --- Card Scenarios tab → pro gating (must register before initCore adds its tab handler) ---
  (function() {
    var csTab = document.getElementById('cardScenariosTab');
    var csModal = document.getElementById('cardScenariosProModal');
    if (csTab && csModal) {
      csTab.addEventListener('click', function(e) {
        e.stopImmediatePropagation();
        csModal.classList.remove('hidden');
      });
      document.getElementById('closeCardScenariosPro').addEventListener('click', function() {
        csModal.classList.add('hidden');
      });
      document.getElementById('cardScenariosProUpgrade').addEventListener('click', function() {
        csModal.classList.add('hidden');
        document.getElementById('upgradeModal').classList.remove('hidden');
      });
      csModal.addEventListener('click', function(e) {
        if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
      });
    }
  })();

  // --- Newsletter popup setup ---
  initNewsletterPopup();

  // --- Initialize shared core ---
  await initCore();
});
