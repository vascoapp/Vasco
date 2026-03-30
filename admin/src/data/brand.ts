// ═══════════════════════════════════════════════════════════════════════════
// VASCO BRAND CONTEXT SYSTEM — Single Source of Truth
// Feeds brief generation, script enrichment, and learning loop evaluation
// ═══════════════════════════════════════════════════════════════════════════

// ─── SECTION 1: IDENTITY ─────────────────────────────────────────────────

export const BRAND_IDENTITY = {
  name: "VascoApp",
  tagline: "AI-Native Construction Trades",
  oneLinePitch:
    "The first AI-powered business platform built for EU construction contractors — free to start, affordable to scale.",
  elevatorPitch:
    "Think ServiceTitan meets Revolut, but built for European solo contractors and small trade teams. " +
    "VascoApp combines jobs, quotes, invoices, compliance, and 45 AI insights in one mobile app — " +
    "starting at €0 with a freemium tier no competitor offers.",
  missionStatement:
    "To give every tradesperson in Europe — from a solo plumber in Rotterdam to a 10-person electrical crew in Munich — " +
    "the same AI-powered business tools that enterprise contractors pay €50K/year for.",
  platforms: ["iOS", "Android"],
  markets: ["NL", "DE", "FR", "ES", "IT", "UK"] as const,
  languages: ["nl", "de", "fr", "es", "it", "en"] as const,
  domain: "app.vasco.eu",
};

// ─── SECTION 2: VOICE & PERSONALITY ──────────────────────────────────────

export const BRAND_VOICE = {
  personality: {
    primary: "The experienced foreman who also happens to be tech-savvy",
    traits: [
      "Practical but not boring — we lead with real job site results",
      "Confident but not arrogant — we respect every trade equally",
      "Data-driven but never dry — numbers serve stories, not the other way around",
      "Direct but not aggressive — we say what we mean without bravado",
      "Inclusive — a solo painter matters as much as a 10-person crew",
    ],
  },

  toneSpectrum: {
    formal_casual: 0.7, // lean casual — talk like a colleague, not a corporation
    serious_playful: 0.5, // balanced — construction is serious work, but the culture has humor
    reserved_enthusiastic: 0.65, // lean enthusiastic — pride in the craft
    technical_simple: 0.5, // balanced — trades are technical, but content must be accessible
    safe_edgy: 0.4, // lean safe — trustworthy over edgy
  },

  vocabularyUse: [
    "vakman", "aannemer", "uitvoerder", "Handwerker", "Meister",
    "artisan", "contractor", "tradesperson", "job site", "werkplaats",
    "offerte", "factuur", "oplevering", "Abnahme", "devis",
    "compliance", "BTW", "MwSt", "TVA", "IVA", "VAT",
    "quote", "invoice", "punch list", "snag list",
    "HVAC", "first fix", "second fix", "rough-in",
    "on the tools", "white van", "bestelbus",
  ],

  vocabularyAvoid: [
    "disrupt", "synergy", "leverage", "ecosystem", "paradigm",
    "game-changer", "revolutionary", "bleeding edge", "pivot",
    "growth hacking", "10x", "unicorn", "move fast and break things",
    "hustle culture", "grind", "crush it",
    "construction tech", // too generic — say "trades platform"
    "proptech", // we're not real estate
    "SaaS tool", // too corporate
  ],

  rules: [
    "NEVER start a video with the VascoApp logo or brand intro",
    "NEVER mock or belittle any trade — roofers, painters, plumbers are equally respected",
    "NEVER show fake app screenshots or mockups — only real working app",
    "NEVER use US-centric terminology (e.g., 'general contractor' without EU context)",
    "NEVER hard-sell — let the work and the results speak",
    "NEVER claim to replace human judgment — AI assists, the tradesperson decides",
    "ALWAYS show real job sites, real tools, real materials",
    "ALWAYS include a specific number or concrete result (€ saved, minutes saved, jobs won)",
    "ALWAYS use the local language naturally — don't force English on non-EN markets",
    "ALWAYS show the app doing real things — scanning invoices, generating quotes, tracking jobs",
    "ALWAYS respect regional differences — a Dutch loodgieter is not a British plumber",
  ],
};

// ─── SECTION 3: VISUAL IDENTITY (VIDEO SPECIFIC) ────────────────────────

