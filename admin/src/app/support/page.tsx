import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Vasco",
  description:
    "Get help with Vasco — the AI-native admin app for construction trades.",
  robots: { index: true, follow: true },
};

// R66r67: lightweight /support landing referenced by App Store Connect's
// Support URL field (see docs/app-review-info.md). Static, no CMS needed.
// Brand team can replace the FAQ items + add a contact form when convenient;
// the structure here is the minimum App Store reviewers need to see at the
// URL: a real page (not a 404) with a working contact email + escalation path.

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I sign in?",
    a: "Open the Vasco app and tap Sign in. Enter the email you signed up with and your password. If you forgot your password, tap 'Forgot password?' and we'll email a reset link.",
  },
  {
    q: "Where is my data stored?",
    a: "All Vasco data lives in EU datacenters (Supabase in Frankfurt). We never transfer your data outside the EU. Full details: see Privacy Policy.",
  },
  {
    q: "How do I delete my account?",
    a: "Open the app → Profile → Legal → Delete my account. Your data is queued for permanent deletion within 30 days per GDPR Article 17. We send a confirmation email when deletion completes.",
  },
  {
    q: "How do I export my data?",
    a: "Profile → Legal → Export my data. You get a JSON or CSV file with everything we store about you: jobs, quotes, invoices, customers, materials, photos. Includes both the local cache and the server-side records.",
  },
  {
    q: "Why isn't my payment link working?",
    a: "Make sure you've connected Mollie (EU) or Stripe (UK) in Profile → Integrations. Use a real (live_) API key, not a test key, for live invoices. If the link still fails, contact support@vasco.dev with your invoice number.",
  },
  {
    q: "My customer didn't receive the invoice email",
    a: "Check the customer's email address in the invoice detail screen. Spam folder is the most common cause. We log every send attempt — support can confirm the email went out and to which address.",
  },
];

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-8 text-sm">
        <a href="/" className="text-zinc-500 hover:text-zinc-900">
          ← Vasco
        </a>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-zinc-900">Support</h1>
        <p className="mt-2 text-zinc-600">
          Quick answers to common questions. For anything else, email{" "}
          <a
            href="mailto:support@vasco.dev"
            className="text-[#F97316] underline"
          >
            support@vasco.dev
          </a>{" "}
          and a real person will reply within one business day.
        </p>
      </header>

      <section className="space-y-6">
        {FAQ.map((item, i) => (
          <details
            key={i}
            className="group rounded-lg border border-zinc-200 bg-white p-5 open:bg-zinc-50"
          >
            <summary className="cursor-pointer list-none font-medium text-zinc-900 group-open:mb-3">
              {item.q}
            </summary>
            <p className="text-zinc-700">{item.a}</p>
          </details>
        ))}
      </section>

      <section className="mt-12 rounded-lg border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Other ways to get help
        </h2>
        <ul className="mt-4 space-y-2 text-zinc-700">
          <li>
            <strong>Email:</strong>{" "}
            <a
              href="mailto:support@vasco.dev"
              className="text-[#F97316] underline"
            >
              support@vasco.dev
            </a>
          </li>
          <li>
            <strong>Privacy questions:</strong>{" "}
            <a
              href="mailto:privacy@vasco.dev"
              className="text-[#F97316] underline"
            >
              privacy@vasco.dev
            </a>
          </li>
          <li>
            <strong>GDPR / data subject requests:</strong>{" "}
            <a
              href="/legal/gdpr-data-subject-request-process"
              className="text-[#F97316] underline"
            >
              Submit a request
            </a>
          </li>
        </ul>
      </section>

      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
        © {new Date().getFullYear()} Vasco — Amsterdam, The Netherlands
      </footer>
    </main>
  );
}
