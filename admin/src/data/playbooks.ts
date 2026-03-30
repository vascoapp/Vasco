// ═══════════════════════════════════════════════════════════════════════════
// VASCO NICHE PLAYBOOKS — Trade-specific cultural context
// One playbook per trade vertical — feeds brief generation + learning loop
// ═══════════════════════════════════════════════════════════════════════════

export interface NichePlaybook {
  nicheId: string;
  communityName: string;
  coreDesire: string;
  emotionalDriver: string;

  slang: Record<string, string>;

  hotTopics: string[];
  controversies: string[];
  painPoints: string[];

  seasonalCalendar: Array<{
    month: string;
    event: string;
    angle: string;
  }>;

  heroItems: Array<{
    item: string;
    whyItMatters: string;
    priceRange: string;
  }>;

  communityHubs: Array<{
    platform: string;
    name: string;
    size: string;
  }>;

  competitorGaps: string[];
  bestFeatures: string[];
  bestFormats: string[];

  credibilityKillers: string[];
}

// ─── PLUMBING ───────────────────────────────────────────────────────────

const PLUMBING: NichePlaybook = {
  nicheId: "plumbing",
  communityName: "Plumbers / Loodgieters / Klempner",
  coreDesire: "Be recognized as skilled professionals, not 'just a plumber' — earn well, work clean, leave proud",
  emotionalDriver: "Pride in invisible craftsmanship — the system works perfectly and nobody thinks about it",

  slang: {
    "first fix": "Rough-in plumbing before walls are closed — pipes, waste, vents",
    "second fix": "Final fitting after decoration — taps, toilets, radiators",
    "soldering / sweating": "Joining copper pipe with heat and solder — being replaced by press-fit",
    "press-fit": "Modern quick-connect copper/stainless — Viega, Geberit brands",
    "waste stack": "Vertical drain pipe carrying waste from multiple floors",
    "stopkraan": "NL: main shut-off valve — every plumber's first check",
    "Rohrbruch": "DE: pipe burst — emergency call work",
    "PER / PEX": "Cross-linked polyethylene flexible pipe — standard for modern installs",
    "siphon": "Trap under sink — prevents sewer gas backflow",
    "cv-ketel": "NL: central heating boiler — bread and butter maintenance work",
    "Absperrventil": "DE: shut-off valve",
    "colonne": "FR: vertical pipe stack in apartment buildings",
  },

  hotTopics: [
    "Copper vs PEX debate — old school vs modern",
    "Heat pump installations replacing gas boilers",
    "Bathroom renovation pricing and timelines",
    "Emergency call-out rates and boundaries",
    "Apprentice training and finding good helpers",
    "Press-fit vs soldering speed and reliability",
    "Water pressure issues and solutions",
    "Underfloor heating installation techniques",
  ],

  controversies: [
    "Copper is dying — agree or disagree?",
    "Should plumbers install heat pumps or leave it to HVAC?",
    "Emergency call-out: €150 minimum or hourly rate?",
    "Shark bites / push-fit: professional or lazy?",
    "Is the trade getting easier or harder with new regs?",
    "Quoting by the job vs hourly — which is better?",
    "Apprentices these days — genuinely worse or just different?",
  ],

  painPoints: [
    "Chasing payments from clients who 'forgot' the invoice",
    "Undercharging because you don't know market rates",
    "Hours spent on admin after a full day on the tools",
    "Keeping up with changing gas/water regulations per country",
    "Managing multiple jobs and not letting anything slip",
    "Quoting accurately for complex bathrooms without leaving money on the table",
  ],

  seasonalCalendar: [
    { month: "Jan-Feb", event: "Frozen pipe season", angle: "Emergency content: pipe burst fixes, prevention tips" },
    { month: "Mar-Apr", event: "Spring renovation rush", angle: "Bathroom renovation content, booking management tips" },
    { month: "May-Jun", event: "Outdoor plumbing season", angle: "Garden taps, outdoor showers, pool plumbing" },
    { month: "Jul-Aug", event: "Holiday cover / quiet period", angle: "Business planning content, pricing reviews" },
    { month: "Sep-Oct", event: "Heating season prep", angle: "Boiler servicing, cv-ketel maintenance content" },
    { month: "Nov-Dec", event: "Emergency season + year-end", angle: "Tax prep, year review, cold weather emergency content" },
  ],

  heroItems: [
    { item: "Milwaukee M18 Press Tool", whyItMatters: "Game-changer for speed — press a joint in 4 seconds", priceRange: "€1,200-1,800" },
    { item: "RIDGID RP 351", whyItMatters: "The industry standard press tool — every serious plumber has one", priceRange: "€2,000-2,500" },
    { item: "Viega Profipress", whyItMatters: "Premium press-fit fittings — trusted in DE/NL", priceRange: "€3-50/fitting" },
    { item: "Rothenberger ROMAX 4000", whyItMatters: "Compact press tool for tight spaces", priceRange: "€1,500-2,000" },
    { item: "Geberit Mapress", whyItMatters: "Stainless steel press system — high-end installs", priceRange: "€5-80/fitting" },
  ],

  communityHubs: [
    { platform: "TikTok", name: "#PlumberTok", size: "2.5B+ views" },
    { platform: "TikTok", name: "#Loodgieter", size: "50M+ views" },
    { platform: "TikTok", name: "#Klempner", size: "30M+ views" },
    { platform: "Reddit", name: "r/Plumbing", size: "400K+ members" },
    { platform: "Instagram", name: "#plumbersofinstagram", size: "1M+ posts" },
  ],

  competitorGaps: [
    "No app tracks plumbing-specific material costs (copper vs PEX pricing trends)",
    "Generic invoicing apps don't understand first-fix vs second-fix quoting",
    "No competitor offers plumbing compliance tracking across EU countries",
  ],

  bestFeatures: ["quote-speed", "invoice-scan", "ai-insights", "purchasing-agent", "compliance"],
  bestFormats: ["before-after", "tutorial", "tool-review", "day-in-life"],

  credibilityKillers: [
    "Calling it 'pipes' when showing fittings — they're different things",
    "Showing copper soldering with a butane lighter — professionals use MAP gas or oxy-acetylene",
    "Confusing waste pipe with supply pipe — basic error",
    "Using 'plumber' when showing gas or heating work — different certifications in most EU countries",
    "Showing push-fit connectors as 'professional grade' without context — controversial",
    "Ignoring building regulations or suggesting work without permits",
  ],
};

