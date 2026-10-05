import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { buildPdfA3Invoice, HybridProfile } from '../src/integrations/pdfA3Invoice';
import { documentVatBreakdown } from '../src/domain/business';
import { FR_STATUTORY_NOTES } from '../src/integrations/einvoice';
// Sample ZUGFeRD (DE) / Factur-X (FR) hybrids for the official validators
// (npm run check:pdfa3), produced by the REAL module the app ships — the same
// function, the same fonts. Three cases per country: single rate, mixed rates
// with sub-cent lines, and the small-business 0 % (category E) invoice.
const OUT = process.argv[2];
const font = (w: string) => new Uint8Array(readFileSync(path.join(
  __dirname, '..', 'node_modules', '@expo-google-fonts', 'inter', w, `Inter_${w}.ttf`)));
const fonts = { regular: font('400Regular'), bold: font('700Bold') };

const parties = {
  DE: {
    sellerName: 'Sanitär Bergmann GmbH', sellerAddress: 'Hauptstraße 14', sellerVatId: 'DE123456789',
    sellerCity: 'Köln', sellerPostalCode: '50667', sellerCountry: 'DE', sellerContactName: 'Thomas Bergmann',
    sellerPhone: '+49 221 1234567', sellerEmail: 'buero@bergmann-sanitaer.de',
    buyerName: 'Bäckerei Lindner GmbH', buyerAddress: 'Marktplatz 3', buyerCity: 'Köln', buyerPostalCode: '50676', buyerCountry: 'DE',
    buyerEmail: 'rechnung@baeckerei-lindner.de', deliveryDate: '2026-09-28',
    invoiceNumber: 'RE-2026-0087', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
    iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', paymentReference: 'RE-2026-0087',
  },
  FR: {
    sellerName: 'Plomberie Durand SARL', sellerAddress: '12 rue de la République', sellerVatId: 'FR32123456789',
    sellerCity: 'Lyon', sellerPostalCode: '69002', sellerCountry: 'FR', sellerContactName: 'Élodie Durand',
    sellerLegalRegistrationId: '123456789', sellerLegalRegistrationScheme: '0002',
    sellerPhone: '+33 4 72 00 00 00', sellerEmail: 'contact@plomberie-durand.fr',
    buyerName: 'Boulangerie Lefèvre SAS', buyerAddress: '8 place Bellecour', buyerCity: 'Lyon', buyerPostalCode: '69002', buyerCountry: 'FR',
    buyerVatId: 'FR83404833048', buyerEmail: 'factures@boulangerie-lefevre.fr', deliveryDate: '2026-09-28',
    invoiceNumber: 'F-2026-0142', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
    iban: 'FR7630006000011234567890189', bic: 'AGRIFRPPXXX', paymentReference: 'F-2026-0142',
  },
};
const MENTIONS = {
  DE: ['Als Privatperson sind Sie verpflichtet, diese Rechnung zwei Jahre aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).'],
  FR: FR_STATUTORY_NOTES.map((n) => n.text),
};
type L = { description: string; quantity: number; unitCode: string; unitPrice: number; vatRate: number };
function data(country: 'DE' | 'FR', lines: L[], extra: Record<string, unknown>, fallback: number) {
  const raw = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const b = documentVatBreakdown(raw, lines, fallback);
  return { ...parties[country], ...extra,
    lineItems: lines.map((l) => ({ ...l, vatAmount: 0, lineTotal: l.quantity * l.unitPrice })),
    totalNet: b.net, totalVat: b.vat, totalGross: b.gross } as any;
}
const cases: Array<[string, 'DE' | 'FR', HybridProfile, string, any]> = [
  ['zugferd-single-19', 'DE', 'zugferd', 'de', data('DE', [
    { description: 'Trinkwasserleitung erneuern', quantity: 1, unitCode: 'stuk', unitPrice: 4369.75, vatRate: 19 }], { sellerVatExempt: false }, 19)],
  ['zugferd-mixed-subcent', 'DE', 'zugferd', 'de', data('DE', [
    { description: 'Arbeitszeit Installateur (Meister), inkl. Anfahrt und Entsorgung des Altmaterials', quantity: 1.333, unitCode: 'uur', unitPrice: 55, vatRate: 19 },
    { description: 'Kupferrohr 15 mm', quantity: 2.5, unitCode: 'm', unitPrice: 12.99, vatRate: 19 },
    { description: 'Fachbuch „Sanitärtechnik“', quantity: 1.125, unitCode: 'stuk', unitPrice: 9.99, vatRate: 7 }], { sellerVatExempt: false }, 19)],
  ['zugferd-kleinunternehmer', 'DE', 'zugferd', 'de', data('DE', [
    { description: 'Wartung Heizung', quantity: 2.5, unitCode: 'uur', unitPrice: 48, vatRate: 0 }], { sellerVatExempt: true }, 0)],
  // A sole trader with only a Steuernummer (BT-32 + BT-29), 2026-10-06.
  ['zugferd-steuernummer-only', 'DE', 'zugferd', 'de', data('DE', [
    { description: 'Heizungswartung', quantity: 1, unitCode: 'stuk', unitPrice: 189.5, vatRate: 19 }], { sellerVatExempt: false, sellerVatId: '', sellerTaxNumber: '217/5814/0815' }, 19)],
  // Multi-page: the table breaks, the header row repeats, the totals block
  // moves to a page with room, every page carries the footer.
  ['zugferd-multipage', 'DE', 'zugferd', 'de', data('DE', Array.from({ length: 40 }, (_, i) => (
    { description: `Position ${i + 1}: Montage Heizkörperventil inkl. Material`, quantity: 1 + (i % 3) * 0.5, unitCode: 'stuk', unitPrice: 17.49 + i, vatRate: i % 5 === 0 ? 7 : 19 })), { sellerVatExempt: false }, 19)],
  ['facturx-single-20', 'FR', 'facturx', 'fr', data('FR', [
    { description: 'Remplacement chauffe-eau', quantity: 1, unitCode: 'stuk', unitPrice: 1890, vatRate: 20 }], { sellerVatExempt: false }, 20)],
  ['facturx-mixed-subcent', 'FR', 'facturx', 'fr', data('FR', [
    { description: "Main-d'œuvre plombier", quantity: 1.333, unitCode: 'uur', unitPrice: 55, vatRate: 10 },
    { description: 'Raccords cuivre', quantity: 2.5, unitCode: 'stuk', unitPrice: 12.99, vatRate: 20 },
    { description: 'Travaux de rénovation énergétique', quantity: 1.125, unitCode: 'stuk', unitPrice: 9.99, vatRate: 5.5 }], { sellerVatExempt: false }, 20)],
  ['facturx-franchise', 'FR', 'facturx', 'fr', data('FR', [
    { description: 'Entretien chaudière', quantity: 2.5, unitCode: 'uur', unitPrice: 48, vatRate: 0 }], { sellerVatExempt: true }, 0)],
];
(async () => {
  for (const [name, country, profile, language, d] of cases) {
    const { bytes } = await buildPdfA3Invoice(d, {
      profile, language, fonts, mentions: MENTIONS[country], now: new Date('2026-09-30T10:00:00Z'),
    });
    writeFileSync(`${OUT}/${name}.pdf`, bytes);
  }
  console.log('written', cases.length);
})().catch((e) => { console.error(e); process.exit(1); });
