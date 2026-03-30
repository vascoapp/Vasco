// ═══════════════════════════════════════════════════════════════════════════
// VASCO AUDIENCE PERSONAS — Psychographic profiles for content targeting
// Maps to content angles, CTAs, and niche playbooks
// ═══════════════════════════════════════════════════════════════════════════

export interface Persona {
  id: string;
  name: string;
  headline: string;

  demographics: {
    ageRange: string;
    gender: string;
    income: string;
    location: string;
  };

  psychographics: {
    motivation: string;
    identity: string;
    socialBehavior: string;
    spendingPattern: string;
    riskTolerance: string;
  };

  usageProfile: {
    businessSize: string;
    trades: string[];
    techLevel: string;
    currentTools: string;
    painLevel: string;
  };

  contentTriggers: Array<{
    trigger: string;
    why: string;
    bestAngle: string;
  }>;

  objections: Array<{
    objection: string;
    reframe: string;
    proofPoint: string;
  }>;

  conversionPath: {
    discoveryChannel: string;
    decisionDriver: string;
    activationMoment: string;
    retentionHook: string;
  };

  platformBehavior: {
    watchTime: string;
    engagementStyle: string;
    followsAccountsLike: string;
    sharesTrigger: string;
  };
}

// ─── PERSONA 1: THE AMBITIOUS SOLO ──────────────────────────────────────

const AMBITIOUS_SOLO: Persona = {
  id: "ambitious-solo",
  name: "The Ambitious Solo",
  headline: "Solo contractor who wants to grow but admin is holding them back",

  demographics: {
    ageRange: "25-38",
    gender: "85% male, 15% female (growing)",
    income: "€35,000-65,000/year",
    location: "Urban/suburban, all EU6 markets",
  },

  psychographics: {
    motivation: "Earn more, work smarter, build a reputation — prove they can make it on their own",
    identity: "Sees themselves as an entrepreneur, not just a worker. Proud of their independence.",
    socialBehavior: "Active on TikTok/Instagram. Shares work photos. Follows other contractors for tips.",
    spendingPattern: "Invests in tools that save time. Will pay for quality. But needs to see clear ROI first.",
    riskTolerance: "Moderate — willing to try new things but can't afford to waste money on subscriptions that don't deliver",
  },

  usageProfile: {
    businessSize: "Solo, maybe 1 helper occasionally",
    trades: ["plumbing", "electrical", "painting", "carpentry", "tiling"],
    techLevel: "Comfortable with phone apps, uses banking apps and WhatsApp business already",
    currentTools: "WhatsApp for client comms, Excel/paper for quotes, basic accounting app (Moneybird, etc.)",
    painLevel: "HIGH — spending 5-10 hours/week on admin they hate",
  },

  contentTriggers: [
    {
      trigger: "Money reveal — weekly/monthly earnings breakdown",
      why: "Validates their income ambitions, benchmarks against their own earnings",
      bestAngle: "money-reveal",
    },
    {
      trigger: "Speed challenge — see how fast real work gets done",
      why: "Time is money for solo contractors — anything that saves time is immediately relevant",
      bestAngle: "speed-challenge",
    },
    {
      trigger: "Before/after transformations with price tags",
      why: "Combines craft pride with financial curiosity — 'I could charge that much?'",
      bestAngle: "transformation",
    },
    {
      trigger: "Business growth tips from other solos",
      why: "Peer learning is their primary education channel — 'someone like me figured this out'",
      bestAngle: "business-growth",
    },
  ],

  objections: [
    {
      objection: "I don't need another app — I manage fine with WhatsApp",
      reframe: "WhatsApp works until you forget a follow-up or lose a quote in a group chat. How many €500+ quotes have you lost?",
      proofPoint: "Video: scroll through WhatsApp, find 3 lost quotes. Open Vasco, show organized pipeline. 'Found €2,400 in forgotten quotes.'",
    },
    {
      objection: "I can't afford a subscription right now",
      reframe: "Start free — no credit card, no trial. Use it until the free tier isn't enough. Most contractors upgrade within 3 months because the AI pays for itself.",
      proofPoint: "Video: 'I used the free tier for 2 months. The AI told me I was undercharging by 18%. That one insight paid for 3 years of the app.'",
    },
    {
      objection: "I'm too busy to learn a new tool",
      reframe: "If you're too busy for admin, that's exactly why you need this. Set up takes 5 minutes, and EVE handles the rest.",
      proofPoint: "Video: timer — full setup from download to first quote sent in under 5 minutes.",
    },
  ],

  conversionPath: {
    discoveryChannel: "TikTok (trade-specific content), word of mouth from other contractors",
    decisionDriver: "Seeing a real contractor their size using it successfully — peer proof, not corporate marketing",
    activationMoment: "First quote sent via the app — 'This actually looks professional'",
    retentionHook: "AI insights start appearing after 2-3 weeks of data — 'I didn't know I was leaving this much money on the table'",
  },

  platformBehavior: {
    watchTime: "Scrolls TikTok 20-30 min/day, mostly during breaks and evenings",
    engagementStyle: "Likes and saves useful content. Comments on controversial takes. Shares tools/tips with contractor friends.",
    followsAccountsLike: "Other solo contractors, tool reviewers, trade-specific accounts",
    sharesTrigger: "Practical value — 'My mate needs to see this' (tips, tools, pricing insights)",
  },
};

