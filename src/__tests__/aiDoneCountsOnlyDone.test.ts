// "N actions completed" on the AI tab counted dismissed cards too — a
// dismissal hid the card through the same set (2026-09-29).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

it('a dismissal is kept apart from the completed count', () => {
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/(contractor)/ai.tsx'), 'utf8'));
  expect(src).toMatch(/const handleDismiss = \(id: string\) => setDismissed\(/);
  expect(src).toMatch(/actionsCompletedUpper', \{ count: actioned\.size/);
});
