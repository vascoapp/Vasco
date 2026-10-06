/**
 * THE EVERYDAY MATRIX — the driver. Walks ONE cell (market × customer kind)
 * through the screens a brand-new contractor uses, in their language:
 *
 *   onboarding → business settings → customer form → quote builder →
 *   accept → invoice → View & share PDF → every e-invoice export the market has
 *
 * It presses what a person presses and types what a person types — values
 * written the way that market writes them (cases.ts). Nothing is seeded except
 * an empty account. Every step and every Alert is recorded. When a value
 * written the local way is refused, that refusal is recorded as a finding, the
 * canonical form (`alt`) is tried, and the walk goes on, so one refusal does
 * not hide everything after it. A step that cannot be completed at all stops
 * the cell there.
 *
 * Output: .matrix/out/<cell>/result.json + the artefacts. The verdict is
 * scripts/everyday-matrix-validate.mjs, which runs the OFFICIAL validators.
 */
import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import i18n from 'i18next';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { contactExamples } from '../src/utils/contactExamples';
import { documentNumber } from '../src/domain/documents';
import { capture } from './mocks';
import { everydayCase, expectedTotals, type EverydayCase, type Ident, type Kind, type Market } from './cases';

// ─── recording ──────────────────────────────────────────────────────────────
interface Step { name: string; ok: boolean; detail?: string; alerts?: string[] }
interface AlertRule { title: RegExp; press: RegExp }

const OUT = path.join(process.cwd(), '.matrix', 'out');
const T = (key: string, opts?: any): string => String(i18n.t(key, opts));
/** A translated string, safe inside a RegExp ("Wurde es gesendet?" ends in a quantifier). */
const E = (key: string, opts?: any): string => T(key, opts).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let alertLog: string[] = [];
let rules: AlertRule[] = [];
function installAlerts() {
  return jest.spyOn(Alert, 'alert').mockImplementation((title?: any, body?: any, buttons?: any[]) => {
    alertLog.push(`${title ?? ''}${body ? ` — ${String(body).replace(/\s+/g, ' ').slice(0, 300)}` : ''}${buttons?.length ? ` [${buttons.map((b) => b?.text).join(' | ')}]` : ''}`);
    const rule = rules.find((r) => r.title.test(String(title ?? '')));
    if (rule && buttons) {
      const b = buttons.find((x) => x?.text && rule.press.test(String(x.text)));
      if (b?.onPress) setTimeout(() => b.onPress(), 0);
    }
  });
}
const takeAlerts = () => { const a = alertLog; alertLog = []; return a; };

const settle = async (n = 10) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

// ─── finding controls ───────────────────────────────────────────────────────
const strings = (n: any): string[] => n.findAll((c: any) => typeof c.props?.children === 'string', { deep: true }).map((c: any) => c.props.children as string);
/** Innermost pressables with a text node equal to `text` (or its UPPERCASE, for DKLabel). */
function pressables(root: any, text: string | RegExp): any[] {
  const hit = (s: string) => (typeof text === 'string' ? s === text || s === text.toUpperCase() : text.test(s));
  const all = root.findAll((n: any) => typeof n.props?.onPress === 'function' && strings(n).some(hit), { deep: true });
  return all.filter((n: any) => !all.some((o: any) => o !== n && n.findAll((c: any) => c === o, { deep: true }).length > 0));
}
const byA11y = (root: any, label: string | RegExp) => root.findAll((n: any) => typeof n.props?.onPress === 'function'
  && (typeof label === 'string' ? n.props.accessibilityLabel === label : label.test(String(n.props.accessibilityLabel ?? ''))), { deep: true });
/** HOST text inputs only — a DecimalInput wrapper also carries onChangeText, and typing both resets the value. */
const inputs = (root: any) => root.findAll((n: any) => n.type === 'TextInput' && typeof n.props?.onChangeText === 'function', { deep: true });
const inputByPlaceholder = (root: any, ph: string) => inputs(root).find((n: any) => n.props.placeholder === ph);
/** The text input that follows the label `label` in tree order. */
function inputAfterLabel(root: any, label: string | RegExp): any | undefined {
  const order = root.findAll(() => true, { deep: true });
  const hit = (n: any) => typeof n.props?.children === 'string' && (typeof label === 'string' ? n.props.children === label : label.test(n.props.children));
  const at = order.findIndex(hit);
  if (at < 0) return undefined;
  return order.slice(at + 1).find((n: any) => n.type === 'TextInput' && typeof n.props?.onChangeText === 'function');
}
const isDisabled = (n: any) => !!(n.props.disabled || n.props.accessibilityState?.disabled);

