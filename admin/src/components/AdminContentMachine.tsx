"use client";

import { useState, useMemo } from "react";
import {
  generateIdeas,
  generateSeries,
  generateWeeklyCalendar,
  exportCalendarMarkdown,
  generateCaptionPacks,
  planBatch,
  exportBatchMarkdown,
  PRE_SESSION_CHECKLIST,
  PILLARS,
  ACCOUNTS,
  TRADES,
} from "@/lib/content-machine";
import type {
  ContentIdea,
  WeeklyCalendar,
  CaptionPack,
  ContentBatch,
  LanguageCode,
} from "@/lib/content-machine";

// ─── Badge ─────────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
  gray: "bg-gray-100 text-gray-600",
  orange: "bg-orange-100 text-orange-700",
};

function Badge({ label, color = "gray" }: { label: string; color?: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_COLORS[color] ?? BADGE_COLORS.gray}`}>
      {label}
    </span>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-[#0D1B2A]">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Copy button ───────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy Markdown" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── Pillar Distribution Bar ───────────────────────────────────────────────

function PillarBar({ ideas }: { ideas: ContentIdea[] }) {
  const total = ideas.length || 1;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
      {PILLARS.map((p) => {
        const count = ideas.filter((i) => i.pillarId === p.id).length;
        const pct = (count / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={p.id}
            title={`${p.emoji} ${p.name}: ${count} (${Math.round(pct)}%)`}
            className="transition-all"
            style={{ width: `${pct}%`, backgroundColor: pillarColor(p.slug) }}
          />
        );
      })}
    </div>
  );
}

function pillarColor(slug: string): string {
  const map: Record<string, string> = {
    "money-reveal": "#F59E0B",
    "speed-challenge": "#3B82F6",
    "transformation": "#8B5CF6",
    "compliance-scare": "#EF4444",
    "contractor-life": "#E35205",
    "tool-material": "#6B7280",
    "business-growth": "#10B981",
    "product-proof": "#EC4899",
  };
  return map[slug] ?? "#9CA3AF";
}

// ─── Language Flags ────────────────────────────────────────────────────────

const LANG_FLAGS: Record<LanguageCode, string> = {
  en: "EN", nl: "NL", de: "DE", fr: "FR", es: "ES", it: "IT",
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "ideas" | "calendar" | "captions" | "batch";

export function AdminContentMachine() {
  const [activeTab, setActiveTab] = useState<Tab>("ideas");
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [calendar, setCalendar] = useState<WeeklyCalendar | null>(null);
  const [captionPacks, setCaptionPacks] = useState<CaptionPack[]>([]);
  const [batch, setBatch] = useState<ContentBatch | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filters
  const [filterPillar, setFilterPillar] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");

  // Generate everything
  function handleGenerate() {
    setIsGenerating(true);
    setTimeout(() => {
      const rawIdeas = generateIdeas({ count: 30 });
      const withSeries = generateSeries(rawIdeas);
      const cal = generateWeeklyCalendar(withSeries);
      const packs = generateCaptionPacks(withSeries.slice(0, 22)); // calendar items
      const batchPlan = planBatch(withSeries, { maxDurationMins: 180 });

      setIdeas(withSeries);
      setCalendar(cal);
      setCaptionPacks(packs);
      setBatch(batchPlan);
      setIsGenerating(false);
    }, 300);
  }

  // Filtered ideas
  const filteredIdeas = useMemo(() => {
    return ideas.filter((i) => {
      if (filterPillar !== "all" && i.pillarId !== filterPillar) return false;
      if (filterAccount !== "all" && i.accountId !== filterAccount) return false;
      return true;
    });
  }, [ideas, filterPillar, filterAccount]);

  const boostableCount = ideas.filter((i) => i.paidCandidate).length;

  // ─── Tabs ────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string }[] = [
    { id: "ideas", label: "Ideas" },
    { id: "calendar", label: "Calendar" },
    { id: "captions", label: "Captions" },
    { id: "batch", label: "Batch Plan" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0D1B2A]">Content Machine</h1>
          <p className="text-sm text-gray-500">One-click weekly content generation for EU6 markets</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-lg bg-[#E35205] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C44804] disabled:opacity-50"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Generating...
            </span>
          ) : (
            "Generate Week"
          )}
        </button>
      </div>

      {/* Empty State */}
      {ideas.length === 0 && !isGenerating && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-600">No content generated yet</h3>
          <p className="mt-1 text-xs text-gray-400">Click &quot;Generate Week&quot; to create 30 content ideas with calendar, captions, and batch filming plan</p>
        </div>
      )}

      {/* Content Tabs */}
      {ideas.length > 0 && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Ideas" value={ideas.length} />
            <StatCard label="Scheduled" value={calendar?.items.length ?? 0} />
            <StatCard label="Caption Packs" value={captionPacks.length} sub={`${captionPacks.length * 12} captions`} />
            <StatCard label="Batch Videos" value={batch?.items.length ?? 0} sub={batch ? `${batch.estimatedDurationMins}min` : undefined} />
            <StatCard label="Boostable" value={boostableCount} sub={`${Math.round((boostableCount / ideas.length) * 100)}%`} />
          </div>

          {/* Pillar Distribution */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Pillar Distribution</p>
            <PillarBar ideas={ideas} />
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PILLARS.map((p) => {
                const count = ideas.filter((i) => i.pillarId === p.id).length;
                return (
                  <span key={p.id} className="text-[10px] text-gray-400">
                    {p.emoji} {p.name}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "border-b-2 border-[#E35205] text-[#0D1B2A]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "ideas" && (
            <IdeasTab
              ideas={filteredIdeas}
              filterPillar={filterPillar}
              setFilterPillar={setFilterPillar}
              filterAccount={filterAccount}
              setFilterAccount={setFilterAccount}
            />
          )}
          {activeTab === "calendar" && calendar && <CalendarTab calendar={calendar} />}
          {activeTab === "captions" && <CaptionsTab packs={captionPacks} />}
          {activeTab === "batch" && batch && <BatchTab batch={batch} />}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: IDEAS
// ═══════════════════════════════════════════════════════════════════════════

function IdeasTab({
  ideas,
  filterPillar,
  setFilterPillar,
  filterAccount,
  setFilterAccount,
}: {
  ideas: ContentIdea[];
  filterPillar: string;
  setFilterPillar: (v: string) => void;
  filterAccount: string;
  setFilterAccount: (v: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterPillar}
          onChange={(e) => setFilterPillar(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600"
        >
          <option value="all">All Pillars</option>
          {PILLARS.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
          ))}
        </select>
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600"
        >
          <option value="all">All Accounts</option>
          {ACCOUNTS.map((a) => (
            <option key={a.id} value={a.id}>{a.handle}</option>
          ))}
        </select>
        <span className="self-center text-xs text-gray-400">{ideas.length} ideas</span>
      </div>

      {/* Idea Cards */}
      <div className="space-y-2">
        {ideas.map((idea) => {
          const pillar = PILLARS.find((p) => p.id === idea.pillarId);
          const account = ACCOUNTS.find((a) => a.id === idea.accountId);
          const trade = TRADES.find((t) => t.id === idea.tradeId);
          const isExpanded = expandedId === idea.id;

          return (
            <div key={idea.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : idea.id)}
                className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-gray-50"
              >
                <span className="mt-0.5 text-lg">{pillar?.emoji ?? "📝"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0D1B2A] leading-snug">{idea.hook}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge label={idea.format} color="blue" />
                    <Badge label={idea.presenceMode.replace(/_/g, " ")} color="purple" />
                    <Badge label={idea.objectiveType} color="green" />
                    {account && <Badge label={account.handle} color="gray" />}
                    {trade && <Badge label={trade.name} color="orange" />}
                    {idea.paidCandidate && <Badge label="Boostable" color="amber" />}
                    {idea.seriesId && <Badge label={`Series #${idea.seriesOrder}`} color="red" />}
                  </div>
                </div>
                <svg className={`h-4 w-4 flex-shrink-0 text-gray-400 transition ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3 text-xs">
                  <div>
                    <p className="font-semibold text-gray-500 mb-1">Concept</p>
                    <p className="text-gray-700">{idea.concept}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-gray-500 mb-1">Shot List</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-gray-600">
                        {idea.shotList.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">SEO Keyword</p>
                        <p className="text-gray-600">{idea.targetKeyword}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">Hashtags</p>
                        <p className="text-gray-600">{idea.hashtags.join(" ")}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">CTA</p>
                        <p className="text-gray-600">{idea.cta}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-500 mb-1">Duration</p>
                        <p className="text-gray-600">{idea.estimatedDuration}</p>
                      </div>
                      {idea.boostableReason && (
                        <div>
                          <p className="font-semibold text-gray-500 mb-1">Boost Reason</p>
                          <p className="text-gray-600">{idea.boostableReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {idea.voiceover && (
                    <div>
                      <p className="font-semibold text-gray-500 mb-1">Voiceover Script</p>
                      <p className="whitespace-pre-line text-gray-600 bg-white rounded p-2 border border-gray-200">{idea.voiceover}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: CALENDAR
// ═══════════════════════════════════════════════════════════════════════════

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarTab({ calendar }: { calendar: WeeklyCalendar }) {
  const markdown = useMemo(() => exportCalendarMarkdown(calendar), [calendar]);

  // Group items by date
  const byDate = useMemo(() => {
    const map = new Map<string, typeof calendar.items>();
    for (const item of calendar.items) {
      if (!map.has(item.plannedDate)) map.set(item.plannedDate, []);
      map.get(item.plannedDate)!.push(item);
    }
    return map;
  }, [calendar]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0D1B2A]">{calendar.goal}</p>
          <p className="text-xs text-gray-400">{calendar.notes}</p>
        </div>
        <CopyButton text={markdown} />
      </div>

      {/* Pillar Distribution Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-3 py-2 font-medium">Pillar</th>
              <th className="px-3 py-2 font-medium text-center">Target</th>
              <th className="px-3 py-2 font-medium text-center">Actual</th>
              <th className="px-3 py-2 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {PILLARS.map((p) => {
              const dist = calendar.pillarDistribution[p.slug];
              if (!dist) return null;
              const ok = dist.actual >= dist.target;
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-gray-700">{p.emoji} {p.name}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{dist.target}</td>
                  <td className="px-3 py-2 text-center font-medium text-[#0D1B2A]">{dist.actual}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge label={ok ? "OK" : "Adjust"} color={ok ? "green" : "amber"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 7-Day Grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(calendar.weekStart);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split("T")[0];
          const items = byDate.get(dateStr) ?? [];
          const isBatch = dateStr === calendar.batchFilmDay;

          return (
            <div
              key={dateStr}
              className={`rounded-lg border p-3 ${isBatch ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-[#0D1B2A]">{DAY_NAMES[i]}</p>
                {isBatch && <Badge label="Film Day" color="amber" />}
              </div>
              <p className="mb-2 text-[10px] text-gray-400">{dateStr}</p>
              {items.length === 0 ? (
                <p className="text-[10px] text-gray-300 italic">{isBatch ? "Filming — no posts" : "No posts"}</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item) => {
                    const acc = ACCOUNTS.find((a) => a.id === item.accountId);
                    return (
                      <div key={item.id} className="rounded border border-gray-100 bg-gray-50 p-1.5">
                        <p className="text-[10px] font-medium text-gray-400">{item.plannedTime} · {acc?.handle}</p>
                        <p className="text-[10px] text-gray-700 leading-snug truncate">{item.idea.hook}</p>
                        <div className="mt-0.5 flex gap-1">
                          <Badge label={item.format} color="blue" />
                          <Badge label={item.idea.presenceMode.replace(/_/g, " ")} color="purple" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Warnings */}
      {calendar.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Mix Warnings</p>
          <ul className="space-y-0.5 text-[10px] text-amber-600">
            {calendar.warnings.map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: CAPTIONS
// ═══════════════════════════════════════════════════════════════════════════

function CaptionsTab({ packs }: { packs: CaptionPack[] }) {
  const [selectedLang, setSelectedLang] = useState<LanguageCode>("en");

  const allMarkdown = useMemo(() => {
    return packs.map((pack) => {
      const cap = pack.captions[selectedLang];
      if (!cap) return "";
      return `## ${pack.ideaTitle}\n**Hook:** ${pack.hook}\n\n**Organic:**\n${cap.organic.caption}\n\n**Commerce:**\n${cap.commerce.caption}\n\n---`;
    }).join("\n\n");
  }, [packs, selectedLang]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* Language Switcher */}
        <div className="flex gap-1">
          {(["en", "nl", "de", "fr", "es", "it"] as LanguageCode[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLang(lang)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                selectedLang === lang
                  ? "bg-[#0D1B2A] text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {LANG_FLAGS[lang]}
            </button>
          ))}
        </div>
        <CopyButton text={allMarkdown} />
      </div>

      {/* Caption Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {packs.map((pack) => {
          const cap = pack.captions[selectedLang];
          if (!cap) return null;

          return (
            <div key={pack.ideaId} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold text-[#0D1B2A] mb-2 truncate">{pack.hook}</p>

              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 mb-0.5">ORGANIC</p>
                  <p className="rounded bg-gray-50 p-2 text-xs text-gray-700 leading-relaxed">{cap.organic.caption}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 mb-0.5">COMMERCE</p>
                  <p className="rounded bg-orange-50 p-2 text-xs text-gray-700 leading-relaxed">{cap.commerce.caption}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cap.organic.hashtags.map((h, i) => (
                    <span key={i} className="text-[10px] text-blue-500">{h}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: BATCH PLAN
// ═══════════════════════════════════════════════════════════════════════════

function BatchTab({ batch }: { batch: ContentBatch }) {
  const markdown = useMemo(() => exportBatchMarkdown(batch), [batch]);
  const [checklist, setChecklist] = useState<boolean[]>(PRE_SESSION_CHECKLIST.map(() => false));
  const [filmedItems, setFilmedItems] = useState<Set<string>>(new Set());

  function toggleChecklist(idx: number) {
    setChecklist((prev) => { const next = [...prev]; next[idx] = !next[idx]; return next; });
  }

  function toggleFilmed(itemId: string) {
    setFilmedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  // Group by presence mode
  const byPresence = useMemo(() => {
    const map = new Map<string, typeof batch.items>();
    for (const item of batch.items) {
      const mode = item.idea.presenceMode;
      if (!map.has(mode)) map.set(mode, []);
      map.get(mode)!.push(item);
    }
    return map;
  }, [batch]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-4 gap-3 flex-1 mr-4">
          <StatCard label="Videos" value={batch.items.length} />
          <StatCard label="Est. Time" value={`${batch.estimatedDurationMins}min`} sub={`${Math.round(batch.estimatedDurationMins / 60 * 10) / 10}h`} />
          <StatCard label="Primary Setup" value={batch.setupType.replace(/_/g, " ")} />
          <StatCard label="Filmed" value={`${filmedItems.size}/${batch.items.length}`} />
        </div>
        <CopyButton text={markdown} />
      </div>

      {/* Pre-Session Checklist */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-xs font-semibold text-[#0D1B2A] mb-2">Pre-Session Checklist</p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {PRE_SESSION_CHECKLIST.map((item, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
              <input
                type="checkbox"
                checked={checklist[i]}
                onChange={() => toggleChecklist(i)}
                className="rounded border-gray-300 text-[#E35205] focus:ring-[#E35205]"
              />
              <span className={checklist[i] ? "line-through text-gray-400" : ""}>{item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Shot List by Presence Mode */}
      {Array.from(byPresence).map(([mode, items]) => (
        <div key={mode} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-[#0D1B2A]">{mode.replace(/_/g, " ").toUpperCase()} — {items.length} videos</p>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const trade = TRADES.find((t) => t.id === item.idea.tradeId);
              return (
                <div key={item.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={filmedItems.has(item.id)}
                      onChange={() => toggleFilmed(item.id)}
                      className="mt-0.5 rounded border-gray-300 text-[#E35205] focus:ring-[#E35205]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold ${filmedItems.has(item.id) ? "text-gray-400 line-through" : "text-[#0D1B2A]"}`}>
                        #{item.shotOrder}. {item.idea.title}
                      </p>
                      <div className="mt-1 flex gap-1.5">
                        <Badge label={item.idea.format} color="blue" />
                        <Badge label={item.idea.estimatedDuration} color="gray" />
                        {trade && <Badge label={trade.name} color="orange" />}
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">{item.setupNotes}</p>
                      <div className="mt-1.5">
                        <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Shots:</p>
                        {item.idea.shotList.map((shot, si) => (
                          <p key={si} className="text-[10px] text-gray-500 ml-2">• {shot}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
