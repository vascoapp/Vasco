import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE, CHALLENGE_COOKIE, challengeKey, createSessionValue, isSameOriginJson, markChallengeSpent, readCookie,
  sessionCookieOptions, tooManyAttempts, verifyChallenge,
} from "@/lib/server/adminSession";

// Step 2: the code from the email, checked against this browser's challenge.
export async function POST(req: Request) {
  if (!isSameOriginJson(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const challenge = readCookie(req, CHALLENGE_COOKIE);
  // One key per challenge however it is spelled; unsigned or malformed = expired.
  const key = challengeKey(challenge);
  if (!key) return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });
  if (tooManyAttempts(key)) {
    const res = NextResponse.json({ ok: false, error: "too_many" }, { status: 429 });
    res.cookies.set(CHALLENGE_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  }
  const email = verifyChallenge(challenge, code);
  if (!email) return NextResponse.json({ ok: false, error: "wrong_code" }, { status: 401 });

  markChallengeSpent(key);
  const res = NextResponse.json({ ok: true, email });
  res.cookies.set(ADMIN_COOKIE, createSessionValue(email), sessionCookieOptions());
  res.cookies.set(CHALLENGE_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