/** Press; never wait more than `maxMs` for the handler (a confirm prompt may wait on the app being foregrounded). */
async function press(node: any, maxMs = 15000) {
  await act(async () => { await Promise.race([Promise.resolve(node.props.onPress?.()), new Promise((r) => setTimeout(r, maxMs))]); });
  await settle();
}
async function type(node: any, value: string) {
  await act(async () => { node.props.onFocus?.(); });
  await act(async () => { node.props.onChangeText(value); });
  await act(async () => { node.props.onBlur?.(); node.props.onEndEditing?.({ nativeEvent: { text: value } }); });
  await settle(2);
}
async function pressText(root: any, text: string | RegExp): Promise<boolean> {
  const p = pressables(root, text);
  if (!p.length) return false;
  await press(p[p.length - 1]);
  return true;
}
/** Open a DKMenu by its anchor (text or a11y) and pick the item whose label matches. */
async function pickMenu(root: any, anchor: { text?: string | RegExp; a11y?: string | RegExp }, item: RegExp): Promise<string | null> {
  const a = anchor.text ? pressables(root, anchor.text) : byA11y(root, anchor.a11y!).filter((n: any) => n.props.accessibilityRole !== undefined || true);
  const anchorNode = a.find((n: any) => n.props.accessibilityRole !== 'menuitem');
  if (!anchorNode) return null;
  await press(anchorNode);
  const items = root.findAll((n: any) => n.props?.accessibilityRole === 'menuitem' && typeof n.props.onPress === 'function', { deep: true });
  const chosen = items.find((n: any) => strings(n).some((s) => item.test(s)));
  if (!chosen) { return `NO ITEM among: ${items.map((n: any) => strings(n).join(' ')).join(' / ')}`; }
  const label = strings(chosen).join(' ');
  await press(chosen);
  return label;
}

/** A DKMenu whose anchor has no label of its own: the first pressable after the heading `label`. */
async function pickMenuAfterLabel(root: any, label: string, item: RegExp): Promise<string | null> {
  const order = root.findAll(() => true, { deep: true });
  const at = order.findIndex((n: any) => typeof n.props?.children === 'string' && n.props.children === label);
  if (at < 0) return null;
  const anchor = order.slice(at + 1).find((n: any) => typeof n.props?.onPress === 'function');
  if (!anchor) return null;
  await press(anchor);
  const items = root.findAll((n: any) => n.props?.accessibilityRole === 'menuitem' && typeof n.props.onPress === 'function', { deep: true });
  const chosen = items.find((n: any) => strings(n).some((x) => item.test(x)));
  if (!chosen) return `NO ITEM among: ${items.map((n: any) => strings(n).join(' ')).join(' / ')}`;
  const got = strings(chosen).join(' ');
  await press(chosen);
  return got;
}

const read = async <X>(key: string, dflt: X): Promise<X> => { const v = await AsyncStorage.getItem(key); return v ? JSON.parse(v) : dflt; };

