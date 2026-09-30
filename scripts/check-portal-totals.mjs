#!/usr/bin/env node
// Does the customer's quote page state the same total the app will invoice,
// against the LIVE verify-quote-token? (#360 / review 2026-09-30.)
//
// The expected figures are the APP's (documentVatBreakdown), hard-coded — not
// recomputed with the shared module the function uses, which would only prove
// the function agrees with itself. Throwaway contractors, cleaned up after.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run check:portal-totals
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, service);
const ok = (name, cond, detail = "") => { console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); if (!cond) process.exitCode = 1; };
const users = [];

// 1,333 × 55 + 2,5 × 12,99 + 1,125 × 9,99 at 19 % (unit_price is stored to
// the cent, quantity to 3 places — sub-cent LINES come from quantities): the
// lines in cents are 73,32 + 32,48 + 11,24 = 117,04; VAT 22,24; total 139,28
// (computed with documentVatBreakdown). The old portal said 117,03 / 139,27 —
// a cent under the invoice the app then sends.
const LINES = [
  { description: "Arbeit", quantity: 1.333, unit_price: 55, vat_rate: 19 },
  { description: "Kupferrohr", quantity: 2.5, unit_price: 12.99, vat_rate: 19 },
  { description: "Fittings", quantity: 1.125, unit_price: 9.99, vat_rate: 19 },
];

async function portalFor(tag, vatScheme) {
  const email = `verify-portal+${tag}${Date.now()}@vasco.test`, password = "Verify-1234-Portal";
  const { data: u, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(u.user.id);
  const uid = u.user.id;
  const { error: bsErr } = await admin.from("business_settings").upsert({ user_id: uid, business_name: `Portal ${tag}`, country: "DE", vat_scheme: vatScheme }, { onConflict: "user_id" });
  if (bsErr) throw new Error(`business_settings: ${bsErr.message}`);
  const raw = LINES.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const { data: q, error: qErr } = await admin.from("documents")
    .insert({ user_id: uid, doc_type: "quote", status: "sent", document_number: `AN-PORTAL-${tag}-${Date.now()}`, total_amount: Math.round(raw * 100) / 100 })
    .select("id").single();
  if (qErr) throw new Error(`documents: ${qErr.message}`);
  const { error: liErr } = await admin.from("line_items").insert(LINES.map((l, i) => ({
    ...l, document_id: q.id, user_id: uid, position: i, total_price: l.quantity * l.unit_price,
  })));
  if (liErr) throw new Error(`line_items: ${liErr.message}`);
  const c = createClient(url, anon);
  const { data: s, error: sErr } = await c.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  const signed = await (await fetch(`${url}/functions/v1/sign-quote-token`, {
    method: "POST", headers: { Authorization: `Bearer ${s.session.access_token}`, apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ quoteId: q.id }),
  })).json();
  if (!signed.ok) throw new Error(`sign-quote-token: ${JSON.stringify(signed)}`);
  // The CUSTOMER's request: no session, anon key only.
  const r = await fetch(`${url}/functions/v1/verify-quote-token`, {
    method: "POST", headers: { Authorization: `Bearer ${anon}`, apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ quoteId: q.id, token: signed.token }),
  });
  return { status: r.status, body: await r.json() };
}

try {
  const std = await portalFor("std", "standard");
  const s = std.body?.quote ?? {};
  ok("standard contractor: 117,04 + 22,24 = 139,28 (the app's figures)",
    std.status === 200 && s.subtotal === 117.04 && s.vatAmount === 22.24 && s.total === 139.28,
    `${std.status} ${JSON.stringify({ subtotal: s.subtotal, vat: s.vatAmount, total: s.total })}`);
  const kor = await portalFor("klein", "small_business_DE_kleinunternehmer");
  const k = kor.body?.quote ?? {};
  ok("Kleinunternehmer: no VAT shown, total 117,04",
    kor.status === 200 && k.subtotal === 117.04 && k.vatAmount === 0 && k.total === 117.04,
    `${kor.status} ${JSON.stringify({ subtotal: k.subtotal, vat: k.vatAmount, total: k.total })}`);
} catch (e) {
  ok("check ran", false, String(e?.message ?? e));
} finally {
  for (const id of users) {
    const { data: docs } = await admin.from("documents").select("id").eq("user_id", id);
    for (const d of docs ?? []) await admin.from("line_items").delete().eq("document_id", d.id);
    await admin.from("documents").delete().eq("user_id", id);
    await admin.from("business_settings").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(`cleanup ${id}: ${error ? error.message : "deleted"}`);
  }
}
