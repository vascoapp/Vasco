// =============================================================================
// A DATE THE CONTRACTOR TYPES
// =============================================================================
// No date picker ships in the binary (a native module = a rebuild, off the OTA
// channel), so expiry dates are typed. All six markets write the DAY first —
// 31-12-2027 (NL), 31.12.2027 (DE), 31/12/2027 (FR/ES/IT/UK) — so any of those
// separators is accepted, and an ISO 2027-12-31 too. A two-digit year is
// refused rather than guessed: "27" could be read as 1927 or 2027.
// =============================================================================

export interface TypedDay { year: number; month: number; day: number }

export function parseTypedDay(text: string | null | undefined): TypedDay | null {
  const v = (text ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  let year: number, month: number, day: number;
  if (m) {
    [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    m = /^(\d{1,2})[-./ ](\d{1,2})[-./ ](\d{4})$/.exec(v);
    if (!m) return null;
    [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  if (month < 1 || month > 12 || day < 1) return null;
  // 31-02 is not a day: let Date roll it over and see whether it moved.
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;
  return { year, month, day };
}

/** The last moment of that local day — "valid until 31-12" includes the 31st. */
export function endOfLocalDay({ year, month, day }: TypedDay): Date {
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/** Back into the field, day first with dashes (accepted by the parser). */
export function formatTypedDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}-${p(date.getMonth() + 1)}-${date.getFullYear()}`;
}
