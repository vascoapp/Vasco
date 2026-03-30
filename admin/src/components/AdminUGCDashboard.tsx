"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchUGCDashboardData, exportUGCVideosCSV, type UGCDashboardData, type UGCVideo, type VideoClassification } from "@/lib/kpi";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 365 },
];

const CLASS_COLORS: Record<VideoClassification, string> = {
  hit: "bg-emerald-100 text-emerald-700",
  average: "bg-amber-100 text-amber-700",
  fail: "bg-red-100 text-red-700",
  pending: "bg-gray-100 text-gray-500",
};

function formatPct(n: number): string { return `${(n * 100).toFixed(1)}%`; }
function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#0D1B2A]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Automation Rules ──────────────────────────────────────────────────────

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  isActive: boolean;
  lastTriggered: string;
  timesTriggered: number;
}

const DEMO_AUTOMATIONS: AutomationRule[] = [
  { id: "auto-1", name: "HIT Replication Alert", trigger: "Video classified as HIT (>20K views, >40% retention)", action: "Create 5 pipeline items with same visuals + new hooks → assign to pod lead", isActive: true, lastTriggered: "2026-03-27", timesTriggered: 8 },
  { id: "auto-2", name: "Low Retention Hook Swap", trigger: "Video retention < 20% after 24h", action: "Flag video for re-edit → suggest top 3 performing hooks from same format", isActive: true, lastTriggered: "2026-03-28", timesTriggered: 14 },
  { id: "auto-3", name: "Weekly Pod Digest", trigger: "Every Monday 9:00 AM CET", action: "Generate weekly report → send WhatsApp summary to each pod lead", isActive: true, lastTriggered: "2026-03-25", timesTriggered: 12 },
  { id: "auto-4", name: "Competitor Content Monitor", trigger: "New video from tracked competitor accounts (>10K views)", action: "Add to Swipe File → tag format + hook type → notify marketing", isActive: true, lastTriggered: "2026-03-26", timesTriggered: 23 },
  { id: "auto-5", name: "Creator Milestone Bonus", trigger: "Creator reaches 100K total views on Vasco content", action: "Flag for commission bonus → send congratulations template", isActive: false, lastTriggered: "2026-03-20", timesTriggered: 3 },
  { id: "auto-6", name: "Content Velocity Check", trigger: "Pod falls below 60% of weekly target by Thursday", action: "Alert pod lead → auto-assign ready briefs to available creators", isActive: true, lastTriggered: "2026-03-27", timesTriggered: 6 },
  { id: "auto-7", name: "Trending Sound Detector", trigger: "TikTok trending sound in construction/trades niche (top 50)", action: "Create brief suggestion with trending sound → assign to fastest creator", isActive: true, lastTriggered: "2026-03-28", timesTriggered: 4 },
  { id: "auto-8", name: "Cross-Pod Winner Replication", trigger: "HIT video in one market with no equivalent in other markets", action: "Create translated pipeline items in all other EU6 pods", isActive: true, lastTriggered: "2026-03-26", timesTriggered: 5 },
];

// ─── Micropod Config ───────────────────────────────────────────────────────

interface MicropodConfig {
  id: string;
  name: string;
  focus: string;
  targetPerWeek: number;
  members: number;
  platforms: string[];
  formats: string[];
  autoAssign: boolean;
  autoClassify: boolean;
  autoReplicate: boolean;
  whatsappGroup: boolean;
  kpis: { metric: string; target: string; current: string; status: "on_track" | "behind" | "exceeded" }[];
}

