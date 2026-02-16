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

  // --- Coming Soon modal handlers ---
  (function() {
    var u = 'creditcardvaluetracker';
    var d = 'gmail';
    var t = 'com';
    var addr = u + '\u0040' + d + '.' + t;
    var el = document.getElementById('comingSoonEmail');
    if (el) {
      el.textContent = addr;
      el.onclick = function() {
        window.location.href = 'mai' + 'lto:' + addr + '?subject=' + encodeURIComponent('Feature Request — Credit Card Value Tracker');
      };
    }
  })();
  document.getElementById('closeComingSoon').addEventListener('click', () => {
    document.getElementById('comingSoonModal').classList.add('hidden');
  });
  document.getElementById('comingSoonModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // --- Decision Pass banner links → open coming-soon modal (delegated) ---
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.dp-upgrade-link');
    if (link) {
      e.preventDefault();
      document.getElementById('comingSoonModal').classList.remove('hidden');
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

  // --- Upgrade button opens coming-soon modal ---
  document.getElementById('upgradeBtn').addEventListener('click', () => {
    document.getElementById('comingSoonModal').classList.remove('hidden');
  });

  // --- Close upgrade modal ---
  document.getElementById('closeUpgradeModal').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.add('hidden');
  });
  document.getElementById('upgradeModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // --- Purchase buttons → open detail modals ---
  document.getElementById('upgradeChoiceDP').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.add('hidden');
    document.getElementById('dpInfoModal').classList.remove('hidden');
  });
  document.getElementById('upgradeChoicePro').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.add('hidden');
    document.getElementById('proInfoModal').classList.remove('hidden');
  });

  // --- Close detail modals ---
  document.getElementById('closeDPInfoModal').addEventListener('click', () => {
    document.getElementById('dpInfoModal').classList.add('hidden');
  });
  document.getElementById('dpInfoModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });
  document.getElementById('closeProInfoModal').addEventListener('click', () => {
    document.getElementById('proInfoModal').classList.add('hidden');
  });
  document.getElementById('proInfoModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // --- Decision Pass key activation - Step 1: validate key and show card selector ---
  document.getElementById('dpActivateBtn').addEventListener('click', () => {
    const key = document.getElementById('dpKeyInput').value.trim();
    const errorEl = document.getElementById('dpKeyError');

    if (!isValidLicenseKeyFormat(key)) {
      errorEl.textContent = 'Invalid key format. Keys are 8-35 characters (letters, numbers, hyphens).';
      errorEl.style.display = 'block';
      return;
    }

    // Test keys (TESTDP-xxxx) bypass duplicate check
    const isTestKey = /^TESTDP-/i.test(key);
    if (!isTestKey && state.decisionPasses.some(dp => dp.key === key)) {
      errorEl.textContent = 'This key has already been activated.';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';

    // Populate card selector with mapped cards
    const cardSelect = document.getElementById('dpCardSelect');
    const mappedCardIds = [...new Set(Object.values(state.cardMappings))].filter(id => id !== 'skip');
    const allCardIds = mappedCardIds.length > 0 ? mappedCardIds : Object.keys(CARDS).filter(id => id !== 'skip');
    cardSelect.innerHTML = '<option value="">Select a card...</option>' + allCardIds.map(id => {
      const card = CARDS[id];
      if (!card) return '';
      const alreadyHasDP = hasActiveDecisionPass(id);
      const label = alreadyHasDP ? `${escapeHtml(card.name)} (already upgraded)` : escapeHtml(card.name);
      return `<option value="${escapeHtml(id)}" ${alreadyHasDP ? 'disabled' : ''}>${label}</option>`;
    }).join('');

    document.getElementById('dpCardSelector').style.display = 'block';
  });

  // --- Decision Pass key activation - Step 2: confirm card and activate ---
  document.getElementById('dpConfirmActivation').addEventListener('click', () => {
    const key = document.getElementById('dpKeyInput').value.trim();
    const cardId = document.getElementById('dpCardSelect').value;
    const errorEl = document.getElementById('dpKeyError');

    if (!cardId) {
      errorEl.textContent = 'Please select a card.';
      errorEl.style.display = 'block';
      return;
    }

    const success = activateDecisionPass(key, cardId);
    if (success) {
      document.getElementById('upgradeModal').classList.add('hidden');
      if (state.results) renderView(state.activeView);
      const configSection = document.getElementById('cardConfigSection');
      if (configSection && !configSection.classList.contains('hidden')) {
        const currentConfigCard = document.getElementById('configCardSelect')?.value;
        if (currentConfigCard) showCardConfigEditor(currentConfigCard);
      }
    } else {
      errorEl.textContent = 'Activation failed. Please check your key and try again.';
      errorEl.style.display = 'block';
    }
  });

  // --- Pro key activation ---
  document.getElementById('proActivateBtn').addEventListener('click', () => {
    const key = document.getElementById('proKeyInput').value.trim();
    const errorEl = document.getElementById('proKeyError');

    if (!isValidLicenseKeyFormat(key)) {
      errorEl.textContent = 'Invalid key format. Keys are 8-35 characters (letters, numbers, hyphens).';
      errorEl.style.display = 'block';
      return;
    }

    const success = activateProAccess(key);
    if (success) {
      document.getElementById('upgradeModal').classList.add('hidden');
      window.location.href = 'app-pro.html';
    } else {
      errorEl.textContent = 'Activation failed. Please check your key and try again.';
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
        document.getElementById('comingSoonModal').classList.remove('hidden');
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
