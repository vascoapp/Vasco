// The customer menu on "Nieuw project" (aannemer) and the new-job sheet
// listed only existing customers — starting work for a NEW client meant
// leaving the form, adding them elsewhere and starting again (walk,
// 2026-09-29). Both now offer "Nieuwe klant toevoegen", open the shared
// AddCustomerSheet INSIDE their own Modal (so it stacks on iOS), and select
// the customer it creates.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const FORMS: [string, string, RegExp][] = [
  ['app/contractor/projects.tsx', '<Modal visible={showCreate}', /onAdded=\{\(id\) => setNewCustomerId\(id\)\}/],
  ['app/(contractor)/werk.tsx', '<Modal visible={showNewJob}', /onAdded=\{\(id\) => setNewJobCustomerId\(id\)\}/],
];

it.each(FORMS)('%s offers a new customer from its picker', (f, modalOpen, selects) => {
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8'));
  expect(src).toMatch(/key: '__new__',\s*label: t\('customers\.addNew'/);
  const i = src.indexOf(modalOpen);
  expect(i).toBeGreaterThan(-1);
  const modal = src.slice(i, src.indexOf('</Modal>', i));
  expect(modal).toMatch(/<AddCustomerSheet/);
  expect(modal).toMatch(selects);
});
