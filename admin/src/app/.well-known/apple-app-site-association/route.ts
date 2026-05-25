import { NextResponse } from "next/server";

// Served at https://admin.vascobuild.com/.well-known/apple-app-site-association
// (the admin project's Vercel deployment hosts this path — same domain
// that also hosts the legal pages and the referral landing at /ref/[code]).
const APP_ID = "3DX8FBF7S6.com.vascobuild.app";

export function GET() {
  const body = {
    applinks: {
      details: [
        {
          appIDs: [APP_ID],
          components: [
            { "/": "/quote/*", comment: "Customer quote portal" },
            { "/": "/invoice/*", comment: "Invoice view" },
            // R231 — referral deep link. admin.vascobuild.com/ref/CODE opens
            // the app at app/ref/[code].tsx which routes to signup.
            { "/": "/ref/*", comment: "Referral attribution" },
            // R189 — Supabase email confirmation / magic-link / password
            // recovery. Email contains https://admin.vascobuild.com/auth/callback#...
            // → iOS opens the app directly at app/auth/callback.tsx with the
            // hash intact. Web fallback page (admin/src/app/auth/callback/page.tsx)
            // covers desktop + uninstalled-app cases.
            { "/": "/auth/callback*", comment: "Supabase auth callback" },
            // R190 — customer decision portal. Contractor shares
            // admin.vascobuild.com/customer/CODE → on iOS with the app
            // installed, opens directly at app/customer/[code].tsx; otherwise
            // falls back to admin/src/app/customer/[code]/page.tsx.
            { "/": "/customer/*", comment: "Customer decision portal" },
            // R190 — one-tap quote acceptance link. Contractor shares
            // admin.vascobuild.com/accept/TOKEN. Same flow as /customer/*.
            { "/": "/accept/*", comment: "Quote acceptance link" },
          ],
        },
      ],
    },
  };
  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
