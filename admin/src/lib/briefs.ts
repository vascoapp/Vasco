// ---------------------------------------------------------------------------
// Brief Template System — generates structured creator briefs for Vasco
// Enriched with brand context, niche playbooks, and audience personas
// ---------------------------------------------------------------------------

import type { UGCVideo, HookAnalysis, FormatAnalysis } from "./kpi";
import {
  BRAND_IDENTITY,
  BRAND_VOICE,
  PRODUCT_CONTEXT,
  CTA_SYSTEM,
  CONTENT_ANGLES,
  VISUAL_IDENTITY,
  getContentAngle,
  getBestCTA,
} from "../data/brand";
import { getPlaybook, type NichePlaybook } from "../data/playbooks";
import { getPersonasForAngle, type Persona } from "../data/personas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefTemplate {
  id: string;
  title: string;
  createdAt: string;
  podLanguage: string;
  assignedTo: string;
  dueDate: string;
  priority: "normal" | "high" | "urgent";
  status: "draft" | "sent" | "in_progress" | "complete";
  objective: string;
  hookOptions: string[];
  format: string;
  conceptCluster: string;
  moodBoard: string[];
  dosAndDonts: { dos: string[]; donts: string[] };
  duration: string;
  aspectRatio: string;
  platform: string;
  cta: string;
  inspiration: string[];
  productDetails: string;
  keyMessages: string[];
  notes: string;
  // Brand context enrichment
  brandContext: BrandContextBlock | null;
}

export interface BrandContextBlock {
  appName: string;
  tagline: string;
  pitch: string;
  voiceRules: string[];
  cta: { text: string; subtext: string; conversionPath: string };
  contentAngle: {
    id: string;
    name: string;
    emotionalTrigger: string;
    hookPatterns: string[];
    exampleScript: string;
  } | null;
  playbook: {
    communityName: string;
    coreDesire: string;
    emotionalDriver: string;
    topSlang: Array<[string, string]>;
    credibilityKillers: string[];
    bestFeatures: string[];
    hotTopics: string[];
    controversies: string[];
  } | null;
  targetPersonas: Array<{
    id: string;
    name: string;
    headline: string;
    topTrigger: string;
    topObjection: string;
    topReframe: string;
  }>;
  visualRules: {
    editingPace: typeof VISUAL_IDENTITY.editingPace;
    shotRules: typeof VISUAL_IDENTITY.shotRules;
    soundDesign: typeof VISUAL_IDENTITY.soundDesign;
  };
  stats: typeof PRODUCT_CONTEXT.stats;
}

// ---------------------------------------------------------------------------
// Brand context enrichment
// ---------------------------------------------------------------------------

