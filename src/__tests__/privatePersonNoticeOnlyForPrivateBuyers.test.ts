/**
 * The German "Als Privatperson sind Sie verpflichtet, diese Rechnung zwei Jahre
 * aufzubewahren" notice (§14 Abs. 4 Satz 1 Nr. 9 UStG) is for a PRIVATE buyer.
 * German walk, 2026-10-06: it was printed on every German invoice, including
 * one to a GmbH with a USt-IdNr.
 */
import * as fs from 'fs';
import * as path from 'path';
import { legalMentions } from '../services/invoicePdfService';
import { stripComments } from '../utils/stripComments';

it('a business buyer gets no private-person notice; a private buyer does', () => {
  expect(legalMentions('DE', { buyerIsBusiness: true })).toEqual([]);
  expect(legalMentions('DE', { buyerIsBusiness: false })[0]).toMatch(/Als Privatperson/);
  expect(legalMentions('DE')[0]).toMatch(/Als Privatperson/);
});

it('both the PDF and the ZUGFeRD hybrid pass who the buyer is', () => {
  const pdf = stripComments(fs.readFileSync(path.join(__dirname, '../services/invoicePdfService.ts'), 'utf8'));
  expect(pdf).toMatch(/legalMentions\(country, \{ buyerIsBusiness: !!invoice\.customerVatId \}\)/);
  const screen = stripComments(fs.readFileSync(path.join(__dirname, '../../app/invoices/[id].tsx'), 'utf8'));
  expect(screen).toMatch(/legalMentions\(country, \{ buyerIsBusiness: !!data\.buyerVatId \}\)/);
});
