import { NextResponse } from "next/server";

// Served at https://vasco.app/.well-known/apple-app-site-association
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
            { "/": "/quote/*", "comment": "Customer quote portal" },
            { "/": "/invoice/*", "comment": "Invoice view" },
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
