// =============================================================================
// E-INVOICE VALUE RULES — what SDI (Italy) and FACe (Spain) check AFTER the schema
// =============================================================================
// `npm run check:einvoice-schemas` proves our FatturaPA / Facturae files are
// valid against the official XSDs. That is gate one. Both authorities then
// apply VALUE rules — arithmetic, check digits, code combinations — and there
// is no public validator for those. In Italy a file SDI discards ("scarto")
// was NEVER LEGALLY ISSUED; in Spain FACe / the registro contable reject it.
//
// This module re-implements the rules that can be checked OFFLINE, on the
// exact XML the contractor is about to hand over. Each rule names its official
// code and source. Severity:
//   error   — the authority rejects on it (or the schema does: the device
//             cannot run xmllint, so the XSD formats of fields a contractor
//             TYPES are re-checked here as code '00200' / 'XSD').
//   warning — accepted but wrong or inconsistent (e.g. a forfettario Natura on
//             an ordinary-regime invoice): shown, does not block.
//   info    — a fact about what the file is for (e.g. unsigned Facturae).
//
// SOURCES (fetched 2026-10-01):
//  IT  Elenco dei controlli effettuati sul file fattura del SdI, versione 2.0
//      (31/01/2025; listed as current documentation "valida a partire dal 15
//      maggio 2026") —
//      https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.4/Elenco-Controlli-versione-2.0.pdf
//  IT  Specifiche tecniche relative al SdI, versione 1.8.4 (31/03/2026), §2.1
//      firma, §2.2 nomenclatura file (00001/00002) —
//      https://www.fatturapa.gov.it/export/documenti/Specifiche-tecniche-relative-al-Sistema-di-Interscambio-versione-1.8.4.pdf
//  IT  Allegato A – Specifiche tecniche fatture elettroniche, versione 1.9.1
//      (31/03/2026): §1.2.1 (B2B files may be unsigned), §2.1.1 (Codice
//      Destinatario / PEC, 00313, 00330) —
//      https://www.agenziaentrate.gov.it/portale/documents/d/guest/allegato-a-specifiche-tecniche-vers-1-9-1
//  ES  Orden HAP/1650/2015, Anexo II "Reglas de validación" (rules 1–9, applied
//      by FACe and the registros contables de facturas) —
//      https://www.boe.es/eli/es/o/2015/07/31/hap1650/dof/spa/pdf
//  ES  Facturae 3.2.2 XSD element definitions (InvoiceTotal, TotalOutstanding…,
//      Batch totals) — https://www.facturae.gob.es/content/dam/facturae/formato/versiones/Facturaev3_2_2.xml
//  ES  RD 1619/2012 art. 10 (B2B authenticity may be ensured by means other than
//      a signature; consolidated text 31/03/2026) — https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696
//
// NOT checkable offline (named, never claimed): existence of a P.IVA / CF in the
// Anagrafe Tributaria (00300–00306 beyond the check digit), Codice Destinatario
// active (00311/00312), duplicates (00404/00409, HAP II.3b), IPA lookups
// (00398/00399), VAT groups (00320–00327), dichiarazioni d'intento (00477),
// DIR3 existence (HAP II.8), signature validity (00100–00107, HAP II.2).
// =============================================================================

import { round2 } from '../utils/round2';
import { parseXml, kids, at, textAt, type XmlNode } from './miniXml';
import { isValidPartitaIva, isValidCodiceFiscale, checkSpanishTaxId, isSpanishPublicBodyNif } from './fiscalIds';

export type RuleSeverity = 'error' | 'warning' | 'info';
/** Who can fix it: the contractor's profile, the customer record, the invoice, or Vasco itself. */
export type RuleFixWhere = 'profile' | 'customer' | 'invoice' | 'vasco';

/**
 * Every contractor-facing sentence a finding can carry, under `einvoiceRules.`
 * in all six locales (the test checks this list against the locale files; the
 * type makes tsc refuse a key that is not on it).
 */
export const RULE_KEYS = [
  'internal', 'taxIdSeller', 'taxIdBuyer', 'taxIdBuyerMissing', 'postcodeSeller', 'postcodeBuyer',
  'provinceSeller', 'provinceBuyer', 'routingCode', 'publicBuyerIT', 'publicBuyerES', 'pec', 'characters',
  'tooLong', 'futureDate', 'invoiceNumber', 'samePartyId', 'description', 'nameWithSurnameSeller',
  'nameWithSurnameBuyer', 'iban', 'bollo', 'naturaRegime', 'regimeCharges', 'unsignedB2B',
] as const;
export type RuleKey = typeof RULE_KEYS[number];

export interface RuleFinding {
  /** The authority's own code: SDI '00423', 'HAP1650-II.6a', 'XSD', … */
  code: string;
  severity: RuleSeverity;
  /** English, technical, with the values involved. */
  message: string;
  where: RuleFixWhere;
  /** i18n key (under `einvoiceRules.`) for the contractor-facing sentence. */
  key: RuleKey;
  params?: Record<string, string>;
}

