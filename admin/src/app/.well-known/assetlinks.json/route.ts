import { NextResponse } from "next/server";

// Served at https://vasco.app/.well-known/assetlinks.json
// SHA-256 fingerprints must be replaced with the real Play Store signing cert
// and the EAS upload cert before Android App Links auto-verify.
export function GET() {
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.vasco.app",
        sha256_cert_fingerprints: ["REPLACE:WITH:PLAY:SIGNING:SHA256"],
      },
    },
  ];
  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