// ─── PERSONA 2: THE ESTABLISHED PRO ────────────────────────────────────

const ESTABLISHED_PRO: Persona = {
  id: "established-pro",
  name: "The Established Pro",
  headline: "Experienced tradesperson with a small team who needs systems, not just tools",

  demographics: {
    ageRange: "35-50",
    gender: "90% male",
    income: "€55,000-100,000/year",
    location: "Suburban, established service area, all EU6",
  },

  psychographics: {
    motivation: "Protect what they've built. Scale without chaos. Reduce stress from growing.",
    identity: "Business owner first, tradesperson second. They've proven their craft — now they need to prove their business skills.",
    socialBehavior: "Less active on social media personally, but follows industry content. Relies on reputation and referrals.",
    spendingPattern: "Willing to pay for premium tools and services. Evaluates ROI carefully. Annual billing preferred.",
    riskTolerance: "Low — has too much to lose. Needs proven solutions with good support.",
  },

  usageProfile: {
    businessSize: "2-5 employees, possibly 1-2 subcontractors",
    trades: ["plumbing", "electrical", "gas-hvac", "carpentry", "roofing"],
    techLevel: "Uses basic business apps but not tech-savvy. Needs things to 'just work'.",
    currentTools: "Accounting software (Moneybird/DATEV/Xero), maybe Jobber or a CRM, lots of email",
    painLevel: "VERY HIGH — team management + client management + compliance = overwhelmed",
  },

  contentTriggers: [
    {
      trigger: "Team efficiency and delegation stories",
      why: "Their biggest pain is doing everything themselves — seeing someone delegate to an AI is aspirational",
      bestAngle: "speed-challenge",
    },
    {
      trigger: "Compliance changes and how to handle them",
      why: "Compliance is a real business risk at their scale — fines can be significant",
      bestAngle: "compliance-scare",
    },
    {
      trigger: "Revenue and profitability analysis",
      why: "They want to know if they're making good decisions — data validates their instincts",
      bestAngle: "money-reveal",
    },
  ],

  objections: [
    {
      objection: "I already have accounting software — why do I need this too?",
      reframe: "Your accounting software does invoices. Vasco does the 80% that happens before and after: quoting, job tracking, compliance, AI insights, payment chasing. They work together.",
      proofPoint: "Video: 'My accountant uses Moneybird. I use Vasco. Together we save 8 hours a week.'",
    },
    {
      objection: "My team won't use another app",
      reframe: "They don't have to learn much. Worker accounts are simple: clock in, update job status, take photos. The AI handles the rest.",
      proofPoint: "Video: show worker using minimal interface — 3 taps total in a work day.",
    },
    {
      objection: "I've been doing this 15 years without an app",
      reframe: "And you've probably been leaving money on the table for 15 years. The AI finds pricing gaps, unbilled work, and missed follow-ups that add up to thousands per year.",
      proofPoint: "Video: 'Vasco found €4,200 in work I forgot to invoice in my first month. That's what 15 years of 'fine' was costing me.'",
    },
  ],

  conversionPath: {
    discoveryChannel: "LinkedIn, trade associations, word of mouth, sees it on a subcontractor's phone",
    decisionDriver: "Compliance automation + team visibility. Pain relief over aspiration.",
    activationMoment: "EVE queues up actions after first week of data — 'It actually catches things I miss'",
    retentionHook: "Team scorecards and job tracking become operationally essential within 30 days",
  },

  platformBehavior: {
    watchTime: "Less TikTok, more LinkedIn and YouTube. 10-15 min sessions.",
    engagementStyle: "Saves content for later review. Rarely comments. Shares privately via WhatsApp to business partners.",
    followsAccountsLike: "Business advice accounts, industry leaders, trade association pages",
    sharesTrigger: "Content that validates a decision they're already considering — 'See, I told you we need this'",
  },
};

