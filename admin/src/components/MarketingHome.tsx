import { content, MARKETS_EN, MARKETS_US, type Locale } from "@/lib/marketing-content";

type Props = { locale: Locale };

// R77 US Phase 3: locale-aware route map. 3-way switcher EN / NL / US.
const LOCALE_ROUTES: Record<Locale, string> = {
  en: "/",
  nl: "/nl",
  "en-US": "/us",
};

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  nl: "NL",
  "en-US": "US",
};

export default function MarketingHome({ locale }: Props) {
  const t = content[locale];
  const homeHref = LOCALE_ROUTES[locale];
  // R77: US locale shows US states in the "Working in" strip; others EU6.
  const markets = locale === "en-US" ? MARKETS_US : MARKETS_EN;
  // 3-way switcher: ordered list of locales other than current, for nav.
  const otherLocales: Locale[] = (["en", "en-US", "nl"] as Locale[]).filter(
    (l) => l !== locale,
  );

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
          <a href={homeHref} className="flex items-center gap-3">
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

          {/* Mobile: locale toggle + waitlist CTA */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.02] p-0.5 text-[10px] font-bold uppercase tracking-[0.18em]">
              <a
                href={homeHref}
                className="rounded-md px-2 py-1"
                style={{
                  background:
                    "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
                  color: "white",
                }}
              >
                {LOCALE_LABELS[locale]}
              </a>
              {otherLocales.map((l) => (
                <a
                  key={l}
                  href={LOCALE_ROUTES[l]}
                  className="rounded-md px-2 py-1 text-zinc-400 transition hover:text-white"
                >
                  {LOCALE_LABELS[l]}
                </a>
              ))}
            </div>
            <a
              href="mailto:hello@vascobuild.com?subject=Vasco%20waitlist"
              className="rounded-lg bg-white px-3 py-1.5 font-[family-name:var(--font-inter)] text-xs font-semibold text-[#0B0E11]"
            >
              {t.nav.cta}
            </a>
          </div>

          <nav className="hidden items-center gap-8 font-[family-name:var(--font-inter)] text-sm font-medium text-zinc-400 md:flex">
            <a href="#how" className="transition hover:text-white">
              {t.nav.how}
            </a>
            <a href="#pricing" className="transition hover:text-white">
              {t.nav.pricing}
            </a>
            <a href="#faq" className="transition hover:text-white">
              {t.nav.faq}
            </a>
            <a href="/support" className="transition hover:text-white">
              {t.nav.support}
            </a>

            {/* Locale switcher (3-way EN / US / NL) */}
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-0.5 text-xs font-bold uppercase tracking-[0.18em]">
              <a
                href={homeHref}
                className="rounded-md px-2 py-1"
                style={{
                  background:
                    "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)",
                  color: "white",
                }}
              >
                {LOCALE_LABELS[locale]}
              </a>
              {otherLocales.map((l) => (
                <a
                  key={l}
                  href={LOCALE_ROUTES[l]}
                  className="rounded-md px-2 py-1 text-zinc-400 transition hover:text-white"
                >
                  {LOCALE_LABELS[l]}
                </a>
              ))}
            </div>

            <a
              href="mailto:hello@vascobuild.com?subject=Vasco%20waitlist"
              className="rounded-xl bg-white px-4 py-2 font-[family-name:var(--font-inter)] text-sm font-semibold text-[#0B0E11] transition hover:bg-zinc-200"
            >
              {t.nav.cta}
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

        <div className="mx-auto max-w-7xl px-6 pb-32 pt-20 sm:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#F97316]/30 bg-[#F97316]/5 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F97316] shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                <span className="font-[family-name:var(--font-inter)] text-xs font-semibold uppercase tracking-[0.18em] text-[#F97316]">
                  {t.hero.badge}
                </span>
              </div>

              <h1 className="mb-8 font-[family-name:var(--font-archivo)] text-6xl font-black leading-[0.92] tracking-tight sm:text-7xl md:text-8xl">
                {t.hero.title}{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #C2410C 0%, #F97316 50%, #F59E0B 100%)",
                  }}
                >
                  {t.hero.titleAccent}
                </span>
              </h1>

              <p className="mb-10 max-w-xl font-[family-name:var(--font-inter)] text-lg leading-relaxed text-zinc-400 sm:text-xl">
                {t.hero.sub}
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
                  {t.hero.ctaPrimary}
                  <span aria-hidden>→</span>
                </a>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-7 py-4 font-[family-name:var(--font-inter)] text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/50"
                >
                  {t.hero.ctaSecondary}
                </a>
              </div>
            </div>

            {/* Hero phone — actual rendered App Store screenshot, responsive */}
            <div className="relative flex justify-center lg:justify-end">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-16 -z-10 blur-3xl"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(249,115,22,0.45) 0%, rgba(245,158,11,0.18) 40%, transparent 80%)",
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.appStorePreview.screens[0].src}
                alt={t.appStorePreview.screens[0].label}
                width={380}
                height={826}
                className="relative w-[260px] rounded-[2rem] sm:w-[320px] lg:w-[380px] lg:rounded-[2.5rem]"
                style={{
                  border: "2px solid rgba(249,115,22,0.6)",
                  boxShadow:
                    "0 50px 120px rgba(0,0,0,0.8), 0 0 100px rgba(249,115,22,0.4), 0 0 0 1px rgba(255,255,255,0.06) inset",
                }}
              />
            </div>
          </div>

          {/* Markets row */}
          <div className="mt-24 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/5 pt-10 font-[family-name:var(--font-inter)] text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span>{t.hero.marketsPrefix}</span>
            {markets.map((m) => (
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
            {t.stats.map((s, i) => (
              <div
                key={s.label}
                className={
                  "px-2 " +
                  (i < t.stats.length - 1 ? "md:border-r md:border-white/5" : "")
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

      {/* App Store screenshots preview */}
      <section
        id="app-store-preview"
        className="relative overflow-hidden border-t border-white/10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(249,115,22,0.18) 0%, rgba(154,52,18,0.08) 35%, #0B0E11 75%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px]"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(245,158,11,0.22) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.4) 50%, transparent 100%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 py-32">
          <div className="mb-16 max-w-3xl">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              {t.appStorePreview.eyebrow}
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl">
              {t.appStorePreview.titleLead}{" "}
              <span style={{ color: "#F59E0B" }}>
                {t.appStorePreview.titleAccent}
              </span>
            </h2>
          </div>

          <div className="-mx-6 overflow-x-auto px-6">
            <div
              className="flex gap-10 pb-10 pt-4"
              style={{ width: "max-content" }}
            >
              {t.appStorePreview.screens.map((s) => (
                <div
                  key={s.src}
                  className="relative flex flex-col items-center gap-4"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-12 -z-10 blur-3xl"
                    style={{
                      background:
                        "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(249,115,22,0.35) 0%, rgba(245,158,11,0.15) 40%, transparent 80%)",
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.src}
                    alt={s.label}
                    width={340}
                    height={739}
                    className="relative rounded-[2.5rem]"
                    style={{
                      border: "1.5px solid rgba(249,115,22,0.55)",
                      boxShadow:
                        "0 40px 90px rgba(0,0,0,0.75), 0 0 80px rgba(249,115,22,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset",
                    }}
                  />
                  <div
                    className="rounded-full border border-[#F97316]/40 px-3 py-1 font-[family-name:var(--font-archivo)] text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      background: "rgba(249,115,22,0.12)",
                      color: "#F97316",
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 font-[family-name:var(--font-inter)] text-xs text-zinc-400">
            {t.appStorePreview.footnote}
          </div>
        </div>
      </section>

      {/* Guide-through */}
      <section id="guide" className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mb-20 max-w-3xl">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              {t.guideThrough.eyebrow}
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              {t.guideThrough.titleLead}{" "}
              <span style={{ color: "#F59E0B" }}>
                {t.guideThrough.titleAccent}
              </span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {t.guideThrough.items.map((g) => (
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
              {t.how.eyebrow}
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              {t.how.titleLead}{" "}
              <span style={{ color: "#F59E0B" }}>{t.how.titleAccent}</span>
            </h2>
          </div>

          <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            <div
              aria-hidden
              className="absolute left-8 right-8 top-8 -z-10 hidden h-px md:block"
              style={{
                background:
                  "linear-gradient(90deg, #F97316 0%, transparent 50%, #F97316 100%)",
                opacity: 0.3,
              }}
            />
            {t.how.steps.map((step) => (
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

      {/* PRICING */}
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
              {t.pricing.eyebrow}
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              {t.pricing.titleLead}{" "}
              <span style={{ color: "#F59E0B" }}>{t.pricing.titleAccent}</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {t.pricing.plans.map((plan) => (
              <div
                key={plan.name}
                className={
                  "relative overflow-hidden rounded-3xl border p-1 " +
                  (plan.highlight ? "border-[#F97316]/40" : "border-white/10")
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
                    <span className="text-zinc-500">{t.pricing.perInvoice}</span>
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
            {t.pricing.closer}{" "}
            <span className="text-zinc-400">{t.pricing.closerAccent}</span>
          </p>
        </div>
      </section>

      {/* Trades */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mb-12 max-w-3xl">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              {t.trades.eyebrow}
            </div>
            <h2 className="mb-5 font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              {t.trades.titleLead}{" "}
              <span style={{ color: "#F59E0B" }}>{t.trades.titleAccent}</span>
            </h2>
            <p className="font-[family-name:var(--font-inter)] text-lg text-zinc-400">
              {t.trades.body}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {t.trades.list.map((tr) => (
              <span
                key={tr}
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 font-[family-name:var(--font-inter)] text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-white/5 hover:text-white"
              >
                {tr}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="relative overflow-hidden border-t border-white/5 bg-gradient-to-b from-[#0B0E11] via-[#0E1217] to-[#0B0E11]">
        <div className="mx-auto max-w-5xl px-6 py-28 text-center">
          <div className="mb-8 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
            {t.manifesto.eyebrow}
          </div>
          <p className="font-[family-name:var(--font-archivo)] text-4xl font-black leading-[1.05] sm:text-5xl md:text-6xl">
            {t.manifesto.line1}{" "}
            <span style={{ color: "#F59E0B" }}>{t.manifesto.line1Accent}</span>
            <br />
            {t.manifesto.line2}{" "}
            <span style={{ color: "#F97316" }}>{t.manifesto.line2Accent}</span>
          </p>
          <p className="mt-10 font-[family-name:var(--font-inter)] text-xl text-zinc-400">
            {t.manifesto.closer}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-white/5 bg-[#0E1217]">
        <div className="mx-auto max-w-4xl px-6 py-28">
          <div className="mb-16 max-w-3xl">
            <div className="mb-4 font-[family-name:var(--font-archivo)] text-xs font-bold uppercase tracking-[0.24em] text-[#F97316]">
              {t.faq.eyebrow}
            </div>
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              {t.faq.titleLead}{" "}
              <span style={{ color: "#F59E0B" }}>{t.faq.titleAccent}</span>
            </h2>
          </div>
          <div className="space-y-2">
            {t.faq.items.map((item, i) => (
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
            {t.finalCta.titleLead}{" "}
            <span style={{ color: "#F59E0B" }}>{t.finalCta.titleAccent}</span>
          </h2>
          <p className="mb-12 font-[family-name:var(--font-inter)] text-lg text-zinc-400 sm:text-xl">
            {t.finalCta.body}
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
            {t.finalCta.cta}
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
                {t.footer.tagline}
              </p>
              <p className="mt-6 font-[family-name:var(--font-inter)] text-xs text-zinc-600">
                © {new Date().getFullYear()} Vasco B.V.
                <br />
                {t.footer.address}
              </p>
            </div>

            <FooterCol title={t.footer.product.title} links={t.footer.product.links} />
            <FooterCol title={t.footer.legal.title} links={t.footer.legal.links} />
            <FooterCol title={t.footer.contact.title} links={t.footer.contact.links} />
          </div>

          <div className="mt-16 flex flex-col gap-4 border-t border-white/5 pt-8 font-[family-name:var(--font-inter)] text-xs text-zinc-600 md:flex-row md:items-center md:justify-between">
            <div>{t.footer.bottomCompliance}</div>
            <div className="flex gap-x-4">
              {markets.map((m) => (
                <span key={m.code}>{m.code}</span>
              ))}
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
