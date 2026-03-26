/**
 * Consistent error logging across the app.
 * Use instead of raw console.log/console.warn/console.error.
 *
 * - logError(context, error) — for catch blocks (accepts unknown)
 * - logWarn(context, message)  — for warnings and non-fatal errors
 * - logInfo(context, message)  — for debug/info messages
 *
 * All output is suppressed in production (__DEV__ guard).
 */
export function logError(context: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  if (__DEV__) {
    console.error(`[${context}] ${msg}`);
  }
}

export function logWarn(context: string, message: string): void {
  if (__DEV__) {
    console.warn(`[${context}] ${message}`);
  }
}

export function logInfo(context: string, message: string): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[${context}] ${message}`);
  }
}
