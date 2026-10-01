#!/usr/bin/env node
// A supplier price list (DATANORM) is deduplicated on the SERVER (migration
// 20261001000002, `import_catalog_prices`). Calls it the way
// src/integrations/datanorm.ts does — anon key + a throwaway contractor's
// session, RLS on — and checks what landed in the tables.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run check:catalog-import
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, service);
const ok = (name, cond, detail = "") => { console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); if (!cond) process.exitCode = 1; };
const users = [];
async function signedIn(tag) {
  const email = `verify-catalog+${tag}${Date.now()}@vasco.test`, password = "Verify-1234-Catalog";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, c };
}
const item = (a, p, n = `Kupferrohr ${a}`) => ({ a, n, u: "m", p, k: `art:richter:${a.toLowerCase()}` });
const call = (c, items, supplier = "richter") => c.rpc("import_catalog_prices", {
  p_supplier_id: supplier, p_supplier_name: "Richter", p_trade: "plumbing", p_country: "DE", p_currency: "EUR", p_items: items,
});
const result = ({ data, error }) => (error ? `error ${error.code}: ${error.message}` : JSON.stringify(data?.[0]));
const prices = async (id) => (await admin.from("material_price_history")
  .select("canonical_name, price_excl_vat, source, observed_by").eq("observed_by", id)).data ?? [];

try {
  const a = await signedIn("a"), b = await signedIn("b");

  const first = await call(a.c, [item("A1", 12.34), item("A2", 3.1), item("A2", 3.2), item("A3", 12345.67), { a: "", p: 1, k: "x" }, item("A4", 0)]);
  ok("first import: 3 new, the duplicate and 2 invalid rows skipped", result(first) === '{"imported":3,"skipped":3}', result(first));
  const rows = await prices(a.id);
  ok("3 price rows, attributed to the contractor, source catalog", rows.length === 3 && rows.every((r) => r.observed_by === a.id && r.source === "catalog"), JSON.stringify(rows));
  ok("the LAST occurrence of an article wins", rows.find((r) => r.canonical_name === "art:richter:a2")?.price_excl_vat === 3.2);
  const cat = (await admin.from("material_catalog").select("manufacturer_code").eq("user_id", a.id)).data ?? [];
  ok("one catalogue row per article", cat.map((r) => r.manufacturer_code).sort().join() === "A1,A2,A3", JSON.stringify(cat));

  // REAL column: 12345.67 must compare equal to itself on the way back.
  const same = await call(a.c, [item("A1", 12.34), item("A2", 3.2), item("A3", 12345.67)]);
  ok("the same list again writes nothing", result(same) === '{"imported":0,"skipped":3}', result(same));

  const rise = await call(a.c, [item("A1", 12.99), item("A2", 3.2), item("A3", 12345.67)]);
  ok("a changed price is written, the rest skipped", result(rise) === '{"imported":1,"skipped":2}', result(rise));
  const back = await call(a.c, [item("A1", 12.34)]);
  ok("a price going BACK to an earlier value is a change (A → B → A)", result(back) === '{"imported":1,"skipped":0}', result(back));
  const unit = await call(a.c, [{ ...item("A2", 3.2), u: "Stk" }]);
  ok("the same price in another unit is a new observation", result(unit) === '{"imported":1,"skipped":0}', result(unit));
  ok("still one catalogue row per article", ((await admin.from("material_catalog").select("id").eq("user_id", a.id)).data ?? []).length === 3);

  const other = await call(b.c, [item("A1", 12.34)]);
  ok("another contractor's prices do not dedupe mine", result(other) === '{"imported":1,"skipped":0}', result(other));
  const seen = (await b.c.from("material_price_history").select("observed_by").eq("observed_by", a.id)).data ?? [];
  ok("…and they cannot read mine", seen.length === 0, `${seen.length} rows`);

  const noSession = await call(createClient(url, anon, { auth: { persistSession: false } }), [item("X1", 1)]);
  ok("no session: refused", !!noSession.error, result(noSession));
  const tooBig = await call(a.c, Array.from({ length: 5001 }, (_, i) => item(`T${i}`, 1)));
  ok("an oversized batch is refused whole", !!tooBig.error && (await prices(a.id)).length === 6, result(tooBig));

  // The app's batch size, twice over a full history: how long does the
  // dedupe lookup take once the table holds a real list?
  const big = Array.from({ length: 1000 }, (_, i) => item(`BIG${i}`, 1 + i / 100));
  let t = Date.now();
  const b1 = await call(a.c, big);
  const firstMs = Date.now() - t;
  t = Date.now();
  const b2 = await call(a.c, big);
  ok("1,000 articles land, and again skip", result(b1) === '{"imported":1000,"skipped":0}' && result(b2) === '{"imported":0,"skipped":1000}',
    `${result(b1)} in ${firstMs} ms, ${result(b2)} in ${Date.now() - t} ms`);

  // What it is for: the price watch pairs the two A1 observations.
  const { data: pairs, error: pe } = await a.c.rpc("get_my_price_pairs", { p_limit: 10 });
  ok("the price watch reads the imported prices", !pe && Array.isArray(pairs), pe?.message);
} catch (e) {
  ok("check ran", false, String(e?.message ?? e));
} finally {
  for (const id of users) {
    await admin.from("material_price_history").delete().eq("observed_by", id);
    await admin.from("material_catalog").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(`cleanup ${id}: ${error ? error.message : "deleted"}`);
  }
}
