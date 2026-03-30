"use client";

import { useState, useEffect, useCallback } from "react";
import { VascoOverview } from "@/components/VascoOverview";
import { VascoKPIDashboard } from "@/components/VascoKPIDashboard";
import { DeveloperHub } from "@/components/DeveloperHub";
import { AdminUGCDashboard } from "@/components/AdminUGCDashboard";
import { AdminContentPipeline } from "@/components/AdminContentPipeline";
import { AdminPodManager } from "@/components/AdminPodManager";
import { AdminCreatorManager } from "@/components/AdminCreatorManager";
import { AdminBriefGenerator } from "@/components/AdminBriefGenerator";
import { AdminCommissionTracker } from "@/components/AdminCommissionTracker";
import { AdminWeeklyReport } from "@/components/AdminWeeklyReport";
import { AdminSwipeFile } from "@/components/AdminSwipeFile";
import { AdminAccountTracker } from "@/components/AdminAccountTracker";
import { AdminBoostTracker } from "@/components/AdminBoostTracker";
import { VascoRevenueDashboard } from "@/components/VascoRevenueDashboard";

// ─── Navigation ────────────────────────────────────────────────────────────

interface NavItem { id: string; label: string; icon: React.ReactNode; shortcut?: string; }
interface NavGroup { title: string; items: NavItem[]; }

const I = "h-4 w-4";

const NAV: NavGroup[] = [
  {
    title: "Business",
    items: [
      { id: "overview", label: "Overview", shortcut: "1", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
      { id: "kpi", label: "KPI Dashboard", shortcut: "2", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
      { id: "revenue", label: "Revenue", shortcut: "3", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
      { id: "developer", label: "Developer Hub", shortcut: "4", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
    ],
  },
  {
    title: "Marketing",
    items: [
      { id: "ugc", label: "UGC Analytics", shortcut: "5", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
      { id: "accounts", label: "Accounts", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg> },
      { id: "boost", label: "Spark Ads", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
      { id: "swipefile", label: "Swipe File", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg> },
    ],
  },
  {
    title: "Content",
    items: [
      { id: "pipeline", label: "Pipeline", shortcut: "6", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
      { id: "pods", label: "EU6 Pods", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
      { id: "creators", label: "Creators", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
      { id: "briefs", label: "Brief Generator", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
      { id: "commissions", label: "Commissions", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
      { id: "reports", label: "Weekly Reports", icon: <svg className={I} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    ],
  },
];

export function AdminTabs() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    for (const group of NAV) {
      for (const item of group.items) {
        if (item.shortcut && e.key === item.shortcut) { e.preventDefault(); setActiveTab(item.id); }
      }
    }
  }, []);

  useEffect(() => { window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [handleKeyDown]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] print:block">
      {/* Sidebar */}
      <aside className={`flex-shrink-0 border-r border-gray-200 bg-white transition-all duration-200 print:hidden ${sidebarOpen ? "w-52" : "w-14"}`}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex h-10 w-full items-center justify-center border-b border-gray-100 text-gray-400 transition hover:text-gray-600" aria-label={sidebarOpen ? "Collapse" : "Expand"}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} /></svg>
        </button>
        <nav className="p-2 space-y-4">
          {NAV.map((group) => (
            <div key={group.title}>
              {sidebarOpen && <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">{group.title}</p>}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button key={item.id} onClick={() => setActiveTab(item.id)} title={!sidebarOpen ? item.label : undefined}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-all ${isActive ? "bg-[#0D1B2A] text-white shadow-sm" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>
                      <span className="flex-shrink-0">{item.icon}</span>
                      {sidebarOpen && (<><span className="flex-1 truncate">{item.label}</span>{item.shortcut && <kbd className={`hidden text-[9px] font-mono lg:inline ${isActive ? "text-white/40" : "text-gray-300"}`}>{"\u2318"}{item.shortcut}</kbd>}</>)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6 print:p-0">
        {activeTab === "overview" && <VascoOverview />}
        {activeTab === "kpi" && <VascoKPIDashboard />}
        {activeTab === "revenue" && <VascoRevenueDashboard />}
        {activeTab === "developer" && <DeveloperHub />}
        {activeTab === "ugc" && <AdminUGCDashboard />}
        {activeTab === "accounts" && <AdminAccountTracker />}
        {activeTab === "boost" && <AdminBoostTracker />}
        {activeTab === "swipefile" && <AdminSwipeFile />}
        {activeTab === "pipeline" && <AdminContentPipeline />}
        {activeTab === "pods" && <AdminPodManager />}
        {activeTab === "creators" && <AdminCreatorManager />}
        {activeTab === "briefs" && <AdminBriefGenerator />}
        {activeTab === "commissions" && <AdminCommissionTracker />}
        {activeTab === "reports" && <AdminWeeklyReport />}
      </main>
    </div>
  );
}
