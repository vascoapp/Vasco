// ---------------------------------------------------------------------------
// Weekly Auto-Report Generator — surfaces insights for pod leads
// ---------------------------------------------------------------------------

import type { UGCDashboardData, UGCVideo } from "./kpi";
import type { Pod } from "./pod-planner";

export interface WeeklyInsight {
  type: "hit" | "trend" | "alert" | "action";
  title: string;
  detail: string;
}

export interface WeeklyReport {
  periodStart: string;
  periodEnd: string;
  podName: string;
  podLanguage: string;
  videosPosted: number;
  totalViews: number;
  avgRetention: number;
  avgEngagement: number;
  hits: number;
  revenue: number;
  viewsChange: number;
  hitsChange: number;
  insights: WeeklyInsight[];
  topVideo: UGCVideo | null;
  worstVideo: UGCVideo | null;
  suggestedHooks: string[];
  suggestedFormats: string[];
  replicateCandidates: UGCVideo[];
}

function fmtNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function generateWeeklyReport(ugcData: UGCDashboardData, pod: Pod): WeeklyReport {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const periodStart = weekAgo.toISOString().slice(0, 10);
  const periodEnd = now.toISOString().slice(0, 10);

  const podCreators = new Set(pod.members.map((m) => m.name));
  const allPodVideos = ugcData.videos.filter((v) => podCreators.has(v.creatorName));
  const thisWeek = allPodVideos.filter((v) => v.datePosted >= periodStart);
  const lastWeek = allPodVideos.filter((v) => v.datePosted >= twoWeeksAgo.toISOString().slice(0, 10) && v.datePosted < periodStart);

  const totalViews = thisWeek.reduce((s, v) => s + v.viewsTotal, 0);
  const lastWeekViews = lastWeek.reduce((s, v) => s + v.viewsTotal, 0);
  const hits = thisWeek.filter((v) => v.classification === "hit");
  const lastWeekHits = lastWeek.filter((v) => v.classification === "hit");

  const avgRetention = thisWeek.length > 0 ? thisWeek.reduce((s, v) => s + v.hookRetentionRate, 0) / thisWeek.length : 0;
  const avgEngagement = totalViews > 0 ? thisWeek.reduce((s, v) => s + v.likes + v.comments + v.shares, 0) / totalViews : 0;
  const revenue = thisWeek.reduce((s, v) => s + v.revenueCents, 0) / 100;

  const sorted = [...thisWeek].sort((a, b) => b.viewsTotal - a.viewsTotal);
  const insights: WeeklyInsight[] = [];

  if (hits.length > 0) insights.push({ type: "hit", title: `${hits.length} HIT${hits.length > 1 ? "S" : ""} this week`, detail: `Best: "${hits[0].hookText}" with ${fmtNum(hits[0].viewsTotal)} views.` });
  if (avgRetention > 0.4) insights.push({ type: "trend", title: "Strong hook retention", detail: `${(avgRetention * 100).toFixed(0)}% avg — above 40% benchmark.` });
  else if (avgRetention < 0.25 && thisWeek.length > 0) insights.push({ type: "alert", title: "Low hook retention", detail: `${(avgRetention * 100).toFixed(0)}% avg — test more provocative hooks.` });

  const viewsChange = lastWeekViews > 0 ? Math.round(((totalViews - lastWeekViews) / lastWeekViews) * 100) : 0;
  if (viewsChange > 20) insights.push({ type: "trend", title: `Views up ${viewsChange}%`, detail: "Increase volume to ride the momentum." });
  if (thisWeek.length < pod.targetVideosPerWeek) insights.push({ type: "alert", title: `Behind target: ${thisWeek.length}/${pod.targetVideosPerWeek}`, detail: `Need ${pod.targetVideosPerWeek - thisWeek.length} more videos.` });

  return {
    periodStart, periodEnd, podName: pod.name, podLanguage: pod.language,
    videosPosted: thisWeek.length, totalViews, avgRetention, avgEngagement, hits: hits.length, revenue,
    viewsChange, hitsChange: lastWeekHits.length > 0 ? Math.round(((hits.length - lastWeekHits.length) / lastWeekHits.length) * 100) : 0,
    insights, topVideo: sorted[0] ?? null, worstVideo: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    suggestedHooks: ugcData.hookAnalysis.slice(0, 3).map((h) => h.hookText),
    suggestedFormats: ugcData.formatAnalysis.slice(0, 2).map((f) => f.format),
    replicateCandidates: allPodVideos.filter((v) => v.classification === "hit").sort((a, b) => b.viewsTotal - a.viewsTotal).slice(0, 3),
  };
}

export function exportReportWhatsApp(report: WeeklyReport): string {
  const lines = [
    `*${report.podName} — Weekly Report*`, `${report.periodStart} → ${report.periodEnd}`, "",
    `Videos: ${report.videosPosted}`, `Views: ${fmtNum(report.totalViews)}`, `HITs: ${report.hits}`,
    `Revenue: €${report.revenue.toFixed(0)}`, "",
  ];
  if (report.topVideo) lines.push(`*Best:* "${report.topVideo.hookText}" — ${fmtNum(report.topVideo.viewsTotal)} views`, "");
  if (report.insights.length > 0) { lines.push("*Insights*"); for (const i of report.insights) lines.push(`- ${i.title}`); }
  return lines.join("\n");
}
