/**
 * @jest-environment node
 */
// Canonical XML 1.0 (inclusive, without comments) — the bytes every Facturae
// signature hashes. Known vectors: the W3C Recommendation's own examples
// (https://www.w3.org/TR/2001/REC-xml-c14n-20010315 §3.1–3.3, DTD lines
// removed — this implementation refuses a DTD — and §3.3's DTD-defaulted
// attribute written out), a document SUBSET whose apex inherits namespaces
// (the SignedProperties case), and libxml2's `xmllint --c14n` over a generated
// Facturae when xmllint is installed. EU DSS (Apache Santuario) recomputes the
// same digests in npm run check:facturae-signature.
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  parseXmlDocument, canonicalizeDocument, canonicalizeSubtree, elementById, findElement, isNs,
} from '../xmlC14n';
import { toFacturae, type EInvoiceSource } from '../einvoiceMapping';
import { generateFacturaeXml } from '../einvoice-es';

const c14n = (xml: string) => canonicalizeDocument(parseXmlDocument(xml));

describe('W3C C14N 1.0 examples', () => {
  it('§3.1 PIs, comments and outside of the document element (uncommented form)', () => {
    const input = '<?xml version="1.0"?>\n\n<?xml-stylesheet   href="doc.xsl"\n   type="text/xsl"   ?>\n\n'
      + '<doc>Hello, world!<!-- Comment 1 --></doc>\n\n<?pi-without-data     ?>\n\n<!-- Comment 2 -->\n\n<!-- Comment 3 -->\n';
    expect(c14n(input)).toBe('<?xml-stylesheet href="doc.xsl"\n   type="text/xsl"   ?>\n<doc>Hello, world!</doc>\n<?pi-without-data?>');
  });

  it('§3.2 whitespace in document content is kept byte for byte', () => {
    const doc = '<doc>\n   <clean>   </clean>\n   <dirty>   A   B   </dirty>\n   <mixed>\n      A\n      <clean>   </clean>\n      B\n      <dirty>   A   B   </dirty>\n      C\n   </mixed>\n</doc>';
    expect(c14n(doc)).toBe(doc);
  });

  it('§3.3 start/end tags: empty elements, attribute order, namespace (re)declarations', () => {
    const input = [
      '<doc>',
      '   <e1   />',
      '   <e2   ></e2>',
      '   <e3    name = "elem3"   id="elem3"    />',
      '   <e4    name="elem4"   id="elem4"    ></e4>',
      '   <e5 a:attr="out" b:attr="sorted" attr2="all" attr="I\'m"',
      '       xmlns:b="http://www.ietf.org" ',
      '       xmlns:a="http://www.w3.org"',
      '       xmlns="http://example.org"/>',
      '   <e6 xmlns="" xmlns:a="http://www.w3.org">',
      '       <e7 xmlns="http://www.ietf.org">',
      '           <e8 xmlns="" xmlns:a="http://www.w3.org">',
      '               <e9 xmlns="" xmlns:a="http://www.ietf.org" attr="default"/>',
      '           </e8>',
      '       </e7>',
      '   </e6>',
      '</doc>',
    ].join('\n');
    const expected = [
      '<doc>',
      '   <e1></e1>',
      '   <e2></e2>',
      '   <e3 id="elem3" name="elem3"></e3>',
      '   <e4 id="elem4" name="elem4"></e4>',
      '   <e5 xmlns="http://example.org" xmlns:a="http://www.w3.org" xmlns:b="http://www.ietf.org" attr="I\'m" attr2="all" b:attr="sorted" a:attr="out"></e5>',
      '   <e6 xmlns:a="http://www.w3.org">',
      '       <e7 xmlns="http://www.ietf.org">',
      '           <e8 xmlns="">',
      '               <e9 xmlns:a="http://www.ietf.org" attr="default"></e9>',
      '           </e8>',
      '       </e7>',
      '   </e6>',
      '</doc>',
    ].join('\n');
    expect(c14n(input)).toBe(expected);
  });
});

