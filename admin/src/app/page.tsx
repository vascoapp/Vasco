import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vasco — Your guide to running a trade business",
  description:
    "Vasco knows the way. The AI back-office for plumbers, electricians, painters, carpenters, and aannemers. Free forever — 3.5% per paid invoice. Pro from €39/mo.",
  openGraph: {
    title: "Vasco — Your guide to running a trade business",
    description:
      "Free forever — 3.5% per paid invoice. Pro from €39/mo. Built for the trades across NL, DE, FR, ES, IT, UK.",
    type: "website",
    url: "https://vascobuild.com",
  },
};

const MARKETS = [
  { code: "NL", name: "Netherlands" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "UK", name: "United Kingdom" },
];

const STATS = [
  { value: "8h", label: "Saved per week" },
  { value: "5", label: "Taps quote → invoice" },
  { value: "6", label: "Countries" },
  { value: "15", label: "Trades" },
];

const GUIDE_THROUGH = [
  {
    no: "01",
    label: "The admin pile",
    title: "Out of the laptop.\nBack on the tools.",
    body:
      "Quotes, jobs, invoices, follow-up — Vasco handles the paperwork. You handle the work. No more nights at the kitchen table catching up on the week.",
  },
  {
    no: "02",
    label: "EU compliance",
    title: "Belastingdienst.\nKvK. BTW. Done.",
    body:
      "XRechnung. Peppol. FatturaPA. KOR. Kleinunternehmer. Vasco knows the rules of every market you work in — and follows them for you.",
  },
  {
    no: "03",
    label: "Slow payers",
    title: "Get paid.\nOn time.",
    body:
      "Payment link on every invoice. Auto-chase at 14 and 30 days. Late-payment fees calculated to EU 2011/7/EU. Vasco doesn't forget.",
  },
];

const HOW_IT_WORKS = [
  {
    n: "1",
    title: "Photo the job.",
    body:
      "Snap the wall, the boiler, the leak. Vasco reads the photo, drafts the quote with materials and hours.",
  },
  {
    n: "2",
    title: "Send the quote.",
    body:
      "Customer signs on their phone. Job created. Calendar blocked. No back-and-forth.",
  },
  {
    n: "3",
    title: "Get paid.",
    body:
      "Work the job, tap done. Invoice goes out with a payment link. iDEAL, card, Bancontact — your customer's choice.",
  },
];

const TRADES = [
  "Plumbing",
  "Electrical",
  "Gas / HVAC",
  "Painting",
  "Carpentry",
  "Roofing",
  "Tiling",
  "Plastering",
  "Flooring",
  "Insulation",
  "Solar",
  "Glazing",
  "Landscaping",
  "Masonry",
  "Demolition",
];

