/**
 * ZUGFeRD (DE) / Factur-X (FR) hybrid invoice: a PDF/A-3b that renders the
 * invoice itself AND carries the CII XML as `factur-x.xml`.
 *
 * Why this is its own renderer and not the expo-print PDF with the XML bolted
 * on (learnings #277): a WebView-printed PDF has no OutputIntent, no
 * guaranteed font embedding and no PDF/A identification — attaching the XML
 * to it yields a file that LOOKS like a ZUGFeRD and fails PDF/A validation.
 * Everything a PDF/A-3b needs is written here explicitly:
 *
 *   · every font embedded (subset) — Inter, read by the caller as bytes;
 *   · DeviceRGB only, under an sRGB OutputIntent with the ICC profile embedded
 *     (srgbIccProfile.ts, CC0);
 *   · XMP metadata: pdfaid part 3 / conformance B, the Factur-X `fx:` schema
 *     and its PDF/A extension-schema description, Info ↔ XMP kept identical;
 *   · a trailer /ID, no object streams, uncompressed metadata stream;
 *   · the XML as an embedded file with /AFRelationship, referenced from the
 *     catalog's /AF array and its EmbeddedFiles name tree.
 *
 * PURE: no React Native import. The app reads the font bytes
 * (src/services/pdfA3Fonts.ts); node scripts and jest read them from disk.
 * That is also what lets `npm run check:pdfa3` hand the very bytes this module
 * makes to veraPDF and Mustang — the authority's tools, not ours (#383).
 *
 * The printed totals come from `documentVatBreakdown` — the repo's ONE VAT
 * rule (EN 16931: lines in cents → base per rate → VAT per rate) — and are
 * checked against the XML's own header sums before a byte is returned. A
 * hybrid whose paper and XML disagree is two invoices under one number; this
 * refuses rather than produce one.
 */
import {
  PDFArray,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFString,
  rgb,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  EInvoiceData,
  exemptionReasonFor,
  generateCIIXML,
  generateFacturXXML,
  taxCategoryFor,
} from './einvoice';
import { documentFallbackRate, documentVatBreakdown, round2, VatRateGroup } from '../domain/business';
import { SRGB_ICC_BASE64 } from './srgbIccProfile';

// ── Public API ───────────────────────────────────────────────────────────────

export type HybridProfile = 'zugferd' | 'facturx';
export type HybridLanguage = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

/** TrueType bytes. Inter 400 + 700 in the app; anything with Latin-1 works. */
export interface PdfA3Fonts {
  regular: Uint8Array;
  bold: Uint8Array;
}

export interface PdfA3InvoiceOptions {
  /** `zugferd` = ZUGFeRD 2.x EN 16931 (DE); `facturx` = Factur-X 1.0 EN 16931 (FR). */
  profile: HybridProfile;
  /** Language of the printed labels. Unknown → English. */
  language?: string;
  fonts: PdfA3Fonts;
  /** Statutory mentions printed under the totals (FR L441-10, DE § 14b …). */
  mentions?: string[];
  /** Fixed clock for reproducible output (tests, samples). */
  now?: Date;
}

export interface PdfA3InvoiceResult {
  bytes: Uint8Array;
  /** Exactly the bytes embedded as factur-x.xml, as a string. */
  xml: string;
  /** What the PDF prints — equal to the XML header sums by construction. */
  totals: { net: number; vat: number; gross: number; groups: VatRateGroup[] };
}

/** The attachment name both ZUGFeRD 2.1+ and Factur-X 1.0 require. */
export const HYBRID_XML_FILENAME = 'factur-x.xml';

/**
 * /AFRelationship of the embedded XML: `Alternative`.
 *
 * Factur-X 1.0 / ZUGFeRD 2.x allow Data, Source or Alternative. The spec
 * (Factur-X 1.07.2 § "PDF/A-3 embedded file", identical in ZUGFeRD 2.3):
 * "If the XML structured file and the visual representation contain strictly
 * the same invoicing information and constitute two alternative presentations
 * of an identical invoice content, the value Alternative must be used" — and
 * for Germany it is mandatory with the BASIC, EN 16931, EXTENDED and XRECHNUNG
 * profiles. That is exactly this file: the page is rendered FROM the XML's
 * data and its totals are asserted equal to the XML's below. One value for
 * both countries; Mustang and veraPDF accepted it (npm run check:pdfa3).
 */
