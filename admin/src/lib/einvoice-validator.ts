// ═══════════════════════════════════════════════════════════════════════════
// E-INVOICE VALIDATOR — EN 16931 / XRechnung structural + arithmetic checks
// ═══════════════════════════════════════════════════════════════════════════
// What this is: a fast, honest first-pass check that catches the mistakes real
// invoices actually fail on. Missing mandatory fields, and totals that do not
// add up — the arithmetic rules (BR-CO-*) are where hand-built or
// badly-templated invoices break, and they are silent failures: the file looks
// fine and the authority refuses it.
//
// WHAT THIS IS NOT, and the UI says so in the same words: this is NOT a
// certified conformance check. The official validator for XRechnung is KoSIT's,
// which runs the full Schematron rule set. Telling an accountant "valid" on the
// strength of a partial check would be worse than telling them nothing, because
// they would stop looking. So a clean result here is reported as "no problems
// found in the checks below" with the checks listed, never as "compliant".
//
// Rules are referenced by their EN 16931 identifiers (BR-xx, BR-CO-xx) so a
// result can be looked up against the standard rather than taken on trust.
//
// Pure and DOM-agnostic: it takes an already-parsed Document, so it can run in
// the browser against DOMParser without this module knowing anything about the
// page. That matters because the invoice is parsed CLIENT-SIDE and never
// uploaded — a contractor's invoice contains their customer's name, address and
// VAT number, and there is no reason for us to receive any of it.
// ═══════════════════════════════════════════════════════════════════════════

export type Severity = "error" | "warning";

export interface Finding {
  /** EN 16931 / XRechnung rule id where one applies. */
  rule: string;
  severity: Severity;
  message: string;
  /** What to actually do about it. */
  hint?: string;
}

export interface ValidationResult {
  /** Detected document flavour, for the summary line. */
  format: "UBL Invoice" | "CII (Factur-X/ZUGFeRD)" | "unknown";
  profile?: string;
  findings: Finding[];
  /** Checks that passed, so a clean run is not an empty screen. */
  passed: string[];
}

const UBL_CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
const UBL_CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";

/** First matching element's trimmed text, or null. Namespace-aware. */
function text(root: Element | Document, ns: string, local: string): string | null {
  const el = (root as Element).getElementsByTagNameNS
    ? (root as Element).getElementsByTagNameNS(ns, local)[0]
    : undefined;
  const v = el?.textContent?.trim();
  return v && v.length > 0 ? v : null;
}

function all(root: Element | Document, ns: string, local: string): Element[] {
  const list = (root as Element).getElementsByTagNameNS(ns, local);
  return Array.from(list);
}

/**
 * Text of a DIRECT CHILD only.
 *
 * Document-level fields MUST use this. `getElementsByTagNameNS` searches the
 * whole subtree depth-first, and `cbc:ID` appears on every invoice line, on
 * PaymentMeans and inside TaxScheme — so looking document-wide for the invoice
 * number finds a line's ID when the invoice number is absent and reports a
 * PASS on a missing mandatory field. A validator that invents compliance is
 * worse than no validator, and this was caught by the check script rather than
 * by reading.
 */
function childText(root: Element, ns: string, local: string): string | null {
  for (let i = 0; i < root.childNodes.length; i += 1) {
    const n = root.childNodes[i] as Element;
    if (n.nodeType === 1 && n.namespaceURI === ns && n.localName === local) {
      const v = n.textContent?.trim();
      if (v && v.length > 0) return v;
    }
  }
  return null;
}

function num(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Money comparison with a cent of tolerance for rounding. */
function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > 0.011;
}

