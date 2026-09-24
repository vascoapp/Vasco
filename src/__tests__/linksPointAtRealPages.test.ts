/**
 * Every vascobuild.com link the app hands out opens a page that exists.
 *
 * The job sign-off request sent the customer `vascobuild.com/sign/<job id>`
 * — a route that never existed on the web app (sweep 2026-09-23, B2). The
 * customer tapped a 404, and the contractor's activity log said "sent".
 * This reads every link in app/, src/ and the six locale files and checks the
 * first path segment against the web app's routes (admin/src/app) and its
 * redirects (admin/next.config.*).
 */
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.join(__dirname, '../..');
const WEB = path.join(ROOT, 'admin/src/app');

/**
 * Links in code nothing a contractor can reach renders. Each is dead with a
 * reason; a stale entry (the link is gone) fails, so this cannot rot.
 */
const UNREACHABLE: Record<string, string> = {
  'src/services/evidencePackService.ts': 'Handover builder — only reachable from the (tabs) ContractorDashboard, and _layout redirects every signed-in user out of (tabs). Invented pdf/handover/certificates URLs; must get real pages before it is mounted.',
  'src/services/documentVaultService.ts': 'createShareLink has no callers.',
};

function routes(): Set<string> {
  const out = new Set(fs.readdirSync(WEB, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name));
  const cfg = fs.readdirSync(path.join(ROOT, 'admin')).find((f) => /^next\.config\./.test(f));
  if (cfg) for (const m of fs.readFileSync(path.join(ROOT, 'admin', cfg), 'utf8').matchAll(/source:\s*["']\/([\w-]+)/g)) out.add(m[1]);
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '__tests__', '__screenwalk__', 'test-utils'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|json)$/.test(e.name) && !e.name.includes('.test.')) out.push(full);
  }
  return out;
}

// The web app (admin/) serves the bare host, www. and admin. — the customer
// portal is linked as admin.vascobuild.com/customer/<code>. pay.vascobuild.com
// is the payment provider's demo host, not this app.
const LINK = /(?<![\w.-])(?:www\.|admin\.)?vascobuild\.com\/([\w-]+)/g;

function links() {
  const found: Array<{ file: string; seg: string }> = [];
  for (const f of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))]) {
    const raw = fs.readFileSync(f, 'utf8');
    const src = f.endsWith('.json') ? raw : stripComments(raw);
    for (const m of src.matchAll(LINK)) found.push({ file: path.relative(ROOT, f), seg: m[1] });
  }
  return found;
}

describe('links point at real pages', () => {
  const known = routes();
  const all = links();

  it('every link opens an existing route', () => {
    const dead = all.filter((l) => !known.has(l.seg) && !(l.file in UNREACHABLE));
    expect(dead).toEqual([]);
  });

  it('no stale UNREACHABLE entry', () => {
    const withDead = new Set(all.filter((l) => !known.has(l.seg)).map((l) => l.file));
    expect(Object.keys(UNREACHABLE).filter((f) => !withDead.has(f))).toEqual([]);
  });

  it('sanity: finds the real customer portal link and knows its route', () => {
    expect(all.some((l) => l.seg === 'customer')).toBe(true);
    expect(known.has('customer')).toBe(true);
    expect(known.has('sign')).toBe(false);
  });
});
