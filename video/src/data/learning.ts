// =============================================================================
// LEARNING ENGINE — Self-improving video templates
// =============================================================================
// Tracks performance of every generated video, feeds data back into template
// selection, hook ranking, and content optimization.
//
// Flow:
//   1. Video generated → script props stored with videoId
//   2. Video published → TikTok metrics collected (views, retention, shares)
//   3. Learning engine updates: hook scores, template effectiveness, trade relevance
//   4. Next generation uses updated scores → better videos over time
//
// This is the flywheel: more videos → more data → better templates → more views
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VideoPerformance {
  videoId: string;
  templateId: string;
  trade: string;
  language: string;
  hookText: string;
  hookId?: string;               // From hooks.ts if used
  publishedAt: string;
  platform: 'tiktok' | 'instagram' | 'youtube_shorts';

  // Metrics (updated over time)
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  avgWatchTimeSec: number;
  retentionRate3s: number;       // % still watching at 3 seconds (hook quality)
  retentionRate50: number;       // % still watching at 50% duration
  completionRate: number;        // % who watched to end
  profileVisits: number;         // Driven to profile from this video
  linkClicks: number;            // CTA clicks (app downloads)

  // Classification
  classification: 'hit' | 'average' | 'fail' | 'pending';
  lastUpdatedAt: string;
}

export interface HookScore {
  hookId: string;
  hookText: string;
  format: string;
  totalUses: number;
  avgRetention3s: number;        // Most important: does the hook work?
  avgCompletionRate: number;
  avgViews: number;
  hitRate: number;               // % of videos using this hook that became HITs
  score: number;                 // 0-100 composite score
  trend: 'improving' | 'stable' | 'declining';
  lastUsedAt: string;
}

export interface TemplateScore {
  templateId: string;
  totalUses: number;
  avgViews: number;
  avgRetention3s: number;
  avgCompletionRate: number;
  hitRate: number;
  bestTrades: string[];          // Which trades this template works best for
  bestLanguages: string[];       // Which markets respond best
  score: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface TradeContentScore {
  trade: string;
  totalVideos: number;
  avgViews: number;
  hitRate: number;
  bestTemplates: string[];
  bestHooks: string[];
  peakPostingHours: number[];    // Hours of day with best performance
  peakPostingDays: number[];     // Days of week (0=Mon) with best performance
}

export interface LearningState {
  hookScores: HookScore[];
  templateScores: TemplateScore[];
  tradeScores: TradeContentScore[];
  videos: VideoPerformance[];
  lastAnalyzedAt: string;
  totalVideosAnalyzed: number;
  dataVersion: number;
}

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_FILE = path.resolve(__dirname, '../../out/learning-data.json');

function loadState(): LearningState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {}
  return {
    hookScores: [],
    templateScores: [],
    tradeScores: [],
    videos: [],
    lastAnalyzedAt: new Date().toISOString(),
    totalVideosAnalyzed: 0,
    dataVersion: 1,
  };
}

