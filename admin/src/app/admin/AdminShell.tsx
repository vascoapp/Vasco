"use client";

import { useState, useEffect } from "react";
import { AdminTabs } from "./AdminTabs";
import { APP_CONFIG } from "../../../admin.config";

const ADMIN_PIN_KEY = "vasco_admin_auth";

function getAdminPin(): string {
  if (typeof window !== "undefined") {
    const env = (window as unknown as Record<string, unknown>).__NEXT_PUBLIC_ADMIN_PIN;
    if (env) return String(env);
  }
  return APP_CONFIG.adminPin;
}

export function AdminShell() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_PIN_KEY);
    if (stored === getAdminPin()) setAuthenticated(true);
    setChecking(false);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === getAdminPin()) {
      sessionStorage.setItem(ADMIN_PIN_KEY, pin);
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#E35205]" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-xs">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E35205]">
                <span className="text-lg font-bold text-white">V</span>
              </div>
              <h1 className="mt-4 text-lg font-bold text-[#0D1B2A]">VascoApp Admin</h1>
              <p className="mt-1 text-xs text-gray-400">Enter PIN to continue</p>
            </div>
            <form onSubmit={handleSubmit} className="mt-6">
              <input
                type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8}
                value={pin} onChange={(e) => { setPin(e.target.value); setError(false); }}
                placeholder="PIN" autoFocus
                className={`w-full rounded-xl border bg-gray-50 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-[#0D1B2A] outline-none transition ${error ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#E35205] focus:ring-1 focus:ring-[#E35205]"}`}
              />
              {error && <p className="mt-2 text-center text-xs text-red-500">Incorrect PIN</p>}
              <button type="submit" className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#E35205] text-sm font-semibold text-white transition hover:bg-[#c44700] active:scale-[0.98]">Enter</button>
            </form>
          </div>
          <p className="mt-4 text-center text-[10px] text-gray-300">VascoApp Internal</p>
        </div>
      </div>
    );
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
            <button onClick={() => { sessionStorage.removeItem(ADMIN_PIN_KEY); setAuthenticated(false); setPin(""); }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-200">Lock</button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] print:max-w-none">
        <AdminTabs />
      </div>
    </div>
  );
}
