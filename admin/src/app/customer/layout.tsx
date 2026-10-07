import type { Metadata } from "next";

// Capability / transactional page for one person, not for search: the path
// often carries a code or token, and an indexed copy helps nobody.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return children;
}
