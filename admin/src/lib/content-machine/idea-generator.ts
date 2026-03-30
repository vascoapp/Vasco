// ═══════════════════════════════════════════════════════════════════════════
// CONTENT MACHINE — IDEA GENERATOR
// Generates 30 structured content ideas with hooks, shot lists, voiceovers
// ═══════════════════════════════════════════════════════════════════════════

import type { ContentIdea, ContentFormat, PresenceMode, ObjectiveType, LanguageCode } from "./types";
import {
  PILLARS, TRADES, ACCOUNTS, ACCOUNT_BY_PILLAR,
  OBJECTIVE_BY_PILLAR, FORMAT_BY_OBJECTIVE, PRESENCE_WEIGHTS,
  LOCALIZED_HASHTAGS,
} from "./seed-data";

// ─── Hook Templates (8-12 per pillar, with {TRADE}, {MATERIAL}, {AMOUNT} vars) ─

const HOOK_TEMPLATES: Record<string, string[]> = {
  "money-reveal": [
    "I made €{AMOUNT} this week as a {TRADE} — here's every job",
    "How much does a {TRADE} actually earn? Let me show you",
    "This one invoice was €{AMOUNT}. Here's the breakdown",
    "Stop undercharging — a {TRADE} should charge at least €{AMOUNT}/hour",
    "My best month ever as a {TRADE}: €{AMOUNT} revenue",
    "The real cost of running a {TRADE} business",
    "3 {TRADE} jobs that pay over €{AMOUNT} every time",
    "Why I raised my prices by 40% and got MORE clients",
    "This €{AMOUNT} job took me 2 hours. Here's how",
    "What nobody tells you about {TRADE} money",
  ],
  "speed-challenge": [
    "Quote sent in 30 seconds — watch this",
    "Can I invoice this {TRADE} job in under 1 minute?",
    "From photo to quote in 45 seconds as a {TRADE}",
    "Speed run: complete {TRADE} job documentation",
    "How fast can Vasco create a {TRADE} quote?",
    "I used to spend 2 hours on admin. Now it takes 10 minutes",
    "The 30-second invoice challenge for {TRADE}s",
    "Watch me schedule a full week of {TRADE} jobs in 2 minutes",
    "AI wrote my {TRADE} quote and it was actually perfect",
    "Admin speed test: old way vs Vasco",
  ],
  "transformation": [
    "This {TRADE} job went from disaster to stunning",
    "72 hours of {TRADE} work in 60 seconds",
    "Client couldn't believe this was the same room",
    "The before was BAD. Watch the {TRADE} transformation",
    "Most satisfying {TRADE} job I've ever done",
    "They said it couldn't be fixed. Watch this {TRADE} prove them wrong",
    "From complete mess to perfection — {TRADE} magic",
    "This renovation took 3 weeks. Here's 60 seconds of it",
    "Before and after that made the client cry (happy tears)",
    "The worst job site I've walked into vs how I left it",
  ],
  "compliance-scare": [
    "This mistake could cost a {TRADE} €{AMOUNT} in fines",
    "New 2026 regulation every {TRADE} needs to know",
    "Are your {TRADE} certifications actually valid?",
    "3 compliance mistakes {TRADE}s make every day",
    "This {TRADE} got fined because they didn't check ONE thing",
    "EU regulation change: what every {TRADE} must do NOW",
    "Your insurance won't cover this {TRADE} work. Here's why",
    "Stop! Check this before starting any {TRADE} job",
    "The compliance checklist that saved my {TRADE} business",
    "Is your {TRADE} work actually legal? Most aren't sure",
  ],
  "contractor-life": [
    "Day in the life of a {TRADE} — unfiltered",
    "4:30 AM start as a {TRADE}. Here's my full day",
    "Things only {TRADE}s will understand",
    "POV: You're a {TRADE} and the client changes their mind... again",
    "What my van looks like after a week of {TRADE} work",
    "The moment every {TRADE} dreads on a Monday morning",
    "Nobody told me THIS about being a {TRADE}",
    "Biggest lesson from 10 years as a {TRADE}",
    "What I eat in a day as a {TRADE} (job site edition)",
    "Real talk: the loneliest part of being a solo {TRADE}",
    "My {TRADE} toolkit — everything I carry daily",
    "The client interaction that made me rethink everything",
  ],
  "tool-material": [
    "This {MATERIAL} changed my {TRADE} game completely",
    "Is the {MATERIAL} worth €{AMOUNT}? Honest review after 6 months",
    "Best budget tool for {TRADE}s under €{AMOUNT}",
    "Tool I wish I bought sooner as a {TRADE}",
    "Stop buying cheap {TRADE} tools. Here's why",
    "{MATERIAL} vs the competition — which wins?",
    "3 tools every {TRADE} apprentice needs day one",
    "This €{AMOUNT} tool saves me 2 hours every day",
    "Unpopular opinion: {MATERIAL} is overrated for {TRADE}s",
    "My top 5 {TRADE} tools ranked",
  ],
  "business-growth": [
    "How I went from 0 to 50 clients as a {TRADE}",
    "The pricing strategy that doubled my {TRADE} income",
    "3 ways to get more {TRADE} clients without ads",
    "Why most {TRADE} businesses fail in year 2",
    "I hired my first employee as a {TRADE}. Here's what happened",
    "The one app that changed my {TRADE} business",
    "Stop doing this if you want to grow your {TRADE} business",
    "Google reviews strategy for {TRADE}s that actually works",
    "How I manage 20+ jobs a week as a solo {TRADE}",
    "From employee to boss: my {TRADE} business journey",
  ],
  "product-proof": [
    "Watch Vasco handle a real {TRADE} quote in seconds",
    "My actual Vasco dashboard after 1 month as a {TRADE}",
    "Features I use daily as a {TRADE} on Vasco",
    "How Vasco's AI caught a €{AMOUNT} pricing error",
    "Vasco vs spreadsheets — real {TRADE} comparison",
    "The compliance check that saved my {TRADE} job",
    "I switched from [competitor] to Vasco. Here's the difference",
    "3 Vasco features every {TRADE} should know about",
  ],
};

