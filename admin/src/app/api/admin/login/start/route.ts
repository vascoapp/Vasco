import { after, NextResponse } from "next/server";
import {
  CHALLENGE_COOKIE, CODE_MINUTES, createChallengeValue, isAllowedAdmin, isSameOriginJson, newSignInCode,
  sendCoolingDown, sessionCookieOptions,
} from "@/lib/server/adminSession";
import { sendSignInCode } from "@/lib/server/adminMail";

// Step 1: an email in, a code out — but only to an allow-listed address.
// Every caller gets the SAME answer: 200, a signed challenge cookie (for a
// code nobody is sent, when the address is not an admin), and no wait on the
// mail provider — the email goes out after the response. Status, cookie or
// latency differing by address told anyone who the admins are (review
// 2026-09-28).
export async function POST(req: Request) {
  if (!isSameOriginJson(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const code = newSignInCode();
  let challenge: string;
  try {
    challenge = createChallengeValue(email || "-", code);
  } catch (err) {
    // Missing secret: the same for every address, so it reveals nothing.
    console.error("[admin-login]", err);
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  if (isAllowedAdmin(email) && !sendCoolingDown(email)) {
    after(async () => {
      if (!(await sendSignInCode(email, code, CODE_MINUTES))) console.error(`[admin-login] code email to ${email} failed`);
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CHALLENGE_COOKIE, challenge, { ...sessionCookieOptions(), maxAge: CODE_MINUTES * 60 });
  return res;
}
