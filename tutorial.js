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
        icon: '\u{1F4CA}',
        title: 'Card Performance Cards',
        text: 'Each card shows net value, annual fee, and a performance tag on the front. <strong>Click any card to flip it</strong> and see the full breakdown: spend, points earned, credits, and net value.'
      },
      {
        icon: '\u{1F4B0}',
        title: 'Net Value Header',
        text: 'Your overall Net Value stays visible at the top of every page. Click the <strong>+</strong> button to expand a breakdown: Points Value + Credits \u2212 Annual Fees = Net Value. It stays open until you close it.'
      },
      {
        icon: '\u{1F4C5}',
        title: 'Year Filter',
        text: 'Filter results by year using the dropdown. "All Years" shows combined totals with annual fees counted once per card.'
      },
      {
        icon: '\u{1F4C5}',
        title: 'Card Year (CY) Toggle',
        text: 'Use the <strong>CY</strong> toggle on each card to switch between Calendar Year (Jan\u2013Dec) and Card Year (anniversary date). Card Year is more useful when deciding whether to keep a card at renewal, since some credits and fees reset on the anniversary.',
        pro: true
      }
    ]
  },
  transactions: {
    title: 'Transactions Page Help',
    sections: [
      {
        icon: '\u{1F9E9}',
        title: 'How Classification Works',
        text: 'The app automatically categorizes each transaction (e.g., restaurants \u2192 Dining, CVS \u2192 Drugstore) using the merchant name, your bank\'s category label, and built-in rules. This determines which point multiplier applies for each card.'
      },
      {
        icon: '\u{1F50D}',
        title: 'Filters',
        text: 'Filter by year, month, card, or category. Use "Credits" to see statement credits, or <strong>"Needs Review"</strong> to see transactions the app couldn\'t confidently classify.'
      },
      {
        icon: '\u{1F4DD}',
        title: 'Reason Column',
        text: 'Shows why each transaction was classified the way it was. "User-defined rule" means you (or a rule you created) set it manually.'
      },
      {
        icon: '\u21A9\uFE0F',
        title: 'Refunds & Credits',
        text: 'Refunds subtract points (shown in red). Statement credits also subtract points but still count toward your ROI.'
      },
      {
        icon: '\u{1F3F7}\uFE0F',
        title: 'Recategorize Transactions',
        text: '<strong>Click any category badge</strong> to change how a transaction is classified. This affects point calculations. You can also set rules to apply to all similar merchants.',
        pro: true
      },
      {
        icon: '\u26A0\uFE0F',
        title: 'Needs Review',
        text: 'Transactions flagged with \u26A0\uFE0F have low confidence. Click the category badge to correct them \u2014 this improves accuracy and creates rules for similar transactions.',
        pro: true
      }
    ]
  },
  cardConfig: {
    title: 'Card Config Help',
    sections: [
      {
        icon: '\u{1F4CB}',
        title: 'Quarterly Categories',
        text: '<strong>Important:</strong> For Chase Freedom Flex and US Bank Cash+, select your activated bonus categories for each quarter. This determines which transactions get 5% back.'
      },
      {
        icon: '\u{1F4B3}',
        title: 'Statement Credits',
        text: 'Some credits (like streaming or airline incidentals) are auto-detected from your transactions. Others (like Uber Cash or Amex Offers) don\'t appear in transaction data \u2014 those are marked \u26A1 and you track them manually by clicking the month buttons. Toggle any credit on/off to include or exclude it from ROI.'
      },
      {
        icon: '\u{1F4B0}',
        title: 'Point Values',
        text: 'How much each point is worth when you redeem it (in cents). For example, at 2.0\u00A2 per point, 1,000 points = $20. Cash back users might set 1.0\u00A2, travel redeemers might set 1.5\u20132.0\u00A2. This affects all value calculations.'
      },
      {
        icon: '\u{1F4C5}',
        title: 'Year Selection',
        text: 'Use the year dropdown to configure categories and credits for different years. Each year can have different quarterly selections.'
      }
    ]
  },
  cardscenarios: {
    title: 'Card Scenarios Help',
    sections: [
      {
        icon: '\u{1F52E}',
        title: 'What Card Scenarios Does',
        text: 'Model the financial impact of changing your wallet. Choose <strong>Add</strong>, <strong>Remove</strong>, or <strong>Swap</strong> a card, pick a year of spending data, and the engine reroutes every transaction to show the net effect on points, credits, and annual fees.'
      },
      {
        icon: '\u{1F4B3}',
        title: 'How Spending Is Rerouted',
        text: 'When you add a card, the engine checks each transaction: if the new card earns more than the card you actually used, that spending shifts to the new card. When you remove a card, its spending shifts to whichever remaining card earns the most for each category.'
      },
      {
        icon: '\u{1F4CA}',
        title: 'Result Breakdown',
        text: 'The result shows: Credits gained or lost, Point value change from rerouted spending, Annual fee of the new or removed card, and the combined Estimated Net Impact. You can expand each section to see the per-category detail.'
      },
      {
        icon: '\u26A0\uFE0F',
        title: 'Key Assumptions',
        text: 'Scenarios assume your spending patterns stay the same and that shiftable spending goes to the best-earning card. Bilt scenarios account for rent points and Bilt Cash redemption. Results are estimates \u2014 actual value depends on real-world card usage habits.'
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

  const isPro = window.TIER_CONFIG === 'pro';
  const sections = help.sections.filter(s => !s.pro || isPro);

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
  // Phase 1: Setup (modal-based) - steps 0-3
  {
    type: 'modal',
    phase: 'setup',
    id: 'welcome',
    title: 'Welcome to Credit Card ValueTracker! \u{1F44B}',
    content: `
      <p>Upload transactions \u2192 the app classifies your spending \u2192 you see your <strong>net value per card</strong> (points + credits \u2212 annual fees).</p>
      <p style="margin-top:12px;font-size:12px;color:#78716c;">\u{1F512} Your data never leaves your device. All calculations happen locally in your browser.</p>
    `,
    buttons: [{ text: 'Get Started \u2192', action: 'next', primary: true }]
  },
  {
    type: 'modal',
    phase: 'setup',
    id: 'upload',
    title: 'Step 1: Upload Your Transactions \u{1F4C4}',
    content: `
      <p style="text-align:left;">First, you'll need to upload a CSV file of your transactions. We support exports from most credit card companies and money management apps.</p>
      <p style="text-align:left;margin-top:12px;">After you click Continue, drag & drop your CSV or click to browse.</p>
    `,
    buttons: [{ text: 'Continue \u2192', action: 'next', primary: true }],
    onNext: () => { /* Will show upload section */ }
  },

  {
    type: 'wait-for-upload',
    phase: 'setup',
    id: 'wait-upload'
  },
  {
    type: 'wait-for-mapping',
    phase: 'setup',
    id: 'wait-mapping'
  },

  // Phase 2: Summary Tour (spotlight-based)
  // Net Value in the top bar — always visible across all pages
  {
    type: 'spotlight',
    phase: 'summary-tour',
    id: 'net-value-header',
    target: '.shell-net-block',
    title: 'Your Net Value',
    content: 'This is your overall <strong>Net Value</strong> across all cards \u2014 it stays visible at the top of every page so you always know where you stand. Net Value = Points Value + Credits \u2212 Annual Fees.',
    position: 'bottom',
    clickRequired: false
  },
  // The + button that opens the sticky details strip
  {
    type: 'spotlight',
    phase: 'summary-tour',
    id: 'net-value-expand',
    target: '#shellExpandBtn',
    title: 'Expand for Details',
    content: 'Click the <strong>+</strong> button to open a breakdown showing how your Net Value is calculated: Points Value + Credits \u2212 Annual Fees = Net Value. It stays open until you close it.',
    position: 'bottom',
    clickRequired: false
  },
  // Flippable card front — high-level summary
  {
    type: 'spotlight',
    phase: 'summary-tour',
    id: 'card-front',
    target: '.flip-card',
    title: 'Card Performance Cards',
    content: 'Each card shows a high-level summary: the card\'s <strong>net value</strong>, <strong>annual fee</strong>, and performance tags (MVP, Workhorse, or Deadweight). Cards with annual fees also have a <strong>CY</strong> toggle to switch between calendar year and card anniversary year \u2014 useful when deciding whether to keep a card at renewal.',
    position: 'right',
    clickRequired: false
  },
  // Flippable card back — detailed data
  {
    type: 'spotlight',
    phase: 'summary-tour',
    id: 'card-back',
    target: '.flip-card',
    title: 'Flip for Full Breakdown',
    content: 'Click any card to <strong>flip it over</strong> and see the full breakdown: total spend, points earned, points value, credits used (with a dropdown for individual credits), annual fee, and net value. This is where all the detailed performance data lives.',
    position: 'right',
    clickRequired: false,
    onShow: 'flip-first-card'
  },
  // Manage menu in the condensed nav bar — click to open Card Config
  {
    type: 'spotlight',
    phase: 'summary-tour',
    id: 'manage-menu',
    target: '#manageBtn',
    title: 'Manage Menu',
    content: 'The <strong>Manage</strong> button is your hub for configuration:<br><br>\u2022 <strong>Card Mapping</strong> \u2014 match account numbers to reward cards<br>\u2022 <strong>Card Config</strong> \u2014 point values, credits, quarterly categories<br>\u2022 <strong>Manage Data</strong> \u2014 export, clear, or reset your data<br><br>Click here and we\'ll jump into <strong>Card Config</strong> so you can see how it works.',
    position: 'bottom',
    clickRequired: true,
    clickAction: 'navigate-card-config'
  },

  // Phase 3: Card Config Tour
  {
    type: 'spotlight',
    phase: 'card-config-tour',
    id: 'config-card-select',
    target: '#configCardSelect',
    title: 'Select a Card \u{1F3AF}',
    content: 'Choose any card you\'re tracking to configure its settings. Each card has its own point values and credit options.',
    position: 'bottom',
    clickRequired: true,
    clickAction: 'select-card'
  },
  {
    type: 'spotlight',
    phase: 'card-config-tour',
    id: 'config-point-value',
    target: '#configPointValue',
    title: 'Point Valuation \u{1F4B0}',
    content: 'This value represents how much each point or mile is worth when redeemed. It\u2019s based on commonly accepted valuations for your card\u2019s rewards program and is used to calculate the dollar value of the points you earn.<br><br><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">PRO</span> Pro users will be able to edit point valuations to match their personal redemption strategy\u2014whether you value points at 1.0\u00A2 for cash back or 2.0\u00A2+ for premium travel redemptions.',
    position: 'right',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'card-config-tour',
    id: 'config-credits-section',
    target: '#configCreditsSection',
    title: 'Statement Credits \u{1F4B3}',
    content: 'Your statement credits are <strong>auto-detected</strong> from transactions (like streaming or airline incidentals). Others marked \u26A1 (like Uber Cash) require manual tracking.<br><br><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">PRO</span> Toggle individual credits ON/OFF to customize your ROI calculation.',
    position: 'top',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'card-config-tour',
    id: 'config-manual-credits',
    target: '.manual-credit-row',
    title: 'Manual Credits \u26A1',
    content: 'Credits marked with \u26A1 aren\'t auto-detected (like Uber Cash). Click each <strong>month button</strong> when you\'ve used it. The year dropdown above determines which year you\'re tracking.',
    position: 'top',
    clickRequired: false,
    conditional: 'hasManualCredits'
  },
  {
    type: 'spotlight',
    phase: 'card-config-tour',
    id: 'config-quarterly',
    target: '#quarterlySection',
    title: 'Quarterly Bonus Categories \u{1F4C5}',
    content: 'Quarterly bonus categories are automatically applied based on Chase\'s rotating calendar. Check here to see which categories earn bonus points each quarter.',
    position: 'top',
    clickRequired: false,
    conditional: 'hasQuarterlyCategories'
  },
  {
    type: 'spotlight',
    phase: 'card-config-tour',
    id: 'back-to-results',
    target: '#cardConfigButtons',
    title: 'Save & Continue',
    content: 'If you made any changes, click <strong>Save Changes</strong> first. Then click <strong>\u2190 Back to Summary</strong> to continue.',
    position: 'right',
    clickRequired: false,
    onShow: 'setup-back-listener'
  },

  // Phase 4: Transactions Tour
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'transactions-tab',
    target: '.tab[data-view="transactions"]',
    title: 'All Transactions \u{1F4CB}',
    content: 'Click here to see every transaction and how it was categorized.',
    position: 'bottom',
    clickRequired: true,
    clickAction: 'navigate-transactions'
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'classification-explanation',
    target: '#transactionsBody .badge',
    title: 'How Transactions Are Classified \u{1F9E9}',
    content: 'The app automatically categorizes each transaction (e.g., restaurants \u2192 Dining, CVS \u2192 Drugstore) to calculate the right point multiplier for each card. It uses the merchant name, your bank\'s category label, and built-in rules to make its best guess. When it\'s not confident, it flags the transaction for your review.',
    position: 'right',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'category-badges',
    target: '#transactionsBody .badge',
    title: 'Category Badge Colors \u{1F3F7}\uFE0F',
    content: `
      These colors compare across your cards:<br>
      <span style="background:#dcfce7;padding:2px 6px;border-radius:4px;">Green</span> = Best card in your wallet for that purchase<br>
      <span style="background:#fef9c3;padding:2px 6px;border-radius:4px;">Yellow</span> = Good, but a better option exists<br>
      <span style="background:#fee2e2;padding:2px 6px;border-radius:4px;">Red</span> = Another card would have earned more<br><br>
      This helps you optimize which card to use going forward.
    `,
    position: 'right',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'recategorize',
    target: '#transactionsBody .badge',
    title: 'Recategorize Transactions \u{1F3F7}\uFE0F',
    content: '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">PRO</span> You\'ll be able to recategorize spending categories and credits by clicking any badge. You can also add rules for specific merchants so they\'re always classified correctly.',
    position: 'right',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'filter-bar',
    target: '#filterRow',
    title: 'Filter Your Transactions \u{1F50D}',
    content: 'Filter by year, month, card, or category to find specific transactions. Great for reviewing spending patterns.',
    position: 'bottom',
    clickRequired: false
  },
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'needs-review',
    target: '#needsReviewFilter',
    title: 'Needs Review \u26A0\uFE0F',
    content: 'Transactions we couldn\'t confidently categorize appear here. Review them to improve accuracy \u2014 look for the \u26A0\uFE0F icon.<br><br><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">PRO</span> Creating rules and recategorizing transactions to improve accuracy is a Pro feature.',
    position: 'bottom',
    clickRequired: false
  },

  // Phase 4b: Card Scenarios spotlight (after transactions, before nav bar items)
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'card-scenarios',
    target: '#cardScenariosTab',
    title: 'Card Scenarios',
    content: '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">PRO</span> Card Scenarios lets you model what happens if you <strong>add</strong>, <strong>remove</strong>, or <strong>swap</strong> a card in your wallet \u2014 using your actual spending data. It reroutes every transaction to show the real impact on points, credits, and net value. Powerful for deciding whether a new card is worth it or if it\'s time to cancel one.',
    position: 'bottom',
    clickRequired: false
  },

  // Phase 4c: Nav bar items — Manage and New Upload
  {
    type: 'spotlight',
    phase: 'transactions-tour',
    id: 'manage-nav',
    target: '#manageBtn',
    title: 'Manage Your Data',
    content: 'Remember: <strong>Manage</strong> is where you\'ll find Card Mapping, Card Config, and data management (export, clear, or reset). You can also upload new transaction files anytime using <strong>New Upload</strong> to the right \u2014 duplicates are automatically removed.',
    position: 'bottom',
    clickRequired: false
  },

  // Phase 5: Complete
  {
    type: 'modal',
    phase: 'complete',
    id: 'complete',
    title: 'You\'re All Set! \u{1F389}',
    content: `
      <p><strong>What to do next:</strong></p>
      <p style="margin:12px 0 4px;text-align:left;">Head to the <strong>Summary</strong> page and flip any card to see its net value \u2014 how much it earns you (or costs you) after the annual fee.</p>
      <div style="margin-top:16px;padding:12px 14px;background:#fef3c7;border-radius:8px;text-align:left;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#92400e;">PRO</p>
        <ul style="margin:0;padding-left:18px;line-height:1.8;font-size:13px;color:#78716c;">
          <li>Fine-tune your <strong>point valuations</strong> and toggle <strong>credits</strong> on/off</li>
          <li>Use <strong>Card Scenarios</strong> to see the net effect of adding, removing, or swapping a card</li>
        </ul>
      </div>
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
  const step = TOUR_STEPS[state.tourStep];
  if (!step) {
    endTour();
    return;
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

  // Add button listeners
  content.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'next') {
        state.tourStep++;
        modal.classList.add('hidden');
        renderTourStep();
      } else if (action === 'skip-upload') {
        // Skip past upload and mapping wait steps, go to summary tour
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
  document.getElementById('tourModal').classList.add('hidden');

  const target = document.querySelector(step.target);
  if (!target) {
    // Element may not be rendered yet (e.g. after navigating to transactions view).
    // Retry up to 5 times (1.5s total) before skipping.
    if (retryCount < 5) {
      setTimeout(() => showTourSpotlight(step, retryCount + 1), 300);
      return;
    }
    console.warn('Tour target not found after retries:', step.target);
    state.tourStep++;
    renderTourStep();
    return;
  }

  // Also retry if the target exists but isn't visible yet (zero dimensions)
  const targetRect = target.getBoundingClientRect();
  if (targetRect.width === 0 && targetRect.height === 0) {
    if (retryCount < 5) {
      setTimeout(() => showTourSpotlight(step, retryCount + 1), 300);
      return;
    }
    console.warn('Tour target has zero dimensions after retries:', step.target);
    state.tourStep++;
    renderTourStep();
    return;
  }

  const overlay = document.getElementById('tourOverlay');
  const spotlight = document.getElementById('tourSpotlight');
  const tooltip = document.getElementById('tourTooltip');
  const arrow = document.getElementById('tourTooltipArrow');

  // Show overlay immediately but hide spotlight/tooltip until positioned
  // (prevents flash at old position during scroll)
  overlay.classList.remove('hidden');
  spotlight.classList.add('hidden');
  tooltip.classList.add('hidden');

  // Make spotlight clickable if required (set this before positioning)
  // Exception: for 'select-card' action, keep spotlight non-blocking so users can click the dropdown
  if (step.clickRequired && step.clickAction !== 'select-card') {
    spotlight.classList.add('tour-spotlight-clickable');
    spotlight.onclick = () => handleSpotlightClick(step);
  } else {
    spotlight.classList.remove('tour-spotlight-clickable');
    spotlight.onclick = null;

    // For select-card, set up the change listener immediately since clicks pass through
    if (step.clickAction === 'select-card') {
      const select = document.getElementById('configCardSelect');
      if (select) {
        const handler = () => {
          select.removeEventListener('change', handler);
          setTimeout(() => {
            state.tourStep++;
            renderTourStep();
          }, 300);
        };
        select.addEventListener('change', handler);
        // Auto-advance after timeout if user doesn't interact
        setTimeout(() => {
          select.removeEventListener('change', handler);
          if (state.tourActive && TOUR_STEPS[state.tourStep]?.clickAction === 'select-card') {
            state.tourStep++;
            renderTourStep();
          }
        }, 5000);
      }
    }
  }

  // Set content first
  document.getElementById('tourTooltipTitle').textContent = step.title.replace(/\s*[\u{1F300}-\u{1F9FF}]/gu, '');
  document.getElementById('tourTooltipContent').innerHTML = step.content;

  const stepNum = getDisplayStepNumber(state.tourStep);
  const totalSteps = getTourStepCount();
  document.getElementById('tourProgress').textContent = `Step ${stepNum} of ${totalSteps}`;

  // Update next button visibility
  const nextBtn = document.getElementById('tourNext');
  if (step.clickRequired) {
    nextBtn.style.display = 'none';
  } else {
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = 'Next \u2192';
  }

  // Handle onShow actions
  if (step.onShow === 'setup-back-listener') {
    // Hide Next button - we'll continue when user clicks Back to Summary
    nextBtn.style.display = 'none';

    // Set up listener on Back to Summary button
    const backBtn = document.getElementById('backToSummary');
    const backHandler = () => {
      backBtn.removeEventListener('click', backHandler);
      setTimeout(() => {
        state.tourStep++;
        renderTourStep();
      }, 300);
    };
    backBtn.addEventListener('click', backHandler);
  } else if (step.onShow === 'flip-first-card') {
    // Flip the first card to show the back side during this step
    const firstCard = document.querySelector('.flip-card');
    if (firstCard && !firstCard.classList.contains('flipped')) {
      setTimeout(() => firstCard.classList.add('flipped'), 500);
    }
  }

  // Function to position spotlight and tooltip, then reveal them
  function positionElements() {
    const rect = target.getBoundingClientRect();
    const padding = 8;

    // Limit spotlight height to viewport if element is too tall
    const maxHeight = window.innerHeight - 100;
    const spotlightHeight = Math.min(rect.height + padding * 2, maxHeight);

    spotlight.style.left = (rect.left - padding) + 'px';
    spotlight.style.top = (rect.top - padding) + 'px';
    spotlight.style.width = (rect.width + padding * 2) + 'px';
    spotlight.style.height = spotlightHeight + 'px';

    // Position tooltip - add extra spacing for click-required steps
    // to avoid covering the button and the "Click here" badge
    const clickSpacing = step.clickRequired ? 50 : 20;
    let tooltipTop, tooltipLeft;
    arrow.className = 'tour-tooltip-arrow';

    if (step.position === 'bottom') {
      tooltipTop = Math.min(rect.bottom, rect.top + spotlightHeight) + clickSpacing;
      tooltipLeft = rect.left + rect.width/2 - 180;
      arrow.classList.add('top');
    } else if (step.position === 'top') {
      tooltipTop = rect.top - 220 - (step.clickRequired ? 30 : 0);
      tooltipLeft = rect.left + rect.width/2 - 180;
      arrow.classList.add('bottom');
    } else if (step.position === 'left') {
      tooltipTop = rect.top + Math.min(rect.height, spotlightHeight)/2 - 100;
      tooltipLeft = rect.left - 400;
      arrow.classList.add('right');
    } else if (step.position === 'right') {
      tooltipTop = rect.top + Math.min(rect.height, spotlightHeight)/2 - 100;
      tooltipLeft = rect.right + clickSpacing;
      arrow.classList.add('left');
    }

    // Keep tooltip in viewport
    tooltipLeft = Math.max(20, Math.min(tooltipLeft, window.innerWidth - 380));
    tooltipTop = Math.max(20, Math.min(tooltipTop, window.innerHeight - 250));

    tooltip.style.left = tooltipLeft + 'px';
    tooltip.style.top = tooltipTop + 'px';

    // Now reveal spotlight and tooltip at the correct position
    spotlight.classList.remove('hidden');
    tooltip.classList.remove('hidden');
  }

  // Scroll target into view first, then position and reveal
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Position after scroll completes
  setTimeout(positionElements, 400);
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
    renderView('transactions');
    setTimeout(() => {
      state.tourStep++;
      renderTourStep();
    }, 600);
  }
}

// Hide tour overlay
function hideTourOverlay() {
  document.getElementById('tourOverlay').classList.add('hidden');
  document.getElementById('tourSpotlight').classList.add('hidden');
  document.getElementById('tourTooltip').classList.add('hidden');
  // Clean up any dropdowns opened by the tour
  const manageDropdown = document.getElementById('manageDropdown');
  if (manageDropdown) manageDropdown.classList.remove('open');
}

// Hide all tour UI
function hideTourUI() {
  document.getElementById('tourOverlay').classList.add('hidden');
  document.getElementById('tourSpotlight').classList.add('hidden');
  document.getElementById('tourTooltip').classList.add('hidden');
  document.getElementById('tourModal').classList.add('hidden');
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
  document.getElementById('tourSkip').addEventListener('click', showSkipConfirmation);
  document.getElementById('tourNext').addEventListener('click', () => {
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