// ─── Utility ───────────────────────────────────────────────────────────────

function randomId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return key;
  }
  return entries[0][0];
}

function pickPillarWeighted(): typeof PILLARS[number] {
  const weights: Record<string, number> = {};
  for (const p of PILLARS) weights[p.slug] = p.targetMixPct;
  const slug = pickWeighted(weights);
  return PILLARS.find((p) => p.slug === slug) ?? PILLARS[0];
}

function fillHook(template: string, trade: typeof TRADES[number]): string {
  const amounts = ["1,200", "2,500", "3,800", "5,000", "850", "15,000", "7,500", "450"];
  return template
    .replace(/\{TRADE\}/g, trade.name.toLowerCase())
    .replace(/\{MATERIAL\}/g, pickRandom(trade.heroMaterials))
    .replace(/\{AMOUNT\}/g, pickRandom(amounts));
}

function generateShotList(format: ContentFormat, trade: typeof TRADES[number]): string[] {
  const base: Record<string, string[]> = {
    "before-after": ["Wide shot of job site BEFORE", "Close-up of problem area", "Work in progress montage (3-5 clips)", "Reveal: wide shot AFTER", "Client reaction or final detail"],
    "tutorial": ["Intro: state what you'll teach", "Materials/tools laid out", "Step 1 close-up", "Step 2 medium shot", "Step 3 detail shot", "Final result + CTA"],
    "day-in-life": ["Morning routine / van loading", "Drive to first job", "Job site arrival", "Key moment of the day", "Lunch break", "End of day wrap-up"],
    "tool-review": ["Tool unboxing or reveal", "Specs / price on screen", "Real job test #1", "Real job test #2", "Verdict: worth it?"],
    "tip": ["Hook: state the tip", "Show the wrong way", "Show the right way", "Close-up of result", "CTA overlay"],
    "reveal": ["Teaser shot (blurred or covered)", "Build anticipation", "The reveal moment", "Reaction / detail shots", "Final beauty shot"],
    "timelapse": ["Setup: camera angle fixed", "Work begins", "Progress milestones (3-4)", "Completion", "Before/after side-by-side"],
    "testimonial": ["Client intro (name, location)", "What was the problem?", "How did you find us?", "What was the result?", "Would you recommend? + CTA"],
  };
  return base[format] ?? ["Hook shot", `${trade.name} work sequence (3-5 clips)`, "Result shot", "CTA overlay"];
}

