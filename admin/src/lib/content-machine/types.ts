// ═══════════════════════════════════════════════════════════════════════════
// CONTENT MACHINE — TYPE DEFINITIONS
// Adapted for VascoApp: AI-Native Construction Trades Platform (EU6)
// ═══════════════════════════════════════════════════════════════════════════

export type ObjectiveType = "awareness" | "proof" | "learning" | "conversion" | "retention";
export type CommerceMode = "organic" | "organic_plus_commerce" | "affiliate_ready";
export type PresenceMode = "face" | "voiceover" | "hands_only" | "text_only";

export type ContentFormat =
  | "before-after"
  | "tutorial"
  | "day-in-life"
  | "project-showcase"
  | "tool-review"
  | "testimonial"
  | "tip"
  | "timelapse"
  | "POV"
  | "reveal"
  | "comparison"
  | "myth-busting"
  | "challenge"
  | "behind-scenes";

export type LanguageCode = "en" | "nl" | "de" | "fr" | "es" | "it";
export const LANGUAGES: LanguageCode[] = ["en", "nl", "de", "fr", "es", "it"];

export type IdeaStatus = "draft" | "approved" | "scheduled" | "filmed" | "posted" | "archived";
export type Priority = "urgent" | "high" | "normal" | "low";

// ─── Content Pillar ────────────────────────────────────────────────────────
export interface ContentPillar {
  id: string;
  slug: string;
  name: string;
  description: string;
  targetMixPct: number;
  defaultCta: string;
  emoji: string;
  bestFormats: ContentFormat[];
  bestPresence: PresenceMode[];
  isActive: boolean;
}

// ─── Content Account ───────────────────────────────────────────────────────
export interface ContentAccount {
  id: string;
  handle: string;
  displayName: string;
  purpose: string;
  platform: "tiktok" | "instagram";
  accountType: "brand" | "language" | "creator";
  language: LanguageCode;
  contentFocus: string[];
  isActive: boolean;
}

// ─── Trade (replaces "Character" from generic brief) ───────────────────────
export interface Trade {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  shortDescription: string;
  personalityTags: string[];
  heroMaterials: string[];
  isActive: boolean;
}

// ─── Content Idea ──────────────────────────────────────────────────────────
export interface ContentIdea {
  id: string;
  title: string;
  hook: string;
  concept: string;
  shotList: string[];
  voiceover: string;
  cta: string;

  pillarId: string;
  accountId: string;
  tradeId?: string;

  objectiveType: ObjectiveType;
  commerceMode: CommerceMode;
  presenceMode: PresenceMode;
  paidCandidate: boolean;
  affiliateReady: boolean;
  boostableReason?: string;

  targetKeyword: string;
  hashtags: string[];

  seriesId?: string;
  seriesOrder?: number;

  format: ContentFormat;
  estimatedDuration: string;
  languageCode: LanguageCode;

  status: IdeaStatus;
  priority: Priority;

  targetCompletionRate: number;
  targetSaveRate: number;

  createdAt: string;
}

// ─── Weekly Calendar ───────────────────────────────────────────────────────
export interface WeeklyCalendar {
  id: string;
  weekStart: string;
  goal: string;
  notes: string;
  pillarDistribution: Record<string, { target: number; actual: number }>;
  batchFilmDay: string;
  items: CalendarItem[];
  warnings: string[];
  status: "draft" | "active" | "completed";
}

export interface CalendarItem {
  id: string;
  ideaId: string;
  accountId: string;
  plannedDate: string;
  plannedTime: string;
  languageCode: LanguageCode;
  status: "planned" | "filmed" | "posted";
  format: ContentFormat;
  idea: ContentIdea;
}

// ─── Generated Caption ─────────────────────────────────────────────────────
export interface GeneratedCaption {
  id: string;
  ideaId: string;
  languageCode: LanguageCode;
  caption: string;
  hashtags: string[];
  cta: string;
  seoKeyword: string;
  mode: "organic" | "commerce";
}

export interface CaptionPack {
  ideaId: string;
  ideaTitle: string;
  hook: string;
  captions: Record<LanguageCode, { organic: GeneratedCaption; commerce: GeneratedCaption }>;
}

// ─── Content Batch ─────────────────────────────────────────────────────────
export interface ContentBatch {
  id: string;
  title: string;
  batchDate: string;
  setupType: string;
  estimatedDurationMins: number;
  items: BatchItem[];
  status: "planned" | "in_progress" | "completed";
}

export interface BatchItem {
  id: string;
  ideaId: string;
  shotOrder: number;
  setupNotes: string;
  isFilmed: boolean;
  idea: ContentIdea;
}

// ─── Generation Options ────────────────────────────────────────────────────
export interface GenerateOptions {
  count?: number;
  weekStart?: string;
  batchFilmDay?: string;
  maxBatchDurationMins?: number;
}
