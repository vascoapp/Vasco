// A ScrollView that holds a text field AND buttons must not swallow the first
// tap while the keyboard is up. Without keyboardShouldPersistTaps the tap only
// closes the keyboard: on the crew form, picking "Voorman" right after typing
// the name silently kept "Monteur" (walk, 2026-09-29). 13 screens had it.
import fs from 'fs';
import path from 'path';
import manifest from '../config/dormant.files.json';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set((manifest as any).files as string[]);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return /\.tsx$/.test(e.name) ? [p] : [];
});

const offenders = ['app', 'src/components'].flatMap((d) => walk(path.join(ROOT, d)))
  .map((f) => path.relative(ROOT, f))
  .filter((f) => !dormant.has(f) && !f.startsWith('app/hub/'))
  .flatMap((f) => {
    const s = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const out: string[] = [];
    let i = 0;
    while ((i = s.indexOf('<ScrollView', i)) !== -1) {
      const e = s.indexOf('>', i + 11);
      const tag = s.slice(i, e + 1);
      const body = s.slice(e, s.indexOf('</ScrollView>', e));
      if (/<(TextInput|DecimalInput)\b/.test(body) && /<(Pressable|DKMenu|TouchableOpacity)\b/.test(body)
        && !/keyboardShouldPersistTaps/.test(tag)) {
        out.push(`${f}:${s.slice(0, i).split('\n').length}`);
      }
      i = e;
    }
    return out;
  });

it('every scrolling form lets a tap reach its buttons', () => {
  expect(offenders).toEqual([]);
});
