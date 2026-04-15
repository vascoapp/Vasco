// =============================================================================
// withTimeout — wrap any Promise with a hard timeout so hung UI actions bail
// =============================================================================
// Contractors frequently work on flaky signal. If `addJob()` is stalled on a
// failing Supabase insert, the UI button stays clickable but nothing happens.
// `withTimeout` gives any caller a guaranteed deadline.
//
// Example:
//   try {
//     const id = await withTimeout(addJob(...), 3000, 'addJob');
//   } catch (err) {
//     Alert.alert('Slow network', 'Check your connection and try again.');
//   }
// =============================================================================

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (value) => { clearTimeout(t); resolve(value); },
      (err) => { clearTimeout(t); reject(err); },
    );
  });
}
