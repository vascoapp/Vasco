/**
 * Customer messages are signed by the business (UK walk, 2026-10-08: the
 * follow-up draft ended "Kind regards" and nothing under it).
 */
import fs from 'fs';
import path from 'path';
import { signCustomerMessage } from '../signCustomerMessage';
import { stripComments } from '../stripComments';

it('appends the business name under the sign-off', () => {
  expect(signCustomerMessage('Dear Sarah,\n\nKind regards', 'Hughes Plumbing')).toBe('Dear Sarah,\n\nKind regards\nHughes Plumbing');
});

it('does not sign twice, and leaves the text alone without a name', () => {
  expect(signCustomerMessage('Kind regards\nHughes Plumbing', 'Hughes Plumbing')).toBe('Kind regards\nHughes Plumbing');
  expect(signCustomerMessage('Kind regards', '  ')).toBe('Kind regards');
});

it('every site that drafts a customer message from a sign-off template signs it', () => {
  const ROOT = path.resolve(__dirname, '../../..');
  const sites: Array<[string, RegExp]> = [
    ['app/(contractor)/ai.tsx', /signCustomerMessage\(\s*(tidyCopy\()?t\('ai\.(reminderMessage|followUpMessage|confirmMessage)'/g],
    ['src/intelligence/actionExecutor.ts', /message: signCustomerMessage\(text\)/g],
    ['src/services/customerQuoteAcceptanceService.ts', /signCustomerMessage\(body/g],
  ];
  const counts = sites.map(([f, re]) => [f, (stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).match(re) ?? []).length]);
  expect(counts).toEqual([['app/(contractor)/ai.tsx', 3], ['src/intelligence/actionExecutor.ts', 2], ['src/services/customerQuoteAcceptanceService.ts', 1]]);
});
