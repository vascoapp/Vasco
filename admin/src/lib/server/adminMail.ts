// Sends the admin sign-in code through Resend. SERVER ONLY.
//   RESEND_API_KEY     required in production
//   ADMIN_FROM_EMAIL   default admin@mail.vascobuild.com (verified sending domain)
// Without a key in development the code is printed to the server log, so the
// login works locally; in production a missing key is an error, never a log.

if (typeof window !== "undefined") {
  throw new Error("adminMail is server-only");
}

export async function sendSignInCode(email: string, code: string, minutes: number): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[admin-login] code for ${email}: ${code} (no RESEND_API_KEY — dev only)`);
      return true;
    }
    console.error("[admin-login] RESEND_API_KEY missing — cannot send sign-in code");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Vasco Admin <${process.env.ADMIN_FROM_EMAIL ?? "admin@mail.vascobuild.com"}>`,
      to: [email],
      subject: `Vasco admin sign-in code: ${code}`,
      text: `Your Vasco admin sign-in code is ${code}.\n\nIt expires in ${minutes} minutes and only works in the browser that asked for it.\nIf you did not try to sign in, ignore this email.`,
    }),
  });
  if (!res.ok) console.error(`[admin-login] Resend ${res.status}: ${await res.text()}`);
  return res.ok;
}
