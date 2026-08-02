// =============================================================================
// SUBMISSION LIFECYCLE — one state machine for every regulated async filing
// =============================================================================
// Today the app GENERATES correct regulated payloads and then hands them to the
// OS share sheet. There is no transport and — verified by grep — no status
// tracking of any kind: no `einvoice_status`, no `submission_status`, nothing.
//
// That gap is the same shape in every market Vasco serves:
//
//   IT  FatturaPA -> SDI            mandatory for 100% of invoices, ASYNC, REJECTS
//   ES  Facturae  -> FACe           B2G, async, rejects
//   FR  Factur-X  -> PDP            phased mandate, async
//   UK  CIS monthly return -> HMRC  due the 19th, async, rejects
//   UK  VAT (MTD) -> HMRC           quarterly, async, rejects
//
// Every one is: build a payload, hand it to an authority, get an acknowledgement
// now and an accept/reject LATER. So this is one abstraction, not five — and
// getting the lifecycle right once is worth more than five bespoke integrations.
//
// The part people underestimate is REJECTION. A rejected FatturaPA is a legal
// non-event: the invoice was never issued. A contractor who thinks they filed
// and did not is in a worse position than one who never tried, so "submitted"
// and "accepted" must never be conflated, and a terminal rejection has to be
// loud.
//
// Pure and synchronous. No network, no provider SDK — transport adapters plug
// in above this. Being the referee, it must not depend on the thing it governs.
// =============================================================================

export type SubmissionChannel =
  | 'sdi'        // IT — Sistema di Interscambio
  | 'face'       // ES — FACe (B2G)
  | 'pdp'        // FR — Plateforme de Dématérialisation Partenaire
  | 'peppol'     // NL/UK/EU — Peppol BIS 3.0 via an Access Point
  | 'hmrc_cis'   // UK — CIS monthly return
  | 'hmrc_mtd';  // UK — Making Tax Digital VAT return

export type SubmissionState =
  /** Built but not yet handed over. Nothing has left the device. */
  | 'draft'
  /** Accepted into our own outbox; will be sent when connectivity allows. */
  | 'queued'
  /** In flight to the provider right now. */
  | 'submitting'
  /** Provider acknowledged receipt. NOT the same as accepted by the authority. */
  | 'submitted'
  /** The authority accepted it. This is the only state that means "filed". */
  | 'accepted'
  /** The authority refused it. Terminal until the payload is corrected. */
  | 'rejected'
  /** Transport failed. Retryable — distinct from a refusal. */
  | 'failed'
  /** Deliberately abandoned by the contractor. */
  | 'cancelled';

/** States from which nothing further happens without human action. */
export const TERMINAL_STATES: SubmissionState[] = ['accepted', 'rejected', 'cancelled'];

/**
 * Legal transitions. Anything absent is a bug, and `transition()` refuses it
 * rather than letting a UI or a webhook quietly move a filing backwards.
 *
 * Note `submitted -> submitted`: authorities re-notify, and webhooks are
 * at-least-once. Idempotent re-entry must not be an error.
 */
const ALLOWED: Record<SubmissionState, SubmissionState[]> = {
  draft: ['queued', 'cancelled'],
  queued: ['submitting', 'cancelled', 'failed'],
  submitting: ['submitted', 'failed', 'rejected'],
  submitted: ['submitted', 'accepted', 'rejected', 'failed'],
  // A rejected filing is corrected and resubmitted as a NEW attempt; the old
  // record stays rejected so the audit trail keeps the refusal.
  rejected: [],
  accepted: [],
  cancelled: [],
  failed: ['queued', 'submitting', 'cancelled'],
};

export interface SubmissionAttempt {
  at: string;                 // ISO
  state: SubmissionState;
  detail?: string;
  /** Authority/provider code, e.g. an SDI "scarto" code. Keep verbatim. */
  authorityCode?: string;
}

export interface Submission {
  id: string;
  channel: SubmissionChannel;
  /** Local entity this filing is about — invoice id, CIS period, VAT period. */
  subjectId: string;
  /**
   * Stable key derived from the payload. Resubmitting the SAME payload must not
   * create a second filing with the authority — duplicate submission is a real
   * compliance problem (two invoices with one number), not just noise.
   */
  idempotencyKey: string;
  state: SubmissionState;
  /** Provider-side id once known, for reconciliation and support tickets. */
  providerRef?: string;
  /**
   * When this filing replaces a rejected one, the id of that earlier attempt.
   *
   * `rejected` is terminal with no outgoing edges, so a correction is always a
   * NEW submission — but without this link the two records are strangers and
   * nobody can answer "was that rejection ever resolved?". That question is the
   * whole reason to keep a rejection in the trail rather than mutate it.
   */
  supersedes?: string;
  attempts: SubmissionAttempt[];
  createdAt: string;
  updatedAt: string;
}

export interface TransitionResult {
  ok: boolean;
  submission: Submission;
  error?: string;
}

/** Human-facing meaning. Deliberately blunt about what is and is not filed. */
export function describeState(state: SubmissionState): string {
  switch (state) {
    case 'draft': return 'Not sent';
    case 'queued': return 'Waiting to send';
    case 'submitting': return 'Sending';
    case 'submitted': return 'Sent — awaiting confirmation';
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Rejected — not filed';
    case 'failed': return 'Send failed — will retry';
    case 'cancelled': return 'Cancelled';
  }
}

