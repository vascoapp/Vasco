// =============================================================================
// BillingChrome — shared header / footer / trust row for the /billing pages
// =============================================================================
// On-brand web chrome (light surface, brand #E35205, Archivo display) so the
// checkout + portal pages feel like one polished, professional product.
// =============================================================================

import Image from "next/image";

export const BRAND = "#E35205";
export const BRAND_DARK = "#B8410A";
export const NAVY = "#0D1B2A";

export function BillingHeader() {
  return (
    <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-6 py-4">
        <Image
          src="/vasco-logo.png"
          alt="Vasco"
          width={26}
          height={26}
          priority
          className="rounded-md"
        />
        <span className="font-[family-name:var(--font-archivo)] text-sm font-black uppercase tracking-[0.18em] text-zinc-900">
          Vasco
        </span>
        <span className="ml-auto text-xs font-medium text-zinc-400">Secure checkout</span>
      </div>
    </header>
  );
}

export function TrustRow() {
  const items = [
    { icon: "🔒", label: "Secured by Stripe" },
    { icon: "✦", label: "14-day free trial" },
    { icon: "↺", label: "Cancel anytime" },
    { icon: "€", label: "VAT included" },
  ];
  return (
    <div className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <span className="text-zinc-400">{it.icon}</span>
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function BillingFooter() {
  return (
    <footer className="mx-auto max-w-2xl px-6 pb-16 pt-8 text-center">
      <p className="text-xs text-zinc-400">
        Payments processed securely by Stripe · Vasco never sees your card details.
      </p>
      <p className="mt-2 text-xs text-zinc-400">
        <a href="vasco://billing" className="underline underline-offset-2 hover:text-zinc-600">
          Open the Vasco app
        </a>{" "}
        ·{" "}
        <a href="/terms" className="underline underline-offset-2 hover:text-zinc-600">
          Terms
        </a>{" "}
        ·{" "}
        <a href="/privacy" className="underline underline-offset-2 hover:text-zinc-600">
          Privacy
        </a>{" "}
        ·{" "}
        <a href="mailto:support@vascobuild.com" className="underline underline-offset-2 hover:text-zinc-600">
          support@vascobuild.com
        </a>
      </p>
    </footer>
  );
}
