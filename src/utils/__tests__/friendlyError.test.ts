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
    // English internals a screen could reach (walk 2026-09-29).
    'Not authenticated',
    'Invalid weather API response',
    'Unknown action type: foo',
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

// The deposit path threw English SENTENCES ("Stripe payment link creation
// failed", "…could not be saved to the tracker. Try again.") that read as a
// person's text and passed straight into a Dutch or German alert (walk
// 2026-09-29). They are localized at the throw now.
it('the tracker-deposit path throws only localized reasons', () => {
  const fs = require('fs');
  const path = require('path');
  const src: string = fs.readFileSync(path.resolve(__dirname, '../../state/AppState.tsx'), 'utf8');
  const start = src.indexOf('requestTrackerDeposit: async');
  expect(start).toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf('return checkoutUrl;', start));
  expect(body).not.toMatch(/throw new Error\(\s*['`]/);
  expect((body.match(/throw new Error\(appI18n\.t\(/g) ?? []).length).toBe(3);
});
