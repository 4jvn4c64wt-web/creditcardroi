// =============================================================================
// HELP & TOUR SYSTEM
// =============================================================================

// Context-sensitive help content for each page/view
// Sections with `pro: true` are only shown when window.TIER_CONFIG === 'pro'
const HELP_CONTENT = {
  summary: {
    title: 'Summary Page Help',
    sections: [
      {
        icon: '📊',
        title: 'Card Performance Cards',
        text: 'Each card shows net value, annual fee, and a performance tag on the front. <strong>Click any card to flip it</strong> and see the full breakdown: spend, points earned, credits, and net value.'
      },
      {
        icon: '💰',
        title: 'Net Value Header',
        text: 'Your overall Net Value stays visible at the top of every page. Click the <strong>+</strong> button to expand a breakdown: Points Value + Credits − Annual Fees = Net Value. It stays open until you close it.'
      },
      {
        icon: '📅',
        title: 'Year Filter',
        text: 'Filter results by year using the dropdown. "All Years" shows combined totals with annual fees counted once per card.'
      },
      {
        icon: '📅',
        title: 'Card Year (CY) Toggle',
        text: 'Use the <strong>CY</strong> toggle on each card to switch between Calendar Year (Jan–Dec) and Card Year (anniversary date). Card Year is more useful when deciding whether to keep a card at renewal.'
      }
    ]
  },
  transactions: {
    title: 'Transactions Page Help',
    sections: [
      {
        icon: '🧩',
        title: 'How Classification Works',
        text: 'The app automatically categorizes each transaction using the merchant name, your bank\'s category label, and built-in rules.'
      },
      {
        icon: '🔍',
        title: 'Filters',
        text: 'Filter by year, month, card, or category. Use "Credits" to see statement credits, or <strong>"Needs Review"</strong> to see transactions the app couldn\'t confidently classify.'
      },
      {
        icon: '🏷️',
        title: 'Recategorize Transactions',
        text: '<strong>Click any category badge</strong> to change how a transaction is classified. This affects point calculations. You can also set rules to apply to all similar merchants.'
      },
      {
        icon: '⚠️',
        title: 'Needs Review',
        text: 'Transactions flagged with ⚠️ have low confidence. Click the category badge to correct them — this improves accuracy and creates rules for similar transactions.'
      }
    ]
  },
  cardConfig: {
    title: 'Card Config Help',
    sections: [
      {
        icon: '📋',
        title: 'Quarterly Categories',
        text: '<strong>Important:</strong> For Chase Freedom Flex and US Bank Cash+, select your activated bonus categories for each quarter. This determines which transactions get 5% back.'
      },
      {
        icon: '💳',
        title: 'Statement Credits',
        text: 'Some credits (like streaming or airline incidentals) are auto-detected from your transactions. Others (like Uber Cash or Amex Offers) don\'t appear in transaction data — those are marked ⚡ and you track them manually by clicking the month buttons. Toggle any credit on/off to include or exclude it from ROI.'
      },
      {
        icon: '💰',
        title: 'Point Values',
        text: 'How much each point is worth when you redeem it (in cents). For example, at 2.0¢ per point, 1,000 points = $20. Cash back users might set 1.0¢, travel redeemers might set 1.5–2.0¢.'
      }
    ]
  },
  cardscenarios: {
    title: 'Card Scenarios Help',
    sections: [
      {
        icon: '🔮',
        title: 'What Card Scenarios Does',
        text: 'Model the financial impact of changing your wallet. Choose <strong>Add</strong>, <strong>Remove</strong>, or <strong>Swap</strong> a card, pick a year of spending data, and the engine reroutes every transaction to show the net effect on points, credits, and annual fees.'
      },
      {
        icon: '💳',
        title: 'How Spending Is Rerouted',
        text: 'When you add a card, the engine checks each transaction: if the new card earns more than the card you actually used, that spending shifts to the new card. When you remove a card, its spending shifts to whichever remaining card earns the most for each category.'
      },
      {
        icon: '📊',
        title: 'Result Breakdown',
        text: 'The result shows: Credits gained or lost, Point value change from rerouted spending, Annual fee of the new or removed card, and the combined Estimated Net Impact.'
      }
    ]
  }
};

