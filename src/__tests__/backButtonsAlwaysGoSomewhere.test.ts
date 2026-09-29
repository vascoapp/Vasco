/**
 * @jest-environment node
 */
// A back button always goes somewhere. A screen opened straight from a push
// notification or link is the only screen on the stack, and `router.back()`
// then does nothing (emulator walk 2026-09-29).
import fs from 'fs';
import path from 'path';
import { goBack } from '../utils/goBack';
import { stripComments } from '../utils/stripComments';

describe('goBack', () => {
  it('goes back when there is history', () => {
    const r = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };
    goBack(r); expect(r.back).toHaveBeenCalled(); expect(r.replace).not.toHaveBeenCalled();
  });
  it('goes home when there is none', () => {
    const r = { canGoBack: () => false, back: jest.fn(), replace: jest.fn() };
    goBack(r); expect(r.replace).toHaveBeenCalledWith('/'); expect(r.back).not.toHaveBeenCalled();
  });
});

it('no back button calls router.back() directly', () => {
  const ROOT = path.resolve(__dirname, '../..');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? (e.name === '__tests__' ? [] : walk(p)) : /\.tsx$/.test(e.name) ? [p] : [];
  });
  const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src/components'))];
  expect(files.length).toBeGreaterThan(100);
  const bad = files.filter((f) => /onPress=\{\(\)\s*=>\s*router\.back\(\)\}/.test(stripComments(fs.readFileSync(f, 'utf8'))))
    .map((f) => path.relative(ROOT, f));
  expect(bad).toEqual([]);
  const header = stripComments(fs.readFileSync(path.join(ROOT, 'src/components/shared/DKScreenHeader.tsx'), 'utf8'));
  expect(header).toMatch(/goBack\(router\)/);
});
