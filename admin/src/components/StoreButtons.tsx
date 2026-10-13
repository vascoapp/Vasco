import { STORES, BETA_MAILTO, anyStoreLive } from "@/lib/stores";
import type { Locale } from "@/lib/marketing-content";

// The stores' own wording for their badges, per locale.
const LABELS: Record<Locale, { ios: string; android: string }> = {
  en: { ios: "Download on the App Store", android: "Get it on Google Play" },
  "en-US": { ios: "Download on the App Store", android: "Get it on Google Play" },
  nl: { ios: "Download in de App Store", android: "Ontdek het op Google Play" },
  de: { ios: "Laden im App Store", android: "Jetzt bei Google Play" },
};

const GRADIENT = "linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)";

/**
 * The install buttons. Live stores get a direct link each; with no store live
 * yet, one button to the beta email (`fallbackLabel`) keeps the old behaviour.
 */
export default function StoreButtons({
  locale,
  fallbackLabel,
  size = "lg",
}: {
  locale: Locale;
  fallbackLabel: string;
  size?: "lg" | "md";
}) {
  const pad = size === "lg" ? "px-7 py-4" : "px-5 py-3";
  const base = `inline-flex items-center justify-center gap-2 rounded-2xl ${pad} font-[family-name:var(--font-archivo)] text-sm font-bold tracking-[0.04em] text-white transition hover:brightness-110`;

  if (!anyStoreLive()) {
    return (
      <a href={BETA_MAILTO} className={base + " uppercase"} style={{ background: GRADIENT }}>
        {fallbackLabel}
        <span aria-hidden>→</span>
      </a>
    );
  }
  const l = LABELS[locale];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {STORES.ios.live && (
        <a href={STORES.ios.url} className={base} style={{ background: GRADIENT }} rel="noopener">
          {l.ios}
        </a>
      )}
      {STORES.android.live && (
        <a
          href={STORES.android.url}
          className={base + " border border-zinc-600 bg-zinc-900/60"}
          rel="noopener"
        >
          {l.android}
        </a>
      )}
    </div>
  );
}
