#!/usr/bin/env node
// =============================================================================
// Customer-surface scan — the half of the product that has NO login
// =============================================================================
// golden-path-smoke covers the contractor: signup → customer → job → quote →
// invoice → paid. All of it runs authenticated. On 2026-08-19 every surface the
// contractor's CUSTOMER touches turned out to have been dead in production
// since it was built, and nothing in either harness could see it, because
// nothing in either harness ever sent a request without a session.
//
// This one is the mirror image. It builds a real contractor's data with the
// service key, then does everything the customer does with the ANON KEY ALONE
// — the same key that ships inside the mobile bundle and the web client.
//
// Two things are asserted, and both matter:
//   1. Every customer surface WORKS (reads real data, writes reach the
//      contractor, decisions stick).
//   2. Every customer surface is STILL SEALED — anon cannot read a table, and
//      cannot touch another contractor's tracker or quote. The fix for (1) is
//      one `GRANT ... TO anon` away, and that grant leaks every quote token on
//      the platform. This file exists so that shortcut fails loudly.
//
// Fixtures are namespaced and deleted at the end, including on failure.
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
// Run: npm run smoke:customer
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
// The customer. No session, ever — this is the whole point of the file.
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
};
// A fixture that fails silently makes a working surface look broken. Every
// setup write is checked (learnings #174: `line_items.user_id` is NOT NULL).
const must = (label, { error }) => {
  if (error) { console.error(`\n💥 fixture "${label}" failed: ${error.message}`); process.exit(1); }
};

const stamp = Date.now();
// Injective in `seed`. It was `((seed + i * 7) % 16)`, whose output depends
// ONLY on `seed % 16` — sixteen possible tokens in the whole space. The three
// fixture links below are hex32(stamp), hex32(stamp+1) and hex32(stamp+2), and
// the "forged" token further down is hex32(999999), so whenever
// `Date.now() % 16` landed on 13, 14 or 15 the forged token WAS one of the
// fixtures: "an unknown quote token returns nothing" failed on 3 runs in 16.
//
// A security check that fails 19% of the time is worse than no check — it is
// the `npm audit` lesson in this repo's own CI history, where a permanently red
// job taught everyone to ignore CI. Padding to a fixed width keeps it injective
// for any seed below 16^16, and the second half keeps the tokens from sharing a
// visible prefix.
const hex32 = (seed) => {
  const a = BigInt(seed).toString(16).padStart(16, '0').slice(-16);
  const b = ((BigInt(seed) * 2654435761n) & 0xFFFFFFFFFFFFFFFFn).toString(16).padStart(16, '0').slice(-16);
  return (a + b).slice(0, 32);
};

const created = { users: [] };

async function cleanup() {
  for (const id of created.users) {
    try { await admin.auth.admin.deleteUser(id); } catch { /* best effort */ }
  }
}