export const VISUAL_IDENTITY = {
  colors: {
    primary: "#E35205", // Hermes Orange
    secondary: "#0D1B2A", // Navy
    accent: "#1E3A8A", // Deep Blue
    success: "#10B981", // Emerald
    danger: "#EF4444", // Red
    text: "#333333",
    background: "#F2F2F7",
    cardBg: "#FFFFFF",
  },

  shotRules: {
    format: "9:16 vertical (1080×1920)",
    safeZone: "Keep key content in center 80% — avoid TikTok UI overlap zones",
    textPlacement: "Lower third for captions, upper third for hook text",
    appOverlay: "Show app naturally on phone screen — never full-screen app demo until reveal moment",
    revealMoment: "App reveal between 3-8 seconds — after the hook lands",
    firstFrame: "Must be visually arresting: transformation result, impressive job, or striking close-up",
    closingFrame: "End on completed work or satisfied contractor — never a logo slide",
  },

  editingPace: {
    hookWindow: "0-1.5s: deliver the hook — transformation reveal, bold claim, or question",
    retentionBridge: "1.5-3s: tease the payoff — 'and here's how I did it' / 'watch what happens'",
    contentBody: "3-12s: deliver value — show the process, the app, the result",
    cta: "Last 3-5s: natural CTA — 'link in bio if you want to try this'",
    cutFrequency: "New visual every 2-3 seconds — match the pace of the trade work",
    textOnScreen: "Every spoken stat must appear as text overlay within 0.5s",
  },

  typography: {
    hookText: "Bold, large, high contrast — white on dark or orange on white",
    priceReveal: "Large number with € symbol — always specific (€12,400 not 'thousands')",
    itemNames: "Clean sans-serif, readable at mobile distance",
    cta: "Subtle but clear — not a banner, more like a suggestion",
  },

  soundDesign: {
    hookHit: "Sharp transition sound on hook reveal — satisfying click or whoosh",
    revealSting: "Subtle 'ding' or completion sound when showing finished work",
    transitionSwipe: "Quick swipe sound between before/after",
    backgroundMusic: "Trending sounds first, instrumental lo-fi second — never generic corporate",
    voiceover: "Native speaker, natural pace — sounds like talking to a colleague, not reading a script",
  },
};

// ─── SECTION 4: PRODUCT CONTEXT ─────────────────────────────────────────

