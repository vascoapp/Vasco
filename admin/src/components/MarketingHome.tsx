import { content, MARKETS_EN, MARKETS_US, type Locale } from "@/lib/marketing-content";
import StoreButtons from "@/components/StoreButtons";
import { primaryCtaHref } from "@/lib/stores";

type Props = { locale: Locale };

// Locale-aware route map for the switcher (EN / US / NL / DE).
const LOCALE_ROUTES: Record<Locale, string> = {
  en: "/",
  nl: "/nl",
  de: "/de",
  "en-US": "/us",
};

// Which store capture set a page uses (fastlane/screenshots, converted to WebP).
const SHOT_CODE: Record<Locale, string> = { en: "en", nl: "nl", de: "de", "en-US": "us" };

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  nl: "NL",
  de: "DE",
  "en-US": "US",
};

export default function MarketingHome({ locale }: Props) {
  const t = content[locale];
  const shot = (key: string) => `/screenshots/app-${SHOT_CODE[locale]}-${key}.webp`;
  const homeHref = LOCALE_ROUTES[locale];
  // R77: US locale shows US states in the "Working in" strip; others EU6.
  const markets = locale === "en-US" ? MARKETS_US : MARKETS_EN;
  // 3-way switcher: ordered list of locales other than current, for nav.
  const otherLocales: Locale[] = (["en", "en-US", "nl", "de"] as Locale[]).filter(
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
            {/* R92: official VascoBuild logo with hard-hat tradesperson mark.
                Replaces the inline gradient V-mark + wordmark from R66r72. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/vasco-logo.png"
              alt="VascoBuild"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg"
              style={{ boxShadow: "0 0 24px rgba(249,115,22,0.4)" }}
            />
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
              href={primaryCtaHref()}
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

            {/* Locale switcher (EN / US / NL / DE) */}
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
              href={primaryCtaHref()}
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

      {/* HERO — the product, not a slogan: real iPad + iPhone captures. */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-16 sm:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-[family-name:var(--font-inter)] text-xs font-medium text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />
                {t.hero.badge}
              </div>

              <h1 className="mb-6 font-[family-name:var(--font-archivo)] text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                {t.hero.title}
                <br />
                <span className="text-zinc-400">{t.hero.titleAccent}</span>
              </h1>

              <p className="mb-9 max-w-xl font-[family-name:var(--font-inter)] text-lg leading-relaxed text-zinc-400">
                {t.hero.sub}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <div id="download">
                  <StoreButtons locale={locale} fallbackLabel={t.hero.ctaPrimary} />
                </div>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-7 py-4 font-[family-name:var(--font-inter)] text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/50"
                >
                  {t.hero.ctaSecondary}
                </a>
              </div>
            </div>

            {/* iPad behind, iPhone in front — the same Today screen on both. */}
            <div className="relative mx-auto w-full max-w-[420px] sm:max-w-[540px]" style={{ aspectRatio: "1 / 1.1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot("ipad-today")}
                alt=""
                width={700}
                height={933}
                className="absolute right-0 top-0 w-[78%] rounded-[1.6rem] border border-white/10"
                style={{ boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot("today")}
                alt={t.hero.title + " " + t.hero.titleAccent}
                width={430}
                height={934}
                fetchPriority="high"
                className="absolute bottom-0 left-0 w-[40%] rounded-[1.8rem] border border-white/15"
                style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.85)" }}
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
                  style={{ color: "#FFFFFF" }}
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

      {/* HOW IT WORKS — one row per screen, alternating sides. */}
      <section id="how" className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="mb-20 max-w-3xl font-[family-name:var(--font-archivo)] text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {t.features.titleLead}{" "}
            <span className="text-zinc-400">{t.features.titleAccent}</span>
          </h2>

          <div className="space-y-24 sm:space-y-32">
            {t.features.items.map((f, i) => (
              <div
                key={f.screen}
                className="grid items-center gap-10 md:grid-cols-2 md:gap-16"
              >
                <div className={i % 2 === 1 ? "md:order-2" : ""}>
                  <div className="mb-3 font-[family-name:var(--font-inter)] text-sm font-semibold text-[#F97316]">
                    {f.label}
                  </div>
                  <h3 className="mb-4 font-[family-name:var(--font-archivo)] text-3xl font-extrabold leading-tight sm:text-4xl">
                    {f.title}
                  </h3>
                  <p className="max-w-md font-[family-name:var(--font-inter)] text-lg leading-relaxed text-zinc-400">
                    {f.body}
                  </p>
                </div>
                <div className={"flex justify-center " + (i % 2 === 1 ? "md:order-1" : "")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot(f.screen)}
                    alt={f.title}
                    width={430}
                    height={934}
                    loading="lazy"
                    className="w-[240px] rounded-[1.8rem] border border-white/10 sm:w-[280px]"
                    style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-20 font-[family-name:var(--font-inter)] text-xs text-zinc-500">
            {t.features.footnote}
          </p>
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
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              {t.pricing.titleLead}{" "}
              <span className="text-zinc-400">{t.pricing.titleAccent}</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {t.pricing.plans.map((plan, planIndex) => (
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
                  {/* The annual price, not a commission: Vasco takes no cut of
                      payments (the per-invoice take rate was cancelled). */}
                  <div className="mb-7 min-h-[1.25rem] font-[family-name:var(--font-inter)] text-sm text-zinc-500">
                    {plan.annual ?? ""}
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
                    href={planIndex === 2 ? "mailto:hello@vascobuild.com?subject=Vasco%20Contractor" : primaryCtaHref()}
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

          <p className="mt-12 text-center font-[family-name:var(--font-inter)] text-sm text-zinc-400">
            {t.pricing.noCommission}
          </p>
          <p className="mt-3 text-center font-[family-name:var(--font-inter)] text-sm text-zinc-500">
            {t.pricing.closer}{" "}
            <span className="text-zinc-400">{t.pricing.closerAccent}</span>
          </p>
        </div>
      </section>

      {/* Trades */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mb-12 max-w-3xl">
            <h2 className="mb-5 font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              {t.trades.titleLead}{" "}
              <span className="text-zinc-400">{t.trades.titleAccent}</span>
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
            <span className="text-zinc-400">{t.manifesto.line1Accent}</span>
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
            <h2 className="font-[family-name:var(--font-archivo)] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              {t.faq.titleLead}{" "}
              <span className="text-zinc-400">{t.faq.titleAccent}</span>
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
            <span className="text-zinc-400">{t.finalCta.titleAccent}</span>
          </h2>
          <p className="mb-12 font-[family-name:var(--font-inter)] text-lg text-zinc-400 sm:text-xl">
            {t.finalCta.body}
          </p>
          <div className="flex justify-center">
            <StoreButtons locale={locale} fallbackLabel={t.finalCta.cta} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0B0E11]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="mb-4">
                {/* R92: official VascoBuild logo with hard-hat tradesperson */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/vasco-logo.png"
                  alt="VascoBuild"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-lg"
                />
              </div>
              <p className="max-w-sm font-[family-name:var(--font-inter)] text-sm leading-relaxed text-zinc-500">
                {t.footer.tagline}
              </p>
              <p className="mt-6 font-[family-name:var(--font-inter)] text-xs text-zinc-600">
                © {new Date().getFullYear()} 3511 (Vasco Build) · KvK 99596326
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
