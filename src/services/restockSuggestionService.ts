// =============================================================================
// RESTOCK SUGGESTION — consumption vs inventory, produces a PO draft
// =============================================================================
// Looks at the last 30 days of material consumption from completed/in-progress
// jobs, compares to on-hand quantities, and flags items that will run out
// within the configured lead time (default 7 days).
// =============================================================================

import type { Job } from '../types/contractor';

export interface StockItem {
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  preferredSupplier?: string;
}

export interface RestockSuggestion {
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  dailyUsage: number;
  daysUntilEmpty: number;
  suggestedOrderQty: number;
  preferredSupplier?: string;
  reason: string;
}

interface Input {
  jobs: Job[];
  stock: StockItem[];
  windowDays?: number;   // how far back to measure usage (default 30)
  leadTimeDays?: number; // lead time to restock (default 7)
  coverDays?: number;    // how many days of cover to order (default 30)
  now?: Date;
}

const DAY = 24 * 60 * 60 * 1000;

export function suggestRestock(input: Input): RestockSuggestion[] {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? 30;
  const leadDays = input.leadTimeDays ?? 7;
  const coverDays = input.coverDays ?? 30;
  const cutoff = now.getTime() - windowDays * DAY;

  // Sum per-sku consumption from jobs whose materials were used in window
  const usage = new Map<string, number>();
  for (const j of input.jobs) {
    const completed = j.status === 'completed' || j.status === 'in-progress';
    if (!completed) continue;
    const when = new Date((j as any).updatedAt ?? (j as any).completedAt ?? (j as any).createdAt ?? now).getTime();
    if (when < cutoff) continue;
    for (const m of ((j as any).materials ?? []) as Array<{ sku?: string; quantity?: number }>) {
      if (!m.sku) continue;
      usage.set(m.sku, (usage.get(m.sku) ?? 0) + (m.quantity ?? 0));
    }
  }

  const suggestions: RestockSuggestion[] = [];
  for (const s of input.stock) {
    const used = usage.get(s.sku) ?? 0;
    if (used === 0 && s.onHand > 0) continue;
    const dailyUsage = used / windowDays;
    if (dailyUsage <= 0) continue;
    const daysUntilEmpty = dailyUsage > 0 ? s.onHand / dailyUsage : Infinity;
    if (daysUntilEmpty > leadDays + 3) continue; // not urgent yet

    const orderQty = Math.max(1, Math.ceil(dailyUsage * coverDays) - Math.floor(s.onHand));
    suggestions.push({
      sku: s.sku,
      name: s.name,
      unit: s.unit,
      onHand: s.onHand,
      dailyUsage: Math.round(dailyUsage * 100) / 100,
      daysUntilEmpty: Math.round(daysUntilEmpty),
      suggestedOrderQty: orderQty,
      preferredSupplier: s.preferredSupplier,
      reason: `Using ~${dailyUsage.toFixed(1)}${s.unit}/day, on-hand ${s.onHand}${s.unit} → ${Math.round(daysUntilEmpty)} days left (${leadDays}-day lead time)`,
    });
  }

  // Most-urgent first
  suggestions.sort((a, b) => a.daysUntilEmpty - b.daysUntilEmpty);
  return suggestions;
}
