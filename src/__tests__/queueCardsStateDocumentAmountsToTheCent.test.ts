/**
 * A queue card that names ONE invoice or quote states its amount to the cent.
 * FR walk, 2026-10-06: "Factur-X: Chauffe-eau · € 1489" for a € 1 488,60
 * invoice. Totals and savings estimates may stay whole euros.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

it('invoice and quote amounts on queue cards use formatMoney2', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../services/aiActionQueueService.ts'), 'utf8'));
  expect(src).not.toMatch(/formatMoney\(\(?(inv|q|quote)\.amount/);
  expect((src.match(/formatMoney2\(\((inv|q|quote)\.amount/g) ?? []).length).toBeGreaterThanOrEqual(4);
});