export interface RuleOptions {
  /** YYYY-MM-DD the file is checked "as of" (SDI 00403 / HAP II.7). Default: today. */
  today?: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const num = (s: string | undefined): number => (s === undefined || s === '' ? NaN : Number(s));
const cents = (n: number): number => Math.round(round2(n) * 100);
/** Latin-1 (Basic Latin + Latin-1 Supplement), the FatturaPA String*LatinType set. */
const NON_LATIN1 = /[^\u0000-\u00FF]/gu;
const NON_BASIC_LATIN = /[^\u0000-\u007F]/;
const isIsoDate = (s: string | undefined): boolean =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export const blockingFindings = (fs: RuleFinding[]): RuleFinding[] => fs.filter((f) => f.severity === 'error');

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/**
 * The blocking findings as sentences a contractor can act on, each ending in
 * the authority's own code (what support — or the commercialista — will ask
 * for). One line per distinct sentence.
 */
export function blockingFindingLines(fs: RuleFinding[], t: Translate): string[] {
  const lines = blockingFindings(fs).map((f) =>
    `${t(`einvoiceRules.${f.key}`, { ...(f.params ?? {}), code: f.params?.code ?? f.code, defaultValue: f.message })} (${f.code})`);
  return [...new Set(lines)];
}

// =============================================================================
// ITALY — FatturaPA → SDI
// =============================================================================

/**
 * The SDI file name, §2.2 of the SdI specifiche 1.8.4: country code +
 * transmitter's fiscal id + "_" + a progressive of at most 5 characters
 * [a-zA-Z0-9]; every file sent must have a name never used before (00001
 * invalid / 00002 duplicate). A re-send after a rejection therefore needs a
 * NEW name, so the progressive is time-derived (seconds, base 36, last 5
 * chars): distinct for every second over a ~700-day cycle, and only a file
 * sent in the very same second-of-cycle could collide.
 */
export function fatturaPaFileName(country: string, transmitterId: string, now: Date = new Date()): string {
  const seconds = Math.floor(now.getTime() / 1000);
  const prog = seconds.toString(36).toUpperCase().slice(-5).padStart(5, '0');
  return `${country.toUpperCase()}${transmitterId.toUpperCase()}_${prog}.xml`;
}

export function isValidFatturaPaFileName(name: string): boolean {
  const m = /^([A-Z]{2})([A-Za-z0-9]+)_([A-Za-z0-9]{1,5})\.(xml|xml\.p7m|zip)$/.exec(name);
  if (!m) return false;
  const len = m[2].length;
  return m[1] === 'IT' ? len >= 11 && len <= 16 : len >= 2 && len <= 28;
}

const N_GENERIC = new Set(['N2', 'N3', 'N6']);
/** Naturas whose amount counts toward the € 77,47 bollo threshold: not-subject / exempt / excluded / margin. */
const BOLLO_NATURE = /^(N1|N2(\.\d)?|N4|N5)$/;

/**
 * The SDI value rules over a FatturaPA document (one or more bodies). Pure:
 * no network, no clock except `opts.today`.
 */
export function checkFatturaPA(xml: string, opts: RuleOptions = {}): RuleFinding[] {
  const out: RuleFinding[] = [];
  const today = opts.today ?? todayIso();
  const push = (code: string, severity: RuleSeverity, where: RuleFixWhere, key: RuleKey, message: string, params?: Record<string, string>) =>
    out.push({ code, severity, where, key, message, ...(params ? { params } : {}) });

  let doc: XmlNode;
  try {
    doc = parseXml(xml);
  } catch (e) {
    push('00200', 'error', 'vasco', 'internal', `not well-formed XML: ${(e as Error).message}`, { code: '00200' });
    return out;
  }
  const root = doc.children.find((c) => c.name === 'FatturaElettronica');
  if (!root) {
    push('00200', 'error', 'vasco', 'internal', 'root element FatturaElettronica missing', { code: '00200' });
    return out;
  }
  const header = at(root, 'FatturaElettronicaHeader');
  const dt = at(header, 'DatiTrasmissione');
  const formato = textAt(dt, 'FormatoTrasmissione') ?? '';
  const codDest = textAt(dt, 'CodiceDestinatario') ?? '';
  const pec = textAt(dt, 'PECDestinatario');

  // 00428 — FormatoTrasmissione must equal the root's `versione` attribute.
  if (root.attrs.versione !== formato) {
    push('00428', 'error', 'vasco', 'internal', `FormatoTrasmissione ${formato} ≠ versione ${root.attrs.versione}`, { code: '00428' });
  }
  // CodiceDestinatario: XSD [A-Z0-9]{6,7}, then 00427 length vs format.
  if (!/^[A-Z0-9]{6,7}$/.test(codDest)) {
    push('00200', 'error', 'customer', 'routingCode', `CodiceDestinatario "${codDest}" is not [A-Z0-9]{6,7}`, { value: codDest });
  } else if ((formato === 'FPA12' && codDest.length === 7) || (formato !== 'FPA12' && codDest.length === 6)) {
    // A 6-character code is a public-administration office (IPA); FPR12 cannot carry it.
    push('00427', 'error', 'customer', codDest.length === 6 ? 'publicBuyerIT' : 'routingCode',
      `CodiceDestinatario of ${codDest.length} characters with FormatoTrasmissione ${formato}`, { value: codDest });
  }
  // SdI specifiche 1.8.4 §2.1: an invoice to a public administration must carry a qualified signature.
  if (formato === 'FPA12' && !root.children.some((c) => c.name === 'Signature')) {
    push('SDI-2.1', 'error', 'vasco', 'publicBuyerIT', 'FPA12 (public administration) file without a qualified electronic signature');
  }
  // Allegato A 1.9.1 §2.1.1 — PEC: not an SDI mailbox (00330); only used with 0000000.
  if (pec !== undefined) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pec) || pec.length < 7 || pec.length > 256) {
      push('00200', 'error', 'customer', 'pec', `PECDestinatario "${pec}" is not an e-mail address`, { value: pec });
    } else if (/^sdi\d*@pec\.fatturapa\.it$/i.test(pec)) {
      push('00330', 'error', 'customer', 'pec', `PECDestinatario is an SDI mailbox (${pec})`, { value: pec });
    }
    if (codDest !== '0000000') {
      push('A-2.1.1', 'warning', 'customer', 'pec', `PECDestinatario is only read when CodiceDestinatario is 0000000 (found ${codDest})`, { value: pec });
    }
  }

  // --- Parties ---------------------------------------------------------------
  const trasm = at(dt, 'IdTrasmittente');
  if (textAt(trasm, 'IdPaese') === 'IT') {
    const id = textAt(trasm, 'IdCodice') ?? '';
    // Allegato A §2.1.1: IdCodice of an Italian transmitter IS a codice fiscale (00300).
    if (!isValidCodiceFiscale(id)) push('00300', 'error', 'profile', 'taxIdSeller', `IdTrasmittente/IdCodice "${id}" is not a valid codice fiscale`, { value: id });
  }
  const ced = at(header, 'CedentePrestatore');
  const cedAna = at(ced, 'DatiAnagrafici');
  const cedPaese = textAt(cedAna, 'IdFiscaleIVA/IdPaese');
  const cedPiva = textAt(cedAna, 'IdFiscaleIVA/IdCodice') ?? '';
  if (cedPaese === 'IT' && !isValidPartitaIva(cedPiva)) {
    push('00301', 'error', 'profile', 'taxIdSeller', `cedente partita IVA "${cedPiva}" fails the check digit`, { value: cedPiva });
  }
  const cedCf = textAt(cedAna, 'CodiceFiscale');
  if (cedCf !== undefined && !isValidCodiceFiscale(cedCf)) {
    push('00302', 'error', 'profile', 'taxIdSeller', `cedente CodiceFiscale "${cedCf}" is not a valid codice fiscale`, { value: cedCf });
  }
  const regime = textAt(cedAna, 'RegimeFiscale') ?? '';

  const ces = at(header, 'CessionarioCommittente');
  const cesAna = at(ces, 'DatiAnagrafici');
  const cesPaese = textAt(cesAna, 'IdFiscaleIVA/IdPaese');
  const cesPiva = textAt(cesAna, 'IdFiscaleIVA/IdCodice');
  const cesCf = textAt(cesAna, 'CodiceFiscale');
  if (cesPiva === undefined && cesCf === undefined) {
    push('00417', 'error', 'customer', 'taxIdBuyerMissing', 'cessionario has neither IdFiscaleIVA nor CodiceFiscale');
  }
  if (cesPaese === 'IT' && cesPiva !== undefined && !isValidPartitaIva(cesPiva)) {
    push('00305', 'error', 'customer', 'taxIdBuyer', `cessionario partita IVA "${cesPiva}" fails the check digit`, { value: cesPiva });
  }
  if (cesCf !== undefined && !isValidCodiceFiscale(cesCf)) {
    push('00306', 'error', 'customer', 'taxIdBuyer', `cessionario CodiceFiscale "${cesCf}" is not a valid codice fiscale`, { value: cesCf });
  }
  if (cedPaese && cesPaese && cedPaese !== 'IT' && cesPaese !== 'IT') {
    push('00476', 'error', 'profile', 'internal', `IdPaese of cedente (${cedPaese}) and cessionario (${cesPaese}) both non-IT`, { code: '00476' });
  }
  // 00313 — 'XXXXXXX' is only for a buyer not established in Italy.
  if (codDest === 'XXXXXXX' && (cesPaese === 'IT' || (cesPaese === undefined && cesCf !== undefined))) {
    push('00313', 'error', 'customer', 'routingCode', 'CodiceDestinatario XXXXXXX with an Italian cessionario', { value: codDest });
  }

  // Formats of what the contractor TYPES (XSD; the device cannot run xmllint).
  const partyFormats = (party: XmlNode | undefined, where: 'profile' | 'customer') => {
    const sede = at(party, 'Sede');
    const nazione = textAt(sede, 'Nazione');
    const cap = textAt(sede, 'CAP') ?? '';
    if (!/^\d{5}$/.test(cap)) push('00200', 'error', where, where === 'profile' ? 'postcodeSeller' : 'postcodeBuyer', `CAP "${cap}" is not 5 digits`, { value: cap });
    const prov = textAt(sede, 'Provincia');
    if (nazione === 'IT' && (prov === undefined || !/^[A-Z]{2}$/.test(prov))) {
      push('00200', 'error', where, where === 'profile' ? 'provinceSeller' : 'provinceBuyer', `Provincia "${prov ?? ''}" is not a 2-letter code`, { value: prov ?? '' });
    }
    const ana = at(at(party, 'DatiAnagrafici'), 'Anagrafica');
    for (const [el, max] of [['Denominazione', 80], ['Nome', 60], ['Cognome', 60]] as const) latin1(textAt(ana, el), el, max, where);
    latin1(textAt(sede, 'Indirizzo'), 'Indirizzo', 60, where);
    latin1(textAt(sede, 'Comune'), 'Comune', 60, where);
  };
  const latin1 = (value: string | undefined, field: string, max: number, where: RuleFixWhere) => {
    if (value === undefined) return;
    const bad = value.match(NON_LATIN1);
    if (bad) push('00200', 'error', where, 'characters', `${field} contains characters outside Latin-1: ${[...new Set(bad)].join(' ')}`, { field, value: [...new Set(bad)].join(' ') });
    if (value.length > max || value.length === 0) push('00200', 'error', where, 'tooLong', `${field} has ${value.length} characters (1–${max} allowed)`, { field, max: String(max) });
  };
  partyFormats(ced, 'profile');
  partyFormats(ces, 'customer');

  // --- Bodies ----------------------------------------------------------------
  for (const body of kids(root, 'FatturaElettronicaBody')) {
    const dgd = at(body, 'DatiGenerali/DatiGeneraliDocumento');
    const tipo = textAt(dgd, 'TipoDocumento') ?? '';
    const data = textAt(dgd, 'Data');
    const numero = textAt(dgd, 'Numero') ?? '';
    if (!isIsoDate(data)) push('00200', 'error', 'vasco', 'internal', `Data "${data}" is not a date`, { code: '00200' });
    else if ((data as string) > today) push('00403', 'error', 'invoice', 'futureDate', `Data ${data} is after the day of transmission (${today})`, { value: data as string });
    // 00425 — Numero must contain a digit; XSD String20Type is Basic Latin, 1–20.
    if (!/\d/.test(numero)) push('00425', 'error', 'invoice', 'invoiceNumber', `Numero "${numero}" contains no digit`, { value: numero });
    if (numero.length < 1 || numero.length > 20 || NON_BASIC_LATIN.test(numero)) {
      push('00200', 'error', 'invoice', 'invoiceNumber', `Numero "${numero}" is not 1–20 Basic Latin characters`, { value: numero });
    }

    // 00471–00475 — TipoDocumento vs parties (self-billing / integration types).
    const sameParty = cedPiva !== '' && cesPiva !== undefined && cedPaese === cesPaese && cedPiva === cesPiva;
    if (['TD16', 'TD17', 'TD18', 'TD19', 'TD20', 'TD29'].includes(tipo) && sameParty) push('00471', 'error', 'invoice', 'internal', `${tipo} with cedente = cessionario`, { code: '00471' });
    if (tipo === 'TD21' && !sameParty) push('00472', 'error', 'invoice', 'internal', 'TD21 with cedente ≠ cessionario', { code: '00472' });
    if (['TD17', 'TD18', 'TD19', 'TD28'].includes(tipo) && cedPaese === 'IT') push('00473', 'error', 'invoice', 'internal', `${tipo} with an Italian cedente`, { code: '00473' });
    if (tipo === 'TD29' && cedPaese !== 'IT') push('00473', 'error', 'invoice', 'internal', 'TD29 with a non-Italian cedente', { code: '00473' });
    if (['TD16', 'TD17', 'TD18', 'TD19', 'TD20', 'TD22', 'TD23', 'TD28', 'TD29'].includes(tipo) && cesPiva === undefined) {
      push('00475', 'error', 'customer', 'taxIdBuyerMissing', `${tipo} requires the cessionario's IdFiscaleIVA`);
    }

    // 00437 — a document-level ScontoMaggiorazione needs Percentuale or Importo.
    for (const sm of kids(dgd, 'ScontoMaggiorazione')) {
      if (textAt(sm, 'Percentuale') === undefined && textAt(sm, 'Importo') === undefined) push('00437', 'error', 'vasco', 'internal', 'DatiGeneraliDocumento/ScontoMaggiorazione without Percentuale/Importo', { code: '00437' });
    }
    const hasRitenutaBlock = kids(dgd, 'DatiRitenuta').length > 0;

    const rateKey = (s: string | undefined) => (s === undefined ? '' : num(s).toFixed(2));
    const rates = new Set<string>(); // distinct AliquotaIVA of lines + cassa (00419)
    const naturasUsed = new Set<string>();
    const baseByRate = new Map<string, number>(); // Σ PrezzoTotale + cassa contributions (00422)
    const addBase = (rate: string, v: number) => baseByRate.set(rate, round2((baseByRate.get(rate) ?? 0) + v));

    const checkRateNatura = (aliq: string | undefined, nat: string | undefined, codes: [string, string], where: string) => {
      const a = num(aliq);
      if (Number.isNaN(a)) return;
      if (a === 0 && nat === undefined) push(codes[0], 'error', 'vasco', 'internal', `${where}: AliquotaIVA 0 without Natura`, { code: codes[0] });
      if (a !== 0 && nat !== undefined) push(codes[1], 'error', 'vasco', 'internal', `${where}: Natura ${nat} with AliquotaIVA ${aliq}`, { code: codes[1] });
      // 00424 — a rate is a percentage: 22.00, never 0.22.
      if (a !== 0 && a < 1) push('00424', 'error', 'vasco', 'internal', `${where}: AliquotaIVA ${aliq} is not a percentage`, { code: '00424' });
      // 00445 — the generic N2 / N3 / N6 are no longer accepted (since 2021).
      if (nat !== undefined && N_GENERIC.has(nat)) push('00445', 'error', 'vasco', 'internal', `${where}: generic Natura ${nat}`, { code: '00445' });
    };

    let bolloBase = 0;
    let anyPositiveRate = false;
    let anyN22 = false;
    for (const [idx, li] of kids(at(body, 'DatiBeniServizi'), 'DettaglioLinee').entries()) {
      const where = `DettaglioLinee ${idx + 1}`;
      const aliq = textAt(li, 'AliquotaIVA');
      const nat = textAt(li, 'Natura');
      checkRateNatura(aliq, nat, ['00400', '00401'], where);
      rates.add(rateKey(aliq));
      if (nat !== undefined) naturasUsed.add(nat);
      if (num(aliq) > 0) anyPositiveRate = true;
      if (nat === 'N2.2') anyN22 = true;
      latin1(textAt(li, 'Descrizione'), 'Descrizione', 1000, 'invoice');
      // 00423 — PrezzoTotale = (PrezzoUnitario ± sconti/maggiorazioni) × Quantita, ±0,01.
      const qty = textAt(li, 'Quantita') === undefined ? 1 : num(textAt(li, 'Quantita'));
      let unit = num(textAt(li, 'PrezzoUnitario'));
      for (const sm of kids(li, 'ScontoMaggiorazione')) {
        const tipoSm = textAt(sm, 'Tipo');
        const imp = textAt(sm, 'Importo');
        const perc = textAt(sm, 'Percentuale');
        if (imp === undefined && perc === undefined) { push('00438', 'error', 'vasco', 'internal', `${where}: ScontoMaggiorazione without Percentuale/Importo`, { code: '00438' }); continue; }
        // "In caso di presenza contemporanea di Importo e Percentuale, si considera solo il primo".
        const firstIsImporto = sm.children.findIndex((c) => c.name === 'Importo') < sm.children.findIndex((c) => c.name === 'Percentuale') || perc === undefined;
        const delta = firstIsImporto && imp !== undefined ? num(imp) : (unit * num(perc)) / 100;
        unit = tipoSm === 'SC' ? unit - delta : unit + delta;
      }
      const totale = num(textAt(li, 'PrezzoTotale'));
      if (Math.abs(unit * qty - totale) >= 0.01 - 1e-9) {
        push('00423', 'error', 'vasco', 'internal', `${where}: PrezzoTotale ${textAt(li, 'PrezzoTotale')} ≠ PrezzoUnitario ${textAt(li, 'PrezzoUnitario')} × Quantita ${textAt(li, 'Quantita') ?? '1'} (= ${unit * qty})`, { code: '00423' });
      }
      addBase(rateKey(aliq), totale);
      if (nat !== undefined && BOLLO_NATURE.test(nat)) bolloBase = round2(bolloBase + totale);
      if (textAt(li, 'Ritenuta') === 'SI' && !hasRitenutaBlock) push('00411', 'error', 'vasco', 'internal', `${where}: Ritenuta SI without DatiRitenuta`, { code: '00411' });
    }
    for (const cp of kids(dgd, 'DatiCassaPrevidenziale')) {
      const aliq = textAt(cp, 'AliquotaIVA');
      const nat = textAt(cp, 'Natura');
      checkRateNatura(aliq, nat, ['00413', '00414'], 'DatiCassaPrevidenziale');
      rates.add(rateKey(aliq));
      if (nat !== undefined) naturasUsed.add(nat);
      addBase(rateKey(aliq), num(textAt(cp, 'ImportoContributoCassa')));
      if (textAt(cp, 'Ritenuta') === 'SI' && !hasRitenutaBlock) push('00415', 'error', 'vasco', 'internal', 'DatiCassaPrevidenziale Ritenuta SI without DatiRitenuta', { code: '00415' });
    }

    const riep = kids(at(body, 'DatiBeniServizi'), 'DatiRiepilogo');
    const riepRates = new Set<string>();
    const riepNature = new Set<string>();
    const riepBase = new Map<string, number>();
    let riepTotal = 0;
    for (const [idx, r] of riep.entries()) {
      const where = `DatiRiepilogo ${idx + 1}`;
      const aliq = textAt(r, 'AliquotaIVA');
      const nat = textAt(r, 'Natura');
      const a = num(aliq);
      if (a === 0 && nat === undefined) push('00429', 'error', 'vasco', 'internal', `${where}: AliquotaIVA 0 without Natura`, { code: '00429' });
      if (a !== 0 && nat !== undefined) push('00430', 'error', 'vasco', 'internal', `${where}: Natura ${nat} with AliquotaIVA ${aliq}`, { code: '00430' });
      if (a !== 0 && a < 1) push('00424', 'error', 'vasco', 'internal', `${where}: AliquotaIVA ${aliq} is not a percentage`, { code: '00424' });
      if (nat !== undefined && N_GENERIC.has(nat)) push('00445', 'error', 'vasco', 'internal', `${where}: generic Natura ${nat}`, { code: '00445' });
      // 00420 — reverse charge (N6.x) cannot be split payment (S).
      if (textAt(r, 'EsigibilitaIVA') === 'S' && nat !== undefined && /^N6/.test(nat)) push('00420', 'error', 'vasco', 'internal', `${where}: Natura ${nat} with EsigibilitaIVA S`, { code: '00420' });
      riepRates.add(rateKey(aliq));
      if (nat !== undefined) riepNature.add(nat);
      const imponibile = num(textAt(r, 'ImponibileImporto'));
      const imposta = num(textAt(r, 'Imposta'));
      // 00421 — Imposta = AliquotaIVA × ImponibileImporto / 100, rounded half-up, ±0,01.
      if (Math.abs(cents((a * imponibile) / 100) - cents(imposta)) >= 1) {
        push('00421', 'error', 'vasco', 'internal', `${where}: Imposta ${textAt(r, 'Imposta')} ≠ ${aliq}% × ${textAt(r, 'ImponibileImporto')}`, { code: '00421' });
      }
      riepBase.set(rateKey(aliq), round2((riepBase.get(rateKey(aliq)) ?? 0) + imponibile + (num(textAt(r, 'Arrotondamento')) || 0)));
      riepTotal = round2(riepTotal + imponibile + imposta);
    }
    // 00419 — one DatiRiepilogo at least per distinct AliquotaIVA.
    if (riep.length < rates.size) push('00419', 'error', 'vasco', 'internal', `${riep.length} DatiRiepilogo for ${rates.size} distinct rates`, { code: '00419' });
    // 00443 / 00444 — every line rate and Natura has its summary.
    for (const r of rates) if (!riepRates.has(r)) push('00443', 'error', 'vasco', 'internal', `AliquotaIVA ${r} has no DatiRiepilogo`, { code: '00443' });
    for (const n of naturasUsed) if (!riepNature.has(n)) push('00444', 'error', 'vasco', 'internal', `Natura ${n} has no DatiRiepilogo`, { code: '00444' });
    // 00422 — Σ ImponibileImporto per rate = Σ PrezzoTotale + Σ cassa (+ Arrotondamento), ±1 €.
    for (const [rate, base] of baseByRate) {
      const declared = riepBase.get(rate) ?? 0;
      if (Math.abs(declared - base) >= 1) push('00422', 'error', 'vasco', 'internal', `rate ${rate}: ImponibileImporto ${declared} ≠ Σ lines ${base}`, { code: '00422' });
      // Not a scarto below 1 €, but a summary that disagrees with its own lines.
      else if (cents(declared) !== cents(base)) push('00422', 'warning', 'vasco', 'internal', `rate ${rate}: ImponibileImporto ${declared} ≠ Σ PrezzoTotale ${base} (within SDI's 1 € tolerance)`, { code: '00422' });
    }

    // ImportoTotaleDocumento — not an SDI scarto, but it must follow from the
    // summary (plus a recharged bollo, which is the only thing we add).
    const totDoc = textAt(dgd, 'ImportoTotaleDocumento');
    const bolloAmt = num(textAt(dgd, 'DatiBollo/ImportoBollo')) || 0;
    if (totDoc !== undefined && cents(num(totDoc)) !== cents(riepTotal) && cents(num(totDoc)) !== cents(riepTotal + bolloAmt)) {
      push('A-2.2.1.4', 'warning', 'vasco', 'internal', `ImportoTotaleDocumento ${totDoc} ≠ Σ DatiRiepilogo ${riepTotal}`, { code: 'ImportoTotaleDocumento' });
    }
    const payments = kids(at(body, 'DatiPagamento'), 'DettaglioPagamento');
    const splitOrWithholding = hasRitenutaBlock || riep.some((r) => textAt(r, 'EsigibilitaIVA') === 'S');
    if (payments.length && totDoc !== undefined && !splitOrWithholding) {
      const paid = payments.reduce((s, p) => round2(s + num(textAt(p, 'ImportoPagamento'))), 0);
      if (cents(paid) !== cents(num(totDoc))) push('A-2.4.2.6', 'warning', 'vasco', 'internal', `Σ ImportoPagamento ${paid} ≠ ImportoTotaleDocumento ${totDoc}`, { code: 'ImportoPagamento' });
    }
    for (const p of payments) {
      const iban = textAt(p, 'IBAN');
      if (iban !== undefined && !/^[a-zA-Z]{2}[0-9]{2}[a-zA-Z0-9]{11,30}$/.test(iban)) push('00200', 'error', 'profile', 'iban', `IBAN "${iban}" is not an IBAN`, { value: iban });
    }

    // Marca da bollo — DPR 642/1972, Tariffa parte I, art. 13 n. 1: € 2,00 is
    // due on an invoice whose amounts outside IVA exceed € 77,47. SDI accepts
    // the file without it; the tax office fines it.
    if (bolloBase > 77.47 && !at(dgd, 'DatiBollo')) {
      push('BOLLO', 'warning', 'vasco', 'bollo', `${bolloBase} € outside IVA (> 77,47) without DatiBollo`);
    }
    // Natura vs regime — accepted by SDI, fiscally a statement. N2.2 is what a
    // forfettario (RF19) or minimo (RF02) writes; on an ordinary regime a 0 %
    // line is more often reverse charge (N6.x, e.g. N6.3 subappalto edilizia)
    // or exempt (N4) — a fact about the transaction Vasco does not hold.
    if (anyN22 && regime !== 'RF19' && regime !== 'RF02') {
      push('NATURA-REGIME', 'warning', 'invoice', 'naturaRegime', `Natura N2.2 on an invoice under ${regime}`, { value: regime });
    }
    if (anyPositiveRate && (regime === 'RF19' || regime === 'RF02')) {
      push('NATURA-REGIME', 'warning', 'invoice', 'regimeCharges', `${regime} with IVA charged on a line`, { value: regime });
    }
  }
  return out;
}

