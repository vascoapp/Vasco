"use client";

import { useEffect, useState } from "react";
import { fetchKPIDashboardData, isUsingDemoData, type KPIDashboardData, type DailyRevenue } from "@/lib/kpi";
import { AdminRetentionCohorts } from "./AdminRetentionCohorts";

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 365 },
];

function formatEUR(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function pct(a: number, b: number): string {
  if (b === 0) return "0%";
  return `${Math.round((a / b) * 100)}%`;
}

function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color || "text-[#0D1B2A]"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function FunnelBar({ label, value, maxValue, color, prevValue }: {
  label: string; value: number; maxValue: number; color: string; prevValue?: number;
}) {
  const widthPct = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">{value.toLocaleString()}</span>
          {prevValue !== undefined && prevValue > 0 && (
            <span className="text-xs text-gray-400">{pct(value, prevValue)} of prev</span>
          )}
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function RevenueTimeline({ data }: { data: DailyRevenue[] }) {
  if (data.length === 0) return null;
  const maxRev = Math.max(...data.map((d) => d.totalRevenue), 1);
  const totalRev = data.reduce((s, d) => s + d.totalRevenue, 0);
  const totalSub = data.reduce((s, d) => s + d.subscriptionRevenue, 0);
  const totalTxn = data.reduce((s, d) => s + d.transactionRevenue, 0);
  const chartHeight = 120;

  return (
    <div>
      <h3 className="text-lg font-bold text-[#0D1B2A] mb-4">Revenue Trend</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Revenue" value={formatEUR(totalRev)} />
        <StatCard label="Subscription" value={formatEUR(totalSub)} sub={pct(totalSub, totalRev)} />
        <StatCard label="Transaction" value={formatEUR(totalTxn)} sub={pct(totalTxn, totalRev)} />
        <StatCard label="Avg Daily" value={formatEUR(Math.round(totalRev / data.length))} />
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-end gap-[2px]" style={{ height: `${chartHeight}px` }}>
          {data.map((d, i) => {
            const subH = Math.max((d.subscriptionRevenue / maxRev) * chartHeight, 1);
            const txnH = Math.max((d.transactionRevenue / maxRev) * chartHeight, 1);
            return (
              <div key={d.date} className="flex-1 group relative" style={{ height: `${chartHeight}px` }}>
                <div className="absolute bottom-0 w-full flex flex-col">
                  <div className="w-full bg-[#E35205] rounded-t-sm opacity-60" style={{ height: `${txnH}px` }} />
                  <div className="w-full bg-[#0D1B2A] opacity-80" style={{ height: `${subH}px` }} />
                </div>
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {d.date}: {formatEUR(d.totalRevenue)}
                </div>
                {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap">{d.date.slice(5)}</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="h-5" />
        <div className="flex items-center gap-4 text-[10px] text-gray-400 mt-2">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-[#0D1B2A] opacity-80" /> Subscription</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-[#E35205] opacity-60" /> Transaction</span>
        </div>
      </div>
    </div>
  );
}

export function VascoKPIDashboard() {
  const [data, setData] = useState<KPIDashboardData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchKPIDashboardData(days).then((d) => { setData(d); setLoading(false); });
  }, [days]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" />
      </div>
    );
  }

  const { funnel, financial, markets, users } = data;
  const demo = isUsingDemoData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0D1B2A]">KPI Dashboard</h2>
          <p className="text-xs text-gray-400">{data.period.from} — {data.period.to}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                days === p.days ? "bg-white text-[#0D1B2A] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {demo && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 font-medium">
          Demo data — connect Supabase for live metrics
        </div>
      )}

      {/* Financial Hero KPIs */}
      <div>
        <h3 className="text-lg font-bold text-[#0D1B2A] mb-4">Financial KPIs</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="MRR" value={formatEUR(financial.mrr)} color="text-emerald-600" />
          <StatCard label="ARR" value={formatEUR(financial.arr)} color="text-emerald-600" />
          <StatCard label="ARPU" value={formatEUR(financial.arpu)} sub="/month" />
          <StatCard label="LTV" value={formatEUR(financial.ltv)} />
          <StatCard label="CAC" value={formatEUR(financial.cac)} />
          <StatCard label="LTV:CAC" value={`${financial.ltvCacRatio}x`} color={financial.ltvCacRatio > 3 ? "text-emerald-600" : "text-red-500"} />
        </div>
      </div>

      {/* Conversion Funnel */}
      <div>
        <h3 className="text-lg font-bold text-[#0D1B2A] mb-4">Contractor Conversion Funnel</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Landing Views" value={fmtK(funnel.landingViews)} />
          <StatCard label="Signups" value={fmtK(funnel.signups)} sub={pct(funnel.signups, funnel.landingViews) + " conv"} />
          <StatCard label="Subscribed" value={fmtK(funnel.subscribed)} sub={pct(funnel.subscribed, funnel.signups) + " of signups"} />
          <StatCard label="Overall Conv" value={pct(funnel.subscribed, funnel.landingViews)} color="text-[#E35205]" />
        </div>
        <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-4">
          <FunnelBar label="Landing Views" value={funnel.landingViews} maxValue={funnel.landingViews} color="bg-[#0D1B2A]" />
          <FunnelBar label="Signups" value={funnel.signups} maxValue={funnel.landingViews} color="bg-blue-600" prevValue={funnel.landingViews} />
          <FunnelBar label="Onboarded" value={funnel.onboarded} maxValue={funnel.landingViews} color="bg-blue-500" prevValue={funnel.signups} />
          <FunnelBar label="First Job" value={funnel.firstJob} maxValue={funnel.landingViews} color="bg-cyan-500" prevValue={funnel.onboarded} />
          <FunnelBar label="First Quote" value={funnel.firstQuote} maxValue={funnel.landingViews} color="bg-teal-500" prevValue={funnel.firstJob} />
          <FunnelBar label="First Invoice" value={funnel.firstInvoice} maxValue={funnel.landingViews} color="bg-emerald-500" prevValue={funnel.firstQuote} />
          <FunnelBar label="Invoice Paid" value={funnel.invoicePaid} maxValue={funnel.landingViews} color="bg-emerald-600" prevValue={funnel.firstInvoice} />
          <FunnelBar label="Subscribed" value={funnel.subscribed} maxValue={funnel.landingViews} color="bg-[#E35205]" prevValue={funnel.invoicePaid} />
        </div>
      </div>

      {/* Revenue Timeline */}
      <RevenueTimeline data={data.revenueTimeline} />

      {/* Market Performance */}
      <div>
        <h3 className="text-lg font-bold text-[#0D1B2A] mb-4">Market Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Market</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700">Users</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700">Active</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700">Jobs</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700">Invoices</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700">Revenue</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700">MRR</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700">Growth</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.market} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2 font-medium">{m.flag} {m.market}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right tabular-nums">{fmtK(m.users)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right tabular-nums">{fmtK(m.activeUsers)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right tabular-nums">{fmtK(m.jobs)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right tabular-nums">{fmtK(m.invoicesSent)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right tabular-nums text-emerald-600 font-medium">{formatEUR(m.revenue)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right tabular-nums font-medium">{formatEUR(m.mrr)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    <span className={`font-bold ${m.growthRate > 10 ? "text-emerald-600" : "text-amber-600"}`}>+{m.growthRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="border border-gray-300 px-3 py-2">Total</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{fmtK(markets.reduce((s, m) => s + m.users, 0))}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{fmtK(markets.reduce((s, m) => s + m.activeUsers, 0))}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{fmtK(markets.reduce((s, m) => s + m.jobs, 0))}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{fmtK(markets.reduce((s, m) => s + m.invoicesSent, 0))}</td>
                <td className="border border-gray-300 px-3 py-2 text-right text-emerald-600">{formatEUR(markets.reduce((s, m) => s + m.revenue, 0))}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{formatEUR(markets.reduce((s, m) => s + m.mrr, 0))}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* User Health */}
      <div>
        <h3 className="text-lg font-bold text-[#0D1B2A] mb-4">User Health</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Onboarding Rate" value={`${users.onboardingCompletionRate}%`} />
          <StatCard label="Retention" value={`${users.retentionRate}%`} color="text-emerald-600" />
          <StatCard label="Churn" value={`${users.churnRate}%`} color={users.churnRate < 5 ? "text-emerald-600" : "text-red-500"} />
          <StatCard label="New This Week" value={users.newThisWeek} />
          <StatCard label="New This Month" value={users.newThisMonth} />
          <StatCard label="WAU / MAU" value={`${((users.activeThisWeek / users.activeThisMonth) * 100).toFixed(0)}%`} sub="stickiness" />
        </div>
      </div>

      {/* R224 — signup cohort retention heatmap */}
      <AdminRetentionCohorts />
    </div>
  );
}
