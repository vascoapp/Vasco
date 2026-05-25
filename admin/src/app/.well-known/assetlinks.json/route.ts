import { NextResponse } from "next/server";

// =============================================================================
// Served at https://admin.vascobuild.com/.well-known/assetlinks.json
// =============================================================================
// R192 LAUNCH BLOCKER (Android only): SHA-256 fingerprints below are
// placeholders. Until they are replaced with the REAL signing certs,
// Android won't auto-verify Vasco's universal links — tapping a quote
// link from a customer's Gmail will open the browser (and the R190
// landing page) instead of the app, even when Vasco is installed.
//
// HOW TO EXTRACT THE REAL FINGERPRINTS:
//
//   1. Play Store signing cert (for production builds distributed via
//      Play Store):
//        Play Console → Test & release → Setup → App integrity →
//        App signing key certificate → SHA-256 certificate fingerprint
//        Copy the value (it's already in "AA:BB:CC:..." format).
//
//   2. EAS upload cert (for internal-test APKs from `eas build`):
//        eas credentials --platform android
//        → look for "Upload Keystore" → "SHA-256 Fingerprint"
//
//   Both go into sha256_cert_fingerprints[] below. Both must be present
//   for Play-store-signed releases AND TestFlight-equivalent EAS internal
//   distribution to deep-link correctly.
//
//   The list accepts multiple — DON'T pick one. Apple's equivalent
//   apple-app-site-association needs only the appID; Android needs every
//   keystore that signs an APK that customers might install.
//
// SAFE TO LEAVE PLACEHOLDER FOR: iOS-only launch, web-only marketing.
// =============================================================================

export function GET() {
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.vascobuild.app",
        sha256_cert_fingerprints: [
          // R192 TODO before Android launch: replace with Play Store
          // signing cert SHA-256 (see header comment for extraction).
          "REPLACE:WITH:PLAY:SIGNING:SHA256",
          // R192 TODO before Android launch: replace with EAS upload
          // cert SHA-256 (see header comment for extraction).
          "REPLACE:WITH:EAS:UPLOAD:SHA256",
        ],
      },
    },
  ];
  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
