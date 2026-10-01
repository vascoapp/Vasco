// The ZUGFeRD (DE) and Factur-X (FR) buttons hand over the PDF/A-3 hybrid —
// the format IS the container — never the bare CII XML, and never a PDF the
// validators were not run on (2026-10-01; npm run check:pdfa3). XRechnung stays
// the UBL XML. The hybrid keeps the tier gate, the "did you file it?" question
// and the document-number file name.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'invoices', '[id].tsx'), 'utf8'));
const handler = (() => {
  const start = src.indexOf('const handleExportEInvoice = async');
  const end = src.indexOf('const buildEInvoiceSource', start);
  return src.slice(start, end);
})();
const share = (() => {
  const start = src.indexOf('const shareEInvoiceThenConfirm = async');
  return src.slice(start, src.indexOf('const handleExportEInvoice', start));
})();

describe('ZUGFeRD / Factur-X export shares the PDF/A-3 hybrid', () => {
  it('builds the hybrid through the validated module and shares its bytes, named by document number', () => {
    expect(handler).toMatch(/buildPdfA3Invoice\(/);
    expect(handler).toMatch(/profile:\s*isFacturX\s*\?\s*'facturx'\s*:\s*'zugferd'/);
    expect(handler).toMatch(/shareEInvoiceThenConfirm\(hybrid\.xml,\s*pdfFileName\(data\.invoiceNumber\),\s*effectiveFormat,\s*hybrid\.bytes\)/);
  });

  it('never generates bare CII for these formats any more', () => {
    expect(handler).not.toMatch(/generateZUGFeRDXML|generateFacturXXML|generateCIIXML/);
  });

  it('keeps XRechnung as the UBL XML, behind its buyer-address refusal', () => {
    expect(handler).toMatch(/generateXRechnungXML\(data\)/);
    expect(handler).toMatch(/format === 'XRechnung' && !data\.leitwegId && !data\.buyerEmail/);
  });

  it('keeps the tier gate', () => {
    expect(handler).toMatch(/canUseEInvoiceFormat\(sub,/);
  });

  it('shares a PDF as application/pdf with no XML fallback, then asks whether it was filed', () => {
    expect(share).toMatch(/mimeType:\s*'application\/pdf'/);
    const pdfBranch = share.slice(share.indexOf('if (pdf)'), share.indexOf('} else try'));
    expect(pdfBranch).not.toMatch(/RNShare\.share/);
    expect(share).toMatch(/markEInvoiceSubmitted\(invoice\.id\)/);
  });

  it('an approved queue action (?submit=einvoice) produces the Factur-X hybrid in France', () => {
    const dispatch = src.slice(src.indexOf('fireSubmitRef.current = async'));
    expect(dispatch).toMatch(/if \(country === 'FR'\) return await handleExportEInvoice\('ZUGFeRD'\);/);
  });

  it('offers the button in Germany and France', () => {
    expect(src).toMatch(/country === 'DE' && \(\s*<ActionRow[\s\S]*?invoices\.exportZugferd[\s\S]*?handleExportEInvoice\('ZUGFeRD'\)/);
    expect(src).toMatch(/country === 'FR' && \(\s*<ActionRow[\s\S]*?invoices\.exportFacturX[\s\S]*?handleExportEInvoice\('ZUGFeRD'\)/);
  });
});
