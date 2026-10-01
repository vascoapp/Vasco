/**
 * The ZUGFeRD / Factur-X hybrid, read back from its BYTES.
 *
 * The authority's verdict is `npm run check:pdfa3` (veraPDF + Mustang, Java).
 * This suite is the no-Java pin on the structural facts those validators
 * accepted, so a refactor that drops one fails here first:
 *   XMP (pdfaid 3/B, fx schema + its extension description), the embedded
 *   factur-x.xml with /AFRelationship /Alternative in /AF and the name tree,
 *   the XML byte-equal to the generator's, the sRGB OutputIntent, the trailer
 *   ID, embedded fonts — and the TOTALS the page prints, extracted through the
 *   fonts' own ToUnicode maps, equal to documentVatBreakdown and to the XML.
 */
import fs from 'fs';
import path from 'path';
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
} from 'pdf-lib';
import {
  assertTotalsMatchXml,
  buildPdfA3Invoice,
  formatMoney,
  HYBRID_XML_FILENAME,
  hybridTotals,
  type HybridProfile,
} from '../pdfA3Invoice';
import { generateCIIXML, generateFacturXXML, type EInvoiceData } from '../einvoice';
import { documentFallbackRate, documentVatBreakdown } from '../../domain/business';
import { SRGB_ICC_BASE64 } from '../srgbIccProfile';
import fontkit from '@pdf-lib/fontkit';

const font = (w: string) => new Uint8Array(fs.readFileSync(path.join(
  __dirname, '..', '..', '..', 'node_modules', '@expo-google-fonts', 'inter', w, `Inter_${w}.ttf`)));
const fonts = { regular: font('400Regular'), bold: font('700Bold') };
const NOW = new Date('2026-09-30T10:00:00Z');

type L = { description: string; quantity: number; unitPrice: number; vatRate: number };
function invoice(country: 'DE' | 'FR', lines: L[], extra: Partial<EInvoiceData> = {}): EInvoiceData {
  return {
    sellerName: country === 'DE' ? 'Sanitär Bergmann GmbH' : 'Plomberie Durand SARL',
    sellerAddress: 'Hauptstraße 14', sellerVatId: country === 'DE' ? 'DE123456789' : 'FR32123456789',
    sellerCity: 'Köln', sellerPostalCode: '50667', sellerCountry: country, sellerEmail: 'a@b.de',
    buyerName: 'Bäckerei Lindner GmbH', buyerAddress: 'Marktplatz 3', buyerCity: 'Köln', buyerPostalCode: '50676',
    buyerEmail: 'r@l.de', invoiceNumber: 'RE-2026-0087', invoiceDate: '2026-09-30', dueDate: '2026-10-30',
    currency: 'EUR', iban: 'DE89370400440532013000',
    lineItems: lines.map((l) => ({ ...l, unitCode: 'piece', vatAmount: 0, lineTotal: l.quantity * l.unitPrice })),
    totalNet: 0, totalVat: 0, totalGross: 0, sellerVatExempt: false,
    ...extra,
  };
}
const MIXED: L[] = [
  { description: 'Arbeitszeit', quantity: 1.333, unitPrice: 55, vatRate: 19 },
  { description: 'Kupferrohr 15 mm', quantity: 2.5, unitPrice: 12.99, vatRate: 19 },
  { description: 'Fachbuch', quantity: 1.125, unitPrice: 9.99, vatRate: 7 },
];

// ── reading a PDF back ──
const bytesOf = (s: PDFStream) =>
  s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : (s as any).getContents() as Uint8Array;
const latin = (b: Uint8Array) => Buffer.from(b).toString('utf8');

