"use client";

import { useState } from "react";
import { calculateCommissions, exportCommissionsCSV, type CommissionSummary } from "@/lib/commissions";
import type { CreatorRow } from "@/lib/kpi";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

const DEMO_CREATORS: CreatorRow[] = [
  { name: "Bouwer Jan", handle: "@bouwer.jan", language: "NL", affiliateCode: "BOUWER10", scans: 1420, activations: 680, completions: 0, purchases: 42, revenue: 1840, conversionRate: 3.0, kitsSent: 0, cogsPerKit: 0, affiliatePayoutPct: 15, netROI: 0 },
  { name: "Elektro Max", handle: "@elektro.max", language: "DE", affiliateCode: "MAX10", scans: 1180, activations: 540, completions: 0, purchases: 36, revenue: 1420, conversionRate: 3.1, kitsSent: 0, cogsPerKit: 0, affiliatePayoutPct: 15, netROI: 0 },
  { name: "Plumber Pete", handle: "@plumber.pete", language: "EN", affiliateCode: "PETE10", scans: 980, activations: 440, completions: 0, purchases: 28, revenue: 920, conversionRate: 2.9, kitsSent: 0, cogsPerKit: 0, affiliatePayoutPct: 15, netROI: 0 },
  { name: "Peintre Pierre", handle: "@peintre.pierre", language: "FR", affiliateCode: "PIERRE10", scans: 720, activations: 310, completions: 0, purchases: 18, revenue: 680, conversionRate: 2.5, kitsSent: 0, cogsPerKit: 0, affiliatePayoutPct: 15, netROI: 0 },
  { name: "Fontanero Carlos", handle: "@fontanero.carlos", language: "ES", affiliateCode: "CARLOS10", scans: 480, activations: 190, completions: 0, purchases: 11, revenue: 420, conversionRate: 2.3, kitsSent: 0, cogsPerKit: 0, affiliatePayoutPct: 15, netROI: 0 },
  { name: "Idraulico Marco", handle: "@idraulico.marco", language: "IT", affiliateCode: "MARCO10", scans: 360, activations: 140, completions: 0, purchases: 8, revenue: 340, conversionRate: 2.2, kitsSent: 0, cogsPerKit: 0, affiliatePayoutPct: 15, netROI: 0 },
];

function formatEUR(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export function AdminCommissionTracker() {
  const summary = calculateCommissions(DEMO_CREATORS, "March 2026");

  const handleExport = () => {
    const csv = exportCommissionsCSV(summary);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "vasco-commissions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#0D1B2A]">Commissions — {summary.periodLabel}</h2>
        <button onClick={handleExport} className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md">Export CSV</button>
      </div>
      <AdminDemoBanner />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Total Revenue</p><p className="text-2xl font-bold text-emerald-600">{formatEUR(summary.totalRevenue)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Commissions</p><p className="text-2xl font-bold text-[#0D1B2A]">{formatEUR(summary.totalCommissions)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Net Profit</p><p className="text-2xl font-bold text-emerald-600">{formatEUR(summary.totalNetProfit)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Avg ROI</p><p className="text-2xl font-bold text-[#0D1B2A]">{summary.avgROI}x</p></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Creator</th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Lang</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Revenue</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Commission</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Net</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">ROI</th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
          </tr></thead>
          <tbody>{summary.entries.map((e) => (
            <tr key={e.handle} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2.5 px-3"><div className="font-medium text-gray-900">{e.creatorName}</div><div className="text-xs text-gray-400">{e.handle}</div></td>
              <td className="py-2.5 px-3 text-center"><span className="px-1.5 py-0.5 bg-blue-50 rounded text-xs font-medium">{e.language}</span></td>
              <td className="py-2.5 px-3 text-right tabular-nums font-medium text-emerald-600">{formatEUR(e.grossRevenue)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{formatEUR(e.commissionAmount)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums font-medium">{formatEUR(e.netToCompany)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#0D1B2A]">{e.roi}x</td>
              <td className="py-2.5 px-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{e.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
