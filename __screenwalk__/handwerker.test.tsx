/**
 * The German contractor surface, signed in as the German demo account.
 *
 * Germany is the beachhead, and until now nothing walked it. `walkScreen` only
 * knew `contractor | aannemer`, both Dutch accounts, so:
 *
 *  - ~53 surfaces read `businessProfile?.country ?? 'NL'` and every walk took
 *    the NL branch;
 *  - the DE-gated surfaces (VAT card, XRechnung/ZUGFeRD export) test
 *    `country === 'DE'` and therefore never rendered in any harness;
 *  - and walking German CHROME over Dutch DATA is what let #155 survive — all
 *    304 generator call sites emitting Dutch, invisible from inside Dutch.
 *
 * Observation pass + the two assertions worth pinning: the German seed is what
 * renders, and Dutch does not leak into a German session.
 */
import fs from 'fs';
import path from 'path';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { findDefectShapes } from '../src/test-utils/defectShapes';

const APP = path.join(__dirname, '..', 'app');

const SCREENS: { id: string; file: string; params?: Record<string, string> }[] = [
  { id: 'vandaag', file: '(contractor)/index.tsx' },
  { id: 'werk', file: '(contractor)/werk.tsx' },
  { id: 'geld', file: '(contractor)/geld.tsx' },
  { id: 'bedrijf', file: '(contractor)/bedrijf.tsx' },
  { id: 'certificaten', file: '(contractor)/certificaten.tsx' },
  { id: 'ai', file: '(contractor)/ai.tsx' },
  { id: 'besparen', file: '(contractor)/besparen.tsx' },
  { id: 'facturen', file: '(contractor)/facturen.tsx' },
];

/**
 * Unambiguously Dutch. Deliberately excludes words German shares or that read
 * plausibly in both ("Werk", "Start", "Team"), so a hit is a real leak rather
 * than a coincidence.
 */
const DUTCH_MARKERS = [
  'factuur', 'facturen', 'offerte', 'offertes', 'klant', 'klanten', 'klus',
  'vandaag', 'betaald', 'bedrijf', 'afgerond', 'verstuurd', 'instellingen',
  'gepland', 'keuzes', 'bespaard', 'aanmaken',
];

/** Job/customer names from the Dutch seed the German account used to inherit. */
const DUTCH_SEED = ['Vloerverwarming', 'Bakkerij Smit', 'Hotel NH', 'de Vries', 'Bouwgroep', 'Van Dijk'];

/**
 * Was a tracked leak: quoteApprovalService's DEMO_APPROVALS were hardcoded
 * Dutch and rendered for the German demo (DE_BUSINESS_PROFILE is
 * teamSize:'small'; the panel gates on `isAannemer || teamSize !== 'solo'`).
 * Now country-keyed, so these names must NOT appear in a German session.
 */
const FIXED_DUTCH_FIXTURES = ['Bakkerij Jansen', 'Hotel Krasnapolsky'];

describe('German contractor surface', () => {
  const report: any[] = [];

  it('walks the core tabs signed in as the German demo contractor', async () => {
    for (const s of SCREENS) {
      const entry: any = { screen: s.id, mounted: false, error: null, texts: [] };
      try {
        const Screen = require(path.join(APP, s.file)).default;
        const r = await walkScreen(Screen, {
          params: s.params ?? {},
          as: 'handwerker',
          settlePasses: 10,
        });
        entry.mounted = !r.error;
        entry.error = r.error ? String(r.error.message) : null;
        entry.texts = r.texts;
        // Unmount as we go. `texts` is a plain string[] already copied above, so
        // the later assertions do not need the tree alive — and keeping 20-odd
        // German screens mounted for the whole file leaks their timers.
        teardown(r);
      } catch (e) {
        entry.error = String((e as Error)?.message ?? e);
      }
      report.push(entry);
    }
    fs.writeFileSync(
      path.join(__dirname, 'handwerker-report.json'),
      JSON.stringify(report, null, 2),
    );
    const failed = report.filter((r) => !r.mounted);
    expect(failed.map((f) => `${f.screen}: ${f.error}`)).toEqual([]);
  }, 180_000);

  it('renders the GERMAN seed, not the Dutch one', () => {
    const all = report.flatMap((r) => r.texts).join(' | ');
    // The German account inherited SEED_JOBS/SEED_CUSTOMERS until DE_SEED_*
    // landed, so a German demo showed "Vloerverwarming check" and
    // "Bakkerij Smit" — unshowable to a Handwerker and unscreenshottable for
    // the AEO pages.
    for (const dutch of DUTCH_SEED) {
      expect(all).not.toContain(dutch);
    }
    for (const dutch of FIXED_DUTCH_FIXTURES) {
      expect(all).not.toContain(dutch);
    }
  });

  it('shows no defect shape in German', () => {
    // Same regexes detectors.test.tsx runs in Dutch. Germany is the beachhead;
    // it should be held to at least the bar the home market is.
    const hits = report.flatMap((r) => findDefectShapes(r.screen, r.texts));
    expect(hits.map((h) => `${h.screen} :: ${h.detector} :: ${h.text.slice(0, 60)}`)).toEqual([]);
  });

  it('does not leak Dutch UI copy into a German session', () => {
    const all = report.flatMap((r) => r.texts).join(' | ').toLowerCase();
    const leaked = DUTCH_MARKERS.filter((w) => all.includes(w));
    // A defaulting bug is invisible in the language it defaults to. This is the
    // detector for it, and the reason the posture defaults to language 'de'.
    expect(leaked).toEqual([]);
  });
});

// NOTE: there is deliberately no afterAll teardown here. There used to be
// `await teardown()` with no argument — `teardown(result)` then dereferenced
// `undefined.tree`, threw, and its own try/catch swallowed it. So the file
// looked cleaned up and unmounted nothing for its entire life. Screens are torn
// down inside the walk loop instead, where the WalkResult actually exists.
