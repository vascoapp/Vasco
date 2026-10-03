#!/usr/bin/env node
// A contractor reads their OWN price reference — and nobody else's.
// getPriceReference (src/lib/intelligenceDataProvider.ts) calls
// get_my_price_reference (migration 20261003000001) the way the app does:
// anon key + a throwaway contractor's session. The view price_references stays
// owner-only (it lists every contractor's prices); this checks it still is.
//
// WRITES (throwaway users + their price_observations, removed in `finally`).
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run check:price-reference
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, service);
const ok = (name, cond, detail = "") => { console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); if (!cond) process.exitCode = 1; };
const users = [];
async function signedIn(tag) {
  const email = `verify-priceref+${tag}${Date.now()}@vasco.test`, password = "Verify-1234-PriceRef";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, c };
}
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const ref = (c, m) => c.rpc("get_my_price_reference", { p_material_id: m });

try {
  const a = await signedIn("a"), b = await signedIn("b");
  const MAT = `check-priceref-${Date.now()}`, ONLY_B = `${MAT}-b`;
  const { error: seedErr } = await admin.from("price_observations").insert([
    { user_id: a.id, material_id: MAT, material_name: "Kupferrohr", price: 12.34, observed_at: daysAgo(1), source: "invoice" },
    { user_id: a.id, material_id: MAT, material_name: "Kupferrohr", price: 12.5, observed_at: daysAgo(40), source: "invoice" },
    { user_id: b.id, material_id: MAT, material_name: "Kupferrohr", price: 99.99, observed_at: daysAgo(1), source: "invoice" },
    { user_id: b.id, material_id: ONLY_B, material_name: "Fitting", price: 5, observed_at: daysAgo(1), source: "invoice" },
  ]);
  if (seedErr) throw seedErr;

  const mine = await ref(a.c, MAT);
  const row = mine.data?.[0];
  ok("A reads A's reference", !mine.error && mine.data?.length === 1, mine.error?.message ?? JSON.stringify(mine.data));
  ok("…built from A's prices only (30 d avg 12.34, 2 observations in 90 d)",
    row?.user_id === a.id && row?.avg_price_30d === 12.34 && row?.observation_count === 2, JSON.stringify(row));
  const theirs = await ref(a.c, ONLY_B);
  ok("A cannot read a material only B priced", !theirs.error && theirs.data?.length === 0, JSON.stringify(theirs.data ?? theirs.error));
  const bRow = (await ref(b.c, MAT)).data?.[0];
  ok("B's reference for the same material is B's", bRow?.user_id === b.id && bRow?.avg_price_30d === 99.99, JSON.stringify(bRow));

  const view = await a.c.from("price_references").select("*").limit(1);
  ok("the view price_references stays unreadable to a contractor", !!view.error, view.error?.code ?? `${view.data?.length} rows READABLE`);
  const noSession = await ref(createClient(url, anon, { auth: { persistSession: false } }), MAT);
  ok("no session: refused", !!noSession.error, noSession.error?.code ?? JSON.stringify(noSession.data));
} catch (e) {
  ok("check ran", false, String(e?.message ?? e));
} finally {
  for (const id of users) {
    await admin.from("price_observations").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(`cleanup ${id}: ${error ? error.message : "deleted"}`);
  }
}
