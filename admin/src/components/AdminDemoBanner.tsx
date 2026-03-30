"use client";

import { isUsingDemoData } from "@/lib/kpi";

export function AdminDemoBanner() {
  if (!isUsingDemoData()) return null;
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 font-medium">
      Demo data — connect Supabase for live metrics
    </div>
  );
}
