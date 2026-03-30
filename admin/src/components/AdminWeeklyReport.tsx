"use client";

import { useEffect, useState } from "react";
import { fetchUGCDashboardData, type UGCDashboardData } from "@/lib/kpi";
import { fetchPodPlannerData, type PodPlannerData } from "@/lib/pod-planner";
import { generateWeeklyReport, exportReportWhatsApp, type WeeklyReport } from "@/lib/weekly-report";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

function fmtNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const INSIGHT_COLORS = { hit: "bg-emerald-50 text-emerald-700", trend: "bg-blue-50 text-blue-700", alert: "bg-red-50 text-red-700", action: "bg-purple-50 text-purple-700" };

export function AdminWeeklyReport() {
  const [ugcData, setUgcData] = useState<UGCDashboardData | null>(null);
  const [podData, setPodData] = useState<PodPlannerData | null>(null);
  const [selectedPod, setSelectedPod] = useState<string>("");

  useEffect(() => {
    Promise.all([fetchUGCDashboardData(30), fetchPodPlannerData()]).then(([u, p]) => {
      setUgcData(u); setPodData(p);
      if (p.pods.length > 0) setSelectedPod(p.pods[0].id);
    });
  }, []);

  if (!ugcData || !podData) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" /></div>;

  const pod = podData.pods.find((p) => p.id === selectedPod);
  const report = pod ? generateWeeklyReport(ugcData, pod) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#0D1B2A]">Weekly Reports</h2>
        <select value={selectedPod} onChange={(e) => setSelectedPod(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white">
          {podData.pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <AdminDemoBanner />

      {report && (
        <div className="rounded-2xl bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0D1B2A]">{report.podName}</h3>
              <p className="text-xs text-gray-400">{report.periodStart} — {report.periodEnd}</p>
            </div>
            <button onClick={() => navigator.clipboard.writeText(exportReportWhatsApp(report))} className="px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200">Copy for WhatsApp</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-[10px] text-gray-400">Videos</p><p className="text-xl font-bold">{report.videosPosted}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-[10px] text-gray-400">Views</p><p className="text-xl font-bold">{fmtNum(report.totalViews)}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-[10px] text-gray-400">HITs</p><p className="text-xl font-bold text-emerald-600">{report.hits}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-[10px] text-gray-400">Retention</p><p className="text-xl font-bold">{(report.avgRetention * 100).toFixed(0)}%</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-[10px] text-gray-400">Revenue</p><p className="text-xl font-bold text-emerald-600">&euro;{report.revenue.toFixed(0)}</p></div>
          </div>
          {report.insights.length > 0 && (
            <div><p className="text-xs font-bold text-gray-500 mb-2">Insights</p>
              <div className="space-y-2">{report.insights.map((ins, i) => (
                <div key={i} className={`rounded-lg p-3 ${INSIGHT_COLORS[ins.type]}`}>
                  <p className="text-xs font-bold">{ins.title}</p>
                  <p className="text-xs mt-0.5 opacity-80">{ins.detail}</p>
                </div>
              ))}</div>
            </div>
          )}
          {report.topVideo && (
            <div><p className="text-xs font-bold text-gray-500 mb-1">Best Video</p>
              <p className="text-sm font-medium">"{report.topVideo.hookText}"</p>
              <p className="text-xs text-gray-400">{fmtNum(report.topVideo.viewsTotal)} views · {report.topVideo.shares} shares</p>
            </div>
          )}
          {report.suggestedHooks.length > 0 && (
            <div><p className="text-xs font-bold text-gray-500 mb-1">Suggested Hooks</p>
              {report.suggestedHooks.map((h, i) => <p key={i} className="text-xs text-gray-600">- "{h}"</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
