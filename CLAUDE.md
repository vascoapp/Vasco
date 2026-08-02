# Vasco - AI-Native Construction Trades Platform

## Overview
Mobile-first app for construction trades (plumbing, electrical, gas, painting, carpentry) serving contractors, aannemers (renovation GCs), and site leads across 6 EU countries (NL, DE, FR, ES, IT, UK).

## Tech Stack
- **Framework:** React Native + Expo (Expo Router v6, file-based routing)
- **Language:** TypeScript
- **State:** React Context API (AuthContext, AppState) + AsyncStorage persistence
- **Backend:** Supabase (database + auth + edge functions)
- **Payments:** Mollie (6 countries)
- **Accounting:** 19 providers (Moneybird, DATEV, Lexoffice, SevDesk, Pennylane, Holded, Fatture in Cloud, Xero, QuickBooks, etc.)
- **E-Invoicing:** XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA, Peppol
- **AI:** Claude Haiku Vision (photo analysis — stays on Claude), 45 intelligence generators, ML prediction models. Text-only LLM stages route via a provider abstraction (`supabase/functions/_shared/llm.ts`) that speaks Claude **or** Kimi/Moonshot with automatic Claude fallback, chosen per task by env (defaults to Claude). Customer PII is tokenized/scrubbed before any third-party (Kimi) call — see `_shared/pii.ts`.
- **Icons:** Ionicons
- **i18n:** i18next (6 locales: en/nl/de/fr/es/it, 687 keys each)

## Project Structure
```
app/                  # Screen routes (Expo Router)
  (contractor)/       # Contractor 5-tab layout (Vandaag|Werk|Geld|Klanten|Compliance)
  (tabs)/             # Site lead 4-tab layout (Vandaag|Planning|Veiligheid|Meer)
  contractor/         # Contractor drill-down screens (30+ screens)
  sitelead/           # Site lead drill-down screens (10 screens)
src/
  intelligence/       # Compound AI engine
    generators/       # 45 insight generators with i18n
    ontology.ts       # Connected entity graph
    semanticSearch.ts # pgvector + keyword search
    mlModels.ts       # Quote win, duration, payment predictors
    actionExecutor.ts # 13 action types with approval flows
    generatorTranslations.ts  # 116 keys × 6 languages
  services/           # 50+ business logic services
    workflowPackService.ts    # 10 automation packs
    aiActionQueueService.ts   # EVE-style proactive AI queue
    invoiceScanService.ts     # Photo → pricing moat pipeline
    cohortBenchmarkService.ts # Cross-contractor benchmarks
    priceIndexService.ts      # EU6 construction cost indexes
    subscriptionService.ts    # Freemium tiers (Gratis/Contractor), feature gating, usage limits
    paymentMarginService.ts   # FEE DISCLOSURE WIRED (R66r49 #14) / COLLECTION PENDING — 1% flat disclosure surfaces in Mollie connect modal in 6 locales. Actual fee collection (Stripe Connect / Mollie Partner config) is operator-side, not a code bug.
    supplierBacklinkService.ts # 16 EU suppliers, affiliate links, commission tracking
    complianceGatingService.ts # E-invoice format gating, 6 country compliance packs
    eveAgentService.ts        # EVE 3-agent model: Agent (execution), Auditor (compliance), Analyst (intelligence)
    customerCommunicationService.ts # WhatsApp Business + email + SMS automation, review requests
    liveTrackingService.ts    # GPS tracking, "On My Way" ETA, team map, GDPR consent
    signatureService.ts       # DEPRECATED (R296) — orphan; actual signature path writes SVG directly to Job.signatureSvg via app/contractor/job/[id].tsx
    teamToolsService.ts       # Worker scorecards, van stock, change orders, punch lists, membership enrollment
  integrations/       # Accounting, payments, e-invoicing, suppliers
  components/         # React components (shared, contractor, sitelead, dashboards)
  types/              # TypeScript types (6 compliance files, project, contractor)
  i18n/               # 6 locale files + formatting
  theme/              # tabStyles.ts (shared tokens) + draftkings.ts (DK Sunset Slate tokens) + colors.ts (semantic aliases)
admin/                # Web admin dashboard (Next.js 16 + Tailwind v4)
  admin.config.ts     # All configuration (branding, funnel, pods, modules)
  src/app/admin/      # AdminShell (PIN auth) + AdminTabs (sidebar routing)
  src/components/     # 19 dashboard components (13 Admin* + 3 Vasco-specific + DeveloperHub + DemoBanner)
    VascoOverview     # Platform overview: users, MRR, markets, trades
    VascoKPIDashboard # Funnel, financials, revenue timeline, market table
    DeveloperHub      # Latency, bugs, user suggestions, deploys
    AdminUGCDashboard # UGC analytics + automations (8 rules) + micropods (5 pods)
    AdminPodManager   # EU6 market pods with weekly targets
    AdminContentPipeline  # 7-stage Kanban + list view, summary bar, filters
    AdminCreatorManager   # Creator roster per language
    AdminBriefGenerator   # Data-driven creator briefs
    AdminCommissionTracker # Creator payout tracker
    AdminWeeklyReport     # Auto-generated pod insights
    AdminSwipeFile        # Competitor content inspiration
    AdminAccountTracker   # Multi-account TikTok analytics
    AdminBoostTracker     # Spark Ads ROI tracking
  src/lib/            # kpi.ts, pod-planner.ts, briefs.ts, commissions.ts, weekly-report.ts
docs/                 # Strategy documents
  monetization-plan.md  # 4-tier freemium: Gratis/Vakman/Meester/Aannemer + competitive research
```

