// =============================================================================
// A small XML reader for checking the e-invoices WE generate, on the device.
// =============================================================================
// The value-rule checks (einvoiceValueRules.ts) must run on the exact bytes the
// contractor is about to hand over — in the app (Hermes, no DOMParser) as well
// as in node. `@xmldom/xmldom` is only a transitive dependency of the Expo
// tooling, so the app does not get to rely on it; this reader is enough for
// well-formed documents without DTDs, and its test cross-checks it against
// xmldom on every generated sample.
//
// Navigation is by DIRECT CHILD only. A whole-subtree search has already made
// this codebase's validators read a line's ID as the invoice number and a
// trading name as the legal name (memory: einvoice-mandate-wedge-2026-08).
// =============================================================================

export interface XmlNode {
  /** Local name, namespace prefix stripped. */
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Concatenated character data directly inside this element. */
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
const local = (qname: string): string => qname.slice(qname.indexOf(':') + 1);

/** Parses a document. Throws on malformed input (unclosed / mismatched tags). */
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: Array<{ node: XmlNode; qname: string }> = [{ node: root, qname: '' }];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    const textEnd = lt === -1 ? xml.length : lt;
    if (textEnd > i) stack[stack.length - 1].node.text += decode(xml.slice(i, textEnd));
    if (lt === -1) break;
    if (xml.startsWith('<?', lt)) { i = xml.indexOf('?>', lt) + 2; if (i < 2) throw new Error('unterminated <?'); continue; }
    if (xml.startsWith('<!--', lt)) { i = xml.indexOf('-->', lt) + 3; if (i < 3) throw new Error('unterminated comment'); continue; }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt);
      if (end < 0) throw new Error('unterminated CDATA');
      stack[stack.length - 1].node.text += xml.slice(lt + 9, end);
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<!', lt)) throw new Error('DTD not supported');
    const gt = xml.indexOf('>', lt);
    if (gt < 0) throw new Error('unterminated tag');
    const raw = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith('/')) {
      const qname = raw.slice(1).trim();
      const top = stack.pop();
      if (!top || top.qname !== qname) throw new Error(`mismatched </${qname}>`);
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const m = /^([^\s/>]+)/.exec(body);
    if (!m) throw new Error('empty tag');
    const node: XmlNode = { name: local(m[1]), attrs: {}, children: [], text: '' };
    const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(body.slice(m[1].length)))) node.attrs[local(a[1])] = decode(a[3] ?? a[4] ?? '');
    stack[stack.length - 1].node.children.push(node);
    if (!selfClosing) stack.push({ node, qname: m[1] });
  }
  if (stack.length !== 1) throw new Error(`unclosed <${stack[stack.length - 1].qname}>`);
  return root;
}

/** Direct children named `name`. */
export const kids = (n: XmlNode | undefined, name: string): XmlNode[] =>
  n ? n.children.filter((c) => c.name === name) : [];

/** Follows a path of DIRECT children ("A/B/C"); the first match at each step. */
export function at(n: XmlNode | undefined, path: string): XmlNode | undefined {
  let cur = n;
  for (const step of path.split('/')) {
    if (!cur) return undefined;
    cur = cur.children.find((c) => c.name === step);
  }
  return cur;
}

/** Trimmed text at a direct-child path, or undefined when the element is absent. */
export const textAt = (n: XmlNode | undefined, path: string): string | undefined => {
  const t = at(n, path);
  return t ? t.text.trim() : undefined;
};
