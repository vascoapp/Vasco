"use client";

import { useState } from "react";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

interface Creator {
  id: string;
  name: string;
  handle: string;
  platform: string;
  language: string;
  affiliateCode: string;
  isActive: boolean;
  videosCount: number;
  hitRate: number;
  totalViews: number;
}

const DEMO_CREATORS: Creator[] = [
  { id: "c1", name: "Bouwer Jan", handle: "@bouwer.jan", platform: "tiktok", language: "NL", affiliateCode: "BOUWER10", isActive: true, videosCount: 14, hitRate: 28, totalViews: 210000 },
  { id: "c2", name: "Loodgieter Piet", handle: "@loodgieter.piet", platform: "tiktok", language: "NL", affiliateCode: "PIET10", isActive: true, videosCount: 9, hitRate: 15, totalViews: 98000 },
  { id: "c3", name: "Elektro Max", handle: "@elektro.max", platform: "tiktok", language: "DE", affiliateCode: "MAX10", isActive: true, videosCount: 11, hitRate: 32, totalViews: 245000 },
  { id: "c4", name: "Maler Hans", handle: "@maler.hans", platform: "instagram", language: "DE", affiliateCode: "HANS10", isActive: true, videosCount: 7, hitRate: 18, totalViews: 72000 },
  { id: "c5", name: "Peintre Pierre", handle: "@peintre.pierre", platform: "tiktok", language: "FR", affiliateCode: "PIERRE10", isActive: true, videosCount: 8, hitRate: 20, totalViews: 134000 },
  { id: "c6", name: "Plumber Pete", handle: "@plumber.pete", platform: "tiktok", language: "EN", affiliateCode: "PETE10", isActive: true, videosCount: 10, hitRate: 24, totalViews: 186000 },
  { id: "c7", name: "Fontanero Carlos", handle: "@fontanero.carlos", platform: "tiktok", language: "ES", affiliateCode: "CARLOS10", isActive: true, videosCount: 6, hitRate: 16, totalViews: 68000 },
  { id: "c8", name: "Idraulico Marco", handle: "@idraulico.marco", platform: "tiktok", language: "IT", affiliateCode: "MARCO10", isActive: true, videosCount: 5, hitRate: 14, totalViews: 52000 },
];

function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function AdminCreatorManager() {
  const [creators] = useState<Creator[]>(DEMO_CREATORS);
  const [filterLang, setFilterLang] = useState<string>("all");

  const filtered = filterLang === "all" ? creators : creators.filter((c) => c.language === filterLang);
  const languages = [...new Set(creators.map((c) => c.language))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#0D1B2A]">Creators</h2>
        <select value={filterLang} onChange={(e) => setFilterLang(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white">
          <option value="all">All Languages</option>
          {languages.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <AdminDemoBanner />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Creator</th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Language</th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Platform</th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Code</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Videos</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Hit Rate</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Total Views</th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
          </tr></thead>
          <tbody>{filtered.map((c) => (
            <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2.5 px-3"><div className="font-medium text-gray-900">{c.name}</div><div className="text-xs text-gray-400">{c.handle}</div></td>
              <td className="py-2.5 px-3 text-center"><span className="px-1.5 py-0.5 bg-blue-50 text-[#0D1B2A] rounded text-xs font-medium">{c.language}</span></td>
              <td className="py-2.5 px-3 text-center capitalize text-gray-500 text-xs">{c.platform}</td>
              <td className="py-2.5 px-3 text-center"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.affiliateCode}</code></td>
              <td className="py-2.5 px-3 text-right tabular-nums">{c.videosCount}</td>
              <td className="py-2.5 px-3 text-right"><span className={`font-bold ${c.hitRate >= 20 ? "text-emerald-600" : c.hitRate >= 10 ? "text-amber-600" : "text-gray-500"}`}>{c.hitRate}%</span></td>
              <td className="py-2.5 px-3 text-right tabular-nums font-medium">{fmtK(c.totalViews)}</td>
              <td className="py-2.5 px-3 text-center"><span className={`inline-block w-2 h-2 rounded-full ${c.isActive ? "bg-emerald-400" : "bg-gray-300"}`} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
