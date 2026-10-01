// =============================================================================
// Canonical XML 1.0 (inclusive, without comments) — for signing OUR e-invoices
// =============================================================================
// https://www.w3.org/TR/2001/REC-xml-c14n-20010315 — the canonicalization the
// Facturae signature policy's examples and every FACe-accepted signer use
// (Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315").
//
// A signature is a hash of BYTES, and the verifier (FACe / @firma, the EU's
// DSS, Apache Santuario) recomputes those bytes from the document it receives.
// One byte of disagreement — a namespace declaration rendered on the wrong
// element, an attribute in the wrong order, `&quot;` left in text — and every
// signature we make is "invalid" while looking perfect. So this is a faithful
// implementation of the parts of the spec a document WITHOUT a DTD can reach:
//
//   · no XML declaration; PIs kept, comments dropped (the "without comments"
//     variant, which is also what an URI="" reference uses);
//   · empty elements as start/end pairs;
//   · namespace declarations first (sorted by prefix, default first), then
//     attributes sorted by (namespace URI, local name);
//   · a DOCUMENT SUBSET (SignedProperties, KeyInfo) carries on its apex every
//     namespace IN SCOPE there — the inherited ones included. This is the
//     inclusive-c14n trap: `xmlns:fe` from the Facturae root is part of the
//     bytes of SignedProperties;
//   · descendants re-declare a namespace only when its value CHANGES;
//   · text escapes & < > CR; attributes escape & < " TAB LF CR;
//   · CDATA becomes text; CRLF → LF; attribute values normalized.
//
// A DTD is refused (defaulted attributes and entity declarations would change
// the canonical form and our generators never write one). xml:* attribute
// inheritance into a subset apex is also out of scope — we never write xml:*.
// Cross-checked against libxml2 (xmllint --c14n) and Apache Santuario via
// the EU DSS validator (npm run check:facturae-signature).
// =============================================================================

export interface XText { type: 'text'; value: string }
export interface XComment { type: 'comment'; value: string }
export interface XPi { type: 'pi'; target: string; data: string }
export interface XAttr { qname: string; prefix: string; local: string; value: string }
export interface XElement {
  type: 'element';
  qname: string;
  prefix: string;
  local: string;
  /** Namespace declarations made ON this element, in document order. '' = default namespace. */
  nsDecls: Array<{ prefix: string; uri: string }>;
  attrs: XAttr[];
  children: XNode[];
  parent: XElement | null;
}
export type XNode = XElement | XText | XComment | XPi;
export interface XDocument { type: 'document'; children: XNode[]; root: XElement }

const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeRefs(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    const v = ENTITIES[e];
    if (v === undefined) throw new Error(`undeclared entity &${e};`);
    return v;
  });
}
const splitQName = (q: string): { prefix: string; local: string } => {
  const i = q.indexOf(':');
  return i < 0 ? { prefix: '', local: q } : { prefix: q.slice(0, i), local: q.slice(i + 1) };
};

