// =============================================================================
// CREW ASSIGNMENT — is this the right person for this job?
// =============================================================================
// `Worker.trade` and `Job.trade` have both existed since crew dispatch shipped
// and were never compared, so nothing stopped putting a schilder on a gas job.
// In DE that is Meisterpflicht territory and in NL gas work needs certification,
// so the wrong name on a job is not only a scheduling mistake.
//
// A WARNING, never a block. The contractor knows their crew better than this
// does — an apprentice shadowing a lead, a painter who also tiles. Blocking
// would be wrong and would teach people to route around the app.
//
// Pure and injectable: the caller passes the label resolver, because trade is
// stored INCONSISTENTLY in this codebase — some rows carry the slug
// ('plumbing'), some the display name ('Loodgieterij'). Comparing raw strings
// would fire a false warning on every job whose trade happens to be spelled the
// other way.
// =============================================================================

export interface AssignmentCandidate {
  id: string;
  name: string;
  trade?: string;
}

export interface AssignmentJob {
  title?: string;
  trade?: string;
}

export interface TradeMismatch {
  workerName: string;
  /** Display label for what this person does. */
  workerTrade: string;
  /** Display label for what the job needs. */
  jobTrade: string;
}

/**
 * A mismatch worth mentioning, or null.
 *
 * Deliberately silent when:
 *  - the job names no trade — nothing to check against
 *  - the worker has no trade recorded — a blank field is not evidence that
 *    somebody cannot do the work, and warning on it would punish contractors
 *    who simply have not filled the field in. Same rule as the week-view
 *    staffing gaps, so the two features cannot disagree about the same crew.
 */
export function tradeMismatch(
  worker: AssignmentCandidate | undefined | null,
  job: AssignmentJob | undefined | null,
  tradeLabel: (raw: string) => string,
): TradeMismatch | null {
  const workerTrade = worker?.trade?.trim();
  const jobTrade = job?.trade?.trim();
  if (!worker || !workerTrade || !jobTrade) return null;

  // Normalise through the label map so a slug and its display name compare
  // equal: tradeLabel('plumbing') -> 'Loodgieterij', and an already-display
  // value has no key so it falls through unchanged.
  //
  // Lower-case BEFORE the lookup: slugs are lower-case by convention, so a
  // stray 'Plumbing' would miss the key, fall through as itself, and compare
  // unequal to 'Loodgieterij' — a false warning on a correct assignment.
  const norm = (raw: string) => tradeLabel(raw.toLowerCase()).toLowerCase();
  if (norm(workerTrade) === norm(jobTrade)) return null;

  return {
    workerName: worker.name,
    workerTrade: tradeLabel(workerTrade),
    jobTrade: tradeLabel(jobTrade),
  };
}
