"use client";

import { useState } from "react";
import type { BoostMetrics } from "@/lib/kpi";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

const DEMO_BOOST: BoostMetrics = {
  totalBoosted: 8,
  totalSpend: 2400,
  totalBoostedViews: 420000,
  totalBoostedClicks: 12600,
  totalBoostedInstalls: 840,
  avgCPM: 5.71,
  avgCPC: 0.19,
  avgCPI: 2.86,
  organicROI: 3.2,
  boostedROI: 4.8,
  boostedVideos: [
    { videoId: "v1", hookText: "This plumber made €12K in one week", organicViews: 42000, boostedViews: 86000, spend: 420, installs: 168, revenue: 1680, roas: 4.0 },
    { videoId: "v2", hookText: "3 tools every electrician needs", organicViews: 28000, boostedViews: 64000, spend: 380, installs: 142, revenue: 1420, roas: 3.7 },
    { videoId: "v3", hookText: "Before and after this kitchen remodel", organicViews: 68000, boostedViews: 120000, spend: 560, installs: 224, revenue: 2800, roas: 5.0 },
    { videoId: "v4", hookText: "Why Dutch contractors use Vasco", organicViews: 15000, boostedViews: 38000, spend: 280, installs: 84, revenue: 840, roas: 3.0 },
    { videoId: "v5", hookText: "The invoice hack that saved my business", organicViews: 34000, boostedViews: 52000, spend: 320, installs: 96, revenue: 960, roas: 3.0 },
    { videoId: "v6", hookText: "Site lead morning routine", organicViews: 22000, boostedViews: 28000, spend: 180, installs: 54, revenue: 540, roas: 3.0 },
    { videoId: "v7", hookText: "How I grew my painting business 3x", organicViews: 56000, boostedViews: 18000, spend: 140, installs: 42, revenue: 420, roas: 3.0 },
    { videoId: "v8", hookText: "POV: your first solo renovation", organicViews: 31000, boostedViews: 14000, spend: 120, installs: 30, revenue: 300, roas: 2.5 },
  ],
};

function formatEUR(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function AdminBoostTracker() {
  const data = DEMO_BOOST;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[#0D1B2A]">Spark Ads / Boost Tracker</h2>
      <AdminDemoBanner />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Total Spend</p><p className="text-2xl font-bold text-[#0D1B2A]">{formatEUR(data.totalSpend)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Boosted Views</p><p className="text-2xl font-bold text-[#0D1B2A]">{fmtK(data.totalBoostedViews)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Installs</p><p className="text-2xl font-bold text-emerald-600">{data.totalBoostedInstalls}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Avg CPM</p><p className="text-2xl font-bold text-[#0D1B2A]">{formatEUR(data.avgCPM)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Avg CPI</p><p className="text-2xl font-bold text-[#0D1B2A]">{formatEUR(data.avgCPI)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Boosted ROI</p><p className="text-2xl font-bold text-emerald-600">{data.boostedROI}x</p></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Hook</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Organic</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Boosted</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Spend</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Installs</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Revenue</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">ROAS</th>
          </tr></thead>
          <tbody>{data.boostedVideos.sort((a, b) => b.roas - a.roas).map((v) => (
            <tr key={v.videoId} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2.5 px-3 font-medium text-gray-900 max-w-xs truncate">{v.hookText}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-gray-500">{fmtK(v.organicViews)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums font-medium">{fmtK(v.boostedViews)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{formatEUR(v.spend)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{v.installs}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 font-medium">{formatEUR(v.revenue)}</td>
              <td className="py-2.5 px-3 text-right"><span className={`font-bold ${v.roas >= 4 ? "text-emerald-600" : v.roas >= 3 ? "text-amber-600" : "text-red-500"}`}>{v.roas}x</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