export const PRODUCT_CONTEXT = {
  features: [
    {
      id: "ai-insights",
      name: "45 AI Intelligence Generators",
      hook: "Your business advisor that never sleeps",
      detail: "Cash flow predictions, quote win probability, payment timing forecasts, pricing benchmarks",
      contentAngle: "Show a contractor checking AI insights before writing a quote",
      demoScript: "Open app → AI tab → 'You should raise plumbing rates 12% — here's why' → reaction",
      wowFactor: 10,
    },
    {
      id: "quote-speed",
      name: "2-Minute Quotes",
      hook: "Write a professional quote faster than making coffee",
      detail: "AI pre-fills from job details, 30 trade-specific templates, digital signature capture",
      contentAngle: "Timer challenge: create a real quote in under 2 minutes",
      demoScript: "Start timer → new quote → select template → adjust → send → stop timer → '1:47!'",
      wowFactor: 9,
    },
    {
      id: "invoice-scan",
      name: "Invoice Photo Scanning",
      hook: "Snap a photo, get the data",
      detail: "AI vision extracts line items, amounts, VAT from supplier invoices",
      contentAngle: "Stack of paper invoices → phone scan → organized digital records",
      demoScript: "Show messy desk → photo each invoice → Vasco extracts data → clean dashboard",
      wowFactor: 9,
    },
    {
      id: "eve-agent",
      name: "EVE AI Assistant",
      hook: "An AI that does your admin while you're on the tools",
      detail: "3-agent model: Agent (execution), Auditor (compliance), Analyst (intelligence) — prepares work for one-tap approval",
      contentAngle: "Show EVE queue at end of day: 'Approve these 5 actions with one tap'",
      demoScript: "End of work day → open EVE → '5 actions ready' → tap approve → done in 10s",
      wowFactor: 10,
    },
    {
      id: "compliance",
      name: "6-Country Compliance",
      hook: "Never worry about changing regulations again",
      detail: "XRechnung (DE), ZUGFeRD, Factur-X (FR), FatturaPA (IT), Peppol — auto-updated",
      contentAngle: "Split screen: stressed contractor Googling regulations vs. calm Vasco user",
      demoScript: "Show compliance alert → one-tap update → 'You're covered for 2026 rules'",
      wowFactor: 8,
    },
    {
      id: "one-tap-invoice",
      name: "One-Tap Invoicing",
      hook: "Job done? Invoice sent before you leave the site",
      detail: "Quote-to-job-to-invoice pipeline, automatic numbering, e-invoice format selection",
      contentAngle: "Walking out of a finished bathroom → tap → invoice sent → payment pending",
      demoScript: "Show finished work → open app → convert quote to invoice → send → walk to van",
      wowFactor: 8,
    },
    {
      id: "payment-tracking",
      name: "Payment Tracking + Reminders",
      hook: "No more chasing payments — the app does it for you",
      detail: "Mollie integration, automatic reminders via WhatsApp/email, payment status dashboard",
      contentAngle: "Show the 'chase' — calling clients — vs. automatic reminders doing the work",
      demoScript: "Old way: calling → voicemail → frustration. New way: Vasco sends reminders → money arrives",
      wowFactor: 7,
    },
    {
      id: "purchasing-agent",
      name: "AI Purchasing Agent",
      hook: "Never overpay for materials again",
      detail: "Price comparison, bulk optimization, supplier scoring, seasonal stock-up alerts",
      contentAngle: "Show price comparison across suppliers → savings revealed",
      demoScript: "Need copper pipe → Vasco compares 5 suppliers → 'Save €340 by ordering from X'",
      wowFactor: 8,
    },
  ],

  stats: {
    aiGenerators: 45,
    trades: 15,
    countries: 6,
    languages: 6,
    accountingIntegrations: 19,
    eInvoiceFormats: 8,
    suppliers: 36,
    quoteTemplates: 30,
    automationPacks: 7,
  },

  differentiators: [
    {
      vs: "ServiceTitan",
      advantage: "10x cheaper (€19/seat vs €245/seat), EU-native, AI-first, free tier",
      contentProof: "Side-by-side: ServiceTitan setup cost ($5-50K) vs. Vasco download (free, 2 min)",
    },
    {
      vs: "Procore",
      advantage: "Built for solo/small teams, not enterprise. Affordable. Mobile-first.",
      contentProof: "Solo plumber's daily workflow entirely on phone — no desktop needed",
    },
    {
      vs: "Spreadsheets / Paper",
      advantage: "AI catches what spreadsheets miss: duplicate invoices, missed follow-ups, pricing gaps",
      contentProof: "Show paper chaos → organized Vasco dashboard → 'I found €2,400 in unbilled work'",
    },
    {
      vs: "Generic invoicing apps",
      advantage: "Trade-specific: material databases, compliance, benchmarks, certification tracking",
      contentProof: "Generic app can't calculate gas work quote — Vasco has trade-specific templates",
    },
    {
      vs: "WhatsApp + Notes app",
      advantage: "Everything connected: quote → job → invoice → payment → insight. No copy-pasting.",
      contentProof: "'I used to send quotes via WhatsApp photo — now clients get a professional PDF in 30 seconds'",
    },
  ],
};

// ─── SECTION 5: CTA ARCHITECTURE ────────────────────────────────────────

