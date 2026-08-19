// The page itself is a client component (it reads navigator.language and calls
// the capability RPCs), and a client component cannot export `metadata`. This
// server layout exists only to give the route its own identity.
//
// It matters more here than on a marketing page: this link is pasted into
// WhatsApp and SMS, and the preview title is the first thing the customer sees
// — deciding whether a link from a number they may not have saved is safe to
// open. It inherited "Vasco — Run your trade business from your phone", which
// is addressed to the contractor and says nothing about a quote.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your quote · Vasco',
  description: 'Review and accept the quote your contractor sent you. No account needed.',
  // A capability URL must never reach a search index: the token in the path is
  // the credential.
  robots: { index: false, follow: false },
};

export default function AcceptLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