## Key Commands
```bash
npx expo start                    # Start dev server
npx expo start --port 8083       # Start on alternate port
npx tsc --noEmit | grep "^app/"  # Check for TS errors (app/ only)
cd admin && npm run dev           # Start admin dashboard (localhost:3000/admin, PIN: 2026)
cd admin && npx tsc --noEmit     # Check admin TS errors
```

## Architecture
- **3 user types:** Contractor (solo), Aannemer (`isAannemer: true`, multi-trade projects), Site Lead (uitvoerder)
- **Compound AI:** 6 layers (data collection → ontology → semantic search → reasoning → action execution → ML models)
- **EVE Legal AI pattern:** AI prepares work proactively → queues for one-tap approval → never auto-executes customer-facing actions
- **10 automation packs:** Incasso (5-step billing), Quote follow-up, Maintenance, End-of-day, Welcome, Customer decisions, Purchasing, Daily customer update, Handover package, Permit check
- **Pricing moat:** 8 data channels, invoice photo scanning, EU6 price indexes, cross-contractor benchmarks

## Design System — DraftKings Sunset Slate (active since 2026-04-18, R175)
Dark slate + sunset-orange ramp + amber highlights. Replaces the prior Wolt-inspired light system. Full token reference: `memory/draftkings-theme.md`.

- **Typography:** Archivo (display: 900Black, 800ExtraBold, 700Bold, 600SemiBold) + Inter (body: 400/500/600/700)
- **Type scale:** display 28px, section 18px, title 16px, body 15px, caption 13px, label 12px, tiny 11px
- **Colors:** DK tokens in `src/theme/draftkings.ts` (also re-exported as SemanticColors via `src/theme/colors.ts`)
  - bg `#0B0E11` / panel `#14181F` / panel2 `#1C2128` / border `#2A3038`
  - text `#FFFFFF` / textMuted `#9CA3AF`
  - primaryDark `#9A3412` → primary `#C2410C` → accent `#F97316` (CTA gradient ramp) / highlight `#F59E0B`
  - `Palette.hermesOrange` remapped to `#F97316` (DK accent)
- **Spacing:** 8px grid unchanged (GRID.xs=4, sm=8, md=16, lg=24, xl=32)
- **Radius (soft):** RADIUS.sm=8, md=10, lg=14, xl=18, full=28
- **Effects:** DK CTAs use LinearGradient (primaryDark→primary→accent) + amber glow shadow (`shadowColor: DK.colors.accent, shadowOpacity 0.4-0.5`)
- **Background:** PAGE_BG `#0B0E11` (dark slate), panel cards, UPPERCASE Archivo_900Black for prominent titles with letter-spacing 1.2-1.8

## Conventions
- Use TypeScript for all new files
- Use TYPE/RADIUS/GRID constants from `src/theme/tabStyles.ts` — never hardcode font sizes or radii
- Use `SemanticColors` / `DK` (from `src/theme/draftkings.ts`) — never hardcode hex colors
- Use `Palette.hermesOrange` (remapped to DK sunset) or the explicit DK tokens for accents
- Generator strings use `gt()` from `generatorTranslations.ts` — never hardcode Dutch
- UPPERCASE labels: use `DKLabel` from `src/components/shared/DKLabel.tsx` — preserves screen-reader accessibility via `accessibilityLabel`
- Drill-down screens: use `DKScreenHeader` from `src/components/shared/DKScreenHeader.tsx` for consistent back + title
- Always run `npx tsc --noEmit | grep "^app/"` after changes
- Always update memory .md files after completing work

## Demo Accounts (any password)
- `contractor@vasco.dev` — Solo contractor
- `aannemer@vasco.dev` — Renovation GC (project mode enabled)
- `site@vasco.dev` — Site lead
