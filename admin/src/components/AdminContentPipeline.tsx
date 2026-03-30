"use client";

import { useEffect, useState } from "react";
import { fetchPodPlannerData, PIPELINE_STAGES } from "@/lib/pod-planner";
import type { PodPlannerData, PipelineItem, PipelineStatus, Priority } from "@/lib/pod-planner";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

// ─── Stage Colors (bg for column headers) ──────────────────────────────────

const STAGE_HEADER_COLORS: Record<PipelineStatus, { bg: string; border: string; dot: string }> = {
  idea: { bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-400" },
  scripted: { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
  filming: { bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500" },
  editing: { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  ready: { bg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-500" },
  posted: { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  tracking: { bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500" },
};

const PRIORITY_STYLES: Record<Priority, { border: string; badge: string; label: string }> = {
  urgent: { border: "border-l-red-500", badge: "bg-red-100 text-red-700", label: "URGENT" },
  high: { border: "border-l-amber-500", badge: "bg-amber-100 text-amber-700", label: "HIGH" },
  normal: { border: "border-l-transparent", badge: "", label: "" },
  low: { border: "border-l-gray-200", badge: "bg-gray-100 text-gray-400", label: "LOW" },
};

// ─── Pipeline Card ─────────────────────────────────────────────────────────

function PipelineCard({ item }: { item: PipelineItem }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = item.dueDate && item.dueDate < today && !["posted", "tracking"].includes(item.status);
  const isDueSoon = item.dueDate && !isOverdue && item.dueDate <= new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) && !["posted", "tracking"].includes(item.status);
  const priority = PRIORITY_STYLES[item.priority];

  return (
    <div className={`rounded-lg border border-gray-100 border-l-4 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${priority.border}`}>
      {/* Title */}
      <p className="text-[11px] font-semibold text-[#0D1B2A] leading-snug line-clamp-2">{item.title}</p>

      {/* Description */}
      <p className="mt-1 text-[10px] text-gray-400 truncate">{item.description}</p>

      {/* Tags row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        {item.format && (
          <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-600 capitalize">
            {item.format.replace(/-/g, " ")}
          </span>
        )}
        {item.conceptCluster && (
          <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600">
            {item.conceptCluster.replace(/-/g, " ")}
          </span>
        )}
        {priority.badge && (
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold ${priority.badge}`}>
            {priority.label}
          </span>
        )}
      </div>

      {/* Footer: creator + due date */}
      <div className="mt-2.5 flex items-center justify-between border-t border-gray-50 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-[7px] font-bold text-gray-500">{(item.creatorName || "?")[0]}</span>
          </div>
          <span className="text-[10px] text-gray-500 truncate max-w-[80px]">{item.creatorName || "Unassigned"}</span>
        </div>
        {item.dueDate && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            isOverdue ? "bg-red-100 text-red-600" : isDueSoon ? "bg-amber-50 text-amber-600" : "text-gray-400"
          }`}>
            {isOverdue ? "Overdue" : item.dueDate.slice(5)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Stage Column ──────────────────────────────────────────────────────────

function StageColumn({ stage, items }: { stage: typeof PIPELINE_STAGES[number]; items: PipelineItem[] }) {
  const colors = STAGE_HEADER_COLORS[stage.id];

  return (
    <div className="flex flex-col min-w-[200px]">
      {/* Column header */}
      <div className={`rounded-t-xl ${colors.bg} border ${colors.border} border-b-0 px-3 py-2.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
            <span className="text-xs font-bold text-[#0D1B2A]">{stage.label}</span>
          </div>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            items.length > 0 ? `${colors.bg} text-[#0D1B2A]` : "bg-gray-100 text-gray-400"
          }`}>
            {items.length}
          </span>
        </div>
      </div>

      {/* Column body */}
      <div className={`flex-1 rounded-b-xl border ${colors.border} border-t-0 bg-gray-50/50 p-2 space-y-2 min-h-[120px]`}>
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[80px]">
            <p className="text-[10px] text-gray-300 italic">No items</p>
          </div>
        ) : (
          items.map((item) => <PipelineCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

// ─── Summary Bar ───────────────────────────────────────────────────────────

function SummaryBar({ stats, pipeline }: { stats: PodPlannerData["stats"]; pipeline: PipelineItem[] }) {
  const total = stats.totalPipelineItems;

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total</p>
          <p className="text-xl font-bold text-[#0D1B2A]">{stats.totalPipelineItems}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Overdue</p>
          <p className={`text-xl font-bold ${stats.overdueItems > 0 ? "text-red-500" : "text-emerald-600"}`}>{stats.overdueItems}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">This Week</p>
          <p className="text-xl font-bold text-[#0D1B2A]">{stats.videosThisWeek}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">This Month</p>
          <p className="text-xl font-bold text-[#0D1B2A]">{stats.videosThisMonth}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Creators</p>
          <p className="text-xl font-bold text-[#0D1B2A]">{stats.totalCreators}</p>
        </div>
      </div>

      {/* Progress bar showing pipeline distribution */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-gray-400">Pipeline Distribution</span>
          <span className="text-[10px] text-gray-400">{total} items across {stats.activePods} pods</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
          {PIPELINE_STAGES.map((stage) => {
            const count = stats.itemsByStatus[stage.id];
            if (count === 0) return null;
            const pct = (count / total) * 100;
            const colors = STAGE_HEADER_COLORS[stage.id];
            return (
              <div
                key={stage.id}
                className={`${colors.dot} relative group transition-all hover:opacity-90`}
                style={{ width: `${pct}%` }}
                title={`${stage.label}: ${count}`}
              >
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                  {stage.label}: {count}
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          {PIPELINE_STAGES.map((stage) => {
            const count = stats.itemsByStatus[stage.id];
            const colors = STAGE_HEADER_COLORS[stage.id];
            return (
              <div key={stage.id} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                <span className="text-[10px] text-gray-500">{stage.label}</span>
                <span className="text-[10px] font-bold text-gray-700">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function AdminContentPipeline() {
  const [data, setData] = useState<PodPlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPod, setFilterPod] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  useEffect(() => {
    setLoading(true);
    fetchPodPlannerData().then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" /></div>;
  }

  const { pipeline, pods, stats } = data;

  // Apply filters
  let filtered = pipeline;
  if (filterPod !== "all") filtered = filtered.filter((i) => i.podId === filterPod);
  if (filterPriority !== "all") filtered = filtered.filter((i) => i.priority === filterPriority);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0D1B2A]">Content Pipeline</h2>
          <p className="text-xs text-gray-400">{filtered.length} items {filterPod !== "all" || filterPriority !== "all" ? "(filtered)" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            <button onClick={() => setView("kanban")} className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${view === "kanban" ? "bg-white text-[#0D1B2A] shadow-sm" : "text-gray-500"}`}>
              Kanban
            </button>
            <button onClick={() => setView("list")} className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${view === "list" ? "bg-white text-[#0D1B2A] shadow-sm" : "text-gray-500"}`}>
              List
            </button>
          </div>
          {/* Filters */}
          <select value={filterPod} onChange={(e) => setFilterPod(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white">
            <option value="all">All Pods</option>
            {pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white">
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <AdminDemoBanner />

      {/* Summary bar */}
      <SummaryBar stats={stats} pipeline={filtered} />

      {/* Kanban View */}
      {view === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="grid grid-cols-7 gap-3 min-w-[1400px]">
            {PIPELINE_STAGES.map((stage) => {
              const items = filtered.filter((i) => i.status === stage.id);
              return <StageColumn key={stage.id} stage={stage} items={items} />;
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Title</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Stage</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Pod</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Creator</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Format</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Priority</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const stage = PIPELINE_STAGES.find((s) => s.id === item.status);
                const isOverdue = item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10) && !["posted", "tracking"].includes(item.status);
                const colors = STAGE_HEADER_COLORS[item.status];
                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-gray-900 text-xs">{item.title}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-xs">{item.description}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                        <span className="text-xs font-medium">{stage?.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{item.podName}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{item.creatorName || "—"}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 capitalize">{item.format?.replace(/-/g, " ") || "—"}</td>
                    <td className="py-2.5 px-3 text-center">
                      {item.priority !== "normal" && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PRIORITY_STYLES[item.priority].badge}`}>
                          {PRIORITY_STYLES[item.priority].label}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.dueDate && (
                        <span className={`text-xs font-medium ${isOverdue ? "text-red-500" : "text-gray-500"}`}>
                          {isOverdue ? "Overdue: " : ""}{item.dueDate}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
