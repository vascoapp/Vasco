/**
 * @jest-environment node
 *
 * An invoice created offline is kept on screen until the server has it.
 * refreshData replaced quotes/invoices wholesale with the server's list, so a
 * document whose INSERT was still queued vanished from the screen and from
 * local storage — the queued write its only copy (2026-09-24).
 */
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => store[k] ?? null),
  setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
}));
jest.mock('../../lib/currentUser', () => ({
  ...jest.requireActual('../../lib/currentUser'),
  getAuthedUserId: () => '11111111-1111-1111-1111-111111111111',
}));

import { queueWrite, pendingDocumentNumbers, keepPendingDocuments } from '../offlineWriteQueue';

it('knows which documents are still waiting to be inserted', async () => {
  await queueWrite({ table: 'documents', op: 'insert', payload: { doc_type: 'invoice', document_number: 'RE-2026-0007' } });
  await queueWrite({ table: 'documents', op: 'update', rowId: 'RE-2026-0001', payload: { status: 'sent' } });
  await queueWrite({ table: 'customers', op: 'insert', payload: { name: 'X' } });
  expect([...await pendingDocumentNumbers()]).toEqual(['RE-2026-0007']);
});

it('the refresh keeps a queued document and drops one the server no longer has', () => {
  const local = [{ id: 'RE-2026-0007' }, { id: 'RE-2026-0003' }, { id: 'RE-2026-0001' }];
  const server = [{ id: 'RE-2026-0001' }];
  const merged = keepPendingDocuments(local, server, new Set(['RE-2026-0007']));
  expect(merged.map((d) => d.id)).toEqual(['RE-2026-0007', 'RE-2026-0001']);
});

it('once the server has it, the server row wins — never two copies', () => {
  const merged = keepPendingDocuments([{ id: 'RE-2026-0007', v: 'local' }], [{ id: 'RE-2026-0007', v: 'server' }], new Set(['RE-2026-0007']));
  expect(merged).toEqual([{ id: 'RE-2026-0007', v: 'server' }]);
});

it('AppState.refreshData merges documents instead of replacing them', () => {
  const fs = require('fs');
  const path = require('path');
  const { stripComments } = require('../../utils/stripComments');
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../../state/AppState.tsx'), 'utf8'));
  const body = src.slice(src.indexOf('const refreshData = useCallback'), src.indexOf('}, []);', src.indexOf('const refreshData = useCallback')));
  expect(body).toMatch(/setQuotes\(\(prev\) => keepPendingDocuments\(prev, q, pendingDocs\)\)/);
  expect(body).toMatch(/setInvoices\(\(prev\) => keepPendingDocuments\(prev, inv, pendingDocs\)\)/);
  expect(body).not.toMatch(/setQuotes\(q\)|setInvoices\(inv\)/);
});

// A logout mid-refresh: the loads resolve after the wipe and wrote the previous
// contractor's data back (2026-09-24). Each commit must follow an ownership check.
it('refreshData commits only while the session that started it is current', () => {
  const fs = require('fs');
  const path = require('path');
  const { stripComments } = require('../../utils/stripComments');
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../../state/AppState.tsx'), 'utf8'));
  const start = src.indexOf('const refreshData = useCallback');
  const body = src.slice(start, src.indexOf('}, []);', start));
  const at = (needle: string) => {
    const i = body.indexOf(needle);
    if (i < 0) throw new Error(`refreshData no longer contains ${needle}`);
    return i;
  };
  // the last ownership check before each commit point
  const checkBefore = (i: number) => body.lastIndexOf('stillOwner()', i);
  for (const commit of ['setQuotes((prev)', 'setExtractedDocs(', 'await listProjects()']) {
    const i = at(commit);
    expect({ commit, checked: checkBefore(i) > at('const stillOwner') }).toEqual({ commit, checked: true });
  }
});
