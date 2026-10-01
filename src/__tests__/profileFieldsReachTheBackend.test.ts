/**
 * Every business-settings column the app READS into the profile is also
 * WRITTEN by `updateBusinessProfile`. The other way round is the bug this
 * class kept producing: a field the settings screen sets, the read mapper
 * restores, and the write silently drops — fine until the next cold start,
 * then gone (R66 round 24: vatScheme reverted KOR contractors to 21 %;
 * 20260819000011: fiscalRegime/personType made the e-invoice gate block
 * forever). The codice fiscale (2026-10-01) is the newest of these fields.
 */
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (f: string) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const between = (src: string, start: string, end: string) => {
  const i = src.indexOf(start);
  expect(i).toBeGreaterThan(-1);
  const j = src.indexOf(end, i + start.length);
  expect(j).toBeGreaterThan(i);
  return src.slice(i, j);
};

// Written by other paths on purpose, or not the contractor's to set.
const NOT_FROM_SETTINGS = new Set(['id', 'user_id', 'created_at', 'updated_at', 'logo_url']);

it('every column the profile reads, updateBusinessProfile writes', () => {
  const mapper = between(read('src/lib/mappers.ts'), 'export function businessSettingsToProfile', '\n}\n');
  const readCols = new Set([...mapper.matchAll(/\brow\.([a-z_]+)/g)].map((m) => m[1]));
  const appState = read('src/state/AppState.tsx');
  const writer = between(appState, 'updateBusinessProfile: async (updates) => {', '\n      },\n');
  const written = new Set([...writer.matchAll(/dbUpdates\.([a-z_]+)\s*=/g)].map((m) => m[1]));
  expect(readCols.size).toBeGreaterThan(20);
  expect(readCols.has('tax_code')).toBe(true);
  expect([...readCols].filter((c) => !written.has(c) && !NOT_FROM_SETTINGS.has(c)).sort()).toEqual([]);
});
