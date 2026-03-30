"use client";

import { useEffect, useState } from "react";
import { fetchKPIDashboardData, isUsingDemoData, type KPIDashboardData } from "@/lib/kpi";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color || "text-[#0D1B2A]"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function VascoOverview() {
  const [data, setData] = useState<KPIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKPIDashboardData(30).then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" />
      </div>
    );
  }

  const { users, financial, markets, jobs, usersByTrade } = data;
  const demo = isUsingDemoData();

  return (
    <div className="space-y-6">
      {demo && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 font-medium">
          Demo data — connect Supabase for live metrics
        </div>
      )}

      {/* Hero KPIs */}
      <div>
        <h2 className="text-lg font-bold text-[#0D1B2A] mb-3">Platform Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total Users" value={fmtK(users.totalUsers)} sub={`+${users.newThisMonth} this month`} />
          <StatCard label="Active This Week" value={fmtK(users.activeThisWeek)} sub={`${((users.activeThisWeek / users.totalUsers) * 100).toFixed(0)}% of total`} />
          <StatCard label="MRR" value={formatEUR(financial.mrr)} color="text-emerald-600" />
          <StatCard label="ARR" value={formatEUR(financial.arr)} color="text-emerald-600" />
          <StatCard label="Active Jobs" value={fmtK(jobs.activeJobs)} />
          <StatCard label="Invoices Paid" value={`${financial.invoicePaymentRate}%`} sub={`${fmtK(financial.totalInvoicesPaid)} of ${fmtK(financial.totalInvoicesSent)}`} />
        </div>
      </div>

      {/* User Type Breakdown */}
      <div>
        <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Users by Type</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E35205]/10">
                <span className="text-sm">🔨</span>
              </div>
              <div>
                <p className="text-xs text-gray-400">Contractors</p>
                <p className="text-xl font-bold text-[#0D1B2A]">{fmtK(users.contractors)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <span className="text-sm">🏗️</span>
              </div>
              <div>
                <p className="text-xs text-gray-400">Aannemers (GCs)</p>
                <p className="text-xl font-bold text-[#0D1B2A]">{fmtK(users.aannemers)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                <span className="text-sm">👷</span>
              </div>
              <div>
                <p className="text-xs text-gray-400">Site Leads</p>
                <p className="text-xl font-bold text-[#0D1B2A]">{fmtK(users.siteLeads)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Market Breakdown */}
      <div>
        <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Markets (EU6)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Market</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Users</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Active</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Jobs</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">MRR</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Growth</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.market} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-900">{m.flag} {m.market}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{fmtK(m.users)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{fmtK(m.activeUsers)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{fmtK(m.jobs)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-emerald-600">{formatEUR(m.mrr)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`text-xs font-bold ${m.growthRate > 10 ? "text-emerald-600" : "text-amber-600"}`}>
                      +{m.growthRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Trades & Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Trades */}
        <div>
          <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Top Trades</h3>
          <div className="space-y-2">
            {usersByTrade.slice(0, 6).map((t) => (
              <div key={t.trade} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 truncate">{t.trade}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E35205] rounded-full"
                    style={{ width: `${t.percentage}%`, opacity: 0.7 + t.percentage * 0.01 }}
                  />
                </div>
                <span className="text-xs font-bold text-[#0D1B2A] w-14 text-right">{fmtK(t.count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Financial Metrics */}
        <div>
          <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Key Financial Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="ARPU" value={formatEUR(financial.arpu)} sub="per user / month" />
            <StatCard label="LTV" value={formatEUR(financial.ltv)} sub={`${financial.ltvCacRatio}x CAC`} />
            <StatCard label="Avg Invoice" value={formatEUR(financial.avgInvoiceSize)} />
            <StatCard label="Avg Payment" value={`${financial.avgPaymentTime}d`} sub="days to payment" />
          </div>
        </div>
      </div>

      {/* Onboarding & Retention */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Onboarding Rate" value={`${users.onboardingCompletionRate}%`} color={users.onboardingCompletionRate > 60 ? "text-emerald-600" : "text-amber-600"} />
        <StatCard label="Monthly Retention" value={`${users.retentionRate}%`} color="text-emerald-600" />
        <StatCard label="Monthly Churn" value={`${users.churnRate}%`} color={users.churnRate < 5 ? "text-emerald-600" : "text-red-500"} />
        <StatCard label="Quote → Job" value={`${jobs.quoteConversionRate}%`} sub={`avg ${jobs.avgQuoteToJobDays}d`} />
      </div>
    </div>
  );
}