export const HYBRID_AF_RELATIONSHIP = 'Alternative';

/** The Factur-X XMP namespace — ZUGFeRD 2.1+ uses the same one. */
export const FX_NAMESPACE = 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';

/** Which XML the hybrid carries. Same CII generator, profile URN by country. */
export function hybridXml(data: EInvoiceData, profile: HybridProfile): string {
  return profile === 'facturx' ? generateFacturXXML(data) : generateCIIXML(data);
}

/**
 * The printed figures: the repo's VAT rule over the lines the XML carries.
 * A document whose lines are all 0 % (Kleinunternehmer / franchise en base /
 * zero-rated) gets one 0 % row on its net, as the XML's BG-23 has.
 */
export function hybridTotals(data: EInvoiceData): PdfA3InvoiceResult['totals'] {
  const lines = data.lineItems.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate }));
  const raw = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const b = documentVatBreakdown(raw, lines, documentFallbackRate(lines, 0));
  const groups = b.groups.length > 0 || lines.length === 0
    ? b.groups
    : [{ ratePct: 0, net: b.net, vat: 0 }];
  return { net: b.net, vat: b.vat, gross: b.gross, groups };
}

export async function buildPdfA3Invoice(
  data: EInvoiceData,
  opts: PdfA3InvoiceOptions,
): Promise<PdfA3InvoiceResult> {
  const xml = hybridXml(data, opts.profile);
  const totals = hybridTotals(data);
  assertTotalsMatchXml(xml, totals);

  const now = truncateToSeconds(opts.now ?? new Date());
  const lang = (['en', 'nl', 'de', 'fr', 'es', 'it'] as const).includes(opts.language as HybridLanguage)
    ? (opts.language as HybridLanguage)
    : 'en';
  const L = LABELS[lang];

  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(opts.fonts.regular, { subset: true });
  const bold = await doc.embedFont(opts.fonts.bold, { subset: true });

  const title = `${L.title} ${data.invoiceNumber}`;
  const author = clean(data.sellerName);
  const producer = 'Vasco (pdf-lib)';
  doc.setTitle(title);
  doc.setAuthor(author);
  doc.setCreator('Vasco');
  doc.setProducer(producer);
  doc.setCreationDate(now);
  doc.setModificationDate(now);

  renderInvoice(doc, data, totals, { L, lang, regular, bold, mentions: opts.mentions ?? [], profile: opts.profile });

  const xmlBytes = utf8(xml);
  const ctx = doc.context;

  // ── Embedded XML (ISO 19005-3 §6.8) ──
  const efStream = ctx.flateStream(xmlBytes, {
    Type: 'EmbeddedFile',
    Subtype: 'text/xml',
    Params: { Size: xmlBytes.length, ModDate: PDFString.fromDate(now), CreationDate: PDFString.fromDate(now) },
  });
  const efRef = ctx.register(efStream);
  const fileSpec = ctx.obj({
    Type: 'Filespec',
    F: PDFString.of(HYBRID_XML_FILENAME),
    UF: PDFHexString.fromText(HYBRID_XML_FILENAME),
    EF: { F: efRef, UF: efRef },
    Desc: PDFString.of(opts.profile === 'facturx' ? 'Factur-X invoice' : 'ZUGFeRD invoice'),
    AFRelationship: HYBRID_AF_RELATIONSHIP,
  });
  const fileSpecRef = ctx.register(fileSpec);
  doc.catalog.set(PDFName.of('AF'), ctx.obj([fileSpecRef]));
  doc.catalog.set(PDFName.of('Names'), ctx.obj({
    EmbeddedFiles: { Names: [PDFString.of(HYBRID_XML_FILENAME), fileSpecRef] },
  }));

  // ── OutputIntent (§6.2.3) ──
  const iccRef = ctx.register(ctx.flateStream(base64ToBytes(SRGB_ICC_BASE64), { N: 3 }));
  doc.catalog.set(PDFName.of('OutputIntents'), ctx.obj([
    ctx.obj({
      Type: 'OutputIntent',
      S: 'GTS_PDFA1',
      OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
      RegistryName: PDFString.of('http://www.color.org'),
      DestOutputProfile: iccRef,
    }),
  ]));

  // ── XMP (§6.6) — uncompressed, Info dictionary mirrored exactly ──
  const xmp = buildXmp({ title, author, producer, creatorTool: 'Vasco', date: now });
  const xmpStream = ctx.stream(utf8(xmp), { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), ctx.register(xmpStream));

  // ── Trailer /ID (§6.1.3) ──
  const id = idFrom(`${xml}|${now.toISOString()}`);
  ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(id), PDFHexString.of(id)]) as PDFArray;

  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, xml, totals };
}

