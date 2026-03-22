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
- **AI:** Claude Haiku Vision (photo analysis), 45 intelligence generators, ML prediction models
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
    workflowPackService.ts    # 7 automation packs
    aiActionQueueService.ts   # EVE-style proactive AI queue
    invoiceScanService.ts     # Photo → pricing moat pipeline
    cohortBenchmarkService.ts # Cross-contractor benchmarks
    priceIndexService.ts      # EU6 construction cost indexes
  integrations/       # Accounting, payments, e-invoicing, suppliers
  components/         # React components (shared, contractor, sitelead, dashboards)
  types/              # TypeScript types (6 compliance files, project, contractor)
  i18n/               # 6 locale files + formatting
  theme/              # tabStyles.ts (LOCKED design system), colors, spacing
```

## Key Commands
```bash
npx expo start                    # Start dev server
npx expo start --port 8083       # Start on alternate port
npx tsc --noEmit | grep "^app/"  # Check for TS errors (app/ only)
```

## Architecture
- **3 user types:** Contractor (solo), Aannemer (`isAannemer: true`, multi-trade projects), Site Lead (uitvoerder)
- **Compound AI:** 6 layers (data collection → ontology → semantic search → reasoning → action execution → ML models)
- **EVE Legal AI pattern:** AI prepares work proactively → queues for one-tap approval → never auto-executes customer-facing actions
- **7 automation packs:** Incasso, Quote follow-up, Maintenance, End-of-day, Welcome, Customer decisions, Purchasing
- **Pricing moat:** 8 data channels, invoice photo scanning, EU6 price indexes, cross-contractor benchmarks

## Design System (LOCKED — do not change without explicit user request)
- **Typography:** Manrope (headings: 800ExtraBold, 700Bold) + Inter (body: 600SemiBold, 400Regular)
- **Type scale:** display 28px, section 18px, title 16px, body 15px, caption 13px, label 12px, tiny 11px
- **Colors:** `Palette.hermesOrange` (#E35205) primary, SemanticColors for status
- **Spacing:** 8px grid (GRID.xs=4, sm=8, md=16, lg=24, xl=32)
- **Radius:** RADIUS.sm=8, md=12, lg=16, xl=20, full=28
- **Background:** PAGE_BG (#F2F2F7), white cards, no shadows on cards

## Conventions
- Use TypeScript for all new files
- Use TYPE/RADIUS/GRID constants from `src/theme/tabStyles.ts` — never hardcode font sizes or radii
- Use `SemanticColors`/`Palette` — never hardcode hex colors
- Use `Palette.hermesOrange` as primary accent — never terracotta/burntSienna
- Generator strings use `gt()` from `generatorTranslations.ts` — never hardcode Dutch
- Always run `npx tsc --noEmit | grep "^app/"` after changes
- Always update memory .md files after completing work

## Demo Accounts (any password)
- `contractor@vasco.dev` — Solo contractor
- `aannemer@vasco.dev` — Renovation GC (project mode enabled)
- `site@vasco.dev` — Site lead
