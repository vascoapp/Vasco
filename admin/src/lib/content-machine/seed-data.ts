// ═══════════════════════════════════════════════════════════════════════════
// CONTENT MACHINE — SEED DATA
// VascoApp construction trades adapted from generic content machine brief
// ═══════════════════════════════════════════════════════════════════════════

import type { ContentPillar, ContentAccount, Trade, LanguageCode } from "./types";

// ─── Content Accounts (6 market accounts) ──────────────────────────────────

export const ACCOUNTS: ContentAccount[] = [
  {
    id: "acc-eu",
    handle: "@vasco.eu",
    displayName: "Vasco EU",
    purpose: "Main brand — launches, hero content, conversion",
    platform: "tiktok",
    accountType: "brand",
    language: "en",
    contentFocus: ["money-reveal", "transformation", "compliance-scare"],
    isActive: true,
  },
  {
    id: "acc-nl",
    handle: "@vasco.nl",
    displayName: "Vasco NL",
    purpose: "Dutch market — tutorials, contractor life, tool reviews",
    platform: "tiktok",
    accountType: "language",
    language: "nl",
    contentFocus: ["contractor-life", "tool-tips", "business-growth"],
    isActive: true,
  },
  {
    id: "acc-de",
    handle: "@vasco.de",
    displayName: "Vasco DE",
    purpose: "German market — Handwerker, detailed tutorials, compliance",
    platform: "tiktok",
    accountType: "language",
    language: "de",
    contentFocus: ["compliance-tips", "tutorial", "tool-tips"],
    isActive: true,
  },
  {
    id: "acc-fr",
    handle: "@vasco.fr",
    displayName: "Vasco FR",
    purpose: "French market — artisan stories, brand storytelling",
    platform: "tiktok",
    accountType: "language",
    language: "fr",
    contentFocus: ["contractor-life", "project-showcase", "transformation"],
    isActive: true,
  },
  {
    id: "acc-es",
    handle: "@vasco.es",
    displayName: "Vasco ES",
    purpose: "Spanish market — lifestyle narratives, community",
    platform: "tiktok",
    accountType: "language",
    language: "es",
    contentFocus: ["contractor-life", "business-growth", "before-after"],
    isActive: true,
  },
  {
    id: "acc-it",
    handle: "@vasco.it",
    displayName: "Vasco IT",
    purpose: "Italian market — craftsmanship, expressive storytelling",
    platform: "tiktok",
    accountType: "language",
    language: "it",
    contentFocus: ["project-showcase", "contractor-life", "transformation"],
    isActive: true,
  },
];

// ─── Content Pillars ───────────────────────────────────────────────────────

