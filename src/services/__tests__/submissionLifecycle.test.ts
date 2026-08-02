// =============================================================================
// SUBMISSION LIFECYCLE — the state machine every regulated filing shares
// =============================================================================
// The property that matters most: "submitted" and "accepted" must never be
// conflated. A rejected FatturaPA is a legal non-event — the invoice was never
// issued — so a contractor who believes they filed and did not is worse off
// than one who never tried.
// =============================================================================

import {
  createSubmission,
  createCorrection,
  transition,
  isFiled,
  needsAttention,
  isTerminal,
  shouldRetry,
  retryDelayMs,
  transportAttemptCount,
  describeState,
  idempotencyKeyFor,
  payloadDigest,
  MAX_TRANSPORT_ATTEMPTS,
  TERMINAL_STATES,
  type Submission,
  type SubmissionState,
} from '../submissionLifecycle';

const make = (): Submission =>
  createSubmission({
    id: 'sub-1',
    channel: 'sdi',
    subjectId: 'inv-42',
    idempotencyKey: 'sdi:inv-42:abcd1234',
    now: '2026-08-02T10:00:00.000Z',
  });

/** Drive a submission through a list of states, asserting each is legal. */
const drive = (s: Submission, states: SubmissionState[]): Submission =>
  states.reduce((acc, next) => {
    const r = transition(acc, next);
    expect(r.ok).toBe(true);
    return r.submission;
  }, s);

describe('the happy path', () => {
  it('walks draft -> queued -> submitting -> submitted -> accepted', () => {
    const s = drive(make(), ['queued', 'submitting', 'submitted', 'accepted']);
    expect(s.state).toBe('accepted');
    expect(isFiled(s)).toBe(true);
    expect(needsAttention(s)).toBe(false);
    expect(s.attempts).toHaveLength(5); // draft + 4
  });

  it('records provider ref and authority codes on the trail', () => {
    let s = drive(make(), ['queued', 'submitting']);
    s = transition(s, 'submitted', { providerRef: 'SDI-99', detail: 'ack' }).submission;
    expect(s.providerRef).toBe('SDI-99');
    s = transition(s, 'rejected', { authorityCode: '00404', detail: 'duplicate invoice' }).submission;
    expect(s.attempts.at(-1)?.authorityCode).toBe('00404');
  });
});

describe('submitted is NOT filed', () => {
  it('does not report a submitted filing as filed', () => {
    const s = drive(make(), ['queued', 'submitting', 'submitted']);
    expect(s.state).toBe('submitted');
    expect(isFiled(s)).toBe(false); // the whole point
    expect(describeState('submitted')).toMatch(/awaiting/i);
  });

  it('says plainly that a rejected filing is not filed', () => {
    expect(describeState('rejected')).toMatch(/not filed/i);
  });
});

describe('illegal transitions are refused, not thrown', () => {
  it('refuses to skip straight from draft to accepted', () => {
    const r = transition(make(), 'accepted');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/illegal transition draft -> accepted/);
    expect(r.submission.state).toBe('draft'); // unchanged
  });

  it('refuses to move out of a terminal state', () => {
    const s = drive(make(), ['queued', 'submitting', 'submitted', 'accepted']);
    const r = transition(s, 'queued');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/terminal/);
  });

  it('will not resurrect a rejected filing — correction is a NEW submission', () => {
    const s = drive(make(), ['queued', 'submitting', 'rejected']);
    expect(transition(s, 'queued').ok).toBe(false);
    expect(transition(s, 'submitting').ok).toBe(false);
  });

  it('every terminal state really is terminal', () => {
    for (const t of TERMINAL_STATES) expect(isTerminal(t)).toBe(true);
    expect(isTerminal('submitted')).toBe(false);
  });
});

describe('webhooks are at-least-once', () => {
  it('tolerates a repeated submitted notification', () => {
    const s = drive(make(), ['queued', 'submitting', 'submitted']);
    const again = transition(s, 'submitted', { detail: 're-notify' });
    expect(again.ok).toBe(true);
  });

  it('accepts a late acceptance after a re-notify', () => {
    const s = drive(make(), ['queued', 'submitting', 'submitted', 'submitted', 'accepted']);
    expect(isFiled(s)).toBe(true);
  });
});

describe('retry policy', () => {
  it('retries a transport failure', () => {
    const s = drive(make(), ['queued', 'submitting', 'failed']);
    expect(needsAttention(s)).toBe(true);
    expect(shouldRetry(s)).toBe(true);
  });

  // The important one: a refusal is not a transport problem.
  it('never retries a rejection', () => {
    const s = drive(make(), ['queued', 'submitting', 'rejected']);
    expect(shouldRetry(s)).toBe(false);
  });

  it('stops retrying after the bound', () => {
    let s = make();
    s = transition(s, 'queued').submission;
    for (let i = 0; i < MAX_TRANSPORT_ATTEMPTS; i += 1) {
      s = transition(s, 'submitting').submission;
      s = transition(s, 'failed').submission;
      if (i < MAX_TRANSPORT_ATTEMPTS - 1) s = transition(s, 'queued').submission;
    }
    expect(transportAttemptCount(s)).toBe(MAX_TRANSPORT_ATTEMPTS);
    expect(shouldRetry(s)).toBe(false);
  });

  it('backs off exponentially and caps', () => {
    let s = drive(make(), ['queued', 'submitting', 'failed']);
    const first = retryDelayMs(s);
    s = drive(s, ['queued', 'submitting', 'failed']);
    expect(retryDelayMs(s)).toBeGreaterThan(first);
    expect(retryDelayMs(s)).toBeLessThanOrEqual(30 * 60_000);
  });
});