// Guidance banner dismissal tracking
const dismissedGuidance = safeJSONParse(localStorage.getItem('ccTracker_dismissedGuidance'), {});

function dismissGuidance(sectionId) {
  dismissedGuidance[sectionId] = true;
  safeLocalStorageSet('ccTracker_dismissedGuidance', dismissedGuidance);
  const banner = document.getElementById('guidance' + sectionId.charAt(0).toUpperCase() + sectionId.slice(1));
  if (banner) banner.style.display = 'none';
}

function showGuidanceIfNeeded(sectionId) {
  const banner = document.getElementById('guidance' + sectionId.charAt(0).toUpperCase() + sectionId.slice(1));
  if (banner && !dismissedGuidance[sectionId]) {
    banner.style.display = 'block';
  } else if (banner) {
    banner.style.display = 'none';
  }
}

function showHelp(context = null) {
  // Determine current context if not provided
  if (!context) {
    if (document.getElementById('cardConfigSection').classList.contains('hidden') === false) {
      context = 'cardConfig';
    } else if (state.activeView === 'cardscenarios') {
      context = 'cardscenarios';
    } else if (state.activeView === 'transactions') {
      context = 'transactions';
    } else {
      context = 'summary';
    }
  }

  const help = HELP_CONTENT[context];
  if (!help) return;

  
  const sections = help.sections;

  document.getElementById('helpModalContent').innerHTML = `
    <h4 style="font-size:15px;font-weight:600;margin-bottom:16px;color:#78716c;">${help.title}</h4>
    ${sections.map(s => `
      <div style="margin-bottom:16px;padding:12px;background:#fafaf9;border-radius:8px;">
        <div style="font-weight:600;margin-bottom:6px;">${s.icon} ${s.title}</div>
        <div style="font-size:13px;color:#57534e;line-height:1.5;">${s.text}</div>
      </div>
    `).join('')}
    <div style="border-top:1px solid #e7e5e4;padding-top:16px;margin-top:8px;">
      <button id="startTourFromHelp" class="btn btn-secondary" style="width:100%;">
        \u{1F393} Take the Tour
      </button>
      <p style="font-size:11px;color:#a8a29e;text-align:center;margin-top:8px;">
        Interactive walkthrough of all features
      </p>
    </div>
  `;

  document.getElementById('helpModal').classList.remove('hidden');

  // Add event listener for tour button
  setTimeout(() => {
    document.getElementById('startTourFromHelp')?.addEventListener('click', () => {
      document.getElementById('helpModal').classList.add('hidden');
      startTour(true); // true = manual restart
    });
  }, 0);
}

// =============================================================================
// TOUR SYSTEM
// =============================================================================

