// =============================================================================
// PRO TIER WRAPPER (app-pro.js)
// Sets TIER_CONFIG = 'pro' and initializes core. All features are available
// to all users — no license verification required.
// All shared logic lives in app-core.js (loaded before this script).
// =============================================================================

window.TIER_CONFIG = 'pro';

document.addEventListener('DOMContentLoaded', async () => {
  await initCore();
});
