"use client";

import { useEffect, useState } from "react";
import { fetchDeveloperHubData, type DeveloperHubData, type BugReport, type LatencyMetric, type UserSuggestion, type DeployStatus } from "@/lib/kpi";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color || "text-[#0D1B2A]"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

const SEVERITY_COLORS: Record<BugReport["severity"], string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-500",
};

const STATUS_COLORS: Record<BugReport["status"], string> = {
  open: "bg-red-50 text-red-600",
  in_progress: "bg-blue-50 text-blue-600",
  resolved: "bg-emerald-50 text-emerald-600",
  closed: "bg-gray-50 text-gray-500",
};

const SUGGESTION_STATUS_COLORS: Record<UserSuggestion["status"], string> = {
  new: "bg-gray-100 text-gray-600",
  under_review: "bg-blue-100 text-blue-700",
  planned: "bg-purple-100 text-purple-700",
  in_progress: "bg-amber-100 text-amber-700",
  shipped: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-600",
};

const DEPLOY_STATUS_COLORS: Record<DeployStatus["status"], string> = {
  healthy: "bg-emerald-100 text-emerald-700",
  degraded: "bg-amber-100 text-amber-700",
  down: "bg-red-100 text-red-700",
};

type DevView = "overview" | "bugs" | "latency" | "suggestions" | "deploys";

