import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Embed the lead-capture widget — Vasco",
  description:
    "Drop-in HTML snippet you paste on your website. Leads flow straight into your Vasco pipeline.",
  alternates: { canonical: "https://vascobuild.com/widget" },
  robots: { index: false }, // not for SEO; this is an in-app helper page
};

// R84 US Phase 4 close: admin-side helper page that renders the embed
// snippet a contractor pastes on their own site. The contractor pulls
// their user_id from Settings → Account in the mobile app, drops it in,
// copies the resulting HTML. Form submissions flow to the `capture-lead`
// Supabase edge function (R84) which inserts into `leads` with
// source='website_form'. Visible immediately in `/contractor/pipeline`
// (R81 Kanban) in their app.
export default function WidgetPage() {
  return (
    <main className="min-h-screen bg-[#0B0E11] text-white antialiased">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="mb-12">
          <a
            href="/"
            className="inline-block font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300"
          >
            ← Vasco
          </a>
        </div>

        <h1 className="mb-4 font-[family-name:var(--font-archivo)] text-4xl font-black leading-tight">
          Embed the lead-capture widget
        </h1>
        <p className="mb-10 font-[family-name:var(--font-inter)] text-zinc-400">
          Paste this two-line snippet anywhere on your site (homepage,
          contact page, footer). Visitors fill the form; leads land in your
          Vasco pipeline tagged{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
            website_form
          </code>
          .
        </p>

        <div className="mb-10 rounded-2xl border border-zinc-800 bg-[#14181F] p-6">
          <h2 className="mb-4 font-[family-name:var(--font-archivo)] text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
            Step 1 · Grab your contractor ID
          </h2>
          <p className="mb-4 text-sm text-zinc-300">
            In the Vasco mobile app: <strong>Profile → Account</strong>. Copy
            the user ID at the bottom of the screen (looks like{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-[#F97316]">
              abc1234d-...
            </code>
            ).
          </p>
        </div>

        <div className="mb-10 rounded-2xl border border-zinc-800 bg-[#14181F] p-6">
          <h2 className="mb-4 font-[family-name:var(--font-archivo)] text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
            Step 2 · Paste this in your HTML
          </h2>
          <pre className="overflow-x-auto rounded-lg border border-zinc-700 bg-[#0B0E11] p-4 font-mono text-xs leading-relaxed text-zinc-200">
{`<!-- Vasco lead-capture widget -->
<div data-vasco-widget></div>
<script async
  src="https://vascobuild.com/widget/embed.js?to=YOUR_CONTRACTOR_ID">
</script>`}
          </pre>
          <p className="mt-4 text-xs text-zinc-500">
            Replace <code className="text-[#F97316]">YOUR_CONTRACTOR_ID</code>{" "}
            with the ID from step 1.
          </p>
        </div>

        <div className="mb-10 rounded-2xl border border-zinc-800 bg-[#14181F] p-6">
          <h2 className="mb-4 font-[family-name:var(--font-archivo)] text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
            Step 3 · Preview
          </h2>
          <p className="mb-6 text-sm text-zinc-400">
            This is what your site visitors will see (the form is live —
            submissions to <code>to=demo</code> are ignored on the backend).
          </p>
          <div data-vasco-widget />
          {/* Live preview pointing at a demo user_id. The capture-lead
              edge fn will reject this with missing_recipient since it's not
              a valid uuid — that's fine for a preview, no spam lands in any
              real account. */}
          <script
            async
            // eslint-disable-next-line react/no-unknown-property
            src="/widget/embed.js?to=demo"
          />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#14181F] p-6">
          <h2 className="mb-4 font-[family-name:var(--font-archivo)] text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
            How it works
          </h2>
          <ul className="space-y-3 text-sm text-zinc-400">
            <li>
              <strong className="text-zinc-200">Submissions land instantly</strong>{" "}
              — leads appear in your Vasco pipeline in the New column within seconds.
            </li>
            <li>
              <strong className="text-zinc-200">Rate-limited per visitor</strong>{" "}
              — 5 submissions / hour / IP. Honeypot field blocks naive bots.
            </li>
            <li>
              <strong className="text-zinc-200">No tracking, no cookies</strong>{" "}
              — the widget loads no analytics, no ads, no third-party
              dependencies. Compatible with GDPR + CCPA out of the box.
            </li>
            <li>
              <strong className="text-zinc-200">Style overrides</strong> —
              the form ships with its own scoped CSS (.vasco-form prefix).
              Want it to match your site? Add CSS targeting{" "}
              <code>.vasco-form</code> on the host page; rules override the
              widget defaults.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
