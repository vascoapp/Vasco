import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isSameOriginJson, sessionCookieOptions } from "@/lib/server/adminSession";

// Clears this browser's cookie. It does not revoke a copied session: that
// takes removing the address from ADMIN_EMAILS or rotating the secret.
export async function POST(req: Request) {
  if (!isSameOriginJson(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