function saveState(state: LearningState): void {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

// ─── Recording ──────────────────────────────────────────────────────────────

export function recordVideoPublished(video: Omit<VideoPerformance, 'classification' | 'lastUpdatedAt'>): void {
  const state = loadState();
  state.videos.push({
    ...video,
    classification: 'pending',
    lastUpdatedAt: new Date().toISOString(),
  });
  saveState(state);
}

export function updateVideoMetrics(videoId: string, metrics: Partial<VideoPerformance>): void {
  const state = loadState();
  const video = state.videos.find(v => v.videoId === videoId);
  if (!video) return;

  Object.assign(video, metrics);
  video.lastUpdatedAt = new Date().toISOString();

  // Auto-classify based on views + retention
  if (video.views >= 20000 && video.retentionRate3s >= 0.4) {
    video.classification = 'hit';
  } else if (video.views >= 5000 || video.retentionRate3s >= 0.25) {
    video.classification = 'average';
  } else if (video.views > 0 && new Date().getTime() - new Date(video.publishedAt).getTime() > 7 * 86400000) {
    video.classification = 'fail';
  }

  saveState(state);
}

// ─── Analysis ───────────────────────────────────────────────────────────────

export function analyzePerformance(): LearningState {
  const state = loadState();
  const classifiedVideos = state.videos.filter(v => v.classification !== 'pending');

  if (classifiedVideos.length < 3) return state; // Need minimum data

  // ── Analyze hooks ─────────────────────────────────────
  const hookMap = new Map<string, VideoPerformance[]>();
  for (const v of classifiedVideos) {
    const key = v.hookId || v.hookText.slice(0, 50);
    const group = hookMap.get(key) || [];
    group.push(v);
    hookMap.set(key, group);
  }

  state.hookScores = Array.from(hookMap.entries()).map(([key, videos]) => {
    const avgRetention3s = videos.reduce((s, v) => s + v.retentionRate3s, 0) / videos.length;
    const avgCompletion = videos.reduce((s, v) => s + v.completionRate, 0) / videos.length;
    const avgViews = videos.reduce((s, v) => s + v.views, 0) / videos.length;
    const hitRate = videos.filter(v => v.classification === 'hit').length / videos.length;

    // Composite score: 40% retention + 25% completion + 20% views + 15% hit rate
    const normalizedViews = Math.min(1, avgViews / 50000); // Normalize to 0-1
    const score = Math.round(
      (avgRetention3s * 40) +
      (avgCompletion * 25) +
      (normalizedViews * 20) +
      (hitRate * 15)
    );

    // Trend: compare last 3 vs first 3
    const sorted = [...videos].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    const firstHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
    const secondHalf = sorted.slice(Math.ceil(sorted.length / 2));
    const firstAvg = firstHalf.reduce((s, v) => s + v.retentionRate3s, 0) / firstHalf.length;
    const secondAvg = secondHalf.length > 0
      ? secondHalf.reduce((s, v) => s + v.retentionRate3s, 0) / secondHalf.length
      : firstAvg;
    const trend: HookScore['trend'] = secondAvg > firstAvg * 1.1 ? 'improving' : secondAvg < firstAvg * 0.9 ? 'declining' : 'stable';

    return {
      hookId: key,
      hookText: videos[0].hookText,
      format: videos[0].templateId,
      totalUses: videos.length,
      avgRetention3s,
      avgCompletionRate: avgCompletion,
      avgViews,
      hitRate,
      score,
      trend,
      lastUsedAt: sorted[sorted.length - 1].publishedAt,
    };
  }).sort((a, b) => b.score - a.score);

  // ── Analyze templates ─────────────────────────────────
  const templateMap = new Map<string, VideoPerformance[]>();
  for (const v of classifiedVideos) {
    const group = templateMap.get(v.templateId) || [];
    group.push(v);
    templateMap.set(v.templateId, group);
  }

  state.templateScores = Array.from(templateMap.entries()).map(([templateId, videos]) => {
    const avgViews = videos.reduce((s, v) => s + v.views, 0) / videos.length;
    const avgRetention = videos.reduce((s, v) => s + v.retentionRate3s, 0) / videos.length;
    const avgCompletion = videos.reduce((s, v) => s + v.completionRate, 0) / videos.length;
    const hitRate = videos.filter(v => v.classification === 'hit').length / videos.length;

    // Best trades: which trades have highest avg views for this template
    const tradeViews = new Map<string, number[]>();
    for (const v of videos) {
      const arr = tradeViews.get(v.trade) || [];
      arr.push(v.views);
      tradeViews.set(v.trade, arr);
    }
    const bestTrades = Array.from(tradeViews.entries())
      .map(([trade, views]) => ({ trade, avg: views.reduce((a, b) => a + b, 0) / views.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(t => t.trade);

    // Best languages
    const langViews = new Map<string, number[]>();
    for (const v of videos) {
      const arr = langViews.get(v.language) || [];
      arr.push(v.views);
      langViews.set(v.language, arr);
    }
    const bestLanguages = Array.from(langViews.entries())
      .map(([lang, views]) => ({ lang, avg: views.reduce((a, b) => a + b, 0) / views.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(l => l.lang);

    const score = Math.round(
      (avgRetention * 35) + (avgCompletion * 25) + (Math.min(1, avgViews / 50000) * 25) + (hitRate * 15)
    );

    return {
      templateId, totalUses: videos.length, avgViews, avgRetention3s: avgRetention,
      avgCompletionRate: avgCompletion, hitRate, bestTrades, bestLanguages, score,
      trend: 'stable' as const,
    };
  }).sort((a, b) => b.score - a.score);

  // ── Analyze trades ────────────────────────────────────
  const tradeMap = new Map<string, VideoPerformance[]>();
  for (const v of classifiedVideos) {
    const group = tradeMap.get(v.trade) || [];
    group.push(v);
    tradeMap.set(v.trade, group);
  }

  state.tradeScores = Array.from(tradeMap.entries()).map(([trade, videos]) => {
    const avgViews = videos.reduce((s, v) => s + v.views, 0) / videos.length;
    const hitRate = videos.filter(v => v.classification === 'hit').length / videos.length;

    // Best templates for this trade
    const tplViews = new Map<string, number[]>();
    for (const v of videos) {
      const arr = tplViews.get(v.templateId) || [];
      arr.push(v.views);
      tplViews.set(v.templateId, arr);
    }
    const bestTemplates = Array.from(tplViews.entries())
      .map(([tpl, views]) => ({ tpl, avg: views.reduce((a, b) => a + b, 0) / views.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(t => t.tpl);

    // Best hooks
    const hookViews = new Map<string, { text: string; views: number[] }>();
    for (const v of videos) {
      const key = v.hookId || v.hookText.slice(0, 50);
      const entry = hookViews.get(key) || { text: v.hookText, views: [] };
      entry.views.push(v.views);
      hookViews.set(key, entry);
    }
    const bestHooks = Array.from(hookViews.entries())
      .map(([, { text, views }]) => ({ text, avg: views.reduce((a, b) => a + b, 0) / views.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(h => h.text);

    // Peak posting hours/days
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    for (const v of videos.filter(v => v.classification === 'hit')) {
      const d = new Date(v.publishedAt);
      hourCounts[d.getHours()]++;
      dayCounts[d.getDay()]++;
    }
    const peakPostingHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour);
    const peakPostingDays = dayCounts
      .map((count, day) => ({ day, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(d => d.day);

    return {
      trade, totalVideos: videos.length, avgViews, hitRate,
      bestTemplates, bestHooks, peakPostingHours, peakPostingDays,
    };
  });

  state.lastAnalyzedAt = new Date().toISOString();
  state.totalVideosAnalyzed = classifiedVideos.length;
  saveState(state);

  return state;
}

// ─── Smart Recommendations ──────────────────────────────────────────────────

export interface ContentRecommendation {
  action: 'create' | 'replicate' | 'retire' | 'test_hook';
  templateId: string;
  trade: string;
  language: string;
  hookText?: string;
  reason: string;
  confidence: number;            // 0-1
  expectedViews: number;
}

export function getRecommendations(trade: string, language: string): ContentRecommendation[] {
  const state = loadState();
  const recommendations: ContentRecommendation[] = [];

  // Find best template for this trade
  const tradeScore = state.tradeScores.find(t => t.trade === trade);
  if (tradeScore && tradeScore.bestTemplates.length > 0) {
    recommendations.push({
      action: 'create',
      templateId: tradeScore.bestTemplates[0],
      trade,
      language,
      hookText: tradeScore.bestHooks[0],
      reason: `${tradeScore.bestTemplates[0]} has ${(tradeScore.hitRate * 100).toFixed(0)}% hit rate for ${trade}`,
      confidence: Math.min(0.9, tradeScore.hitRate + 0.3),
      expectedViews: tradeScore.avgViews * 1.2,
    });
  }

  // Find top hooks that haven't been used for this trade
  const topHooks = state.hookScores.filter(h => h.score > 60 && h.trend !== 'declining');
  for (const hook of topHooks.slice(0, 2)) {
    const usedForTrade = state.videos.some(v => v.trade === trade && v.hookText === hook.hookText);
    if (!usedForTrade) {
      recommendations.push({
        action: 'test_hook',
        templateId: hook.format,
        trade,
        language,
        hookText: hook.hookText,
        reason: `Hook "${hook.hookText.slice(0, 40)}..." scores ${hook.score}/100 but untested for ${trade}`,
        confidence: 0.6,
        expectedViews: hook.avgViews,
      });
    }
  }

  // Find HIT videos in other languages that don't exist in target language
  const hits = state.videos.filter(v => v.classification === 'hit' && v.trade === trade && v.language !== language);
  for (const hit of hits.slice(0, 2)) {
    const existsInLang = state.videos.some(v =>
      v.templateId === hit.templateId && v.trade === trade && v.language === language &&
      v.hookText.includes(hit.hookText.split(' ').slice(0, 3).join(' '))
    );
    if (!existsInLang) {
      recommendations.push({
        action: 'replicate',
        templateId: hit.templateId,
        trade,
        language,
        hookText: hit.hookText,
        reason: `HIT in ${hit.language} (${hit.views.toLocaleString()} views) — not yet in ${language}`,
        confidence: 0.75,
        expectedViews: hit.views * 0.6, // Expect ~60% of original language performance
      });
    }
  }

  // Find declining templates to retire
  const declining = state.templateScores.filter(t => t.trend === 'declining' && t.totalUses > 5);
  for (const tpl of declining) {
    recommendations.push({
      action: 'retire',
      templateId: tpl.templateId,
      trade,
      language,
      reason: `${tpl.templateId} declining: avg views dropped, hit rate ${(tpl.hitRate * 100).toFixed(0)}%`,
      confidence: 0.7,
      expectedViews: 0,
    });
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

// ─── Codebase Knowledge Bootstrap ───────────────────────────────────────────
// On first run, the learning engine reads the project structure to understand
// what data is available for content generation.

export interface ProjectKnowledge {
  appName: string;
  trades: string[];
  languages: string[];
  features: string[];
  templateCount: number;
  supplierCount: number;
  quoteTemplateCount: number;
  certificationMatrix: number;   // trades × countries
  scannedAt: string;
}

export function bootstrapFromCodebase(projectRoot: string): ProjectKnowledge {
  const knowledge: ProjectKnowledge = {
    appName: 'VascoApp',
    trades: [],
    languages: [],
    features: [],
    templateCount: 0,
    supplierCount: 0,
    quoteTemplateCount: 0,
    certificationMatrix: 0,
    scannedAt: new Date().toISOString(),
  };

  try {
    // Read trade features config
    const tradeFeaturesPath = path.join(projectRoot, 'src/config/tradeFeatures.ts');
    if (fs.existsSync(tradeFeaturesPath)) {
      const content = fs.readFileSync(tradeFeaturesPath, 'utf8');
      const tradeMatches = content.match(/['"](\w+)['"]\s*:\s*\{/g);
      if (tradeMatches) {
        knowledge.trades = tradeMatches.map(m => m.match(/['"](\w+)['"]/)?.[1] ?? '').filter(Boolean);
      }
    }

    // Read i18n locales
    const localesDir = path.join(projectRoot, 'src/i18n/locales');
    if (fs.existsSync(localesDir)) {
      knowledge.languages = fs.readdirSync(localesDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', '').toUpperCase());
    }

    // Count suppliers
    const supplierPath = path.join(projectRoot, 'src/services/supplierBacklinkService.ts');
    if (fs.existsSync(supplierPath)) {
      const content = fs.readFileSync(supplierPath, 'utf8');
      knowledge.supplierCount = (content.match(/id: '/g) || []).length;
    }

    // Count quote templates
    const quotePath = path.join(projectRoot, 'src/services/quoteTemplateService.ts');
    if (fs.existsSync(quotePath)) {
      const content = fs.readFileSync(quotePath, 'utf8');
      knowledge.quoteTemplateCount = (content.match(/id: 'qt-/g) || []).length;
    }

    // Count video templates
    const rootPath = path.join(projectRoot, 'video/src/Root.tsx');
    if (fs.existsSync(rootPath)) {
      const content = fs.readFileSync(rootPath, 'utf8');
      knowledge.templateCount = (content.match(/id="/g) || []).length;
    }

    // Certification matrix (trades × countries in onboarding)
    const onboardingPath = path.join(projectRoot, 'app/onboarding.tsx');
    if (fs.existsSync(onboardingPath)) {
      const content = fs.readFileSync(onboardingPath, 'utf8');
      const certLines = (content.match(/NL: \[/g) || []).length;
      knowledge.certificationMatrix = certLines;
    }

    // Feature list from subscription service
    const subPath = path.join(projectRoot, 'src/services/subscriptionService.ts');
    if (fs.existsSync(subPath)) {
      const content = fs.readFileSync(subPath, 'utf8');
      const features = content.match(/has\w+: boolean/g);
      if (features) {
        knowledge.features = features.map(f => f.replace(': boolean', '').replace('has', ''));
      }
    }
  } catch {}

  // Save knowledge for use by the generator
  const knowledgePath = path.resolve(__dirname, '../../out/project-knowledge.json');
  fs.mkdirSync(path.dirname(knowledgePath), { recursive: true });
  fs.writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2));

  return knowledge;
}