/** True when the filing has legally landed. Only ever `accepted`. */
export function isFiled(s: Submission): boolean {
  return s.state === 'accepted';
}

/** True when the contractor must do something. Drives the badge/insight. */
export function needsAttention(s: Submission): boolean {
  return s.state === 'rejected' || s.state === 'failed';
}

export function isTerminal(state: SubmissionState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function createSubmission(input: {
  id: string;
  channel: SubmissionChannel;
  subjectId: string;
  idempotencyKey: string;
  supersedes?: string;
  now?: string;
}): Submission {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    channel: input.channel,
    subjectId: input.subjectId,
    idempotencyKey: input.idempotencyKey,
    supersedes: input.supersedes,
    state: 'draft',
    attempts: [{ at: now, state: 'draft' }],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Start a corrected filing to replace a rejected one.
 *
 * Refuses unless the previous attempt is genuinely `rejected` — resubmitting
 * over a filing that is merely in flight, or one already accepted, would create
 * a duplicate with the authority. And it refuses an unchanged payload: the
 * idempotency key is content-derived, so an identical key means nothing was
 * actually corrected and the authority would simply refuse it again.
 */
export function createCorrection(
  previous: Submission,
  input: { id: string; idempotencyKey: string; now?: string },
): { ok: boolean; submission?: Submission; error?: string } {
  if (previous.state !== 'rejected') {
    return { ok: false, error: `can only correct a rejected filing, not one that is ${previous.state}` };
  }
  if (previous.idempotencyKey === input.idempotencyKey) {
    return { ok: false, error: 'payload is unchanged — correct the document before resubmitting' };
  }
  return {
    ok: true,
    submission: createSubmission({
      id: input.id,
      channel: previous.channel,
      subjectId: previous.subjectId,
      idempotencyKey: input.idempotencyKey,
      supersedes: previous.id,
      now: input.now,
    }),
  };
}

/**
 * Move a submission to a new state, refusing illegal moves.
 *
 * Returns the UNCHANGED submission plus an error rather than throwing, because
 * every caller here is a webhook handler or a background flush where throwing
 * would lose the event.
 */
export function transition(
  submission: Submission,
  next: SubmissionState,
  opts: { detail?: string; authorityCode?: string; providerRef?: string; now?: string } = {},
): TransitionResult {
  const now = opts.now ?? new Date().toISOString();
  const allowed = ALLOWED[submission.state] ?? [];

  if (!allowed.includes(next)) {
    return {
      ok: false,
      submission,
      error: `illegal transition ${submission.state} -> ${next}`
        + (isTerminal(submission.state) ? ` (${submission.state} is terminal)` : ''),
    };
  }

  return {
    ok: true,
    submission: {
      ...submission,
      state: next,
      providerRef: opts.providerRef ?? submission.providerRef,
      attempts: [
        ...submission.attempts,
        { at: now, state: next, detail: opts.detail, authorityCode: opts.authorityCode },
      ],
      updatedAt: now,
    },
  };
}

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

/** Attempts that reached the provider but were refused must NOT be retried. */
export const MAX_TRANSPORT_ATTEMPTS = 5;

export function transportAttemptCount(s: Submission): number {
  return s.attempts.filter((a) => a.state === 'submitting').length;
}

/**
 * Whether a failed submission should be retried automatically.
 *
 * A refusal is never retried — resending an identical payload the authority
 * already refused just earns a second refusal. Only transport failures retry,
 * and only up to a bound, so an offline device does not hammer the queue.
 */
export function shouldRetry(s: Submission): boolean {
  if (s.state !== 'failed') return false;
  return transportAttemptCount(s) < MAX_TRANSPORT_ATTEMPTS;
}

/** Exponential backoff in ms, capped. Deterministic — no jitter, so it is testable. */
export function retryDelayMs(s: Submission): number {
  const n = Math.max(transportAttemptCount(s), 1);
  return Math.min(2 ** (n - 1) * 30_000, 30 * 60_000);
}

/**
 * Build an idempotency key.
 *
 * Content-derived on purpose: correcting a rejected invoice changes the payload,
 * which changes the key, which is exactly when a NEW filing is legitimate.
 * Re-sending an unchanged payload keeps the key and is deduplicated.
 */
export function idempotencyKeyFor(channel: SubmissionChannel, subjectId: string, payloadDigest: string): string {
  return `${channel}:${subjectId}:${payloadDigest}`;
}

/**
 * Stable, non-cryptographic digest. Never a security boundary — React Native
 * has no synchronous crypto digest available across all runtimes.
 *
 * 64 BITS, NOT 32. The first version returned a single 32-bit FNV-1a, and under
 * the UNIQUE(user_id, idempotency_key) constraint on `regulated_submissions` a
 * collision does not merely mis-cache — it makes a legitimate second filing look
 * like a duplicate and **silently drop**. For a statutory return that is a
 * missed filing, so the cheap fix is worth taking: two FNV-1a passes with
 * different offset bases, plus the payload length, which no length-preserving
 * collision can match.
 */
export function payloadDigest(payload: string): string {
  let h1 = 0x811c9dc5; // standard FNV-1a offset basis
  let h2 = 0xcbf29ce4; // second, independent basis
  for (let i = 0; i < payload.length; i += 1) {
    const c = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    // Different multiplier and a positional term, so the two passes cannot
    // degenerate into the same function.
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  const len = (payload.length >>> 0).toString(16);
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}-${len}`;
}