export const CTA_SYSTEM = {
  primaryCTAs: [
    {
      id: "download-free",
      text: "Download free — link in bio",
      subtext: "Start with the free tier, no credit card needed",
      bestFor: ["before-after", "day-in-life", "project-showcase"],
      conversionPath: "video → profile → link → App Store → install → first job created",
    },
    {
      id: "try-quote",
      text: "Try writing a quote in 2 minutes — link in bio",
      subtext: "Challenge-based CTA for quote-related content",
      bestFor: ["tutorial", "tip", "challenge"],
      conversionPath: "video → profile → link → App Store → install → first quote sent",
    },
    {
      id: "check-compliance",
      text: "Check if you're compliant — free scan in the app",
      subtext: "Fear-based CTA for compliance content",
      bestFor: ["compliance-tips", "myth-busting"],
      conversionPath: "video → profile → link → App Store → install → compliance check",
    },
    {
      id: "see-savings",
      text: "See how much you could save — link in bio",
      subtext: "Curiosity-based CTA for money/efficiency content",
      bestFor: ["tool-review", "testimonial", "business-growth"],
      conversionPath: "video → profile → link → App Store → install → AI insights viewed",
    },
    {
      id: "join-contractors",
      text: "Join 5,000+ EU contractors — link in bio",
      subtext: "Social proof CTA for community content",
      bestFor: ["contractor-life", "testimonial"],
      conversionPath: "video → profile → link → App Store → install → onboarding complete",
    },
  ],

  deliveryRules: [
    "CTA must feel like a natural extension of the content — not a commercial break",
    "Best pattern: 'If you want to try this yourself...' (permission-based)",
    "Show the app doing the thing you just talked about — proof before ask",
    "Never say 'download now' or 'click the link' — too salesy",
    "In non-English markets, deliver CTA in native language",
    "One CTA per video maximum — split focus kills conversion",
  ],
};

// ─── SECTION 6: PLATFORM CONTEXT ────────────────────────────────────────

export const PLATFORM_CONTEXT = {
  tiktok: {
    algorithmPriority: [
      { signal: "Watch time / completion rate", weight: "HIGHEST", tactic: "Hook in 1.5s, deliver value throughout — no dead spots" },
      { signal: "Replays", weight: "HIGHEST", tactic: "Include a detail worth rewatching — a price, a technique, a result" },
      { signal: "Shares", weight: "HIGH", tactic: "Make content useful enough to send to a colleague — tips, templates, warnings" },
      { signal: "Comments", weight: "HIGH", tactic: "Ask a question or show something debatable — 'Would you have done this differently?'" },
      { signal: "Follows from video", weight: "HIGH", tactic: "Tease next content — 'Part 2 tomorrow: the cost breakdown'" },
      { signal: "Saves / bookmarks", weight: "MEDIUM", tactic: "Include specific numbers, prices, or step-by-step processes" },
      { signal: "Profile visits", weight: "MEDIUM", tactic: "Leave CTA curious — 'Check the app in my bio to see your numbers'" },
    ],

    posting: {
      frequency: "3-5 videos per pod per week",
      bestTimes: "6-8 AM (before work), 12-1 PM (lunch), 6-8 PM (after work) — local time per market",
      hashtagStrategy: "3-5 relevant hashtags. Mix: 1 broad (#construction), 2 niche (#loodgieter, #plumbertok), 1-2 trending",
      captionLength: "Short and punchy — 1-2 sentences max. Hook or question format.",
      soundStrategy: "Trending sounds first (check weekly). If no fit, use lo-fi instrumental. Native voiceover always beats text-to-speech.",
    },

    winningPatterns: [
      { pattern: "Before/after transformation with price reveal", why: "Combines visual satisfaction with financial curiosity — highest share rate" },
      { pattern: "Day-in-the-life with unexpected app moment", why: "Relatable routine builds trust, app reveal feels natural not forced" },
      { pattern: "Myth-busting about trade business admin", why: "Contractors love correcting misconceptions — drives comments" },
      { pattern: "Speed challenge (quote in 2 min, invoice in 1 tap)", why: "Tangible proof of value — viewers can time it themselves" },
      { pattern: "Money reveal (weekly/monthly earnings breakdown)", why: "Financial content has highest save rate in trades niche" },
      { pattern: "Tool/material comparison with data", why: "Practical value drives saves and shares to colleagues" },
      { pattern: "Compliance scare + easy fix", why: "Fear → relief arc has highest completion rate" },
    ],
  },

  instagram: {
    format: "Reels (same 9:16 content), cross-posted from TikTok with native upload",
    notes: "Remove TikTok watermark before posting. Slightly longer captions OK on IG.",
  },
};

// ─── SECTION 7: COMPETITIVE LANDSCAPE ───────────────────────────────────