function generateVoiceover(hook: string, concept: string, trade: typeof TRADES[number]): string {
  return `"${hook}"\n\n${concept}\n\nShow the ${trade.name.toLowerCase()} work process. End with a clear call to action.`;
}

function assessBoostable(idea: Partial<ContentIdea>): { paidCandidate: boolean; reason?: string } {
  const isBoostable =
    (idea.objectiveType === "awareness" || idea.objectiveType === "conversion") &&
    (idea.presenceMode === "face" || idea.presenceMode === "hands_only") &&
    (idea.format === "before-after" || idea.format === "tutorial" || idea.format === "reveal" || idea.format === "testimonial");
  return {
    paidCandidate: isBoostable,
    reason: isBoostable
      ? `Strong ${idea.format} with ${idea.presenceMode} presence — high watch-through potential`
      : undefined,
  };
}

function getDuration(format: ContentFormat): string {
  const durations: Record<string, string> = {
    "tutorial": "60-180s",
    "before-after": "30-60s",
    "timelapse": "15-45s",
    "day-in-life": "60-180s",
    "tip": "15-30s",
    "reveal": "15-45s",
    "tool-review": "60-120s",
    "testimonial": "30-60s",
    "challenge": "15-45s",
    "POV": "15-45s",
    "behind-scenes": "30-60s",
    "comparison": "30-60s",
    "myth-busting": "30-60s",
    "project-showcase": "30-60s",
  };
  return durations[format] ?? "30-60s";
}

function generateTitle(pillar: typeof PILLARS[number], trade: typeof TRADES[number], format: ContentFormat): string {
  return `${pillar.emoji} ${trade.name} ${format.replace(/-/g, " ")} — ${pillar.name}`;
}

function generateConcept(pillar: typeof PILLARS[number], trade: typeof TRADES[number], format: ContentFormat): string {
  const concepts: Record<string, string[]> = {
    "money-reveal": [
      `Show real ${trade.name.toLowerCase()} earnings with job-by-job breakdown. Transparent, no fluff — actual invoices and costs.`,
      `Break down a high-value ${trade.name.toLowerCase()} job: materials, labor, profit margin. Help viewers understand pricing.`,
    ],
    "speed-challenge": [
      `Race against the clock to complete ${trade.name.toLowerCase()} admin tasks using Vasco. Show the time savings vs traditional methods.`,
      `Side-by-side comparison: old way (paper/spreadsheet) vs Vasco for ${trade.name.toLowerCase()} job management.`,
    ],
    "transformation": [
      `Document a dramatic ${trade.name.toLowerCase()} transformation from start to finish. Focus on the contrast between before and after.`,
      `Show a challenging ${trade.name.toLowerCase()} repair where the outcome exceeded client expectations.`,
    ],
    "compliance-scare": [
      `Highlight a common ${trade.name.toLowerCase()} compliance mistake and show how to avoid it. Make it urgent and actionable.`,
      `Walk through the latest regulation change affecting ${trade.name.toLowerCase()}s — what to do right now.`,
    ],
    "contractor-life": [
      `Authentic day in the life of a ${trade.name.toLowerCase()}. No glamor, just real work — from first coffee to last invoice.`,
      `Relatable moments every ${trade.name.toLowerCase()} knows: difficult clients, unexpected problems, small victories.`,
    ],
    "tool-material": [
      `Honest review of ${pickRandom(trade.heroMaterials)} after months of daily use. What works, what doesn't, who should buy it.`,
      `Compare popular ${trade.name.toLowerCase()} tools head-to-head on a real job site. Clear winner at the end.`,
    ],
    "business-growth": [
      `Share a specific growth strategy that worked for a ${trade.name.toLowerCase()} business. Numbers and proof included.`,
      `Practical tips for ${trade.name.toLowerCase()}s to get more clients and charge what they're worth.`,
    ],
    "product-proof": [
      `Show Vasco in action on a real ${trade.name.toLowerCase()} workflow. Natural, not scripted — demonstrate genuine value.`,
      `Walk through the Vasco features most relevant to ${trade.name.toLowerCase()}s with real job data.`,
    ],
  };
  const options = concepts[pillar.slug] ?? [`Create engaging ${format} content about ${trade.name.toLowerCase()} work.`];
  return pickRandom(options);
}

