/**
 * THE EVERYDAY CASE, per market — the baseline the app must get right before
 * anything else (user, 2026-10-03: "establish what we can for a basis
 * everyday case").
 *
 * A contractor with a standard VAT registration invoices a domestic customer
 * — a business (B2B) or a private person (B2C) — for labour plus one part, at
 * the standard rate. Nothing special: no reverse charge, no public body, no
 * cross-border, no exemption. Those are handed to the accountant, not modelled.
 *
 * Every identifier is written THE WAY THAT MARKET WRITES IT (a bare partita
 * IVA, a bare NIF, a Steuernummer with slashes, a spaced SIRET/IBAN) and
 * passes its REAL check digit — computed independently of the app's own
 * validators (MOD 11,10 for the USt-IdNr, the TVA key, partita IVA + codice
 * fiscale, DNI/CIF control, BTW mod 11, UK VAT mod 97; IBANs are the
 * registries' own published examples). `alt` is the canonical form, tried
 * only when the native one is refused — so a refusal is recorded AND the rest
 * of the chain is still measured.
 *
 * Expected totals are computed HERE, in cents, by EN 16931 (VAT per rate on
 * the sum of line nets) — not by the app's code.
 */

export type Market = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK';
export type Kind = 'b2b' | 'b2c';

export interface Ident { native: string; alt?: string }

export interface Party {
  name: string;
  street: string;
  postcode: string;
  city: string;
  province?: string;
  email: string;
  phone?: string;
  vatId?: Ident;
  taxId?: Ident;          // codice fiscale / NIF of a person / Steuernummer
  regNo?: Ident;          // KvK / SIRET / Companies House / REA (never HRB for a sole trader)
  iban?: string;
  sdiCode?: string;       // IT: codice destinatario
}

export interface Line { description: string; quantity: number; unitPrice: number }

export interface EverydayCase {
  id: string;             // e.g. "DE-b2b" — the cell
  market: Market;
  kind: Kind;
  language: 'nl' | 'de' | 'fr' | 'es' | 'it' | 'en';
  posture: 'contractor' | 'handwerker' | 'plombier' | 'fontanero' | 'idraulico';
  standardRate: number;   // percent
  seller: Party;
  buyer: Party;
  lines: Line[];
  /** Which files the app should produce for this market. */
  formats: Array<'pdf' | 'xrechnung' | 'zugferd' | 'facturx' | 'facturae' | 'fatturapa'>;
}

const LINES = (labour: string, part: string, rate: number): Line[] => [
  { description: labour, quantity: 6, unitPrice: rate },
  { description: part, quantity: 1, unitPrice: 189.95 },
];

const SELLERS: Record<Market, Party> = {
  NL: {
    name: 'Installatiebedrijf De Vries', street: 'Keizersgracht 100', postcode: '1015 CX', city: 'Amsterdam',
    email: 'info@devries-installatie.nl', phone: '06 12345678',
    vatId: { native: 'NL123456782B01' }, regNo: { native: '12345678' }, iban: 'NL91 ABNA 0417 1643 00',
  },
  DE: {
    // An Einzelunternehmen: no Handelsregister entry, which is the everyday
    // Handwerker. USt-IdNr AND Steuernummer, as most have.
    name: 'Haustechnik Weber', street: 'Hauptstraße 12', postcode: '10115', city: 'Berlin',
    email: 'info@haustechnik-weber.de', phone: '030 1234567',
    vatId: { native: 'DE136695976' }, taxId: { native: '21/815/08150' }, iban: 'DE89 3704 0044 0532 0130 00',
  },
  FR: {
    name: 'Plomberie Martin', street: '12 rue de Rivoli', postcode: '75001', city: 'Paris',
    email: 'contact@plomberie-martin.fr', phone: '01 23 45 67 89',
    vatId: { native: 'FR44732829320' }, regNo: { native: '732 829 320 00074' }, iban: 'FR76 3000 6000 0112 3456 7890 189',
  },
  ES: {
    // An autónomo: the NIF is the DNI, written without "ES".
    name: 'Fontanería García', street: 'Calle Mayor 12', postcode: '28013', city: 'Madrid', province: 'Madrid',
    email: 'info@fontaneriagarcia.es', phone: '612 345 678',
    vatId: { native: '12345678Z', alt: 'ES12345678Z' }, iban: 'ES91 2100 0418 4502 0005 1332',
  },
  IT: {
    // A ditta individuale: partita IVA written bare, the owner's codice fiscale.
    name: 'Idraulica Rossi', street: 'Via Roma 12', postcode: '20121', city: 'Milano', province: 'MI',
    email: 'info@idraulicarossi.it', phone: '02 1234567',
    vatId: { native: '01234567897', alt: 'IT01234567897' }, taxId: { native: 'RSSMRA80A01F205X' }, iban: 'IT60 X054 2811 1010 0000 0123 456',
  },
  UK: {
    name: 'Smith Plumbing Ltd', street: '10 High Street', postcode: 'SW1A 1AA', city: 'London',
    email: 'hello@smithplumbing.co.uk', phone: '020 7946 0000',
    vatId: { native: 'GB 123 4567 82', alt: 'GB123456782' }, regNo: { native: '01234567' },
  },
};

