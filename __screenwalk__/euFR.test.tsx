/**
 * FR, walked as a FR contractor. One country per file — see euWalk.tsx for why.
 */
import { walkCountry, DUTCH_REGISTRY, findDefectShapes } from '../src/test-utils/euWalk';

describe('FR contractor surface', () => {
  let report: any[] = [];

  it('mounts every core screen', async () => {
    report = await walkCountry('plombier', 'FR');
    expect(report.filter((r) => !r.mounted).map((f) => `${f.screen}: ${f.error}`)).toEqual([]);
  }, 180_000);

  it('is never shown a Dutch registry', () => {
    const all = report.flatMap((r) => r.texts).join(' | ');
    for (const term of DUTCH_REGISTRY) expect(all).not.toContain(term);
  });

  it('shows no defect shape in this language', () => {
    // The same regexes detectors.test.tsx runs — which until now only ever ran
    // against DUTCH renders. A device-locale date or a missed i18n lookup is
    // MORE likely in a language the app was not developed in, so running them
    // only in Dutch ran them where they are least likely to fire.
    const hits = report.flatMap((r) => findDefectShapes(r.screen, r.texts));
    expect(hits.map((h) => `${h.screen} :: ${h.detector} :: ${h.text.slice(0, 60)}`)).toEqual([]);
  });

  it('reaches its OWN tax authority on the compliance screen', () => {
    // The positive half: asserting only the ABSENCE of KVK would also pass on
    // a screen that rendered nothing at all.
    const certs = report.find((r) => r.screen === 'certificaten');
    expect(certs?.texts.join(' | ')).toContain('URSSAF');
  });
});