// ─── ELECTRICAL ─────────────────────────────────────────────────────────

const ELECTRICAL: NichePlaybook = {
  nicheId: "electrical",
  communityName: "Electricians / Elektriciens / Elektriker",
  coreDesire: "Be respected for working with something genuinely dangerous — safety is identity",
  emotionalDriver: "Precision and accountability — one mistake can kill, and that separates us from other trades",

  slang: {
    "groepenkast": "NL: consumer unit / fuse board — the nerve center",
    "Sicherungskasten": "DE: fuse box / distribution board",
    "tableau électrique": "FR: electrical panel",
    "aardlek": "NL: RCD / residual current device — life safety",
    "FI-Schalter": "DE: RCD",
    "first fix": "Cable runs before plastering — conduit, back boxes, main feeds",
    "second fix": "Fitting sockets, switches, lights after decoration",
    "drie-fase": "NL: three-phase power — commercial and heavy residential",
    "Drehstrom": "DE: three-phase power",
    "zonnevelden": "NL: solar panel arrays — growing market segment",
    "NEN 1010": "NL: electrical installation standard",
    "VDE 0100": "DE: electrical installation standard",
  },

  hotTopics: [
    "EV charger installation boom — training and opportunities",
    "Solar panel integration and battery storage",
    "Smart home wiring and KNX / Loxone systems",
    "LED retrofit vs full rewire economics",
    "Heat pump electrical requirements",
    "NEN 1010 / VDE 0100 regulation updates",
    "Cable routing in renovation vs new build",
    "Testing and certification requirements per country",
  ],

  controversies: [
    "Wago connectors vs traditional terminal blocks — trust or ticking bomb?",
    "Should electricians install solar or is it a separate trade?",
    "Fixed price vs day rate — what's fair for a rewire?",
    "How much testing is 'enough' before handover?",
    "DIY electrical work — where's the line?",
    "Aluminum wiring comeback — safe now or still dangerous?",
    "Apprentice wages — too low to attract talent?",
  ],

  painPoints: [
    "Certification costs and ongoing CPD requirements per country",
    "Quoting rewires accurately without opening every wall",
    "Clients who don't understand why electrical work costs what it does",
    "Keeping up with EV/solar standards that change every year",
    "Managing multiple small jobs (lights, sockets) vs. big projects",
    "Getting paid on time for emergency callouts",
  ],

  seasonalCalendar: [
    { month: "Jan-Feb", event: "New year renovations start", angle: "Rewire planning, smart home upgrades" },
    { month: "Mar-Apr", event: "Solar season begins", angle: "Solar installation content, EV charger installs" },
    { month: "May-Jun", event: "Outdoor/garden electrical", angle: "Garden lighting, outdoor power, hot tub wiring" },
    { month: "Jul-Aug", event: "Commercial fit-out season", angle: "Office/shop electrical, testing & certification" },
    { month: "Sep-Oct", event: "Pre-winter checks", angle: "Heating system wiring, safety inspections" },
    { month: "Nov-Dec", event: "Christmas lighting + year-end", angle: "Festive install content, tax planning for electricians" },
  ],

  heroItems: [
    { item: "Fluke 1664 FC", whyItMatters: "The gold standard multifunction tester — proves compliance", priceRange: "€2,500-3,500" },
    { item: "Milwaukee M12 Cable Stapler", whyItMatters: "Speeds up first-fix cable runs dramatically", priceRange: "€300-400" },
    { item: "Knipex VDE Pliers Set", whyItMatters: "Insulated tools rated to 1000V — essential kit", priceRange: "€150-300" },
    { item: "Wago 221 Connectors", whyItMatters: "Love them or hate them — everyone has an opinion", priceRange: "€0.30-0.80/piece" },
    { item: "Hager Consumer Unit", whyItMatters: "Premium distribution board — clean installs", priceRange: "€200-600" },
  ],

  communityHubs: [
    { platform: "TikTok", name: "#ElectricianLife", size: "1.8B+ views" },
    { platform: "TikTok", name: "#Elektriker", size: "40M+ views" },
    { platform: "Reddit", name: "r/electricians", size: "350K+ members" },
    { platform: "Instagram", name: "#electriciansofinstagram", size: "800K+ posts" },
  ],

  competitorGaps: [
    "No app tracks certification expiry dates across EU electrical standards",
    "No competitor quotes first-fix and second-fix as separate phases automatically",
    "No pricing intelligence for EV charger installations (fast-growing segment)",
  ],

  bestFeatures: ["compliance", "quote-speed", "eve-agent", "ai-insights", "one-tap-invoice"],
  bestFormats: ["before-after", "tutorial", "day-in-life", "tip"],

  credibilityKillers: [
    "Showing work without proper isolation — electricians notice unsafe practices instantly",
    "Confusing single-phase and three-phase terminology",
    "Suggesting DIY electrical work is fine — violates regulations in every EU country",
    "Using wrong wire colors for the market (NL/DE use different color codes than UK)",
    "Calling an RCD a 'fuse' — fundamentally different safety devices",
    "Showing exposed wiring and calling it 'done' — no electrician leaves cables exposed",
  ],
};