// ─── the walk ───────────────────────────────────────────────────────────────
const LANG_LABEL: Record<string, string> = { en: 'English', nl: 'Nederlands', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano' };
const COUNTRY_LABEL: Record<Market, string> = { UK: 'United Kingdom', NL: 'Nederland', DE: 'Deutschland', FR: 'France', ES: 'España', IT: 'Italia' };
const BUSINESS_TYPE: Record<Market, string> = { NL: 'eenmanszaak', DE: 'einzelunternehmen', FR: 'eirl', ES: 'autonomo', IT: 'dittaIndividuale', UK: 'limited' };
/** Onboarding step-9 inputs, by their placeholder (app/onboarding.tsx REG_FIELDS). */
const ONBOARDING_FIELDS: Record<Market, Array<{ placeholder: string; from: (c: EverydayCase) => Ident | undefined }>> = {
  NL: [{ placeholder: '12345678', from: (c) => c.seller.regNo }, { placeholder: 'NL123456789B01', from: (c) => c.seller.vatId }],
  DE: [{ placeholder: 'DE123456789', from: (c) => c.seller.vatId }, { placeholder: '12/345/67890', from: (c) => c.seller.taxId }],
  FR: [{ placeholder: '123 456 789 00012', from: (c) => c.seller.regNo }, { placeholder: 'FR12345678901', from: (c) => c.seller.vatId }],
  ES: [{ placeholder: 'ES12345678A', from: (c) => c.seller.vatId }],
  IT: [{ placeholder: 'IT12345678901', from: (c) => c.seller.vatId }],
  UK: [{ placeholder: '01234567', from: (c) => c.seller.regNo }, { placeholder: 'GB123456789', from: (c) => c.seller.vatId }],
};
/** Business-settings identifier inputs, by placeholder (app/(modals)/business-settings.tsx). */
const SETTINGS_FIELDS: Record<Market, Array<{ placeholder: string; from: (c: EverydayCase) => Ident | undefined; what: string }>> = {
  NL: [{ placeholder: '12345678', from: (c) => c.seller.regNo, what: 'KvK' }, { placeholder: 'NL123456789B01', from: (c) => c.seller.vatId, what: 'BTW-id' }],
  DE: [{ placeholder: 'DE123456789', from: (c) => c.seller.vatId, what: 'USt-IdNr' }, { placeholder: '12/345/67890', from: (c) => c.seller.taxId, what: 'Steuernummer' }],
  FR: [{ placeholder: '123 456 789 00012', from: (c) => c.seller.regNo, what: 'SIRET' }, { placeholder: 'FR12345678901', from: (c) => c.seller.vatId, what: 'TVA intracom' }],
  ES: [{ placeholder: '12345678A', from: (c) => c.seller.vatId, what: 'NIF' }],
  IT: [{ placeholder: 'IT12345678901', from: (c) => c.seller.vatId, what: 'Partita IVA' }, { placeholder: 'RSSMRA80A01H501U', from: (c) => c.seller.taxId, what: 'Codice fiscale' }],
  UK: [{ placeholder: '12345678', from: (c) => c.seller.regNo, what: 'Company number' }, { placeholder: 'GB123456789', from: (c) => c.seller.vatId, what: 'VAT number' }],
};

export async function runEverydayCell(market: Market, kind: Kind): Promise<void> {
  const c = everydayCase(market, kind);
  const dir = path.join(OUT, c.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const steps: Step[] = [];
  const result: any = { case: c, expected: expectedTotals(c), steps, artefacts: {}, artefactNotes: {}, refusedNative: [] as string[] };
  const save = () => fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
  const step = (name: string, ok: boolean, detail?: string) => { steps.push({ name, ok, detail, alerts: takeAlerts() }); save(); return ok; };
  const spy = installAlerts();
  // The phone is in front: askWasSent / whenInForeground wait for 'active'.
  try { Object.defineProperty(require('react-native').AppState, 'currentState', { configurable: true, get: () => 'active' }); } catch { /* best effort */ }
  const mounted: any[] = [];
  const walk = async (...a: Parameters<typeof walkScreen>) => { const r = await walkScreen(...a); mounted.push(r); return r; };
  alertLog = []; rules = [];
  const cap = capture(); cap.html.length = 0; cap.shared.length = 0; for (const k of Object.keys(cap.files)) delete cap.files[k];

  try {
    // 0. An empty account: no customers, jobs, quotes, invoices, profile.
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    for (const k of ['@vasco_customers', '@vasco_jobs', '@vasco_quotes', '@vasco_invoices', '@vasco_leads', '@vasco_projects', '@vasco_workers']) await AsyncStorage.setItem(k, '[]');
    await AsyncStorage.setItem('@vasco_line_items', '{}');
    // The live database mints document numbers (next_document_number, migration
    // 20260806000002): prefix Q/I + a 4-digit counter. The fake backend knows
    // the function exists but has no body for it — give it the live one.
    {
      const fake = require('../src/lib/supabase').__fake;
      const counters: Record<string, number> = {};
      fake?.rpc('next_document_number', ({ p_doc_type }: { p_doc_type: 'quote' | 'invoice' }) => {
        counters[p_doc_type] = (counters[p_doc_type] ?? 0) + 1;
        return { data: `${p_doc_type === 'quote' ? 'Q' : 'I'}${String(counters[p_doc_type]).padStart(4, '0')}`, error: null };
      });
    }
    // What sign-up does (AuthContext.signUp): a new account starts the 14-day trial.
    { const sub = require('../src/services/subscriptionService'); const st = await sub.loadSubscription(); if (!st.trialEndsAt && st.tier === 'free') await sub.startTrial(st); }

    // 1. ONBOARDING — the first thing every contractor fills in.
    {
      const r = await walk(require('../app/onboarding').default, { as: 'contractor', language: 'en', settlePasses: 12 });
      if (!step('onboarding mounts', !r.error, r.error?.message)) return;
      // The baseline is only a baseline if the account is EMPTY: demo seeding
      // once put a whole sample company (HRB, REA, tax regime) under the test.
      const seeded = await read<any>('@vasco_business_profile', null);
      const leaked = seeded && Object.keys(seeded).filter((k) => !['isComplete', 'completenessPercent', 'country', 'language'].includes(k) && seeded[k] != null && seeded[k] !== '');
      if (!step('the account starts empty (no demo data)', !leaked?.length && (await read<any[]>('@vasco_customers', [])).length === 0, leaked?.length ? `profile already has: ${leaked.join(', ')}` : '')) return;
      const root = (r.tree as any).root;
      const next = async (label: string) => {
        const p = pressables(root, T('common.next'));
        const btn = p[p.length - 1];
        if (!btn) return step(`onboarding: ${label} → Next`, false, 'no Next button');
        if (isDisabled(btn)) return step(`onboarding: ${label} → Next`, false, 'Next is disabled');
        const before = strings(root).find((x) => /\d+\s*\/\s*\d+|\d+ (of|van|von|de|di|sur) \d+/i.test(x));
        await press(btn);
        const after = strings(root).find((x) => /\d+\s*\/\s*\d+|\d+ (of|van|von|de|di|sur) \d+/i.test(x));
        if (before && after === before) return step(`onboarding: ${label} → Next`, false, `still on "${before}"`);
        return true;
      };
      await pressText(root, T('onboarding.getStarted'));
      await pressText(root, LANG_LABEL[c.language]);
      if (!(await next('language'))) return;
      await pressText(root, COUNTRY_LABEL[market]);
      if (!(await next('country'))) return;
      await pressText(root, T('onboarding.trades.plumbing'));
      if (!(await next('trade'))) return;
      await pressText(root, T('onboarding.goals.less_admin'));
      if (!(await next('goal'))) return;
      await pressText(root, T('onboarding.challenges.invoicing'));
      if (!(await next('challenge'))) return;
      await pressText(root, T('onboarding.teamSizes.solo'));
      if (!(await next('team size'))) return;
      await pressText(root, T(`onboarding.businessTypes.${BUSINESS_TYPE[market]}`));
      if (!(await next('business type'))) return;
      // Step 9: registration numbers, written the local way.
      for (const f of ONBOARDING_FIELDS[market]) {
        const id = f.from(c);
        const input = inputByPlaceholder(root, f.placeholder);
        if (!id || !input) continue;
        await type(input, id.native);
      }
      let p9 = pressables(root, T('common.next'));
      if (p9.length && isDisabled(p9[p9.length - 1])) {
        const refused = ONBOARDING_FIELDS[market].map((f) => f.from(c)).filter((x): x is Ident => !!x?.alt).map((x) => x.native);
        result.refusedNative.push(...refused.map((v) => `onboarding refused ${v}`));
        step('onboarding accepts identifiers written the local way', false, `Next disabled with ${refused.join(', ') || 'the native values'}`);
        for (const f of ONBOARDING_FIELDS[market]) {
          const id = f.from(c);
          const input = inputByPlaceholder(root, f.placeholder);
          if (id?.alt && input) await type(input, id.alt);
        }
        p9 = pressables(root, T('common.next'));
      } else step('onboarding accepts identifiers written the local way', true);
      if (!(await next('registration'))) return;
      // Step 10: plumbing is regulated — pick this market's plumbing certificate.
      const CERT: Record<Market, string> = { NL: 'Uneto-VNI', UK: 'CIPHE', DE: 'Meisterbrief Sanitär', FR: 'Qualibat', ES: 'Carnet instalador', IT: 'Abilitazione idraulica' };
      if (!(await pressText(root, CERT[market]))) step('onboarding: certificate chip', false, `no "${CERT[market]}"`);
      if (!(await next('certificate'))) return;
      const pc = inputs(root).find((n: any) => /\d/.test(String(n.props.placeholder ?? '')));
      if (pc) await type(pc, c.seller.postcode);
      if (!(await next('service area'))) return;
      if (!(await next('info'))) return;
      if (!(await next('plan'))) return;
      const start = byA11y(root, T('onboarding.startUsing'));
      if (!start.length) return void step('onboarding: Start using Vasco', false, 'button not found');
      await press(start[start.length - 1]);
      await settle(20);
      const prof = await read<any>('@vasco_business_profile', {});
      result.profileAfterOnboarding = prof;
      step('onboarding completes and saves the profile', prof?.country === market, `country=${prof?.country} vatNumber=${prof?.vatNumber} kvk=${prof?.kvkNumber} reg=${prof?.registrationNumber}`);
      teardown(r);
    }
    // Onboarding seeds an "Example customer" + example job; a real contractor
    // keeps them. They stay — they are part of day one.

    // 2. BUSINESS SETTINGS — name, address, contact, bank, the rest of the ids.
    {
      const r = await walk(require('../app/(modals)/business-settings').default, { as: 'contractor', language: c.language, settlePasses: 16 });
      if (!step('business settings mounts', !r.error, r.error?.message)) return;
      const root = (r.tree as any).root;
      const ex = { name: 'Schilder & Zonen B.V.' };
      const fill = async (ph: string | undefined, value: string | undefined, what: string) => {
        if (!value) return;
        const input = ph ? inputByPlaceholder(root, ph) : undefined;
        if (!input) { step(`settings has a field for ${what}`, false, `no input with placeholder "${ph}"`); return; }
        await type(input, value);
      };
      const phs = inputs(root).map((n: any) => String(n.props.placeholder ?? ''));
      result.settingsPlaceholders = phs;
      await fill(ex.name, c.seller.name, 'business name');
      const addrPh = phs.find((p: string) => /,/.test(p) && /\d/.test(p));
      await fill(addrPh, c.seller.street, 'address');
      await fill(phs.find((p: string) => p === contactExamples(market as any).postcode) ?? phs.find((p: string) => /^\d{4,5}( [A-Z]{2})?$|^SW1A/.test(p)), c.seller.postcode, 'post code');
      await fill(phs.find((p: string) => ['Amsterdam', 'Berlin', 'Paris', 'Madrid', 'Milano', 'London'].includes(p)), c.seller.city, 'city');
      if (c.seller.province) {
        const prov = inputAfterLabel(root, T('profile.province'));
        if (prov) await type(prov, c.seller.province); else step('settings has a field for province', false);
      }
      await fill(phs.find((p: string) => /@/.test(p)), c.seller.email, 'email');
      await fill(phs.find((p: string) => /^\+\d/.test(p)), c.seller.phone, 'phone');
      if (c.seller.iban) await fill(phs.find((p: string) => /^[A-Z]{2}\d{2} /.test(p)), c.seller.iban, 'IBAN');
      const idFields = SETTINGS_FIELDS[market];
      for (const f of idFields) { const id = f.from(c); if (id) await fill(f.placeholder, id.native, f.what); }
      if (market === 'IT' || market === 'ES') {
        const got = await pickMenuAfterLabel(root, T('profile.personType'), new RegExp(`^${E('settings.personNatural')}$`));
        step('settings: person type = individual', !!got && !got.startsWith('NO ITEM'), got ?? 'menu not found');
      }
      if (market === 'IT') {
        const got = await pickMenuAfterLabel(root, T('profile.fiscalRegime'), /^RF01/);
        step('settings: tax regime = RF01 (ordinario)', !!got && !got.startsWith('NO ITEM'), got ?? 'menu not found');
      }
      const saveBtn = () => byA11y(root, T('common.save')).slice(-1)[0];
      const trySave = async () => { const b = saveBtn(); if (!b) return false; await press(b); await settle(10); return true; };
      if (!(await trySave())) return void step('settings: Save', false, 'no Save button');
      let refusals = takeAlerts();
      if (refusals.length) {
        steps.push({ name: 'settings saves identifiers written the local way', ok: false, alerts: refusals }); save();
        for (const f of idFields) { const id = f.from(c); if (id?.alt) { result.refusedNative.push(`settings refused ${id.native}`); await fill(f.placeholder, id.alt, f.what); } }
        await trySave();
        refusals = takeAlerts();
        if (refusals.length) { steps.push({ name: 'settings saves at all', ok: false, alerts: refusals }); save(); }
      } else step('settings saves identifiers written the local way', true);
      result.profileAfterSettings = await read<any>('@vasco_business_profile', {});
      teardown(r);
    }

    // 3. CUSTOMER — the one customer form.
    let customerId: string | undefined;
    {
      const r = await walk(require('../app/(modals)/customers').default, { as: 'contractor', language: c.language, settlePasses: 12 });
      if (!step('customers screen mounts', !r.error, r.error?.message)) return;
      const root = (r.tree as any).root;
      if (!(await pressText(root, T('customersModal.addCustomer')))) return void step('customers: Add customer', false, 'no add button');
      const b = c.buyer;
      const field = async (key: string, value: string | undefined) => {
        if (!value) return;
        const input = inputAfterLabel(root, T(key));
        if (!input) { step(`customer form has "${T(key)}"`, false); return; }
        await type(input, value);
      };
      await field('customersModal.fieldName', b.name);
      await field('customersModal.fieldEmail', b.email);
      await field('customersModal.fieldAddress', b.street);
      await field('customersModal.fieldPostcode', b.postcode);
      await field('customersModal.fieldCity', b.city);
      if (b.vatId) await field('customersModal.fieldVatId', b.vatId.native);
      if (b.province) await field('customersModal.fieldProvince', b.province);
      if (b.taxId) await field('customersModal.fieldTaxIdIt', b.taxId.native);
      if (b.sdiCode) await field('customersModal.fieldSdiCode', b.sdiCode);
      rules = [{ title: new RegExp(T('contractor.customers.possibleDuplicate')), press: /./ }];
      const submit = () => pressables(root, T('dk.actions.addCustomer').toUpperCase()).slice(-1)[0] ?? pressables(root, T('dk.actions.addCustomer')).slice(-1)[0];
      if (!submit()) return void step('customer form: save', false, 'no save button');
      await press(submit()); await settle(10);
      let alerts = takeAlerts();
      let list = await read<any[]>('@vasco_customers', []);
      let mine = list.find((x) => x.name === b.name);
      if (!mine && b.vatId?.alt) {
        steps.push({ name: 'customer form accepts the VAT id written the local way', ok: false, alerts }); save();
        result.refusedNative.push(`customer form refused ${b.vatId.native}`);
        await field('customersModal.fieldVatId', b.vatId.alt);
        if (submit()) { await press(submit()); await settle(10); }
        alerts = takeAlerts();
        list = await read<any[]>('@vasco_customers', []);
        mine = list.find((x) => x.name === b.name);
      } else if (b.vatId) step('customer form accepts the VAT id written the local way', !!mine);
      rules = [];
      result.customer = mine;
      if (!steps.push({ name: 'customer saved', ok: !!mine, alerts }) || !mine) { save(); return; }
      save();
      customerId = mine.id;
      teardown(r);
    }

    // 4. QUOTE — the builder, with the contractor's own lines (no pricebook on day one).
    let quoteId: string | undefined;
    {
      const r = await walk(require('../app/contractor/tiered-quote').default, { as: 'contractor', language: c.language, settlePasses: 16, params: { customerId: customerId! } });
      if (!step('quote builder mounts', !r.error, r.error?.message)) return;
      const root = (r.tree as any).root;
      for (const l of c.lines) {
        const open = byA11y(root, T('quotes.pickFromPricebook'));
        if (!open.length) return void step('quote: open the service list', false, 'no pricebook tile');
        await press(open[0]);
        const name = inputByPlaceholder(root, T('quotes.customServiceName'));
        const price = inputs(root).find((n: any) => String(n.props.placeholder ?? '').startsWith(T('quotes.customServicePrice', { sym: '' }).replace(/\s*\(.*$/, '')));
        if (!name || !price) return void step('quote: custom service form', false, `name=${!!name} price=${!!price}`);
        await type(name, l.description);
        await type(price, String(l.unitPrice).replace('.', market === 'UK' ? '.' : ','));
        if (!(await pressText(root, T('quotes.addService')))) return void step('quote: Add service', false);
        const a = takeAlerts();
        if (a.length) { steps.push({ name: `quote: add "${l.description}"`, ok: false, alerts: a }); save(); return; }
      }
      // Quantity of the labour line.
      const qtys = inputs(root).filter((n: any) => n.props.accessibilityLabel === T('quotes.quantity'));
      for (let i = 0; i < c.lines.length && i < qtys.length; i++) await type(qtys[i], String(c.lines[i].quantity));
      step('quote: lines + quantities entered', qtys.length >= c.lines.length, `${qtys.length} quantity fields for ${c.lines.length} lines`);
      if (!(await pressText(root, T('quotes.reviewQuote')))) return void step('quote: Review quote', false);
      // The rate menu, where a market has more than one rate: pick the standard one.
      const rateAnchor = pressables(root, T('quotes.vatRateLabel'));
      if (rateAnchor.length) {
        const got = await pickMenu(root, { text: T('quotes.vatRateLabel') }, new RegExp(`(^|\\s)${c.standardRate}\\s?%`));
        step(`quote: VAT rate ${c.standardRate}%`, !!got && !got.startsWith('NO ITEM'), got ?? 'menu not found');
      }
      result.quoteReviewTexts = strings(root).filter((s) => /\d/.test(s)).slice(0, 60);
      rules = [{ title: /./, press: new RegExp(`^(${E('tieredQuote.viewQuote')}|${E('common.continue', { defaultValue: 'Continue' })}|${E('quotes.sendAnyway', { defaultValue: 'Send anyway' })})$`, 'i') }];
      const before = new Set((await read<any[]>('@vasco_quotes', [])).map((q) => q.id));
      // The package name varies: escape the text around it, then let it match anything.
      const create = pressables(root, new RegExp(`^${E('quotes.createPackage', { name: '\u0000' }).replace('\u0000', '.*')}$`, 'i'));
      if (!create.length) return void step('quote: Create', false, 'no create button');
      await press(create[create.length - 1]); await settle(20);
      rules = [];
      const quotes = await read<any[]>('@vasco_quotes', []);
      const q = quotes.find((x) => !before.has(x.id));
      result.quote = q;
      if (!step('quote created', !!q)) return;
      quoteId = q.id;
      teardown(r);
    }

    // 4b. SEND the quote to the customer — the signed portal link (2026-10-06).
    // The fake answered every edge function "not modelled", so the app always
    // took its accept-only FALLBACK here, and a server that refused the app's
    // own quote id (the document number) went unnoticed for weeks. This step
    // asserts what the app SENDS (check:portal-totals proves, live, that the
    // server signs exactly that) and that the PRIMARY message reaches the
    // customer: the portal link, signed by the business.
    {
      const r = await walk(require('../app/quotes/[id]').default, { as: 'contractor', language: c.language, settlePasses: 14, params: { id: quoteId! } });
      if (!step('quote screen mounts (send)', !r.error, r.error?.message)) return;
      const root = (r.tree as any).root;
      const sb = require('../src/lib/supabase').supabase;
      const realInvoke = sb.functions.invoke;
      const calls: Array<{ name: string; body: any }> = [];
      const PORTAL = 'https://admin.vascobuild.com/quote/00000000-0000-4000-8000-0000000000aa?t=matrix';
      sb.functions.invoke = async (name: string, opts: any) => {
        calls.push({ name, body: opts?.body });
        if (name === 'sign-quote-token') return { data: { ok: true, token: 'matrix', url: PORTAL }, error: null };
        return realInvoke(name, opts);
      };
      const { Share } = require('react-native');
      const messages: string[] = [];
      const shareSpy = jest.spyOn(Share, 'share').mockImplementation(async (content: any) => { messages.push(String(content?.message ?? '')); return { action: 'sharedAction' }; });
      rules = [{ title: /./, press: new RegExp(`^(${E('common.yes', { defaultValue: 'Yes' })}|${E('quotes.yesSent', { defaultValue: 'Yes, sent' })})`, 'i') }];
      try {
        // A draft offers it as the "recommended next step" banner (what a
        // contractor taps — the device walk did); later statuses as a button.
        if (!(await pressText(root, T('quotes.recommendedNextStep'))) && !(await pressText(root, T('quotes.sendToCustomer')))) {
          step('quote: Send to customer', false, 'no send action');
        }
        else {
          await settle(20);
          const sign = calls.find((x) => x.name === 'sign-quote-token');
          step('quote link: the app asks sign-quote-token with its quote id (the document number)',
            sign?.body?.quoteId === quoteId, `sent ${JSON.stringify(sign?.body)} for ${quoteId}`);
          const msg = messages[messages.length - 1] ?? '';
          step('quote link: the customer gets the PORTAL link', msg.includes(PORTAL), msg.slice(0, 160));
          step('quote link: the message is signed by the business', msg.includes(c.seller.name), msg.slice(-80));
        }
      } finally {
        sb.functions.invoke = realInvoke;
        shareSpy.mockRestore();
        rules = [];
      }
      teardown(r);
    }

    // 5. ACCEPT the quote (the customer said yes on the phone).
    {
      const r = await walk(require('../app/quotes/[id]').default, { as: 'contractor', language: c.language, settlePasses: 14, params: { id: quoteId! } });
      if (!step('quote screen mounts', !r.error, r.error?.message)) return;
      const root = (r.tree as any).root;
      rules = [
        { title: new RegExp(`^${E('quotes.acceptQuote')}$`), press: new RegExp(`^${E('quotes.accept')}$`) },
        { title: /./, press: new RegExp(`^${E('common.close', { defaultValue: 'Close' })}$`, 'i') },
      ];
      const acc = byA11y(root, T('quotes.accept'));
      if (!acc.length) return void step('quote: Accept', false, 'no Accept tile');
      await press(acc[acc.length - 1]); await settle(20);
      rules = [];
      const q = (await read<any[]>('@vasco_quotes', [])).find((x) => x.id === quoteId);
      step('quote accepted', q?.status === 'accepted', `status=${q?.status}`);
      teardown(r);
    }

    // 6. INVOICE from the quote.
    let invoiceId: string | undefined;
    {
      const r = await walk(require('../app/quotes/[id]/invoice').default, { as: 'contractor', language: c.language, settlePasses: 14, params: { id: quoteId! } });
      if (!step('quote → invoice screen mounts', !r.error, r.error?.message)) return;
      const root = (r.tree as any).root;
      const before = new Set((await read<any[]>('@vasco_invoices', [])).map((x) => x.id));
      const btn = byA11y(root, T('quoteToInvoice.createInvoice'));
      if (!btn.length) return void step('Create invoice', false, 'no button');
      await press(btn[btn.length - 1]); await settle(20);
      const inv = (await read<any[]>('@vasco_invoices', [])).find((x) => !before.has(x.id));
      if (!step('invoice created', !!inv)) return;
      invoiceId = inv.id;
      result.invoiceNumber = documentNumber(inv);
      teardown(r);
    }

    // 7. THE INVOICE — PDF, then every e-invoice export this market has.
    {
      const r = await walk(require('../app/invoices/[id]').default, { as: 'contractor', language: c.language, settlePasses: 16, params: { id: invoiceId! } });
      if (!step('invoice screen mounts', !r.error, r.error?.message)) return;
      const root = (r.tree as any).root;
      const inv = (await read<any[]>('@vasco_invoices', [])).find((x) => x.id === invoiceId);
      result.invoice = inv;
      result.invoiceLines = (await read<Record<string, any[]>>('@vasco_line_items', {}))[invoiceId!] ?? null;
      // "Did it go out?" / "Did you file it?" — not yet: we only want the file.
      // Germany asks for the date of the work before the first document — the
      // contractor did the job today. Then "Did it go out?" / "Did you file
      // it?" — not yet: we only want the file.
      rules = [
        { title: new RegExp(`^${E('invoices.serviceDateAskTitle')}$`), press: new RegExp(`^${E('invoices.serviceDateToday')}$`) },
        // The PDF went to the customer: "yes, sent" — so the invoice is issued
        // and belongs in the VAT report (step 8). E-invoices: not filed by us.
        { title: new RegExp(`^${E('share.sentTitle')}$`), press: new RegExp(`^${E('share.sentYes')}$`) },
        { title: /./, press: new RegExp(`^(${E('share.sentNo')}|${E('einvoice.filedNotYet')})$`) },
      ];

      const htmlBefore = capture().html.length;
      if (!(await pressText(root, T('invoices.viewSharePdf')))) step('View & share PDF', false, 'no button');
      else {
        await wait(900); await settle(10);
        const html = capture().html.slice(htmlBefore).pop();
        if (html) { fs.writeFileSync(path.join(dir, 'invoice.html'), html); result.artefacts.pdf = 'invoice.html'; }
        step('View & share PDF produces the invoice', !!html);
      }
      const exportFile = async (fmt: string, label: string, pick: (name: string) => boolean) => {
        const before = new Set(Object.keys(capture().files));
        const sharedBefore = capture().shared.length;
        if (!(await pressText(root, label))) { result.artefactNotes[fmt] = `no "${label}" button`; return step(`${fmt}: export button`, false, `no "${label}"`); }
        await wait(fmt === 'zugferd' || fmt === 'facturx' ? 4000 : 900); await settle(20);
        const name = Object.keys(capture().files).find((n) => !before.has(n) && pick(n));
        if (!name) { result.artefactNotes[fmt] = 'pressed; nothing was written'; return step(`${fmt}: file written`, false); }
        const data = capture().files[name];
        const out = `${fmt}${name.endsWith('.pdf') ? '.pdf' : name.endsWith('.xsig') ? '.xsig' : '.xml'}`;
        fs.writeFileSync(path.join(dir, out), typeof data === 'string' ? data : Buffer.from(data));
        result.artefacts[fmt] = out;
        return step(`${fmt}: file written and shared`, capture().shared.length > sharedBefore, name);
      };
      if (c.formats.includes('xrechnung')) await exportFile('xrechnung', T('invoices.exportXRechnung'), (n) => n.endsWith('.xml'));
      if (c.formats.includes('zugferd')) await exportFile('zugferd', T('invoices.exportZugferd'), (n) => n.endsWith('.pdf'));
      if (c.formats.includes('facturx')) await exportFile('facturx', T('invoices.exportFacturX'), (n) => n.endsWith('.pdf'));
      if (c.formats.includes('facturae')) await exportFile('facturae', T('invoices.exportFacturae'), (n) => /\.(xml|xsig)$/.test(n));
      if (c.formats.includes('fatturapa')) await exportFile('fatturapa', T('invoices.exportFatturaPA'), (n) => n.endsWith('.xml'));
      rules = [];
      teardown(r);
    }

    // 8. THE VAT REPORT — this quarter, which now holds this one invoice.
    {
      const inv = (await read<any[]>('@vasco_invoices', [])).find((x) => x.id === invoiceId);
      step('invoice is issued after "yes, sent"', !!inv && inv.status !== 'draft', `status=${inv?.status}`);
      const r = await walk(require('../app/contractor/vat-prep').default, { as: 'contractor', language: c.language, settlePasses: 14, params: { period: 'current' } });
      if (!step('VAT report mounts', !r.error, r.error?.message)) return;
      const root = (r.tree as any).root;
      const textOf = (id: string) => {
        const n = root.findAll((x: any) => x.props?.testID === id, { deep: true })[0];
        const ch = n?.props?.children;
        return Array.isArray(ch) ? ch.join('') : String(ch ?? '');
      };
      result.vatReport = { salesNet: textOf('vat-report-sales-net'), salesVat: textOf('vat-report-sales-vat'), purchasesVat: textOf('vat-report-purchases-vat'), balance: textOf('vat-report-balance') };
      step('VAT report shows figures', !!result.vatReport.salesVat, JSON.stringify(result.vatReport));
      teardown(r);
    }
  } catch (e) {
    step('walk finished without a crash', false, e instanceof Error ? `${e.message}\n${e.stack?.split('\n').slice(0, 4).join('\n')}` : String(e));
  } finally {
    save();
    for (const r of mounted) { try { teardown(r); } catch { /* already unmounted */ } }
    spy.mockRestore();
  }
}
