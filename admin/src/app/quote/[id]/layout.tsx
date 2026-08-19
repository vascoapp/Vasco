// See accept/[token]/layout.tsx — same reason: a client page cannot export
// metadata, and this URL is shared in a chat app where the preview title is the
// customer's first signal.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your quote · Vasco',
  description: 'The quote your contractor sent you, with everything that is included.',
  // The `?t=` token is a bearer credential; keep this out of every index.
  robots: { index: false, follow: false },
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