export function DeveloperHub() {
  const [data, setData] = useState<DeveloperHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DevView>("overview");
  const [bugFilter, setBugFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [suggestionSort, setSuggestionSort] = useState<"votes" | "newest">("votes");

  useEffect(() => {
    fetchDeveloperHubData().then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" />
      </div>
    );
  }

  const openBugs = data.bugs.filter((b) => b.status === "open");
  const criticalBugs = data.bugs.filter((b) => b.severity === "critical" && b.status !== "closed" && b.status !== "resolved");
  const filteredBugs = bugFilter === "all" ? data.bugs : data.bugs.filter((b) => b.status === bugFilter);

  const sortedSuggestions = [...data.suggestions].sort((a, b) =>
    suggestionSort === "votes" ? b.votes - a.votes : b.submittedAt.localeCompare(a.submittedAt)
  );

  const views: { id: DevView; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "bugs", label: `Bugs (${openBugs.length})` },
    { id: "latency", label: "Latency" },
    { id: "suggestions", label: `Suggestions (${data.suggestions.length})` },
    { id: "deploys", label: "Deploys" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0D1B2A]">Developer Hub</h2>
          <p className="text-xs text-gray-400">System health, bugs, latency, and user feedback</p>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 overflow-x-auto">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${
              view === v.id ? "bg-white text-[#0D1B2A] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {view === "overview" && (
        <div className="space-y-6">
          {/* Hero stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Uptime" value={`${data.uptimePercent}%`} color="text-emerald-600" />
            <StatCard label="Avg Response" value={`${data.avgResponseTime}ms`} color={data.avgResponseTime < 200 ? "text-emerald-600" : "text-amber-600"} />
            <StatCard label="Error Rate (24h)" value={`${data.errorRate24h}%`} color={data.errorRate24h < 1 ? "text-emerald-600" : "text-red-500"} />
            <StatCard label="API Calls (24h)" value={`${(data.totalApiCalls24h / 1000).toFixed(0)}K`} />
          </div>

          {/* Deploy status */}
          <div>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Deploy Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.deploys.map((d) => (
                <div key={d.environment} className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-gray-400">{d.environment}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${DEPLOY_STATUS_COLORS[d.status]}`}>{d.status}</span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-[#0D1B2A]">{d.version}</p>
                  <p className="text-[10px] text-gray-400">Deployed {d.deployedAt.slice(0, 16).replace("T", " ")}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-400">Uptime</span>
                    <span className={`font-bold ${d.uptime > 99.9 ? "text-emerald-600" : "text-amber-600"}`}>{d.uptime}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Critical bugs */}
          {criticalBugs.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-red-600 mb-3">Critical Bugs ({criticalBugs.length})</h3>
              <div className="space-y-2">
                {criticalBugs.map((b) => (
                  <div key={b.id} className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-900">{b.id}: {b.title}</p>
                      <p className="text-xs text-red-600 mt-0.5">{b.assignee} · {b.platform} · {b.reportedAt}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[b.status]}`}>{b.status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top slow endpoints */}
          <div>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Slowest Endpoints (p95)</h3>
            <div className="space-y-2">
              {[...data.latency].sort((a, b) => b.p95 - a.p95).slice(0, 5).map((l) => (
                <div key={l.endpoint} className="flex items-center gap-3">
                  <code className="text-xs text-gray-500 w-48 truncate">{l.endpoint}</code>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${l.p95 > 1000 ? "bg-red-400" : l.p95 > 500 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ width: `${Math.min(100, (l.p95 / 5000) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-16 text-right ${l.p95 > 1000 ? "text-red-500" : l.p95 > 500 ? "text-amber-600" : "text-emerald-600"}`}>
                    {l.p95}ms
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top suggestions */}
          <div>
            <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Top User Suggestions</h3>
            <div className="space-y-2">
              {[...data.suggestions].sort((a, b) => b.votes - a.votes).slice(0, 5).map((s) => (
                <div key={s.id} className="rounded-lg bg-white border border-gray-100 p-3 flex items-center gap-3">
                  <div className="flex flex-col items-center w-12">
                    <span className="text-lg font-bold text-[#0D1B2A]">{s.votes}</span>
                    <span className="text-[9px] text-gray-400">votes</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 truncate">{s.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${SUGGESTION_STATUS_COLORS[s.status]}`}>
                    {s.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BUGS */}
      {view === "bugs" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Filter:</span>
            {(["all", "open", "in_progress", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setBugFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                  bugFilter === f ? "bg-[#0D1B2A] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Open" value={data.bugs.filter((b) => b.status === "open").length} color="text-red-500" />
            <StatCard label="In Progress" value={data.bugs.filter((b) => b.status === "in_progress").length} color="text-blue-600" />
            <StatCard label="Resolved" value={data.bugs.filter((b) => b.status === "resolved").length} color="text-emerald-600" />
            <StatCard label="Critical" value={criticalBugs.length} color={criticalBugs.length > 0 ? "text-red-600" : "text-emerald-600"} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">ID</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Title</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Severity</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Platform</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Assignee</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Reported</th>
                </tr>
              </thead>
              <tbody>
                {filteredBugs.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{b.id}</code></td>
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-gray-900">{b.title}</p>
                      <p className="text-xs text-gray-400 truncate max-w-xs">{b.description}</p>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${SEVERITY_COLORS[b.severity]}`}>{b.severity}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[b.status]}`}>{b.status.replace("_", " ")}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{b.platform}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-700">{b.assignee}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">{b.reportedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LATENCY */}
      {view === "latency" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Avg p50" value={`${Math.round(data.latency.reduce((s, l) => s + l.p50, 0) / data.latency.length)}ms`} />
            <StatCard label="Avg p95" value={`${Math.round(data.latency.reduce((s, l) => s + l.p95, 0) / data.latency.length)}ms`} />
            <StatCard label="Avg p99" value={`${Math.round(data.latency.reduce((s, l) => s + l.p99, 0) / data.latency.length)}ms`} />
            <StatCard label="Avg Error Rate" value={`${(data.latency.reduce((s, l) => s + l.errorRate, 0) / data.latency.length).toFixed(2)}%`} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Endpoint</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">p50</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">p95</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">p99</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Error %</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Req/min</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Health</th>
                </tr>
              </thead>
              <tbody>
                {[...data.latency].sort((a, b) => b.p95 - a.p95).map((l) => {
                  const health = l.p95 < 300 && l.errorRate < 0.5 ? "healthy" : l.p95 < 1000 && l.errorRate < 2 ? "warning" : "critical";
                  return (
                    <tr key={l.endpoint} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-3"><code className="text-xs">{l.endpoint}</code></td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">{l.p50}ms</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-bold ${l.p95 > 1000 ? "text-red-500" : l.p95 > 500 ? "text-amber-600" : "text-gray-900"}`}>{l.p95}ms</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${l.p99 > 2000 ? "text-red-500" : "text-gray-600"}`}>{l.p99}ms</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${l.errorRate > 1 ? "text-red-500 font-bold" : "text-gray-600"}`}>{l.errorRate}%</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-500">{l.requestsPerMin}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${health === "healthy" ? "bg-emerald-400" : health === "warning" ? "bg-amber-400" : "bg-red-400"}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUGGESTIONS */}
      {view === "suggestions" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Sort:</span>
            {(["votes", "newest"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSuggestionSort(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                  suggestionSort === s ? "bg-[#0D1B2A] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {s === "votes" ? "Most Voted" : "Newest"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total" value={data.suggestions.length} />
            <StatCard label="New" value={data.suggestions.filter((s) => s.status === "new").length} />
            <StatCard label="Planned" value={data.suggestions.filter((s) => s.status === "planned").length} color="text-purple-600" />
            <StatCard label="In Progress" value={data.suggestions.filter((s) => s.status === "in_progress").length} color="text-amber-600" />
            <StatCard label="Shipped" value={data.suggestions.filter((s) => s.status === "shipped").length} color="text-emerald-600" />
          </div>

          <div className="space-y-2">
            {sortedSuggestions.map((s) => (
              <div key={s.id} className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm flex items-start gap-4">
                <div className="flex flex-col items-center min-w-[48px]">
                  <span className="text-xl font-bold text-[#0D1B2A]">{s.votes}</span>
                  <span className="text-[9px] text-gray-400">votes</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{s.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SUGGESTION_STATUS_COLORS[s.status]}`}>{s.status.replace("_", " ")}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500">{s.category}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                  <p className="text-[10px] text-gray-400 mt-1">by {s.submittedBy} · {s.submittedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEPLOYS */}
      {view === "deploys" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data.deploys.map((d) => (
              <div key={d.environment} className="rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100">
                <div className={`h-1.5 ${d.status === "healthy" ? "bg-emerald-400" : d.status === "degraded" ? "bg-amber-400" : "bg-red-400"}`} />
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{d.environment}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${DEPLOY_STATUS_COLORS[d.status]}`}>{d.status}</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-[#0D1B2A]">{d.version}</p>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Deployed</span>
                      <span className="text-gray-700 font-medium">{d.deployedAt.slice(0, 16).replace("T", " ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Uptime</span>
                      <span className={`font-bold ${d.uptime > 99.9 ? "text-emerald-600" : "text-amber-600"}`}>{d.uptime}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Incident</span>
                      <span className="text-gray-500">{d.lastIncident.slice(0, 16).replace("T", " ")}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
