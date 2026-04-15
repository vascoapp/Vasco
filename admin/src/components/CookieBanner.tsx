"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "vasco-admin-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(CONSENT_KEY);
    if (!saved) setVisible(true);
  }, []);

  if (!visible) return null;

  const persist = (value: "accepted" | "rejected") => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {}
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-sm text-zinc-700">
        We use strictly-necessary cookies to run the admin dashboard. Analytics cookies are optional and only set if you accept.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => persist("rejected")}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Essential only
        </button>
        <button
          type="button"
          onClick={() => persist("accepted")}
          className="rounded-lg bg-[#E35205] px-3 py-2 text-sm font-medium text-white hover:bg-[#c44804]"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
