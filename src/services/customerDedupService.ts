// =============================================================================
// CUSTOMER DEDUP — detects near-duplicates before a second record is created
// =============================================================================

import type { Customer } from '../types/contractor';

export interface DuplicateCandidate {
  existing: Customer;
  score: number;          // 0-1
  reasons: string[];
}

function normalizePhone(p?: string | null): string {
  return (p ?? '').replace(/[^\d]/g, '');
}

function normalizeName(n?: string | null): string {
  return (n ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) dp[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[n];
}

export function findDuplicates(
  incoming: { name: string; email?: string | null; phone?: string | null },
  existing: Customer[],
): DuplicateCandidate[] {
  const inName = normalizeName(incoming.name);
  const inEmail = (incoming.email ?? '').toLowerCase().trim();
  const inPhone = normalizePhone(incoming.phone);

  return existing
    .map((c) => {
      const reasons: string[] = [];
      let score = 0;

      if (inEmail && c.email && c.email.toLowerCase().trim() === inEmail) {
        score += 0.8;
        reasons.push('Same email');
      }
      if (inPhone && normalizePhone(c.phone) === inPhone) {
        score += 0.7;
        reasons.push('Same phone number');
      }
      const otherName = normalizeName(c.name);
      if (otherName && inName) {
        if (otherName === inName) {
          score += 0.5;
          reasons.push('Identical name');
        } else {
          const dist = levenshtein(otherName, inName);
          const maxLen = Math.max(otherName.length, inName.length);
          const similarity = 1 - dist / Math.max(1, maxLen);
          if (similarity > 0.85) {
            score += similarity * 0.4;
            reasons.push(`Similar name (${Math.round(similarity * 100)}%)`);
          }
        }
      }

      return { existing: c, score: Math.min(1, score), reasons };
    })
    .filter((c) => c.score >= 0.5)
    .sort((a, b) => b.score - a.score);
}
