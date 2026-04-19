"use client";

import { useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN LAB — pilot sandbox for DraftKings-inspired theme.
// Pure preview; does not touch mobile codebase or CLAUDE.md LOCKED system.
// ═══════════════════════════════════════════════════════════════════════════

type Palette = {
  id: string;
  name: string;
  blurb: string;
  bg: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  textMuted: string;
  primaryDark: string;
  primary: string;
  accent: string;
  highlight: string;
  success: string;
  danger: string;
};

const PALETTES: Palette[] = [
  {
    id: "sunset-slate",
    name: "Sunset Slate",
    blurb: "Near-black slate, burnt → sunset → amber orange ramp. Closest to DraftKings mood with orange in place of green.",
    bg: "#0B0E11",
    panel: "#14181F",
    panel2: "#1C2128",
    border: "#2A3038",
    text: "#FFFFFF",
    textMuted: "#9CA3AF",
    primaryDark: "#9A3412",
    primary: "#C2410C",
    accent: "#F97316",
    highlight: "#F59E0B",
    success: "#10B981",
    danger: "#EF4444",
  },
  {
    id: "ember-steel",
    name: "Ember Steel",
    blurb: "Cooler steel base, amber/gold highlights. More refined, less aggressive. Good if you want premium > sporty.",
    bg: "#0F1419",
    panel: "#1A1F26",
    panel2: "#242A33",
    border: "#313842",
    text: "#FFFFFF",
    textMuted: "#8B94A3",
    primaryDark: "#B45309",
    primary: "#D97706",
    accent: "#FBBF24",
    highlight: "#FCD34D",
    success: "#22C55E",
    danger: "#F43F5E",
  },
];

type FontOption = { id: string; name: string; family: string; weights?: string; blurb: string };

const DISPLAY_FONTS: FontOption[] = [
  { id: "archivo", name: "Archivo", family: "Archivo", weights: "wght@600;700;800;900", blurb: "Geometric, bold, modern. Neutral masculine." },
  { id: "barlow", name: "Barlow Condensed", family: "Barlow Condensed", weights: "wght@600;700;800;900", blurb: "Narrow, sporty — closest match to DraftKings numerics." },
  { id: "oswald", name: "Oswald", family: "Oswald", weights: "wght@600;700", blurb: "Classic condensed display. Sharp, editorial." },
  // Bebas Neue has no wght axis on Google Fonts — single weight only.
  { id: "bebas", name: "Bebas Neue", family: "Bebas Neue", blurb: "All-caps stadium energy. Use only for headlines." },
];

const BODY_FONTS: FontOption[] = [
  { id: "inter", name: "Inter", family: "Inter", weights: "wght@400;500;600;700", blurb: "Neutral UI standard." },
  { id: "manrope", name: "Manrope", family: "Manrope", weights: "wght@400;500;600;700;800", blurb: "Rounder, current Vasco body." },
];

const ALL_FONTS: FontOption[] = [...DISPLAY_FONTS, ...BODY_FONTS];

type RadiusOption = { id: string; name: string; btn: number; card: number; chip: number; blurb: string };

const RADII: RadiusOption[] = [
  { id: "razor", name: "Razor", btn: 2, card: 4, chip: 2, blurb: "Sharpest. Brutalist, terminal-like." },
  { id: "tight", name: "Tight", btn: 6, card: 8, chip: 4, blurb: "DraftKings default. Sporty, industrial." },
  { id: "soft", name: "Soft", btn: 10, card: 14, chip: 999, blurb: "Closer to current Vasco. More consumer-friendly." },
];

// Shimmer/gradient toggle mirrors DraftKings CTA treatment
const GRADIENT_OPTIONS = [
  { id: "flat", name: "Flat", blurb: "Solid fills only. Cleanest." },
  { id: "gradient", name: "Gradient CTA", blurb: "Primary buttons fade dark-orange → sunset." },
  { id: "glow", name: "Gradient + Glow", blurb: "Gradient + soft amber shadow on primary CTAs and hero stats." },
];

// ─── Google Fonts loader (client-side only, scoped to Design Lab) ─────────
// Single effect preloads every candidate font so users can hot-swap without flashes.
function useAllGoogleFonts(fonts: FontOption[]) {
  useEffect(() => {
    for (const f of fonts) {
      const id = `gfont-${f.family.replace(/\s+/g, "-")}`;
      if (document.getElementById(id)) continue;
      // Google Fonts expects `+` for spaces (not `%20`). Weights axis is optional —
      // single-weight fonts (e.g. Bebas Neue) return 400 if a wght axis is supplied.
      const familyParam = f.family.replace(/\s+/g, "+");
      const href = f.weights
        ? `https://fonts.googleapis.com/css2?family=${familyParam}:${f.weights}&display=swap`
        : `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }, [fonts]);
}

// ─── Main component ──────────────────────────────────────────────────────
export function AdminDesignLab() {
  // Palette locked to Sunset Slate — user decision. Keep constant export so tokens JSON
  // carries the right id; unlock later if we want to re-open the choice.
  const palette = PALETTES[0];
  const [displayFontId, setDisplayFontId] = useState("barlow");
  const [bodyFontId, setBodyFontId] = useState("inter");
  const [radiusId, setRadiusId] = useState("tight");
  const [gradientMode, setGradientMode] = useState("glow");

  const displayFont = useMemo(() => DISPLAY_FONTS.find((f) => f.id === displayFontId)!, [displayFontId]);
  const bodyFont = useMemo(() => BODY_FONTS.find((f) => f.id === bodyFontId)!, [bodyFontId]);
  const radius = useMemo(() => RADII.find((r) => r.id === radiusId)!, [radiusId]);

  useAllGoogleFonts(ALL_FONTS);

  const exportTokens = () => {
    const tokens = {
      palette: palette.id,
      colors: {
        bg: palette.bg,
        panel: palette.panel,
        panel2: palette.panel2,
        border: palette.border,
        text: palette.text,
        textMuted: palette.textMuted,
        primaryDark: palette.primaryDark,
        primary: palette.primary,
        accent: palette.accent,
        highlight: palette.highlight,
        success: palette.success,
        danger: palette.danger,
      },
      typography: {
        display: displayFont.family,
        body: bodyFont.family,
      },
      radius: { button: radius.btn, card: radius.card, chip: radius.chip },
      effects: { gradientMode },
    };
    navigator.clipboard.writeText(JSON.stringify(tokens, null, 2));
    alert("Design tokens copied to clipboard — ready to paste into a spec doc.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Design Lab</h1>
          <p className="text-sm text-gray-500">
            Palette locked to <span className="font-semibold text-gray-900">Sunset Slate</span>. Tune font, radius, and effects — preview updates live.
          </p>
        </div>
        <button
          onClick={exportTokens}
          className="rounded-md bg-[#0D1B2A] px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
        >
          Copy tokens JSON
        </button>
      </div>

      {/* Controls + Preview layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Controls */}
        <div className="space-y-5">
          <ControlBlock title="Palette (locked)">
            <PaletteCard p={palette} active onClick={() => {}} />
          </ControlBlock>

          <ControlBlock title="Display font (headlines, numerics)">
            {DISPLAY_FONTS.map((f) => (
              <OptionRow
                key={f.id}
                active={displayFontId === f.id}
                onClick={() => setDisplayFontId(f.id)}
                title={f.name}
                subtitle={f.blurb}
                sample={<span style={{ fontFamily: `'${f.family}', sans-serif`, fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>€12,480</span>}
              />
            ))}
          </ControlBlock>

          <ControlBlock title="Body font">
            {BODY_FONTS.map((f) => (
              <OptionRow
                key={f.id}
                active={bodyFontId === f.id}
                onClick={() => setBodyFontId(f.id)}
                title={f.name}
                subtitle={f.blurb}
                sample={<span style={{ fontFamily: `'${f.family}', sans-serif`, fontWeight: 500, fontSize: 13 }}>Quote sent 2h ago</span>}
              />
            ))}
          </ControlBlock>

          <ControlBlock title="Corner radius">
            {RADII.map((r) => (
              <OptionRow
                key={r.id}
                active={radiusId === r.id}
                onClick={() => setRadiusId(r.id)}
                title={r.name}
                subtitle={r.blurb}
                sample={
                  <div className="flex items-center gap-1">
                    <div style={{ width: 28, height: 18, borderRadius: r.btn, background: "#C2410C" }} />
                    <div style={{ width: 36, height: 22, borderRadius: r.card, background: "#1C2128" }} />
                  </div>
                }
              />
            ))}
          </ControlBlock>

          <ControlBlock title="Effects">
            {GRADIENT_OPTIONS.map((g) => (
              <OptionRow
                key={g.id}
                active={gradientMode === g.id}
                onClick={() => setGradientMode(g.id)}
                title={g.name}
                subtitle={g.blurb}
                sample={null}
              />
            ))}
          </ControlBlock>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <PreviewFrame
            palette={palette}
            displayFont={displayFont}
            bodyFont={bodyFont}
            radius={radius}
            gradientMode={gradientMode}
            label={`${palette.name} · ${displayFont.name} / ${bodyFont.name} · radius ${radius.name} · ${gradientMode}`}
          />

          <TokenTable palette={palette} displayFont={displayFont} bodyFont={bodyFont} radius={radius} gradientMode={gradientMode} />
        </div>
      </div>
    </div>
  );
}

// ─── Control primitives ──────────────────────────────────────────────────
function ControlBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function PaletteCard({ p, active, onClick }: { p: Palette; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md border p-2.5 text-left transition ${active ? "border-[#0D1B2A] ring-2 ring-[#0D1B2A]/10" : "border-gray-200 hover:border-gray-300"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-900">{p.name}</span>
        <div className="flex gap-1">
          {[p.bg, p.panel, p.primary, p.accent, p.highlight].map((c) => (
            <div key={c} style={{ background: c }} className="h-4 w-4 rounded border border-gray-200" />
          ))}
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-tight text-gray-500">{p.blurb}</p>
    </button>
  );
}

function OptionRow({ active, onClick, title, subtitle, sample }: { active: boolean; onClick: () => void; title: string; subtitle: string; sample: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-md border p-2 text-left transition ${active ? "border-[#0D1B2A] bg-[#0D1B2A]/5" : "border-gray-200 hover:border-gray-300"}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-900">{title}</p>
        <p className="text-[11px] leading-tight text-gray-500 truncate">{subtitle}</p>
      </div>
      {sample && <div className="flex-shrink-0">{sample}</div>}
    </button>
  );
}

// ─── Preview frame: mock mobile screen ────────────────────────────────────
function PreviewFrame({
  palette,
  displayFont,
  bodyFont,
  radius,
  gradientMode,
  label,
}: {
  palette: Palette;
  displayFont: FontOption;
  bodyFont: FontOption;
  radius: RadiusOption;
  gradientMode: string;
  label: string;
}) {
  const display = `'${displayFont.family}', system-ui, sans-serif`;
  const body = `'${bodyFont.family}', system-ui, sans-serif`;

  const ctaBg =
    gradientMode === "flat"
      ? palette.primary
      : `linear-gradient(135deg, ${palette.primaryDark} 0%, ${palette.primary} 55%, ${palette.accent} 100%)`;
  const ctaShadow = gradientMode === "glow" ? `0 8px 24px -6px ${palette.accent}80, 0 0 0 1px ${palette.accent}30 inset` : "none";
  const heroShadow = gradientMode === "glow" ? `0 0 48px -12px ${palette.highlight}40` : "none";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-900">{label}</p>
        <p className="text-[10px] uppercase tracking-widest text-gray-400">Mobile preview · 390px</p>
      </div>

      <div
        className="mx-auto overflow-hidden"
        style={{
          width: 390,
          maxWidth: "100%",
          background: palette.bg,
          color: palette.text,
          fontFamily: body,
          borderRadius: radius.card + 8,
          border: `1px solid ${palette.border}`,
        }}
      >
        {/* Status bar faux */}
        <div style={{ padding: "10px 20px 0", display: "flex", justifyContent: "space-between", fontSize: 12, color: palette.textMuted, fontFamily: body, fontWeight: 600 }}>
          <span>9:41</span>
          <span>●●●●● 5G</span>
        </div>

        {/* Header */}
        <div style={{ padding: "20px 20px 12px" }}>
          <p style={{ fontFamily: body, fontSize: 12, color: palette.textMuted, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2 }}>Vandaag · Vrijdag</p>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 32, letterSpacing: -1, margin: "4px 0 0", lineHeight: 1 }}>Goeiemorgen, Jan.</h2>
        </div>

        {/* Hero VascoCard */}
        <div style={{ padding: "0 20px 16px" }}>
          <div
            style={{
              background: palette.panel,
              border: `1px solid ${palette.border}`,
              borderRadius: radius.card,
              padding: 18,
              position: "relative",
              overflow: "hidden",
              boxShadow: heroShadow,
            }}
          >
            {/* Corner tag */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: radius.chip, background: `${palette.highlight}22`, border: `1px solid ${palette.highlight}55`, marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: palette.highlight }} />
              <span style={{ fontFamily: body, fontSize: 10, fontWeight: 700, color: palette.highlight, textTransform: "uppercase", letterSpacing: 1.5 }}>EVE Analyst</span>
            </div>

            <h3 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, letterSpacing: -0.4, margin: 0, lineHeight: 1.15 }}>
              Quote <span style={{ color: palette.accent }}>De Vries</span> slaat morgen vast, stuur nu.
            </h3>
            <p style={{ fontFamily: body, fontSize: 13, color: palette.textMuted, margin: "8px 0 14px", lineHeight: 1.45 }}>
              Win-kans +34% als je binnen 3u reageert. Prijs +8% boven markt — nog steeds in P50 band.
            </p>

            <button
              style={{
                background: ctaBg,
                color: "#FFFFFF",
                fontFamily: display,
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                padding: "12px 18px",
                border: "none",
                borderRadius: radius.btn,
                width: "100%",
                cursor: "pointer",
                boxShadow: ctaShadow,
              }}
            >
              Verstuur quote — €4.820
            </button>
          </div>
        </div>

        {/* Stat row — DraftKings-style numerics */}
        <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Jobs vandaag", value: "4", tone: palette.text },
            { label: "Omzet deze wk", value: "€12.4K", tone: palette.accent },
            { label: "Uren bespaard", value: "+6.2", tone: palette.highlight },
          ].map((s) => (
            <div
              key={s.label}
              style={{ background: palette.panel2, border: `1px solid ${palette.border}`, borderRadius: radius.card, padding: 12 }}
            >
              <p style={{ fontFamily: body, fontSize: 10, color: palette.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.3, margin: 0 }}>{s.label}</p>
              <p style={{ fontFamily: display, fontWeight: 900, fontSize: 22, letterSpacing: -0.5, margin: "4px 0 0", color: s.tone, lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div style={{ padding: "4px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ fontFamily: display, fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", margin: 0, color: palette.text }}>Planning</h4>
          <span style={{ fontFamily: body, fontSize: 12, color: palette.accent, fontWeight: 600 }}>Alles →</span>
        </div>

        {/* Job list */}
        <div style={{ padding: "0 20px 20px" }}>
          {[
            { time: "09:00", title: "CV ketel vervangen", customer: "Bakker, Utrecht", status: "actief", statusColor: palette.success },
            { time: "11:30", title: "Lekkage keuken", customer: "De Vries, Zeist", status: "quote", statusColor: palette.highlight },
            { time: "14:00", title: "Radiator ontluchten", customer: "Jansen, Amersfoort", status: "gepland", statusColor: palette.textMuted },
          ].map((j, i) => (
            <div
              key={i}
              style={{
                background: palette.panel,
                border: `1px solid ${palette.border}`,
                borderRadius: radius.card,
                padding: 12,
                marginBottom: 8,
                display: "grid",
                gridTemplateColumns: "48px 1fr auto",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 16, color: palette.accent, letterSpacing: -0.5 }}>{j.time}</div>
              <div>
                <p style={{ fontFamily: display, fontWeight: 700, fontSize: 14, margin: 0, color: palette.text }}>{j.title}</p>
                <p style={{ fontFamily: body, fontSize: 12, color: palette.textMuted, margin: "2px 0 0" }}>{j.customer}</p>
              </div>
              <span
                style={{
                  fontFamily: body,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.3,
                  color: j.statusColor,
                  background: `${j.statusColor}1A`,
                  border: `1px solid ${j.statusColor}55`,
                  padding: "4px 8px",
                  borderRadius: radius.chip,
                }}
              >
                {j.status}
              </span>
            </div>
          ))}
        </div>

        {/* Button variants */}
        <div style={{ padding: "0 20px 16px" }}>
          <p style={{ fontFamily: body, fontSize: 10, color: palette.textMuted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>Button variants</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              style={{
                background: ctaBg,
                color: "#FFFFFF",
                fontFamily: display,
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                padding: "12px 16px",
                border: "none",
                borderRadius: radius.btn,
                boxShadow: ctaShadow,
              }}
            >
              Primary — send invoice
            </button>
            <button
              style={{
                background: "transparent",
                color: palette.accent,
                fontFamily: display,
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                padding: "11px 16px",
                border: `1.5px solid ${palette.accent}`,
                borderRadius: radius.btn,
              }}
            >
              Secondary — preview PDF
            </button>
            <button
              style={{
                background: palette.panel2,
                color: palette.text,
                fontFamily: display,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 0.4,
                padding: "11px 16px",
                border: `1px solid ${palette.border}`,
                borderRadius: radius.btn,
              }}
            >
              Tertiary — save draft
            </button>
          </div>
        </div>

        {/* Bottom tab bar faux */}
        <div style={{ background: palette.panel, borderTop: `1px solid ${palette.border}`, padding: "10px 12px 18px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
          {["Vandaag", "Werk", "Geld", "Klanten", "Compliance"].map((t, i) => {
            const active = i === 0;
            return (
              <div key={t} style={{ textAlign: "center" }}>
                <div style={{ width: 20, height: 20, margin: "0 auto 4px", borderRadius: 4, background: active ? palette.accent : palette.textMuted, opacity: active ? 1 : 0.5 }} />
                <span style={{ fontFamily: body, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: active ? palette.accent : palette.textMuted }}>{t}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Token table (export preview) ────────────────────────────────────────
function TokenTable({ palette, displayFont, bodyFont, radius, gradientMode }: { palette: Palette; displayFont: FontOption; bodyFont: FontOption; radius: RadiusOption; gradientMode: string }) {
  const rows: [string, string][] = [
    ["colors.bg", palette.bg],
    ["colors.panel", palette.panel],
    ["colors.panel2", palette.panel2],
    ["colors.border", palette.border],
    ["colors.text", palette.text],
    ["colors.textMuted", palette.textMuted],
    ["colors.primaryDark", palette.primaryDark],
    ["colors.primary", palette.primary],
    ["colors.accent", palette.accent],
    ["colors.highlight", palette.highlight],
    ["colors.success", palette.success],
    ["colors.danger", palette.danger],
    ["typography.display", displayFont.family],
    ["typography.body", bodyFont.family],
    ["radius.button", `${radius.btn}px`],
    ["radius.card", `${radius.card}px`],
    ["radius.chip", `${radius.chip}px`],
    ["effects.gradientMode", gradientMode],
  ];
  const isColor = (v: string) => v.startsWith("#");
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Design tokens</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-gray-100 py-1">
            <code className="text-gray-600">{k}</code>
            <div className="flex items-center gap-2">
              {isColor(v) && <div style={{ background: v }} className="h-4 w-4 rounded border border-gray-200" />}
              <code className="text-gray-900 font-semibold">{v}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