export const PILLARS: ContentPillar[] = [
  {
    id: "pil-money",
    slug: "money-reveal",
    name: "Money Reveal",
    description: "Revenue, savings, earnings transparency — what contractors actually make",
    targetMixPct: 20,
    defaultCta: "Download Vasco free — track every euro",
    emoji: "💰",
    bestFormats: ["reveal", "day-in-life", "testimonial"],
    bestPresence: ["face", "voiceover"],
    isActive: true,
  },
  {
    id: "pil-speed",
    slug: "speed-challenge",
    name: "Speed Challenge",
    description: "How fast can you quote, invoice, complete a job — time-based content",
    targetMixPct: 15,
    defaultCta: "Send quotes in 30 seconds with Vasco",
    emoji: "⚡",
    bestFormats: ["timelapse", "challenge", "tutorial"],
    bestPresence: ["hands_only", "voiceover"],
    isActive: true,
  },
  {
    id: "pil-transform",
    slug: "transformation",
    name: "Before → After",
    description: "Job transformations, renovation reveals, workspace upgrades",
    targetMixPct: 15,
    defaultCta: "Document every project in Vasco",
    emoji: "🔄",
    bestFormats: ["before-after", "reveal", "timelapse"],
    bestPresence: ["voiceover", "hands_only"],
    isActive: true,
  },
  {
    id: "pil-compliance",
    slug: "compliance-scare",
    name: "Compliance Alert",
    description: "Regulation changes, certification requirements, fines to avoid",
    targetMixPct: 10,
    defaultCta: "Stay compliant with Vasco — checks built in",
    emoji: "⚠️",
    bestFormats: ["tip", "myth-busting", "tutorial"],
    bestPresence: ["face", "voiceover"],
    isActive: true,
  },
  {
    id: "pil-life",
    slug: "contractor-life",
    name: "Contractor Life",
    description: "Day in the life, van tours, job site stories, relatable moments",
    targetMixPct: 15,
    defaultCta: "Join 10,000+ contractors on Vasco",
    emoji: "🏗️",
    bestFormats: ["day-in-life", "POV", "behind-scenes"],
    bestPresence: ["face", "voiceover"],
    isActive: true,
  },
  {
    id: "pil-tool",
    slug: "tool-material",
    name: "Tool & Material",
    description: "Tool reviews, material comparisons, best buys, supplier deals",
    targetMixPct: 10,
    defaultCta: "Compare prices with Vasco's purchasing agent",
    emoji: "🔧",
    bestFormats: ["tool-review", "comparison", "tutorial"],
    bestPresence: ["hands_only", "voiceover"],
    isActive: true,
  },
  {
    id: "pil-growth",
    slug: "business-growth",
    name: "Business Growth",
    description: "Pricing strategies, getting more clients, scaling tips",
    targetMixPct: 10,
    defaultCta: "Grow smarter — download Vasco free",
    emoji: "📈",
    bestFormats: ["tip", "testimonial", "tutorial"],
    bestPresence: ["face", "voiceover"],
    isActive: true,
  },
  {
    id: "pil-proof",
    slug: "product-proof",
    name: "Product Proof",
    description: "Vasco app demos, feature showcases, user testimonials",
    targetMixPct: 5,
    defaultCta: "Try Vasco free today",
    emoji: "📱",
    bestFormats: ["tutorial", "testimonial", "comparison"],
    bestPresence: ["hands_only", "voiceover"],
    isActive: true,
  },
];

// ─── Trades (replaces "Characters" from generic brief) ─────────────────────

export const TRADES: Trade[] = [
  {
    id: "trade-plumbing",
    slug: "plumbing",
    name: "Plumbing",
    emoji: "🔧",
    shortDescription: "Pipe work, bathrooms, heating systems, emergency repairs",
    personalityTags: ["practical", "problem-solver", "essential"],
    heroMaterials: ["Milwaukee M18 Press Tool", "RIDGID RP 351", "Viega copper fittings"],
    isActive: true,
  },
  {
    id: "trade-electrical",
    slug: "electrical",
    name: "Electrical",
    emoji: "⚡",
    shortDescription: "Wiring, panels, EV chargers, smart home, solar",
    personalityTags: ["precise", "safety-focused", "tech-forward"],
    heroMaterials: ["Fluke T6 Tester", "Hager groepenkast", "Wago connectors"],
    isActive: true,
  },
  {
    id: "trade-painting",
    slug: "painting",
    name: "Painting",
    emoji: "🎨",
    shortDescription: "Interior/exterior, spray work, decorating, color consulting",
    personalityTags: ["creative", "detail-oriented", "transformative"],
    heroMaterials: ["Graco airless sprayer", "Festool sander", "Sikkens paint"],
    isActive: true,
  },
  {
    id: "trade-carpentry",
    slug: "carpentry",
    name: "Carpentry",
    emoji: "🪵",
    shortDescription: "Custom woodwork, kitchens, framing, furniture",
    personalityTags: ["craftsman", "creative", "traditional"],
    heroMaterials: ["Festool TS 55", "Makita planer", "Blum hinges"],
    isActive: true,
  },
  {
    id: "trade-tiling",
    slug: "tiling",
    name: "Tiling",
    emoji: "🧱",
    shortDescription: "Floor and wall tiling, mosaics, waterproofing",
    personalityTags: ["patient", "precise", "artistic"],
    heroMaterials: ["Rubi tile cutter", "Mapei adhesive", "Schluter profiles"],
    isActive: true,
  },
  {
    id: "trade-roofing",
    slug: "roofing",
    name: "Roofing",
    emoji: "🏠",
    shortDescription: "Flat roofs, pitched roofs, guttering, insulation",
    personalityTags: ["brave", "weather-tough", "essential"],
    heroMaterials: ["EPDM membrane", "Velux windows", "Makita circular saw"],
    isActive: true,
  },
  {
    id: "trade-hvac",
    slug: "gas-hvac",
    name: "Gas & HVAC",
    emoji: "🔥",
    shortDescription: "Boilers, heat pumps, air conditioning, gas safety",
    personalityTags: ["certified", "safety-critical", "tech-savvy"],
    heroMaterials: ["Vaillant ecoTEC", "Daikin heat pump", "Testo flue analyser"],
    isActive: true,
  },
];

