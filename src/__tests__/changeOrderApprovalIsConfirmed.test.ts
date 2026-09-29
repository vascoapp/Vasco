// Project billing, meerwerk (aannemer walk, 2026-09-29):
// - "Akkoord van klant" recorded the CUSTOMER's agreement on one tap — no
//   undo, and it moves the project value. It now confirms, restating amount.
// - The meerwerk title field showed the instalment's placeholder ("Start
//   werkzaamheden"): it read the term's key with its own fallback beside it.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/contractor/project-billing/[id].tsx'), 'utf8'));

it('approval goes through a confirm that names the amount', () => {
  const at = src.indexOf("t('projectBilling.markApproved'");
  expect(at).toBeGreaterThan(-1);
  const before = src.slice(Math.max(0, at - 1600), at);
  expect(before).toMatch(/Alert\.alert\(\s*t\('projectBilling\.confirmApprovedTitle'/);
  expect(before).toMatch(/amount: money\(order\.amount\)/);
  expect(before).not.toMatch(/onPress=\{\(\) =>\s*patchOrder\(order\.id, \{ status: 'approved'/);
});

it('meerwerk has its own placeholder key', () => {
  expect((src.match(/projectBilling\.termTitlePlaceholder/g) ?? []).length).toBe(1);
  expect(src).toMatch(/projectBilling\.changeOrderTitlePlaceholder/);
});