// ─── PERSONA 3: THE YOUNG APPRENTICE ───────────────────────────────────

const YOUNG_APPRENTICE: Persona = {
  id: "young-apprentice",
  name: "The Young Apprentice",
  headline: "Just starting their trade career — digital native looking for the modern way to do business",

  demographics: {
    ageRange: "18-27",
    gender: "80% male, 20% female",
    income: "€18,000-35,000/year (growing)",
    location: "All EU6, often still in training or first 2-3 years",
  },

  psychographics: {
    motivation: "Build a career they can be proud of. Eventually go solo. Learn from the best.",
    identity: "Digital native who happens to work with their hands. Sees trade work as a smart career choice.",
    socialBehavior: "Very active on TikTok and Instagram. Posts their own work regularly. Follows trade influencers.",
    spendingPattern: "Budget-conscious but will invest in tools and training. Free tier is perfect entry point.",
    riskTolerance: "High — nothing to lose, everything to learn. Will try anything once.",
  },

  usageProfile: {
    businessSize: "Employed or just starting solo",
    trades: ["plumbing", "electrical", "painting", "carpentry", "tiling", "roofing", "gas-hvac"],
    techLevel: "Very high — grew up with smartphones, learns from YouTube and TikTok",
    currentTools: "Phone notes, WhatsApp, maybe a free invoicing app",
    painLevel: "LOW now, but growing as they take on their own jobs",
  },

  contentTriggers: [
    {
      trigger: "Day-in-the-life content from young contractors",
      why: "Representation — seeing someone their age succeeding in trades validates their career choice",
      bestAngle: "contractor-life",
    },
    {
      trigger: "Earnings reveals from young solo contractors",
      why: "Financial aspiration — 'If they can make €5K/month at 24, so can I'",
      bestAngle: "money-reveal",
    },
    {
      trigger: "Tool reviews and technique tutorials",
      why: "Still building skills and kit — every recommendation is potentially useful",
      bestAngle: "tool-material",
    },
  ],

  objections: [
    {
      objection: "I'm still employed — I don't need business software",
      reframe: "Start tracking your skills and building your portfolio now. When you go solo, you'll be ready from day one. It's free.",
      proofPoint: "Video: 'I downloaded Vasco 6 months before going solo. By day one, I had templates, pricing data, and 3 clients lined up.'",
    },
    {
      objection: "I'm not sure I'll stay in trades",
      reframe: "Fair enough. But while you're here, why not get paid properly? The AI shows you market rates so you know your worth.",
      proofPoint: "Video: 'I was getting paid €14/hour as an apprentice. Vasco showed me the market rate was €22. I renegotiated.'",
    },
  ],

  conversionPath: {
    discoveryChannel: "TikTok (almost exclusively), Instagram Reels",
    decisionDriver: "Cool factor + peer usage. If other young contractors use it, they want it.",
    activationMoment: "Creating their first professional-looking quote — 'This makes me look legit'",
    retentionHook: "Portfolio building — tracking completed jobs and sharing professional results",
  },

  platformBehavior: {
    watchTime: "60+ min/day TikTok, heavy Instagram usage",
    engagementStyle: "Comments frequently, shares to stories, creates response videos",
    followsAccountsLike: "Young contractors, tool review accounts, trade meme pages, lifestyle content",
    sharesTrigger: "Relatable content — 'That's literally me' moments. Also impressive work they aspire to.",
  },
};