// Tour step definitions
const TOUR_STEPS = [
  {
    type: 'modal',
    phase: 'setup',
    id: 'welcome',
    title: 'Welcome to Credit Card ValueTracker! 👋',
    content: `
      <p>Upload transactions → the app classifies your spending → you see your <strong>net value per card</strong> (points + credits − annual fees).</p>
      <p style="margin-top:12px;font-size:12px;color:#78716c;">🔒 Your data never leaves your device. All calculations happen locally in your browser.</p>
    `,
    buttons: [{ text: 'Get Started →', action: 'next', primary: true }]
  },
  {
    type: 'modal',
    phase: 'setup',
    id: 'upload',
    title: 'Step 1: Upload Your Transactions 📄',
    content: `
      <p style="text-align:left;">First, you'll need to upload a CSV file of your transactions. We support exports from most credit card companies and money management apps.</p>
      <p style="text-align:left;margin-top:12px;">After you click Continue, drag & drop your CSV or click to browse.</p>
    `,
    buttons: [{ text: 'Continue →', action: 'next', primary: true }],
    onNext: () => { /* Will show upload section */ }
  },
  { type: 'wait-for-upload', phase: 'setup', id: 'wait-upload' },
  { type: 'wait-for-mapping', phase: 'setup', id: 'wait-mapping' },

  {
    type: 'spotlight',
    phase: 'summary-tour',
    id: 'net-value-header',
    target: '.shell-net-block',
    title: 'Your Net Value',
    content: 'This is your overall <strong>Net Value</strong> across all cards — it stays visible at the top of every page. Net Value = Points Value + Credits − Annual Fees.',
    position: 'bottom',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'summary-tour',
    id: 'card-front',
    target: '.flip-card',
    title: 'Card Performance Cards',
    content: 'Each card shows a high-level summary: net value, annual fee, and performance tags. Cards with annual fees have a <strong>CY</strong> toggle to switch between calendar year and card anniversary year.',
    position: 'right',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'summary-tour',
    id: 'card-back',
    target: '.flip-card',
    title: 'Flip for Full Breakdown',
    content: 'Click any card to <strong>flip it over</strong> and see the full breakdown: total spend, points earned, points value, credits used, annual fee, and net value.',
    position: 'right',
    clickRequired: false,
    onShow: 'flip-first-card'
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'transactions-tab',
    target: '.tab[data-view="transactions"]',
    title: 'All Transactions 📋',
    content: 'Click here to see every transaction and how it was categorized.',
    position: 'bottom',
    clickRequired: true,
    clickAction: 'navigate-transactions'
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'recategorize',
    target: '#transactionsBody .badge',
    title: 'Recategorize Transactions 🏷️',
    content: 'We automatically categorize transactions (e.g., CVS → Drugstore) based on built-in rules. If we got it wrong, simply click any category badge to recategorize it and create a rule for the future!',
    position: 'right',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'reclassify-modal',
    target: '#creditModal .loading-modal',
    title: 'Reclassify & Create Rules 🛠️',
    content: 'Change the category here, or create a rule to automatically categorize all future transactions from this merchant. Point valuations and Net Value will update in real-time!',
    position: 'right',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'manage-nav',
    target: '#manageBtn',
    title: 'Manage Your Data ⚙️',
    content: 'The <strong>Manage</strong> button is your hub for configuration. Here you can edit Point Valuations, toggle manual Statement Credits, re-map your cards, and export or reset your data.',
    position: 'bottom',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'card-config-warning',
    target: '#manageBtn',
    title: 'Crucial Card Setup ⚙️',
    content: '<strong>Important:</strong> If you hold a Bilt card (to track rent) or cards with user-selected categories (like US Bank Cash+ or Bank of America Custom Cash), you <em>must</em> configure these under <strong>Card Config</strong> to get an accurate ROI calculation!',
    position: 'bottom',
    clickRequired: false
  },
  {
    type: 'modal',
    phase: 'complete',
    id: 'complete',
    title: 'You\'re All Set! 🎉',
    content: `
      <p><strong>What to do next:</strong></p>
      <p style="margin:12px 0 4px;text-align:left;">Head to the <strong>Summary</strong> page and flip any card to see its net value. Explore the <strong>Manage</strong> menu to fine-tune your point valuations.</p>
      <p style="margin-top:12px;font-size:12px;color:#78716c;">Click <strong>Help</strong> on any page for guidance, or to restart this tour.</p>
    `,
    buttons: [{ text: 'Start Using the App', action: 'finish', primary: true }]
  }
];

// Get total displayable steps (excluding wait steps)
function getTourStepCount() {
  return TOUR_STEPS.filter(s => s.type !== 'wait-for-upload' && s.type !== 'wait-for-mapping').length;
}

// Get display step number (excluding wait steps)
function getDisplayStepNumber(stepIndex) {
  let count = 0;
  for (let i = 0; i <= stepIndex; i++) {
    if (TOUR_STEPS[i].type !== 'wait-for-upload' && TOUR_STEPS[i].type !== 'wait-for-mapping') {
      count++;
    }
  }
  return count;
}

// Start the tour
function startTour(isManualRestart = false) {
  if (isManualRestart) {
    state.tourStep = 0;
    state.tourComplete = false;
    localStorage.removeItem('ccTracker_tourComplete');

    // Navigate back to summary view so tour steps can find their targets
    const cardConfigSection = document.getElementById('cardConfigSection');
    if (cardConfigSection && !cardConfigSection.classList.contains('hidden')) {
      cardConfigSection.classList.add('hidden');
    }
    if (state.results) {
      document.getElementById('resultsSection').classList.remove('hidden');
      renderView('summary');
    }
  }

  state.tourActive = true;
  renderTourStep();
}