const FAQ = [
  {
    q: "When does Vasco launch?",
    a: "iOS rolls out market-by-market starting in the Netherlands in 2026. Join the waitlist to get early access in your country.",
  },
  {
    q: "Do I need a subscription?",
    a: "Free tier is forever free — 3.5% commission on every paid invoice, no monthly fee. Pro (€39/mo) drops it to 2% and unlocks unlimited jobs, full AI, ML predictions, and the purchasing agent. Contractor (€69/mo) drops it to 1% and adds team seats, API access, and white-label. Most active contractors break even on Pro within their first invoice.",
  },
  {
    q: "What about my existing accounting software?",
    a: "Vasco connects to Moneybird, DATEV, Lexoffice, SevDesk, Pennylane, Holded, Fatture in Cloud, Xero, QuickBooks, and 10 more. Your invoices sync automatically — no double entry.",
  },
  {
    q: "Is it compliant with EU e-invoicing rules?",
    a: "Yes. XRechnung (DE), Peppol (NL/EU), Factur-X (FR), Facturae (ES), FatturaPA (IT) — Vasco generates structured e-invoices in the format each market requires.",
  },
  {
    q: "Who is Vasco for?",
    a: "Solo contractors (plumbers, electricians, painters, carpenters), multi-trade aannemers running renovation projects, and site leads managing field crews. If you work with your hands and send invoices, Vasco is for you.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0B0E11] text-white antialiased">
      {/* Background texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.015]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0B0E11]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full font-[family-name:var(--font-archivo)] text-lg font-black"
              style={{
                background:
                  "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
                boxShadow: "0 0 24px rgba(249,115,22,0.4)",
              }}
            >
              V
            </div>
            <span className="font-[family-name:var(--font-archivo)] text-xl font-black uppercase tracking-[0.18em]">
              Vasco
            </span>
          </a>
          <nav className="hidden items-center gap-8 font-[family-name:var(--font-inter)] text-sm font-medium text-zinc-400 md:flex">
            <a href="#how" className="transition hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
            <a href="/support" className="transition hover:text-white">
              Support
            </a>
            <a
              href="mailto:hello@vascobuild.com?subject=Vasco%20waitlist"
              className="rounded-xl bg-white px-4 py-2 font-[family-name:var(--font-inter)] text-sm font-semibold text-[#0B0E11] transition hover:bg-zinc-200"
            >
              Get early access
            </a>
          </nav>
        </div>
        <div
          aria-hidden
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #F97316 50%, transparent 100%)",
            opacity: 0.4,
          }}
        />
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[700px] w-[1400px] -translate-x-1/2 opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at center, #F97316 0%, transparent 60%)",
          }}
        />

        <div className="mx-auto max-w-7xl px-6 pb-32 pt-24 sm:pt-40">
          <div className="grid items-center gap-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#F97316]/30 bg-[#F97316]/5 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F97316] shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                <span className="font-[family-name:var(--font-inter)] text-xs font-semibold uppercase tracking-[0.18em] text-[#F97316]">
                  Coming 2026 — Join the waitlist
                </span>
              </div>

              <h1 className="mb-8 font-[family-name:var(--font-archivo)] text-6xl font-black leading-[0.92] tracking-tight sm:text-7xl md:text-8xl">
                Vasco knows{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #C2410C 0%, #F97316 50%, #F59E0B 100%)",
                  }}
                >
                  the way.
                </span>
              </h1>

              <p className="mb-10 max-w-xl font-[family-name:var(--font-inter)] text-lg leading-relaxed text-zinc-400 sm:text-xl">
                Your guide to running a trade business. From quote to cash, EU
                compliance to chasing late payers — Vasco walks you through the
                parts of the job nobody trained you for.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="mailto:hello@vascobuild.com?subject=Vasco%20waitlist&body=I'm%20a%20%5Bplumber%2Felectrician%2Faannemer%5D%20in%20%5BNL%2FDE%2FFR%2F...%5D.%20Add%20me%20to%20the%20Vasco%20waitlist."
                  className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 font-[family-name:var(--font-archivo)] text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:brightness-110"
                  style={{
                    background:
                      "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
                    boxShadow: "0 0 36px rgba(249,115,22,0.4)",
                  }}
                >
                  Get early access
                  <span aria-hidden>→</span>
                </a>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-7 py-4 font-[family-name:var(--font-inter)] text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/50"
                >
                  See how it works
                </a>
              </div>
            </div>

            {/* Hero side panel — phone mockup substitute */}
            <div className="hidden lg:block">
              <div
                className="relative aspect-[9/16] w-full overflow-hidden rounded-[2.5rem] border border-zinc-800 bg-gradient-to-br from-[#1C2128] to-[#0B0E11] p-8 shadow-2xl"
                style={{
                  boxShadow:
                    "0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(249,115,22,0.15)",
                }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Vandaag · Vrijdag
                  </div>
                  <div
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ background: "#F97316" }}
                  >
                    LIVE
                  </div>
                </div>
                <div
                  className="mb-6 rounded-2xl p-5"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(154,52,18,0.4) 0%, rgba(194,65,12,0.4) 50%, rgba(249,115,22,0.3) 100%)",
                    border: "1px solid rgba(249,115,22,0.3)",
                  }}
                >
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#F97316]">
                    VASCO SAVED YOU
                  </div>
                  <div className="font-[family-name:var(--font-archivo)] text-4xl font-black">
                    3h · €420
                  </div>
                  <div className="mt-1 text-xs text-zinc-300">This week</div>
                </div>
                <div className="space-y-3">
                  {[
                    { time: "09:00", label: "Boiler service — Jansen" },
                    { time: "11:30", label: "Quote photo — Bakker BV" },
                    { time: "14:00", label: "Invoice #2026-041 paid" },
                  ].map((row) => (
                    <div
                      key={row.time}
                      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#1C2128] px-4 py-3"
                    >
                      <div className="font-[family-name:var(--font-archivo)] text-xs font-black text-[#F97316]">
                        {row.time}
                      </div>
                      <div className="flex-1 font-[family-name:var(--font-inter)] text-sm text-zinc-200">
                        {row.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0B0E11] to-transparent" />
              </div>
            </div>
          </div>

          {/* Markets row */}
          <div className="mt-24 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/5 pt-10 font-[family-name:var(--font-inter)] text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span>Working in</span>
            {MARKETS.map((m) => (
              <span key={m.code} className="text-zinc-300">
                {m.code}
                <span className="ml-2 hidden text-zinc-600 md:inline">
                  {m.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/5 bg-gradient-to-b from-[#0B0E11] to-[#0E1217]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={
                  "px-2 " + (i < STATS.length - 1 ? "md:border-r md:border-white/5" : "")
                }
              >
                <div
                  className="mb-2 font-[family-name:var(--font-archivo)] text-5xl font-black sm:text-6xl"
                  style={{ color: "#F97316" }}
                >
                  {s.value}
                </div>
                <div className="font-[family-name:var(--font-inter)] text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guide-through */}
      <section id="guide" className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mb-20 max-w-3xl">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              What Vasco does
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              Your guide through the stuff{" "}
              <span style={{ color: "#F59E0B" }}>nobody trained you for.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {GUIDE_THROUGH.map((g) => (
              <div
                key={g.no}
                className="group relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#161A20] to-[#0F1218] p-8 transition hover:border-[#F97316]/30"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full opacity-0 blur-3xl transition group-hover:opacity-25"
                  style={{ background: "#F97316" }}
                />
                <div className="mb-8 flex items-baseline justify-between">
                  <div
                    className="font-[family-name:var(--font-archivo)] text-6xl font-black opacity-20"
                    style={{ color: "#F97316" }}
                  >
                    {g.no}
                  </div>
                  <div className="font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                    {g.label}
                  </div>
                </div>
                <h3 className="mb-4 whitespace-pre-line font-[family-name:var(--font-archivo)] text-3xl font-extrabold leading-[1.02] text-white">
                  {g.title}
                </h3>
                <p className="font-[family-name:var(--font-inter)] text-base leading-relaxed text-zinc-400">
                  {g.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="border-t border-white/5 bg-gradient-to-b from-[#0E1217] to-[#0B0E11]"
      >
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mb-20 max-w-3xl">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              How it works
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              Three steps.{" "}
              <span style={{ color: "#F59E0B" }}>One day&apos;s work.</span>
            </h2>
          </div>

          <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            {/* Connecting line */}
            <div
              aria-hidden
              className="absolute left-8 right-8 top-8 -z-10 hidden h-px md:block"
              style={{
                background:
                  "linear-gradient(90deg, #F97316 0%, transparent 50%, #F97316 100%)",
                opacity: 0.3,
              }}
            />
            {HOW_IT_WORKS.map((step) => (
              <div key={step.n}>
                <div
                  className="mb-7 inline-flex h-16 w-16 items-center justify-center rounded-2xl font-[family-name:var(--font-archivo)] text-3xl font-black"
                  style={{
                    background:
                      "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
                    boxShadow: "0 0 24px rgba(249,115,22,0.35)",
                  }}
                >
                  {step.n}
                </div>
                <h3 className="mb-3 font-[family-name:var(--font-archivo)] text-2xl font-extrabold sm:text-3xl">
                  {step.title}
                </h3>
                <p className="font-[family-name:var(--font-inter)] text-base leading-relaxed text-zinc-400">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING — new */}
      <section
        id="pricing"
        className="relative overflow-hidden border-t border-white/5 bg-[#0E1217]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-15 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse 800px 400px at 50% 0%, #F97316 0%, transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-5xl px-6 py-28">
          <div className="mb-16 text-center">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              Pricing
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              You only pay{" "}
              <span style={{ color: "#F59E0B" }}>when you get paid.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Free",
                price: "€0",
                period: "/mo",
                commission: "3.5%",
                tagline: "Get started. No commitment.",
                features: [
                  "5 active jobs",
                  "10 quotes/month",
                  "Basic compliance",
                  "1 country",
                ],
                cta: "Start free",
                highlight: false,
              },
              {
                name: "Pro",
                price: "€39",
                period: "/mo",
                commission: "2%",
                tagline: "Full AI. Pays for itself.",
                features: [
                  "Unlimited jobs, quotes, invoices",
                  "Full EVE AI (Agent + Auditor + Analyst)",
                  "ML predictions + benchmarking",
                  "Purchasing agent",
                  "All 6 EU countries",
                ],
                cta: "Go Pro",
                highlight: true,
                badge: "MOST POPULAR",
              },
              {
                name: "Contractor",
                price: "€69",
                period: "/mo",
                commission: "1%",
                tagline: "Team. API. White-label.",
                features: [
                  "Everything in Pro",
                  "15 team seats",
                  "API + white-label",
                  "Subcontractor portal",
                  "Dedicated support",
                ],
                cta: "Talk to us",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={
                  "relative overflow-hidden rounded-3xl border p-1 " +
                  (plan.highlight
                    ? "border-[#F97316]/40"
                    : "border-white/10")
                }
                style={
                  plan.highlight
                    ? {
                        background:
                          "linear-gradient(135deg, rgba(249,115,22,0.15) 0%, transparent 50%, rgba(249,115,22,0.05) 100%)",
                      }
                    : undefined
                }
              >
                <div className="rounded-[1.4rem] bg-[#14181F] p-8">
                  {plan.badge && (
                    <div
                      className="mb-4 inline-block rounded-md px-2.5 py-1 font-[family-name:var(--font-archivo)] text-[10px] font-black uppercase tracking-[0.2em] text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
                      }}
                    >
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-1 font-[family-name:var(--font-archivo)] text-2xl font-black uppercase tracking-wider text-white">
                    {plan.name}
                  </div>
                  <div className="mb-6 font-[family-name:var(--font-inter)] text-sm text-zinc-500">
                    {plan.tagline}
                  </div>
                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="font-[family-name:var(--font-archivo)] text-5xl font-black text-white">
                      {plan.price}
                    </span>
                    <span className="font-[family-name:var(--font-inter)] text-base font-medium text-zinc-500">
                      {plan.period}
                    </span>
                  </div>
                  <div className="mb-7 flex items-center gap-2 font-[family-name:var(--font-inter)] text-sm">
                    <span
                      className="rounded-md px-2 py-0.5 font-bold"
                      style={{
                        background: "rgba(249,115,22,0.15)",
                        color: "#F97316",
                      }}
                    >
                      + {plan.commission}
                    </span>
                    <span className="text-zinc-500">per paid invoice</span>
                  </div>
                  <ul className="mb-8 space-y-3">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-3 font-[family-name:var(--font-inter)] text-sm text-zinc-300"
                      >
                        <span
                          className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            background: plan.highlight ? "#F97316" : "#27272A",
                            color: "white",
                          }}
                        >
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="mailto:hello@vascobuild.com?subject=Vasco%20waitlist"
                    className={
                      "block w-full rounded-xl px-5 py-3 text-center font-[family-name:var(--font-archivo)] text-sm font-bold uppercase tracking-[0.14em] transition " +
                      (plan.highlight
                        ? "text-white hover:brightness-110"
                        : "border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900/50")
                    }
                    style={
                      plan.highlight
                        ? {
                            background:
                              "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
                            boxShadow: "0 0 24px rgba(249,115,22,0.3)",
                          }
                        : undefined
                    }
                  >
                    {plan.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-12 text-center font-[family-name:var(--font-inter)] text-sm text-zinc-500">
            Cancel anytime. No setup fees. No termination fees.{" "}
            <span className="text-zinc-400">
              You only pay when you get paid.
            </span>
          </p>
        </div>
      </section>

      {/* Trades */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mb-12 max-w-3xl">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              Built for the trades
            </div>
            <h2 className="mb-5 font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              15 trades.{" "}
              <span style={{ color: "#F59E0B" }}>One toolbox.</span>
            </h2>
            <p className="font-[family-name:var(--font-inter)] text-lg text-zinc-400">
              From solo plumbers to multi-trade aannemers — Vasco speaks your
              trade, knows your suppliers, and writes your customer messages in
              your customer&apos;s language.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {TRADES.map((t) => (
              <span
                key={t}
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 font-[family-name:var(--font-inter)] text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-white/5 hover:text-white"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="relative overflow-hidden border-t border-white/5 bg-gradient-to-b from-[#0B0E11] via-[#0E1217] to-[#0B0E11]">
        <div className="mx-auto max-w-5xl px-6 py-28 text-center">
          <div className="mb-8 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
            Built by tradesmen, for tradesmen
          </div>
          <p className="font-[family-name:var(--font-archivo)] text-4xl font-black leading-[1.05] sm:text-5xl md:text-6xl">
            You didn&apos;t become a plumber to learn{" "}
            <span style={{ color: "#F59E0B" }}>VAT codes.</span>
            <br />
            You became a plumber to{" "}
            <span style={{ color: "#F97316" }}>fix things.</span>
          </p>
          <p className="mt-10 font-[family-name:var(--font-inter)] text-xl text-zinc-400">
            Vasco handles the rest.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-white/5 bg-[#0E1217]">
        <div className="mx-auto max-w-4xl px-6 py-28">
          <div className="mb-16 max-w-3xl">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              FAQ
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              Questions.{" "}
              <span style={{ color: "#F59E0B" }}>Straight answers.</span>
            </h2>
          </div>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-white/5 bg-[#161A20] px-6 py-5 transition hover:border-white/15"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-[family-name:var(--font-archivo)] text-lg font-bold text-white">
                  {item.q}
                  <span
                    className="text-2xl font-black transition group-open:rotate-45"
                    style={{ color: "#F97316" }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 font-[family-name:var(--font-inter)] text-base leading-relaxed text-zinc-400">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-white/5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse 900px 500px at 50% 50%, #F97316 0%, transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-6 py-32 text-center">
          <h2 className="mb-6 font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
            Ship one quote today.{" "}
            <span style={{ color: "#F59E0B" }}>Get paid tomorrow.</span>
          </h2>
          <p className="mb-12 font-[family-name:var(--font-inter)] text-lg text-zinc-400 sm:text-xl">
            Get early access. We&apos;ll email you when Vasco launches in your
            market.
          </p>
          <a
            href="mailto:hello@vascobuild.com?subject=Vasco%20waitlist"
            className="inline-flex items-center gap-2 rounded-2xl px-9 py-4 font-[family-name:var(--font-archivo)] text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:brightness-110"
            style={{
              background:
                "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
              boxShadow: "0 0 40px rgba(249,115,22,0.5)",
            }}
          >
            Get early access
            <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0B0E11]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full font-[family-name:var(--font-archivo)] text-sm font-black"
                  style={{
                    background:
                      "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
                  }}
                >
                  V
                </div>
                <span className="font-[family-name:var(--font-archivo)] text-lg font-black uppercase tracking-[0.18em]">
                  Vasco
                </span>
              </div>
              <p className="max-w-sm font-[family-name:var(--font-inter)] text-sm leading-relaxed text-zinc-500">
                Your guide to running a trade business.
              </p>
              <p className="mt-6 font-[family-name:var(--font-inter)] text-xs text-zinc-600">
                © {new Date().getFullYear()} Vasco B.V.
                <br />
                Amsterdam, The Netherlands
              </p>
            </div>

            <FooterCol
              title="Product"
              links={[
                { href: "#how", label: "How it works" },
                { href: "#pricing", label: "Pricing" },
                { href: "#faq", label: "FAQ" },
                { href: "/support", label: "Support" },
              ]}
            />
            <FooterCol
              title="Legal"
              links={[
                { href: "/legal/privacy-policy", label: "Privacy" },
                { href: "/legal/terms-of-service", label: "Terms" },
                { href: "/legal/eula", label: "EULA" },
                { href: "/legal/cookie-policy", label: "Cookies" },
                { href: "/legal/data-processing-agreement", label: "DPA" },
                {
                  href: "/legal/acceptable-use-policy",
                  label: "Acceptable use",
                },
              ]}
            />
            <FooterCol
              title="Contact"
              links={[
                {
                  href: "mailto:hello@vascobuild.com",
                  label: "hello@vascobuild.com",
                },
                {
                  href: "mailto:support@vascobuild.com",
                  label: "support@vascobuild.com",
                },
                {
                  href: "mailto:privacy@vascobuild.com",
                  label: "privacy@vascobuild.com",
                },
              ]}
            />
          </div>

          <div className="mt-16 flex flex-col gap-4 border-t border-white/5 pt-8 font-[family-name:var(--font-inter)] text-xs text-zinc-600 md:flex-row md:items-center md:justify-between">
            <div>EU datacenters · GDPR compliant · KvK 12345678</div>
            <div className="flex gap-x-4">
              <span>NL</span>
              <span>DE</span>
              <span>FR</span>
              <span>ES</span>
              <span>IT</span>
              <span>UK</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
        {title}
      </div>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="font-[family-name:var(--font-inter)] text-sm text-zinc-500 transition hover:text-white"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