// ─── Account Assignments ───────────────────────────────────────────────────

export const ACCOUNT_BY_PILLAR: Record<string, string> = {
  "money-reveal": "acc-eu",
  "speed-challenge": "acc-eu",
  "transformation": "acc-eu",
  "compliance-scare": "acc-eu",
  "contractor-life": "acc-nl",   // rotates across language accounts
  "tool-material": "acc-de",
  "business-growth": "acc-nl",
  "product-proof": "acc-eu",
};

// ─── Objective Mapping ─────────────────────────────────────────────────────

export const OBJECTIVE_BY_PILLAR: Record<string, ObjectiveType[]> = {
  "money-reveal": ["awareness", "conversion"],
  "speed-challenge": ["awareness", "proof"],
  "transformation": ["awareness", "proof"],
  "compliance-scare": ["learning", "retention"],
  "contractor-life": ["awareness", "retention"],
  "tool-material": ["learning", "conversion"],
  "business-growth": ["learning", "conversion"],
  "product-proof": ["conversion", "proof"],
};

import type { ObjectiveType, ContentFormat } from "./types";

export const FORMAT_BY_OBJECTIVE: Record<ObjectiveType, ContentFormat[]> = {
  awareness: ["before-after", "day-in-life", "POV", "challenge", "reveal"],
  proof: ["testimonial", "project-showcase", "comparison", "tutorial"],
  learning: ["tutorial", "tip", "tool-review", "myth-busting"],
  conversion: ["tutorial", "testimonial", "reveal", "comparison"],
  retention: ["day-in-life", "behind-scenes", "tip", "tool-review"],
};

// ─── Presence Mode Weights ─────────────────────────────────────────────────

export const PRESENCE_WEIGHTS: Record<string, number> = {
  hands_only: 35,
  voiceover: 30,
  face: 25,
  text_only: 10,
};

// ─── Posting Config ────────────────────────────────────────────────────────

export const POSTING_TIMES = ["07:00", "12:00", "18:00", "19:30", "21:00"];

export const ACCOUNT_WEEKLY_TARGETS: Record<string, number> = {
  "acc-eu": 5,
  "acc-nl": 4,
  "acc-de": 4,
  "acc-fr": 3,
  "acc-es": 3,
  "acc-it": 3,
};

export const WEEKLY_MINIMUMS: Record<string, number> = {
  "money-reveal": 3,
  "speed-challenge": 2,
  "transformation": 2,
  "compliance-scare": 1,
  "contractor-life": 3,
  "tool-material": 2,
  "business-growth": 2,
  "product-proof": 1,
};

// ─── Hashtag Localization ──────────────────────────────────────────────────

export const LOCALIZED_HASHTAGS: Record<LanguageCode, string[]> = {
  en: ["#contractor", "#trades", "#plumber", "#electrician", "#construction", "#VascoApp"],
  nl: ["#aannemer", "#vakman", "#loodgieter", "#elektricien", "#bouw", "#VascoApp"],
  de: ["#Handwerker", "#Baustelle", "#Klempner", "#Elektriker", "#Handwerk", "#VascoApp"],
  fr: ["#artisan", "#BTP", "#plombier", "#electricien", "#chantier", "#VascoApp"],
  es: ["#constructor", "#reformas", "#fontanero", "#electricista", "#obra", "#VascoApp"],
  it: ["#artigiano", "#edilizia", "#idraulico", "#elettricista", "#cantiere", "#VascoApp"],
};