// ─── PAINTING & DECORATING ──────────────────────────────────────────────

const PAINTING: NichePlaybook = {
  nicheId: "painting",
  communityName: "Painters / Schilders / Maler",
  coreDesire: "Transform spaces and make people happy — the most visible trade with instant emotional impact",
  emotionalDriver: "The reveal moment — watching a client see their newly painted room for the first time",

  slang: {
    "cutting in": "Painting edges by hand without tape — skill marker",
    "rolling out": "Applying paint with roller to large surfaces",
    "schilderswerk": "NL: painting work / decorating",
    "Malerarbeiten": "DE: painting and decorating work",
    "grondverf": "NL: primer — essential first coat",
    "Grundierung": "DE: primer",
    "aflakken": "NL: applying finish coat",
    "spuiten": "NL: spray painting — airless or HVLP",
    "airless": "High-pressure spray system — commercial speed",
    "stukadoor": "NL: plasterer — often works alongside painters",
    "Abkleben": "DE: masking / taping off",
    "Fassadenanstrich": "DE: exterior facade painting",
  },

  hotTopics: [
    "Spray vs brush vs roller — when to use each",
    "Color trends 2026 and client consultation",
    "Exterior painting: weather windows and prep",
    "Eco-friendly / VOC-free paint performance",
    "Wallpaper comeback — skills needed",
    "Pricing per m² vs per room vs per hour",
    "Prep work: how much is enough?",
    "Client expectations management (Pinterest vs reality)",
  ],

  controversies: [
    "Spray painting interiors — faster but is the finish as good?",
    "Should painters recommend colors or stay neutral?",
    "Masking tape vs cutting in freehand — which is more professional?",
    "Cheap paint, more coats vs expensive paint, fewer coats?",
    "Wallpaper removal charge — separate or included?",
    "Weekend/evening work — worth the premium or bad boundaries?",
  ],

  painPoints: [
    "Clients who want 'just a quick paint' but the walls need full prep",
    "Underquoting because prep time is hard to estimate",
    "Material waste and managing paint inventory",
    "Weather dependency for exterior work",
    "Being seen as 'unskilled' compared to other trades",
    "Scope creep: 'While you're here, can you also...'",
  ],

  seasonalCalendar: [
    { month: "Jan-Feb", event: "Interior season peak", angle: "New year refresh content, color trend predictions" },
    { month: "Mar-Apr", event: "Exterior prep begins", angle: "Prep and priming tips, weather monitoring" },
    { month: "May-Aug", event: "Exterior painting season", angle: "Facade work, outdoor transformations, weather tips" },
    { month: "Sep-Oct", event: "Last exterior window + interior return", angle: "Beat the rain, autumn interior projects" },
    { month: "Nov-Dec", event: "Holiday refresh demand", angle: "Quick room transformations, holiday deadline projects" },
  ],

  heroItems: [
    { item: "Graco Mark V Airless", whyItMatters: "Professional airless sprayer — exterior jobs in half the time", priceRange: "€2,000-3,500" },
    { item: "Festool Planex", whyItMatters: "Drywall sander with dust extraction — clean prep", priceRange: "€1,500-2,500" },
    { item: "Purdy XL Brushes", whyItMatters: "The brush serious painters trust — cutting in perfection", priceRange: "€15-30/brush" },
    { item: "Sikkens / Sigma Paint", whyItMatters: "NL/EU premium paint brands — professional standard", priceRange: "€30-80/liter" },
  ],

  communityHubs: [
    { platform: "TikTok", name: "#PainterTok", size: "1.2B+ views" },
    { platform: "TikTok", name: "#Schilder", size: "25M+ views" },
    { platform: "TikTok", name: "#Maler", size: "35M+ views" },
    { platform: "Instagram", name: "#paintersofinstagram", size: "600K+ posts" },
  ],

  competitorGaps: [
    "No app estimates paint quantity from room dimensions",
    "No per-m² pricing benchmarks for painting in EU markets",
    "No tool tracks weather windows for exterior painting scheduling",
  ],

  bestFeatures: ["quote-speed", "invoice-scan", "payment-tracking", "ai-insights"],
  bestFormats: ["before-after", "project-showcase", "day-in-life", "tutorial"],

  credibilityKillers: [
    "Painting over dirty/unprepped surfaces — painters will notice immediately",
    "Cutting in with visible tape lines — shows lack of freehand skill",
    "Using consumer-grade paint (like Action store paint) as 'professional'",
    "Not showing prep work — real painters know prep is 60% of the job",
    "Calling all paints the same — professionals know the difference between brands",
    "Showing roller marks or drips as finished work",
  ],
};

