"use client";

import { useEffect, useState } from "react";
import { fetchPodPlannerData, PIPELINE_STAGES } from "@/lib/pod-planner";
import type { PodPlannerData, Pod } from "@/lib/pod-planner";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

function PodCard({ pod }: { pod: Pod }) {
  const [expanded, setExpanded] = useState(false);
  const totalPipeline = Object.values(pod.pipelineCount).reduce((s, n) => s + n, 0);
  const progressPct = pod.targetVideosPerWeek > 0 ? Math.min(100, Math.round((pod.videosThisWeek / pod.targetVideosPerWeek) * 100)) : 0;

  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: pod.color }} />
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div><h3 className="text-sm font-bold text-[#0D1B2A]">{pod.name}</h3><p className="text-xs text-gray-400">{pod.description}</p></div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase text-gray-500">{pod.language}</span>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Weekly target</span><span className="font-bold text-[#0D1B2A]">{pod.videosThisWeek}/{pod.targetVideosPerWeek}</span></div>
          <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: progressPct >= 100 ? "#10B981" : progressPct >= 60 ? "#F59E0B" : "#EF4444" }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div><p className="text-[10px] font-semibold text-gray-400">Members</p><p className="text-lg font-bold text-[#0D1B2A]">{pod.members.length}</p></div>
          <div><p className="text-[10px] font-semibold text-gray-400">This Month</p><p className="text-lg font-bold text-[#0D1B2A]">{pod.videosThisMonth}</p></div>
          <div><p className="text-[10px] font-semibold text-gray-400">Hit Rate</p><p className={`text-lg font-bold ${pod.avgHitRate >= 20 ? "text-emerald-600" : "text-amber-600"}`}>{pod.avgHitRate}%</p></div>
        </div>
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5">Pipeline ({totalPipeline})</p>
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
            {PIPELINE_STAGES.map((stage) => {
              const count = pod.pipelineCount[stage.id];
              if (count === 0) return null;
              return <div key={stage.id} className={`${stage.color} flex items-center justify-center text-[8px] font-bold`} style={{ width: `${(count / totalPipeline) * 100}%` }} title={`${stage.label}: ${count}`}>{count > 0 ? count : ""}</div>;
            })}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="mt-3 text-xs text-[#E35205] font-medium hover:underline">{expanded ? "Hide members" : "Show members"}</button>
        {expanded && (
          <div className="mt-2 space-y-1">
            {pod.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs py-1 border-t border-gray-100">
                <div><span className="font-medium text-gray-900">{m.name}</span><span className="text-gray-400 ml-1">{m.handle}</span></div>
                <div className="text-gray-500">{m.videosCount} vids · {m.hitRate}% hits</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPodManager() {
  const [data, setData] = useState<PodPlannerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPodPlannerData().then((d) => { setData(d); setLoading(false); }); }, []);

  if (loading || !data) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[#0D1B2A]">EU6 Market Pods</h2>
      <AdminDemoBanner />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Active Pods</p><p className="text-2xl font-bold text-[#0D1B2A]">{data.stats.activePods}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Total Creators</p><p className="text-2xl font-bold text-[#0D1B2A]">{data.stats.totalCreators}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Videos This Week</p><p className="text-2xl font-bold text-[#0D1B2A]">{data.stats.videosThisWeek}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Videos This Month</p><p className="text-2xl font-bold text-[#0D1B2A]">{data.stats.videosThisMonth}</p></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.pods.map((pod) => <PodCard key={pod.id} pod={pod} />)}
      </div>
    </div>
  );
}