// ─── PERSONA 4: THE RENOVATION GC (AANNEMER) ───────────────────────────

const RENOVATION_GC: Persona = {
  id: "renovation-gc",
  name: "The Renovation GC (Aannemer)",
  headline: "Multi-trade general contractor managing projects, subs, and clients — needs one system for everything",

  demographics: {
    ageRange: "35-55",
    gender: "90% male",
    income: "€80,000-200,000/year",
    location: "Urban/suburban, primarily NL/DE/UK",
  },

  psychographics: {
    motivation: "Run multiple projects smoothly. Keep subs accountable. Protect margin on every job.",
    identity: "Orchestrator. They don't do every trade — they manage the team that does. Success = smooth delivery.",
    socialBehavior: "LinkedIn-active. Trade association member. Industry events. Referral network.",
    spendingPattern: "Will pay premium for tools that save coordination time. Values reliability over features.",
    riskTolerance: "Very low — they carry liability for every sub's work. Need trustworthy systems.",
  },

  usageProfile: {
    businessSize: "5-15 people, mix of employees and regular subcontractors",
    trades: ["general", "multi-trade"],
    techLevel: "Moderate — uses project management basics, email-heavy, some accounting software",
    currentTools: "Excel project plans, WhatsApp groups per project, accounting software, maybe Procore",
    painLevel: "EXTREME — coordinating 5+ trades on 3+ projects simultaneously",
  },

  contentTriggers: [
    {
      trigger: "Project management efficiency — how to run 3 projects without losing your mind",
      why: "Their daily reality is chaos management — anything that reduces coordination overhead is gold",
      bestAngle: "speed-challenge",
    },
    {
      trigger: "Sub management and accountability tools",
      why: "Their biggest risk is subs not showing up or delivering poor work — they need visibility",
      bestAngle: "business-growth",
    },
    {
      trigger: "Compliance across trades and countries",
      why: "They carry liability for every trade on their site — compliance failures are personally costly",
      bestAngle: "compliance-scare",
    },
  ],

  objections: [
    {
      objection: "My subs won't use another app",
      reframe: "Vasco's free tier means there's zero cost barrier. And when your subs use it, you get real-time job updates without calling them.",
      proofPoint: "Video: 'I put 12 of my subs on Vasco free. Now I see every job status without a single phone call. Saved me 2 hours every day.'",
    },
    {
      objection: "I need enterprise software, not a mobile app",
      reframe: "You need software that works on site, not just in the office. Vasco is mobile-first because that's where construction happens.",
      proofPoint: "Video: standing on a building site, managing 3 projects from phone — approvals, quotes, sub updates. 'My office is my pocket.'",
    },
  ],

  conversionPath: {
    discoveryChannel: "LinkedIn, trade events, seeing subs use it, competitor research",
    decisionDriver: "Subcontractor network effect — if their subs already use it, the aannemer joins",
    activationMoment: "First multi-trade project overview — seeing all trades' status on one screen",
    retentionHook: "Subcontractor portal + change order tracking become impossible to live without",
  },

  platformBehavior: {
    watchTime: "LinkedIn daily, YouTube for industry content, minimal TikTok",
    engagementStyle: "Shares industry insights, comments on business strategy content, professional tone",
    followsAccountsLike: "Industry leaders, project management experts, trade association accounts",
    sharesTrigger: "Content that could help their network — 'All my aannemers need to see this'",
  },
};

// ─── PERSONA 5: THE CAREER SWITCHER ────────────────────────────────────