// ─── CARPENTRY / WOODWORKING ────────────────────────────────────────────

const CARPENTRY: NichePlaybook = {
  nicheId: "carpentry",
  communityName: "Carpenters / Timmermannen / Schreiner / Tischler",
  coreDesire: "Create lasting work with their hands — wood is honest, and so is their craft",
  emotionalDriver: "The satisfaction of precision — a joint that fits perfectly, a door that hangs true",

  slang: {
    "timmerwerk": "NL: carpentry / woodworking",
    "kozijnen": "NL: window frames — big renovation market",
    "Schreinerarbeit": "DE: fine carpentry / joinery",
    "Tischlerarbeit": "DE: general carpentry",
    "afwerking": "NL: finishing / trim work",
    "inbouwkast": "NL: built-in wardrobe — common residential job",
    "Einbauschrank": "DE: built-in cabinet",
    "mortise and tenon": "Traditional strong joint — craft skill marker",
    "biscuit joint": "Modern alignment joint — Lamello system",
    "CNC": "Computer-controlled cutting — workshop carpenters",
    "Massivholz": "DE: solid wood (vs engineered / MDF)",
    "multiplex": "NL: plywood / birch ply — workshop staple",
  },

  hotTopics: [
    "CNC vs hand tools — modern workshop debate",
    "Solid wood vs engineered materials for different applications",
    "Kitchen fitting: custom vs IKEA modification",
    "Timber frame construction growth in EU",
    "Sustainable / FSC-certified wood sourcing",
    "Built-in storage and space optimization",
    "Renovation carpentry vs new build carpentry",
    "Window/door replacement market",
  ],

  controversies: [
    "CNC is replacing real carpentry skills — agree?",
    "MDF is fine for 90% of interior work — fight me",
    "IKEA hacking: beneath a carpenter or smart business?",
    "Glue vs screws vs dowels — which joints last?",
    "Should carpenters do their own finishing or bring in a painter?",
    "Quoting kitchens: per linear meter or per project?",
  ],

  painPoints: [
    "Material costs fluctuating wildly (wood prices post-COVID)",
    "Clients wanting custom quality at IKEA prices",
    "Workshop overhead: rent, machinery, dust extraction",
    "Accurate quoting for complex bespoke work",
    "Transport of large pieces to site",
    "Competition from factory-made fitted furniture",
  ],

  seasonalCalendar: [
    { month: "Jan-Mar", event: "Kitchen/interior season", angle: "Built-in projects, kitchen installs, workshop work" },
    { month: "Apr-Jun", event: "Outdoor/deck season", angle: "Terrace building, pergolas, garden structures" },
    { month: "Jul-Aug", event: "Window/door replacements", angle: "Kozijnen replacement, frame repairs" },
    { month: "Sep-Nov", event: "Renovation season peak", angle: "Interior finishing, built-in storage, stairs" },
    { month: "Dec", event: "Workshop projects", angle: "Custom furniture, handmade gifts, year planning" },
  ],

  heroItems: [
    { item: "Festool TS 55", whyItMatters: "The plunge saw every serious carpenter trusts — precision cuts", priceRange: "€500-700" },
    { item: "Festool Domino DF 500", whyItMatters: "Loose tenon joinery system — revolutionary for frameless joining", priceRange: "€900-1,200" },
    { item: "Mafell MT 55", whyItMatters: "German precision plunge saw — Festool's main rival", priceRange: "€600-800" },
    { item: "DeWalt DWS780 Mitre Saw", whyItMatters: "Jobsite mitre saw standard — accurate and tough", priceRange: "€500-700" },
  ],

  communityHubs: [
    { platform: "TikTok", name: "#CarpenterTok", size: "1.5B+ views" },
    { platform: "TikTok", name: "#Timmerman", size: "20M+ views" },
    { platform: "TikTok", name: "#Schreiner", size: "60M+ views" },
    { platform: "Reddit", name: "r/Carpentry", size: "150K+ members" },
    { platform: "Instagram", name: "#carpentrylife", size: "500K+ posts" },
  ],

  competitorGaps: [
    "No app provides wood/panel pricing indexes for EU markets",
    "No competitor handles bespoke furniture quoting (custom dimensions, materials, finishing)",
    "No tool tracks material waste percentages for quoting accuracy",
  ],

  bestFeatures: ["quote-speed", "purchasing-agent", "ai-insights", "invoice-scan"],
  bestFormats: ["before-after", "project-showcase", "tool-review", "tutorial"],

  credibilityKillers: [
    "Showing MDF as 'solid wood' — carpenters spot this instantly",
    "Using a circular saw for fine joinery — wrong tool for the job",
    "Calling all woodwork 'carpentry' — joinery, cabinet making, and carpentry are different disciplines",
    "Ignoring grain direction — amateur mistake that professionals notice",
    "Showing unsanded or unfinished work as 'complete'",
    "Using pocket screws on visible surfaces — hidden joinery is the standard",
  ],
};