const BUYERS: Record<Market, Record<Kind, Party>> = {
  NL: {
    b2b: { name: 'Bouwbedrijf Jansen B.V.', street: 'Damrak 1', postcode: '1012 LG', city: 'Amsterdam', email: 'inkoop@jansenbouw.nl', vatId: { native: 'NL859843920B01' } },
    b2c: { name: 'Sanne Bakker', street: 'Prinsengracht 263', postcode: '1016 GV', city: 'Amsterdam', email: 'sanne.bakker@example.nl' },
  },
  DE: {
    b2b: { name: 'Müller Bau GmbH', street: 'Friedrichstraße 50', postcode: '10117', city: 'Berlin', email: 'rechnung@muellerbau.de', vatId: { native: 'DE812345673' } },
    b2c: { name: 'Anna Schmidt', street: 'Kastanienallee 7', postcode: '10435', city: 'Berlin', email: 'anna.schmidt@example.de' },
  },
  FR: {
    b2b: { name: 'Bâtiment Dupont SAS', street: '5 avenue de l’Opéra', postcode: '75001', city: 'Paris', email: 'factures@dupont-batiment.fr', vatId: { native: 'FR96552100554' } },
    b2c: { name: 'Claire Moreau', street: '8 rue Oberkampf', postcode: '75011', city: 'Paris', email: 'claire.moreau@example.fr' },
  },
  ES: {
    b2b: { name: 'Construcciones López S.L.', street: 'Gran Vía 30', postcode: '28013', city: 'Madrid', province: 'Madrid', email: 'facturas@construccioneslopez.es', vatId: { native: 'B87654323', alt: 'ESB87654323' } },
    b2c: { name: 'Lucía Fernández', street: 'Calle de Alcalá 45', postcode: '28014', city: 'Madrid', province: 'Madrid', email: 'lucia.fernandez@example.es', vatId: { native: '50123456Q', alt: 'ES50123456Q' } },
  },
  IT: {
    b2b: { name: 'Edilizia Bianchi S.r.l.', street: 'Corso Buenos Aires 20', postcode: '20124', city: 'Milano', province: 'MI', email: 'amministrazione@ediliziabianchi.it', vatId: { native: '07654321095', alt: 'IT07654321095' }, sdiCode: 'M5UXCR1' },
    b2c: { name: 'Giulia Bianco', street: 'Via Dante 3', postcode: '20123', city: 'Milano', province: 'MI', email: 'giulia.bianco@example.it', taxId: { native: 'BNCGLI85M41H501Y' } },
  },
  UK: {
    b2b: { name: 'Thames Builders Ltd', street: '1 Bridge Street', postcode: 'SE1 9GF', city: 'London', email: 'accounts@thamesbuilders.co.uk', vatId: { native: 'GB 987 6543 53', alt: 'GB987654353' } },
    b2c: { name: 'James Taylor', street: '22 Baker Street', postcode: 'NW1 6XE', city: 'London', email: 'james.taylor@example.co.uk' },
  },
};

const META: Record<Market, Pick<EverydayCase, 'language' | 'posture' | 'standardRate' | 'formats'> & { lines: Line[] }> = {
  NL: { language: 'nl', posture: 'contractor', standardRate: 21, formats: ['pdf'], lines: LINES('Arbeidsuren loodgieter', 'Mengkraan badkamer', 62.5) },
  DE: { language: 'de', posture: 'handwerker', standardRate: 19, formats: ['pdf', 'xrechnung', 'zugferd'], lines: LINES('Arbeitszeit Installateur', 'Einhebelmischer Bad', 68) },
  FR: { language: 'fr', posture: 'plombier', standardRate: 20, formats: ['pdf', 'facturx'], lines: LINES('Main-d’œuvre plombier', 'Mitigeur salle de bain', 55) },
  ES: { language: 'es', posture: 'fontanero', standardRate: 21, formats: ['pdf', 'facturae'], lines: LINES('Mano de obra fontanero', 'Grifo monomando baño', 38) },
  IT: { language: 'it', posture: 'idraulico', standardRate: 22, formats: ['pdf', 'fatturapa'], lines: LINES('Manodopera idraulico', 'Miscelatore bagno', 40) },
  // UK runs through the NL demo posture switched to UK in the profile — there
  // is no UK demo account; the country is what the contractor sets.
  UK: { language: 'en', posture: 'contractor', standardRate: 20, formats: ['pdf'], lines: LINES('Plumber labour', 'Bathroom mixer tap', 55) },
};

export const MARKETS: Market[] = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];

export function everydayCase(market: Market, kind: Kind): EverydayCase {
  const m = META[market];
  return {
    id: `${market}-${kind}`, market, kind,
    language: m.language, posture: m.posture, standardRate: m.standardRate, formats: m.formats,
    seller: SELLERS[market], buyer: BUYERS[market][kind], lines: m.lines,
  };
}

/** EN 16931: line net in cents, VAT on the SUM of line nets per rate. Independent of the app. */
export function expectedTotals(c: EverydayCase): { net: number; vat: number; gross: number } {
  const netCents = c.lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPrice * 100), 0);
  const vatCents = Math.round((netCents * c.standardRate) / 100);
  return { net: netCents / 100, vat: vatCents / 100, gross: (netCents + vatCents) / 100 };
}
