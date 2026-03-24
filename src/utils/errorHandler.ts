/**
 * Consistent error logging across the app.
 * Use instead of raw console.warn/console.error.
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