function generateHashtags(pillar: typeof PILLARS[number], trade: typeof TRADES[number], lang: LanguageCode): string[] {
  const base = LOCALIZED_HASHTAGS[lang].slice(0, 3);
  const pillarTag = `#${pillar.slug.replace(/-/g, "")}`;
  const tradeTag = `#${trade.slug}`;
  return [...new Set([pillarTag, tradeTag, ...base])].slice(0, 6);
}

// ─── Main Generator ────────────────────────────────────────────────────────

export interface GenerateIdeasOptions {
  count?: number;
}

export function generateIdeas(opts: GenerateIdeasOptions = {}): ContentIdea[] {
  const count = opts.count ?? 30;
  const ideas: ContentIdea[] = [];
  const usedHooks = new Set<string>();

  for (let i = 0; i < count; i++) {
    const pillar = pickPillarWeighted();
    const trade = pickRandom(TRADES);
    const accountId = ACCOUNT_BY_PILLAR[pillar.slug] ?? "acc-eu";
    const account = ACCOUNTS.find((a) => a.id === accountId) ?? ACCOUNTS[0];

    const objectives = OBJECTIVE_BY_PILLAR[pillar.slug] ?? ["awareness"];
    const objective = pickRandom(objectives);
    const formats = FORMAT_BY_OBJECTIVE[objective];
    const format = pickRandom(formats);
    const presenceMode = pickWeighted(PRESENCE_WEIGHTS) as PresenceMode;

    // Hook with deduplication
    const templates = HOOK_TEMPLATES[pillar.slug] ?? HOOK_TEMPLATES["contractor-life"];
    let hook = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = fillHook(pickRandom(templates), trade);
      if (!usedHooks.has(candidate)) {
        hook = candidate;
        usedHooks.add(candidate);
        break;
      }
    }
    if (!hook) hook = fillHook(pickRandom(templates), trade);

    const concept = generateConcept(pillar, trade, format);
    const boost = assessBoostable({ objectiveType: objective, presenceMode, format });

    const idea: ContentIdea = {
      id: randomId(),
      title: generateTitle(pillar, trade, format),
      hook,
      concept,
      shotList: generateShotList(format, trade),
      voiceover: generateVoiceover(hook, concept, trade),
      cta: pillar.defaultCta,

      pillarId: pillar.id,
      accountId: account.id,
      tradeId: trade.id,

      objectiveType: objective,
      commerceMode: pillar.slug === "product-proof" ? "organic_plus_commerce" : "organic",
      presenceMode,
      paidCandidate: boost.paidCandidate,
      affiliateReady: pillar.slug === "tool-material",
      boostableReason: boost.reason,

      targetKeyword: `${trade.name.toLowerCase()} ${pillar.name.toLowerCase()}`,
      hashtags: generateHashtags(pillar, trade, account.language),

      format,
      estimatedDuration: getDuration(format),
      languageCode: account.language,

      status: "draft",
      priority: "normal",

      targetCompletionRate: format === "tutorial" || format === "day-in-life" ? 0.75 : 0.7,
      targetSaveRate: pillar.slug === "tool-material" || pillar.slug === "business-growth" ? 0.06 : 0.04,

      createdAt: new Date().toISOString(),
    };

    ideas.push(idea);
  }

  return ideas;
}

// ─── Series Generator ──────────────────────────────────────────────────────

export function generateSeries(ideas: ContentIdea[], seriesSize = 3): ContentIdea[] {
  const grouped = new Map<string, ContentIdea[]>();
  for (const idea of ideas) {
    const key = `${idea.pillarId}-${idea.tradeId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(idea);
  }

  for (const [, group] of grouped) {
    if (group.length >= seriesSize) {
      const seriesId = `series-${randomId()}`;
      for (let i = 0; i < seriesSize; i++) {
        group[i].seriesId = seriesId;
        group[i].seriesOrder = i + 1;
      }
    }
  }

  return ideas;
}
