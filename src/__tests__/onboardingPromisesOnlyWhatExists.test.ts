// Onboarding promises certificate tracking only while a certificate can really
// be added (DORMANT_CONTROLS.complianceItemEditing). UK walk, 2026-10-08: "Add
// the expiry date under Compliance and Vasco will warn you" pointed at a hidden
// control. Built 2026-10-09 (decision 3a) — so the flag may be on only while
// the Compliance screen mounts the sheet that writes, and no "Coming soon"
// stands in for it.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { DORMANT_CONTROLS } from '../config/dormant';

const read = (rel: string) => stripComments(fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8'));
const onboarding = read('app/onboarding.tsx');
const screen = read('app/(contractor)/certificaten.tsx');
const sheet = read('src/components/contractor/ComplianceItemSheet.tsx');

it('the compliance info card and the certificate-tracking insight sit behind the flag', () => {
  expect(onboarding).toMatch(/DORMANT_CONTROLS\.complianceItemEditing && \(\s*<View style=\{styles\.complianceInfoCard\}>/);
  expect(onboarding).toMatch(/goals\.includes\('stay_compliant'\) && DORMANT_CONTROLS\.complianceItemEditing/);
});

it('the flag is on only while something writes behind it', () => {
  if (!DORMANT_CONTROLS.complianceItemEditing) return;
  expect(screen).toMatch(/<ComplianceItemSheet\b/);
  expect(screen).not.toMatch(/comingSoon/);
  expect(sheet).toMatch(/save\(\{ id: item\?\.id, type, name: cleanName/);
});
