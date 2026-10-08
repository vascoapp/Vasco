// UK walk, 2026-10-08: UK invoices asked to be paid to an IBAN; UK customers
// pay by sort code + account number.
import { bankTransferLine, formatSortCode, isValidSortCode, isValidUkAccountNumber } from '../bankDetails';

const L = { sortCode: 'Sort code', account: 'Account', routing: 'Routing #' };

it('a UK business is paid by sort code and account', () => {
  expect(bankTransferLine({ country: 'UK', routingNumber: '202015', bankAccountNumber: '55555555', iban: 'GB33BUKB20201555555555' }, L))
    .toBe('Sort code 20-20-15 · Account 55555555');
});

it('a UK business with only an IBAN still says where to pay', () => {
  expect(bankTransferLine({ country: 'UK', iban: 'GB33BUKB20201555555555' }, L)).toBe('GB33BUKB20201555555555');
});

it('EU markets keep the IBAN; the US its routing + account', () => {
  expect(bankTransferLine({ country: 'NL', iban: 'NL91ABNA0417164300', routingNumber: '1' }, L)).toBe('NL91ABNA0417164300');
  expect(bankTransferLine({ country: 'US', routingNumber: '123456789', bankAccountNumber: '000123' }, L)).toBe('Routing # 123456789 · Account 000123');
  expect(bankTransferLine({ country: 'NL' }, L)).toBeNull();
});

it('sort codes and account numbers are recognised in the forms people type them', () => {
  expect(formatSortCode('20 20 15')).toBe('20-20-15');
  expect(isValidSortCode('20-20-15')).toBe(true);
  expect(isValidSortCode('2020')).toBe(false);
  expect(isValidUkAccountNumber('5555 5555')).toBe(true);
  expect(isValidUkAccountNumber('555')).toBe(false);
});
