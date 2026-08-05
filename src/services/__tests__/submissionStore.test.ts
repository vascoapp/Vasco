// =============================================================================
// SUBMISSION STORE
// =============================================================================
// The properties worth pinning are the ones where being wrong has legal weight:
// a filing must never read as accepted on our say-so, the same payload must
// never become two filings, and a rejection must survive as a rejection.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  recordHandover,
  recordAuthorityOutcome,
  recordCorrection,
  submissionsFor,
  loadSubmissions,
  channelForCountry,
} from '../submissionStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

const XML = '<Invoice><Total>350.00</Total></Invoice>';

describe('channel routing', () => {
  it('routes each mandate country to its own authority', () => {
    expect(channelForCountry('IT')).toBe('sdi');
    expect(channelForCountry('ES')).toBe('face');
    expect(channelForCountry('FR')).toBe('pdp');
  });

  it('falls back to Peppol for the rest of the EU', () => {
    // Germany's 2027/28 B2B mandate does not require Peppol specifically, but
    // the filing object is the same either way.
    expect(channelForCountry('DE')).toBe('peppol');
    expect(channelForCountry('NL')).toBe('peppol');
  });
});

describe('handover', () => {
  it('records a filing as submitted, never as accepted', () => {
    // The whole point of the state machine. There is no transport, so nothing
    // here can know the authority took it. Claiming otherwise would tell a
    // contractor they filed when they may not have.
    return recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML }).then((s) => {
      expect(s.state).toBe('submitted');
      expect(s.state).not.toBe('accepted');
    });
  });

  it('keeps the full trail of how it got there', async () => {
    const s = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    expect(s.attempts.map((a) => a.state)).toEqual(['draft', 'queued', 'submitting', 'submitted']);
  });

  it('treats the same payload as the same filing', async () => {
    const a = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    const b = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    // Duplicate submission means two invoices carrying one number — a
    // compliance problem, not noise. Re-sharing must not create a second.
    expect(b.id).toBe(a.id);
    expect(await loadSubmissions()).toHaveLength(1);
  });

  it('treats a changed payload as a new filing', async () => {
    await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    const b = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML.replace('350', '400') });
    expect(await loadSubmissions()).toHaveLength(2);
    expect(b.state).toBe('submitted');
  });
});

describe('what the authority said', () => {
  it('accepts an acceptance', async () => {
    const s = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    expect((await recordAuthorityOutcome(s.id, 'accepted')).ok).toBe(true);
    expect((await submissionsFor('inv-1'))[0].state).toBe('accepted');
  });

  it('keeps the authority code verbatim on a rejection', async () => {
    const s = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    await recordAuthorityOutcome(s.id, 'rejected', { authorityCode: '00400', detail: 'Codice non valido' });
    const [stored] = await submissionsFor('inv-1');
    expect(stored.state).toBe('rejected');
    // Support tickets and corrections both depend on the exact scarto code.
    expect(stored.attempts.at(-1)?.authorityCode).toBe('00400');
  });

  it('refuses to move a filing on from a terminal state', async () => {
    const s = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    await recordAuthorityOutcome(s.id, 'accepted');
    const second = await recordAuthorityOutcome(s.id, 'rejected');
    expect(second.ok).toBe(false);
    // An accepted filing that later reads as rejected would be a fabricated
    // audit trail.
    expect((await submissionsFor('inv-1'))[0].state).toBe('accepted');
  });
});

describe('corrections', () => {
  it('creates a new filing that points back at the rejection', async () => {
    const first = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    await recordAuthorityOutcome(first.id, 'rejected', { authorityCode: '00400' });

    const fixed = await recordCorrection(first.id, XML.replace('350', '351'));
    expect(fixed.ok).toBe(true);
    expect(fixed.submission?.supersedes).toBe(first.id);

    // The rejection stays a rejection — that is the audit trail, and the link
    // is what answers "was that refusal ever resolved?".
    const all = await submissionsFor('inv-1');
    expect(all.find((s) => s.id === first.id)?.state).toBe('rejected');
  });

  it('refuses to correct a filing that was not rejected', async () => {
    const s = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    const res = await recordCorrection(s.id, XML.replace('350', '360'));
    // Resubmitting over a filing still in flight would duplicate it with the
    // authority.
    expect(res.ok).toBe(false);
  });

  it('refuses an unchanged payload', async () => {
    const first = await recordHandover({ channel: 'sdi', subjectId: 'inv-1', payload: XML });
    await recordAuthorityOutcome(first.id, 'rejected');
    const res = await recordCorrection(first.id, XML);
    // Nothing was actually corrected, so the authority would refuse it again.
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unchanged/i);
  });
});
