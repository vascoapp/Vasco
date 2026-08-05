// ═══════════════════════════════════════════════════════════════════════════
// Verification for the e-invoice validator
// ═══════════════════════════════════════════════════════════════════════════
// This tool tells people whether their legally-required invoice is wrong, so
// its own correctness matters more than most. The cases below are the ones that
// would embarrass us: passing an invoice whose totals do not add up, or failing
// a correct one.
//
// Run: npx tsx scripts/check-validator.ts
// ═══════════════════════════════════════════════════════════════════════════

import { DOMParser } from "@xmldom/xmldom";
import { validateEInvoice, validateXmlString } from "../src/lib/einvoice-validator";

const parse = (xml: string) =>
  new DOMParser().parseFromString(xml, "application/xml") as unknown as Document;

/** A structurally correct XRechnung whose arithmetic is consistent. */
function invoice(opts: { lineNet?: number; stated?: number; vat?: number; gross?: number; payable?: number } = {}) {
  const lineNet = opts.lineNet ?? 100;
  const stated = opts.stated ?? lineNet;
  const vat = opts.vat ?? 21;
  const gross = opts.gross ?? stated + vat;
  const payable = opts.payable ?? gross;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>INV-1</cbc:ID>
  <cbc:IssueDate>2026-08-05</cbc:IssueDate>
  <cbc:DueDate>2026-08-19</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>04011000-12345-67</cbc:BuyerReference>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyName><cbc:Name>Klempner Meier</cbc:Name></cac:PartyName>
    <cac:PostalAddress><cbc:StreetName>Hauptstr 1</cbc:StreetName><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyName><cbc:Name>Kunde GmbH</cbc:Name></cac:PartyName>
    <cac:PostalAddress><cbc:StreetName>Nebenstr 2</cbc:StreetName><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${vat.toFixed(2)}</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${stated.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${stated.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${gross.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${payable.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:LineExtensionAmount currencyID="EUR">${lineNet.toFixed(2)}</cbc:LineExtensionAmount>
  </cac:InvoiceLine>
</Invoice>`;
}

let failures = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\ne-invoice validator");

// A correct invoice must come back clean, or the tool is useless.
{
  const r = validateEInvoice(parse(invoice()));
  const errs = r.findings.filter((f) => f.severity === "error");
  check("a correct XRechnung reports no errors", errs.length === 0, errs.map((e) => e.rule).join(","));
  check("it is recognised as UBL", r.format === "UBL Invoice");
  check("passed checks are listed", r.passed.length > 5, `${r.passed.length}`);
}

// The silent one: lines say 100, totals say 120.
{
  const r = validateEInvoice(parse(invoice({ lineNet: 100, stated: 120, vat: 25.2, gross: 145.2, payable: 145.2 })));
  check("catches line sum ≠ stated total", r.findings.some((f) => f.rule === "BR-CO-10"));
}

// Gross does not equal net + VAT.
{
  const r = validateEInvoice(parse(invoice({ gross: 999 })));
  check("catches gross ≠ net + VAT", r.findings.some((f) => f.rule === "BR-CO-15"));
}

// Deposit subtracted silently instead of declared as prepaid.
{
  const r = validateEInvoice(parse(invoice({ payable: 50 })));
  check("catches amount due ≠ gross less prepayment", r.findings.some((f) => f.rule === "BR-CO-16"));
}

// Missing mandatory field.
{
  const r = validateEInvoice(parse(invoice().replace(/<cbc:ID>INV-1<\/cbc:ID>/, "")));
  check("catches a missing invoice number", r.findings.some((f) => f.rule === "BR-02"));
}

// Not XML at all — the "I exported a PDF" case.
{
  const r = validateXmlString("%PDF-1.7 not xml at all", parse);
  check("rejects a non-XML file with a useful hint", r.findings.some((f) => f.hint?.includes("PDF")));
}

// Right shape, wrong document.
{
  const r = validateEInvoice(parse('<?xml version="1.0"?><Order><a/></Order>'));
  check("rejects a non-invoice XML document", r.findings.some((f) => f.rule === "FORMAT"));
}

// CII must not be silently passed as if fully checked.
{
  const r = validateEInvoice(parse('<?xml version="1.0"?><CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"><a/></CrossIndustryInvoice>'));
  check("flags CII as only partially checked", r.format === "CII (Factur-X/ZUGFeRD)" && r.findings.length > 0);
}

// Rounding must not produce false positives.
{
  const r = validateEInvoice(parse(invoice({ lineNet: 100, stated: 100.004, vat: 21, gross: 121.004, payable: 121.004 })));
  check("tolerates sub-cent rounding", !r.findings.some((f) => f.rule.startsWith("BR-CO")));
}

console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
