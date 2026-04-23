import { NextResponse } from "next/server";

// Served at https://admin.vasco.app/.well-known/apple-app-site-association
// (the admin project's Vercel deployment hosts this path — same domain
// that also hosts the legal pages and the referral landing at /ref/[code]).
// Team ID is a placeholder — user must replace with real Apple Team ID from
// App Store Connect before the iOS universal link verification step.
const APP_ID = "REPLACE_APPLE_TEAM_ID.com.vasco.app";

export function GET() {
  const body = {
    applinks: {
      details: [
        {
          appIDs: [APP_ID],
          components: [
            { "/": "/quote/*", comment: "Customer quote portal" },
            { "/": "/invoice/*", comment: "Invoice view" },
            // R231 — referral deep link. admin.vasco.app/ref/CODE opens
            // the app at app/ref/[code].tsx which routes to signup.
            { "/": "/ref/*", comment: "Referral attribution" },
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
