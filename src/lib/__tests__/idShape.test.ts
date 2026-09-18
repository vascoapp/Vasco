/**
 * @jest-environment node
 */
import { isTempId, isTempIdFast, isMoatSafeId } from '../idShape';



describe('every temp id the app MINTS is recognised as one', () => {
  // The patterns listed c/j/mat/sup/jm/proj/q/inv while AppState also mints
  // `lead-`, `lead-rej-` (auto-lead on quote rejection) and `worker-`. Nothing
  // recognised those, so `stripTempId` left the temp id in the insert, Postgres
  // rejected it at a uuid column (22P02), and the offline queue dropped the
  // write after five attempts: a lead or a crew member created without signal
  // never reached the backend at all (sweep 2026-09-18).
  //
  // This test reads the PREFIXES OUT OF AppState, so a new `xyz-${Date.now()}`
  // fails here until it is added — the list cannot drift again.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../state/AppState.tsx'), 'utf8');

  const minted = [...src.matchAll(/`([a-z][a-z-]*)-\$\{Date\.now\(\)\}`/g)].map((m) => m[1]);

  it('finds the mutators that mint temp ids', () => {
    expect(minted.length).toBeGreaterThanOrEqual(6);
    expect(minted).toEqual(expect.arrayContaining(['c', 'lead', 'worker']));
  });

  it.each([...new Set(minted)])('`%s-<ts>` is a temp id', (prefix) => {
    // Document numbers and AsyncStorage-only ids are not BE inserts; every
    // prefix here comes from a mutator that queues `id: tempId`.
    const id = `${prefix}-1789738437000`;
    expect({ id, temp: isTempId(id) }).toEqual({ id, temp: true });
    expect({ id, fast: isTempIdFast(id) }).toEqual({ id, fast: true });
  });

  it('a temp id is never moat-safe', () => {
    for (const prefix of new Set(minted)) {
      expect(isMoatSafeId(`${prefix}-1789738437000`)).toBe(false);
    }
  });

  it('still refuses to call a real id temporary', () => {
    expect(isTempId('4c18d977-df9b-43e6-a497-0b59db02cd77')).toBe(false);
    expect(isTempId('Q-260001')).toBe(false);
    expect(isMoatSafeId('4c18d977-df9b-43e6-a497-0b59db02cd77')).toBe(true);
  });
});