export function enrichWithBrandContext(opts: {
  templateFormat: string;
  conceptCluster?: string;
  nicheId?: string;
}): BrandContextBlock {
  const { templateFormat, conceptCluster, nicheId } = opts;

  // Match content angle
  const angle =
    CONTENT_ANGLES.find((a) => a.bestTemplates.includes(templateFormat)) ??
    (conceptCluster
      ? CONTENT_ANGLES.find((a) => a.id === conceptCluster)
      : null);

  // Match CTA
  const matchedCTA = getBestCTA(templateFormat);

  // Get niche playbook
  const playbook = nicheId ? getPlaybook(nicheId) : null;

  // Get matching personas
  const personas = angle
    ? getPersonasForAngle(angle.id)
    : [];

  return {
    appName: BRAND_IDENTITY.name,
    tagline: BRAND_IDENTITY.tagline,
    pitch: BRAND_IDENTITY.oneLinePitch,
    voiceRules: BRAND_VOICE.rules,
    cta: {
      text: matchedCTA.text,
      subtext: matchedCTA.subtext,
      conversionPath: matchedCTA.conversionPath,
    },
    contentAngle: angle
      ? {
          id: angle.id,
          name: angle.name,
          emotionalTrigger: angle.emotionalTrigger,
          hookPatterns: angle.hookPatterns,
          exampleScript: angle.exampleScript,
        }
      : null,
    playbook: playbook
      ? {
          communityName: playbook.communityName,
          coreDesire: playbook.coreDesire,
          emotionalDriver: playbook.emotionalDriver,
          topSlang: Object.entries(playbook.slang).slice(0, 5),
          credibilityKillers: playbook.credibilityKillers,
          bestFeatures: playbook.bestFeatures,
          hotTopics: playbook.hotTopics.slice(0, 5),
          controversies: playbook.controversies.slice(0, 3),
        }
      : null,
    targetPersonas: personas.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      headline: p.headline,
      topTrigger: p.contentTriggers[0]?.trigger ?? "",
      topObjection: p.objections[0]?.objection ?? "",
      topReframe: p.objections[0]?.reframe ?? "",
    })),
    visualRules: {
      editingPace: VISUAL_IDENTITY.editingPace,
      shotRules: VISUAL_IDENTITY.shotRules,
      soundDesign: VISUAL_IDENTITY.soundDesign,
    },
    stats: PRODUCT_CONTEXT.stats,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatViews(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Brief generation (now with brand context)
// ---------------------------------------------------------------------------

export function generateBrief(opts: {
  podLanguage: string;
  topHooks: HookAnalysis[];
  topFormats: FormatAnalysis[];
  topVideos: UGCVideo[];
  conceptCluster?: string;
  nicheId?: string;
}): BriefTemplate {
  const { podLanguage, topHooks, topFormats, topVideos, conceptCluster, nicheId } = opts;
  const hookOptions = topHooks.slice(0, 3).map((h) => h.hookText);
  const bestFormat = topFormats[0]?.format ?? "before-after";
  const inspiration = topVideos.slice(0, 3).map((v) =>
    `${v.hookText} (${formatViews(v.viewsTotal)} views, ${(v.hookRetentionRate * 100).toFixed(0)}% retention)`
  );

  // Enrich with brand context
  const brandCtx = enrichWithBrandContext({
    templateFormat: bestFormat,
    conceptCluster,
    nicheId,
  });

  // Use brand-matched CTA instead of hardcoded
  const ctaText = brandCtx.cta.text;

  // Build dos from brand voice + data insights
  const dos = [
    `Hook in first 1.5 seconds — ${VISUAL_IDENTITY.editingPace.hookWindow}`,
    `Use ${bestFormat} format — highest avg watch time`,
    "Show the finished project within first 3 seconds",
    `Include ${BRAND_IDENTITY.name} naturally in voiceover or text overlay`,
    "Film on actual job sites, vertical 9:16",
  ];

  // Add playbook-specific dos if available
  if (brandCtx.playbook) {
    dos.push(
      `Use insider language: ${brandCtx.playbook.topSlang.slice(0, 3).map(([term]) => term).join(", ")}`
    );
  }

  // Build donts from brand voice rules + playbook credibility killers
  const donts = BRAND_VOICE.rules
    .filter((r) => r.startsWith("NEVER"))
    .slice(0, 4)
    .map((r) => r.replace("NEVER ", "Don't "));

  if (brandCtx.playbook) {
    donts.push(
      ...brandCtx.playbook.credibilityKillers
        .slice(0, 2)
        .map((k) => `DON'T: ${k}`)
    );
  }

  // Key messages enriched with content angle
  const keyMessages = [
    BRAND_IDENTITY.oneLinePitch,
    "Quotes in 2 minutes, invoices in 1 tap",
    "Built for contractors, by contractors",
  ];

  if (brandCtx.contentAngle) {
    keyMessages.push(`Angle: ${brandCtx.contentAngle.emotionalTrigger}`);
  }

  const now = new Date();
  const dueDate = new Date(now.getTime() + 5 * 86400000);

  return {
    id: `brief-${Date.now()}`,
    title: `${podLanguage} Pod — Construction Content`,
    createdAt: now.toISOString(),
    podLanguage,
    assignedTo: "",
    dueDate: dueDate.toISOString().slice(0, 10),
    priority: "normal",
    status: "draft",
    objective: `Create a ${bestFormat}-style video showcasing real construction work that drives app downloads and contractor signups.`,
    hookOptions,
    format: bestFormat,
    conceptCluster: conceptCluster ?? topVideos[0]?.conceptCluster ?? "",
    moodBoard: [
      "Active job site, morning golden hour",
      "Close-up of skilled hands at work",
      "Satisfying before/after transformation",
      `Contractor using ${BRAND_IDENTITY.name} on phone`,
    ],
    dosAndDonts: { dos, donts },
    duration: "15-45 seconds",
    aspectRatio: "9:16",
    platform: "TikTok + Instagram Reels",
    cta: ctaText,
    inspiration,
    productDetails: `${BRAND_IDENTITY.name} — ${BRAND_IDENTITY.oneLinePitch}`,
    keyMessages,
    notes: "",
    brandContext: brandCtx,
  };
}

// ---------------------------------------------------------------------------
// Markdown export (extended with brand context)
// ---------------------------------------------------------------------------

export function exportBriefMarkdown(brief: BriefTemplate): string {
  const lines = [
    `# Creator Brief: ${brief.title}`,
    "", `**Date:** ${brief.createdAt.slice(0, 10)}`, `**Due:** ${brief.dueDate}`,
    `**Priority:** ${brief.priority.toUpperCase()}`, `**Format:** ${brief.format}`,
    `**Platform:** ${brief.platform}`, `**Duration:** ${brief.duration}`,
    "", "---", "", "## Objective", brief.objective,
    "", "## Hook Options", ...brief.hookOptions.map((h, i) => `${i + 1}. "${h}"`),
    "", "## Mood & Feeling", ...brief.moodBoard.map((m) => `- ${m}`),
    "", "## Do's", ...brief.dosAndDonts.dos.map((d) => `- ${d}`),
    "", "## Don'ts", ...brief.dosAndDonts.donts.map((d) => `- ${d}`),
    "", "## Key Messages", ...brief.keyMessages.map((m) => `- ${m}`),
    "", "## Product Details", brief.productDetails,
    "", "## Inspiration", ...brief.inspiration.map((i) => `- ${i}`),
    "", "## CTA", brief.cta,
  ];

  // Brand context sections
  if (brief.brandContext) {
    const ctx = brief.brandContext;
    lines.push("", "---", "", "## Brand Context");

    if (ctx.contentAngle) {
      lines.push(
        "", `### Content Angle: ${ctx.contentAngle.name}`,
        `**Emotional arc:** ${ctx.contentAngle.emotionalTrigger}`,
        "", "**Hook patterns to try:**",
        ...ctx.contentAngle.hookPatterns.map((h) => `- "${h}"`),
        "", "**Example script:**", ctx.contentAngle.exampleScript,
      );
    }

    if (ctx.playbook) {
      lines.push(
        "", `### Niche: ${ctx.playbook.communityName}`,
        `**Core desire:** ${ctx.playbook.coreDesire}`,
        `**Emotional driver:** ${ctx.playbook.emotionalDriver}`,
        "", "**Insider language (use these):**",
        ...ctx.playbook.topSlang.map(([term, def]) => `- **${term}**: ${def}`),
        "", "**Hot topics for content:**",
        ...ctx.playbook.hotTopics.map((t) => `- ${t}`),
        "", "**Credibility killers (AVOID):**",
        ...ctx.playbook.credibilityKillers.map((k) => `- ${k}`),
      );
    }

    if (ctx.targetPersonas.length > 0) {
      lines.push(
        "", "### Target Audience",
        ...ctx.targetPersonas.map((p) =>
          `- **${p.name}**: ${p.headline}\n  - Trigger: ${p.topTrigger}\n  - Objection: "${p.topObjection}" → Reframe: "${p.topReframe}"`
        ),
      );
    }

    lines.push(
      "", "### Video Production Rules",
      `- Hook: ${ctx.visualRules.editingPace.hookWindow}`,
      `- Bridge: ${ctx.visualRules.editingPace.retentionBridge}`,
      `- Body: ${ctx.visualRules.editingPace.contentBody}`,
      `- CTA: ${ctx.visualRules.editingPace.cta}`,
      `- Cuts: ${ctx.visualRules.editingPace.cutFrequency}`,
      `- Sound: ${ctx.visualRules.soundDesign.voiceover}`,
    );
  }

  lines.push("", "---", `*Generated by ${BRAND_IDENTITY.name} Admin — ${brief.createdAt.slice(0, 10)}*`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// WhatsApp export (condensed with brand context highlights)
// ---------------------------------------------------------------------------

export function exportBriefWhatsApp(brief: BriefTemplate): string {
  const parts = [
    `*NEW BRIEF: ${brief.title}*`,
    `Due: ${brief.dueDate} | Priority: ${brief.priority}`,
    "", `Format: ${brief.format} | ${brief.duration}`,
    "", `*Hook options:*`, ...brief.hookOptions.map((h, i) => `${i + 1}. "${h}"`),
    "", `*Key points:*`, ...brief.dosAndDonts.dos.slice(0, 3).map((d) => `- ${d}`),
  ];

  // Add brand context highlights for WhatsApp
  if (brief.brandContext?.contentAngle) {
    parts.push(
      "", `*Content angle:* ${brief.brandContext.contentAngle.name}`,
      `Arc: ${brief.brandContext.contentAngle.emotionalTrigger}`,
    );
  }

  if (brief.brandContext?.playbook) {
    parts.push(
      "", `*Niche:* ${brief.brandContext.playbook.communityName}`,
      `*Avoid:* ${brief.brandContext.playbook.credibilityKillers[0]}`,
    );
  }

  parts.push("", `CTA: ${brief.cta}`);
  return parts.join("\n");
}
