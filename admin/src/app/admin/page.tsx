import { Metadata } from "next";
import { AdminShell } from "./AdminShell";

export const metadata: Metadata = {
  title: "VascoApp Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminShell />;
}