describe('escaping and normalization', () => {
  it('text escapes & < > (and keeps quotes literal); attributes escape & < " TAB LF CR', () => {
    expect(c14n('<a t="x &amp; &lt; &gt; &quot; &apos; &#9;&#10;&#13;">&quot;a&apos; &amp; &lt;b&gt; &#13;</a>'))
      .toBe('<a t="x &amp; &lt; > &quot; \' &#x9;&#xA;&#xD;">"a\' &amp; &lt;b&gt; &#xD;</a>');
  });
  it('CDATA becomes escaped text; CRLF becomes LF; a literal TAB/LF in an attribute is a space', () => {
    expect(c14n('<a b="1\t2\n3"><![CDATA[x < y & z]]>\r\nend</a>')).toBe('<a b="1 2 3">x &lt; y &amp; z\nend</a>');
  });
  it('refuses what it cannot canonicalize faithfully', () => {
    expect(() => parseXmlDocument('<!DOCTYPE a [<!ENTITY e "x">]><a>&e;</a>')).toThrow();
    expect(() => parseXmlDocument('<a>&nbsp;</a>')).toThrow(/undeclared entity/);
    expect(() => parseXmlDocument('<p:a/>')).toThrow(/unbound prefix/);
    expect(() => parseXmlDocument('<a></b>')).toThrow(/mismatched/);
  });
});

describe('document subsets (what a #Id reference digests)', () => {
  // The Facturae shape: the root declares fe + ds, the Signature declares ds
  // again plus xades. The SignedProperties' canonical form must carry ALL
  // THREE on its apex (inclusive c14n), sorted by prefix, and nothing on its
  // children that is already in effect.
  const doc = parseXmlDocument(
    '<fe:Facturae xmlns:fe="urn:fe" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><FileHeader/>'
    + '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="S">'
    + '<ds:Object><xades:QualifyingProperties Target="#S"><xades:SignedProperties Id="SP"><xades:SigningTime>2026-10-01T10:00:00Z</xades:SigningTime>'
    + '<ds:DigestMethod Algorithm="x"/></xades:SignedProperties></xades:QualifyingProperties></ds:Object></ds:Signature></fe:Facturae>');

  it('the apex carries every namespace in scope — inherited ones included', () => {
    expect(canonicalizeSubtree(elementById(doc.root, 'SP')!)).toBe(
      '<xades:SignedProperties xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:fe="urn:fe" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="SP">'
      + '<xades:SigningTime>2026-10-01T10:00:00Z</xades:SigningTime><ds:DigestMethod Algorithm="x"></ds:DigestMethod></xades:SignedProperties>');
  });

  it('the enveloped transform: the document without the Signature element (whitespace around it kept)', () => {
    const sig = findElement(doc.root, (e) => isNs(e, 'http://www.w3.org/2000/09/xmldsig#', 'Signature'))!;
    expect(canonicalizeDocument(doc, { exclude: [sig] }))
      .toBe('<fe:Facturae xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:fe="urn:fe"><FileHeader></FileHeader></fe:Facturae>');
  });

  it('a default namespace undeclared under a subset apex is written as xmlns=""', () => {
    const d = parseXmlDocument('<r xmlns="urn:d"><a Id="A"><b xmlns=""><c/></b></a></r>');
    expect(canonicalizeSubtree(elementById(d.root, 'A')!)).toBe('<a xmlns="urn:d" Id="A"><b xmlns=""><c></c></b></a>');
  });
});

describe('libxml2 agrees on a generated Facturae (skipped where xmllint is absent)', () => {
  let hasXmllint = true;
  try { execFileSync('xmllint', ['--version'], { stdio: 'pipe' }); } catch { hasXmllint = false; }
  (hasXmllint ? it : it.skip)('canonicalizeDocument === xmllint --c14n', () => {
    const src = {
      seller: { name: 'Fontanería Ruiz S.L.', taxId: 'B12345674', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'J' },
      buyer: { name: 'Pérez & "Hijos" <S.L.>', vatId: 'ESB87654323', address: 'Calle Sol 3', city: 'Sevilla', postcode: '41001', province: 'Sevilla', country: 'ES' },
      invoiceNumber: 'FA-1', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
      lines: [{ description: "O'Brien — 1/2\" tubo & codo", quantity: 1.333, unitPrice: 55, lineTotal: 73.315, vatRate: 21 }],
      totalNet: 0, totalVat: 0, totalGross: 0,
    } as EInvoiceSource;
    const r = toFacturae(src);
    if (!r.ok) throw new Error(JSON.stringify(r.missing));
    const xml = generateFacturaeXml(r.document);
    const f = path.join(os.tmpdir(), `c14n-${process.pid}.xml`);
    fs.writeFileSync(f, xml);
    try {
      const libxml = execFileSync('xmllint', ['--c14n', f]).toString('utf8');
      expect(c14n(xml)).toBe(libxml);
    } finally { fs.rmSync(f, { force: true }); }
  });
});
