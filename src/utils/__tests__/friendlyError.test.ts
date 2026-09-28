import { friendlyError, isMachineMessage } from '../friendlyError';

jest.mock('../errorHandler', () => ({ logError: jest.fn() }));

describe('friendlyError', () => {
  const fb = 'Probeer het opnieuw.';
  it.each([
    'Edge Function returned a non-2xx status code',
    'Network request failed',
    'TypeError: Cannot read properties of undefined (reading \'id\')',
    'new row violates row-level security policy for table "documents"',
    'duplicate key value violates unique constraint "documents_pkey"',
    'PGRST204',
    'Server misconfigured',
    'Supabase not configured',
    'Price ID missing for pro/monthly',
    'Request timed out',
    'HTTP 503 Service Unavailable',
    'illegal transition submitted -> accepted',
    'Quote Q-1 not found',
    'refusing to lower the invoice counter: 41 numbers already issued',
    'No checkout URL returned',
    'Invalid login credentials',
    "Cannot read properties of null (reading 'id')",
    '',
  ])('hides machine text: %s', (m) => {
    expect(isMachineMessage(m)).toBe(true);
    expect(friendlyError(new Error(m), fb)).toBe(fb);
    expect(friendlyError({ ok: false, error: m }, fb)).toBe(fb);
  });

  it.each([
    'Er is geen afgesproken prijs en er zijn geen gewerkte uren geboekt.',
    'Die Rechnung hat keine Positionen.',
    'Cannot move numbering backwards: F-2026-0041 already exists.',
    'Aucune heure enregistrée pour ce chantier.',
    'Het minimum voor een aanbetaling is € 500.',
    'Diese Auswahl ergibt null oder weniger — es gibt nichts abzurechnen.',
    'Le jeton est invalide ou expiré.',
    'Factuur F-2026-0404 bestaat al.',
  ])('keeps our own reasons: %s', (m) => {
    expect(isMachineMessage(m)).toBe(false);
    expect(friendlyError(new Error(m), fb)).toBe(m);
  });

  it('non-errors fall back', () => {
    expect(friendlyError(undefined, fb)).toBe(fb);
    expect(friendlyError(42, fb)).toBe(fb);
  });
});
