// =============================================================================
// Admin session — email allow-list + a signed, HttpOnly cookie.
// =============================================================================
// The admin was gated by a PIN compared IN THE BROWSER against a constant in
// the bundle: anyone could read it, and no real data could sit behind it
// (user's decision 2026-09-27: email sign-in, allow-list, server-only data).
//
//   ADMIN_EMAILS          comma-separated allow-list (case-insensitive)
//   ADMIN_SESSION_SECRET  ≥ 32 chars; signs the session cookie
//
// The cookie carries only `email|expiry|hmac`. Every request re-checks the
// signature AND the allow-list, so removing an address locks it out at once.
// SERVER ONLY — the secret must never reach a browser bundle.
// =============================================================================
import { createHmac, randomInt, timingSafeEqual } from "crypto";

// Runtime guard, not `import "server-only"`: that name resolves only inside
// Next's build, and `npm run test:auth` imports this file with plain node.
if (typeof window !== "undefined") {
  throw new Error("adminSession is server-only");
}

export const ADMIN_COOKIE = "vasco_admin_session";
export const SESSION_HOURS = 12;

export function allowedAdmins(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
  );
}

export function isAllowedAdmin(email: string | null | undefined): boolean {
  return !!email && allowedAdmins().has(email.trim().toLowerCase());
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET ?? "";
  // A short or missing secret is a forgeable cookie: refuse to sign or verify.
  if (s.length < 32) throw new Error("ADMIN_SESSION_SECRET missing or shorter than 32 characters");
  return s;
}

// Domain-separated: a challenge (issued BEFORE the code is entered) must never
// verify as a session. With one shared HMAC and a lenient split, it did — the
// challenge cookie alone signed you in, no code needed.
type Purpose = "session" | "challenge";
const sign = (purpose: Purpose, payload: string) =>
  createHmac("sha256", secret()).update(`${purpose}\n${payload}`).digest("base64url");

// ONE strict reader for both cookie kinds: exactly `b64.mac`, canonical
// base64url (re-encoding must give the same text), MAC checked. The lenient
// version (`split(".")` ignoring extra segments, Node's forgiving base64
// decoder) let `value + ".x"` or `b64 + "="` verify as a DIFFERENT string —
// a fresh key for the attempt limiter on every guess (review 2026-09-28).
function openSigned(purpose: Purpose, value: string | null | undefined, fields: number): { parts: string[]; mac: string } | null {
  if (!value) return null;
  const segs = value.split(".");
  if (segs.length !== 2) return null;
  const [b64, mac] = segs;
  if (!/^[A-Za-z0-9_-]+$/.test(b64) || !/^[A-Za-z0-9_-]+$/.test(mac)) return null;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  if (Buffer.from(payload).toString("base64url") !== b64) return null;
  let expected: Buffer;
  try { expected = Buffer.from(sign(purpose, payload)); } catch { return null; }
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const parts = payload.split("|");
  return parts.length === fields ? { parts, mac } : null;
}

export function createSessionValue(email: string, now: number = Date.now()): string {
  const exp = now + SESSION_HOURS * 3600_000;
  const payload = `${email.trim().toLowerCase()}|${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign("session", payload)}`;
}

/** The signed-in admin's email, or null (bad signature, expired, or no longer allowed). */
export function verifySessionValue(value: string | null | undefined, now: number = Date.now()): string | null {
  const opened = openSigned("session", value, 2);
  if (!opened) return null;
  const [email, expRaw] = opened.parts;
  const exp = Number(expRaw);
  if (!email || !Number.isFinite(exp) || exp < now) return null;
  return isAllowedAdmin(email) ? email : null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  };
}

/** For route handlers: the admin's email from the request cookie, or null. */
export function adminFromRequest(req: Request): string | null {
  return verifySessionValue(readCookie(req, ADMIN_COOKIE));
}

