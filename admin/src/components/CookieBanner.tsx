"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "vasco-admin-cookie-consent";

/**
 * ⚠️ TWO THINGS TO KNOW BEFORE TOUCHING THIS.
 *
 * 1. **Nothing reads `vasco-admin-cookie-consent`.** Grep it: the only file
 *    that mentions the key is this one. Accepting and rejecting do exactly the
 *    same thing. There is also no analytics package in admin/package.json and
 *    no third-party script in the root layout, so there are no non-essential
 *    cookies for it to gate. A consent dialog that offers a choice it does not
 *    honour is worse than no dialog: ePrivacy requires consent for
 *    non-essential storage, not a button that pretends to ask.
 *
 *    Left in place rather than deleted, because the moment analytics IS added
 *    this has to come back — and come back WIRED. If you add tracking, read
 *    this key before loading it.
 *
 * 2. It used to render on every page in the app, including the customer
 *    landings, because it is mounted in the ROOT layout. So a Dutch homeowner
 *    opening a quote link got a white English box over a dark page telling
 *    them about cookies used "to run the admin dashboard" — on the one screen
 *    where the job is to accept a quote. Now scoped to /admin, which is the
 *    only surface the copy was ever about.
 */
const ADMIN_ONLY_PREFIX = "/admin";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Read at mount, not at render: the root layout is shared by the customer
    // capability pages (/accept, /quote, /customer, /ref) and those must never
    // show this.
    if (!window.location.pathname.startsWith(ADMIN_ONLY_PREFIX)) return;
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
