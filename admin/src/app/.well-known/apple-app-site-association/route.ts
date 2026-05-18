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