// Render current tour step
function renderTourStep() {
  let step = TOUR_STEPS[state.tourStep];
  if (!step) {
    endTour();
    return;
  }

  // Skip the reclassify modal step if the category modal is not currently open
  if (step.id === 'reclassify-modal') {
    const modal = document.getElementById('creditModal');
    if (!modal || modal.classList.contains('hidden')) {
      state.tourStep++;
      renderTourStep();
      return;
    }
  }

  // Save progress
  safeLocalStorageSet('ccTracker_tourStep', state.tourStep);

  // Handle different step types
  if (step.type === 'modal') {
    showTourModal(step);
  } else if (step.type === 'spotlight') {
    // Check conditional steps
    if (step.conditional) {
      if (!checkConditional(step.conditional)) {
        // Skip this step
        state.tourStep++;
        renderTourStep();
        return;
      }
    }
    showTourSpotlight(step);
  } else if (step.type === 'wait-for-upload') {
    // Hide tour UI, wait for upload
    hideTourUI();
    // Tour will continue when upload completes
  } else if (step.type === 'wait-for-mapping') {
    // Hide tour UI, wait for card mapping
    hideTourUI();
    // Tour will continue when mapping completes
  }
}

// Check conditional for step
function checkConditional(conditional) {
  const cardId = document.getElementById('configCardSelect')?.value;
  const card = CARDS[cardId];

  if (conditional === 'hasManualCredits') {
    const disabledForCard = state.disabledCredits[cardId] || [];
    const enabledCredits = (card?.credits || []).filter(c => !disabledForCard.includes(c.name));
    return enabledCredits.some(c => c.manual);
  }

  if (conditional === 'hasQuarterlyCategories') {
    return cardId === 'chase-freedom-flex' || cardId === 'us-bank-cash-plus';
  }

  return true;
}

// Show modal tour step
function showTourModal(step) {
  hideTourOverlay();

  const modal = document.getElementById('tourModal');
  const content = document.getElementById('tourModalContent');

  const stepNum = getDisplayStepNumber(state.tourStep);
  const totalSteps = getTourStepCount();

  // For the upload step, add "Skip Upload" button if user already has data
  const hasExistingData = state.savedTransactions && state.savedTransactions.length > 0;
  const showSkipUpload = step.id === 'upload' && hasExistingData;

  content.innerHTML = `
    <div class="tour-modal-icon">${step.title.split(' ').pop()}</div>
    <div class="tour-modal-title">${step.title.replace(/\s*[\u{1F300}-\u{1F9FF}]/gu, '')}</div>
    <div class="tour-modal-text">${step.content}</div>
    <div class="tour-modal-buttons">
      ${step.buttons.map(btn => `
        <button class="btn ${btn.primary ? 'btn-primary' : 'btn-secondary'}" data-action="${btn.action}">
          ${btn.text}
        </button>
      `).join('')}
      ${showSkipUpload ? `
        <button class="btn btn-secondary" data-action="skip-upload" style="margin-top:8px;">
          Skip Upload \u2014 I already have data \u2192
        </button>
      ` : ''}
    </div>
    <div style="margin-top:16px;font-size:12px;color:#a8a29e;">
      Step ${stepNum} of ${totalSteps}
      ${step.id !== 'welcome' ? '<span style="margin-left:16px;cursor:pointer;text-decoration:underline;" id="tourModalSkip">Skip Tour</span>' : ''}
    </div>
  `;

  modal.classList.remove('hidden');
  modal.offsetHeight; // force reflow
  modal.classList.add('visible');

  // Add button listeners
  content.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'next') {
        state.tourStep++;
        modal.classList.remove('visible');
        modal.classList.add('hidden');
        renderTourStep();
      } else if (action === 'skip-upload') {
        // Skip past upload and mapping wait steps, go to summary tour
        modal.classList.remove('visible');
        modal.classList.add('hidden');
        // Advance past wait-for-upload and wait-for-mapping steps
        while (TOUR_STEPS[state.tourStep] &&
               (TOUR_STEPS[state.tourStep].type === 'wait-for-upload' ||
                TOUR_STEPS[state.tourStep].type === 'wait-for-mapping' ||
                TOUR_STEPS[state.tourStep].id === 'upload')) {
          state.tourStep++;
        }
        // Make sure summary view is showing
        document.getElementById('resultsSection').classList.remove('hidden');
        document.getElementById('uploadSection').classList.add('hidden');
        renderView('summary');
        setTimeout(() => renderTourStep(), 300);
      } else if (action === 'finish') {
        endTour();
      }
    });
  });

  // Skip listener
  document.getElementById('tourModalSkip')?.addEventListener('click', showSkipConfirmation);
}

