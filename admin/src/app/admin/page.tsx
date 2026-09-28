import { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminShell } from "./AdminShell";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/server/adminSession";

export const metadata: Metadata = {
  title: "VascoApp Admin",
  robots: { index: false, follow: false },
};

// Per request: the session is decided on the server, never in the browser.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const email = verifySessionValue((await cookies()).get(ADMIN_COOKIE)?.value);
  return <AdminShell email={email} />;
}