/** Every string drawn on every page, decoded through the font's ToUnicode CMap. */
function pageText(doc: PDFDocument): string {
  const out: string[] = [];
  for (const page of doc.getPages()) {
    const fontsDict = page.node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
    const cmaps = new Map<string, Map<string, string>>();
    for (const [name, ref] of fontsDict.entries()) {
      const f = doc.context.lookup(ref as PDFRef, PDFDict);
      const cmap = latin(bytesOf(f.lookup(PDFName.of('ToUnicode'), PDFStream)));
      const m = new Map<string, string>();
      for (const [, cid, uni] of cmap.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
        const cps: number[] = [];
        for (let i = 0; i < uni.length; i += 4) cps.push(parseInt(uni.slice(i, i + 4), 16));
        m.set(cid.toUpperCase().padStart(4, '0'), String.fromCharCode(...cps));
      }
      cmaps.set(name.asString(), m);
    }
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray
      ? contents.asArray().map((r) => doc.context.lookup(r as PDFRef, PDFStream))
      : [contents as PDFStream];
    for (const s of streams) {
      let current = new Map<string, string>();
      for (const tok of latin(bytesOf(s)).matchAll(/(\/\S+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>\s*Tj/g)) {
        if (tok[1]) { current = cmaps.get(tok[1]) ?? new Map(); continue; }
        const hex = tok[2].toUpperCase();
        let s2 = '';
        for (let i = 0; i < hex.length; i += 4) s2 += current.get(hex.slice(i, i + 4)) ?? '�';
        out.push(s2);
      }
    }
  }
  return out.join('\n');
}

function embeddedXml(doc: PDFDocument): { spec: PDFDict; xml: string } {
  const af = doc.catalog.lookup(PDFName.of('AF'), PDFArray);
  const spec = doc.context.lookup(af.get(0), PDFDict);
  const ef = spec.lookup(PDFName.of('EF'), PDFDict);
  const stream = ef.lookup(PDFName.of('F'), PDFStream);
  return { spec, xml: latin(bytesOf(stream)) };
}

function xmpOf(doc: PDFDocument): string {
  const meta = doc.catalog.lookup(PDFName.of('Metadata'), PDFStream);
  // ISO 19005: the metadata stream is not filtered — read it RAW.
  expect(meta.dict.get(PDFName.of('Filter'))).toBeUndefined();
  return latin((meta as any).getContents());
}

async function make(profile: HybridProfile, data: EInvoiceData, language: string) {
  const res = await buildPdfA3Invoice(data, { profile, language, fonts, now: NOW, mentions: ['Test mention'] });
  const doc = await PDFDocument.load(res.bytes, { updateMetadata: false });
  return { res, doc };
}

describe('PDF/A-3b hybrid — structure', () => {
  let doc: PDFDocument;
  let xmlOut: string;
  const data = invoice('DE', MIXED);
  beforeAll(async () => { const m = await make('zugferd', data, 'de'); doc = m.doc; xmlOut = m.res.xml; });

  it('declares PDF/A-3 conformance B in XMP', () => {
    const xmp = xmpOf(doc);
    expect(xmp).toMatch(/<pdfaid:part>3<\/pdfaid:part>/);
    expect(xmp).toMatch(/<pdfaid:conformance>B<\/pdfaid:conformance>/);
    expect(xmp).toContain('<?xpacket end="w"?>');
  });

  it('carries the Factur-X fx schema AND its PDF/A extension-schema description', () => {
    const xmp = xmpOf(doc);
    expect(xmp).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>');
    expect(xmp).toContain(`<fx:DocumentFileName>${HYBRID_XML_FILENAME}</fx:DocumentFileName>`);
    expect(xmp).toContain('<fx:Version>1.0</fx:Version>');
    expect(xmp).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>');
    expect(xmp).toContain('<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>');
    for (const p of ['DocumentFileName', 'DocumentType', 'Version', 'ConformanceLevel']) {
      expect(xmp).toContain(`<pdfaProperty:name>${p}</pdfaProperty:name>`);
    }
  });

  it('embeds factur-x.xml with AFRelationship /Alternative, in /AF and the EmbeddedFiles tree', () => {
    const { spec } = embeddedXml(doc);
    expect(spec.lookup(PDFName.of('F'), PDFString).decodeText()).toBe('factur-x.xml');
    expect(spec.lookup(PDFName.of('UF'), PDFHexString).decodeText()).toBe('factur-x.xml');
    expect(spec.get(PDFName.of('AFRelationship'))).toBe(PDFName.of('Alternative'));
    const ef = spec.lookup(PDFName.of('EF'), PDFDict).lookup(PDFName.of('F'), PDFStream);
    expect(ef.dict.get(PDFName.of('Subtype'))).toBe(PDFName.of('text/xml'));
    expect(ef.dict.lookup(PDFName.of('Params'), PDFDict).get(PDFName.of('ModDate'))).toBeDefined();
    const names = doc.catalog.lookup(PDFName.of('Names'), PDFDict)
      .lookup(PDFName.of('EmbeddedFiles'), PDFDict).lookup(PDFName.of('Names'), PDFArray);
    expect(names.lookup(0, PDFString).decodeText()).toBe('factur-x.xml');
    expect(doc.context.lookup(names.get(1))).toBe(spec);
  });

  it('the XML inside is byte-for-byte what the generator makes', () => {
    expect(embeddedXml(doc).xml).toBe(generateCIIXML(data));
    expect(xmlOut).toBe(generateCIIXML(data));
  });

  it('has an sRGB OutputIntent with the ICC profile embedded', () => {
    const intents = doc.catalog.lookup(PDFName.of('OutputIntents'), PDFArray);
    const oi = intents.lookup(0, PDFDict);
    expect(oi.get(PDFName.of('S'))).toBe(PDFName.of('GTS_PDFA1'));
    const icc = oi.lookup(PDFName.of('DestOutputProfile'), PDFStream);
    expect(icc.dict.get(PDFName.of('N'))?.toString()).toBe('3');
    expect(Buffer.from(bytesOf(icc)).equals(Buffer.from(SRGB_ICC_BASE64, 'base64'))).toBe(true);
  });

  it('has a trailer /ID and Info that matches the XMP', () => {
    const id = doc.context.trailerInfo.ID as PDFArray | undefined;
    expect(id).toBeInstanceOf(PDFArray);
    expect(id!.size()).toBe(2);
    expect(id!.lookup(0, PDFHexString).asString()).toMatch(/^[0-9A-F]{32}$/);
    const xmp = xmpOf(doc);
    expect(xmp).toContain(`<rdf:li xml:lang="x-default">${doc.getTitle()}</rdf:li>`);
    expect(xmp).toContain(`<pdf:Producer>${doc.getProducer()}</pdf:Producer>`);
    expect(xmp).toContain('<xmp:CreateDate>2026-09-30T10:00:00Z</xmp:CreateDate>');
    expect(doc.getCreationDate()?.toISOString()).toBe('2026-09-30T10:00:00.000Z');
  });

  it('every glyph the page draws has an outline in the embedded font program', () => {
    // veraPDF AND Mustang called the first version compliant while most of its
    // text did not render: pdf-lib's fontkit SUBSET of Inter kept the glyph ids
    // and lost the outlines ("RECHNUNG" drew as "EC"). PDF/A checks that a
    // font is embedded, not that it draws. This reads each embedded program
    // back and asks every drawn glyph for its path.
    let checked = 0;
    for (const page of doc.getPages()) {
      const fontsDict = page.node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
      const programs = new Map<string, any>();
      const cmaps = new Map<string, Map<string, string>>();
      for (const [name, ref] of fontsDict.entries()) {
        const f = doc.context.lookup(ref as PDFRef, PDFDict);
        const cid = f.lookup(PDFName.of('DescendantFonts'), PDFArray).lookup(0, PDFDict);
        const file = cid.lookup(PDFName.of('FontDescriptor'), PDFDict).lookup(PDFName.of('FontFile2'), PDFStream);
        programs.set(name.asString(), fontkit.create(Buffer.from(bytesOf(file))));
        const m = new Map<string, string>();
        for (const [, code, uni] of latin(bytesOf(f.lookup(PDFName.of('ToUnicode'), PDFStream))).matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
          m.set(code.toUpperCase().padStart(4, '0'), String.fromCharCode(parseInt(uni.slice(0, 4), 16)));
        }
        cmaps.set(name.asString(), m);
      }
      const contents = page.node.Contents();
      const streams = contents instanceof PDFArray
        ? contents.asArray().map((r) => doc.context.lookup(r as PDFRef, PDFStream))
        : [contents as PDFStream];
      for (const s of streams) {
        let fontName = '';
        for (const tok of latin(bytesOf(s)).matchAll(/(\/\S+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>\s*Tj/g)) {
          if (tok[1]) { fontName = tok[1]; continue; }
          const program = programs.get(fontName);
          for (let i = 0; i < tok[2].length; i += 4) {
            const code = tok[2].slice(i, i + 4).toUpperCase();
            const ch = cmaps.get(fontName)?.get(code) ?? '';
            if (/\s/.test(ch) || ch === '') continue;
            const glyph = program.getGlyph(parseInt(code, 16));
            expect([ch, glyph.path.commands.length > 0]).toEqual([ch, true]);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('embeds every font it uses (FontFile2)', () => {
    const fontsDict = doc.getPages()[0].node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
    expect(fontsDict.entries().length).toBeGreaterThan(0);
    for (const [, ref] of fontsDict.entries()) {
      const f = doc.context.lookup(ref as PDFRef, PDFDict);
      const cid = f.lookup(PDFName.of('DescendantFonts'), PDFArray).lookup(0, PDFDict);
      expect(cid.lookup(PDFName.of('FontDescriptor'), PDFDict).get(PDFName.of('FontFile2'))).toBeDefined();
    }
  });
});

describe('PDF/A-3b hybrid — the page states the XML\'s money', () => {
  const cases: Array<[string, HybridProfile, EInvoiceData, string]> = [
    ['DE mixed 19/7 with sub-cent lines', 'zugferd', invoice('DE', MIXED), 'de'],
    ['FR mixed 20/10/5.5', 'facturx', invoice('FR', [
      { description: "Main-d'œuvre", quantity: 1.333, unitPrice: 55, vatRate: 10 },
      { description: 'Raccords', quantity: 2.5, unitPrice: 12.99, vatRate: 20 },
      { description: 'Rénovation', quantity: 1.125, unitPrice: 9.99, vatRate: 5.5 }]), 'fr'],
    ['DE Kleinunternehmer 0 % (E)', 'zugferd', invoice('DE', [
      { description: 'Wartung', quantity: 2.5, unitPrice: 48, vatRate: 0 }], { sellerVatExempt: true }), 'de'],
  ];

  it.each(cases)('%s', async (_name, profile, data, lang) => {
    const { res, doc } = await make(profile, data, lang);
    const lines = data.lineItems.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate }));
    const b = documentVatBreakdown(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), lines, documentFallbackRate(lines, 0));
    expect(res.totals.net).toBe(b.net);
    expect(res.totals.vat).toBe(b.vat);
    expect(res.totals.gross).toBe(b.gross);

    const text = pageText(doc);
    const money = (n: number) => formatMoney(n, '€', lang as any);
    expect(text).toContain(money(b.net));
    expect(text).toContain(money(b.gross));
    for (const g of b.groups) expect(text).toContain(money(g.vat));
    // …and the XML says the same.
    const xml = embeddedXml(doc).xml;
    expect(xml).toContain(`<ram:GrandTotalAmount>${b.gross.toFixed(2)}</ram:GrandTotalAmount>`);
    expect(xml).toContain(`<ram:TaxBasisTotalAmount>${b.net.toFixed(2)}</ram:TaxBasisTotalAmount>`);
    expect(xml).toBe(profile === 'facturx' ? generateFacturXXML(data) : generateCIIXML(data));
  });

  it('prints post code and city once — not again when the address line already has them', async () => {
    const one = pageText((await make('zugferd', invoice('DE', [{ description: 'Wartung', quantity: 1, unitPrice: 48, vatRate: 19 }],
      { sellerAddress: 'Aachener Straße 128, 50674 Köln', sellerPostalCode: '50674', sellerCity: 'Köln' }), 'de')).doc);
    expect(one.split('50674').length - 1).toBe(1);
    // A plain street line still gets its post code and city.
    const two = pageText((await make('zugferd', invoice('DE', [{ description: 'Wartung', quantity: 1, unitPrice: 48, vatRate: 19 }]), 'de')).doc);
    expect(two).toContain('50667 Köln');
    expect(two).toContain('50676 Köln');
  });

  it('prints the exemption reason on a small-business invoice', async () => {
    const { doc } = await make('zugferd', invoice('DE', [{ description: 'Wartung', quantity: 1, unitPrice: 48, vatRate: 0 }], { sellerVatExempt: true }), 'de');
    expect(pageText(doc)).toContain('§ 19 UStG');
  });

  it('refuses when the page and the XML would disagree', () => {
    const data = invoice('DE', MIXED);
    const t = hybridTotals(data);
    const xml = generateCIIXML(data);
    expect(() => assertTotalsMatchXml(xml, t)).not.toThrow();
    expect(() => assertTotalsMatchXml(xml, { ...t, gross: t.gross + 0.01 })).toThrow(/GrandTotalAmount/);
  });

  it('draws a glyph the font lacks as "?" — never .notdef, which PDF/A forbids', async () => {
    const { doc } = await make('zugferd', invoice('DE', [{ description: 'Rohr 漢字', quantity: 1, unitPrice: 10, vatRate: 19 }]), 'de');
    const text = pageText(doc);
    expect(text).toContain('Rohr ??');
    expect(text).not.toContain('�');
  });
});
