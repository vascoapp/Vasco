/**
 * The module-level country/trade/vatScheme ref follows the BUSINESS PROFILE
 * (#218), and an account re-publish cannot undo that.
 *
 * Profile and account shared one slot and `setCurrentUser` replaces every
 * field, so each AuthContext re-run (account country/trade/role arriving, a
 * handover finishing) put the ACCOUNT country back over the profile and wiped
 * the vatScheme — a German profile on an account created as NL tagged its
 * cohort prices NL and formatted argument-less money as nl-NL (sweep D6 🟡).
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../../utils/stripComments';
import {
  setCurrentUser,
  setProfileContext,
  getCurrentCountry,
  getCurrentTrade,
  getCurrentVatScheme,
} from '../currentUser';

afterEach(() => setCurrentUser(null));

describe('the profile outranks the account in the current-user ref', () => {
  it('an account re-publish for the same user keeps the profile values', () => {
    setCurrentUser({ id: 'u1', country: 'NL', trade: 'painting' });
    setProfileContext({ country: 'DE', trade: 'plumbing', vatScheme: 'kleinunternehmer' });
    expect(getCurrentCountry()).toBe('DE');

    // AuthContext's effect re-runs when the account's trade/role arrives.
    setCurrentUser({ id: 'u1', country: 'NL', trade: 'painting' });
    expect(getCurrentCountry()).toBe('DE');
    expect(getCurrentTrade()).toBe('plumbing');
    expect(getCurrentVatScheme()).toBe('kleinunternehmer');
  });

  it('falls back to the account when the profile has no value', () => {
    setCurrentUser({ id: 'u1', country: 'NL' });
    expect(getCurrentCountry()).toBe('NL');
    setProfileContext({ country: 'DE' });
    setProfileContext({ country: null });
    expect(getCurrentCountry()).toBe('NL');
  });

  it('a partial update changes only the fields it names', () => {
    setCurrentUser({ id: 'u1', country: 'NL' });
    setProfileContext({ country: 'FR', vatScheme: 'franchise' });
    setProfileContext({ trade: 'electrical' });
    expect(getCurrentCountry()).toBe('FR');
    expect(getCurrentVatScheme()).toBe('franchise');
    expect(getCurrentTrade()).toBe('electrical');
  });

  it("another user never inherits the previous contractor's profile", () => {
    setCurrentUser({ id: 'u1', country: 'NL' });
    setProfileContext({ country: 'DE', vatScheme: 'kleinunternehmer' });
    setCurrentUser({ id: 'u2', country: 'FR' });
    expect(getCurrentCountry()).toBe('FR');
    expect(getCurrentVatScheme()).toBeUndefined();

    setProfileContext({ country: 'IT' });
    setCurrentUser(null);
    expect(getCurrentCountry()).toBeUndefined();
  });

  it('is ignored while nobody is signed in', () => {
    setProfileContext({ country: 'DE' });
    setCurrentUser({ id: 'u1', country: 'NL' });
    expect(getCurrentCountry()).toBe('NL');
  });

  it('AppState writes the profile layer, never the account slot', () => {
    const src = stripComments(
      fs.readFileSync(path.join(__dirname, '../../state/AppState.tsx'), 'utf8'),
    );
    expect(src).not.toMatch(/\bsetCurrentUser\s*\(/);
    expect((src.match(/\bsetProfileContext\s*\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