// ─── GAS / HVAC ─────────────────────────────────────────────────────────

const GAS_HVAC: NichePlaybook = {
  nicheId: "gas-hvac",
  communityName: "Gas Engineers / HVAC Technicians / Installateurs",
  coreDesire: "Keep people safe and comfortable — gas is the most regulated trade for a reason",
  emotionalDriver: "The weight of responsibility — carbon monoxide doesn't forgive mistakes, and neither does the law",

  slang: {
    "cv-installatie": "NL: central heating system",
    "Heizungsanlage": "DE: heating system",
    "warmtepomp": "NL: heat pump — the future of heating",
    "Wärmepumpe": "DE: heat pump",
    "gaskeuring": "NL: gas safety inspection — mandatory",
    "Gasabnahme": "DE: gas acceptance test",
    "HR-ketel": "NL: high-efficiency condensing boiler",
    "Brennwertkessel": "DE: condensing boiler",
    "rookgasafvoer": "NL: flue / exhaust gas vent",
    "Abgasleitung": "DE: flue pipe",
    "F-gas": "EU regulation on fluorinated greenhouse gases — HVAC certification",
    "koelmiddel": "NL: refrigerant (R32, R410A)",
    "split unit": "Wall-mounted AC/heat pump — growing market",
  },

  hotTopics: [
    "Heat pump transition — replacing gas boilers across EU",
    "Hydrogen-ready boilers — real opportunity or industry hype?",
    "F-gas regulation changes and refrigerant phase-downs",
    "Hybrid systems (heat pump + gas backup)",
    "Smart thermostats and zoned heating",
    "Energy label requirements for heating systems",
    "Heat pump noise regulations in residential areas",
    "District heating connections — future or threat?",
  ],

  controversies: [
    "Heat pumps in old houses — feasible or money pit?",
    "Gas ban timelines — too aggressive or not fast enough?",
    "Hydrogen boilers: should installers invest in training now?",
    "Air-to-water vs ground-source heat pumps — which wins?",
    "Should gas engineers retrain for heat pumps or retire?",
    "Mandatory annual gas checks — necessary safety or revenue grab?",
  ],

  painPoints: [
    "Massive retraining costs for heat pump certification",
    "Clients confused about heat pump vs gas economics",
    "Complex compliance across EU countries for gas work",
    "Emergency callout burden — gas leaks can't wait",
    "Quoting heat pump installations accurately (every house is different)",
    "Supply chain issues for heat pumps and refrigerants",
  ],

  seasonalCalendar: [
    { month: "Jan-Mar", event: "Peak heating season / breakdowns", angle: "Emergency content, boiler repair tips, heat pump winter performance" },
    { month: "Apr-May", event: "Boiler servicing season", angle: "Annual maintenance content, gaskeuring preparation" },
    { month: "Jun-Aug", event: "AC/cooling installation peak", angle: "Split unit installs, airco content, summer comfort" },
    { month: "Sep-Oct", event: "Pre-winter prep", angle: "Heating system checks, heat pump commissioning" },
    { month: "Nov-Dec", event: "Heating emergency season", angle: "Emergency repairs, frozen pipes, system failures" },
  ],

  heroItems: [
    { item: "Testo 300 Flue Gas Analyzer", whyItMatters: "Essential for commissioning and compliance — proves safety", priceRange: "€1,500-3,000" },
    { item: "Daikin Altherma Heat Pump", whyItMatters: "Market-leading air-to-water heat pump in EU", priceRange: "€8,000-15,000 installed" },
    { item: "Viessmann Vitodens", whyItMatters: "Premium condensing boiler — German engineering standard", priceRange: "€2,000-4,000" },
    { item: "Fieldpiece SMAN4 Manifold", whyItMatters: "Digital refrigerant manifold — HVAC precision", priceRange: "€600-900" },
  ],

  communityHubs: [
    { platform: "TikTok", name: "#HVACTok", size: "1B+ views" },
    { platform: "TikTok", name: "#GasEngineer", size: "200M+ views" },
    { platform: "TikTok", name: "#Installateur", size: "15M+ views" },
    { platform: "Reddit", name: "r/HVAC", size: "300K+ members" },
  ],

  competitorGaps: [
    "No app tracks gas certification expiry across EU countries",
    "No competitor provides heat pump sizing calculators for quoting",
    "No tool manages F-gas logbooks and refrigerant tracking digitally",
  ],

  bestFeatures: ["compliance", "eve-agent", "ai-insights", "quote-speed", "purchasing-agent"],
  bestFormats: ["tutorial", "day-in-life", "before-after", "tip"],

  credibilityKillers: [
    "Showing gas work without proper ventilation — safety violation that engineers spot instantly",
    "Confusing gas and HVAC certifications — they're separate in most EU countries",
    "Suggesting heat pumps work in every building without caveats — oversimplification",
    "Ignoring F-gas regulations when discussing AC/heat pump work",
    "Showing uncertified gas appliance connections — illegal in all EU countries",
    "Using 'gas fitter' and 'gas engineer' interchangeably — different qualifications",
  ],
};

