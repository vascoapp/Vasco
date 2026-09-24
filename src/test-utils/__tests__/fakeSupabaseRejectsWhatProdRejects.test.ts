/**
 * The fake backend rejects what production rejects (convergence plan P0.3).
 * A fake that accepts everything is the blind spot it replaces, so each rule
 * is pinned here against real tables from the live-schema snapshot.
 */
import { createFakeSupabase, MAX_ROWS } from '../fakeSupabase';

const U = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('fakeSupabase', () => {
  it('knows the live tables (snapshot is not the hand-written types)', () => {
    const f = createFakeSupabase();
    for (const t of ['documents', 'line_items', 'customers', 'jobs', 'material_price_history', 'decision_trackers', 'cron_http_calls']) {
      expect(f.hasTable(t)).toBe(true);
    }
  });

  it('unknown table → 42P01', async () => {
    const { client } = createFakeSupabase();
    const r = await client.from('stock_levels').select('*');
    expect(r.error?.code).toBe('42P01');
  });

  it('unknown column in a write → PGRST204, and NOTHING is written', async () => {
    const f = createFakeSupabase();
    const r = await f.client.from('customers').insert([{ user_id: U, name: 'A' }, { user_id: U, name: 'B', favourite_colour: 'red' }]);
    expect(r.error?.code).toBe('PGRST204');
    expect(f.rows('customers')).toHaveLength(0);
  });

  it('NOT NULL column left out → 23502', async () => {
    const f = createFakeSupabase();
    const r = await f.client.from('customers').insert({ user_id: U });
    expect(r.error?.code).toBe('23502');
    expect(r.error?.message).toContain('"name"');
  });

  it('explicit null into a NOT NULL column with a default → 23502 (the default does not apply)', async () => {
    const f = createFakeSupabase();
    const nn = f.columns('customers').find((c) => c === 'created_at')!;
    const r = await f.client.from('customers').insert({ user_id: U, name: 'A', [nn]: null });
    expect(r.error?.code).toBe('23502');
  });

  it('defaults fill id and timestamps', async () => {
    const f = createFakeSupabase();
    const r = await f.client.from('customers').insert({ user_id: U, name: 'A' }).select('id, created_at').single();
    expect(r.error).toBeNull();
    expect(r.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.data.created_at).toBeTruthy();
  });

  it('unknown column in a filter or select → 42703', async () => {
    const { client } = createFakeSupabase();
    expect((await client.from('customers').select('*').eq('nope', 1)).error?.code).toBe('42703');
    expect((await client.from('customers').select('id, nope')).error?.code).toBe('42703');
  });

  it('never more than MAX_ROWS per response, silently — like production', async () => {
    const f = createFakeSupabase();
    f.seed('customers', Array.from({ length: 1500 }, (_, i) => ({ name: `C${i}` })));
    const all = await f.client.from('customers').select('*');
    expect(all.error).toBeNull();
    expect(all.data).toHaveLength(MAX_ROWS);
    const page2 = await f.client.from('customers').select('*').order('name').range(1000, 1999);
    expect(page2.data).toHaveLength(500);
  });

  it("another user's rows are invisible, and writing one is refused", async () => {
    const f = createFakeSupabase({ userId: U });
    f.seed('customers', [{ name: 'Mine' }, { name: 'Theirs', user_id: OTHER }]);
    const r = await f.client.from('customers').select('name');
    expect(r.data!.map((x: any) => x.name)).toEqual(['Mine']);
    expect((await f.client.from('customers').insert({ user_id: OTHER, name: 'X' })).error?.code).toBe('42501');
    // An update that matches only their row changes nothing — 0 rows, no error.
    const u = await f.client.from('customers').update({ name: 'hacked' }).eq('name', 'Theirs').select('id');
    expect(u.data).toEqual([]);
    expect(f.rows('customers')[1].name).toBe('Theirs');
  });

  it('single() on no row → PGRST116; maybeSingle() → null', async () => {
    const { client } = createFakeSupabase();
    expect((await client.from('customers').select('*').eq('name', 'x').single()).error?.code).toBe('PGRST116');
    const m = await client.from('customers').select('*').eq('name', 'x').maybeSingle();
    expect(m.error).toBeNull();
    expect(m.data).toBeNull();
  });

  it('unknown RPC → PGRST202; a registered one answers', async () => {
    const f = createFakeSupabase();
    expect((await f.client.rpc('does_not_exist')).error?.code).toBe('PGRST202');
    f.rpc('next_document_number', () => ({ data: 'RE-0001', error: null }));
    expect((await f.client.rpc('next_document_number', { p_doc_type: 'invoice' })).data).toBe('RE-0001');
  });

  it('a live RPC called with the wrong ARGUMENT name → PGRST202 (#355: every week)', async () => {
    const f = createFakeSupabase();
    expect((await f.client.rpc('get_my_price_pairs', { limit: 10 })).error?.code).toBe('PGRST202');
    const ok = await f.client.rpc('get_my_price_pairs', { p_limit: 10 });
    expect(ok.error).toBeNull(); // live, unregistered → empty success
    expect((await f.client.rpc('next_document_number', {})).error?.code).toBe('PGRST202'); // required arg missing
    // An undefined value is dropped by JSON.stringify — so it is "missing" too.
    expect((await f.client.rpc('next_document_number', { p_doc_type: undefined })).error?.code).toBe('PGRST202');
    // Stubbing a function that does not exist live must be deliberate.
    expect(() => f.rpc('next_documnet_number', () => ({ data: 1, error: null }))).toThrow(/misspelt/);
  });

  it('embeds a parent with !inner, like loadLineItems reads documents', async () => {
    const f = createFakeSupabase();
    f.seed('documents', [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', doc_type: 'invoice', status: 'sent', document_number: 'RE-1' }]);
    f.seed('line_items', [{ document_id: 'aaaaaaaa-0000-4000-8000-000000000001', description: 'x', quantity: 1, unit_price: 1, total_price: 1, position: 0 }]);
    const r = await f.client.from('line_items').select('*, documents!inner(document_number)');
    expect(r.error).toBeNull();
    expect(r.data![0].documents.document_number).toBe('RE-1');
  });

  it('a privilege the role lacks → 42501, like PostgREST (review H1)', async () => {
    const f = createFakeSupabase();
    // analytics_events: authenticated has INSERT only.
    expect((await f.client.from('analytics_events').insert({ id: 'e1', name: 'x', timestamp: new Date().toISOString() })).error).toBeNull();
    const up = await f.client.from('analytics_events').upsert({ id: 'e2', name: 'x', timestamp: new Date().toISOString() }, { onConflict: 'id', ignoreDuplicates: true });
    expect(up.error?.code).toBe('42501'); // ON CONFLICT needs SELECT
    expect((await f.client.from('analytics_events').select('id')).error?.code).toBe('42501');
    // Signed out = anon: no table privileges at all.
    const anon = createFakeSupabase({ userId: null });
    expect((await anon.client.from('customers').select('id')).error?.code).toBe('42501');
  });
});