// ── PDF ↔ XML agreement ──────────────────────────────────────────────────────

function xmlAmount(xml: string, tag: string): number {
  const m = new RegExp(`<ram:${tag}(?:\\s[^>]*)?>([^<]+)</ram:${tag}>`).exec(xml);
  if (!m) throw new Error(`hybrid invoice: XML has no ${tag}`);
  return Number(m[1]);
}

/** Throws when what the page prints is not what the XML says. */
export function assertTotalsMatchXml(xml: string, t: PdfA3InvoiceResult['totals']): void {
  const pairs: Array<[string, number]> = [
    ['TaxBasisTotalAmount', t.net],
    ['TaxTotalAmount', t.vat],
    ['GrandTotalAmount', t.gross],
  ];
  for (const [tag, printed] of pairs) {
    const inXml = xmlAmount(xml, tag);
    if (Math.abs(inXml - printed) > 0.001) {
      throw new Error(`hybrid invoice: printed ${tag} ${printed.toFixed(2)} ≠ XML ${inXml.toFixed(2)}`);
    }
  }
}

// ── XMP ──────────────────────────────────────────────────────────────────────

function buildXmp(m: { title: string; author: string; producer: string; creatorTool: string; date: Date }): string {
  const d = m.date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const prop = (name: string, description: string) => `
              <rdf:li rdf:parseType="Resource">
                <pdfaProperty:name>${name}</pdfaProperty:name>
                <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                <pdfaProperty:category>external</pdfaProperty:category>
                <pdfaProperty:description>${description}</pdfaProperty:description>
              </rdf:li>`;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(m.title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${esc(m.author)}</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${esc(m.creatorTool)}</xmp:CreatorTool>
      <xmp:CreateDate>${d}</xmp:CreateDate>
      <xmp:ModifyDate>${d}</xmp:ModifyDate>
      <xmp:MetadataDate>${d}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>${esc(m.producer)}</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="${FX_NAMESPACE}">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${HYBRID_XML_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
        xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>${FX_NAMESPACE}</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>${prop('DocumentFileName', 'The name of the embedded XML document')}${prop('DocumentType', 'The type of the hybrid document in capital letters, e.g. INVOICE or ORDER')}${prop('Version', 'The actual version of the standard applying to the embedded XML document')}${prop('ConformanceLevel', 'The conformance level of the embedded XML document')}
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// ── Rendering ────────────────────────────────────────────────────────────────

interface RenderCtx {
  L: Labels;
  lang: HybridLanguage;
  regular: PDFFont;
  bold: PDFFont;
  mentions: string[];
  profile: HybridProfile;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.067, 0.078, 0.094);
const MUTED = rgb(0.38, 0.41, 0.45);
const ACCENT = rgb(0.761, 0.255, 0.047); // DK primary #C2410C
const RULE = rgb(0.85, 0.86, 0.88);

function renderInvoice(doc: PDFDocument, data: EInvoiceData, totals: PdfA3InvoiceResult['totals'], r: RenderCtx): void {
  const { L, regular, bold } = r;
  const cur = currencySymbol(data.currency);
  const money = (n: number) => formatMoney(n, cur, r.lang);
  const width = A4[0] - 2 * MARGIN;
  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;

  const text = (s: string, x: number, yy: number, size: number, font: PDFFont = regular, color = INK) =>
    page.drawText(fit(s, font), { x, y: yy, size, font, color });
  const right = (s: string, xRight: number, yy: number, size: number, font: PDFFont = regular, color = INK) => {
    const t = fit(s, font);
    page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y: yy, size, font, color });
  };

  // Header: seller name left, document title right.
  text(data.sellerName, MARGIN, y - 4, 15, bold);
  right(L.title.toUpperCase(), A4[0] - MARGIN, y - 4, 20, bold, ACCENT);
  y -= 26;

  // Parties.
  const colW = width / 2 - 12;
  const party = (heading: string, lines: string[], x: number, top: number): number => {
    let yy = top;
    text(heading.toUpperCase(), x, yy, 8, bold, MUTED);
    yy -= 13;
    for (const line of lines.filter(Boolean)) {
      for (const w of wrap(line, regular, 9.5, colW)) { text(w, x, yy, 9.5); yy -= 12.5; }
    }
    return yy;
  };
  const sellerLines = [
    data.sellerName, data.sellerAddress, joinNonEmpty([data.sellerPostalCode, data.sellerCity], ' '),
    data.sellerCountry ?? '',
    data.sellerVatId ? `${L.vatId}: ${data.sellerVatId}` : '',
    data.sellerTaxNumber ? `${L.taxNumber}: ${data.sellerTaxNumber}` : '',
    data.sellerPhone ?? '', data.sellerEmail ?? '',
  ];
  const buyerLines = [
    data.buyerName, data.buyerAddress, joinNonEmpty([data.buyerPostalCode, data.buyerCity], ' '),
    data.buyerCountry ?? '',
    data.buyerVatId ? `${L.vatId}: ${data.buyerVatId}` : '',
    data.leitwegId ? `Leitweg-ID: ${data.leitwegId}` : '',
  ];
  const top = y - 10;
  const y1 = party(L.seller, sellerLines, MARGIN, top);
  const y2 = party(L.buyer, buyerLines, MARGIN + width / 2 + 12, top);
  y = Math.min(y1, y2) - 10;

  // Document facts.
  const facts: Array<[string, string]> = [
    [L.number, data.invoiceNumber],
    [L.issueDate, formatDate(data.invoiceDate, r.lang)],
    ...(data.deliveryDate ? [[L.deliveryDate, formatDate(data.deliveryDate, r.lang)] as [string, string]] : []),
    [L.dueDate, formatDate(data.dueDate, r.lang)],
    ...(data.buyerReference && data.buyerReference !== data.invoiceNumber && data.buyerReference !== data.leitwegId
      ? [[L.buyerReference, data.buyerReference] as [string, string]] : []),
  ];
  const factW = width / facts.length;
  facts.forEach(([k, v], i) => {
    text(k.toUpperCase(), MARGIN + i * factW, y, 7.5, bold, MUTED);
    text(v, MARGIN + i * factW, y - 13, 10, bold);
  });
  y -= 34;

  // Line table.
  const cols = { desc: MARGIN, qty: MARGIN + width * 0.58, price: MARGIN + width * 0.75, vat: MARGIN + width * 0.84, amount: A4[0] - MARGIN };
  const descW = width * 0.55;
  const tableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 5, width, height: 18, color: rgb(0.96, 0.96, 0.97) });
    text(L.description, cols.desc + 4, y, 8, bold, MUTED);
    right(L.quantity, cols.qty + 40, y, 8, bold, MUTED);
    right(L.unitPrice, cols.vat - 8, y, 8, bold, MUTED);
    right(L.vatRate, cols.vat + 30, y, 8, bold, MUTED);
    right(L.amount, cols.amount - 4, y, 8, bold, MUTED);
    y -= 20;
  };
  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - MARGIN;
    text(`${L.title} ${data.invoiceNumber}`, MARGIN, y, 9, bold, MUTED);
    y -= 24;
    tableHeader();
  };
  tableHeader();
  for (const li of data.lineItems) {
    const descLines = wrap(li.description, regular, 9.5, descW);
    const h = descLines.length * 12.5 + 6;
    if (y - h < MARGIN + 40) newPage();
    descLines.forEach((w, i) => text(w, cols.desc + 4, y - i * 12.5, 9.5));
    right(formatNumber(li.quantity, r.lang, 0, 3), cols.qty + 40, y, 9.5);
    right(money(li.unitPrice), cols.vat - 8, y, 9.5);
    right(`${formatNumber(li.vatRate, r.lang, 0, 2)} %`, cols.vat + 30, y, 9.5);
    right(money(round2(li.lineTotal)), cols.amount - 4, y, 9.5);
    y -= h;
    page.drawLine({ start: { x: MARGIN, y: y + 7 }, end: { x: A4[0] - MARGIN, y: y + 7 }, thickness: 0.5, color: RULE });
  }

  // Totals block, kept together.
  const sellerVatExempt = data.sellerVatExempt ?? true;
  const exempt = totals.groups.some((g) => taxCategoryFor(g.ratePct, sellerVatExempt) === 'E');
  const exemptionReason = data.taxExemptionReason ?? exemptionReasonFor(data.sellerCountry);
  const rows = 2 + totals.groups.length + (exempt ? 2 : 0);
  if (y - rows * 15 - 20 < MARGIN + 40) newPage();
  y -= 6;
  const labelX = MARGIN + width * 0.5;
  const row = (k: string, v: string, font: PDFFont = regular, size = 9.5) => {
    text(k, labelX, y, size, font);
    right(v, cols.amount - 4, y, size, font);
    y -= size + 6;
  };
  row(L.net, money(totals.net));
  for (const g of totals.groups) {
    row(`${L.vat} ${formatNumber(g.ratePct, r.lang, 0, 2)} % ${L.on} ${money(g.net)}`, money(g.vat));
  }
  page.drawLine({ start: { x: labelX, y: y + 10 }, end: { x: A4[0] - MARGIN, y: y + 10 }, thickness: 1, color: INK });
  y -= 2;
  row(L.total, money(totals.gross), bold, 12);
  if (exempt) {
    y -= 4;
    for (const w of wrap(exemptionReason, regular, 8.5, width)) { text(w, MARGIN, y, 8.5, regular, MUTED); y -= 11; }
  }

  // Payment.
  const payment = [
    `${L.payBy} ${formatDate(data.dueDate, r.lang)}`,
    data.iban ? `IBAN: ${formatIban(data.iban)}` : '',
    data.bic ? `BIC: ${data.bic}` : '',
    data.paymentReference ? `${L.reference}: ${data.paymentReference}` : '',
  ].filter(Boolean);
  const mentionLines = r.mentions.flatMap((m) => wrap(m, regular, 7.5, width));
  const needed = 30 + payment.length * 12 + mentionLines.length * 10;
  if (y - needed < MARGIN + 20) newPage();
  y -= 14;
  text(L.payment.toUpperCase(), MARGIN, y, 8, bold, MUTED);
  y -= 13;
  for (const p of payment) { text(p, MARGIN, y, 9.5); y -= 12.5; }
  if (mentionLines.length) {
    y -= 8;
    for (const m of mentionLines) { text(m, MARGIN, y, 7.5, regular, MUTED); y -= 10; }
  }

  // Footer on every page: what this file is, and page x / n.
  const pages = doc.getPages();
  const note = r.profile === 'facturx' ? L.hybridNoteFacturX : L.hybridNoteZugferd;
  pages.forEach((p, i) => {
    p.drawText(fit(note, regular), { x: MARGIN, y: MARGIN - 20, size: 7, font: regular, color: MUTED });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(pn, 7), y: MARGIN - 20, size: 7, font: regular, color: MUTED });
  });
}