// ─── TILING ─────────────────────────────────────────────────────────────

const TILING: NichePlaybook = {
  nicheId: "tiling",
  communityName: "Tilers / Tegelzetters / Fliesenleger",
  coreDesire: "Create perfect surfaces that last decades — tiling is where geometry meets artistry",
  emotionalDriver: "The satisfaction of flawless grout lines and patterns that transform a space",

  slang: {
    "tegelzetter": "NL: tiler — tile setter",
    "Fliesenleger": "DE: tiler",
    "carreleur": "FR: tiler",
    "voeg": "NL: grout joint",
    "Fuge": "DE: grout joint",
    "kruisjes": "NL: tile spacers",
    "waterpas": "NL: spirit level — constant companion",
    "Fliesenkleber": "DE: tile adhesive",
    "doucheput": "NL: shower drain — critical waterproofing point",
    "visgraat": "NL: herringbone pattern — premium look",
    "Fischgrätenmuster": "DE: herringbone pattern",
    "rectified": "Tiles with precisely cut edges — allows thin grout lines",
  },

  hotTopics: [
    "Large format tiles (60×120, 120×120) — technique challenges",
    "Herringbone and pattern layouts trending",
    "Heated floor integration under tiles",
    "Waterproofing systems and shower drainage",
    "Natural stone vs porcelain performance",
    "Leveling systems (Raimondi, Levtec) vs traditional",
    "Outdoor tiling on pedestals / raised systems",
    "Tile-on-tile renovation technique",
  ],

  controversies: [
    "Leveling clips: professional tool or crutch?",
    "Grout color: match the tile or contrast?",
    "Large format tiles in old houses with uneven floors — worth it?",
    "Natural stone: beautiful but high maintenance — honest with clients?",
    "Should tilers also do waterproofing or is it a separate specialty?",
  ],

  painPoints: [
    "Material waste on complex patterns (herringbone = 15% waste)",
    "Clients choosing tiles without understanding laying difficulty",
    "Waterproofing liability — leaks years later traced back to you",
    "Heavy tile transport and cutting on site",
    "Quoting intricate patterns accurately",
    "Back and knee strain from years of floor work",
  ],

  seasonalCalendar: [
    { month: "Jan-Mar", event: "Indoor renovation peak", angle: "Bathroom tiling, kitchen splashbacks" },
    { month: "Apr-Jun", event: "Outdoor tiling starts", angle: "Terrace tiles, pool surrounds" },
    { month: "Jul-Aug", event: "Summer renovations", angle: "Full bathroom remodels, vacation home projects" },
    { month: "Sep-Nov", event: "Last outdoor window + interiors", angle: "Beat the frost, interior projects" },
    { month: "Dec", event: "Planning season", angle: "Material selection, trend content for next year" },
  ],

  heroItems: [
    { item: "Sigma 3D4M Tile Cutter", whyItMatters: "Manual cutter for large format — clean snap every time", priceRange: "€400-600" },
    { item: "Rubi DC-250 Wet Saw", whyItMatters: "Professional wet saw — handles porcelain and stone", priceRange: "€800-1,500" },
    { item: "Raimondi Leveling System", whyItMatters: "Ensures lippage-free large format installs", priceRange: "€50-150/kit" },
  ],

  communityHubs: [
    { platform: "TikTok", name: "#TilerTok", size: "800M+ views" },
    { platform: "TikTok", name: "#Tegelzetter", size: "15M+ views" },
    { platform: "TikTok", name: "#Fliesenleger", size: "40M+ views" },
  ],

  competitorGaps: [
    "No app calculates tile quantities with waste percentages for pattern types",
    "No tool tracks waterproofing warranty documentation",
    "No pricing benchmarks for tiling per m² across EU markets",
  ],

  bestFeatures: ["quote-speed", "ai-insights", "invoice-scan", "purchasing-agent"],
  bestFormats: ["before-after", "project-showcase", "tutorial", "tool-review"],

  credibilityKillers: [
    "Showing tiles with visible lippage — uneven edges between tiles",
    "Grouting before adhesive is fully cured — amateur mistake",
    "Using wrong adhesive for the tile type (natural stone needs flexible adhesive)",
    "Ignoring waterproofing in wet areas — lawsuit waiting to happen",
    "Cutting tiles with the glazed side down — shows lack of experience",
    "Showing inconsistent grout line widths as finished work",
  ],
};

