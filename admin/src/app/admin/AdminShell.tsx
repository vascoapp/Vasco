"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// Loaded only once signed in: a static import shipped the whole dashboard
// bundle to every visitor of the sign-in page.
const AdminTabs = dynamic(() => import("./AdminTabs").then((m) => m.AdminTabs), { ssr: false });

// Sign-in is email → emailed code → HttpOnly session cookie, all decided by
// /api/admin/* on the server against the ADMIN_EMAILS allow-list. This used to
// compare a PIN from the JS bundle in the browser (user's decision 2026-09-27).

const ERRORS: Record<string, string> = {
  wrong_code: "That code is not right. Check the latest email.",
  expired: "The code expired. Ask for a new one.",
  too_many: "Too many tries. Ask for a new code.",
  not_configured: "Admin sign-in is not configured on this server.",
};

function SignIn() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === "email") {
        const r = await post("/api/admin/login/start", { email });
        if (r.ok) setStep("code");
        else setError(ERRORS[r.error ?? ""] ?? "Something went wrong.");
      } else {
        const r = await post("/api/admin/login/verify", { code });
        if (r.ok) router.refresh();
        else {
          setError(ERRORS[r.error ?? ""] ?? "Something went wrong.");
          setCode("");
          if (r.error === "expired" || r.error === "too_many") setStep("email");
        }
      }
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[#0D1B2A] outline-none transition focus:border-[#E35205] focus:ring-1 focus:ring-[#E35205]";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-xs">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E35205]">
              <span className="text-lg font-bold text-white">V</span>
            </div>
            <h1 className="mt-4 text-lg font-bold text-[#0D1B2A]">VascoApp Admin</h1>
            <p className="mt-1 text-xs text-gray-400">
              {step === "email" ? "Sign in with your admin email" : `If ${email} is an admin address, a code is on its way.`}
            </p>
          </div>
          <form onSubmit={submit} className="mt-6">
            {step === "email" ? (
              <input type="email" required autoFocus autoComplete="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@vascobuild.com" className={input} />
            ) : (
              <input type="text" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8}
                value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }}
                placeholder="8-digit code" className={`${input} text-center text-lg font-bold tracking-[0.3em]`} />
            )}
            {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={busy}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#E35205] text-sm font-semibold text-white transition hover:bg-[#c44700] active:scale-[0.98] disabled:opacity-60">
              {busy ? "…" : step === "email" ? "Send code" : "Sign in"}
            </button>
            {step === "code" && (
              <button type="button" onClick={() => { setStep("email"); setCode(""); setError(null); }}
                className="mt-2 w-full text-center text-xs text-gray-400 hover:text-gray-600">Use another email</button>
            )}
          </form>
        </div>
        <p className="mt-4 text-center text-[10px] text-gray-300">VascoApp Internal</p>
      </div>
    </div>
  );
}

export function AdminShell({ email }: { email: string | null }) {
  const router = useRouter();
  if (!email) return <SignIn />;

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <header className="border-b border-gray-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E35205]">
              <span className="text-xs font-bold text-white">V</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#0D1B2A]">VascoApp Admin</h1>
              <p className="text-[10px] text-gray-400">AI-Native Construction Trades Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] text-gray-300 sm:inline">{"\u2318"}1-6 quick nav</span>
            <span className="hidden text-[10px] text-gray-400 md:inline">{email}</span>
            <button onClick={signOut} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-200">Sign out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] print:max-w-none">
        <AdminTabs />
      </div>
    </div>
  );
}