export function validateEInvoice(doc: Document): ValidationResult {
  const findings: Finding[] = [];
  const passed: string[] = [];

  const root = doc.documentElement;
  if (!root || root.nodeName === "parsererror" || doc.getElementsByTagName("parsererror").length > 0) {
    return {
      format: "unknown",
      findings: [{
        rule: "XML",
        severity: "error",
        message: "This file is not well-formed XML, so nothing else can be checked.",
        hint: "If you exported a PDF, note that a plain PDF is not a structured e-invoice. ZUGFeRD and Factur-X embed the XML inside the PDF — extract that XML and check it here.",
      }],
      passed: [],
    };
  }

  const isUbl = root.localName === "Invoice" || root.localName === "CreditNote";
  const isCii = root.localName === "CrossIndustryInvoice";

  if (isCii) {
    // CII is a genuinely different tree. Rather than half-check it and risk a
    // misleading pass, say plainly what is supported.
    return {
      format: "CII (Factur-X/ZUGFeRD)",
      findings: [{
        rule: "FORMAT",
        severity: "warning",
        message: "This is a CII document (Factur-X / ZUGFeRD). This tool currently checks UBL invoices in depth.",
        hint: "The file parsed correctly as XML, which rules out the most common problem. For full CII rule checking use the official validator for your country.",
      }],
      passed: ["Well-formed XML", "Recognised as CII (Factur-X / ZUGFeRD)"],
    };
  }

  if (!isUbl) {
    return {
      format: "unknown",
      findings: [{
        rule: "FORMAT",
        severity: "error",
        message: `Root element is <${root.localName}>, which is neither a UBL Invoice nor a CII CrossIndustryInvoice.`,
        hint: "An XRechnung is normally a UBL <Invoice>. Check you exported the e-invoice XML rather than another file.",
      }],
      passed: ["Well-formed XML"],
    };
  }

  passed.push("Well-formed XML", "Recognised as a UBL invoice");

  const req = (
    rule: string,
    label: string,
    value: string | null,
    hint?: string,
  ) => {
    if (value) passed.push(`${rule} — ${label}`);
    else findings.push({ rule, severity: "error", message: `Missing: ${label}.`, hint });
  };

  // ── Mandatory content (EN 16931 BR-*) ──────────────────────────────────
  const customization = childText(root, UBL_CBC, "CustomizationID");
  req("BR-01", "Specification identifier (CustomizationID)", customization,
    "This declares which rule set the invoice follows, e.g. the XRechnung 3.0 CIUS. Without it a receiver cannot tell how to validate the file.");
  req("BR-02", "Invoice number", childText(root, UBL_CBC, "ID"));
  req("BR-03", "Issue date", childText(root, UBL_CBC, "IssueDate"));
  req("BR-04", "Invoice type code", childText(root, UBL_CBC, "InvoiceTypeCode"),
    "380 is a commercial invoice; 381 a credit note.");
  req("BR-05", "Invoice currency code", childText(root, UBL_CBC, "DocumentCurrencyCode"));

  const supplier = all(doc, UBL_CAC, "AccountingSupplierParty")[0];
  const customer = all(doc, UBL_CAC, "AccountingCustomerParty")[0];

  // BT-27 / BT-44 bind to cac:PartyLegalEntity/cbc:RegistrationName, NOT to
  // cac:PartyName/cbc:Name — that is BT-28/BT-45, the OPTIONAL trading name.
  //
  // These two used to read `text(supplier, "Name")`, a whole-subtree search
  // that matches the trading name, so an invoice missing the mandatory legal
  // name passed. Exactly the `cbc:ID`-matched-a-line's-ID bug this file already
  // documents above, in a second field — the fix had been applied to
  // document-level IDs and not to names.
  //
  // It was not hypothetical: our own XRechnung generator emitted only
  // PartyName and this validator passed it, on the format the German
  // go-to-market depends on.
  const legalName = (party: Element | undefined) => {
    if (!party) return null;
    const entity = all(party, UBL_CAC, "PartyLegalEntity")[0];
    return entity ? text(entity, UBL_CBC, "RegistrationName") : null;
  };
  req("BR-06", "Seller name (PartyLegalEntity/RegistrationName)", legalName(supplier));
  req("BR-07", "Buyer name (PartyLegalEntity/RegistrationName)", legalName(customer));

  const supplierCountry = supplier
    ? all(supplier, UBL_CAC, "Country").map((c) => text(c, UBL_CBC, "IdentificationCode"))[0] ?? null
    : null;
  const customerCountry = customer
    ? all(customer, UBL_CAC, "Country").map((c) => text(c, UBL_CBC, "IdentificationCode"))[0] ?? null
    : null;
  req("BR-09", "Seller country code", supplierCountry);
  req("BR-11", "Buyer country code", customerCountry);

  // ── VAT breakdown (BG-23) ───────────────────────────────────────────────
  // Every invoice needs at least one breakdown, one per (category, rate) pair,
  // each carrying its taxable amount and tax amount. A bare cac:TaxTotal with
  // only cbc:TaxAmount states a total nobody can check — and it is what our own
  // generator produced until 2026-08-19, so this is a rule with a body count.
  const taxTotalEls = all(doc, UBL_CAC, "TaxTotal");
  const subtotals = taxTotalEls.flatMap((t) => all(t, UBL_CAC, "TaxSubtotal"));
  if (subtotals.length === 0) {
    findings.push({
      rule: "BR-45", severity: "error",
      message: "No VAT breakdown (BG-23). TaxTotal states a total but never breaks it down.",
      hint: "Add a cac:TaxSubtotal per VAT rate, each with cbc:TaxableAmount, cbc:TaxAmount and a cac:TaxCategory (ID, Percent, TaxScheme).",
    });
  } else {
    passed.push(`BR-45 — ${subtotals.length} VAT breakdown${subtotals.length === 1 ? "" : "s"}`);
    subtotals.forEach((st, i) => {
      const label = subtotals.length === 1 ? "" : ` (breakdown ${i + 1})`;
      req(`BR-46${label}`, `VAT category taxable amount${label}`, childText(st, UBL_CBC, "TaxableAmount"));
      req(`BR-47${label}`, `VAT category tax amount${label}`, childText(st, UBL_CBC, "TaxAmount"));
      const cat = all(st, UBL_CAC, "TaxCategory")[0];
      req(`BR-48${label}`, `VAT category code${label}`, cat ? childText(cat, UBL_CBC, "ID") : null);
    });
  }

  // ── XRechnung-only rules (BR-DE-*) ──────────────────────────────────────
  // Only applied when the document declares XRechnung. A plain EN 16931 or
  // Peppol invoice is not wrong for lacking these, and flagging it would be
  // the validator inventing a rule — the mirror of inventing compliance.
  if ((customization ?? "").includes("xrechnung")) {
    req("BR-DE-15", "Buyer reference (BT-10)", childText(root, UBL_CBC, "BuyerReference"),
      "XRechnung makes BT-10 mandatory on EVERY invoice, not only B2G. For a public buyer it is the Leitweg-ID; for B2B it is any reference the buyer can match. Missing BT-10 is the single most common XRechnung rejection.");
    const contact = supplier ? all(supplier, UBL_CAC, "Contact")[0] : undefined;
    req("BR-DE-5", "Seller contact point (BT-41)", contact ? text(contact, UBL_CBC, "Name") : null);
    req("BR-DE-6", "Seller contact telephone (BT-42)", contact ? text(contact, UBL_CBC, "Telephone") : null);
    req("BR-DE-7", "Seller contact email (BT-43)", contact ? text(contact, UBL_CBC, "ElectronicMail") : null);
  }

  // ── Lines ───────────────────────────────────────────────────────────────
  const lines = all(doc, UBL_CAC, "InvoiceLine");
  if (lines.length === 0) {
    findings.push({
      rule: "BR-16", severity: "error",
      message: "The invoice has no invoice lines.",
      hint: "An EN 16931 invoice must contain at least one line.",
    });
  } else {
    passed.push(`BR-16 — ${lines.length} invoice line${lines.length === 1 ? "" : "s"}`);
  }

  // ── Totals and the arithmetic that actually catches people ─────────────
  const totals = all(doc, UBL_CAC, "LegalMonetaryTotal")[0];
  if (!totals) {
    findings.push({
      rule: "BR-CO-10", severity: "error",
      message: "Missing the document totals block (LegalMonetaryTotal).",
    });
  } else {
    const lineExt = num(childText(totals, UBL_CBC, "LineExtensionAmount"));
    const taxExcl = num(childText(totals, UBL_CBC, "TaxExclusiveAmount"));
    const taxIncl = num(childText(totals, UBL_CBC, "TaxInclusiveAmount"));
    const payable = num(childText(totals, UBL_CBC, "PayableAmount"));
    const taxTotalEl = all(doc, UBL_CAC, "TaxTotal")[0];
    const taxAmount = taxTotalEl ? num(childText(taxTotalEl, UBL_CBC, "TaxAmount")) : null;

    req("BR-12", "Sum of invoice line net amounts", lineExt === null ? null : String(lineExt));
    req("BR-13", "Invoice total without VAT", taxExcl === null ? null : String(taxExcl));
    req("BR-14", "Invoice total with VAT", taxIncl === null ? null : String(taxIncl));
    req("BR-15", "Amount due for payment", payable === null ? null : String(payable));

    // BR-CO-10 — line sum must equal the stated line total.
    if (lines.length > 0 && lineExt !== null) {
      const sum = lines.reduce((acc, l) => acc + (num(childText(l, UBL_CBC, "LineExtensionAmount")) ?? 0), 0);
      if (differs(sum, lineExt)) {
        findings.push({
          rule: "BR-CO-10", severity: "error",
          message: `Line amounts add up to ${sum.toFixed(2)}, but the invoice states ${lineExt.toFixed(2)}.`,
          hint: "This is the most common silent failure: the file looks correct and the authority refuses it. Usually a rounding or a line edited after the totals were written.",
        });
      } else {
        passed.push("BR-CO-10 — line amounts add up to the stated total");
      }
    }

    // BR-CO-15 — gross must equal net + VAT.
    if (taxExcl !== null && taxIncl !== null && taxAmount !== null) {
      if (differs(taxExcl + taxAmount, taxIncl)) {
        findings.push({
          rule: "BR-CO-15", severity: "error",
          message: `Total with VAT should be ${(taxExcl + taxAmount).toFixed(2)} (${taxExcl.toFixed(2)} + ${taxAmount.toFixed(2)}), but the invoice states ${taxIncl.toFixed(2)}.`,
          hint: "Check the VAT rate applied per line against the invoice-level tax total.",
        });
      } else {
        passed.push("BR-CO-15 — total with VAT equals net plus VAT");
      }
    }

    // BR-CO-16 — payable equals gross less anything prepaid.
    if (taxIncl !== null && payable !== null) {
      const prepaid = num(childText(totals, UBL_CBC, "PrepaidAmount")) ?? 0;
      if (differs(taxIncl - prepaid, payable)) {
        findings.push({
          rule: "BR-CO-16", severity: "error",
          message: `Amount due should be ${(taxIncl - prepaid).toFixed(2)}, but the invoice states ${payable.toFixed(2)}.`,
          hint: "If a deposit was taken it belongs in PrepaidAmount rather than being subtracted silently.",
        });
      } else {
        passed.push("BR-CO-16 — amount due matches the total less any prepayment");
      }
    }
  }

  // ── XRechnung-specific ──────────────────────────────────────────────────
  const isXRechnung = (customization ?? "").includes("xrechnung");
  if (isXRechnung) {
    const buyerRef = childText(root, UBL_CBC, "BuyerReference");
    if (!buyerRef) {
      findings.push({
        rule: "BR-DE-15", severity: "warning",
        message: "No BuyerReference. For invoices to German public bodies this carries the Leitweg-ID and is mandatory.",
        hint: "Required for B2G. For a normal business customer it is usually not needed — ask the customer whether they issue one.",
      });
    } else {
      passed.push("BR-DE-15 — BuyerReference present");
    }
    passed.push("Declared as an XRechnung profile");
  }

  return {
    format: "UBL Invoice",
    profile: customization ?? undefined,
    findings,
    passed,
  };
}

/**
 * Validate from a string, tolerating either XML-parser convention.
 *
 * The browser's DOMParser never throws — it returns a document containing a
 * <parsererror> element. Node parsers such as @xmldom THROW instead. Both mean
 * "this is not XML", so this normalises them and every caller goes through the
 * same path rather than the browser and the test harness taking different
 * routes through the code.
 */
export function validateXmlString(
  xml: string,
  parse: (s: string) => Document,
): ValidationResult {
  let doc: Document;
  try {
    doc = parse(xml);
  } catch {
    return {
      format: "unknown",
      findings: [{
        rule: "XML",
        severity: "error",
        message: "This file is not well-formed XML, so nothing else can be checked.",
        hint: "If you exported a PDF, note that a plain PDF is not a structured e-invoice. ZUGFeRD and Factur-X embed the XML inside the PDF — extract that XML and check it here.",
      }],
      passed: [],
    };
  }
  return validateEInvoice(doc);
}
