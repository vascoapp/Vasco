/**
 * The invoice screen's lines follow the stored lines and the CURRENT rate until
 * the contractor edits them.
 *
 * German walk, 2026-10-06: opened on a cold start (deep link / push) before the
 * cache and the profile had loaded, the screen built its lines ONCE: one line
 * from the gross at rate 0 (no country yet), then 19 % on top once the profile
 * arrived — "Gesamt € 268,36" for a € 225,51 invoice — and it never took the
 * real lines when they loaded. Send, PDF and XRechnung read these lines.
 * Device-verified after the fix (same cold start shows the stored line and
 * € 225,51).
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.join(__dirname, '../../app/invoices/[id].tsx'), 'utf8'));

it('re-syncs the lines when the stored lines or the rate arrive', () => {
  expect(src).toMatch(/\}, \[invoice\?\.id, invoice\?\.amount, storedLines, effectiveRate\]\);/);
  expect(src).toMatch(/if \(!invoice \|\| !linesFollowStoreRef\.current\) return;/);
});

it('the mount-only effect no longer builds the lines', () => {
  const mountEffect = src.slice(src.indexOf('getCustomerPaymentPreference(invoice.id)'), src.indexOf('const linesFollowStoreRef'));
  expect(mountEffect).not.toMatch(/setLocalItems\(/);
});

it('every edit hands the lines to the contractor', () => {
  for (const fn of ['handleUpdateItem', 'handleSetLineVat', 'handleAddItem', 'handleRemoveItem']) {
    const body = src.slice(src.indexOf(`const ${fn} =`), src.indexOf('};', src.indexOf(`const ${fn} =`)));
    expect(body).toMatch(/linesFollowStoreRef\.current = false;/);
  }
});

it('the lines cannot be edited before they have loaded, and follow the store again after a save', () => {
  expect(src).toMatch(/disabled=\{savingItems \|\| !profileLoaded\}/);
  expect(src).toMatch(/onPress: \(\) => \{ if \(profileLoaded\) setEditingItems\(true\); \}/);
  const save = src.slice(src.indexOf('const handleSaveItems'), src.indexOf('hapticSuccess();', src.indexOf('const handleSaveItems')));
  expect(save).toMatch(/linesFollowStoreRef\.current = true;/);
});
