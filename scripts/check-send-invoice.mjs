#!/usr/bin/env node
// Does sending an invoice actually work, against the LIVE send-invoice?
//
// It had never worked on a real account: the app sends the document NUMBER as
// the id, the function matched it against the uuid `documents.id`, and every
// send 404'd — hidden for months by the app marking the invoice sent before
// the call (learnings #379). Mail goes only to Resend's test inbox.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run check:send-invoice
//   (keys: npx supabase projects api-keys --project-ref gblhqhorkarocmputhte)
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, service);
const ok = (name, cond, detail = "") => { console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); if (!cond) process.exitCode = 1; };
const users = [];
async function mkUser(tag) {
  const email = `verify-send+${tag}${Date.now()}@vasco.test`, password = "Verify-1234-Send";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const c = createClient(url, anon);
  const { data: s, error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, jwt: s.session.access_token };
}
const send = async (jwt, invoiceId) => {
  const r = await fetch(`${url}/functions/v1/send-invoice`, { method: "POST", headers: { Authorization: `Bearer ${jwt}`, apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId, to: "delivered@resend.dev", locale: "de" }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const row = async (num, uid) => (await admin.from("documents").select("status, sent_at").eq("document_number", num).eq("user_id", uid).single()).data;
try {
  const a = await mkUser("a"), b = await mkUser("b");
  const ts = Date.now(), draft = `RE-VERIFY-${ts}`, paid = `RE-VERIFY-P-${ts}`;
  for (const [num, status] of [[draft, "draft"], [paid, "paid"]]) {
    const { error } = await admin.from("documents").insert({ user_id: a.id, doc_type: "invoice", document_number: num, status, total_amount: 121 });
    if (error) throw new Error(`insert ${num}: ${error.message}`);
  }
  const first = await send(a.jwt, draft);
  ok("draft found BY NUMBER and emailed", first.status === 200 && first.body.ok === true, JSON.stringify(first.body));
  const r1 = await row(draft, a.id);
  ok("draft became sent with sent_at", r1?.status === "sent" && !!r1?.sent_at, JSON.stringify(r1));
  await new Promise((res) => setTimeout(res, 1500));
  const again = await send(a.jwt, draft);
  const r2 = await row(draft, a.id);
  ok("reminder: delivered, sent_at unchanged", again.status === 200 && r2?.sent_at === r1?.sent_at, `${r1?.sent_at} → ${r2?.sent_at}`);
  const p = await send(a.jwt, paid);
  const rp = await row(paid, a.id);
  ok("paid invoice stays paid", p.status === 200 && rp?.status === "paid" && !rp?.sent_at, JSON.stringify(rp));
  const other = await send(b.jwt, draft);
  ok("another user cannot reach it by number", other.status === 404, `${other.status} ${JSON.stringify(other.body)}`);
} catch (e) {
  ok("verification ran", false, String(e?.message ?? e));
} finally {
  for (const id of users) {
    await admin.from("documents").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(`cleanup ${id}: ${error ? error.message : "deleted"}`);
  }
}
