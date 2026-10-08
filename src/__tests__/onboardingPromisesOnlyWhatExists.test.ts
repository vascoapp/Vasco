// Onboarding does not promise certificate tracking while no certificate can be
// added (DORMANT_CONTROLS.complianceItemEditing). UK walk, 2026-10-08: "Add the
// expiry date under Compliance and Vasco will warn you" pointed at a hidden
// control, and the plan step listed "Alerts before your certifications expire".
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { DORMANT_CONTROLS } from '../config/dormant';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/onboarding.tsx'), 'utf8'));

it('the compliance info card and the certificate-tracking insight sit behind the flag', () => {
  expect(src).toMatch(/DORMANT_CONTROLS\.complianceItemEditing && \(\s*<View style=\{styles\.complianceInfoCard\}>/);
  expect(src).toMatch(/goals\.includes\('stay_compliant'\) && DORMANT_CONTROLS\.complianceItemEditing/);
  expect(DORMANT_CONTROLS.complianceItemEditing).toBe(false);
});
