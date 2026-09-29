// VascoInsightCard marked itself "acted" before its action resolved, so a
// cancelled confirm or an unsent share still showed as done (review
// 2026-09-29). Acted is set inside the result callback, on success only.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

it('sets acted only from a successful action result', () => {
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../components/shared/VascoInsightCard.tsx'), 'utf8'));
  const at = src.indexOf('executeActionWithConfirmation(');
  expect(at).toBeGreaterThan(-1);
  const block = src.slice(at, src.indexOf('return;', at));
  expect(block).toMatch(/if \(result\.success\) setActedOn\(true\)/);
  // No unconditional setActedOn(true) between the call and the return.
  expect(block.replace(/if \(result\.success\) setActedOn\(true\)/, '')).not.toMatch(/setActedOn\(true\)/);
});
