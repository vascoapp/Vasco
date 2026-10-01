// =============================================================================
// Fiscal identifiers — the check-digit rules, offline.
// =============================================================================
// SDI (Italy) and FACe (Spain) both reject an invoice whose tax identifiers are
// not well formed. Whether a number EXISTS (Anagrafe Tributaria, AEAT census)
// can only be answered by the authority; whether it is well FORMED is pure
// arithmetic, and a number that fails it can never pass the authority's check:
//
//   · Italy — SDI 00300/00301/00303/00305 (IdCodice) and 00302/00304/00306
//     (CodiceFiscale), "Elenco dei controlli … versione 2.0" (31/01/2025),
//     https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.4/Elenco-Controlli-versione-2.0.pdf
//   · Spain — Orden HAP/1650/2015, Anexo II, regla 5 b): "se validará que el
//     NIF se ajuste a las normas y criterios de formación del mismo",
//     https://www.boe.es/eli/es/o/2015/07/31/hap1650/dof/spa/pdf
//     The formation rules are Orden EHA/451/2008 (entity letters) and
//     Real Decreto 1065/2007 art. 18–20 (NIF of persons, NIE, K/L/M).
// =============================================================================

const clean = (v: string | null | undefined): string =>
  String(v ?? '').trim().toUpperCase().replace(/[\s.\-/]/g, '');

// ---------------------------------------------------------------------------
// Italy
// ---------------------------------------------------------------------------

/**
 * Partita IVA: 11 digits, the last a Luhn-style check digit over the first 10
 * (odd positions as-is, even positions doubled with digit-sum). All zeros is
 * structurally valid and never assigned — refused.
 */
export function isValidPartitaIva(value: string | null | undefined): boolean {
  const v = clean(value);
  if (!/^\d{11}$/.test(v) || /^0{11}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = v.charCodeAt(i) - 48;
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === v.charCodeAt(10) - 48;
}

// Codice fiscale of a person: the check character is the sum of per-position
// values (one table for odd positions, one for even), mod 26, as a letter.
// DM 23 dicembre 1976, allegato; omocodia letters may replace digits.
const CF_ODD: Record<string, number> = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const cfEven = (c: string): number => (/\d/.test(c) ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 65);

/**
 * Codice fiscale: 16 characters for a person (with check character), or 11
 * digits for an entity — the latter follows the partita IVA rule.
 */
export function isValidCodiceFiscale(value: string | null | undefined): boolean {
  const v = clean(value);
  if (/^\d{11}$/.test(v)) return isValidPartitaIva(v);
  // Surname(3) name(3) year(2) month(1) day(2) comune(4) check(1); digit
  // positions may carry omocodia letters L M N P Q R S T U V.
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) sum += i % 2 === 0 ? CF_ODD[v[i]] : cfEven(v[i]);
  return String.fromCharCode(65 + (sum % 26)) === v[15];
}

// ---------------------------------------------------------------------------
// Spain
// ---------------------------------------------------------------------------

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export type SpanishTaxIdKind =
  | 'DNI' // Spanish national, 8 digits + letter — a natural person
  | 'NIE' // foreign resident, X/Y/Z + 7 digits + letter — a natural person
  | 'KLM' // K/L/M + 7 digits + letter — a natural person without DNI/NIE
  | 'ENTITY'; // A–W letter + 7 digits + control — a legal person / entity

export interface SpanishTaxIdCheck {
  valid: boolean;
  kind?: SpanishTaxIdKind;
  /** The NIF without a leading "ES" (Facturae: no country prefix on a domestic operation). */
  bare: string;
}

/**
 * Spanish NIF / NIE / CIF with its control character. A leading "ES" is read
 * as the country (HAP/1650/2015 Anexo II regla 5 b: "Si los dos primeros
 * caracteres del NIF son letras, se asumirá que equivalen al país").
 */
export function checkSpanishTaxId(value: string | null | undefined): SpanishTaxIdCheck {
  let v = clean(value);
  if (/^ES[A-Z0-9]{9}$/.test(v)) v = v.slice(2);
  // A DNI typed without its leading zero ("1234567L" is 01234567L) is still
  // that DNI — refusing it blocked a valid invoice (review 2026-10-01).
  if (/^\d{7}[A-Z]$/.test(v)) v = `0${v}`;
  const bare = v;
  if (/^\d{8}[A-Z]$/.test(v)) {
    return { valid: DNI_LETTERS[Number(v.slice(0, 8)) % 23] === v[8], kind: 'DNI', bare };
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const n = Number(String('XYZ'.indexOf(v[0])) + v.slice(1, 8));
    return { valid: DNI_LETTERS[n % 23] === v[8], kind: 'NIE', bare };
  }
  if (/^[KLM]\d{7}[A-Z]$/.test(v)) {
    return { valid: DNI_LETTERS[Number(v.slice(1, 8)) % 23] === v[8], kind: 'KLM', bare };
  }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const digits = v.slice(1, 8);
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      let d = digits.charCodeAt(i) - 48;
      if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    const c = (10 - (sum % 10)) % 10;
    const asLetter = 'JABCDEFGHI'[c];
    const ctrl = v[8];
    // Established: P, Q, S carry a letter; A, B, E, H a digit. For R, N, W
    // the letter-only rule is not firmly documented (python-stdnum accepts
    // either), and a false refusal blocks a valid invoice — so either is
    // accepted for the rest (review 2026-10-01).
    const letterOnly = 'PQS'.includes(v[0]);
    const digitOnly = 'ABEH'.includes(v[0]);
    const valid = letterOnly ? ctrl === asLetter : digitOnly ? ctrl === String(c) : ctrl === String(c) || ctrl === asLetter;
    return { valid, kind: 'ENTITY', bare };
  }
  return { valid: false, bare };
}

/** F (física) for DNI/NIE/K-L-M, J (jurídica) for an entity; undefined when not a well-formed Spanish id. */
export function spanishPersonType(value: string | null | undefined): 'F' | 'J' | undefined {
  const c = checkSpanishTaxId(value);
  if (!c.kind) return undefined;
  return c.kind === 'ENTITY' ? 'J' : 'F';
}

/**
 * The NIF of a Spanish PUBLIC body begins with P (local corporations), Q
 * (public-law bodies) or S (organs of the State administration) — Orden
 * EHA/451/2008, art. 3. Invoices to them go through FACe (Ley 25/2013).
 */
export function isSpanishPublicBodyNif(value: string | null | undefined): boolean {
  const c = checkSpanishTaxId(value);
  return c.kind === 'ENTITY' && 'PQS'.includes(c.bare[0]);
}
