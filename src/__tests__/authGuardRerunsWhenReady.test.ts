// A signed-out deep link (vasco:///invoices/…) opened the screen with cached
// data, in the device language (walk, 2026-09-30). The root guard skips until
// the Stack is ready; the ready flag was a REF, so becoming ready re-ran
// nothing — when auth hydrated inside those 100 ms, the guard never ran again.
// The dormant-route redirect lives in the same effect and had the same gap.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/_layout.tsx'), 'utf8'));

it('the ready flag is state, not a ref', () => {
  expect(src).toMatch(/const \[navigationReady, setNavigationReady\] = useState\(false\)/);
  expect(src).not.toMatch(/navigationReady = useRef\(/);
  expect(src).not.toMatch(/navigationReady\.current/);
});

it('the guard effect re-runs when navigation becomes ready', () => {
  const guard = src.indexOf('if (!navigationReady) return;');
  expect(guard).toBeGreaterThan(-1);
  const deps = src.slice(guard).match(/\}, \[([^\]]*)\]\);/);
  expect(deps?.[1]).toMatch(/\bnavigationReady\b/);
  expect(deps?.[1]).toMatch(/\bisAuthenticated\b/);
});
