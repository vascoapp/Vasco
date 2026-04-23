"use client";

// =============================================================================
// AdminRetentionCohorts (R224)
// =============================================================================
// Heatmap grid of signup-cohort retention by weeks-since-signup.
// Rows = signup ISO weeks (most recent first). Columns = week offset.
// Cell tint: green (≥70%), amber (40–69%), red (>0%).
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { fetchRetentionCohorts, retentionTint, type RetentionGrid } from "@/lib/retention";

export function AdminRetentionCohorts() {
  const [grid, setGrid] = useState<RetentionGrid | null>(null);
  const [weeksBack, setWeeksBack] = useState<number>(12);

  useEffect(() => {
    fetchRetentionCohorts({ weeksBack, maxWeekOffset: 12 }).then(setGrid);
  }, [weeksBack]);

  const columnOffsets = useMemo(() => {
    if (!grid) return [] as number[];
    const max = Math.min(grid.maxWeekOffset, 12);
    return Array.from({ length: max + 1 }, (_, i) => i);
  }, [grid]);

  if (!grid) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-400">
        Loading retention…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">Signup cohort retention</h3>
        <div className="flex items-center gap-3">
          <label className="text-[10px] uppercase tracking-widest text-zinc-400">
            Weeks back
            <select
              value={weeksBack}
              onChange={(e) => setWeeksBack(Number(e.target.value))}
              className="ml-2 rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700"
            >
              {[4, 8, 12, 26, 52].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className={`text-[10px] uppercase tracking-wider ${grid.live ? "text-emerald-600" : "text-zinc-400"}`}>
            {grid.live ? "Live" : "No data"}
          </span>
        </div>
      </div>

      {grid.cohorts.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No signup_completed events in the selected window. Either no users yet
          or the analytics emitter isn&apos;t firing.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-zinc-400">
                <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-bold uppercase tracking-widest">Cohort</th>
                <th className="px-2 py-1 text-right font-bold uppercase tracking-widest">N</th>
                {columnOffsets.map((w) => (
                  <th key={w} className="px-2 py-1 text-right font-bold uppercase tracking-widest">W+{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.cohorts.map((c) => (
                <tr key={c.cohortWeek} className="border-t border-zinc-100">
                  <td className="sticky left-0 z-10 bg-white px-2 py-1 font-mono text-zinc-700">{c.cohortWeek}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-zinc-700">{c.cohortSize}</td>
                  {columnOffsets.map((w) => {
                    const pct = c.retentionByWeek[w];
                    return (
                      <td
                        key={w}
                        className="px-2 py-1 text-right tabular-nums text-zinc-900"
                        style={{ backgroundColor: retentionTint(pct) }}
                      >
                        {pct == null ? "·" : `${Math.round(pct * 100)}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-zinc-400">
        Cell = % of the cohort with any business_event in that week offset.
        W+0 is always 100% by definition (the signup week itself).
      </p>
    </div>
  );
}