// Show spotlight tour step
function showTourSpotlight(step, retryCount = 0) {
  document.getElementById('tourModal').classList.remove('visible');
  document.getElementById('tourModal').classList.add('hidden');
  const target = document.querySelector(step.target);

  if (!target || target.getBoundingClientRect().width === 0 || target.offsetParent === null) {
    if (retryCount < 25) {
      setTimeout(() => showTourSpotlight(step, retryCount + 1), 100);
      return;
    }
    console.warn('Tour target not found or not visible after retries:', step.target);
    state.tourStep++;
    renderTourStep();
    return;
  }

  const overlay = document.getElementById('tourOverlay');
  const spotlight = document.getElementById('tourSpotlight');
  const tooltip = document.getElementById('tourTooltip');
  const arrow = document.getElementById('tourTooltipArrow');

  overlay.classList.remove('hidden');
  spotlight.classList.add('hidden');
  tooltip.classList.remove('visible');
  tooltip.classList.add('hidden');

  if (step.clickRequired && step.clickAction !== 'select-card') {
    spotlight.classList.add('tour-spotlight-clickable');
    spotlight.onclick = () => handleSpotlightClick(step);
  } else {
    spotlight.classList.remove('tour-spotlight-clickable');
    spotlight.onclick = null;
  }

  document.getElementById('tourTooltipTitle').textContent = step.title.replace(/\s*[\u{1F300}-\u{1F9FF}]/gu, '');
  document.getElementById('tourTooltipContent').innerHTML = step.content;

  const stepNum = getDisplayStepNumber(state.tourStep);
  const totalSteps = getTourStepCount();
  document.getElementById('tourProgress').textContent = `Step ${stepNum} of ${totalSteps}`;

  const nextBtn = document.getElementById('tourNext');
  if (step.clickRequired) {
    nextBtn.style.display = 'none';
  } else {
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = 'Next →';
  }

  if (step.onShow === 'flip-first-card') {
    const firstCard = document.querySelector('.flip-card');
    if (firstCard && !firstCard.classList.contains('flipped')) {
      setTimeout(() => firstCard.classList.add('flipped'), 300);
    }
  }

  function positionElements() {
    const rect = target.getBoundingClientRect();
    const padding = 12;

    const maxHeight = window.innerHeight - 100;
    const spotlightHeight = Math.min(rect.height + padding * 2, maxHeight);

    spotlight.style.left = (rect.left - padding) + 'px';
    spotlight.style.top = (rect.top - padding) + 'px';
    spotlight.style.width = (rect.width + padding * 2) + 'px';
    spotlight.style.height = spotlightHeight + 'px';

    const clickSpacing = step.clickRequired ? 60 : 35;
    let tooltipTop, tooltipLeft;
    arrow.className = 'tour-tooltip-arrow';

    if (step.position === 'bottom') {
      tooltipTop = Math.min(rect.bottom, rect.top + spotlightHeight) + clickSpacing;
      tooltipLeft = rect.left + rect.width/2 - 180;
      arrow.classList.add('top');
    } else if (step.position === 'top') {
      tooltipTop = rect.top - 240 - (step.clickRequired ? 40 : 0);
      tooltipLeft = rect.left + rect.width/2 - 180;
      arrow.classList.add('bottom');
    } else if (step.position === 'left') {
      tooltipTop = rect.top + Math.min(rect.height, spotlightHeight)/2 - 120;
      tooltipLeft = rect.left - 420;
      arrow.classList.add('right');
    } else if (step.position === 'right') {
      tooltipTop = rect.top + Math.min(rect.height, spotlightHeight)/2 - 120;
      tooltipLeft = rect.right + clickSpacing;
      arrow.classList.add('left');
    }

    tooltipLeft = Math.max(20, Math.min(tooltipLeft, window.innerWidth - 380));
    tooltipTop = Math.max(20, Math.min(tooltipTop, window.innerHeight - 250));

    tooltip.style.left = tooltipLeft + 'px';
    tooltip.style.top = tooltipTop + 'px';

    spotlight.classList.remove('hidden');
    tooltip.classList.remove('hidden');
    tooltip.offsetHeight; // force reflow
    tooltip.classList.add('visible');
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(positionElements, 350);
}

// Handle spotlight click
function handleSpotlightClick(step) {
  if (step.clickAction === 'navigate-card-config') {
    document.getElementById('tourOverlay').classList.add('hidden');
    // Close the manage dropdown before navigating
    const manageDropdown = document.getElementById('manageDropdown');
    if (manageDropdown) manageDropdown.classList.remove('open');
    showCardConfigEditor();
    setTimeout(() => {
      state.tourStep++;
      renderTourStep();
    }, 500);
  } else if (step.clickAction === 'select-card') {
    // Allow user to select, then continue
    document.getElementById('tourOverlay').classList.add('hidden');
    const select = document.getElementById('configCardSelect');
    select.focus();
    // Listen for change
    const handler = () => {
      select.removeEventListener('change', handler);
      setTimeout(() => {
        state.tourStep++;
        renderTourStep();
      }, 300);
    };
    select.addEventListener('change', handler);
    // Also continue if they click elsewhere after a moment
    setTimeout(() => {
      select.removeEventListener('change', handler);
      if (state.tourActive && state.tourStep === TOUR_STEPS.findIndex(s => s.id === 'config-card-select')) {
        state.tourStep++;
        renderTourStep();
      }
    }, 5000);
  } else if (step.clickAction === 'navigate-back') {
    // Hide tour UI and let user interact with both buttons
    hideTourOverlay();

    // Listen for Back to Summary click to continue tour
    const backBtn = document.getElementById('backToSummary');
    const handler = () => {
      backBtn.removeEventListener('click', handler);
      setTimeout(() => {
        state.tourStep++;
        renderTourStep();
      }, 300);
    };
    backBtn.addEventListener('click', handler);
  } else if (step.clickAction === 'navigate-transactions') {
    document.getElementById('tourOverlay').classList.add('hidden');
    const tooltip = document.getElementById('tourTooltip');
    tooltip.classList.remove('visible');
    tooltip.classList.add('hidden');
    renderView('transactions');
    setTimeout(() => {
      state.tourStep++;
      renderTourStep();
    }, 200);
  }
}

// Hide tour overlay
function hideTourOverlay() {
  document.getElementById('tourOverlay').classList.add('hidden');
  document.getElementById('tourSpotlight').classList.add('hidden');
  const tooltip = document.getElementById('tourTooltip');
  tooltip.classList.remove('visible');
  tooltip.classList.add('hidden');
  // Clean up any dropdowns opened by the tour
  const manageDropdown = document.getElementById('manageDropdown');
  if (manageDropdown) manageDropdown.classList.remove('open');
}

// Hide all tour UI
function hideTourUI() {
  document.getElementById('tourOverlay').classList.add('hidden');
  document.getElementById('tourSpotlight').classList.add('hidden');
  const tooltip = document.getElementById('tourTooltip');
  tooltip.classList.remove('visible');
  tooltip.classList.add('hidden');
  const modal = document.getElementById('tourModal');
  modal.classList.remove('visible');
  modal.classList.add('hidden');
  // Clean up any dropdowns opened by the tour
  const manageDropdown = document.getElementById('manageDropdown');
  if (manageDropdown) manageDropdown.classList.remove('open');
}

// Show skip confirmation
function showSkipConfirmation() {
  document.getElementById('tourSkipConfirm').classList.remove('hidden');
}

// End the tour
function endTour() {
  state.tourActive = false;
  state.tourComplete = true;
  state.tourStep = 0;
  safeLocalStorageSet('ccTracker_tourComplete', true);
  localStorage.removeItem('ccTracker_tourStep');
  hideTourUI();
  document.getElementById('tourSkipConfirm').classList.add('hidden');

  // Show newsletter popup now that the tour is done (if not already shown this session)
  if (typeof showNewsletterPopup === 'function') {
    showNewsletterPopup(5000);
  }
}

// Continue tour after upload
function continueTourAfterUpload() {
  if (state.tourActive && TOUR_STEPS[state.tourStep]?.type === 'wait-for-upload') {
    state.tourStep++;
    // Check if next is wait-for-mapping
    if (TOUR_STEPS[state.tourStep]?.type === 'wait-for-mapping') {
      // Will be handled by card mapping completion
    } else {
      renderTourStep();
    }
  }
}

// Continue tour after card mapping
function continueTourAfterMapping() {
  if (state.tourActive && TOUR_STEPS[state.tourStep]?.type === 'wait-for-mapping') {
    state.tourStep++;
    renderTourStep();
  }
}


// Category Modal window hooks for Tour responsiveness
window.onCategoryModalOpen = function() {
  if (state.tourActive && TOUR_STEPS[state.tourStep]?.id === 'recategorize') {
    // Hide the current spotlight overlay first to prevent jarring transitions
    document.getElementById('tourOverlay').classList.add('hidden');
    // Advance to the modal step
    state.tourStep = TOUR_STEPS.findIndex(s => s.id === 'reclassify-modal');
    // Render the modal step after a short delay so the modal has time to animate open
    setTimeout(() => {
      renderTourStep();
    }, 400);
  }
};

window.onCategoryModalClose = function() {
  if (state.tourActive && TOUR_STEPS[state.tourStep]?.id === 'reclassify-modal') {
    document.getElementById('tourOverlay').classList.add('hidden');
    // Advance to the manage-nav step
    state.tourStep = TOUR_STEPS.findIndex(s => s.id === 'manage-nav');
    setTimeout(() => {
      renderTourStep();
    }, 300);
  }
};


// =============================================================================
// TUTORIAL INITIALIZATION
// =============================================================================

/**
 * Initialize the tutorial system. Call this from the main DOMContentLoaded handler.
 * Sets up help/tour event listeners and auto-starts the tour for first-time users.
 */
function initTutorial() {
  // Help modal event listeners
  document.getElementById('helpBtn').addEventListener('click', () => showHelp());
  document.getElementById('helpBtnCardConfig').addEventListener('click', () => showHelp('cardConfig'));
  document.getElementById('closeHelpModal').addEventListener('click', () => {
    document.getElementById('helpModal').classList.add('hidden');
  });
  document.getElementById('helpModal').addEventListener('click', () => {
    document.getElementById('helpModal').classList.add('hidden');
  });

  // Tour event listeners
  document.getElementById('startTourBtn')?.addEventListener('click', () => {
    startTour(true);
  });
  document.getElementById('tourSkip').addEventListener('click', showSkipConfirmation);
  document.getElementById('tourNext').addEventListener('click', () => {
    // If leaving reclassify-modal, close the modal
    if (state.tourActive && TOUR_STEPS[state.tourStep]?.id === 'reclassify-modal') {
      const modal = document.getElementById('creditModal');
      if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    }
    state.tourStep++;
    renderTourStep();
  });
  document.getElementById('tourSkipCancel').addEventListener('click', () => {
    document.getElementById('tourSkipConfirm').classList.add('hidden');
  });
  document.getElementById('tourSkipConfirmBtn').addEventListener('click', () => {
    endTour();
  });

  // Tour initialization
  // Check if this is a first-time user OR if tour was in progress
  if (!state.tourComplete) {
    if (state.savedTransactions.length === 0) {
      // First time user with no data - start from beginning
      startTour();
    } else if (state.tourStep > 0 && state.tourStep < TOUR_STEPS.length) {
      // Tour was in progress - resume
      state.tourActive = true;
      // If we're past the upload/mapping steps, continue the tour
      const currentStep = TOUR_STEPS[state.tourStep];
      if (currentStep && currentStep.phase !== 'setup') {
        renderTourStep();
      }
    }
  }
}