// -----------------------------------------------------------------------------
// Sign-in code — emailed to an allow-listed address, bound to a challenge cookie.
// -----------------------------------------------------------------------------
// Stateless: the challenge cookie carries `email|expiry|sha256(code)` under the
// same HMAC, so there is no table to keep. 8 digits + 10 minutes + the
// per-instance attempt cap below keep guessing out of reach; the cookie is
// HttpOnly and cleared on success; replay is refused per instance (below).

export const CHALLENGE_COOKIE = "vasco_admin_challenge";
export const CODE_MINUTES = 10;

const hashCode = (code: string) => createHmac("sha256", secret()).update(`code:${code}`).digest("base64url");

export function newSignInCode(): string {
  // randomInt is uniform; Math.random is not a secret.
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

export function createChallengeValue(email: string, code: string, now: number = Date.now()): string {
  const exp = now + CODE_MINUTES * 60_000;
  const payload = `${email.trim().toLowerCase()}|${exp}|${hashCode(code)}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign("challenge", payload)}`;
}

/**
 * The limiter/replay key for a challenge: its MAC, and only for a canonical,
 * correctly signed value — so every spelling of one challenge is ONE key.
 */
export function challengeKey(value: string | null | undefined): string | null {
  return openSigned("challenge", value, 3)?.mac ?? null;
}

/** The email the code was sent to, when `code` matches an unexpired, untampered challenge. */
export function verifyChallenge(value: string | null | undefined, code: string, now: number = Date.now()): string | null {
  if (!/^\d{8}$/.test(code.trim())) return null;
  const opened = openSigned("challenge", value, 3);
  if (!opened) return null;
  const [email, expRaw, codeHash] = opened.parts;
  if (!email || !codeHash || !(Number(expRaw) >= now)) return null;
  const want = Buffer.from(codeHash);
  const got = Buffer.from(hashCode(code.trim()));
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return isAllowedAdmin(email) ? email : null;
}

// Best-effort, PER SERVER INSTANCE (a serverless fleet multiplies these; a
// WAF rate limit on /api/admin/login/* is the durable layer):
//  - 5 guesses per challenge (keyed by challengeKey, so it cannot be reset
//    by re-spelling the cookie), then the challenge is dead;
//  - a challenge that signed someone in is spent — a replayed cookie + code
//    fails on this instance;
//  - one code email per address per minute.
type Slot = { n: number; until: number };
const guesses = new Map<string, Slot>();
const spent = new Map<string, number>();
const sends = new Map<string, number>();
function sweep(now: number) {
  for (const [k, v] of guesses) if (v.until < now) guesses.delete(k);
  for (const [k, until] of spent) if (until < now) spent.delete(k);
  for (const [k, until] of sends) if (until < now) sends.delete(k);
}
export function tooManyAttempts(key: string, now: number = Date.now(), max = 5): boolean {
  sweep(now);
  if (spent.has(key)) return true;
  const a = guesses.get(key) ?? { n: 0, until: now + CODE_MINUTES * 60_000 };
  a.n += 1;
  guesses.set(key, a);
  return a.n > max;
}
export function markChallengeSpent(key: string, now: number = Date.now()): void {
  spent.set(key, now + CODE_MINUTES * 60_000);
}
/** True when a code was sent to this address in the last minute. */
export function sendCoolingDown(email: string, now: number = Date.now()): boolean {
  sweep(now);
  const k = email.trim().toLowerCase();
  if (sends.has(k)) return true;
  sends.set(k, now + 60_000);
  return false;
}

/**
 * CSRF brake for the login/logout POSTs: a JSON body AND an Origin that is
 * this host. `req.json()` parses a cross-site text/plain form just as well.
 */
export function isSameOriginJson(req: Request): boolean {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return false;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  if (!m) return null;
  // A malformed %-escape is a bad cookie, not a 500.
  try { return decodeURIComponent(m.slice(name.length + 1)); } catch { return null; }
}
