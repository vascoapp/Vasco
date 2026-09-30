#!/usr/bin/env node
// A push token belongs to ONE account (migration 20260930000001). Registers
// the same phone for two throwaway contractors through the REAL client path
// (anon key + each user's session, RLS on) and checks the first account no
// longer owns it — while its token on ANOTHER phone is left alone.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run check:push-owner
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, anon = process.env.SUPABASE_ANON_KEY;
const admin = createClient(url, service);
const ok = (name, cond, detail = "") => { console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); if (!cond) process.exitCode = 1; };
const users = [];
async function signedIn(tag) {
  const email = `verify-push+${tag}${Date.now()}@vasco.test`, password = "Verify-1234-Push";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, c };
}
// The same upsert pushNotificationService.registerPushToken sends.
const register = (u, deviceId, token) => u.c.from("push_tokens")
  .upsert({ user_id: u.id, device_id: deviceId, token, platform: "android" }, { onConflict: "user_id,device_id" });
try {
  const a = await signedIn("a"), b = await signedIn("b");
  const phone = `dev-${Date.now()}`, other = `dev-other-${Date.now()}`;
  const tok = `ExponentPushToken[verify-${Date.now()}]`, tokOther = `ExponentPushToken[other-${Date.now()}]`;
  for (const [u, d, t] of [[a, phone, tok], [a, other, tokOther]]) {
    const { error } = await register(u, d, t);
    if (error) throw new Error(`register A: ${error.message}`);
  }
  const { error: eb } = await register(b, phone, tok);
  ok("B registers the shared phone under RLS", !eb, eb?.message);
  const rows = (await admin.from("push_tokens").select("user_id, device_id, token").in("user_id", [a.id, b.id])).data ?? [];
  const onPhone = rows.filter((r) => r.device_id === phone || r.token === tok).map((r) => (r.user_id === a.id ? "A" : "B"));
  ok("the shared phone now belongs to B only", JSON.stringify(onPhone) === '["B"]', JSON.stringify(onPhone));
  ok("A's OTHER phone is untouched", rows.some((r) => r.user_id === a.id && r.device_id === other), JSON.stringify(rows.filter((r) => r.user_id === a.id)));
} catch (e) {
  ok("check ran", false, String(e?.message ?? e));
} finally {
  for (const id of users) {
    await admin.from("push_tokens").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(`cleanup ${id}: ${error ? error.message : "deleted"}`);
  }
}