export const COMPETITIVE_LANDSCAPE = {
  directCompetitors: [
    {
      name: "ServiceTitan",
      strength: "Market leader in US, deep HVAC/plumbing workflows",
      weakness: "US-only, $5-50K setup, $245-500/tech/month, no EU compliance, English only",
      contentAngle: "Cost comparison: show what €19/month gets you vs. what $500/month gets them",
    },
    {
      name: "Procore",
      strength: "Enterprise construction management, strong in large commercial",
      weakness: "Built for $50M+ projects, overkill for trades, no mobile-first trades workflows",
      contentAngle: "'I'm a solo electrician, not building a stadium — I need THIS instead'",
    },
    {
      name: "Jobber",
      strength: "Good SMB field service in North America",
      weakness: "No EU compliance, limited AI, no e-invoicing formats, no trade-specific intelligence",
      contentAngle: "Show EU-specific features Jobber can't do: XRechnung, BTW filing, Mollie payments",
    },
  ],

  indirectCompetitors: [
    {
      name: "Excel / Google Sheets",
      strength: "Free, familiar, flexible",
      weakness: "No automation, no AI insights, no compliance, manual errors, no mobile workflow",
      contentAngle: "'I tracked jobs in Excel for 5 years — here's what I was missing'",
    },
    {
      name: "WhatsApp + Paper",
      strength: "Zero learning curve",
      weakness: "Lost quotes, forgotten invoices, no payment tracking, no analytics",
      contentAngle: "Show the WhatsApp scroll of shame: quotes lost in group chats",
    },
    {
      name: "Generic invoicing (Moneybird, Lexoffice alone)",
      strength: "Good for invoicing specifically",
      weakness: "Not trade-specific, no AI, no job management, no compliance gating, no benchmarks",
      contentAngle: "'Moneybird does invoices. Vasco does your entire business.'",
    },
  ],
};

// ─── SECTION 8: CONTENT ANGLES ──────────────────────────────────────────

