/**
 * Retry a fetch call with exponential backoff.
 * Retries on network errors and 5xx responses. Does NOT retry 4xx (client errors).
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Don't retry client errors (4xx) — they won't fix themselves
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      // Server error (5xx) — retry
      if (attempt < maxRetries) {
        await delay(baseDelay * Math.pow(2, attempt));
        continue;
      }
      return res; // Return the 5xx response after all retries
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await delay(baseDelay * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastError ?? new Error('fetchWithRetry: all retries failed');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
