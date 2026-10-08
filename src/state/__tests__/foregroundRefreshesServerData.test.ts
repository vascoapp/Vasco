// The app re-reads the server when it returns to the foreground (throttled).
// UK walk, 2026-10-08: the customer accepted in the portal while the
// contractor's app was in the background; the server created the job and set
// the quote accepted, and the app showed neither until a cold start.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';

it('AppState refreshes data on an "active" transition, throttled', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../AppState.tsx'), 'utf8'));
  const block = src.match(/RNAppStateForRefresh\.addEventListener\('change',[\s\S]{0,400}?refreshData\(\)/);
  expect(block).not.toBeNull();
  expect(block![0]).toMatch(/state !== 'active'/);
  expect(block![0]).toMatch(/30_000/);
});
