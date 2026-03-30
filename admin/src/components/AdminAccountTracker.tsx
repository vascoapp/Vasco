"use client";

import { useState } from "react";
import type { TikTokAccount } from "@/lib/kpi";
import { AdminDemoBanner } from "@/components/AdminDemoBanner";

const DEMO_ACCOUNTS: TikTokAccount[] = [
  { id: "a1", handle: "@vasco.eu", platform: "tiktok", language: "EN", description: "Main EU account", followers: 24800, isActive: true, totalVideos: 42, totalViews: 890000, avgViews: 21190, hitRate: 24, bestFormat: "before-after", bestHookType: "transformation", engagementRate: 6.2 },
  { id: "a2", handle: "@vasco.nl", platform: "tiktok", language: "NL", description: "Dutch market", followers: 18200, isActive: true, totalVideos: 36, totalViews: 620000, avgViews: 17222, hitRate: 22, bestFormat: "project-showcase", bestHookType: "tip", engagementRate: 5.8 },
  { id: "a3", handle: "@vasco.de", platform: "tiktok", language: "DE", description: "German market", followers: 15400, isActive: true, totalVideos: 28, totalViews: 480000, avgViews: 17142, hitRate: 28, bestFormat: "tool-review", bestHookType: "problem-solution", engagementRate: 7.1 },
  { id: "a4", handle: "@vasco.fr", platform: "tiktok", language: "FR", description: "French market", followers: 8600, isActive: true, totalVideos: 18, totalViews: 220000, avgViews: 12222, hitRate: 16, bestFormat: "day-in-life", bestHookType: "behind-scenes", engagementRate: 4.9 },
  { id: "a5", handle: "@vasco.es", platform: "tiktok", language: "ES", description: "Spanish market", followers: 5200, isActive: true, totalVideos: 12, totalViews: 98000, avgViews: 8166, hitRate: 12, bestFormat: "testimonial", bestHookType: "challenge", engagementRate: 5.4 },
  { id: "a6", handle: "@vasco.it", platform: "tiktok", language: "IT", description: "Italian market", followers: 3800, isActive: true, totalVideos: 9, totalViews: 64000, avgViews: 7111, hitRate: 11, bestFormat: "tutorial", bestHookType: "tip", engagementRate: 4.6 },
];

function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function AdminAccountTracker() {
  const [accounts] = useState(DEMO_ACCOUNTS);
  const totalFollowers = accounts.reduce((s, a) => s + a.followers, 0);
  const totalViews = accounts.reduce((s, a) => s + a.totalViews, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[#0D1B2A]">TikTok Accounts</h2>
      <AdminDemoBanner />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Total Accounts</p><p className="text-2xl font-bold text-[#0D1B2A]">{accounts.length}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Total Followers</p><p className="text-2xl font-bold text-[#0D1B2A]">{fmtK(totalFollowers)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Total Views</p><p className="text-2xl font-bold text-[#0D1B2A]">{fmtK(totalViews)}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-gray-400">Best Account</p><p className="text-2xl font-bold text-[#E35205]">@vasco.de</p><p className="text-xs text-gray-400">7.1% engagement</p></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((a) => (
          <div key={a.id} className="rounded-2xl bg-white shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div><h3 className="text-sm font-bold text-[#0D1B2A]">{a.handle}</h3><p className="text-xs text-gray-400">{a.description}</p></div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">{a.language}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><p className="text-[10px] text-gray-400">Followers</p><p className="text-lg font-bold">{fmtK(a.followers)}</p></div>
              <div><p className="text-[10px] text-gray-400">Videos</p><p className="text-lg font-bold">{a.totalVideos}</p></div>
              <div><p className="text-[10px] text-gray-400">Hit Rate</p><p className={`text-lg font-bold ${a.hitRate >= 20 ? "text-emerald-600" : "text-amber-600"}`}>{a.hitRate}%</p></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-gray-400">Best format:</span> <span className="font-medium capitalize">{a.bestFormat.replace("-", " ")}</span></div>
              <div><span className="text-gray-400">Engagement:</span> <span className="font-bold text-[#0D1B2A]">{a.engagementRate}%</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
