// ---------------------------------------------------------------------------
// Pod Management & Content Pipeline — types, demo data, queries
// ---------------------------------------------------------------------------

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type PipelineStatus = "idea" | "scripted" | "filming" | "editing" | "ready" | "posted" | "tracking";

export const PIPELINE_STAGES: { id: PipelineStatus; label: string; color: string }[] = [
  { id: "idea", label: "Idea", color: "bg-gray-100 text-gray-600" },
  { id: "scripted", label: "Scripted", color: "bg-blue-100 text-blue-700" },
  { id: "filming", label: "Filming", color: "bg-purple-100 text-purple-700" },
  { id: "editing", label: "Editing", color: "bg-amber-100 text-amber-700" },
  { id: "ready", label: "Ready", color: "bg-cyan-100 text-cyan-700" },
  { id: "posted", label: "Posted", color: "bg-emerald-100 text-emerald-700" },
  { id: "tracking", label: "Tracking", color: "bg-rose-100 text-rose-700" },
];

export type Priority = "low" | "normal" | "high" | "urgent";

export interface PipelineItem {
  id: string;
  title: string;
  description: string;
  podId: string;
  podName: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  accountId: string;
  hookText: string;
  hookType: string;
  format: string;
  conceptCluster: string;
  niche: string;
  country: string;
  status: PipelineStatus;
  dueDate: string;
  postedDate: string;
  videoId: string;
  priority: Priority;
  notes: string;
  createdAt: string;
}

export interface Pod {
  id: string;
  name: string;
  language: string;
  description: string;
  color: string;
  targetVideosPerWeek: number;
  isActive: boolean;
  members: PodMember[];
  videosThisWeek: number;
  videosThisMonth: number;
  pipelineCount: Record<PipelineStatus, number>;
  totalRevenue: number;
  avgHitRate: number;
}

export interface PodMember {
  id: string;
  creatorId: string;
  name: string;
  handle: string;
  platform: string;
  role: string;
  videosCount: number;
  hitRate: number;
  totalViews: number;
}

export interface PodPlannerData {
  pods: Pod[];
  pipeline: PipelineItem[];
  stats: {
    totalPods: number;
    activePods: number;
    totalCreators: number;
    totalPipelineItems: number;
    itemsByStatus: Record<PipelineStatus, number>;
    overdueItems: number;
    videosThisWeek: number;
    videosThisMonth: number;
  };
}