// ── Labels (six locales) ─────────────────────────────────────────────────────

interface Labels {
  title: string; seller: string; buyer: string; number: string; issueDate: string; dueDate: string;
  deliveryDate: string; buyerReference: string; description: string; quantity: string; unitPrice: string;
  vatRate: string; amount: string; net: string; vat: string; on: string; total: string; payment: string;
  payBy: string; reference: string; vatId: string; taxNumber: string;
  hybridNoteZugferd: string; hybridNoteFacturX: string;
}

export const LABELS: Record<HybridLanguage, Labels> = {
  en: {
    title: 'Invoice', seller: 'From', buyer: 'Bill to', number: 'Invoice no.', issueDate: 'Invoice date',
    dueDate: 'Due date', deliveryDate: 'Service date', buyerReference: 'Your reference', description: 'Description',
    quantity: 'Qty', unitPrice: 'Unit price', vatRate: 'VAT', amount: 'Amount', net: 'Total excl. VAT',
    vat: 'VAT', on: 'on', total: 'Total due', payment: 'Payment', payBy: 'Please pay by', reference: 'Reference',
    vatId: 'VAT no.', taxNumber: 'Tax no.',
    hybridNoteZugferd: 'ZUGFeRD e-invoice (EN 16931) — the structured invoice data is embedded in this PDF as factur-x.xml.',
    hybridNoteFacturX: 'Factur-X e-invoice (EN 16931) — the structured invoice data is embedded in this PDF as factur-x.xml.',
  },
  nl: {
    title: 'Factuur', seller: 'Van', buyer: 'Aan', number: 'Factuurnummer', issueDate: 'Factuurdatum',
    dueDate: 'Vervaldatum', deliveryDate: 'Leveringsdatum', buyerReference: 'Uw referentie', description: 'Omschrijving',
    quantity: 'Aantal', unitPrice: 'Prijs per stuk', vatRate: 'Btw', amount: 'Bedrag', net: 'Totaal excl. btw',
    vat: 'Btw', on: 'over', total: 'Te betalen', payment: 'Betaling', payBy: 'Graag betalen vóór', reference: 'Kenmerk',
    vatId: 'Btw-id', taxNumber: 'Fiscaal nummer',
    hybridNoteZugferd: 'ZUGFeRD e-factuur (EN 16931) — de gestructureerde factuurgegevens zitten in deze pdf als factur-x.xml.',
    hybridNoteFacturX: 'Factur-X e-factuur (EN 16931) — de gestructureerde factuurgegevens zitten in deze pdf als factur-x.xml.',
  },
  de: {
    title: 'Rechnung', seller: 'Rechnungssteller', buyer: 'Rechnungsempfänger', number: 'Rechnungsnummer',
    issueDate: 'Rechnungsdatum', dueDate: 'Fällig am', deliveryDate: 'Leistungsdatum', buyerReference: 'Ihre Referenz',
    description: 'Beschreibung', quantity: 'Menge', unitPrice: 'Einzelpreis', vatRate: 'USt.', amount: 'Betrag',
    net: 'Summe netto', vat: 'USt.', on: 'auf', total: 'Rechnungsbetrag', payment: 'Zahlung',
    payBy: 'Bitte zahlen Sie bis zum', reference: 'Verwendungszweck', vatId: 'USt-IdNr.', taxNumber: 'Steuernummer',
    hybridNoteZugferd: 'ZUGFeRD-E-Rechnung (EN 16931) — die strukturierten Rechnungsdaten sind in diesem PDF als factur-x.xml eingebettet.',
    hybridNoteFacturX: 'Factur-X-E-Rechnung (EN 16931) — die strukturierten Rechnungsdaten sind in diesem PDF als factur-x.xml eingebettet.',
  },
  fr: {
    title: 'Facture', seller: 'Émetteur', buyer: 'Client', number: 'Facture n°', issueDate: 'Date de facture',
    dueDate: 'Échéance', deliveryDate: 'Date de prestation', buyerReference: 'Votre référence', description: 'Désignation',
    quantity: 'Qté', unitPrice: 'Prix unitaire HT', vatRate: 'TVA', amount: 'Montant HT', net: 'Total HT',
    vat: 'TVA', on: 'sur', total: 'Total TTC', payment: 'Règlement', payBy: 'À régler avant le', reference: 'Référence',
    vatId: 'N° TVA', taxNumber: 'SIRET',
    hybridNoteZugferd: 'Facture électronique ZUGFeRD (EN 16931) — les données structurées sont intégrées à ce PDF (factur-x.xml).',
    hybridNoteFacturX: 'Facture électronique Factur-X (EN 16931) — les données structurées sont intégrées à ce PDF (factur-x.xml).',
  },
  es: {
    title: 'Factura', seller: 'Emisor', buyer: 'Cliente', number: 'Factura n.º', issueDate: 'Fecha de factura',
    dueDate: 'Vencimiento', deliveryDate: 'Fecha de prestación', buyerReference: 'Su referencia', description: 'Descripción',
    quantity: 'Cant.', unitPrice: 'Precio unitario', vatRate: 'IVA', amount: 'Importe', net: 'Base imponible',
    vat: 'IVA', on: 'sobre', total: 'Total a pagar', payment: 'Pago', payBy: 'Pagar antes del', reference: 'Referencia',
    vatId: 'NIF-IVA', taxNumber: 'NIF',
    hybridNoteZugferd: 'Factura electrónica ZUGFeRD (EN 16931): los datos estructurados van incluidos en este PDF como factur-x.xml.',
    hybridNoteFacturX: 'Factura electrónica Factur-X (EN 16931): los datos estructurados van incluidos en este PDF como factur-x.xml.',
  },
  it: {
    title: 'Fattura', seller: 'Cedente', buyer: 'Cliente', number: 'Fattura n.', issueDate: 'Data fattura',
    dueDate: 'Scadenza', deliveryDate: 'Data della prestazione', buyerReference: 'Vostro riferimento', description: 'Descrizione',
    quantity: 'Q.tà', unitPrice: 'Prezzo unitario', vatRate: 'IVA', amount: 'Importo', net: 'Imponibile',
    vat: 'IVA', on: 'su', total: 'Totale da pagare', payment: 'Pagamento', payBy: 'Pagare entro il', reference: 'Causale',
    vatId: 'P.IVA', taxNumber: 'C.F.',
    hybridNoteZugferd: 'Fattura elettronica ZUGFeRD (EN 16931): i dati strutturati sono incorporati in questo PDF come factur-x.xml.',
    hybridNoteFacturX: 'Fattura elettronica Factur-X (EN 16931): i dati strutturati sono incorporati in questo PDF come factur-x.xml.',
  },
};

