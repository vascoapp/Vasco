// ═══════════════════════════════════════════════════════════════════════════
// CONTENT MACHINE — BATCH FILMING PLANNER
// Groups ideas by setup type, generates shot-by-shot filming checklists
// ═══════════════════════════════════════════════════════════════════════════

import type { ContentIdea, ContentBatch, BatchItem, ContentFormat, PresenceMode } from "./types";

// ─── Time Estimates ────────────────────────────────────────────────────────

const SETUP_TIME_MINS: Record<PresenceMode, number> = {
  face: 5,
  voiceover: 3,
  hands_only: 2,
  text_only: 1,
};

const FILMING_TIME_PER_FORMAT: Record<string, number> = {
  "tutorial": 20,
  "before-after": 12,
  "timelapse": 10,
  "day-in-life": 25,
  "tip": 8,
  "reveal": 10,
  "tool-review": 15,
  "testimonial": 15,
  "challenge": 10,
  "POV": 12,
  "behind-scenes": 12,
  "comparison": 15,
  "myth-busting": 12,
  "project-showcase": 15,
};

// ─── Setup Notes ───────────────────────────────────────────────────────────

function getSetupNotes(idea: ContentIdea): string {
  const notes: string[] = [];

  switch (idea.presenceMode) {
    case "face":
      notes.push("Camera at eye level, clean background, good lighting on face");
      notes.push("Change shirt if previous take was also face-to-camera");
      break;
    case "voiceover":
      notes.push("Record voiceover separately in quiet space");
      notes.push("Film B-roll of hands/work in progress");
      break;
    case "hands_only":
      notes.push("Top-down or angled camera on work area");
      notes.push("Ensure hands and work are well-lit");
      break;
    case "text_only":
      notes.push("Prepare text overlays in advance");
      notes.push("Film clean background footage or use stock");
      break;
  }

  switch (idea.format as string) {
    case "before-after":
      notes.push("IMPORTANT: Film 'before' shot FIRST, same angle for 'after'");
      break;
    case "timelapse":
      notes.push("Fix camera position — use tripod, don't move during filming");
      break;
    case "tutorial":
      notes.push("Have all materials ready before starting");
      break;
    case "tool-review":
      notes.push("Show tool close-up, price tag, then real use");
      break;
  }

  return notes.join(". ");
}

// ─── Batch Planner ─────────────────────────────────────────────────────────

export interface BatchOptions {
  maxDurationMins?: number;
  batchDate?: string;
}

export function planBatch(ideas: ContentIdea[], opts: BatchOptions = {}): ContentBatch {
  const maxDuration = opts.maxDurationMins ?? 180;
  const batchDate = opts.batchDate ?? new Date().toISOString().split("T")[0];

  // Sort by presence mode to minimize setup changes
  const sorted = [...ideas].sort((a, b) => {
    const order: Record<PresenceMode, number> = { text_only: 0, hands_only: 1, voiceover: 2, face: 3 };
    return (order[a.presenceMode] ?? 0) - (order[b.presenceMode] ?? 0);
  });

  const items: BatchItem[] = [];
  let totalMins = 0;
  let lastPresence: PresenceMode | null = null;

  for (const idea of sorted) {
    // Add setup time if presence mode changed
    const setupTime = idea.presenceMode !== lastPresence ? SETUP_TIME_MINS[idea.presenceMode] : 0;
    const filmTime = FILMING_TIME_PER_FORMAT[idea.format] ?? 12;
    const totalForIdea = setupTime + filmTime;

    if (totalMins + totalForIdea > maxDuration) break;

    items.push({
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ideaId: idea.id,
      shotOrder: items.length + 1,
      setupNotes: getSetupNotes(idea),
      isFilmed: false,
      idea,
    });

    totalMins += totalForIdea;
    lastPresence = idea.presenceMode;
  }

  // Determine dominant setup type
  const presenceCounts: Record<string, number> = {};
  for (const item of items) {
    const mode = item.idea.presenceMode;
    presenceCounts[mode] = (presenceCounts[mode] ?? 0) + 1;
  }
  const setupType = Object.entries(presenceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";

  return {
    id: `batch-${Date.now()}`,
    title: `Batch Film Session — ${batchDate}`,
    batchDate,
    setupType,
    estimatedDurationMins: totalMins,
    items,
    status: "planned",
  };
}

// ─── Pre-session Checklist ─────────────────────────────────────────────────

export const PRE_SESSION_CHECKLIST = [
  "Phone charged to 100% + portable charger",
  "Tripod / phone mount positioned",
  "Ring light or work area lighting set up",
  "3 different shirts for variety between takes",
  "Water bottle + snacks nearby",
  "Props and tools organized by shot order",
  "SD card / phone storage cleared (min 10GB free)",
  "Notifications on Do Not Disturb",
  "Shot list printed or on tablet",
  "Audio check: test voiceover recording quality",
];

export const POST_SESSION_TASKS = [
  "Transfer all footage to editing folder",
  "Label files: [date]_[format]_[trade]_[take#]",
  "Update pipeline status in admin for each filmed idea",
  "Back up footage to cloud",
  "Note which takes were best in filming notes",
];

// ─── Markdown Export ───────────────────────────────────────────────────────

export function exportBatchMarkdown(batch: ContentBatch): string {
  const lines: string[] = [];
  lines.push(`# ${batch.title}`);
  lines.push("");
  lines.push(`**Date:** ${batch.batchDate}`);
  lines.push(`**Videos:** ${batch.items.length}`);
  lines.push(`**Estimated Time:** ${batch.estimatedDurationMins} mins (${Math.round(batch.estimatedDurationMins / 60 * 10) / 10}h)`);
  lines.push(`**Primary Setup:** ${batch.setupType}`);
  lines.push("");

  lines.push("## Pre-Session Checklist");
  for (const item of PRE_SESSION_CHECKLIST) {
    lines.push(`- [ ] ${item}`);
  }
  lines.push("");

  // Group by presence mode
  const byPresence = new Map<string, BatchItem[]>();
  for (const item of batch.items) {
    const mode = item.idea.presenceMode;
    if (!byPresence.has(mode)) byPresence.set(mode, []);
    byPresence.get(mode)!.push(item);
  }

  lines.push("## Shot List");
  for (const [mode, items] of byPresence) {
    lines.push(`\n### ${mode.replace(/_/g, " ").toUpperCase()} (${items.length} videos)`);
    for (const item of items) {
      lines.push(`\n#### ${item.shotOrder}. ${item.idea.title}`);
      lines.push(`Format: ${item.idea.format} | Duration: ${item.idea.estimatedDuration}`);
      lines.push(`Setup: ${item.setupNotes}`);
      lines.push("\nShots:");
      for (const shot of item.idea.shotList) {
        lines.push(`- [ ] ${shot}`);
      }
      if (item.idea.voiceover) {
        lines.push(`\nVoiceover:\n> ${item.idea.voiceover.split("\n")[0]}`);
      }
    }
  }

  lines.push("\n## Post-Session");
  for (const task of POST_SESSION_TASKS) {
    lines.push(`- [ ] ${task}`);
  }

  return lines.join("\n");
}