const CAREER_SWITCHER: Persona = {
  id: "career-switcher",
  name: "The Career Switcher",
  headline: "Left a desk job for a trade career — tech-savvy, eager, wants to do it right from day one",

  demographics: {
    ageRange: "28-42",
    gender: "70% male, 30% female",
    income: "€25,000-45,000/year (rebuilding from higher corporate salary)",
    location: "Urban, all EU6 markets (growing trend post-COVID)",
  },

  psychographics: {
    motivation: "Escape corporate life. Work with hands. Be their own boss. Combine tech skills with trade skills.",
    identity: "Not a 'traditional' tradesperson — they bring business thinking and tech literacy from their previous career.",
    socialBehavior: "Very active content consumers. Researches extensively before decisions. Likely to create their own content about the journey.",
    spendingPattern: "Willing to invest in the right tools upfront. Used to SaaS subscriptions from corporate life. Higher willingness to pay.",
    riskTolerance: "Calculated — they've already made the big risk (career change). Now they want to minimize operational risk.",
  },

  usageProfile: {
    businessSize: "Solo, just starting or 1-2 years in",
    trades: ["painting", "carpentry", "tiling", "landscaping"],
    techLevel: "Very high — former office worker, comfortable with all digital tools",
    currentTools: "Used sophisticated software before — now 'downgraded' to WhatsApp and notes. Frustrated by the gap.",
    painLevel: "MEDIUM — but growing fast as they realize how much admin trade business involves",
  },

  contentTriggers: [
    {
      trigger: "Career change stories — others who switched to trades",
      why: "Validates their decision. Reduces imposter syndrome. Builds confidence.",
      bestAngle: "contractor-life",
    },
    {
      trigger: "Business setup guides — how to go from employed to solo",
      why: "They're methodical planners from corporate background — they want the roadmap",
      bestAngle: "business-growth",
    },
    {
      trigger: "Tech tool reviews — modern solutions for trade businesses",
      why: "They expect modern tooling. They're disappointed by how 'behind' the trades industry is digitally.",
      bestAngle: "speed-challenge",
    },
  ],

  objections: [
    {
      objection: "I'm not a 'real' tradesperson yet — this seems like it's for established contractors",
      reframe: "The free tier is designed for exactly where you are. Start with 5 jobs and grow. The AI learns as you learn.",
      proofPoint: "Video: 'I switched from IT to painting 18 months ago. Vasco was my business partner from week one. Now I run 15 jobs a month.'",
    },
    {
      objection: "Will clients take me seriously if I use an app for quotes?",
      reframe: "Clients take you MORE seriously. A professional PDF quote from Vasco beats a handwritten estimate every time. It's the first impression that wins jobs.",
      proofPoint: "Video: show client reaction to professional Vasco quote vs. notepad estimate. 'I win 3 out of 4 quotes now.'",
    },
  ],

  conversionPath: {
    discoveryChannel: "TikTok trade content, Google search ('best app for trade business'), Reddit threads",
    decisionDriver: "Feature set and UX quality. They compare apps like they compared SaaS tools in their old job.",
    activationMoment: "First professional quote sent — 'This is what I was missing. This is how I differentiate.'",
    retentionHook: "AI insights + compliance checks make them feel confident in a new industry",
  },

  platformBehavior: {
    watchTime: "Heavy TikTok and YouTube consumer. Reddit lurker. Instagram for visual inspiration.",
    engagementStyle: "Researches deeply. Reads comments. Compares alternatives. Will leave detailed reviews.",
    followsAccountsLike: "Career change accounts, business startup content, trade-specific educational channels",
    sharesTrigger: "Content that bridges corporate and trade worlds — 'See? Trades are the smart career move.'",
  },
};

// ─── REGISTRY ───────────────────────────────────────────────────────────

export const CONTRACTOR_PERSONAS: Persona[] = [
  AMBITIOUS_SOLO,
  ESTABLISHED_PRO,
  YOUNG_APPRENTICE,
  RENOVATION_GC,
  CAREER_SWITCHER,
];

export function getPersona(id: string): Persona | null {
  return CONTRACTOR_PERSONAS.find((p) => p.id === id) ?? null;
}

export function getPersonasForAngle(angleId: string): Persona[] {
  return CONTRACTOR_PERSONAS.filter((p) =>
    p.contentTriggers.some((t) => t.bestAngle === angleId)
  );
}

export function getAllPersonaIds(): string[] {
  return CONTRACTOR_PERSONAS.map((p) => p.id);
}