// ── Formatting (no Intl: Hermes lacks parts of it, and this must be identical
//    in node, jest and on device) ───────────────────────────────────────────────

const SEPARATORS: Record<HybridLanguage, { group: string; decimal: string }> = {
  en: { group: ',', decimal: '.' },
  nl: { group: '.', decimal: ',' },
  de: { group: '.', decimal: ',' },
  fr: { group: ' ', decimal: ',' },
  es: { group: '.', decimal: ',' },
  it: { group: '.', decimal: ',' },
};

export function formatNumber(n: number, lang: HybridLanguage, minFrac: number, maxFrac: number): string {
  const sign = n < 0 ? '-' : '';
  const fixed = Math.abs(n).toFixed(maxFrac);
  let [int, frac = ''] = fixed.split('.');
  while (frac.length > minFrac && frac.endsWith('0')) frac = frac.slice(0, -1);
  const { group, decimal } = SEPARATORS[lang];
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${sign}${int}${frac ? decimal + frac : ''}`;
}

export function formatMoney(n: number, symbol: string, lang: HybridLanguage): string {
  const num = formatNumber(round2(n), lang, 2, 2);
  if (lang === 'en') return `${symbol}${num}`;
  if (lang === 'nl') return `${symbol} ${num}`;
  return `${num} ${symbol}`;
}

function currencySymbol(code: string): string {
  return code === 'EUR' ? '€' : code === 'GBP' ? '£' : code === 'USD' ? '$' : code;
}

function formatDate(iso: string, lang: HybridLanguage): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso ?? '';
  const [, y, mo, d] = m;
  if (lang === 'de') return `${d}.${mo}.${y}`;
  if (lang === 'nl') return `${d}-${mo}-${y}`;
  return `${d}/${mo}/${y}`;
}

function formatIban(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

function joinNonEmpty(parts: Array<string | undefined>, sep: string): string {
  return parts.filter((p) => p && p.trim()).join(sep);
}

// ── Text safety ──────────────────────────────────────────────────────────────

/** Control characters out, whitespace runs collapsed. */
function clean(s: string | undefined): string {
  return String(s ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Only glyphs the embedded font HAS. A character it lacks would be drawn as
 * .notdef, which PDF/A forbids (ISO 19005-3 §6.2.11.8) — so it becomes '?'
 * rather than an invalid file. Inter covers Latin-1, Latin Extended, € and £.
 */
function fit(s: string, font: PDFFont): string {
  const set = charsetOf(font);
  let out = '';
  for (const ch of clean(s)) out += set.has(ch.codePointAt(0)!) ? ch : '?';
  return out;
}

const charsets = new WeakMap<PDFFont, Set<number>>();
function charsetOf(font: PDFFont): Set<number> {
  let set = charsets.get(font);
  if (!set) { set = new Set(font.getCharacterSet()); charsets.set(font, set); }
  return set;
}

function wrap(s: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = fit(s, font).split(' ').filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !cur) {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
    }
    // A single word wider than the column is cut, never allowed to overflow.
    while (font.widthOfTextAtSize(cur, size) > maxWidth && cur.length > 1) {
      let cut = cur.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(cur.slice(0, cut), size) > maxWidth) cut--;
      lines.push(cur.slice(0, cut));
      cur = cur.slice(cut);
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// ── Bytes ────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(b64: string): Uint8Array {
  const clean64 = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean64.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < clean64.length ? B64.indexOf(clean64[i + k]) : -1));
    out.push((n[0] << 2) | (n[1] >> 4));
    if (n[2] >= 0) out.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (n[3] >= 0) out.push(((n[2] & 3) << 6) | n[3]);
  }
  return Uint8Array.from(out);
}

/** 16 bytes of hex from a string (FNV-1a ×4) — a file identifier, not a secret. */
function idFrom(s: string): string {
  let hex = '';
  for (let seed = 0; seed < 4; seed++) {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    hex += h.toString(16).padStart(8, '0');
  }
  return hex.toUpperCase();
}

function truncateToSeconds(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 1000) * 1000);
}

