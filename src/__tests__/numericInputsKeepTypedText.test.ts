/**
 * @jest-environment node
 */
// Two shapes lost the digits a contractor typed (German device, 2026-09-15):
//
// 1. `<TextInput value={String(price)} onChangeText={v => set(parseFloat(v))}>`
//    re-parses every keystroke into the number the field displays, so "85,"
//    and "85." both snapped back to "85" — the invoice line editor and the
//    quote builder could not take a price with cents in ANY locale. Use
//    `DecimalInput` (src/components/shared), which keeps the text while typing.
// 2. `parseFloat(text)` reads "12,50" as 12 — the decimal key on a German,
//    Dutch, French, Spanish or Italian keypad is a comma. Hand-rolled
//    `.replace(',', '.')` fixes got "1.500" wrong instead. Use
//    `parseDecimalInput` (src/utils/decimalInput).
//
// Scope: the contractor surfaces. app/hub/** and the site-lead tree are out of
// scope by decision (memory: contractor + aannemer only).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['app/contractor', 'app/(contractor)', 'app/(modals)', 'app/invoices', 'src/components/contractor', 'src/components/shared'];

// Not typed input: each parses text the app itself produced.
const PARSE_ALLOWED: Record<string, string> = {
  'src/components/shared/VascoCard.tsx': 'reads an amount out of generated card copy',
};

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const files = DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((f) => ({
  rel: path.relative(ROOT, f),
  src: stripComments(fs.readFileSync(f, 'utf8')),
}));

describe('typed numbers keep what was typed', () => {
  it('scans the screens it claims to', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.rel === path.join('app', 'invoices', '[id].tsx'))).toBe(true);
    expect(files.some((f) => f.rel.endsWith('TieredQuoteBuilder.tsx'))).toBe(true);
  });

  it('no <TextInput> binds value={String(...)}', () => {
    const hits: string[] = [];
    for (const { rel, src } of files) {
      let i = src.indexOf('<TextInput');
      while (i >= 0) {
        const end = src.indexOf('/>', i);
        const tag = src.slice(i, end < 0 ? undefined : end);
        if (/\bvalue=\{\s*String\(/.test(tag)) hits.push(`${rel}:${src.slice(0, i).split('\n').length}`);
        i = src.indexOf('<TextInput', i + 1);
      }
    }
    expect(hits).toEqual([]);
  });

  it('a DecimalInput bound to a price or amount passes `money` (it showed "185,5")', () => {
    const hits: string[] = [];
    let seen = 0;
    for (const { rel, src } of files) {
      let i = src.indexOf('<DecimalInput');
      while (i >= 0) {
        const end = src.indexOf('/>', i);
        const tag = src.slice(i, end < 0 ? undefined : end);
        if (/\bvalue=\{[^}]*(price|Price|amount|Amount)/.test(tag)) {
          seen += 1;
          if (!/\smoney(\s|=\{true\})/.test(tag)) hits.push(`${rel}:${src.slice(0, i).split('\n').length}`);
        }
        i = src.indexOf('<DecimalInput', i + 1);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(2); // invoice line price + quote builder price
    expect(hits).toEqual([]);
  });

  it('no parseFloat, and no hand-rolled comma replace, on typed text', () => {
    const hits: string[] = [];
    for (const { rel, src } of files) {
      if (PARSE_ALLOWED[rel]) continue;
      src.split('\n').forEach((line, idx) => {
        if (/\bparseFloat\(/.test(line) || /\breplace\(\s*(['"]),\1\s*,\s*(['"])\.\2\s*\)/.test(line)) {
          hits.push(`${rel}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('the allowlist is not stale', () => {
    for (const rel of Object.keys(PARSE_ALLOWED)) {
      const f = files.find((x) => x.rel === rel);
      expect(f && /\bparseFloat\(|replace\(\s*','/.test(f.src)).toBeTruthy();
    }
  });
});
