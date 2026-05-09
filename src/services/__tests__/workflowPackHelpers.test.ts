/**
 * R66r49 #12 — Unit tests for workflowPackService helpers.
 *
 * Locks the small but high-leverage helpers added in R66r49 #5-#8 that
 * had zero coverage:
 *   - toE164(phone, country)            R66r49 #6 — WhatsApp deep-link wire
 *   - buildWhatsAppUrl(e164, message)   R66r49 #6
 *   - pickTemplateForLocale(step, loc)  R66r49 #5 — defaults → i18nKey → template
 *   - isMatchMuted(mutes, ids...)       R66r49 #6 — wildcard mute resolution
 *   - getPackMutes / addPackMute / muteCustomerForPack — round-trip
 *   - hasSuggestedPack / markPackSuggested — discovery hook idempotency
 *
 * A regression in any of these silently breaks a launch-day feature
 * (paste-into-WhatsApp, locale fallback for non-NL contractors, customer
 * mute escape valve, pack discovery one-shot semantics).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock i18n so pickTemplateForLocale tests are deterministic regardless of
// jest's i18next initialization state.
jest.mock('../../i18n/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    t: (key: string, options?: any) => {
      // For these tests, only return a value when the test explicitly
      // sets up a key→value map. Otherwise return the key unchanged
      // so pickTemplateForLocale's "did i18n resolve?" check fails through.
      const map = (globalThis as any).__i18nMap as Record<string, string> | undefined;
      if (map && map[key]) return map[key];
      return options?.defaultValue ?? key;
    },
  },
}));

import {
  toE164,
  buildWhatsAppUrl,
  pickTemplateForLocale,
  isMatchMuted,
  getPackMutes,
  addPackMute,
  removePackMute,
  muteCustomerForPack,
  hasSuggestedPack,
  markPackSuggested,
  type WorkflowStep,
  type PackMute,
} from '../workflowPackService';

function clearStorage() {
  const store = (globalThis as any).__asyncStorageMock;
  if (store) Object.keys(store).forEach((k) => delete store[k]);
}

beforeEach(() => {
  clearStorage();
  (globalThis as any).__i18nMap = undefined;
});

// ─────────────────────────────────────────────────────────────────────────
// toE164 — WhatsApp deep-link phone normalisation
// ─────────────────────────────────────────────────────────────────────────

describe('toE164', () => {
  it('NL: leading 0 → +31 country code prepended (06 12 34 56 78)', () => {
    expect(toE164('06 12 34 56 78', 'NL')).toBe('31612345678');
  });

  it('NL: 00 international prefix stripped (0031 6 ... → 31 6 ...)', () => {
    expect(toE164('0031 612 345 678', 'NL')).toBe('31612345678');
  });

  it('NL: + prefix tolerated (non-digits stripped before parsing)', () => {
    expect(toE164('+31 6 12 34 56 78', 'NL')).toBe('31612345678');
  });

  it('NL: parens + dashes tolerated (non-digits stripped, leading 0 still triggers country-code prepend)', () => {
    expect(toE164('(06) 1234-5678', 'NL')).toBe('31612345678');
  });

  it('UK: leading 0 → +44 country code prepended (07700 900 123)', () => {
    expect(toE164('07700 900123', 'UK')).toBe('447700900123');
  });

  it('DE: leading 0 → +49 country code prepended', () => {
    expect(toE164('0151 23456789', 'DE')).toBe('4915123456789');
  });

  it('FR: leading 0 → +33 country code prepended', () => {
    expect(toE164('06 12 34 56 78', 'FR')).toBe('33612345678');
  });

  it('ES: leading 0 → +34 country code prepended (Spain mobile starts with 6/7)', () => {
    // Spanish numbers don't have leading 0 in domestic format, but tolerate it.
    expect(toE164('612 345 678', 'ES')).toBe('34612345678');
  });

  it('IT: leading 0 → +39 country code prepended', () => {
    expect(toE164('0612345678', 'IT')).toBe('39612345678');
  });

  it('default to NL when no country provided', () => {
    expect(toE164('06 12 34 56 78')).toBe('31612345678');
  });

  it('returns null for empty / whitespace / undefined', () => {
    expect(toE164(undefined)).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164('   ')).toBeNull();
    expect(toE164('---')).toBeNull(); // strips to empty
  });

  it('long international number with country code already present skips re-prepend', () => {
    // 11-digit number starting with 31 (NL country code) → don't re-prepend.
    expect(toE164('31612345678', 'NL')).toBe('31612345678');
    expect(toE164('44 7700 900 123', 'UK')).toBe('447700900123');
  });

  it('ignores letters and non-digits but keeps the digits', () => {
    // 'call me at 06-12345678' → digits '0612345678' → leading-0 path → '31612345678'
    expect(toE164('call me at 06-12345678', 'NL')).toBe('31612345678');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildWhatsAppUrl
// ─────────────────────────────────────────────────────────────────────────

describe('buildWhatsAppUrl', () => {
  it('builds wa.me URL with URL-encoded message body', () => {
    expect(buildWhatsAppUrl('31612345678', 'Hi there')).toBe(
      'https://wa.me/31612345678?text=Hi%20there',
    );
  });

  it('escapes the euro sign (multi-byte UTF-8) in template body', () => {
    const url = buildWhatsAppUrl('31612345678', 'Invoice (€2.450)');
    expect(url).toContain('%E2%82%AC'); // euro sign — encodeURIComponent encodes UTF-8
    // Note: parens, dots, commas are NOT escaped by encodeURIComponent
    // (they're RFC 3986 "unreserved"/"sub-delims"). WhatsApp tolerates them.
  });

  it('escapes ampersand so it does not become a URL parameter', () => {
    const url = buildWhatsAppUrl('31612345678', 'Pay & confirm');
    // & must be %26, not & — otherwise WhatsApp parses it as a separate param.
    expect(url).toContain('%26');
    expect(url.split('?text=')[1]).not.toContain('&');
  });

  it('escapes newlines (which WA Business deep-link strips otherwise)', () => {
    const url = buildWhatsAppUrl('31612345678', 'Line 1\nLine 2');
    expect(url).toContain('%0A');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// pickTemplateForLocale — defaults[locale] → i18nKey → template
// ─────────────────────────────────────────────────────────────────────────

describe('pickTemplateForLocale', () => {
  const mkStep = (overrides: Partial<WorkflowStep> = {}): WorkflowStep => ({
    trigger: 'invoice_overdue',
    delayDays: 7,
    action: 'send_reminder',
    channel: 'email',
    template: 'NL fallback {{customer}}',
    ...overrides,
  });

  it('priority 1: defaults[locale] wins over i18nKey + template', () => {
    (globalThis as any).__i18nMap = {
      'workflowPacks.test.reminder': 'STALE I18N VALUE',
    };
    const step = mkStep({
      i18nKey: 'workflowPacks.test.reminder',
      defaults: { en: 'EN default {{customer}}', de: 'DE default' },
    });
    expect(pickTemplateForLocale(step, 'en')).toBe('EN default {{customer}}');
    // R66r49 #5: priority was flipped specifically because i18n had stale
    // pre-R49 values — defaults must win.
  });

  it('priority 2: i18nKey wins over template when defaults missing for locale', () => {
    (globalThis as any).__i18nMap = {
      'workflowPacks.test.reminder': 'I18N value for fr',
    };
    const step = mkStep({
      i18nKey: 'workflowPacks.test.reminder',
      defaults: { en: 'EN only' }, // no fr default
    });
    expect(pickTemplateForLocale(step, 'fr')).toBe('I18N value for fr');
  });

  it('priority 3: template fallback when no defaults + no resolvable i18nKey', () => {
    const step = mkStep({
      i18nKey: 'workflowPacks.test.does_not_exist',
      // no defaults
    });
    expect(pickTemplateForLocale(step, 'fr')).toBe('NL fallback {{customer}}');
  });

  it('handles missing i18nKey field entirely', () => {
    const step = mkStep({
      defaults: { en: 'EN-only step' },
    });
    expect(pickTemplateForLocale(step, 'en')).toBe('EN-only step');
    expect(pickTemplateForLocale(step, 'de')).toBe('NL fallback {{customer}}');
  });

  it('NL contractor always gets template (no defaults.nl needed)', () => {
    const step = mkStep({
      defaults: { en: 'EN', de: 'DE', fr: 'FR', es: 'ES', it: 'IT' },
    });
    expect(pickTemplateForLocale(step, 'nl')).toBe('NL fallback {{customer}}');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// isMatchMuted — 5 wildcard key combinations
// ─────────────────────────────────────────────────────────────────────────

describe('isMatchMuted', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const mute = (key: string): Record<string, PackMute> => ({
    [key]: { packId: 'incasso_auto', mutedUntil: future },
  });

  it('global wildcard *|*|* mutes everything', () => {
    expect(isMatchMuted(mute('*|*|*'), 'incasso_auto', 'cust-1', 'inv-1')).toBe(true);
    expect(isMatchMuted(mute('*|*|*'), 'offerte_opvolging', 'cust-2', 'q-1')).toBe(true);
  });

  it('pack-wildcard packId|*|* mutes only that pack', () => {
    const m = mute('incasso_auto|*|*');
    expect(isMatchMuted(m, 'incasso_auto', 'cust-1', 'inv-1')).toBe(true);
    expect(isMatchMuted(m, 'offerte_opvolging', 'cust-1', 'inv-1')).toBe(false);
  });

  it('pack+customer wildcard packId|customerId|* mutes that pack-customer pair', () => {
    const m = mute('incasso_auto|cust-1|*');
    expect(isMatchMuted(m, 'incasso_auto', 'cust-1', 'inv-1')).toBe(true);
    expect(isMatchMuted(m, 'incasso_auto', 'cust-1', 'inv-99')).toBe(true);
    expect(isMatchMuted(m, 'incasso_auto', 'cust-2', 'inv-1')).toBe(false);
  });

  it('full-specific packId|customerId|entityId mutes only that exact triple', () => {
    const m = mute('incasso_auto|cust-1|inv-1');
    expect(isMatchMuted(m, 'incasso_auto', 'cust-1', 'inv-1')).toBe(true);
    expect(isMatchMuted(m, 'incasso_auto', 'cust-1', 'inv-2')).toBe(false);
    expect(isMatchMuted(m, 'incasso_auto', 'cust-2', 'inv-1')).toBe(false);
  });

  it('empty mutes never match', () => {
    expect(isMatchMuted({}, 'incasso_auto', 'cust-1', 'inv-1')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Pack mute store round-trip
// ─────────────────────────────────────────────────────────────────────────

describe('Pack mute store', () => {
  it('addPackMute → getPackMutes round-trip', async () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    await addPackMute({ packId: 'incasso_auto', customerId: 'cust-1', mutedUntil: future });

    const all = await getPackMutes();
    expect(Object.keys(all)).toHaveLength(1);
    expect(all['incasso_auto|cust-1|*']).toBeDefined();
    expect(all['incasso_auto|cust-1|*'].packId).toBe('incasso_auto');
  });

  it('removePackMute deletes by key', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    await addPackMute({ packId: 'incasso_auto', customerId: 'cust-1', mutedUntil: future });
    await removePackMute({ packId: 'incasso_auto', customerId: 'cust-1' });

    const all = await getPackMutes();
    expect(Object.keys(all)).toHaveLength(0);
  });

  it('muteCustomerForPack stores 90d default + correct key shape', async () => {
    await muteCustomerForPack('incasso_auto', 'cust-42');

    const all = await getPackMutes();
    expect(all['incasso_auto|cust-42|*']).toBeDefined();
    const mutedAt = Date.parse(all['incasso_auto|cust-42|*'].mutedUntil);
    const expected = Date.now() + 90 * 86400000;
    // ±60s tolerance for clock drift in jest
    expect(Math.abs(mutedAt - expected)).toBeLessThan(60_000);
  });

  it('expired mutes are auto-pruned on read', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    await AsyncStorage.setItem(
      '@vasco_pack_mutes',
      JSON.stringify({
        'a|cust|*': { packId: 'a', customerId: 'cust', mutedUntil: past },
        'b|cust|*': { packId: 'b', customerId: 'cust', mutedUntil: future },
      }),
    );

    const all = await getPackMutes();
    expect(Object.keys(all)).toEqual(['b|cust|*']);
  });

  it('overwriting same key updates the value (idempotent re-mute)', async () => {
    const t1 = new Date(Date.now() + 86400000).toISOString();
    const t2 = new Date(Date.now() + 30 * 86400000).toISOString();
    await addPackMute({ packId: 'p', customerId: 'c', mutedUntil: t1 });
    await addPackMute({ packId: 'p', customerId: 'c', mutedUntil: t2 });

    const all = await getPackMutes();
    expect(Object.keys(all)).toHaveLength(1);
    expect(all['p|c|*'].mutedUntil).toBe(t2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Pack discovery one-shot semantics
// ─────────────────────────────────────────────────────────────────────────

describe('hasSuggestedPack / markPackSuggested', () => {
  it('hasSuggestedPack returns false initially', async () => {
    expect(await hasSuggestedPack('incasso_auto')).toBe(false);
  });

  it('markPackSuggested → hasSuggestedPack returns true', async () => {
    await markPackSuggested('incasso_auto');
    expect(await hasSuggestedPack('incasso_auto')).toBe(true);
  });

  it('discovery is per-pack (marking one does not affect another)', async () => {
    await markPackSuggested('incasso_auto');
    expect(await hasSuggestedPack('incasso_auto')).toBe(true);
    expect(await hasSuggestedPack('klant_keuze_herinnering')).toBe(false);
  });
});
