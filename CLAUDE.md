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

# Audits — run these BEFORE building on a field or mounting a component
python3 scripts/audit-dead-fields.py   # optional fields nothing writes (#110)
npm run audit:unmounted                # components no screen reaches; follows the
                                       # data path into their services (#111)

# Screen walk — mounts every contractor/aannemer screen headlessly, in Dutch,
# with real providers. ~8s for the whole surface; catches what reading cannot.
npm run walk                           # seeded demo contractor (what the sim shows)
npm run walk:fresh                     # day one: backend up, zero rows
npm run walk:prod                      # DEMO_MODE OFF — the shipping build.
npm run walk:ipad                      # same screens at iPad Pro 11" portrait
npm run walk:ipad:landscape            # ...and landscape. app.json declares
                                       # supportsTablet, nothing branches on
                                       # width, and this had never been walked.
                                       # ⚠️ react-test-renderer does not LAY
                                       # OUT: a clean run means nothing crashes
                                       # and no code branches wrongly on width.
                                       # It cannot see a stretched column.
# `walk` and `walk:fresh` both run with __DEV__ true, so DEMO_MODE is ON and
# fabricated fixtures are SUPPOSED to render. Only walk:prod answers "does mock
# data reach a real contractor?". It runs the posture-agnostic suites only —
# crew/payroll/flow suites are fixture-dependent by design, and the EU market
# postures need demo accounts. See memory/demo-data-removal.md.
# A quantity identical in BOTH postures is not computed from the contractor's
# data. Detectors in __screenwalk__/detectors.test.tsx fail on new instances of
# known defect shapes; its KNOWN list is the outstanding-findings list.
# Walk a role with `walkScreen(S, { as: 'aannemer' })` — without it every
# `isAannemer` branch renders its solo variant and the multi-site surface is
# invisible.
npm run check:photo -- <photo.jpg> plumbing NL   # is photo→quote any good?

# Backend, against LIVE Supabase. Keys come from
# `npx supabase projects api-keys --project-ref gblhqhorkarocmputhte`, NOT .env.
npm run smoke:golden                   # the CONTRACTOR path, authenticated
npm run smoke:customer                 # the CUSTOMER path — anon key, NO session.
                                       # The other half of the product: quote
                                       # acceptance + the decision portal. All of
                                       # it was dead in prod until 2026-08-19
                                       # because `anon` has ZERO table grants and
                                       # nothing here had ever sent a request
                                       # without a session. Also asserts anon
                                       # still CANNOT read nine tables — the
                                       # one-line "fix" is a GRANT that leaks
                                       # every quote token on the platform.
npm run smoke:endpoints                # edge fns + RLS + anon surface + drift
npm run check:insertable               # can the app actually INSERT into every
                                       # table it writes to, as an owner under
                                       # RLS — and does any writer NAME every
                                       # NOT NULL column that has no default?
                                       # The second half is the one with teeth:
                                       # a required column nothing sets is a
                                       # write that can only ever fail.
npm run check:drift                    # database.types.ts vs the LIVE columns,
                                       # both directions. A Row field that is
                                       # not a column makes PostgREST reject the
                                       # WHOLE write (PGRST204); a column with no
                                       # field is data the FE cannot see.
                                       # ⚠️ grep "who writes this field" misses
                                       # edge-function writers — check
                                       # supabase/functions/** too.
node scripts/ota-preflight.mjs         # i18n/mock/currency gates before `eas update`
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
- **🔴 NEVER build a chip/pill row as a MENU.** Picking one of N is always a
  balloon menu — `DKMenu` from `src/components/shared/DKMenu.tsx`: an anchor
  showing the current choice, opening an iOS-style popover listing all options
  with a tick on the selected one. A horizontal chip strip hides every option
  past the right edge, never says how many exist, and reads as a filter rather
  than a choice.
  - Chips ARE still correct for **multi-select filters and toggles** (Alle /
    Lopend / Afgerond), where every option should be visible at once and more
    than one can be on. The test: *is the user choosing one thing?* → menu.
  - ⚠️ **Neither this rule nor the Alert-as-menu rule has a real detector.**
    The existing guard (`__screenwalk__/scheduleMenuNotAlert.test.tsx`) names
    ONE screen, which is why both were still violated in `timesheet.tsx` and
    `permits.tsx` in 2026-08. An `Alert.alert` whose buttons are spread from a
    `.map()` is the same defect — Android renders at most THREE. 53 such sites
    remain; see `memory/drag-schedule-is-not-drag.md`.
  - `DKMenu` is deliberately a JS popover, not a native `UIMenu`: a native menu
    module would force a native rebuild and take fixes off the OTA channel, and
    `UIMenu` does not exist on Android.
- **Tablet:** the app is held to one centred column by `WideScreenFrame`
  (`app/_layout.tsx`, 820pt). Do **not** add per-screen width branching, and do
  **not** propose a master-detail / sidebar iPad layout — that is a deliberate
  no until a user asks for it. See `memory/ipad-tablet-support.md`. Any new
  width read must use `useWindowDimensions`, never a module-level
  `Dimensions.get` (five of those already go stale on rotation).
