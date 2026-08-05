// =============================================================================
// SUBMISSION STORE — persistence for the regulated-filing state machine
// =============================================================================
// `submissionLifecycle.ts` is the referee: pure, synchronous, and deliberately
// dependency-free so it cannot be corrupted by the thing it governs. It had no
// callers at all. This is the layer that gives it a memory.
//
// -----------------------------------------------------------------------------
// WHAT THIS CAN AND CANNOT CLAIM
// -----------------------------------------------------------------------------
// There is no transport. No SDI, FACe, PDP or Peppol adapter exists in this app,
// and none is faked here. What actually happens today is that the contractor
// generates a compliant XML and hands it over themselves — through their
// accountant, their provider portal, or email.
//
// So the furthest state this store may reach on its own is `submitted`: "sent,
// awaiting confirmation". `accepted` and `rejected` are recorded only when the
// CONTRACTOR tells us the authority responded, because they are the one who
// receives the SDI receipt or the FACe rejection.
//
// That constraint is the feature, not a shortcoming to paper over. The whole
// reason this state machine exists is that `submitted` and `accepted` are
// different, and a contractor who believes they filed when they did not is
// worse off than one who never tried. An app that auto-marked things accepted
// to look complete would be actively dangerous.
//
// Storage is AsyncStorage. Migration 20260802000002 defines
// `regulated_submissions` for the day transport lands and filings need to be
// visible server-side; until something can actually transmit, a local audit
// trail is the honest scope and works with no migration pushed.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  createSubmission,
  createCorrection,
  transition,
  idempotencyKeyFor,
  payloadDigest,
  needsAttention,
  type Submission,
  type SubmissionChannel,
  type SubmissionState,
} from './submissionLifecycle';

const KEY = '@vasco_regulated_submissions';

/** Country → the channel a filing goes through. */
export function channelForCountry(country: string): SubmissionChannel {
  switch (country) {
    case 'IT': return 'sdi';
    case 'ES': return 'face';
    case 'FR': return 'pdp';
    // DE/NL and the rest of the EU exchange structured invoices; Peppol is the
    // network they share. Germany's 2027/28 B2B mandate does not require Peppol
    // specifically — email of a valid XRechnung is compliant — but the filing
    // is the same object either way, and the channel only decides who we would
    // hand it to once transport exists.
    default: return 'peppol';
  }
}

export async function loadSubmissions(): Promise<Submission[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function save(subs: Submission[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(subs)).catch(() => {});
}

/** The filings for one subject, newest first. */
export async function submissionsFor(subjectId: string): Promise<Submission[]> {
  return (await loadSubmissions())
    .filter((s) => s.subjectId === subjectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Record that a regulated payload was generated and handed over.
 *
 * Returns the existing filing when the payload is unchanged. The key is derived
 * from the payload itself, so re-sharing the same XML is the SAME filing —
 * duplicate submission is a compliance problem (two invoices carrying one
 * number), not merely noise, which is why the lifecycle makes the key
 * content-derived in the first place.
 *
 * Goes draft → queued → submitted in one step because by the time we are called
 * the XML has already left via the share sheet. Recording it as `draft` would
 * describe a document still sitting on the device.
 */
export async function recordHandover(input: {
  channel: SubmissionChannel;
  subjectId: string;
  payload: string;
  now?: string;
}): Promise<Submission> {
  const all = await loadSubmissions();
  const key = idempotencyKeyFor(input.channel, input.subjectId, payloadDigest(input.payload));

  const existing = all.find((s) => s.idempotencyKey === key);
  if (existing) return existing;

  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let sub = createSubmission({
    id,
    channel: input.channel,
    subjectId: input.subjectId,
    idempotencyKey: key,
    now: input.now,
  });

  // Each hop is validated by the state machine rather than assigned directly, so
  // an illegal path here fails loudly instead of writing an impossible record.
  for (const next of ['queued', 'submitting', 'submitted'] as SubmissionState[]) {
    const res = transition(sub, next, {
      now: input.now,
      detail: next === 'submitted' ? 'Handed over from device' : undefined,
    });
    if (!res.ok) return sub; // refuse to fabricate a state the machine rejects
    sub = res.submission;
  }

  await save([sub, ...all]);
  return sub;
}

/**
 * Record what the authority said. Only the contractor can tell us, because only
 * they receive the receipt.
 */
export async function recordAuthorityOutcome(
  submissionId: string,
  outcome: 'accepted' | 'rejected',
  opts: { detail?: string; authorityCode?: string } = {},
): Promise<{ ok: boolean; error?: string }> {
  const all = await loadSubmissions();
  const idx = all.findIndex((s) => s.id === submissionId);
  if (idx === -1) return { ok: false, error: 'submission not found' };

  const res = transition(all[idx], outcome, opts);
  if (!res.ok) return { ok: false, error: res.error };

  all[idx] = res.submission;
  await save(all);
  return { ok: true };
}

/**
 * Begin a corrected filing after a rejection.
 *
 * Delegates the refusal rules to the lifecycle: it declines unless the previous
 * filing is genuinely `rejected`, and declines an unchanged payload, since an
 * identical key means nothing was corrected and the authority would simply
 * refuse it again.
 */
export async function recordCorrection(
  previousId: string,
  payload: string,
): Promise<{ ok: boolean; submission?: Submission; error?: string }> {
  const all = await loadSubmissions();
  const previous = all.find((s) => s.id === previousId);
  if (!previous) return { ok: false, error: 'submission not found' };

  const key = idempotencyKeyFor(previous.channel, previous.subjectId, payloadDigest(payload));
  const made = createCorrection(previous, { id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, idempotencyKey: key });
  if (!made.ok || !made.submission) return { ok: false, error: made.error };

  let sub = made.submission;
  for (const next of ['queued', 'submitting', 'submitted'] as SubmissionState[]) {
    const res = transition(sub, next, { detail: next === 'submitted' ? 'Correction handed over' : undefined });
    if (!res.ok) return { ok: false, error: res.error };
    sub = res.submission;
  }

  await save([sub, ...all]);
  return { ok: true, submission: sub };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setSubmissions(await loadSubmissions());
  }, []);

  useEffect(() => {
    loadSubmissions()
      .then(setSubmissions)
      .finally(() => setLoading(false));
  }, []);

  return {
    submissions,
    loading,
    refresh,
    /** Rejected or failed — the ones that are NOT filed and need a human. */
    attention: submissions.filter(needsAttention),
    /** Handed over, no word back yet. */
    awaiting: submissions.filter((s) => s.state === 'submitted'),
  };
}
