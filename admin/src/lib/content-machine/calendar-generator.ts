// ═══════════════════════════════════════════════════════════════════════════
// CONTENT MACHINE — CALENDAR GENERATOR
// Weekly calendar with content mix enforcement across 6 market accounts
// ═══════════════════════════════════════════════════════════════════════════

import type { ContentIdea, WeeklyCalendar, CalendarItem } from "./types";
import {
  PILLARS, ACCOUNTS, POSTING_TIMES,
  ACCOUNT_WEEKLY_TARGETS, WEEKLY_MINIMUMS,
} from "./seed-data";

// ─── Utility ───────────────────────────────────────────────────────────────

function randomId(): string {
  return `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getWeekDays(weekStart: string): string[] {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDayName(dateStr: string): string {
  const d = new Date(dateStr);
  return DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

// ─── Calendar Generator ────────────────────────────────────────────────────

export interface CalendarOptions {
  weekStart?: string;
  batchFilmDay?: string;
}

export function generateWeeklyCalendar(
  ideas: ContentIdea[],
  opts: CalendarOptions = {}
): WeeklyCalendar {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  const weekStart = opts.weekStart ?? monday.toISOString().split("T")[0];

  const days = getWeekDays(weekStart);
  const batchFilmDay = opts.batchFilmDay ?? days[2]; // Wednesday default

  // Step 1: Fill weekly minimums first
  const assigned: CalendarItem[] = [];
  const usedIdeas = new Set<string>();
  const pillarCounts: Record<string, number> = {};
  const accountCounts: Record<string, number> = {};
  const dayCounts: Record<string, number> = {};

  for (const d of days) dayCounts[d] = 0;

  // Helper to assign an idea to a day
  function assignIdea(idea: ContentIdea, day: string) {
    const timeIdx = dayCounts[day] % POSTING_TIMES.length;
    const item: CalendarItem = {
      id: randomId(),
      ideaId: idea.id,
      accountId: idea.accountId,
      plannedDate: day,
      plannedTime: POSTING_TIMES[timeIdx],
      languageCode: idea.languageCode,
      status: "planned",
      format: idea.format,
      idea,
    };
    assigned.push(item);
    usedIdeas.add(idea.id);
    pillarCounts[idea.pillarId] = (pillarCounts[idea.pillarId] ?? 0) + 1;
    accountCounts[idea.accountId] = (accountCounts[idea.accountId] ?? 0) + 1;
    dayCounts[day] = (dayCounts[day] ?? 0) + 1;
  }

  // Available days (skip batch film day)
  const postingDays = days.filter((d) => d !== batchFilmDay);

  // Step 1: Fill minimums per pillar
  for (const pillar of PILLARS) {
    const min = WEEKLY_MINIMUMS[pillar.slug] ?? 1;
    const pillarIdeas = ideas.filter(
      (i) => i.pillarId === pillar.id && !usedIdeas.has(i.id)
    );
    for (let j = 0; j < Math.min(min, pillarIdeas.length); j++) {
      const leastDay = postingDays.reduce((a, b) =>
        (dayCounts[a] ?? 0) <= (dayCounts[b] ?? 0) ? a : b
      );
      assignIdea(pillarIdeas[j], leastDay);
    }
  }

  // Step 2: Fill remaining slots up to account targets
  const totalTarget = Object.values(ACCOUNT_WEEKLY_TARGETS).reduce((a, b) => a + b, 0);
  const remaining = ideas.filter((i) => !usedIdeas.has(i.id));
  let idx = 0;

  while (assigned.length < totalTarget && idx < remaining.length) {
    const idea = remaining[idx++];
    const accountTarget = ACCOUNT_WEEKLY_TARGETS[idea.accountId] ?? 3;
    if ((accountCounts[idea.accountId] ?? 0) >= accountTarget) continue;

    const leastDay = postingDays.reduce((a, b) =>
      (dayCounts[a] ?? 0) <= (dayCounts[b] ?? 0) ? a : b
    );
    assignIdea(idea, leastDay);
  }

  // Step 3: Calculate pillar distribution
  const pillarDistribution: Record<string, { target: number; actual: number }> = {};
  for (const pillar of PILLARS) {
    const actual = assigned.filter((i) => i.idea.pillarId === pillar.id).length;
    const target = Math.round((pillar.targetMixPct / 100) * assigned.length);
    pillarDistribution[pillar.slug] = { target, actual };
  }

  // Step 4: Validate mix
  const warnings: string[] = [];
  for (const pillar of PILLARS) {
    const dist = pillarDistribution[pillar.slug];
    if (dist.actual < (WEEKLY_MINIMUMS[pillar.slug] ?? 1)) {
      warnings.push(`${pillar.emoji} ${pillar.name}: below minimum (${dist.actual}/${WEEKLY_MINIMUMS[pillar.slug] ?? 1})`);
    }
  }

  for (const [accId, target] of Object.entries(ACCOUNT_WEEKLY_TARGETS)) {
    const actual = accountCounts[accId] ?? 0;
    if (actual < target) {
      const acc = ACCOUNTS.find((a) => a.id === accId);
      warnings.push(`${acc?.handle ?? accId}: below target (${actual}/${target})`);
    }
  }

  for (const [day, count] of Object.entries(dayCounts)) {
    if (count > 3) {
      warnings.push(`${getDayName(day)}: ${count} posts (max recommended: 3)`);
    }
  }

  // Presence mode check
  const presenceCounts: Record<string, number> = {};
  for (const item of assigned) {
    presenceCounts[item.idea.presenceMode] = (presenceCounts[item.idea.presenceMode] ?? 0) + 1;
  }
  for (const [mode, count] of Object.entries(presenceCounts)) {
    if (count / assigned.length > 0.7) {
      warnings.push(`>70% of content is ${mode} — consider more variety`);
    }
  }

  // Sort by date then time
  assigned.sort((a, b) => {
    const dateCompare = a.plannedDate.localeCompare(b.plannedDate);
    return dateCompare !== 0 ? dateCompare : a.plannedTime.localeCompare(b.plannedTime);
  });

  return {
    id: randomId(),
    weekStart,
    goal: `Generate ${assigned.length} pieces of trade content across ${Object.keys(accountCounts).length} market accounts`,
    notes: `Batch film day: ${getDayName(batchFilmDay)} (${batchFilmDay}). ${warnings.length} mix warnings.`,
    pillarDistribution,
    batchFilmDay,
    items: assigned,
    warnings,
    status: "draft",
  };
}

// ─── Markdown Export ───────────────────────────────────────────────────────

export function exportCalendarMarkdown(cal: WeeklyCalendar): string {
  const lines: string[] = [];
  lines.push(`# Content Calendar — Week of ${cal.weekStart}`);
  lines.push("");
  lines.push(`**Goal:** ${cal.goal}`);
  lines.push(`**Batch Film Day:** ${cal.batchFilmDay}`);
  lines.push(`**Total Posts:** ${cal.items.length}`);
  lines.push("");

  // Pillar distribution table
  lines.push("## Pillar Distribution");
  lines.push("| Pillar | Target | Actual | Status |");
  lines.push("|--------|--------|--------|--------|");
  for (const pillar of PILLARS) {
    const dist = cal.pillarDistribution[pillar.slug];
    if (!dist) continue;
    const status = dist.actual >= dist.target ? "OK" : "Adjust";
    lines.push(`| ${pillar.emoji} ${pillar.name} | ${dist.target} | ${dist.actual} | ${status} |`);
  }
  lines.push("");

  // Day-by-day schedule
  const byDate = new Map<string, CalendarItem[]>();
  for (const item of cal.items) {
    if (!byDate.has(item.plannedDate)) byDate.set(item.plannedDate, []);
    byDate.get(item.plannedDate)!.push(item);
  }

  lines.push("## Daily Schedule");
  for (const [date, items] of byDate) {
    const isBatch = date === cal.batchFilmDay;
    lines.push(`\n### ${getDayName(date)} ${date}${isBatch ? " (BATCH FILM DAY)" : ""}`);
    for (const item of items) {
      const acc = ACCOUNTS.find((a) => a.id === item.accountId);
      lines.push(`- **${item.plannedTime}** | ${acc?.handle ?? "?"} | ${item.idea.hook}`);
      lines.push(`  Format: ${item.format} | Presence: ${item.idea.presenceMode}`);
    }
  }

  if (cal.warnings.length > 0) {
    lines.push("\n## Warnings");
    for (const w of cal.warnings) lines.push(`- ${w}`);
  }

  return lines.join("\n");
}
