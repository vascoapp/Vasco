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
  'contractor/ai-chat': 'Kantoorhulp chat agent — suppressed by the user 2026-09-28 (emulator walk); its chip was already off (office_bot flag, 2026-07-20), this also stops deep links.',
  'contractor/handover': 'HandoverPackBuilder mints invented URLs — needs real pages first.',
  '(modals)/ingestion': 'Only linked from (tabs)/tools.',
  '(modals)/insights': 'Only linked from dormant screens.',
  '(modals)/moneybird-auth': 'Superseded by (modals)/moneybird.',
  '(modals)/xero-auth': 'Only linked from (tabs)/profile.',
  'contractor/calendar-settings': 'Device calendar sync — expo-calendar is not in the native build, so no calendar can ever be found (DORMANT_CONTROLS.deviceCalendar).',
};

/** Is this route (expo-router `segments`) dormant? */
export function isDormantRoute(segments: readonly string[]): boolean {
  const path = segments.join('/');
  return Object.keys(DORMANT_ROUTES).some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Controls that exist in code but have nothing behind them yet — HIDDEN, not
 * deleted (user's decision 2026-09-28, emulator walk: "hide until built").
 * A control shown to a contractor must do what it says; a "Coming soon"
 * alert or a verify button with no API is a dead end. Flip one to `true` in
 * the change that builds what it needs.
 */
export const DORMANT_CONTROLS = {
  /** Add / renew / share certificates, insurance and permits on Certificaten:
   *  no writer exists — every one showed a "Coming soon" alert. */
  complianceItemEditing: false,
  /** KvK "Controleer": no KvK API is connected; the check could only say so. */
  kvkVerification: false,
  /** Profile → Integrations rows with no connect flow (Xero UK/US, QuickBooks
   *  US): a tap only said "Coming soon". Shown again once a flow exists. */
  integrationsWithoutFlow: false,
  /** The "Werfacties" tiles on an aannemer's project (dispatch, daily report,
   *  defects, inspection, incident, safety) push to `sitelead/*`, which is a
   *  DORMANT route: every tap bounced the aannemer back to Vandaag (aannemer
   *  walk, 2026-09-29). Shown again when those screens are un-gated for the
   *  aannemer — a product decision, pending. */
  projectSiteOps: false,
  /** Device calendar sync (Profile → Integrations row, the "Sync to your
   *  calendar?" prompt after scheduling, calendar-settings). `expo-calendar`
   *  was never a dependency, so every `import('expo-calendar')` throws and
   *  the screen could only say "grant calendar rights in Settings" — which
   *  cannot help (emulator walk W15, 2026-10-04). Needs the module in a
   *  NATIVE build; guard deviceCalendarNeedsItsModule ties this flag to it. */
  deviceCalendar: false,
} as const;
