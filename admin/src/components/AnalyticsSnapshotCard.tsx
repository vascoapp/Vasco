"use client";

import { useEffect, useState } from "react";
import { fetchAnalyticsSnapshot, type AnalyticsSnapshot } from "@/lib/analyticsSnapshot";

export function AnalyticsSnapshotCard() {
  const [snap, setSnap] = useState<AnalyticsSnapshot | null>(null);
  useEffect(() => { fetchAnalyticsSnapshot().then(setSnap); }, []);

  if (!snap) {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-400">Loading analytics…</div>;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">Analytics · last 30 days</h3>
        <span className={`text-[10px] uppercase tracking-wider ${snap.live ? "text-emerald-600" : "text-zinc-400"}`}>
          {snap.live ? "Live" : "No data"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Events" value={snap.totalEventsLast30d.toLocaleString()} />
        <Stat label="Unique users" value={snap.uniqueUsersLast30d.toLocaleString()} />
      </div>

      {snap.topEvents.length > 0 ? (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Top events</p>
          <ul className="mt-2 space-y-1 text-sm">
            {snap.topEvents.map((e) => (
              <li key={e.name} className="flex items-center justify-between">
                <span className="font-mono text-zinc-700">{e.name}</span>
                <span className="tabular-nums text-zinc-900">{e.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#0D1B2A]">{value}</p>
    </div>
  );
}
