/**
 * Account deletion: export, then delete (user's decision 2026-09-24).
 *
 * Three screens each started a deletion their own way and all promised that
 * "financial records will be anonymised per EU retention law" — untrue (the
 * auth cascade erased them) and not Vasco's duty. Now one screen: the
 * contractor sees their retention duty, can download everything, must
 * acknowledge it, and only then can delete.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';

const mockRequest = jest.fn(async () => ({ success: true, serverRequested: true, localCleared: true }));
const mockExport = jest.fn(async (): Promise<any> => ({ success: true, complete: true, keyCount: 3 }));
let mockAuthed: string | null = 'aaaaaaaa-1111-4111-8111-000000000001';
let mockCountry: string | undefined = 'DE';
jest.mock('../src/services/accountDeletionService', () => ({ requestAccountDeletion: (...a: any[]) => (mockRequest as any)(...a) }));
jest.mock('../src/services/dataExportService', () => ({ exportAllData: (...a: any[]) => (mockExport as any)(...a) }));
const mockArchive = jest.fn(async (): Promise<any> => ({ ok: true, invoiceCount: 2, pdfFailed: [], xmlMissing: [], complete: true }));
jest.mock('../src/services/recordsArchiveService', () => ({ exportRecordsArchive: (...a: any[]) => (mockArchive as any)(...a) }));
jest.mock('../src/lib/currentUser', () => ({ ...jest.requireActual('../src/lib/currentUser'), getAuthedUserId: () => mockAuthed }));
jest.mock('../src/state/AppState', () => ({ useAppState: () => ({ businessProfile: { country: mockCountry }, invoices: [], lineItems: {}, customers: [], jobs: [] }) }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'x', email: 'a@b.de' }, logout: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }) }));

import i18n from '../src/i18n/i18n';
beforeAll(async () => { await i18n.changeLanguage('en'); });

const Screen = () => require('../app/contractor/delete-account').default;
const texts = (root: any) => root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children).join(' | ');
const button = (root: any, re: RegExp) => root.findAll(
  (n: any) => typeof n.props?.onPress === 'function' && n.findAll((c: any) => typeof c.props?.children === 'string' && re.test(c.props.children), { deep: true }).length > 0,
  { deep: true },
).pop();

async function render() {
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  return tree;
}

beforeEach(() => { mockRequest.mockClear(); mockExport.mockClear(); mockAuthed = 'aaaaaaaa-1111-4111-8111-000000000001'; mockCountry = 'DE'; });

it('shows the country retention duty — 8 years for Germany, no number when unknown', async () => {
  let tree = await render();
  expect(texts(tree.root)).toMatch(/\b8\b/);
  tree.unmount();
  mockCountry = undefined;
  tree = await render();
  expect(texts(tree.root)).not.toMatch(/\{\{years\}\}|\b(6|7|8|10) (years|Jahre|jaar)\b/);
  tree.unmount();
});

it('cannot delete until the duty is acknowledged; then deletes through the one service', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: any) => {
    const destructive = buttons?.find((b: any) => b.style === 'destructive');
    destructive?.onPress?.();
  });
  const tree = await render();
  const del = button(tree.root, /delete my account permanently|endgültig|definitief|definitivamente|définitivement/i);
  expect(del.props.disabled).toBe(true);
  const ack = tree.root.findAll((n: any) => typeof n.props?.onValueChange === 'function', { deep: true })[0];
  await act(async () => { ack.props.onValueChange(true); });
  const del2 = button(tree.root, /delete my account permanently|endgültig|definitief|definitivamente|définitivement/i);
  expect(del2.props.disabled).toBe(false);
  await act(async () => { await del2.props.onPress(); await new Promise((r) => setTimeout(r, 0)); });
  expect(mockRequest).toHaveBeenCalledWith('aaaaaaaa-1111-4111-8111-000000000001');
  alert.mockRestore();
  tree.unmount();
});

it('no session: nothing is claimed and nothing is requested', async () => {
  mockAuthed = null;
  const seen: string[] = [];
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((title: any, _m, buttons?: any) => {
    seen.push(String(title));
    buttons?.find((b: any) => b.style === 'destructive')?.onPress?.();
  });
  const tree = await render();
  const ack = tree.root.findAll((n: any) => typeof n.props?.onValueChange === 'function', { deep: true })[0];
  await act(async () => { ack.props.onValueChange(true); });
  const del = button(tree.root, /delete my account permanently|endgültig|definitief|definitivamente|définitivement/i);
  await act(async () => { await del.props.onPress(); await new Promise((r) => setTimeout(r, 0)); });
  expect(mockRequest).not.toHaveBeenCalled();
  expect(seen.join(' ')).not.toMatch(/requested|beantragt|aangevraagd/i);
  alert.mockRestore();
  tree.unmount();
});

it('a complete export is reported; an incomplete one is not — it says it failed', async () => {
  const DL = /download all my data/i;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let tree = await render();
  await act(async () => { await button(tree.root, DL).props.onPress(); });
  expect(mockExport).toHaveBeenCalled();
  expect(texts(tree.root)).toMatch(/export created/i);
  expect(alert).not.toHaveBeenCalled();
  tree.unmount();

  // Offline or a table unread: the device cache is NOT the contractor's records.
  for (const result of [{ success: true, complete: false }, { success: true }, { success: false }]) {
    mockExport.mockImplementationOnce(async () => result);
    tree = await render();
    await act(async () => { await button(tree.root, DL).props.onPress(); });
    expect(texts(tree.root)).not.toMatch(/export created/i);
    expect(alert).toHaveBeenCalled();
    alert.mockClear();
    tree.unmount();
  }
  alert.mockRestore();
});

it('the invoices archive: created, partial (warns), no-format only (no warning), failed', async () => {
  const ARCH = /download all invoices/i;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const press = async () => {
    const tree = await render();
    await act(async () => { await button(tree.root, ARCH).props.onPress(); });
    return tree;
  };

  let tree = await press();
  expect(mockArchive).toHaveBeenCalledWith(expect.objectContaining({ country: 'DE' }));
  expect(texts(tree.root)).toMatch(/invoices archive created/i);
  expect(alert).not.toHaveBeenCalled();
  tree.unmount();

  // A PDF that failed or an e-invoice missing details is a gap to fix → warn.
  mockArchive.mockImplementationOnce(async () => ({ ok: true, invoiceCount: 3, pdfFailed: ['RE-1'], xmlMissing: [], complete: false }));
  tree = await press();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(String(alert.mock.calls[0][0])).toMatch(/3 invoices exported, but some documents are missing/);
  alert.mockClear();
  tree.unmount();

  // No e-invoice format in this country (UK) is not a gap.
  mockArchive.mockImplementationOnce(async () => ({ ok: true, invoiceCount: 1, pdfFailed: [], xmlMissing: [{ number: 'INV-1', reason: 'x', kind: 'noFormat' }], complete: true }));
  tree = await press();
  expect(alert).not.toHaveBeenCalled();
  tree.unmount();

  mockArchive.mockImplementationOnce(async () => ({ ok: false, invoiceCount: 0, pdfFailed: [], xmlMissing: [], complete: false }));
  tree = await press();
  expect(String(alert.mock.calls[0][0])).toMatch(/could not be created/);
  expect(texts(tree.root)).not.toMatch(/invoices archive created/i);
  alert.mockRestore();
  tree.unmount();
});

it('no other screen can start a deletion', () => {
  const ROOT = path.join(__dirname, '..');
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '__tests__'].includes(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.tsx?$/.test(e.name)) {
        const src = fs.readFileSync(f, 'utf8');
        if (/requestAccountDeletion\(|from\(['"]account_deletion_requests['"]\)[\s\S]{0,80}\.insert/.test(src)) hits.push(path.relative(ROOT, f));
      }
    }
  };
  walk(path.join(ROOT, 'app'));
  expect(hits).toEqual(['app/contractor/delete-account.tsx']);
});