// =============================================================================
// SPAIN — Facturae 3.2.2 → FACe / B2B
// =============================================================================

/** "con dos decimales": at most two, or trailing zeros after the second. */
const twoDecimals = (s: string | undefined): boolean => s !== undefined && /^-?\d+(\.\d{1,2}0*)?$/.test(s);

export function checkFacturae(xml: string, opts: RuleOptions = {}): RuleFinding[] {
  const out: RuleFinding[] = [];
  const today = opts.today ?? todayIso();
  const push = (code: string, severity: RuleSeverity, where: RuleFixWhere, key: RuleKey, message: string, params?: Record<string, string>) =>
    out.push({ code, severity, where, key, message, ...(params ? { params } : {}) });

  let doc: XmlNode;
  try {
    doc = parseXml(xml);
  } catch (e) {
    push('HAP1650-II.1', 'error', 'vasco', 'internal', `not well-formed XML: ${(e as Error).message}`, { code: 'XML' });
    return out;
  }
  const root = doc.children.find((c) => c.name === 'Facturae');
  if (!root) {
    push('HAP1650-II.1', 'error', 'vasco', 'internal', 'root element Facturae missing', { code: 'XML' });
    return out;
  }
  const signed = root.children.some((c) => c.name === 'Signature');

  // --- Parties (HAP II.5) ----------------------------------------------------
  type PartyInfo = { bare: string; residence?: string };
  const party = (el: XmlNode | undefined, where: 'profile' | 'customer'): PartyInfo => {
    const ti = at(el, 'TaxIdentification');
    const ptc = textAt(ti, 'PersonTypeCode');
    const residence = textAt(ti, 'ResidenceTypeCode');
    const tin = textAt(ti, 'TaxIdentificationNumber') ?? '';
    const sfx = where === 'profile' ? ('Seller' as const) : ('Buyer' as const);
    // 5a — person type is mandatory.
    if (ptc !== 'F' && ptc !== 'J') push('HAP1650-II.5a', 'error', where, 'internal', `PersonTypeCode "${ptc ?? ''}"`, { code: 'HAP1650-II.5a' });
    const check = checkSpanishTaxId(tin);
    // 5b — a Spanish NIF must follow its formation rules (control character).
    const spanish = residence === 'R' || /^ES/i.test(tin) || !/^[A-Z]{2}/i.test(tin);
    if (spanish && !check.valid) push('HAP1650-II.5b', 'error', where, (`taxId${sfx}` as const), `NIF "${tin}" fails the formation rules / control character`, { value: tin });
    // Facturae TaxIdentificationNumber: the country prefix is for intra-EU operations only.
    if (spanish && /^ES/i.test(tin) && residence === 'R') {
      push('FACTURAE-TIN', 'warning', where, (`taxId${sfx}` as const), `NIF "${tin}" carries the ES prefix on a domestic operation`, { value: tin });
    }
    const ind = at(el, 'Individual');
    const le = at(el, 'LegalEntity');
    // 5d — a person has a name and a first surname.
    if (ptc === 'F' && (!textAt(ind, 'Name') || !textAt(ind, 'FirstSurname'))) push('HAP1650-II.5d', 'error', where, (`nameWithSurname${sfx}` as const), 'person without Name/FirstSurname');
    // 5e — an entity has a razón social.
    if (ptc === 'J' && !textAt(le, 'CorporateName')) push('HAP1650-II.5e', 'error', where, 'internal', 'legal entity without CorporateName', { code: 'HAP1650-II.5e' });
    // Not in Anexo II, but a person filed as a company (or vice versa) is wrong data.
    if (check.kind && ((check.kind === 'ENTITY') !== (ptc === 'J'))) {
      push('FACTURAE-PTC', 'warning', where, 'internal', `PersonTypeCode ${ptc} for a ${check.kind} NIF`, { code: 'PersonTypeCode' });
    }
    const block = ind ?? le;
    const addr = at(block, 'AddressInSpain');
    if (addr) {
      const pc = textAt(addr, 'PostCode') ?? '';
      if (!/^\d{5}$/.test(pc)) push('XSD', 'error', where, (`postcode${sfx}` as const), `PostCode "${pc}" is not 5 digits`, { value: pc });
    }
    const len = (path: string, max: number, field: string) => {
      const v = textAt(block, path);
      if (v !== undefined && v.length > max) push('XSD', 'error', where, 'tooLong', `${field} has ${v.length} characters (max ${max})`, { field, max: String(max) });
    };
    len('CorporateName', 80, 'CorporateName');
    len('Name', 40, 'Name');
    len('FirstSurname', 40, 'FirstSurname');
    len('SecondSurname', 40, 'SecondSurname');
    len('AddressInSpain/Address', 80, 'Address');
    len('AddressInSpain/Town', 50, 'Town');
    len('AddressInSpain/Province', 20, 'Province');
    return { bare: check.bare, residence };
  };
  const seller = party(at(root, 'Parties/SellerParty'), 'profile');
  const buyerEl = at(root, 'Parties/BuyerParty');
  const buyer = party(buyerEl, 'customer');
  // 5f — seller and buyer NIF differ.
  if (seller.bare && seller.bare === buyer.bare) push('HAP1650-II.5f', 'error', 'customer', 'samePartyId', `seller and buyer share NIF ${seller.bare}`, { value: seller.bare });

  // B2G — Ley 25/2013: a public body receives through FACe, which validates the
  // Facturae signature policy (HAP II.2) and three DIR3 centres (HAP II.8).
  const buyerTin = textAt(at(buyerEl, 'TaxIdentification'), 'TaxIdentificationNumber');
  if (isSpanishPublicBodyNif(buyerTin)) {
    const roles = new Set(kids(at(buyerEl, 'AdministrativeCentres'), 'AdministrativeCentre').map((c) => textAt(c, 'RoleTypeCode')));
    const dir3 = ['01', '02', '03'].every((r) => roles.has(r));
    if (!signed || !dir3) {
      // P (local) and S (State) are FACe administrations. Q also covers
      // public-law bodies outside Ley 25/2013 (chambers of commerce,
      // professional colleges), for which an unsigned B2B Facturae is valid:
      // a warning, not a refusal (review 2026-10-01).
      const facOnly = /^(ES)?[PS]/.test((buyerTin ?? '').toUpperCase().replace(/[\s.-]/g, ''));
      push('HAP1650-II.2/II.8', facOnly ? 'error' : 'warning', 'customer', 'publicBuyerES',
        `buyer ${buyerTin} is a public body: FACe requires the Facturae signature policy (${signed ? 'present' : 'absent'}) and DIR3 roles 01/02/03 (${dir3 ? 'present' : 'absent'})`, { value: buyerTin ?? '' });
    }
  } else if (!signed) {
    // RD 1619/2012 art. 10: between businesses the authenticity of origin may
    // be ensured by means other than a signature, so an unsigned Facturae is a
    // valid B2B invoice — but never a FACe one. (RD 238/2026 requires an
    // advanced signature on PRIVATE-PLATFORM exchange once B2B e-invoicing
    // applies — not yet in force on 2026-10-01.)
    push('UNSIGNED', 'info', 'vasco', 'unsignedB2B', 'Facturae without XAdES signature: valid between businesses, not accepted by FACe');
  }

  // --- Invoices (HAP II.3, II.6, II.7, II.9) ---------------------------------
  const invoices = kids(at(root, 'Invoices'), 'Invoice');
  const sum = (els: XmlNode[], path: string) => els.reduce((s, e) => round2(s + (num(textAt(e, path)) || 0)), 0);
  let batchTotal = 0;
  let batchOutstanding = 0;
  let batchExecutable = 0;
  for (const inv of invoices) {
    const number = textAt(inv, 'InvoiceHeader/InvoiceNumber') ?? '';
    // 3a — the invoice number is mandatory.
    if (!number) push('HAP1650-II.3a', 'error', 'invoice', 'invoiceNumber', 'InvoiceNumber empty', { value: number });
    if (number.length > 20) push('XSD', 'error', 'invoice', 'invoiceNumber', `InvoiceNumber "${number}" longer than 20`, { value: number });
    // 7a — the issue date is valid and not after the day it is registered.
    const issue = textAt(inv, 'InvoiceIssueData/IssueDate');
    if (!isIsoDate(issue)) push('HAP1650-II.7a', 'error', 'vasco', 'internal', `IssueDate "${issue}" is not a date`, { code: 'HAP1650-II.7a' });
    else if ((issue as string) > today) push('HAP1650-II.7a', 'error', 'invoice', 'futureDate', `IssueDate ${issue} is after ${today}`, { value: issue as string });

    // 6a — per line: TotalCost = Quantity × UnitPriceWithoutTax rounded to two
    // decimals (método común de redondeo), GrossAmount = TotalCost − discounts
    // + charges, every line amount except the unit price with two decimals.
    const lines = kids(at(inv, 'Items'), 'InvoiceLine');
    let grossSum = 0;
    const lineBaseByRate = new Map<string, number>();
    for (const [idx, li] of lines.entries()) {
      const where = `InvoiceLine ${idx + 1}`;
      // 9b — the line description has content.
      if (!textAt(li, 'ItemDescription')) push('HAP1650-II.9b', 'error', 'invoice', 'description', `${where}: ItemDescription empty`);
      const q = num(textAt(li, 'Quantity'));
      const up = num(textAt(li, 'UnitPriceWithoutTax'));
      const tc = textAt(li, 'TotalCost');
      const ga = textAt(li, 'GrossAmount');
      if (cents(q * up) !== Math.round(num(tc) * 100) || !twoDecimals(tc)) {
        push('HAP1650-II.6a', 'error', 'vasco', 'internal', `${where}: TotalCost ${tc} ≠ round2(${textAt(li, 'Quantity')} × ${textAt(li, 'UnitPriceWithoutTax')}) = ${round2(q * up).toFixed(2)}`, { code: 'HAP1650-II.6a' });
      }
      const disc = sum(kids(at(li, 'DiscountsAndRebates'), 'Discount'), 'DiscountAmount');
      const chg = sum(kids(at(li, 'Charges'), 'Charge'), 'ChargeAmount');
      if (cents(num(tc) - disc + chg) !== cents(num(ga)) || !twoDecimals(ga)) {
        push('HAP1650-II.6a', 'error', 'vasco', 'internal', `${where}: GrossAmount ${ga} ≠ TotalCost ${tc} − ${disc} + ${chg}`, { code: 'HAP1650-II.6a' });
      }
      grossSum = round2(grossSum + num(ga));
      for (const tax of kids(at(li, 'TaxesOutputs'), 'Tax')) {
        for (const p of ['TaxableBase/TotalAmount', 'TaxAmount/TotalAmount']) {
          if (textAt(tax, p) !== undefined && !twoDecimals(textAt(tax, p))) push('HAP1650-II.6a', 'error', 'vasco', 'internal', `${where}: ${p} not two decimals`, { code: 'HAP1650-II.6a' });
        }
        const rate = num(textAt(tax, 'TaxRate')).toFixed(2);
        lineBaseByRate.set(rate, round2((lineBaseByRate.get(rate) ?? 0) + num(textAt(tax, 'TaxableBase/TotalAmount'))));
      }
    }

    const totals = at(inv, 'InvoiceTotals');
    const t = (p: string) => num(textAt(totals, p)) || 0;
    // 6b — every total amount with two decimals; TotalGrossAmount = Σ GrossAmount.
    for (const el of totals?.children ?? []) {
      // Every leaf of InvoiceTotals is an amount (blocks like Subsidies have children).
      if (el.children.length === 0 && !twoDecimals(el.text.trim())) {
        push('HAP1650-II.6b', 'error', 'vasco', 'internal', `InvoiceTotals/${el.name} "${el.text.trim()}" not two decimals`, { code: 'HAP1650-II.6b' });
      }
    }
    if (cents(t('TotalGrossAmount')) !== cents(grossSum)) push('HAP1650-II.6b', 'error', 'vasco', 'internal', `TotalGrossAmount ${t('TotalGrossAmount')} ≠ Σ GrossAmount ${grossSum}`, { code: 'HAP1650-II.6b' });
    // 6d — withholdings never negative on a positive base.
    if (t('TotalGrossAmountBeforeTaxes') > 0 && textAt(totals, 'TotalTaxesWithheld') !== undefined && t('TotalTaxesWithheld') < 0) {
      push('HAP1650-II.6d', 'error', 'vasco', 'internal', `TotalTaxesWithheld ${t('TotalTaxesWithheld')} < 0`, { code: 'HAP1650-II.6d' });
    }
    // 6e — before taxes = gross − general discounts + general surcharges.
    if (cents(t('TotalGrossAmount') - t('TotalGeneralDiscounts') + t('TotalGeneralSurcharges')) !== cents(t('TotalGrossAmountBeforeTaxes'))) {
      push('HAP1650-II.6e', 'error', 'vasco', 'internal', `TotalGrossAmountBeforeTaxes ${t('TotalGrossAmountBeforeTaxes')} ≠ ${t('TotalGrossAmount')} − ${t('TotalGeneralDiscounts')} + ${t('TotalGeneralSurcharges')}`, { code: 'HAP1650-II.6e' });
    }
    // 6f — total = before taxes + taxes repercutidos − taxes withheld.
    if (cents(t('TotalGrossAmountBeforeTaxes') + t('TotalTaxOutputs') - t('TotalTaxesWithheld')) !== cents(t('InvoiceTotal'))) {
      push('HAP1650-II.6f', 'error', 'vasco', 'internal', `InvoiceTotal ${t('InvoiceTotal')} ≠ ${t('TotalGrossAmountBeforeTaxes')} + ${t('TotalTaxOutputs')} − ${t('TotalTaxesWithheld')}`, { code: 'HAP1650-II.6f' });
    }
    // Facturae 3.2.2 definitions: TotalTaxOutputs = Σ cuotas (+ recargo de
    // equivalencia); TotalTaxesWithheld = Σ retenciones; TotalOutstanding =
    // InvoiceTotal − subvenciones − anticipos; TotalExecutable = Outstanding −
    // retenciones de garantía + suplidos + gastos financieros.
    const outputs = kids(at(inv, 'TaxesOutputs'), 'Tax');
    const outSum = outputs.reduce((s, x) => round2(s + num(textAt(x, 'TaxAmount/TotalAmount')) + (num(textAt(x, 'EquivalenceSurchargeAmount/TotalAmount')) || 0)), 0);
    if (cents(outSum) !== cents(t('TotalTaxOutputs'))) push('FACTURAE-3.1.5.7', 'error', 'vasco', 'internal', `TotalTaxOutputs ${t('TotalTaxOutputs')} ≠ Σ TaxesOutputs ${outSum}`, { code: 'TotalTaxOutputs' });
    const withheld = sum(kids(at(inv, 'TaxesWithheld'), 'Tax'), 'TaxAmount/TotalAmount');
    if (cents(withheld) !== cents(t('TotalTaxesWithheld'))) push('FACTURAE-3.1.5.8', 'error', 'vasco', 'internal', `TotalTaxesWithheld ${t('TotalTaxesWithheld')} ≠ Σ TaxesWithheld ${withheld}`, { code: 'TotalTaxesWithheld' });
    const subsidies = sum(kids(at(totals, 'Subsidies'), 'Subsidy'), 'SubsidyAmount');
    if (cents(t('InvoiceTotal') - subsidies - t('TotalPaymentsOnAccount')) !== cents(t('TotalOutstandingAmount'))) {
      push('FACTURAE-3.1.5.14', 'error', 'vasco', 'internal', `TotalOutstandingAmount ${t('TotalOutstandingAmount')} ≠ InvoiceTotal − subsidies − payments on account`, { code: 'TotalOutstandingAmount' });
    }
    const amountsWithheld = num(textAt(totals, 'AmountsWithheld/WithholdingAmount')) || 0;
    const paymentInKind = num(textAt(totals, 'PaymentInKind/PaymentInKindAmount')) || 0;
    if (cents(t('TotalOutstandingAmount') - amountsWithheld - paymentInKind + t('TotalReimbursableExpenses') + t('TotalFinancialExpenses')) !== cents(t('TotalExecutableAmount'))) {
      push('FACTURAE-3.1.5.17', 'error', 'vasco', 'internal', `TotalExecutableAmount ${t('TotalExecutableAmount')} ≠ TotalOutstandingAmount ± adjustments`, { code: 'TotalExecutableAmount' });
    }
    // The header tax per rate: cuota = base × tipo, and the base = Σ the lines
    // at that rate. Not an Anexo II rule (warning), but a cuota that does not
    // follow from its base is a wrong tax figure.
    for (const tax of outputs) {
      const rate = num(textAt(tax, 'TaxRate'));
      const base = num(textAt(tax, 'TaxableBase/TotalAmount'));
      const amt = num(textAt(tax, 'TaxAmount/TotalAmount'));
      if (Math.abs(cents((base * rate) / 100) - cents(amt)) >= 1) push('FACTURAE-CUOTA', 'warning', 'vasco', 'internal', `cuota ${amt} ≠ ${rate}% × ${base}`, { code: 'TaxAmount' });
      const lineBase = lineBaseByRate.get(rate.toFixed(2));
      if (lineBase !== undefined && cents(lineBase) !== cents(base) && t('TotalGeneralDiscounts') === 0 && t('TotalGeneralSurcharges') === 0) {
        push('FACTURAE-BASE', 'warning', 'vasco', 'internal', `TaxableBase ${base} at ${rate}% ≠ Σ lines ${lineBase}`, { code: 'TaxableBase' });
      }
    }
    const installments = kids(at(inv, 'PaymentDetails'), 'Installment');
    if (installments.length) {
      const due = sum(installments, 'InstallmentAmount');
      if (cents(due) !== cents(t('TotalExecutableAmount'))) push('FACTURAE-INSTALLMENT', 'warning', 'vasco', 'internal', `Σ InstallmentAmount ${due} ≠ TotalExecutableAmount ${t('TotalExecutableAmount')}`, { code: 'InstallmentAmount' });
    }
    batchTotal = round2(batchTotal + t('InvoiceTotal'));
    batchOutstanding = round2(batchOutstanding + t('TotalOutstandingAmount'));
    batchExecutable = round2(batchExecutable + t('TotalExecutableAmount'));
  }

  // FileHeader/Batch — Facturae 3.2.2: InvoicesCount, and the three batch
  // totals are the sums of the invoices' own.
  const batch = at(root, 'FileHeader/Batch');
  const modality = textAt(root, 'FileHeader/Modality');
  const count = num(textAt(batch, 'InvoicesCount'));
  if (count !== invoices.length || (modality === 'I' && count !== 1)) push('FACTURAE-BATCH', 'error', 'vasco', 'internal', `InvoicesCount ${count} for ${invoices.length} invoice(s), Modality ${modality}`, { code: 'InvoicesCount' });
  const bt = (p: string) => num(textAt(batch, `${p}/TotalAmount`));
  if (cents(bt('TotalInvoicesAmount')) !== cents(batchTotal)) push('FACTURAE-BATCH', 'error', 'vasco', 'internal', `Batch TotalInvoicesAmount ${bt('TotalInvoicesAmount')} ≠ Σ InvoiceTotal ${batchTotal}`, { code: 'TotalInvoicesAmount' });
  if (cents(bt('TotalOutstandingAmount')) !== cents(batchOutstanding)) push('FACTURAE-BATCH', 'error', 'vasco', 'internal', `Batch TotalOutstandingAmount ${bt('TotalOutstandingAmount')} ≠ ${batchOutstanding}`, { code: 'TotalOutstandingAmount' });
  if (cents(bt('TotalExecutableAmount')) !== cents(batchExecutable)) push('FACTURAE-BATCH', 'error', 'vasco', 'internal', `Batch TotalExecutableAmount ${bt('TotalExecutableAmount')} ≠ ${batchExecutable}`, { code: 'TotalExecutableAmount' });
  return out;
}
