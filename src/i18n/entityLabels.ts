// =============================================================================
// ENTITY LABELS — localise domain enums/slugs for display
// =============================================================================
//
// "Internal keys reaching the UI" is the single most repeated bug class in this
// codebase (learnings #66/#75/#79/#81 and the R322 walk). The fix is always the
// same shape: map the domain value onto a locale key, humanise anything that
// misses. That shape had been copy-pasted into `werk.tsx` and
// `customer/[id].tsx` with subtly different tables — the exact drift that
// caused the lifecycle bugs `toScheduledJob()` was extracted to stop. One
// implementation, used everywhere.
//
// GOTCHA the remap table exists for: the JobStatus DOMAIN enum uses
// `in-progress` (hyphen) and `quoted`, but the locale keys are `inProgress`
// and `quote`. Some rows also persist snake_case (`in_progress`).

/**
 * Minimal shape of i18next's `t` — keeps this file free of react-i18next.
 * `defaultValue` is REQUIRED: i18next's own overload set only admits the
 * positional-default form, and every label below passes one anyway (a missing
 * key must render a humanised fallback, never the raw enum).
 */
export type TFunc = (key: string, defaultValue: string) => string;

/** `in-progress` → `In Progress`. Never leaks a raw underscore/hyphen key. */
export function humanizeEnum(raw: string): string {
  return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const JOB_STATUS_KEY: Record<string, string> = {
  'in-progress': 'inProgress',
  in_progress: 'inProgress',
  quoted: 'quote',
};

export function makeEntityLabels(t: TFunc) {
  return {
    /** JobStatus → localised label (`jobs.status.*`). */
    jobStatusLabel: (raw: string): string =>
      t(`jobs.status.${JOB_STATUS_KEY[raw] ?? raw}`, humanizeEnum(raw)),
    /** QuoteStatus → localised label (`quotes.status.*`). */
    quoteStatusLabel: (raw: string): string => t(`quotes.status.${raw}`, humanizeEnum(raw)),
    /** InvoiceStatus → localised label (`invoices.status.*`). */
    invoiceStatusLabel: (raw: string): string => t(`invoices.status.${raw}`, humanizeEnum(raw)),
    /**
     * Trade slug → localised name (`onboarding.trades.*`). Some rows store a
     * display name already ("Loodgieterij") rather than a slug; those miss the
     * key and fall through unchanged, which is the desired behaviour.
     */
    tradeLabel: (raw: string): string => t(`onboarding.trades.${raw}`, raw),
  };
}

export type EntityLabels = ReturnType<typeof makeEntityLabels>;