/** Parses a namespace-well-formed document without a DTD. Throws on anything else. */
export function parseXmlDocument(input: string): XDocument {
  // XML 1.0 §2.11 end-of-line handling.
  const xml = input.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const doc: { type: 'document'; children: XNode[]; root?: XElement } = { type: 'document', children: [] };
  const stack: XElement[] = [];
  const addChild = (n: XNode) => {
    if (stack.length) stack[stack.length - 1].children.push(n);
    else doc.children.push(n);
  };
  const addText = (value: string) => {
    if (!value) return;
    if (!stack.length) {
      if (value.trim()) throw new Error('text outside the root element');
      return;
    }
    const kids = stack[stack.length - 1].children;
    const last = kids[kids.length - 1];
    if (last && last.type === 'text') last.value += value;
    else kids.push({ type: 'text', value });
  };
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    const end = lt < 0 ? xml.length : lt;
    if (end > i) {
      const raw = xml.slice(i, end);
      if (raw.includes(']]>')) throw new Error("']]>' in content");
      addText(decodeRefs(raw));
    }
    if (lt < 0) break;
    if (xml.startsWith('<?', lt)) {
      const close = xml.indexOf('?>', lt);
      if (close < 0) throw new Error('unterminated processing instruction');
      const body = xml.slice(lt + 2, close);
      const m = /^([^\s?]+)\s*([\s\S]*)$/.exec(body);
      if (!m) throw new Error('empty processing instruction');
      // The XML declaration is not a PI and is not part of the canonical form.
      if (m[1] !== 'xml') addChild({ type: 'pi', target: m[1], data: m[2] });
      else if (lt !== 0) throw new Error('XML declaration not at the start');
      i = close + 2;
      continue;
    }
    if (xml.startsWith('<!--', lt)) {
      const close = xml.indexOf('-->', lt + 4);
      if (close < 0) throw new Error('unterminated comment');
      addChild({ type: 'comment', value: xml.slice(lt + 4, close) });
      i = close + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      if (!stack.length) throw new Error('CDATA outside the root element');
      const close = xml.indexOf(']]>', lt);
      if (close < 0) throw new Error('unterminated CDATA');
      addText(xml.slice(lt + 9, close));
      i = close + 3;
      continue;
    }
    if (xml.startsWith('<!', lt)) throw new Error('DTD not supported');
    // A tag. '>' may legally appear inside a quoted attribute value.
    let j = lt + 1;
    let quote = '';
    for (; j < xml.length; j++) {
      const c = xml[j];
      if (quote) { if (c === quote) quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
    }
    if (j >= xml.length) throw new Error('unterminated tag');
    const raw = xml.slice(lt + 1, j);
    i = j + 1;
    if (raw.startsWith('/')) {
      const qname = raw.slice(1).trim();
      const top = stack.pop();
      if (!top || top.qname !== qname) throw new Error(`mismatched </${qname}>`);
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const nm = /^([^\s/>=]+)/.exec(body);
    if (!nm) throw new Error('empty tag');
    const qname = nm[1];
    const el: XElement = { type: 'element', qname, ...splitQName(qname), nsDecls: [], attrs: [], children: [], parent: stack[stack.length - 1] ?? null };
    const attrRe = /\s+([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    const rest = body.slice(qname.length);
    let consumed = 0;
    let a: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((a = attrRe.exec(rest))) {
      if (a.index !== consumed) throw new Error(`malformed attributes in <${qname}>`);
      consumed = a.index + a[0].length;
      const aq = a[1];
      if (seen.has(aq)) throw new Error(`duplicate attribute ${aq}`);
      seen.add(aq);
      // §3.3.3 attribute-value normalization (CDATA type: no DTD, so all are).
      const rawVal = a[3] ?? a[4] ?? '';
      if (rawVal.includes('<')) throw new Error(`'<' in attribute ${aq}`);
      const value = decodeRefs(rawVal.replace(/[\t\n]/g, ' '));
      if (aq === 'xmlns') el.nsDecls.push({ prefix: '', uri: value });
      else if (aq.startsWith('xmlns:')) el.nsDecls.push({ prefix: aq.slice(6), uri: value });
      else el.attrs.push({ qname: aq, ...splitQName(aq), value });
    }
    if (rest.slice(consumed).trim()) throw new Error(`malformed attributes in <${qname}>`);
    if (!stack.length) {
      if (doc.root) throw new Error('more than one root element');
      doc.root = el;
    }
    addChild(el);
    if (!selfClosing) stack.push(el);
  }
  if (stack.length) throw new Error(`unclosed <${stack[stack.length - 1].qname}>`);
  if (!doc.root) throw new Error('no root element');
  // Namespace well-formedness: every prefix used must be bound.
  const check = (el: XElement) => {
    if (el.prefix && el.prefix !== 'xml' && lookupNs(el, el.prefix) === undefined) throw new Error(`unbound prefix ${el.prefix}:`);
    for (const at of el.attrs) if (at.prefix && at.prefix !== 'xml' && lookupNs(el, at.prefix) === undefined) throw new Error(`unbound prefix ${at.prefix}:`);
    for (const c of el.children) if (c.type === 'element') check(c);
  };
  check(doc.root);
  return doc as XDocument;
}

/** The namespace URI bound to `prefix` at `el` ('' prefix = default; '' result = no namespace). */
export function lookupNs(el: XElement | null, prefix: string): string | undefined {
  if (prefix === 'xml') return XML_NS;
  for (let e = el; e; e = e.parent) {
    const d = e.nsDecls.find((x) => x.prefix === prefix);
    if (d) return d.uri;
  }
  return prefix === '' ? '' : undefined;
}

/** Every namespace binding in scope at `el`: prefix → URI (default '' included only when non-empty). */
export function inScopeNamespaces(el: XElement): Map<string, string> {
  const chain: XElement[] = [];
  for (let e: XElement | null = el; e; e = e.parent) chain.unshift(e);
  const m = new Map<string, string>();
  for (const e of chain) for (const d of e.nsDecls) m.set(d.prefix, d.uri);
  // xmlns="" undeclares the default; an empty default is not a namespace node.
  if (m.get('') === '') m.delete('');
  return m;
}

const escText = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;');
const escAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');

export interface C14nOptions {
  /** Elements whose whole subtree is left out (the enveloped-signature transform). */
  exclude?: XElement[];
}

function renderElement(el: XElement, rendered: Map<string, string>, isApex: boolean, exclude: Set<XElement>, out: string[]): void {
  const scope = inScopeNamespaces(el);
  const nsOut: Array<[string, string]> = [];
  if (isApex) {
    // The apex of a document subset carries every namespace node in scope.
    for (const [p, u] of scope) nsOut.push([p, u]);
  } else {
    for (const [p, u] of scope) if (rendered.get(p) !== u) nsOut.push([p, u]);
    // The default namespace was in effect on the output parent and is undeclared here.
    if (!scope.has('') && (rendered.get('') ?? '') !== '') nsOut.push(['', '']);
  }
  nsOut.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const attrs = el.attrs.map((a) => ({ a, uri: a.prefix ? (lookupNs(el, a.prefix) as string) : '' }));
  attrs.sort((x, y) => (x.uri !== y.uri ? (x.uri < y.uri ? -1 : 1) : x.a.local < y.a.local ? -1 : x.a.local > y.a.local ? 1 : 0));
  out.push('<', el.qname);
  for (const [p, u] of nsOut) out.push(' ', p ? `xmlns:${p}` : 'xmlns', '="', escAttr(u), '"');
  for (const { a } of attrs) out.push(' ', a.qname, '="', escAttr(a.value), '"');
  out.push('>');
  const next = new Map(rendered);
  for (const [p, u] of nsOut) next.set(p, u);
  for (const c of el.children) renderNode(c, next, exclude, out);
  out.push('</', el.qname, '>');
}

function renderNode(n: XNode, rendered: Map<string, string>, exclude: Set<XElement>, out: string[]): void {
  if (n.type === 'text') out.push(escText(n.value));
  else if (n.type === 'element') { if (!exclude.has(n)) renderElement(n, rendered, false, exclude, out); }
  else if (n.type === 'pi') out.push('<?', n.target, n.data ? ` ${n.data}` : '', '?>');
  // comments: dropped (without-comments variant)
}

/** C14N 1.0 of a whole document (what a URI="" reference digests). */
export function canonicalizeDocument(doc: XDocument, opts: C14nOptions = {}): string {
  const exclude = new Set(opts.exclude ?? []);
  const out: string[] = [];
  const top = doc.children.filter((c) => c.type !== 'comment' && c.type !== 'text');
  const rootIdx = top.indexOf(doc.root);
  top.forEach((c, idx) => {
    if (c.type === 'pi') {
      if (idx > rootIdx) out.push('\n');
      out.push('<?', c.target, c.data ? ` ${c.data}` : '', '?>');
      if (idx < rootIdx) out.push('\n');
    } else if (c.type === 'element') {
      renderElement(c, new Map(), true, exclude, out);
    }
  });
  return out.join('');
}

/** C14N 1.0 of the document subset an element and its descendants form (a same-document `#Id` reference). */
export function canonicalizeSubtree(el: XElement, opts: C14nOptions = {}): string {
  const out: string[] = [];
  renderElement(el, new Map(), true, new Set(opts.exclude ?? []), out);
  return out.join('');
}

/** Depth-first search for the first element matching `pred`. */
export function findElement(root: XElement, pred: (e: XElement) => boolean): XElement | undefined {
  if (pred(root)) return root;
  for (const c of root.children) {
    if (c.type !== 'element') continue;
    const f = findElement(c, pred);
    if (f) return f;
  }
  return undefined;
}

/** The element whose `Id` (or `ID` / `id`) attribute equals `id`. */
export const elementById = (root: XElement, id: string): XElement | undefined =>
  findElement(root, (e) => e.attrs.some((a) => (a.local === 'Id' || a.local === 'ID' || a.local === 'id') && !a.prefix && a.value === id));

/** Expanded name test: local name + namespace URI. */
export const isNs = (el: XElement, uri: string, local: string): boolean => el.local === local && lookupNs(el, el.prefix) === uri;
