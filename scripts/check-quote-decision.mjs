#!/usr/bin/env node
// A customer's decision in the quote portal reaches the CONTRACTOR (W119).
//
// IT walk 2026-10-06: the customer accepted in the portal, the page said "your
// tradesperson has been notified", and the contractor got nothing — no push,
// no outcome event (Finanze "Accettati 0"), no job. Here, against the LIVE
// project, exactly as the portal does it (anon key, no session, the token):
//  - decide_acceptance_link → quote accepted, ONE job carrying the quote, the
//    quote_accepted event with trade + country; a second decision changes nothing;
//  - quote-decided → claims notified_at once (a second call keeps the first
//    stamp; an UNDECIDED token claims nothing);
//  - a decline → quote_rejected event, no job.
// The contractor has no push token, so send-push reaches nobody — this proves
// the claim and the call, not delivery to a phone.
//
// WRITES (a throwaway contractor + rows, removed in `finally`).
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run check:quote-decision
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, service);
const customer = () => createClient(url, anon, { auth: { persistSession: false } });
const ok = (name, cond, detail = "") => { console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); if (!cond) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let uid = null;

try {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `verify-decision+${Date.now()}@vasco.test`, password: "Verify-1234-Decision", email_confirm: true,
    user_metadata: { language: "it", country: "IT" },
  });
  if (error) throw error;
  uid = u.user.id;
  const must = async (p) => { const { data, error: e } = await p; if (e) throw e; return data; };
  await must(admin.from("business_settings").insert({ user_id: uid, business_name: "Idraulica Verifica", country: "IT", trade: "plumbing" }));
  const [cust] = await must(admin.from("customers").insert({ user_id: uid, name: "Edilizia Verifica S.r.l." }).select("id"));
  const doc = (n) => ({ user_id: uid, doc_type: "quote", status: "sent", document_number: n, total_amount: 1325.75, title: "Sostituzione miscelatore", scope_text: "Lavori inclusi", customer_id: cust.id });
  await must(admin.from("documents").insert([doc("Q9001"), doc("Q9002")]));
  const link = (quote, token) => ({ token, user_id: uid, quote_id: quote, customer_name: "Edilizia Verifica S.r.l.", quote_amount: 1325.75, expires_at: new Date(Date.now() + 86400000).toISOString() });
  const T1 = `chk${Date.now()}accept`, T2 = `chk${Date.now()}reject`, T3 = `chk${Date.now()}pending`;
  await must(admin.from("quote_acceptance_links").insert([link("Q9001", T1), link("Q9002", T2), link("Q9002", T3)]));

  // An undecided link claims nothing.
  await customer().functions.invoke("quote-decided", { body: { token: T3 } });
  const pend = (await admin.from("quote_acceptance_links").select("notified_at").eq("token", T3).single()).data;
  ok("an UNDECIDED token cannot claim a push", pend?.notified_at === null, JSON.stringify(pend));

  // Accept, as the customer.
  const dec = await customer().rpc("decide_acceptance_link", { p_token: T1, p_decision: "accepted", p_reason: null, p_withdrawal_ack: false });
  ok("customer accepts (anon)", !dec.error && dec.data?.status === "accepted", dec.error?.message ?? "");
  const again = await customer().rpc("decide_acceptance_link", { p_token: T1, p_decision: "accepted", p_reason: null, p_withdrawal_ack: false });
  ok("a second decision is refused", !again.error && again.data === null, JSON.stringify(again.data ?? again.error));

  const q = (await admin.from("documents").select("status").eq("user_id", uid).eq("document_number", "Q9001").single()).data;
  ok("the quote is accepted", q?.status === "accepted", q?.status);
  const jobs = (await admin.from("jobs").select("title, description, status, quoted_amount, agreed_amount, trade, customer_id, quote_id").eq("user_id", uid)).data ?? [];
  ok("exactly ONE job, carrying the quote", jobs.length === 1 && jobs[0].quote_id === "Q9001", JSON.stringify(jobs));
  const j = jobs[0] ?? {};
  ok("…as the app maps it (title, scope, net amount quoted+agreed, trade, customer, scheduled)",
    j.title === "Sostituzione miscelatore" && j.description === "Lavori inclusi" && Number(j.quoted_amount) === 1325.75
      && Number(j.agreed_amount) === 1325.75 && j.trade === "plumbing" && j.customer_id === cust.id && j.status === "scheduled", JSON.stringify(j));
  const ev = (await admin.from("business_events").select("event_type, entity_id, trade, country").eq("user_id", uid)).data ?? [];
  ok("quote_accepted event with trade + country", ev.some((e) => e.event_type === "quote_accepted" && e.entity_id === "Q9001" && e.trade === "plumbing" && e.country === "IT"), JSON.stringify(ev));
  const metric = (await admin.from("ts_daily_business_metrics").select("quotes_accepted").eq("user_id", uid)).data ?? [];
  ok("the daily metric counts it (Finanze 'Accettati')", metric.reduce((s, r) => s + r.quotes_accepted, 0) === 1, JSON.stringify(metric));

  // The push claim.
  const n1 = await customer().functions.invoke("quote-decided", { body: { token: T1 } });
  const s1 = (await admin.from("quote_acceptance_links").select("notified_at").eq("token", T1).single()).data?.notified_at;
  ok("quote-decided answers and claims notified_at", !n1.error && !!s1, n1.error ? String(n1.error.message) : String(s1));
  await sleep(1100);
  await customer().functions.invoke("quote-decided", { body: { token: T1 } });
  const s2 = (await admin.from("quote_acceptance_links").select("notified_at").eq("token", T1).single()).data?.notified_at;
  ok("…once: a second call keeps the first claim", s1 === s2, `${s1} vs ${s2}`);

  // Decline.
  const rej = await customer().rpc("decide_acceptance_link", { p_token: T2, p_decision: "rejected", p_reason: "Troppo caro", p_withdrawal_ack: false });
  ok("customer declines (anon)", !rej.error && rej.data?.status === "rejected", rej.error?.message ?? "");
  const ev2 = (await admin.from("business_events").select("event_type, entity_id").eq("user_id", uid).eq("entity_id", "Q9002")).data ?? [];
  ok("quote_rejected event", ev2.some((e) => e.event_type === "quote_rejected"), JSON.stringify(ev2));
  const jobs2 = (await admin.from("jobs").select("quote_id").eq("user_id", uid).eq("quote_id", "Q9002")).data ?? [];
  ok("no job for a declined quote", jobs2.length === 0, JSON.stringify(jobs2));
} catch (e) {
  ok("check ran", false, String(e?.message ?? e));
} finally {
  if (uid) {
    for (const t of ["jobs", "business_events", "ts_daily_business_metrics", "quote_acceptance_links", "documents", "customers", "business_settings"]) {
      await admin.from(t).delete().eq("user_id", uid);
    }
    const { error } = await admin.auth.admin.deleteUser(uid);
    console.log(`cleanup ${uid}: ${error ? error.message : "deleted"}`);
  }
}
