/**
 * IT, walked as a IT contractor. One country per file — see euWalk.tsx for why.
 */
import { walkCountry, DUTCH_REGISTRY } from '../src/test-utils/euWalk';

describe('IT contractor surface', () => {
  let report: any[] = [];

  it('mounts every core screen', async () => {
    report = await walkCountry('idraulico', 'IT');
    expect(report.filter((r) => !r.mounted).map((f) => `${f.screen}: ${f.error}`)).toEqual([]);
  }, 180_000);

  it('is never shown a Dutch registry', () => {
    const all = report.flatMap((r) => r.texts).join(' | ');
    for (const term of DUTCH_REGISTRY) expect(all).not.toContain(term);
  });

  it('reaches its OWN tax authority on the compliance screen', () => {
    // The positive half: asserting only the ABSENCE of KVK would also pass on
    // a screen that rendered nothing at all.
    const certs = report.find((r) => r.screen === 'certificaten');
    expect(certs?.texts.join(' | ')).toContain('Agenzia delle Entrate');
  });
});
