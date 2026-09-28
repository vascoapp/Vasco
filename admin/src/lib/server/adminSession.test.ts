// node --test --experimental-strip-types src/lib/server/adminSession.test.ts
// (npm run test:auth). The admin has no other test runner.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
process.env.ADMIN_EMAILS = "Boss@Vascobuild.com, second@vascobuild.com";
// @ts-expect-error node --experimental-strip-types needs the extension
const S = await import("./adminSession.ts");

test("allow-list is case-insensitive and ignores junk", () => {
  assert.equal(S.isAllowedAdmin("boss@vascobuild.com"), true);
  assert.equal(S.isAllowedAdmin(" BOSS@vascobuild.com "), true);
  assert.equal(S.isAllowedAdmin("other@vascobuild.com"), false);
  assert.equal(S.isAllowedAdmin(""), false);
});

test("session: round-trip, expiry, tamper, removal from the allow-list", () => {
  const v = S.createSessionValue("boss@vascobuild.com", 1_000);
  assert.equal(S.verifySessionValue(v, 2_000), "boss@vascobuild.com");
  assert.equal(S.verifySessionValue(v, 1_000 + S.SESSION_HOURS * 3600_000 + 1), null);
  const [b64, mac] = v.split(".");
  const forged = Buffer.from("second@vascobuild.com|9999999999999").toString("base64url");
  assert.equal(S.verifySessionValue(`${forged}.${mac}`, 2_000), null);
  assert.equal(S.verifySessionValue(`${b64}.${mac.slice(0, -1)}A`, 2_000), null);
  const old = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "second@vascobuild.com";
  assert.equal(S.verifySessionValue(v, 2_000), null, "removed address is locked out at once");
  process.env.ADMIN_EMAILS = old;
});

test("a short secret refuses to sign and verifies nothing", () => {
  const v = S.createSessionValue("boss@vascobuild.com");
  process.env.ADMIN_SESSION_SECRET = "short";
  assert.throws(() => S.createSessionValue("boss@vascobuild.com"));
  assert.equal(S.verifySessionValue(v), null);
  process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
});

test("sign-in code: right code once, wrong code, expiry, tampered hash", () => {
  const code = S.newSignInCode();
  assert.match(code, /^\d{8}$/);
  const ch = S.createChallengeValue("boss@vascobuild.com", code, 1_000);
  assert.equal(S.verifyChallenge(ch, code, 2_000), "boss@vascobuild.com");
  const wrong = code === "00000000" ? "00000001" : "00000000";
  assert.equal(S.verifyChallenge(ch, wrong, 2_000), null);
  assert.equal(S.verifyChallenge(ch, code, 1_000 + S.CODE_MINUTES * 60_000 + 1), null);
  assert.equal(S.verifyChallenge(ch, "1234", 2_000), null);
  // A challenge minted for one code cannot be re-pointed at another.
  const [b64, mac] = ch.split(".");
  const [email, exp] = Buffer.from(b64, "base64url").toString().split("|");
  const swapped = Buffer.from(`${email}|${exp}|AAAA`).toString("base64url");
  assert.equal(S.verifyChallenge(`${swapped}.${mac}`, code, 2_000), null);
  // A session cookie is not a challenge, and vice versa.
  assert.equal(S.verifySessionValue(ch, 2_000), null);
});

test("attempt cap trips after 5 per challenge", () => {
  const k = "challenge-" + Math.random();
  for (let i = 0; i < 5; i++) assert.equal(S.tooManyAttempts(k, 0), false);
  assert.equal(S.tooManyAttempts(k, 0), true);
});

test("REGRESSION: a challenge cookie is never a session, even re-labelled", () => {
  const ch = S.createChallengeValue("boss@vascobuild.com", S.newSignInCode(), 1_000);
  assert.equal(S.verifySessionValue(ch, 2_000), null);
  // Strip the code hash so the field count matches a session — the purpose
  // tag in the HMAC must still refuse it.
  const [b64, mac] = ch.split(".");
  const [email, exp] = Buffer.from(b64, "base64url").toString().split("|");
  const asSession = Buffer.from(`${email}|${exp}`).toString("base64url");
  assert.equal(S.verifySessionValue(`${asSession}.${mac}`, 2_000), null);
});

test("REGRESSION: a re-spelled challenge is not a fresh limiter key", () => {
  const code = S.newSignInCode();
  const ch = S.createChallengeValue("boss@vascobuild.com", code, 1_000);
  const key = S.challengeKey(ch);
  assert.ok(key);
  const [b64, mac] = ch.split(".");
  for (const v of [`${ch}.x`, `${b64}=.${mac}`, `${b64} .${mac}`, `${b64}.${mac}=`, `${b64}.${mac}.`]) {
    assert.equal(S.challengeKey(v), null, `challengeKey(${v.slice(-6)})`);
    assert.equal(S.verifyChallenge(v, code, 2_000), null, `verify(${v.slice(-6)})`);
  }
  // Five wrong guesses kill the challenge; the right code then fails too.
  const k = S.challengeKey(S.createChallengeValue("boss@vascobuild.com", code, 5_000))!;
  for (let i = 0; i < 5; i++) assert.equal(S.tooManyAttempts(k, 6_000), false);
  assert.equal(S.tooManyAttempts(k, 6_000), true);
});

test("a spent challenge cannot be replayed on this instance", () => {
  const k = S.challengeKey(S.createChallengeValue("boss@vascobuild.com", S.newSignInCode(), 7_000))!;
  assert.equal(S.tooManyAttempts(k, 7_000), false);
  S.markChallengeSpent(k, 7_000);
  assert.equal(S.tooManyAttempts(k, 7_000), true);
});

test("one code email per address per minute", () => {
  const e = `cool-${Math.random()}@vascobuild.com`;
  assert.equal(S.sendCoolingDown(e, 10_000), false);
  assert.equal(S.sendCoolingDown(e.toUpperCase(), 20_000), true);
  assert.equal(S.sendCoolingDown(e, 70_001), false);
});

test("malformed cookie escape is null, not a throw", () => {
  const req = new Request("http://x/", { headers: { cookie: `${S.CHALLENGE_COOKIE}=%E0` } });
  assert.equal(S.readCookie(req, S.CHALLENGE_COOKIE), null);
  assert.equal(S.adminFromRequest(new Request("http://x/", { headers: { cookie: `${S.ADMIN_COOKIE}=%E0` } })), null);
});

test("login POSTs need JSON from this origin", () => {
  const mk = (h: Record<string, string>) => new Request("http://admin.test/api", { method: "POST", headers: h });
  assert.equal(S.isSameOriginJson(mk({ "content-type": "application/json", origin: "http://admin.test", host: "admin.test" })), true);
  assert.equal(S.isSameOriginJson(mk({ "content-type": "text/plain", origin: "http://admin.test", host: "admin.test" })), false);
  assert.equal(S.isSameOriginJson(mk({ "content-type": "application/json", origin: "https://evil.test", host: "admin.test" })), false);
  assert.equal(S.isSameOriginJson(mk({ "content-type": "application/json", host: "admin.test" })), false);
});