function getDemoPodData(): PodPlannerData {
  const pods: Pod[] = [
    {
      id: "pod-nl", name: "NL Pod", language: "NL", description: "Dutch market — contractors & aannemers", color: "#E35205",
      targetVideosPerWeek: 5, isActive: true,
      members: [
        { id: "m1", creatorId: "c1", name: "Bouwer Jan", handle: "@bouwer.jan", platform: "tiktok", role: "lead", videosCount: 14, hitRate: 28, totalViews: 210000 },
        { id: "m2", creatorId: "c2", name: "Loodgieter Piet", handle: "@loodgieter.piet", platform: "tiktok", role: "creator", videosCount: 9, hitRate: 15, totalViews: 98000 },
      ],
      videosThisWeek: 3, videosThisMonth: 16,
      pipelineCount: { idea: 2, scripted: 1, filming: 1, editing: 1, ready: 1, posted: 4, tracking: 2 },
      totalRevenue: 1840, avgHitRate: 22,
    },
    {
      id: "pod-de", name: "DE Pod", language: "DE", description: "German market — Handwerker content", color: "#1E3A8A",
      targetVideosPerWeek: 4, isActive: true,
      members: [
        { id: "m3", creatorId: "c3", name: "Elektro Max", handle: "@elektro.max", platform: "tiktok", role: "lead", videosCount: 11, hitRate: 32, totalViews: 245000 },
        { id: "m4", creatorId: "c4", name: "Maler Hans", handle: "@maler.hans", platform: "instagram", role: "creator", videosCount: 7, hitRate: 18, totalViews: 72000 },
      ],
      videosThisWeek: 2, videosThisMonth: 11,
      pipelineCount: { idea: 3, scripted: 2, filming: 1, editing: 0, ready: 1, posted: 3, tracking: 1 },
      totalRevenue: 1420, avgHitRate: 25,
    },
    {
      id: "pod-fr", name: "FR Pod", language: "FR", description: "French market — artisans du bâtiment", color: "#10B981",
      targetVideosPerWeek: 3, isActive: true,
      members: [
        { id: "m5", creatorId: "c5", name: "Peintre Pierre", handle: "@peintre.pierre", platform: "tiktok", role: "lead", videosCount: 8, hitRate: 20, totalViews: 134000 },
      ],
      videosThisWeek: 1, videosThisMonth: 6,
      pipelineCount: { idea: 2, scripted: 1, filming: 0, editing: 1, ready: 0, posted: 2, tracking: 0 },
      totalRevenue: 680, avgHitRate: 20,
    },
    {
      id: "pod-uk", name: "UK Pod", language: "EN", description: "UK market — builders & tradespeople", color: "#F59E0B",
      targetVideosPerWeek: 4, isActive: true,
      members: [
        { id: "m6", creatorId: "c6", name: "Plumber Pete", handle: "@plumber.pete", platform: "tiktok", role: "lead", videosCount: 10, hitRate: 24, totalViews: 186000 },
      ],
      videosThisWeek: 2, videosThisMonth: 8,
      pipelineCount: { idea: 1, scripted: 2, filming: 1, editing: 0, ready: 1, posted: 2, tracking: 1 },
      totalRevenue: 920, avgHitRate: 24,
    },
    {
      id: "pod-es", name: "ES Pod", language: "ES", description: "Spanish market — profesionales de la construcción", color: "#8B5CF6",
      targetVideosPerWeek: 3, isActive: true,
      members: [
        { id: "m7", creatorId: "c7", name: "Fontanero Carlos", handle: "@fontanero.carlos", platform: "tiktok", role: "lead", videosCount: 6, hitRate: 16, totalViews: 68000 },
      ],
      videosThisWeek: 1, videosThisMonth: 5,
      pipelineCount: { idea: 2, scripted: 1, filming: 0, editing: 0, ready: 1, posted: 1, tracking: 0 },
      totalRevenue: 420, avgHitRate: 16,
    },
    {
      id: "pod-it", name: "IT Pod", language: "IT", description: "Italian market — artigiani edili", color: "#EC4899",
      targetVideosPerWeek: 3, isActive: true,
      members: [
        { id: "m8", creatorId: "c8", name: "Idraulico Marco", handle: "@idraulico.marco", platform: "tiktok", role: "lead", videosCount: 5, hitRate: 14, totalViews: 52000 },
      ],
      videosThisWeek: 1, videosThisMonth: 4,
      pipelineCount: { idea: 1, scripted: 1, filming: 1, editing: 0, ready: 0, posted: 1, tracking: 0 },
      totalRevenue: 340, avgHitRate: 14,
    },
  ];

  const hooks = [
    "This plumber made €12K in one week", "POV: your first solo renovation",
    "3 tools every electrician needs", "Before and after this kitchen remodel",
    "Why Dutch contractors use Vasco", "The invoice hack that saved my business",
    "Site lead morning routine", "How I grew my painting business 3x",
  ];
  const formats = ["before-after", "tool-review", "day-in-life", "project-showcase", "tutorial", "testimonial"];
  const clusters = ["contractor-life", "project-showcase", "before-after", "tool-tips", "business-growth", "compliance-tips"];
  const statuses: PipelineStatus[] = ["idea", "idea", "scripted", "scripted", "filming", "editing", "ready", "posted", "posted", "tracking", "idea", "scripted", "filming", "ready", "posted", "tracking"];

  const now = new Date();
  const pipeline: PipelineItem[] = statuses.map((status, i) => {
    const pod = pods[i % pods.length];
    const member = pod.members[i % pod.members.length];
    const dueDate = new Date(now.getTime() + (i - 8) * 86400000);
    return {
      id: `pipe-${i}`,
      title: hooks[i % hooks.length],
      description: `${formats[i % formats.length]} for ${pod.language} market`,
      podId: pod.id,
      podName: pod.name,
      creatorId: member.creatorId,
      creatorName: member.name,
      creatorHandle: member.handle,
      accountId: `@vasco.${pod.language.toLowerCase()}`,
      hookText: hooks[i % hooks.length],
      hookType: ["transformation", "problem-solution", "challenge", "behind-scenes", "tip", "myth-busting"][i % 6],
      format: formats[i % formats.length],
      conceptCluster: clusters[i % clusters.length],
      niche: "construction",
      country: pod.language,
      status,
      dueDate: dueDate.toISOString().slice(0, 10),
      postedDate: status === "posted" || status === "tracking" ? new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10) : "",
      videoId: status === "tracking" ? `tiktok-${3000 + i}` : "",
      priority: (["normal", "normal", "high", "normal", "urgent", "low"][i % 6]) as Priority,
      notes: "",
      createdAt: new Date(now.getTime() - (i + 5) * 86400000).toISOString(),
    };
  });

  const itemsByStatus: Record<PipelineStatus, number> = { idea: 0, scripted: 0, filming: 0, editing: 0, ready: 0, posted: 0, tracking: 0 };
  for (const item of pipeline) itemsByStatus[item.status]++;

  const overdue = pipeline.filter((p) => p.dueDate && p.dueDate < now.toISOString().slice(0, 10) && !["posted", "tracking"].includes(p.status)).length;

  return {
    pods,
    pipeline,
    stats: {
      totalPods: pods.length,
      activePods: pods.filter((p) => p.isActive).length,
      totalCreators: pods.reduce((s, p) => s + p.members.length, 0),
      totalPipelineItems: pipeline.length,
      itemsByStatus,
      overdueItems: overdue,
      videosThisWeek: pods.reduce((s, p) => s + p.videosThisWeek, 0),
      videosThisMonth: pods.reduce((s, p) => s + p.videosThisMonth, 0),
    },
  };
}

export async function fetchPodPlannerData(): Promise<PodPlannerData> {
  if (!isSupabaseConfigured()) return getDemoPodData();
  return getDemoPodData();
}
