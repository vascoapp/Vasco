/**
 * Did a send-push call reach a phone?
 *
 * send-push answers `{ ok: true, sent: 0 }` when the contractor has no
 * registered device (or every device rejected the message): the REQUEST was
 * fine, nothing was DELIVERED. Callers read `ok` alone, so the push log said
 * `success: true` and the digests counted a send that never happened (sweep
 * 2026-09-23, B4). This is the one reading of that response.
 */
export interface PushOutcome {
  delivered: boolean;
  error: string | null;
}

export function pushOutcome(json: unknown): PushOutcome {
  const j = (json ?? {}) as { ok?: unknown; sent?: unknown; failed?: unknown; error?: unknown };
  if (j.ok !== true) return { delivered: false, error: typeof j.error === 'string' ? j.error : 'send-push failed' };
  if (!(Number(j.sent) > 0)) {
    return { delivered: false, error: Number(j.failed) > 0 ? 'every device rejected the push' : 'no registered device' };
  }
  return { delivered: true, error: null };
}
