"use client";

import { useState } from "react";
import type { SwipeFileEntry } from "@/lib/kpi";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

const DEMO_ENTRIES: SwipeFileEntry[] = [
  { id: "sw1", url: "", platform: "tiktok", hookText: "How this plumber makes €15K/month", hookType: "transformation", format: "day-in-life", niche: "construction", whyItWorks: "Aspirational + specific income claim drives curiosity", tags: ["income", "plumbing", "aspirational"], estimatedViews: 420000, savedBy: "Marketing", isCompetitor: true, sourceAccount: "@competitor1", createdAt: "2026-03-20" },
  { id: "sw2", url: "", platform: "tiktok", hookText: "Nobody told me this about being an electrician", hookType: "problem-solution", format: "testimonial", niche: "construction", whyItWorks: "Relatable frustration hook drives comments", tags: ["electrical", "relatable", "hook"], estimatedViews: 280000, savedBy: "Marketing", isCompetitor: false, sourceAccount: "@tradelife", createdAt: "2026-03-18" },
  { id: "sw3", url: "", platform: "instagram", hookText: "This €200 tool changed everything", hookType: "tip", format: "tool-review", niche: "construction", whyItWorks: "Specific price point + strong claim = saves", tags: ["tools", "review", "value"], estimatedViews: 165000, savedBy: "Marketing", isCompetitor: false, sourceAccount: "@toolreviews", createdAt: "2026-03-22" },
  { id: "sw4", url: "", platform: "tiktok", hookText: "3 months of renovation in 30 seconds", hookType: "transformation", format: "before-after", niche: "construction", whyItWorks: "Timelapse transformation content is highly shareable", tags: ["renovation", "timelapse", "before-after"], estimatedViews: 890000, savedBy: "Creative", isCompetitor: true, sourceAccount: "@renovationpro", createdAt: "2026-03-15" },
  { id: "sw5", url: "", platform: "tiktok", hookText: "The app every contractor needs in 2026", hookType: "tip", format: "tutorial", niche: "construction", whyItWorks: "Direct competitor — studying their positioning", tags: ["app", "competitor", "positioning"], estimatedViews: 52000, savedBy: "Product", isCompetitor: true, sourceAccount: "@tradifyapp", createdAt: "2026-03-25" },
];

function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function AdminSwipeFile() {
  const [entries] = useState(DEMO_ENTRIES);
  const [filter, setFilter] = useState<"all" | "competitor" | "organic">("all");
  const filtered = filter === "all" ? entries : filter === "competitor" ? entries.filter((e) => e.isCompetitor) : entries.filter((e) => !e.isCompetitor);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#0D1B2A]">Swipe File</h2>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
          {(["all", "competitor", "organic"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition capitalize ${filter === f ? "bg-white text-[#0D1B2A] shadow-sm" : "text-gray-500"}`}>{f}</button>
          ))}
        </div>
      </div>
      <AdminDemoBanner />
      <div className="space-y-3">
        {filtered.map((e) => (
          <div key={e.id} className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">"{e.hookText}"</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500 capitalize">{e.format.replace("-", " ")}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-600 capitalize">{e.hookType.replace("-", " ")}</span>
                  {e.isCompetitor && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600">COMPETITOR</span>}
                  <span className="text-[10px] text-gray-400">{e.platform} · {e.sourceAccount}</span>
                </div>
              </div>
              <div className="text-right ml-4">
                <p className="text-lg font-bold text-[#0D1B2A]">{fmtK(e.estimatedViews)}</p>
                <p className="text-[10px] text-gray-400">est. views</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{e.whyItWorks}</p>
            <div className="flex gap-1 mt-2">{e.tags.map((t) => <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] bg-gray-50 text-gray-400">{t}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
