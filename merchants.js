window.CardTracker = window.CardTracker || {};

// =============================================================================
// KNOWN MERCHANTS (Rules-based classification)
// =============================================================================
window.CardTracker.merchants = {
  // Drugstores
  'cvs': 'drugstore', 'walgreens': 'drugstore', 'rite aid': 'drugstore', 'duane reade': 'drugstore',

  // Medical
  'premier dental': 'medical', 'hss ': 'medical', 'myhss': 'medical',
  'mount sinai': 'medical', 'bjc healthcare': 'medical',

  // Insurance (confidence 100)
  'state farm': 'insurance', 'geico': 'insurance', 'allstate': 'insurance', 'progressive': 'insurance',
  'liberty mutual': 'insurance', 'usaa ins': 'insurance', 'farmers ins': 'insurance', 'nationwide ins': 'insurance',
  'travelers ins': 'insurance', 'cigna': 'insurance', 'anthem': 'insurance', 'aetna': 'insurance',
  'unitedhealth': 'insurance', 'connecticare': 'insurance', 'bcbs': 'insurance', 'blue cross': 'insurance',
  'blue shield': 'insurance', 'humana': 'insurance', 'kaiser': 'insurance', 'metlife ins': 'insurance',
  'prudential ins': 'insurance',

  // Food delivery
  // Note: 'uber eats' and 'ubereats' must be listed here (before 'uber ') to ensure food delivery is dining
  'doordash': 'dining', 'uber eats': 'dining', 'ubereats': 'dining', 'grubhub': 'dining', 'seamless': 'dining', 'caviar': 'dining',
  'postmates': 'dining', 'slice': 'dining',

  // Fast food & chains
  'chipotle': 'dining', 'starbucks': 'dining', 'dunkin': 'dining', 'mcdonald': 'dining',
  'sweetgreen': 'dining', 'panera': 'dining', 'shake shack': 'dining', 'chick-fil-a': 'dining',
  'wendys': 'dining', 'burger king': 'dining', 'taco bell': 'dining', 'subway': 'dining',
  'five guys': 'dining', 'popeyes': 'dining', 'kfc': 'dining', 'panda express': 'dining',
  'in-n-out': 'dining', 'whataburger': 'dining', 'sonic drive': 'dining', 'arbys': 'dining',
  'johnny rockets': 'dining', 'fat tuesday': 'dining', 'cava': 'dining', 'dig inn': 'dining',
  'just salad': 'dining', 'chopt': 'dining', 'dos toros': 'dining', 'halal guys': 'dining',
  'joes pizza': 'dining', "joe's pizza": 'dining', 'levain': 'dining', 'magnolia bakery': 'dining',
  'ess-a-bagel': 'dining', 'pick a bagel': 'dining', 'gregorys coffee': 'dining', 'bluestone lane': 'dining',
  'le pain quotidien': 'dining', 'pret a manger': 'dining', 'au bon pain': 'dining',

  // Additional dining (high confidence)
  '9th ave saloon': 'dining', 'auntie anne': 'dining', 'balthazar': 'dining', 'birch coffee': 'dining',
  'bonannos': 'dining', 'bostwick': 'dining', 'broad nosh': 'dining', 'cava ': 'dining',
  'ddbr': 'dining', 'dominies': 'dining', 'elephent ear': 'dining', 'giardino': 'dining',
  'hey tea': 'dining', 'hibino': 'dining', 'imasa': 'dining', 'innout': 'dining',
  'jaspers': 'dining', 'jongro': 'dining', 'juice generation': 'dining', 'juicegeneration': 'dining',
  'kazunori': 'dining', 'master panda': 'dining', 'naisnow': 'dining', 'nook express': 'dining',
  'partea': 'dining', 'rise bar': 'dining', 'scalino': 'dining', 'snack chicha': 'dining',
  'sweetleaf': 'dining', 'taco mahal': 'dining', 'too good to go': 'dining', 'toribro': 'dining',
  'turntable': 'dining', 'uncle rays': 'dining', 'white noise coffee': 'dining', 'zaruma': 'dining',
  'zoob zib': 'dining', 'manhatto': 'dining',

  // Dining keywords (high confidence) - removed ambiguous: bar, kitchen, bowl
  'restaurant': 'dining', 'cafe': 'dining', 'grill': 'dining', 'pizza': 'dining', 'sushi': 'dining',
  'noodle': 'dining', 'burger': 'dining', 'bagel': 'dining', 'espresso': 'dining', 'coffee house': 'dining',
  'buffet': 'dining', 'tacos': 'dining', 'taqueria': 'dining', 'pub ': 'dining', ' pub': 'dining',
  'tavern': 'dining', 'bistro': 'dining', 'diner': 'dining', 'bakery': 'dining',
  'brewing': 'dining', 'brewery': 'dining', 'eatery': 'dining', 'steakhouse': 'dining',
  'seafood': 'dining', 'bbq': 'dining', 'barbecue': 'dining', 'ramen': 'dining', 'pho ': 'dining',
  'thai ': 'dining', ' thai': 'dining', 'indian ': 'dining', ' indian': 'dining',
  'mexican ': 'dining', ' mexican': 'dining', 'italian ': 'dining', ' italian': 'dining',
  'chinese ': 'dining', ' chinese': 'dining', 'japanese ': 'dining', ' japanese': 'dining',
  'korean ': 'dining', ' korean': 'dining', 'vietnamese': 'dining',
  'wings': 'dining', 'deli': 'dining', 'sandwich': 'dining', 'salad bar': 'dining', 'poke': 'dining',
  'maman': 'dining', 'botaniste': 'dining', 'trattoria': 'dining', 'osteria': 'dining', 'cantina': 'dining',
  'brasserie': 'dining', 'chophouse': 'dining', 'pizzeria': 'dining', 'cafe ': 'dining', ' cafe': 'dining',
  ' bar & ': 'dining', ' bar and ': 'dining', 'wine bar': 'dining', 'cocktail': 'dining',

  // Amazon
  'amazon': 'amazon', 'amzn': 'amazon', 'whole foods': 'whole-foods', 'amazon fresh': 'amazon',

  // Online Grocery (for CSP 3x) - excludes Target, Walmart, wholesale clubs per TPG article
  'instacart': 'online-grocery', 'freshdirect': 'online-grocery', 'peapod': 'online-grocery',
  'shipt': 'online-grocery', 'thrive market': 'online-grocery', 'hungryroot': 'online-grocery',
  'imperfect foods': 'online-grocery', 'misfits market': 'online-grocery', 'gopuff': 'online-grocery',

  // Gas
  'shell': 'gas', 'exxon': 'gas', 'mobil ': 'gas', 'chevron': 'gas', 'bp ': 'gas',
  'speedway': 'gas', 'wawa': 'gas', 'sunoco': 'gas', 'citgo': 'gas', 'valero': 'gas',
  'marathon gas': 'gas', 'phillips 66': 'gas', 'circle k': 'gas', 'sheetz': 'gas',
  'quiktrip': 'gas', 'qt ': 'gas', 'holiday station': 'gas',

  // Car Rental
  'zipcar': 'car-rental',

  // Transit & Rideshare
  // IMPORTANT: Uber patterns must be checked carefully - uber eats is dining, uber ride is transit
  // 'uber eats' is listed above in Food delivery section and will be matched first
  'lyft': 'lyft', 'uber trip': 'transit', 'ubertrip': 'transit', 'uber ride': 'transit',
  'uber*': 'transit', 'uber': 'transit', // 'uber' must come after 'uber eats' in the iteration
  'mta': 'transit', 'metro': 'transit', 'bart': 'transit', 'amtrak': 'transit', 'nationalrai': 'transit',
  'citi bike': 'transit', 'citibike': 'transit', 'lime scooter': 'transit', 'lime ride': 'transit',
  'bird ride': 'transit', 'revel': 'transit', 'via ': 'transit', 'nj transit': 'transit',
  'path train': 'transit', 'lirr': 'transit', 'metro north': 'transit',
  'desert cab': 'transit', 'omny': 'transit',

  // Airlines (ultra-safe, confidence: 100)
  'delta': 'flights-direct', 'delta air': 'flights-direct', 'delta airlines': 'flights-direct',
  'united': 'flights-direct', 'united air': 'flights-direct', 'united airlines': 'flights-direct',
  'american air': 'flights-direct', 'american airlines': 'flights-direct',
  'southwest': 'flights-direct', 'southwest air': 'flights-direct', 'southwes': 'flights-direct',
  'jetblue': 'flights-direct', 'jet blue': 'flights-direct',
  'alaska air': 'flights-direct', 'alaska airlines': 'flights-direct',
  'spirit air': 'flights-direct', 'spirit airlines': 'flights-direct',
  'frontier air': 'flights-direct', 'frontier airlines': 'flights-direct',
  'hawaiian air': 'flights-direct', 'hawaiian airlines': 'flights-direct',
  'allegiant': 'flights-direct', 'allegiant air': 'flights-direct',

  // Hotels (ultra-safe, confidence: 100)
  'marriott': 'hotels-direct', 'hilton': 'hotels-direct', 'hyatt': 'hotels-direct',
  'ihg': 'hotels-direct', 'intercontinental': 'hotels-direct',
  'wyndham': 'hotels-direct', 'best western': 'hotels-direct', 'radisson': 'hotels-direct',
  'choice hotels': 'hotels-direct', 'sheraton': 'hotels-direct', 'westin': 'hotels-direct',
  'ritz carlton': 'hotels-direct', 'ritz-carlton': 'hotels-direct', 'four seasons': 'hotels-direct',
  'renaissance hotel': 'hotels-direct',
  // Additional hotels
  'airbnb': 'hotels-direct', 'vrbo': 'hotels-direct',
  'flamingo hotel': 'hotels-direct', 'mgm': 'hotels-direct', 'caesars': 'hotels-direct',
  'holiday inn': 'hotels-direct', 'hampton inn': 'hotels-direct', 'courtyard': 'hotels-direct',
  'fairfield inn': 'hotels-direct', 'omni': 'hotels-direct', 'park lane hotel': 'hotels-direct',
  'residence inn': 'hotels-direct', 'sonesta': 'hotels-direct',

  // OTAs
  'expedia': 'travel-ota', 'booking.com': 'travel-ota', 'hotels.com': 'travel-ota', 'priceline': 'travel-ota',
  'kayak': 'travel-ota', 'orbitz': 'travel-ota', 'travelocity': 'travel-ota', 'hotwire': 'travel-ota',

  // Travel portals - expanded patterns to catch more Chase Travel variations
  // Note: Patterns must match NORMALIZED text (asterisks/special chars removed)
  // "CL* CHASE TRAVEL" normalizes to "cl chase travel", "CL*CHASE" normalizes to "clchase"
  'chase travel': 'chase-travel', 'cl chase': 'chase-travel', 'clchase': 'chase-travel',
  'chasetravel': 'chase-travel', 'chasecomtravel': 'chase-travel', 'chasepay': 'chase-travel',
  'cardmember serv': 'chase-travel', 'cardmember ser': 'chase-travel',

  // Amex Travel portal - patterns must match normalized text (special chars removed)
  // "amex.com/travel" -> "amexcomtravel", "AET*" -> "aet"
  'amex travel': 'amex-travel', 'amextravel': 'amex-travel', 'american express travel': 'amex-travel',
  'amexcomtravel': 'amex-travel', 'aexp travel': 'amex-travel', 'aet': 'amex-travel',
  'amex trv': 'amex-travel', 'americanexpresscomtravel': 'amex-travel',
  // Bilt Travel portal - "bilt.com/travel" -> "biltcomtravel"
  'bilt travel': 'bilt-travel', 'bilttravel': 'bilt-travel', 'biltcomtravel': 'bilt-travel',

  // Capital One Travel portal - patterns must match normalized text (special chars removed)
  'capital one travel': 'capital-one-travel', 'capitalonetravel': 'capital-one-travel',
  'capitalone travel': 'capital-one-travel', 'capone travel': 'capital-one-travel',
  'c1 travel': 'capital-one-travel',
  // Capital One Entertainment
  'capital one entertainment': 'capital-one-entertainment', 'capitaloneentertainment': 'capital-one-entertainment',
  'c1 entertainment': 'capital-one-entertainment',

  // Groceries - supermarkets (qualify for Amex Gold 4x)
  'trader joe': 'grocery', 'safeway': 'grocery', 'kroger': 'grocery', 'publix': 'grocery',
  'aldi': 'grocery', 'wegmans': 'grocery', 'stop shop': 'grocery', 'stop & shop': 'grocery',
  'shoprite': 'grocery', 'food lion': 'grocery', 'giant': 'grocery', 'acme': 'grocery',
  'h mart': 'grocery', 'hmart': 'grocery', 'food emporium': 'grocery', 'gristedes': 'grocery',
  'fairway': 'grocery', 'morton williams': 'grocery', 'food bazaar': 'grocery', 'key food': 'grocery',
  'sprouts': 'grocery', 'harris teeter': 'grocery', 'meijer': 'grocery', 'hy-vee': 'grocery',
  'winn dixie': 'grocery', 'piggly wiggly': 'grocery', "trader joe's": 'grocery',
  // Additional grocery
  'amish market': 'grocery', 'city acres': 'grocery', 'dierbergs': 'grocery',
  'foodcellar': 'grocery', 'hashi market': 'grocery', 'hudson market': 'grocery', 'schnucks': 'grocery',

  // Wholesale clubs & big box (do NOT qualify for Amex Gold supermarket 4x)
  'costco': 'wholesale', 'sams club': 'wholesale', "sam's club": 'wholesale', 'bjs': 'wholesale',
  'target': 'retail', 'walmart': 'retail',

  // Furniture/Home
  'ikea': 'shopping',

  // Parking
  'parking': 'parking', 'spothero': 'parking', 'parkwhiz': 'parking', 'parkme': 'parking',

  // Shipping/Mail
  'usps': 'shipping',

  // Government Services (TSA PreCheck, Global Entry, passports, customs, etc.)
  'trusted travel': 'government-services', 'uscustoms': 'government-services', 'us customs': 'government-services',
  'cbp ': 'government-services', 'cbp.gov': 'government-services', // Customs and Border Protection
  'state dept': 'government-services', 'state department': 'government-services',
  'us passport': 'government-services', 'passport services': 'government-services',
  'tsa precheck': 'government-services', 'tsa pre': 'government-services',
  'global entry': 'government-services', 'goes ': 'government-services', // Global Online Enrollment System
  'irs ': 'government-services', 'irs.gov': 'government-services',
  'dmv ': 'government-services', 'dept of motor': 'government-services',
  'usps.com': 'government-services', 'postal service': 'government-services',
  'ssa ': 'government-services', 'social security': 'government-services',
  'uscis': 'government-services', 'immigration': 'government-services',
  'nyc.gov': 'government-services', 'ny.gov': 'government-services', 'ca.gov': 'government-services',
  'pay.gov': 'government-services', 'gov fee': 'government-services', 'govt fee': 'government-services',

  // Travel (for credit detection - Global Entry/TSA PreCheck)
  // Note: 'trusted traveler' kept separate for credit detection matching
  'trusted traveler': 'travel',

  // Streaming — true audio/video/music only (ultra-safe, confidence: 100)
  // Tightened to match what card streaming bonuses (e.g. CSP 3x) actually reward.
  'netflix': 'streaming', 'spotify': 'streaming', 'hulu': 'streaming',
  'disney+': 'streaming', 'disney plus': 'streaming',
  'hbo': 'streaming', 'hbo max': 'streaming', 'helpmaxcom': 'streaming',
  'apple music': 'streaming', 'apple tv': 'streaming',
  'amazon prime video': 'streaming', 'prime video': 'streaming',
  'paramount': 'streaming', 'paramount+': 'streaming', 'paramount plus': 'streaming',
  'peacock': 'streaming', 'youtube premium': 'streaming', 'youtube tv': 'streaming',
  'pandora': 'streaming', 'tidal': 'streaming', 'deezer': 'streaming',
  'max ': 'streaming', 'espn+': 'streaming', 'discovery+': 'streaming',
  'sirius': 'streaming', 'crunchyroll': 'streaming', 'fubo': 'streaming',
  'sling tv': 'streaming', 'sling': 'streaming',
  'showtime': 'streaming', 'sho ': 'streaming', 'vudu': 'streaming',

  // Cable & Internet providers (broadband/cable bills) — rolls up to utilities
  'spectrum': 'cable-internet', 'optimum': 'cable-internet', 'xfinity stream': 'cable-internet',

  // Subscriptions — recurring digital services that are NOT streaming.
  // Rolls up to 'other' → base rate on every card (no card has a subscription bonus).
  'applecom': 'subscription', 'apple one': 'subscription',
  'google one': 'subscription', 'microsoftpc': 'subscription',
  'audible': 'subscription', 'kindle unlimited': 'subscription',
  'nytimes': 'subscription', 'wsj': 'subscription',
  'headspace': 'subscription', 'calm': 'subscription', 'noom': 'subscription', 'ouraring': 'subscription',
  'duolingo': 'subscription', 'masterclass': 'subscription', 'skillshare': 'subscription', 'brilliant': 'subscription',
  'origin financial': 'subscription', 'pointme': 'subscription',

  // Gaming storefronts (digital game purchases, MCC 5816) — rolls up to entertainment
  'xbox': 'gaming', 'steamgames': 'gaming', 'wl steam': 'gaming',

  // Stitch Fix codes as apparel — clothing → shopping
  'stitch fix': 'clothing',

  // Wine & Liquor stores (often miscategorized as Travel by banks)
  // Note: 'spirits' alone is too broad (matches 'Holy Spirit Church'), use specific patterns
  'wine & spirits': 'shopping', 'wine and spirits': 'shopping', 'liquor': 'shopping',
  'wine shop': 'shopping', 'wine store': 'shopping', 'liquor store': 'shopping', 'bevmo': 'shopping',
  'total wine': 'shopping', 'abc liquor': 'shopping', 'binny': 'shopping', 'spec\'s': 'shopping',

  // Utilities (for Cash+ 5%)
  'coned': 'utilities', 'con edison': 'utilities', 'national grid': 'utilities', 'pseg': 'utilities',
  'pge': 'utilities', 'pg&e': 'utilities', 'duke energy': 'utilities', 'dominion': 'utilities',
  'water bill': 'utilities', 'electric bill': 'utilities', 'gas bill': 'utilities',

  // Cell phone (for Cash+ 5%)
  'verizon': 'cell-phone', 'at t': 'cell-phone', 'att ': 'cell-phone', 'att wireless': 'cell-phone',
  'att bill': 'cell-phone', 'att payment': 'cell-phone', 'at&t': 'cell-phone', 't-mobile': 'cell-phone',
  'tmobile': 'cell-phone', 'sprint': 'cell-phone', 'mint mobile': 'cell-phone', 'visible': 'cell-phone',
  'cricket': 'cell-phone', 'metro pcs': 'cell-phone', 'boost mobile': 'cell-phone',

  // Fitness
  'peloton': 'fitness', 'equinox': 'fitness', 'orangetheory': 'fitness', 'otf': 'fitness',
  'planet fitness': 'fitness', 'la fitness': 'fitness', 'ymca': 'fitness', 'crossfit': 'fitness',
  'soulcycle': 'fitness', 'barrys': 'fitness', "barry's": 'fitness', 'tmpl': 'fitness', 'crunch': 'fitness',
  'gold gym': 'fitness', "gold's gym": 'fitness', 'lifetime fitness': 'fitness', 'anytime fitness': 'fitness',
  'blink fitness': 'fitness', 'nysc': 'fitness', 'classpass': 'fitness',

  // Retail
  'lululemon': 'retail', 'saks': 'retail', 'nordstrom': 'retail', 'macys': 'retail', "macy's": 'retail',
  'bloomingdales': 'retail', 'neiman marcus': 'retail', 'jcpenney': 'retail', 'kohls': 'retail',
  'best buy': 'retail', 'apple store': 'retail', 'home depot': 'retail', 'lowes': 'retail',
  // Additional retail
  'on sportswear': 'retail', 'patagonia': 'retail', 'rei ': 'retail', 'seven scents': 'retail',
  'suitsupply': 'retail', 'tumi': 'retail', 'uniqlo': 'retail', 'williamssonomacom': 'retail',

  // Entertainment
  'stubhub': 'entertainment', 'ticketmaster': 'entertainment', 'amc theatre': 'entertainment',
  'regal cinema': 'entertainment', 'cinemark': 'entertainment', 'fandango': 'entertainment',
  'seatgeek': 'entertainment', 'vivid seats': 'entertainment',
  // Additional entertainment
  'avant gard': 'entertainment', 'big apple r': 'entertainment', 'brooklyn bowl': 'entertainment',
  'dicefm': 'entertainment', 'san diego zoo': 'entertainment', 'seeticket': 'entertainment',

  // Rent
  'bilt': 'rent',

  // Added from user review
  'eaton dc': 'hotels-direct',
  'for five coffee': 'coffee-shop',
  'sebco laundry': 'other',
  'sebco': 'other',
  'anthropic': 'subscription',
  'electric burrito': 'dining',
  'american bar association': 'other',
  'freetaxusacom': 'other',
  'cloudflare': 'other',
  'my magic pass': 'entertainment',
  'window world of columb': 'other',
  'window world': 'other',
  'chilis': 'dining',
  "chili's": 'dining',
  'hk best barbers': 'salon',
  'base44': 'other'
};

window.CardTracker.monarchMap = {
  'food & drink': 'dining', 'restaurants': 'dining', 'groceries': 'grocery',
  'gas': 'gas', 'travel': 'travel', 'airlines': 'flights-direct', 'hotels': 'hotels-direct',
  'public transportation': 'transit', 'pharmacy': 'drugstore', 'shopping': 'shopping',
  'entertainment': 'entertainment', 'rent': 'rent', 'utilities': 'utilities',
  'bills & utilities': 'utilities', 'phone': 'cell-phone', 'internet': 'streaming',
  'subscriptions': 'streaming', 'fitness': 'fitness', 'health & fitness': 'fitness',
  'personal care': 'other', 'clothing': 'retail', 'electronics': 'retail',
  'home improvement': 'retail', 'automotive': 'gas', 'taxi': 'transit', 'ride share': 'transit'
};