const DEMO_MICROPODS: MicropodConfig[] = [
  {
    id: "mp-1", name: "NL Trades", focus: "Dutch contractor lifestyle + tool reviews", targetPerWeek: 5, members: 3,
    platforms: ["TikTok", "Instagram Reels"], formats: ["before-after", "tool-review", "day-in-life"],
    autoAssign: true, autoClassify: true, autoReplicate: true, whatsappGroup: true,
    kpis: [
      { metric: "Videos/week", target: "5", current: "4", status: "behind" },
      { metric: "Hit rate", target: "20%", current: "28%", status: "exceeded" },
      { metric: "Avg views", target: "15K", current: "17.2K", status: "exceeded" },
      { metric: "Installs/video", target: "50", current: "42", status: "behind" },
    ],
  },
  {
    id: "mp-2", name: "DE Handwerker", focus: "German market — Handwerker content + DATEV compliance", targetPerWeek: 4, members: 2,
    platforms: ["TikTok", "YouTube Shorts"], formats: ["project-showcase", "tutorial", "testimonial"],
    autoAssign: true, autoClassify: true, autoReplicate: true, whatsappGroup: true,
    kpis: [
      { metric: "Videos/week", target: "4", current: "3", status: "behind" },
      { metric: "Hit rate", target: "20%", current: "32%", status: "exceeded" },
      { metric: "Avg views", target: "12K", current: "17.1K", status: "exceeded" },
      { metric: "Installs/video", target: "40", current: "48", status: "exceeded" },
    ],
  },
  {
    id: "mp-3", name: "UK Builders", focus: "UK tradespeople — business growth + Xero integration", targetPerWeek: 4, members: 1,
    platforms: ["TikTok", "Instagram Reels"], formats: ["before-after", "testimonial", "day-in-life"],
    autoAssign: true, autoClassify: true, autoReplicate: false, whatsappGroup: true,
    kpis: [
      { metric: "Videos/week", target: "4", current: "3", status: "behind" },
      { metric: "Hit rate", target: "18%", current: "24%", status: "exceeded" },
      { metric: "Avg views", target: "10K", current: "18.6K", status: "exceeded" },
      { metric: "Installs/video", target: "35", current: "38", status: "on_track" },
    ],
  },
  {
    id: "mp-4", name: "FR Artisans", focus: "French artisans du bâtiment + Factur-X", targetPerWeek: 3, members: 1,
    platforms: ["TikTok"], formats: ["day-in-life", "project-showcase"],
    autoAssign: false, autoClassify: true, autoReplicate: false, whatsappGroup: false,
    kpis: [
      { metric: "Videos/week", target: "3", current: "2", status: "behind" },
      { metric: "Hit rate", target: "15%", current: "20%", status: "exceeded" },
      { metric: "Avg views", target: "8K", current: "12.2K", status: "exceeded" },
      { metric: "Installs/video", target: "25", current: "22", status: "behind" },
    ],
  },
  {
    id: "mp-5", name: "ES + IT Growth", focus: "Combined Spanish + Italian emerging markets", targetPerWeek: 4, members: 2,
    platforms: ["TikTok", "Instagram Reels"], formats: ["testimonial", "before-after", "tutorial"],
    autoAssign: true, autoClassify: true, autoReplicate: true, whatsappGroup: true,
    kpis: [
      { metric: "Videos/week", target: "4", current: "2", status: "behind" },
      { metric: "Hit rate", target: "12%", current: "15%", status: "on_track" },
      { metric: "Avg views", target: "6K", current: "7.6K", status: "on_track" },
      { metric: "Installs/video", target: "20", current: "18", status: "behind" },
    ],
  },
];

const KPI_STATUS_COLORS = {
  on_track: "text-blue-600 bg-blue-50",
  behind: "text-red-600 bg-red-50",
  exceeded: "text-emerald-600 bg-emerald-50",
};

// ─── Main Component ────────────────────────────────────────────────────────

