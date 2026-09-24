/**
 * A customer's portal question reaches its contractor.
 *
 * classify-customer-question resolved the contractor from
 * decision_submissions.user_id — a column that does not exist — so every
 * question was stored with contractor_user_id NULL, and the app reads
 * `.eq('contractor_user_id', me)`: none ever showed. It also refused every
 * question with a 500 when no AI key was set, which is production today
 * (live-schema scan + review, 2026-09-24).
 */
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const SRC = stripComments(fs.readFileSync(path.join(__dirname, '../../supabase/functions/classify-customer-question/index.ts'), 'utf8'));
const SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, '../test-utils/schema.snapshot.json'), 'utf8')).tables;

describe('portal questions reach the contractor', () => {
  it('the contractor comes from the tracker, looked up by its access code', () => {
    expect(SRC).toMatch(/\.from\('decision_trackers'\)[\s\S]{0,120}\.eq\('access_code', trackerAccessToken\)/);
    expect(SNAP.decision_trackers.access_code).toBeTruthy();
    expect(SNAP.decision_trackers.user_id).toBeTruthy();
    expect(SRC).toMatch(/contractor_user_id: contractorUserId/);
  });

  it('an unknown or expired link is refused, not stored ownerless', () => {
    expect(SRC).toMatch(/Unknown or expired portal link/);
    expect(SRC).toMatch(/status === 'expired'/);
  });

  it('no AI key → the question is still stored (pending), not a 500', () => {
    expect(SRC).not.toMatch(/!serviceKey \|\| !anthropicKey/);
    expect(SRC).toMatch(/anthropicKey \? await classifyWithClaude\(/);
  });
});