export const CONTENT_ANGLES = [
  {
    id: "money-reveal",
    name: "Money & Earnings Reveal",
    description: "Show financial results: weekly earnings, quote values, savings from AI insights",
    emotionalTrigger: "Curiosity → Aspiration → 'I could do that too' → download",
    hookPatterns: [
      "I made €{amount} this week as a {trade} — here's how",
      "This one AI tip saved me €{amount} on materials",
      "My highest quote ever: €{amount}. Here's what I did different.",
      "€{amount}/month as a solo {trade} in {country} — breakdown",
    ],
    bestTemplates: ["project-showcase", "day-in-life", "testimonial"],
    exampleScript:
      "Hook: '€14,200 in one week as a solo plumber.' " +
      "Body: Show the 3 jobs, walk through quote process in Vasco. " +
      "Reveal: 'Vasco's AI told me to raise my rates 15% — I was undercharging.' " +
      "CTA: 'Check your pricing — free in the app, link in bio.'",
  },
  {
    id: "speed-challenge",
    name: "Speed & Efficiency Challenge",
    description: "Demonstrate time savings: 2-min quotes, 1-tap invoices, instant compliance checks",
    emotionalTrigger: "Skepticism → Surprise → 'That's actually fast' → download",
    hookPatterns: [
      "Professional quote in under 2 minutes — watch",
      "Job done → invoice sent before I reach the van",
      "Old way: 45 minutes of admin. New way: 3 taps.",
      "I used to spend {hours} hours on paperwork. Now it's {minutes} minutes.",
    ],
    bestTemplates: ["tutorial", "before-after", "challenge"],
    exampleScript:
      "Hook: 'Professional quote in under 2 minutes — let me prove it.' " +
      "Body: Timer on screen, create real quote step-by-step. " +
      "Reveal: Stop timer at 1:47. Show the professional PDF. " +
      "CTA: 'Try it yourself — free tier, link in bio.'",
  },
  {
    id: "transformation",
    name: "Before/After Transformation",
    description: "Dramatic visual transformation of a project — the trade's best content format",
    emotionalTrigger: "Anticipation → Satisfaction → Pride → 'Who did this? → I want this app'",
    hookPatterns: [
      "This {room} was a disaster. Watch what we did.",
      "3 days. €{amount}. Unrecognizable.",
      "Client said it couldn't be done in {timeframe}.",
      "Before you swipe — guess the price.",
    ],
    bestTemplates: ["before-after", "project-showcase"],
    exampleScript:
      "Hook: Show destroyed bathroom (0.5s). 'This was last Monday.' " +
      "Body: Time-lapse of work. Quick app shot — quote sent from site. " +
      "Reveal: Stunning finished bathroom. '€8,400. Quoted in Vasco, paid in Vasco.' " +
      "CTA: 'Link in bio to manage your projects like this.'",
  },
  {
    id: "compliance-scare",
    name: "Compliance Scare + Easy Fix",
    description: "Highlight a regulation change or common mistake, then show the easy fix in Vasco",
    emotionalTrigger: "Fear → Relief → Trust → 'I need this protection' → download",
    hookPatterns: [
      "New {country} regulation in 2026 — are you ready?",
      "This invoice mistake can cost you €{amount} in fines",
      "{percentage}% of {trade} contractors fail this compliance check",
      "Your {document} is probably wrong — here's how to check",
    ],
    bestTemplates: ["tip", "myth-busting", "compliance-tips"],
    exampleScript:
      "Hook: '67% of German contractors aren't ready for XRechnung 2026.' " +
      "Body: Explain what's changing (10s). Show confusion/stress. " +
      "Reveal: 'Vasco updates your invoices automatically — one toggle.' " +
      "CTA: 'Check your compliance status — free scan, link in bio.'",
  },
  {
    id: "contractor-life",
    name: "Day in the Life / Contractor Culture",
    description: "Authentic daily routine content that builds relatability and trust",
    emotionalTrigger: "Recognition → 'That's me!' → Community → 'These people get it' → follow + download",
    hookPatterns: [
      "5:30 AM. Coffee. Van. Let's go.",
      "Things they don't tell you about being a {trade}",
      "POV: You're a {trade} and the client changes their mind again",
      "A normal {day} as a solo {trade} in {city}",
    ],
    bestTemplates: ["day-in-life", "contractor-life", "behind-scenes"],
    exampleScript:
      "Hook: '5:30 AM. Third coffee. Van won't start.' " +
      "Body: Real morning routine → drive → arrive at site → work montage. " +
      "App moment: Check EVE queue at lunch — approve 3 follow-ups. " +
      "CTA: 'The app that runs my business while I'm on the tools — link in bio.'",
  },
  {
    id: "tool-material",
    name: "Tool & Material Reviews",
    description: "Practical reviews with data — prices, durability, comparisons",
    emotionalTrigger: "Practical need → Trust (real user) → Utility (save/share) → follow",
    hookPatterns: [
      "Best {material} for {application} — tested 5 brands",
      "Stop buying {product} — here's why",
      "€{cheap} vs €{expensive} {tool} — honest comparison",
      "The {tool} every {trade} needs but nobody talks about",
    ],
    bestTemplates: ["tool-review", "tutorial", "tip"],
    exampleScript:
      "Hook: '€25 vs €180 pipe cutter — is the expensive one worth it?' " +
      "Body: Side-by-side test on real materials. Show cut quality, speed, fatigue. " +
      "Data: 'Vasco's price index shows €180 cutter at 3 suppliers near you.' " +
      "CTA: 'Compare prices in the app — link in bio.'",
  },
  {
    id: "business-growth",
    name: "Business Growth & Tips",
    description: "Advice on growing a trade business — pricing, clients, scaling",
    emotionalTrigger: "Ambition → Learning → Confidence → 'This app helps me grow' → download",
    hookPatterns: [
      "How I went from €{low} to €{high}/month as a {trade}",
      "3 mistakes killing your trade business",
      "The quote trick that wins 80% of jobs",
      "Why I stopped undercharging — and what happened next",
    ],
    bestTemplates: ["testimonial", "tutorial", "business-growth"],
    exampleScript:
      "Hook: 'I raised my prices 25% and got MORE clients. Here's why.' " +
      "Body: Explain value-based pricing. Show Vasco's AI pricing insight. " +
      "Reveal: 'Vasco showed me I was 20% below market — data from 1,000+ contractors.' " +
      "CTA: 'Check your pricing — free insight, link in bio.'",
  },
];

// ─── HELPER: Get content angle by ID ────────────────────────────────────

export function getContentAngle(id: string) {
  return CONTENT_ANGLES.find((a) => a.id === id) ?? null;
}

// ─── HELPER: Get best CTA for a template/format ────────────────────────

export function getBestCTA(templateFormat: string) {
  return (
    CTA_SYSTEM.primaryCTAs.find((c) => c.bestFor.includes(templateFormat)) ??
    CTA_SYSTEM.primaryCTAs[0]
  );
}
