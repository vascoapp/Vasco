/**
 * @jest-environment node
 */
// Sweep E9: a useCallback / useMemo that calls t() but leaves `t` out of its
// dependencies keeps the translator from the render it was created in — after
// a language switch the alert it raises is still in the old language
// (facturen's payment link, the receipt scanner, the handover pack).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set<string>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files);
const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['__tests__', 'node_modules', 'test-utils'].includes(e.name)) walk(full); }
    else if (e.name.endsWith('.tsx')) files.push(path.relative(ROOT, full));
  }
};
walk(path.join(ROOT, 'app'));
walk(path.join(ROOT, 'src'));

/** Each use(Callback|Memo)(…) call whose body calls t( and whose deps lack t. */
export function staleTranslators(src: string): number[] {
  const out: number[] = [];
  const re = /use(Callback|Memo)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1; let j = m.index + m[0].length;
    for (; j < src.length && depth; j += 1) {
      if (src[j] === '(') depth += 1; else if (src[j] === ')') depth -= 1;
    }
    const call = src.slice(m.index, j);
    const deps = /,\s*\[([^\]]*)\]\s*\)$/.exec(call)?.[1];
    if (deps === undefined) continue;
    if (/\bt\(/.test(call) && !/\b(t|i18n)\b/.test(deps)) out.push(src.slice(0, m.index).split('\n').length);
  }
  return out;
}

describe('no hook freezes the translator', () => {
  it('every live use(Callback|Memo) that calls t() lists t', () => {
    const hits: string[] = [];
    for (const f of files) {
      if (dormant.has(f)) continue;
      const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      if (!src.includes('useTranslation')) continue;
      for (const line of staleTranslators(src)) hits.push(`${f}:${line}`);
    }
    expect(hits).toEqual([]);
  });

  it('self-check: the rule sees the shape', () => {
    expect(staleTranslators("const f = useCallback(() => { alert(t('x')); }, [a]);")).toEqual([1]);
    expect(staleTranslators("const f = useCallback(() => { alert(t('x')); }, [a, t]);")).toEqual([]);
  });
});