// ─── ROOFING ────────────────────────────────────────────────────────────

const ROOFING: NichePlaybook = {
  nicheId: "roofing",
  communityName: "Roofers / Dakdekkers / Dachdecker",
  coreDesire: "Protect homes from the elements — the ultimate practical trade with visible impact",
  emotionalDriver: "Working at height, in weather, solving problems nobody else wants to tackle",

  slang: {
    "dakdekker": "NL: roofer",
    "Dachdecker": "DE: roofer",
    "couvreur": "FR: roofer",
    "dakpannen": "NL: roof tiles",
    "Dachziegel": "DE: roof tiles",
    "bitumen": "Flat roof membrane material",
    "EPDM": "Rubber roofing membrane — modern flat roofs",
    "zink": "NL: zinc — gutters, flashing, standing seam",
    "Zinkblech": "DE: zinc sheet metal",
    "nokvorst": "NL: ridge tiles — top of the roof",
    "First": "DE: ridge of the roof",
    "dakkapel": "NL: dormer window — popular renovation",
    "Gaube": "DE: dormer",
  },

  hotTopics: [
    "Solar panel integration with roofing systems",
    "Green roofs and sustainability requirements",
    "Storm damage repair and insurance work",
    "Flat roof vs pitched roof waterproofing",
    "Zinc standing seam trending in modern architecture",
    "Dormer installations and planning permits",
    "Insulation requirements under new EU energy directives",
    "Fall protection and safety equipment advances",
  ],

  controversies: [
    "Traditional tiles vs modern membrane systems — which lasts longer?",
    "Should roofers install solar or leave it to specialists?",
    "Green roof warranties — are they realistic?",
    "Working in wind: what's the safe cutoff?",
    "Insurance work pricing — too low or fair for volume?",
  ],

  painPoints: [
    "Weather dependency — can't roof in rain/high wind",
    "Safety regulations and fall protection costs",
    "Material costs (zinc, copper) fluctuating wildly",
    "Seasonal income variation — summer busy, winter slow",
    "Quoting complex roof shapes accurately",
    "Finding reliable helpers willing to work at height",
  ],

  seasonalCalendar: [
    { month: "Jan-Feb", event: "Storm damage season", angle: "Emergency repair content, insurance claim tips" },
    { month: "Mar-May", event: "Main roofing season starts", angle: "Full re-roofing, new build work" },
    { month: "Jun-Aug", event: "Peak season", angle: "Major projects, dormer installs, zinc work" },
    { month: "Sep-Oct", event: "Pre-winter inspections", angle: "Gutter cleaning, maintenance checks, small repairs" },
    { month: "Nov-Dec", event: "Emergency/interior work", angle: "Storm repairs, attic insulation, planning next year" },
  ],

  heroItems: [
    { item: "Makita XSR01Z Circular Saw", whyItMatters: "Cordless roof cutting — no trailing cables at height", priceRange: "€350-500" },
    { item: "Leister TRIAC AT", whyItMatters: "Hot air welding tool for membrane roofing", priceRange: "€800-1,200" },
    { item: "Petzl Harness System", whyItMatters: "Fall protection that's comfortable enough to wear all day", priceRange: "€200-400" },
  ],

  communityHubs: [
    { platform: "TikTok", name: "#RooferTok", size: "600M+ views" },
    { platform: "TikTok", name: "#Dakdekker", size: "10M+ views" },
    { platform: "TikTok", name: "#Dachdecker", size: "50M+ views" },
  ],

  competitorGaps: [
    "No app estimates roof area from address/satellite — saves measurement visits",
    "No tool tracks weather windows for roofing scheduling",
    "No pricing benchmarks for roofing per m² across EU markets",
  ],

  bestFeatures: ["quote-speed", "ai-insights", "purchasing-agent", "payment-tracking"],
  bestFormats: ["before-after", "project-showcase", "day-in-life", "tool-review"],

  credibilityKillers: [
    "Showing work without fall protection — roofers take safety seriously (it's their lives)",
    "Walking on tiles incorrectly — breaking tiles underfoot shows lack of training",
    "Confusing flat roof and pitched roof terminology",
    "Ignoring lead flashing in favor of silicone — amateur shortcut",
    "Showing zinc work without proper solder joints — craft pride issue",
  ],
};

// ─── REGISTRY ───────────────────────────────────────────────────────────

export const NICHE_PLAYBOOKS: Record<string, NichePlaybook> = {
  plumbing: PLUMBING,
  electrical: ELECTRICAL,
  painting: PAINTING,
  carpentry: CARPENTRY,
  "gas-hvac": GAS_HVAC,
  tiling: TILING,
  roofing: ROOFING,
};

export function getPlaybook(nicheId: string): NichePlaybook | null {
  return NICHE_PLAYBOOKS[nicheId] ?? null;
}

export function getAllPlaybookIds(): string[] {
  return Object.keys(NICHE_PLAYBOOKS);
}