- **Catalogue strings are COPY, not data.** The decision checklists in
  `src/data/mockDecisions.ts` were 567 English literals read by the contractor,
  by the CUSTOMER in the portal, and (once an upgrade is billed) on an invoice.
  They resolve through `src/services/decisionCatalogI18n.ts` by their STABLE ids
  at **render** time — never translate at creation, because a checklist is
  COPIED into a tracker and would freeze the language of that day. Keys live
  under `decisionCatalog.*`; DE + NL are complete, FR/ES/IT fall back to
  English. Anything new in `src/data/` that a human reads needs the same
  treatment.
  The same rule now covers the quote builder: the DEMO starter pricebook and
  the "Forgot something?" consumables in `TieredQuoteBuilder.tsx` are stable ids
  resolved through `quoteCatalog.service.* / .unit.* / .consumable.*` (all six
  locales complete). ⚠️ **Two adjacent hardcoded tables can differ in whether
  they ship**: `TRADE_PRICEBOOK` is `DEMO_MODE`-gated, `TRADE_SUGGESTIONS`
  beside it never was. Check the gate before you decide a Dutch literal is
  harmless.
- **A client-side store must be in THREE places or it is not persisted**
  (`src/state/AppState.tsx`): the `useState` initialiser, a persist `useEffect`,
  and the hydrate list in the mount effect. `lineItems` was in the first only,
  so every quote/invoice a contractor created reopened with no lines and
  recomputed its own total to € 0,00. The hydrate loop walks *array* pairs —
  a non-array store (`lineItems`, `businessProfile`) needs its own block and is
  exactly what gets skipped. See `memory/learnings.md` #205.
- **A prediction may fill a field named `suggested*`. It may not fill a field
  whose name asserts what happened.** `addJob` stamped `quotedAmount` from
  `jobPrefillService`'s invented `LABOR_RATE` table, so a job created from a
  bare title arrived priced at €198 — and `quotedAmount` feeds the margin and
  cost-variance generators, project P&L, the customer's spend and the invoice
  prefill. Hours (a scheduling default) stay; the price is gone. #207.
- **Decision upgrades bill as meerwerk**, on their own invoice, never folded
  into a fixed price — `src/services/decisionUpgradeBilling.ts`. The art. 7:755
  gate turns on WHO chose: a customer picking an option in the portal saw the
  price beside it (billable), the contractor recording it for them did not
  (needs a recorded warning). A negative impact is minderwerk and never blocked.
- **Invoicing a finished job** goes through `src/services/jobBillingBasis.ts`:
  an agreed price bills the agreement (materials are already covered by it), no
  agreed price bills the job's own record — logged hours × the contractor's
  hourly pricebook rate, plus materials `delivered`/`installed`. It refuses,
  with the reason, rather than minting a €0 invoice.
- **Customer-facing web pages** live in `admin/src/app/**` and are read by the
  contractor's CLIENT, who does not have the app. German is **Sie**, the trade
  noun is the market's own word (vakman / Handwerksbetrieb / artisan /
  profesional / tecnico — never "contractor" in Italian), and currency follows
  the CONTRACTOR's country, not the reader's browser. `docs/ui-playbook.md` §8.
- **One resolver for a document's customer** — `findDocumentCustomer()` in
  `src/domain/customers.ts`, FK → id-in-the-name-slot → name, in that order.
  `Quote`/`Invoice` carry BOTH `customerId` and `customer`; seeded rows put a
  NAME in `customer` and the R13.2 tiered-quote path put an ID there, so half
  the corpus matched `c.id === doc.customer` and half matched `c.name === …`.
  Never write a local lookup: the id leaked into the invoice screen's TITLE, the
  e-invoice `buyerName`, a reminder EMAIL's greeting and the "Top customers"
  GROUPING before this existed. See `memory/learnings.md` #214.
- **The business profile outranks the account.** `businessProfile.*` is what the
  contractor last entered; `user.*` is only where they started. Language,
  country, trade, company name — profile first, account as fallback
  (`applySavedLanguage`, `applySavedCountry`, and the Profil screen). Mixing
  them put "VDB Painters / Maler" in the same card as a Köln address (#218).
- **Anything that PERSISTS resolved copy must `await applySavedLanguage()` AND
  `applySavedCountry()` first** (`src/i18n/savedLanguage.ts`). `populateQueue`
  bakes both the wording and the currency format into strings it stores; the
  scheduler runs before the profile merges, so a German contractor got a card
  reading "€ 280" (nl-NL) beside one reading "350 € überfällig" (#210).
- **A country-dependent nudge must SKIP when the country is unknown**, never
  default. `context.country || 'NL'` handed a German plumber the Dutch permit
  list, and the same default silently withheld the XRechnung reminder — one
  failing open, one failing closed, from one line.
- **A job's customer is set at creation** — the `DKMenu` picker in the new-job
  sheet (`app/(contractor)/werk.tsx`). `addJob` has exactly ONE caller; before
  R2026-08-22 it passed `customerId: null` and no screen could ever set it, so
  every job was customer-less while `job.customerId` had readers everywhere.
  ⚠️ The job DETAIL screen still cannot change it. #208.
- Always run `npx tsc --noEmit | grep "^app/"` after changes
- Always update memory .md files after completing work

## Demo Accounts (any password)
- `contractor@vasco.dev` — Solo contractor
- `aannemer@vasco.dev` — Renovation GC (project mode enabled)
- `site@vasco.dev` — Site lead
