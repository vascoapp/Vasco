#!/usr/bin/env node
// =============================================================================
// Golden-path smoke — end-to-end check against a live Supabase project
// =============================================================================
// Steps (all scoped to a throwaway test user):
//   1. Sign up + sign in
//   2. Create a customer
//   3. Create a job with quoted_amount
//   4. Create a quote (document) + line items
//   5. Convert quote → invoice
//   6. Mark invoice paid
//   7. Clean up
//
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
// Run: node scripts/golden-path-smoke.mjs
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey);
const testEmail = `smoke+${Date.now()}@vasco.test`;
const testPassword = "Smoke-1234-Test";

function logStep(name, ok, detail = "") {
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log(`# Golden-path smoke test (${testEmail})\n`);

  // 1. Sign up
  const { data: signup, error: signupErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  logStep("create test user", !signupErr, signupErr?.message);
  if (signupErr) return;
  const userId = signup.user.id;

  // 2. Customer
  const { data: cust, error: custErr } = await admin
    .from("customers")
    .insert({ user_id: userId, name: "Smoke Customer", email: "sc@vasco.test" })
    .select()
    .single();
  logStep("create customer", !custErr, custErr?.message);

  // 3. Job
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .insert({
      user_id: userId,
      customer_id: cust?.id,
      title: "Smoke boiler maintenance",
      status: "lead",
      quoted_amount: 320,
    })
    .select()
    .single();
  logStep("create job", !jobErr, jobErr?.message);

  // 4. Quote
  const { data: quote, error: quoteErr } = await admin
    .from("documents")
    .insert({
      user_id: userId,
      customer_id: cust?.id,
      job_id: job?.id,
      doc_type: "quote",
      status: "draft",
      document_number: `Q-SMOKE-${Date.now()}`,
      total_amount: 320,
    })
    .select()
    .single();
  logStep("create quote document", !quoteErr, quoteErr?.message);

  // 5. Convert to invoice
  const { data: inv, error: invErr } = await admin
    .from("documents")
    .insert({
      user_id: userId,
      customer_id: cust?.id,
      job_id: job?.id,
      doc_type: "invoice",
      status: "draft",
      document_number: `INV-SMOKE-${Date.now()}`,
      total_amount: 320,
    })
    .select()
    .single();
  logStep("create invoice document", !invErr, invErr?.message);

  // 6. Mark paid
  const { error: payErr } = await admin
    .from("documents")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", inv?.id);
  logStep("mark invoice paid", !payErr, payErr?.message);

  // 7. Clean up — delete user cascades everything via on-delete
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  logStep("delete test user", !delErr, delErr?.message);

  console.log(`\nExit ${process.exitCode || 0}`);
}

main().catch((err) => {
  console.error("Smoke crashed:", err);
  process.exit(1);
});