export function AdminUGCDashboard() {
  const [data, setData] = useState<UGCDashboardData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"overview" | "hooks" | "formats" | "clusters" | "videos" | "automations" | "micropods">("overview");

  useEffect(() => {
    setLoading(true);
    fetchUGCDashboardData(days).then((d) => { setData(d); setLoading(false); });
  }, [days]);

  const handleExport = useCallback(() => {
    if (!data) return;
    const csv = exportUGCVideosCSV(data.videos);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `vasco-ugc-${data.period.from}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" /></div>;
  }

  const { production, creative, business, classificationBreakdown } = data;
  const views = [
    { id: "overview", label: "Overview" },
    { id: "automations", label: "Automations" },
    { id: "micropods", label: "Micropods" },
    { id: "hooks", label: "Hooks" },
    { id: "formats", label: "Formats" },
    { id: "clusters", label: "Clusters" },
    { id: "videos", label: "All Videos" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0D1B2A]">UGC Analytics</h2>
          <p className="text-xs text-gray-400">{data.period.from} — {data.period.to}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {PERIODS.map((p) => (
              <button key={p.days} onClick={() => setDays(p.days)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${days === p.days ? "bg-white text-[#0D1B2A] shadow-sm" : "text-gray-500"}`}>{p.label}</button>
            ))}
          </div>
          <button onClick={handleExport} className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md">Export CSV</button>
        </div>
      </div>

      <AdminDemoBanner />

      <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 overflow-x-auto">
        {views.map((v) => (
          <button key={v.id} onClick={() => setActiveView(v.id)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${activeView === v.id ? "bg-white text-[#0D1B2A] shadow-sm" : "text-gray-500"}`}>{v.label}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeView === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Videos" value={String(production.totalVideos)} />
            <StatCard label="Avg Retention" value={formatPct(creative.avgHookRetention)} />
            <StatCard label="Avg Watch Time" value={`${creative.avgWatchTime.toFixed(1)}s`} />
            <StatCard label="Total Installs" value={formatNum(business.totalInstalls)} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {(["hit", "average", "fail", "pending"] as VideoClassification[]).map((c) => (
              <div key={c} className={`rounded-lg p-3 text-center ${CLASS_COLORS[c]}`}>
                <p className="text-2xl font-bold">{classificationBreakdown[c]}</p>
                <p className="text-xs font-medium capitalize mt-1">{c}s</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Top Performers</h3>
            <div className="space-y-2">
              {data.topPerformers.slice(0, 5).map((v) => (
                <div key={v.id} className="rounded-lg bg-white border border-gray-100 p-3 flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${CLASS_COLORS[v.classification]}`}>{v.classification}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">&quot;{v.hookText}&quot;</p>
                    <p className="text-xs text-gray-400">{v.creatorName} · {v.format} · {v.datePosted}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#0D1B2A]">{formatNum(v.viewsTotal)}</p>
                    <p className="text-[10px] text-gray-400">{formatPct(v.hookRetentionRate)} ret</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATIONS */}
      {activeView === "automations" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Active Rules" value={String(DEMO_AUTOMATIONS.filter((a) => a.isActive).length)} />
            <StatCard label="Total Rules" value={String(DEMO_AUTOMATIONS.length)} />
            <StatCard label="Triggered (30d)" value={String(DEMO_AUTOMATIONS.reduce((s, a) => s + a.timesTriggered, 0))} />
            <StatCard label="Avg/Rule" value={(DEMO_AUTOMATIONS.reduce((s, a) => s + a.timesTriggered, 0) / DEMO_AUTOMATIONS.length).toFixed(1)} />
          </div>

          <div className="space-y-3">
            {DEMO_AUTOMATIONS.map((rule) => (
              <div key={rule.id} className={`rounded-xl bg-white border p-4 shadow-sm transition ${rule.isActive ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${rule.isActive ? "bg-emerald-400" : "bg-gray-300"}`} />
                      <h4 className="text-sm font-bold text-[#0D1B2A]">{rule.name}</h4>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="rounded-lg bg-blue-50 p-2.5">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">When</p>
                        <p className="text-xs text-blue-800">{rule.trigger}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2.5">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Then</p>
                        <p className="text-xs text-emerald-800">{rule.action}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400">
                  <span>Last triggered: {rule.lastTriggered}</span>
                  <span className="font-bold text-[#0D1B2A]">{rule.timesTriggered}x triggered</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MICROPODS */}
      {activeView === "micropods" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Active Micropods" value={String(DEMO_MICROPODS.length)} />
            <StatCard label="Total Creators" value={String(DEMO_MICROPODS.reduce((s, p) => s + p.members, 0))} />
            <StatCard label="Weekly Target" value={String(DEMO_MICROPODS.reduce((s, p) => s + p.targetPerWeek, 0))} sub="videos/week" />
            <StatCard label="Platforms" value="3" sub="TikTok, IG, YT" />
          </div>

          <div className="space-y-4">
            {DEMO_MICROPODS.map((pod) => (
              <div key={pod.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#0D1B2A]">{pod.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{pod.focus}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">{pod.members} creators</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E35205]/10 text-[#E35205]">{pod.targetPerWeek}/week</span>
                    </div>
                  </div>

                  {/* Platforms & Formats */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pod.platforms.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded bg-blue-50 text-[10px] font-medium text-blue-700">{p}</span>
                    ))}
                    {pod.formats.map((f) => (
                      <span key={f} className="px-2 py-0.5 rounded bg-gray-100 text-[10px] font-medium text-gray-600 capitalize">{f.replace(/-/g, " ")}</span>
                    ))}
                  </div>

                  {/* Automation toggles */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: "Auto-assign briefs", active: pod.autoAssign },
                      { label: "Auto-classify videos", active: pod.autoClassify },
                      { label: "Auto-replicate HITs", active: pod.autoReplicate },
                      { label: "WhatsApp group", active: pod.whatsappGroup },
                    ].map((toggle) => (
                      <div key={toggle.label} className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5">
                        <span className={`h-2 w-2 rounded-full ${toggle.active ? "bg-emerald-400" : "bg-gray-300"}`} />
                        <span className="text-[10px] text-gray-600">{toggle.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* KPIs */}
                  <div className="mt-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pod KPIs</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {pod.kpis.map((kpi) => (
                        <div key={kpi.metric} className="rounded-lg border border-gray-100 p-2.5">
                          <p className="text-[10px] text-gray-400">{kpi.metric}</p>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-sm font-bold text-[#0D1B2A]">{kpi.current}</span>
                            <span className="text-[10px] text-gray-400">/ {kpi.target}</span>
                          </div>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${KPI_STATUS_COLORS[kpi.status]}`}>
                            {kpi.status.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOOKS */}
      {activeView === "hooks" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Hook Type</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Videos</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Avg Retention</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Avg Views</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Avg Shares</th>
            </tr></thead>
            <tbody>{data.hookAnalysis.map((h) => (
              <tr key={h.hookType} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2.5 px-3 capitalize font-medium">{h.hookType.replace("-", " ")}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{h.videoCount}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatPct(h.avgRetention)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums font-medium">{formatNum(h.avgViews)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatNum(h.avgShares)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* FORMATS */}
      {activeView === "formats" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Format</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Videos</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Avg Watch Time</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Avg Completion</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Avg Views</th>
            </tr></thead>
            <tbody>{data.formatAnalysis.map((f) => (
              <tr key={f.format} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2.5 px-3 capitalize font-medium">{f.format.replace("-", " ")}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{f.videoCount}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{f.avgWatchTime.toFixed(1)}s</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatPct(f.avgCompletionRate)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums font-medium">{formatNum(f.avgViews)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* CLUSTERS */}
      {activeView === "clusters" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Cluster</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Videos</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Avg Views</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Best Video</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Hit Rate</th>
            </tr></thead>
            <tbody>{data.conceptClusters.map((c) => (
              <tr key={c.cluster} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2.5 px-3 capitalize font-medium">{c.cluster.replace(/-/g, " ")}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{c.videoCount}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatNum(c.avgViews)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums font-medium">{formatNum(c.bestVideoViews)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatPct(c.hitRate)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ALL VIDEOS */}
      {activeView === "videos" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Hook</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Creator</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Format</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Views</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Retention</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Shares</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Class</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Date</th>
            </tr></thead>
            <tbody>{[...data.videos].sort((a, b) => b.viewsTotal - a.viewsTotal).map((v) => (
              <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2.5 px-3 max-w-xs truncate font-medium">{v.hookText}</td>
                <td className="py-2.5 px-3 text-gray-500">{v.creatorName}</td>
                <td className="py-2.5 px-3 capitalize text-gray-500">{v.format.replace("-", " ")}</td>
                <td className="py-2.5 px-3 text-right tabular-nums font-medium">{formatNum(v.viewsTotal)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatPct(v.hookRetentionRate)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{v.shares}</td>
                <td className="py-2.5 px-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${CLASS_COLORS[v.classification]}`}>{v.classification}</span></td>
                <td className="py-2.5 px-3 text-gray-400">{v.datePosted}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