async function main() {
  console.log(`\n# Customer-surface scan (anon key only) against ${url}\n`);

  // ── The contractor's world, built with the service key ──────────────────
  const { data: c1, error: e1 } = await admin.auth.admin.createUser({
    email: `cscan-${stamp}@vasco.test`, password: 'Scan!2345678', email_confirm: true,
  });
  must('contractor user', { error: e1 });
  const uid = c1.user.id;
  created.users.push(uid);

  must('business settings', await admin.from('business_settings').insert({
    user_id: uid, business_name: 'Van der Berg Loodgieters', phone: '+31612345678', country: 'NL',
  }));

  // A second contractor, so "can the customer reach someone else's data" is a
  // real question and not a hypothetical.
  const { data: c2, error: e2 } = await admin.auth.admin.createUser({
    email: `cscan2-${stamp}@vasco.test`, password: 'Scan!2345678', email_confirm: true,
  });
  must('second contractor', { error: e2 });
  created.users.push(c2.user.id);

  const code = `SCAN${stamp % 100000}`;
  const otherCode = `OTHR${stamp % 100000}`;

  const { data: tracker, error: te } = await admin.from('decision_trackers').insert({
    user_id: uid, job_id: 'job-scan', customer_id: 'cust-scan', access_code: code,
    status: 'active', total_items: 2, completed_items: 0,
    customer_name: 'Fam. Jansen', project_name: 'Badkamer renovatie', quote_amount: 8400,
  }).select().single();
  must('tracker', { error: te });

  const { data: items, error: ie } = await admin.from('decision_items').insert([
    { tracker_id: tracker.id, category: 'Tegels', label: 'Tegelkleur', help_text: 'Wand en vloer',
      input_type: 'text', is_required: true, due_date: '2026-01-15', sort_order: 1 },
    { tracker_id: tracker.id, category: 'Sanitair', label: 'Kraanmerk',
      input_type: 'text', is_required: false, sort_order: 2 },
  ]).select();
  must('decision items', { error: ie });

  const { data: otherTracker, error: oe } = await admin.from('decision_trackers').insert({
    user_id: c2.user.id, job_id: 'job-other', customer_id: 'cust-other', access_code: otherCode,
    status: 'active', total_items: 1, completed_items: 0,
  }).select().single();
  must('other tracker', { error: oe });
  const { data: otherItem, error: oie } = await admin.from('decision_items').insert({
    tracker_id: otherTracker.id, category: 'x', label: 'Andermans keuze',
    input_type: 'text', is_required: true, sort_order: 1,
  }).select().single();
  must('other item', { error: oie });

  const tokAccept = hex32(stamp);
  const tokExpired = hex32(stamp + 1);
  const tokReject = hex32(stamp + 2);
  const in7d = new Date(Date.now() + 7 * 864e5).toISOString();
  const yesterday = new Date(Date.now() - 864e5).toISOString();
  for (const [token, expires] of [[tokAccept, in7d], [tokReject, in7d], [tokExpired, yesterday]]) {
    must(`acceptance link ${token.slice(0, 6)}`, await admin.from('quote_acceptance_links').insert({
      token, user_id: uid, quote_id: 'Q-260099', customer_name: 'Fam. Jansen',
      quote_amount: 1450, quote_description: 'Badkamer — leidingwerk en sanitair',
      expires_at: expires,
    }));
  }

  // ── 1. The customer opens their decision portal ─────────────────────────
  console.log('\n── Decision portal ──');
  const portal = await anon.rpc('get_portal_by_access_code', { p_access_code: code });
  check('portal loads with a real access code',
    !portal.error && portal.data && !portal.data.expired,
    portal.error ? portal.error.message : `${portal.data?.projectName}`);

  const flat = (portal.data?.categories ?? []).flatMap((c) => c.items ?? []);
  check('portal names the contractor', portal.data?.business?.contractorName === 'Van der Berg Loodgieters',
    portal.data?.business?.contractorName);
  check('portal returns the tracker uuid, not the code', portal.data?.trackerId === tracker.id);
  check('every decision item is rendered', flat.length === 2, `${flat.length} items`);
  check('priority survives the round trip',
    flat.find((i) => i.name === 'Tegelkleur')?.priority === 'important' &&
    flat.find((i) => i.name === 'Kraanmerk')?.priority === 'optional');
  check('a past due date reads as overdue',
    flat.find((i) => i.name === 'Tegelkleur')?.isOverdue === true &&
    portal.data?.overdueDecisions === 1, `overdueDecisions=${portal.data?.overdueDecisions}`);

  // ── 2. The customer answers ─────────────────────────────────────────────
  const s1 = await anon.rpc('submit_decision_via_portal', {
    p_access_code: code, p_item_id: items[0].id, p_value: 'Wit mat', p_notes: 'Graag groot formaat',
    p_photos: null, p_linked_product_url: null, p_time_to_decide_seconds: 42,
  });
  check('customer answers a decision', !s1.error && s1.data?.value === 'Wit mat',
    s1.error ? s1.error.message : `submitted_by=${s1.data?.submitted_by}`);
  check('the answer is filed as the CUSTOMER, not the contractor', s1.data?.submitted_by === 'customer');

  const s2 = await anon.rpc('submit_decision_via_portal', {
    p_access_code: code, p_item_id: items[0].id, p_value: 'Toch antraciet',
    p_notes: null, p_photos: null, p_linked_product_url: null, p_time_to_decide_seconds: 9,
  });
  const { data: midway } = await admin.from('decision_trackers')
    .select('completed_items').eq('id', tracker.id).single();
  check('changing their mind does not double-count',
    !s2.error && s2.data?.value === 'Toch antraciet' && midway.completed_items === 1,
    `completed_items=${midway.completed_items}`);

  await anon.rpc('submit_decision_via_portal', {
    p_access_code: code, p_item_id: items[1].id, p_value: 'Grohe',
    p_notes: null, p_photos: null, p_linked_product_url: null, p_time_to_decide_seconds: 12,
  });
  const { data: done } = await admin.from('decision_trackers')
    .select('completed_items,status').eq('id', tracker.id).single();
  check('answering every item completes the tracker',
    done.completed_items === 2 && done.status === 'completed',
    `${done.completed_items}/2 status=${done.status}`);

  const reread = await anon.rpc('get_portal_by_access_code', { p_access_code: code });
  const answered = (reread.data?.categories ?? []).flatMap((c) => c.items)
    .find((i) => i.id === items[0].id);
  check('the portal reflects the answer back to the customer',
    answered?.status === 'decided' && answered?.value === 'Toch antraciet',
    `${answered?.status} "${answered?.value}"`);

  // ── 3. Telemetry the contractor reads ───────────────────────────────────
  const act = await anon.rpc('log_portal_activity', {
    p_access_code: code, p_activity_type: 'portal_accessed', p_item_id: null, p_metadata: { via: 'scan' },
  });
  const evt = await anon.rpc('record_portal_event', {
    p_access_code: code, p_event_type: 'portal_opened', p_decision_id: null,
    p_quote_id: null, p_duration_ms: 1200, p_metadata: null,
  });
  check('portal activity is recorded', act.data === true);
  check('portal engagement event is recorded', evt.data === true);
  const { data: evRows } = await admin.from('customer_portal_events')
    .select('contractor_user_id').eq('portal_token', code);
  check('the event is attributed to the right contractor',
    evRows?.length === 1 && evRows[0].contractor_user_id === uid);

  // ── 4. The contractor receives it ───────────────────────────────────────
  console.log('\n── What reaches the contractor ──');
  const { data: inbox } = await admin.from('decision_submissions')
    .select('value,submitted_by').eq('tracker_id', tracker.id);
  check('answers land in the contractor inbox', inbox?.length === 2,
    inbox?.map((r) => r.value).join(' | '));
  const { data: acts } = await admin.from('decision_activities')
    .select('activity_type').eq('tracker_id', tracker.id);
  check('the hesitation timeline has rows', (acts?.length ?? 0) >= 1, `${acts?.length} rows`);

  // ── 5. Quote acceptance ─────────────────────────────────────────────────
  console.log('\n── Quote acceptance ──');
  const read = await anon.rpc('get_acceptance_link_by_token', { p_token: tokAccept });
  check('customer reads their quote link',
    !read.error && read.data?.status === 'pending' && Number(read.data?.quote_amount) === 1450,
    read.error ? read.error.message : `€ ${read.data?.quote_amount} "${read.data?.customer_name}"`);
  check('the link does not leak the contractor uuid',
    read.data != null && !('user_id' in read.data) && !('customer_id' in read.data));

  const acc = await anon.rpc('decide_acceptance_link', {
    p_token: tokAccept, p_decision: 'accepted', p_reason: null,
  });
  check('customer accepts', !acc.error && acc.data?.status === 'accepted' && !!acc.data?.responded_at,
    acc.error ? acc.error.message : `responded_at ${acc.data?.responded_at ? 'stamped' : 'MISSING'}`);

  const twice = await anon.rpc('decide_acceptance_link', {
    p_token: tokAccept, p_decision: 'rejected', p_reason: 'changed my mind',
  });
  check('a decided quote cannot be re-decided', twice.data === null);

  const rej = await anon.rpc('decide_acceptance_link', {
    p_token: tokReject, p_decision: 'rejected', p_reason: 'Te duur',
  });
  check('customer rejects with a reason',
    rej.data?.status === 'rejected' && rej.data?.decline_reason === 'Te duur');

  const expRead = await anon.rpc('get_acceptance_link_by_token', { p_token: tokExpired });
  const expDecide = await anon.rpc('decide_acceptance_link', {
    p_token: tokExpired, p_decision: 'accepted', p_reason: null,
  });
  check('an expired link still READS (so we can explain why)', expRead.data?.status === 'pending');
  check('an expired link cannot be accepted', expDecide.data === null);

  // ── 6. Still sealed ─────────────────────────────────────────────────────
  console.log('\n── Still sealed ──');
  for (const table of ['quote_acceptance_links', 'decision_submissions', 'decision_trackers',
                       'decision_items', 'decision_activities', 'customer_portal_events',
                       'customers', 'documents', 'business_settings']) {
    const { error } = await anon.from(table).select('*').limit(1);
    check(`anon cannot read ${table}`, error?.code === '42501',
      error ? error.code : 'READABLE — anon has a grant on this table');
  }

  const cross = await anon.rpc('submit_decision_via_portal', {
    p_access_code: code, p_item_id: otherItem.id, p_value: 'pwned',
    p_notes: null, p_photos: null, p_linked_product_url: null, p_time_to_decide_seconds: null,
  });
  check("one contractor's code cannot answer another's item", cross.data === null);

  const forged = await anon.rpc('get_acceptance_link_by_token', { p_token: hex32(999999) });
  check('an unknown quote token returns nothing', forged.data === null);

  for (const [label, token] of [['SQL-ish', "' or 1=1--"], ['too short', 'abc'],
                                ['null', null], ['1000 chars', 'a'.repeat(1000)]]) {
    const r = await anon.rpc('get_acceptance_link_by_token', { p_token: token });
    check(`malformed token (${label}) is refused cleanly`, !r.error && r.data === null,
      r.error ? `${r.error.code} — should be a clean null, not an error` : '');
  }
  // The event_type CHECK lists twelve values. A thirteenth used to propagate a
  // 23514 out of a function whose contract says it never raises — the mobile
  // app ships on its own cadence and can learn an event name before the
  // database does.
  const badEvent = await anon.rpc('record_portal_event', {
    p_access_code: code, p_event_type: 'not_a_real_event_type', p_decision_id: null,
    p_quote_id: null, p_duration_ms: null, p_metadata: null,
  });
  check('an unknown event type returns false, never raises',
    !badEvent.error && badEvent.data === false,
    badEvent.error ? `raised ${badEvent.error.code} — telemetry must not break the page` : '');

  const badDecision = await anon.rpc('decide_acceptance_link', {
    p_token: tokReject, p_decision: 'pending', p_reason: null,
  });
  check('a status outside accepted/rejected is refused',
    !!badDecision.error && /invalid_decision/.test(badDecision.error.message));

  // ── Result ──────────────────────────────────────────────────────────────
  await admin.from('customer_portal_events').delete().eq('portal_token', code);
  console.log(`\n${failures === 0 ? '✅' : '❌'} customer surface: ${failures === 0 ? 'all checks passed' : `${failures} FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

try {
  await main();
} catch (err) {
  console.error('\n💥 scan threw:', err?.message ?? err);
  process.exitCode = 1;
} finally {
  await cleanup();
  console.log('cleaned up');
}
