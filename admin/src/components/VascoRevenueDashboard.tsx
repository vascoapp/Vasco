"use client";

import { useEffect, useState } from "react";
import { fetchKPIDashboardData, isUsingDemoData, type KPIDashboardData, type MonetizationData } from "@/lib/kpi";

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

type RevenueView = "overview" | "subscriptions" | "payments" | "backlinks" | "compliance";

export function VascoRevenueDashboard() {
  const [data, setData] = useState<KPIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<RevenueView>("overview");

  useEffect(() => {
    fetchKPIDashboardData(30).then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" /></div>;
  }

  const { monetization: m } = data;
  const demo = isUsingDemoData();

  const views: { id: RevenueView; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "subscriptions", label: "Subscriptions" },
    { id: "payments", label: "Payment Processing" },
    { id: "backlinks", label: "Supplier Backlinks" },
    { id: "compliance", label: "Compliance Revenue" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0D1B2A]">Revenue & Monetization</h2>
          <p className="text-xs text-gray-400">All revenue streams — subscriptions, payments, backlinks, compliance</p>
        </div>
      </div>

      {demo && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 font-medium">
          Demo data — connect Supabase for live metrics
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 overflow-x-auto">
        {views.map((v) => (
          <button key={v.id} onClick={() => setView(v.id)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${view === v.id ? "bg-white text-[#0D1B2A] shadow-sm" : "text-gray-500"}`}>{v.label}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {view === "overview" && (
        <div className="space-y-6">
          {/* Total MRR hero */}
          <div className="rounded-2xl bg-[#0D1B2A] p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-white/50">Total Monthly Recurring Revenue</p>
            <p className="text-4xl font-bold mt-2">{formatEUR(m.totalMRR)}</p>
            <p className="text-sm text-white/60 mt-1">ARR: {formatEUR(m.totalMRR * 12)}</p>
          </div>

          {/* MRR Breakdown */}
          <div>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">MRR Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {m.mrrBreakdown.map((item) => (
                <div key={item.source} className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.source}</p>
                  <p className="text-xl font-bold text-[#0D1B2A] mt-1">{formatEUR(item.amount)}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#E35205]" style={{ width: `${item.percentage}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{item.percentage}% of MRR</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stacked bar */}
          <div className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Revenue Mix</h3>
            <div className="flex h-8 rounded-full overflow-hidden">
              {m.mrrBreakdown.map((item, i) => {
                const colors = ["bg-[#0D1B2A]", "bg-[#E35205]", "bg-emerald-500", "bg-blue-500"];
                return (
                  <div key={item.source} className={`${colors[i]} relative group`} style={{ width: `${item.percentage}%` }}>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                      {item.source}: {formatEUR(item.amount)} ({item.percentage}%)
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {m.mrrBreakdown.map((item, i) => {
                const dots = ["bg-[#0D1B2A]", "bg-[#E35205]", "bg-emerald-500", "bg-blue-500"];
                return (
                  <div key={item.source} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${dots[i]}`} />
                    <span className="text-xs text-gray-600">{item.source}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Paid Users" value={fmtK(m.subscriptions.contractorUsers)} sub={`${m.subscriptions.conversionRate}% conversion`} color="text-emerald-600" />
            <StatCard label="Payment Volume" value={formatEUR(m.payments.totalVolume)} sub={`${fmtK(m.payments.totalTransactions)} txns · 1% platform fee`} />
            <StatCard label="Backlink Revenue" value={formatEUR(m.backlinks.totalCommission)} sub={`${m.backlinks.conversionRate}% click→buy`} />
            <StatCard label="Compliance Users" value={fmtK(m.compliance.usersWithCompliance)} sub={`${m.compliance.complianceUpsellRate}% upsell rate`} />
          </div>
        </div>
      )}

      {/* SUBSCRIPTIONS */}
      {view === "subscriptions" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <StatCard label="Gratis Users" value={fmtK(m.subscriptions.gratisUsers)} />
            <StatCard label="Contractor Users" value={fmtK(m.subscriptions.contractorUsers)} color="text-emerald-600" />
            <StatCard label="On Trial" value={m.subscriptions.trialUsers} />
            <StatCard label="Conversion Rate" value={`${m.subscriptions.conversionRate}%`} color={m.subscriptions.conversionRate > 15 ? "text-emerald-600" : "text-amber-600"} />
            <StatCard label="Trial → Paid" value={`${m.subscriptions.trialConversionRate}%`} color="text-emerald-600" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Subscription MRR" value={formatEUR(m.subscriptions.subscriptionMRR)} color="text-emerald-600" />
            <StatCard label="Seat Revenue" value={formatEUR(m.subscriptions.seatRevenue)} sub={`${m.subscriptions.totalSeatsUsed} seats used`} />
            <StatCard label="Monthly Churn" value={`${m.subscriptions.monthlyChurn}%`} color={m.subscriptions.monthlyChurn < 5 ? "text-emerald-600" : "text-red-500"} />
            <StatCard label="Annual Billing" value={`${m.subscriptions.annualVsMonthly}%`} sub="of paid users" />
          </div>
          {/* Funnel visualization */}
          <div className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-4">Conversion Funnel</h3>
            {[
              { label: "Total Users", value: m.subscriptions.gratisUsers + m.subscriptions.contractorUsers, pct: 100 },
              { label: "Gratis (Free)", value: m.subscriptions.gratisUsers, pct: Math.round((m.subscriptions.gratisUsers / (m.subscriptions.gratisUsers + m.subscriptions.contractorUsers)) * 100) },
              { label: "Started Trial", value: m.subscriptions.trialUsers + m.subscriptions.contractorUsers, pct: Math.round(((m.subscriptions.trialUsers + m.subscriptions.contractorUsers) / (m.subscriptions.gratisUsers + m.subscriptions.contractorUsers)) * 100) },
              { label: "Paid (Contractor)", value: m.subscriptions.contractorUsers, pct: Math.round((m.subscriptions.contractorUsers / (m.subscriptions.gratisUsers + m.subscriptions.contractorUsers)) * 100) },
            ].map((step) => (
              <div key={step.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{step.label}</span>
                  <span className="font-bold text-gray-900">{fmtK(step.value)}</span>
                </div>
                <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#E35205] rounded-full transition-all" style={{ width: `${step.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAYMENT PROCESSING */}
      {view === "payments" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Volume" value={formatEUR(m.payments.totalVolume)} />
            <StatCard label="Transactions" value={fmtK(m.payments.totalTransactions)} />
            <StatCard label="Mollie Fees" value={formatEUR(m.payments.totalMollieFees)} />
            <StatCard label="Vasco Fees" value={formatEUR(m.payments.totalVascoFees)} />
            <StatCard label="1% Platform Fee" value={formatEUR(m.payments.vascoMargin)} color="text-emerald-600" sub="Vasco earns 1% on all payments" />
            <StatCard label="Avg Fee/Tx" value={formatEUR(m.payments.avgMarginPerTx)} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Revenue by Payment Method</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Method</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Transactions</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Volume</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Margin</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">% of Total</th>
                </tr></thead>
                <tbody>{m.payments.topMethods.map((pm) => (
                  <tr key={pm.method} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{pm.method}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmtK(pm.count)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{formatEUR(pm.volume)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 font-medium">{formatEUR(pm.margin)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-500">{m.payments.vascoMargin > 0 ? `${Math.round((pm.margin / m.payments.vascoMargin) * 100)}%` : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER BACKLINKS */}
      {view === "backlinks" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total Clicks" value={fmtK(m.backlinks.totalClicks)} />
            <StatCard label="Conversions" value={fmtK(m.backlinks.totalConversions)} />
            <StatCard label="Conv. Rate" value={`${m.backlinks.conversionRate}%`} />
            <StatCard label="Order Value" value={formatEUR(m.backlinks.totalOrderValue)} />
            <StatCard label="Commission" value={formatEUR(m.backlinks.totalCommission)} color="text-emerald-600" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Top Suppliers</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Supplier</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Clicks</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Orders</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Commission</th>
                  </tr></thead>
                  <tbody>{m.backlinks.topSuppliers.map((s) => (
                    <tr key={s.name} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{s.name}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{fmtK(s.clicks)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{fmtK(s.conversions)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 font-medium">{formatEUR(s.commission)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">By Category</h3>
              <div className="space-y-3">
                {m.backlinks.topCategories.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20">{cat.category}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#E35205] rounded-full" style={{ width: `${m.backlinks.totalCommission > 0 ? (cat.commission / m.backlinks.totalCommission) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[#0D1B2A] w-16 text-right">{formatEUR(cat.commission)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLIANCE REVENUE */}
      {view === "compliance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Compliance Users" value={fmtK(m.compliance.usersWithCompliance)} />
            <StatCard label="Upsell Rate" value={`${m.compliance.complianceUpsellRate}%`} sub="gratis → paid for compliance" />
            <StatCard label="Total Revenue" value={formatEUR(m.compliance.totalComplianceRevenue)} color="text-emerald-600" />
            <StatCard label="Monthly" value={formatEUR(Math.round(m.compliance.totalComplianceRevenue / 12))} sub="avg compliance MRR" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Revenue by Country</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Country</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Users</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Revenue</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">ARPU</th>
                  </tr></thead>
                  <tbody>{m.compliance.revenueByCountry.map((c) => (
                    <tr key={c.country} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{c.flag} {c.country}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{fmtK(c.users)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 font-medium">{formatEUR(c.revenue)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-500">{formatEUR(c.users > 0 ? Math.round(c.revenue / c.users) : 0)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">E-Invoice Format Usage</h3>
              <div className="space-y-3">
                {m.compliance.eInvoiceUsage.map((f) => {
                  const maxCount = Math.max(...m.compliance.eInvoiceUsage.map((x) => x.count));
                  return (
                    <div key={f.format} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24 truncate">{f.format}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${maxCount > 0 ? (f.count / maxCount) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[#0D1B2A] w-12 text-right">{fmtK(f.count)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
