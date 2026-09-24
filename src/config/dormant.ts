/**
 * DORMANT code — kept for a future extension, gated off, ignored by sweeps.
 *
 * User's decision 2026-09-24 (convergence plan P1.2): the ~30% of the code no
 * signed-in contractor can reach is NOT deleted. It is gated here and listed
 * in `dormant.files.json` (generated: `node scripts/reachability.mjs
 * --write-manifest`), which sweeps and guards skip.
 *
 * Two rules keep this honest (guard: src/__tests__/dormantStaysDormant.test.ts):
 *   - dormant code must STAY unreachable — wiring a dormant screen back in
 *     means taking it off this list on purpose, and then it is swept again;
 *   - new unreachable code must be ADDED here on purpose, not left to rot.
 */

/** Route prefixes (expo-router segments joined by '/') a contractor is
 *  redirected away from, even by a deep link. Each with its reason. */
export const DORMANT_ROUTES: Record<string, string> = {
  '(tabs)': 'Enterprise / site-lead tab layout (CFO, COO, director dashboards).',
  worker: 'Worker role — no invite flow yet.',
  sitelead: 'Site-lead role.',
  hub: 'Portfolio hub (materials, suppliers, …) — contractor + aannemer only for now.',
  'contractor/closeout': 'Superseded by the job completion flow.',
  'contractor/ai-assistant': 'Nothing links to it.',
  'contractor/handover': 'HandoverPackBuilder mints invented URLs — needs real pages first.',
  '(modals)/ingestion': 'Only linked from (tabs)/tools.',
  '(modals)/insights': 'Only linked from dormant screens.',
  '(modals)/moneybird-auth': 'Superseded by (modals)/moneybird.',
  '(modals)/xero-auth': 'Only linked from (tabs)/profile.',
};

/** Is this route (expo-router `segments`) dormant? */
export function isDormantRoute(segments: readonly string[]): boolean {
  const path = segments.join('/');
  return Object.keys(DORMANT_ROUTES).some((p) => path === p || path.startsWith(`${p}/`));
}