describe('idempotency', () => {
  it('is stable for identical payloads', () => {
    const a = idempotencyKeyFor('sdi', 'inv-42', payloadDigest('<xml>same</xml>'));
    const b = idempotencyKeyFor('sdi', 'inv-42', payloadDigest('<xml>same</xml>'));
    expect(a).toBe(b);
  });

  // Correcting a rejected invoice SHOULD produce a new filing.
  it('changes when the payload changes', () => {
    const a = idempotencyKeyFor('sdi', 'inv-42', payloadDigest('<xml>v1</xml>'));
    const b = idempotencyKeyFor('sdi', 'inv-42', payloadDigest('<xml>v2</xml>'));
    expect(a).not.toBe(b);
  });

  it('separates channels and subjects', () => {
    const d = payloadDigest('x');
    expect(idempotencyKeyFor('sdi', 'inv-1', d)).not.toBe(idempotencyKeyFor('face', 'inv-1', d));
    expect(idempotencyKeyFor('sdi', 'inv-1', d)).not.toBe(idempotencyKeyFor('sdi', 'inv-2', d));
  });

  it('does not collide on near-identical input', () => {
    expect(payloadDigest('abc')).not.toBe(payloadDigest('abd'));
    expect(payloadDigest('abc')).not.toBe(payloadDigest('acb')); // transposition
  });

  // REGRESSION. The first version was a single 32-bit FNV-1a. Under
  // UNIQUE(user_id, idempotency_key) a collision does not merely mis-cache — it
  // makes a legitimate second filing look like a duplicate and silently drop,
  // i.e. a missed statutory return. 64 bits + the payload length.
  it('carries at least 64 bits plus a length discriminator', () => {
    const d = payloadDigest('anything');
    const [hash, len] = d.split('-');
    expect(hash).toHaveLength(16);      // two 32-bit halves
    expect(len).toBe((8).toString(16)); // 'anything'.length
  });

  it('separates payloads of different length even under hash pressure', () => {
    expect(payloadDigest('a')).not.toBe(payloadDigest('aa'));
    expect(payloadDigest('')).not.toBe(payloadDigest('a'));
  });

  it('stays collision-free across a large batch of realistic payloads', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50_000; i += 1) {
      seen.add(payloadDigest(`<Invoice><Number>INV-${i}</Number><Total>${i}.00</Total></Invoice>`));
    }
    expect(seen.size).toBe(50_000);
  });
});

describe('every channel shares this machine', () => {
  it.each(['sdi', 'face', 'pdp', 'peppol', 'hmrc_cis', 'hmrc_mtd'] as const)(
    'drives %s to accepted',
    (channel) => {
      const s = createSubmission({ id: 'x', channel, subjectId: 's', idempotencyKey: 'k' });
      expect(isFiled(drive(s, ['queued', 'submitting', 'submitted', 'accepted']))).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Corrections — `rejected` is terminal, so a fix is a NEW filing that has to
// stay linked to the one it replaces.
// ---------------------------------------------------------------------------
describe('correcting a rejected filing', () => {
  const rejected = () => drive(make(), ['queued', 'submitting', 'rejected']);

  it('creates a linked successor', () => {
    const prev = rejected();
    const r = createCorrection(prev, { id: 'sub-2', idempotencyKey: 'sdi:inv-42:NEWDIGEST' });
    expect(r.ok).toBe(true);
    expect(r.submission?.supersedes).toBe(prev.id);
    expect(r.submission?.state).toBe('draft');
    expect(r.submission?.channel).toBe(prev.channel);
    expect(r.submission?.subjectId).toBe(prev.subjectId);
  });

  it('refuses to correct a filing that was never rejected', () => {
    const inFlight = drive(make(), ['queued', 'submitting', 'submitted']);
    const r = createCorrection(inFlight, { id: 'sub-2', idempotencyKey: 'other' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not one that is submitted/);
  });

  it('refuses to correct an accepted filing — that would duplicate it', () => {
    const accepted = drive(make(), ['queued', 'submitting', 'submitted', 'accepted']);
    expect(createCorrection(accepted, { id: 'x', idempotencyKey: 'other' }).ok).toBe(false);
  });

  // An unchanged payload keeps its key, so the authority would refuse it again.
  it('refuses an unchanged payload', () => {
    const prev = rejected();
    const r = createCorrection(prev, { id: 'sub-2', idempotencyKey: prev.idempotencyKey });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unchanged/);
  });

  it('lets the correction run its own full lifecycle', () => {
    const prev = rejected();
    const next = createCorrection(prev, { id: 'sub-2', idempotencyKey: 'k2' }).submission!;
    expect(isFiled(drive(next, ['queued', 'submitting', 'submitted', 'accepted']))).toBe(true);
  });
});
