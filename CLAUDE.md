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
    subscriptionService.ts    # Freemium tiers (Gratis/Contractor), feature gating, usage limits.
                              # 14-day Pro trial: started in `AuthContext.signUp`,
                              # EXPIRED in `loadSubscription` (the one choke point
                              # every consumer passes through) and cleared by
                              # `upgradeTo` so a payer is never read as a lapsed
                              # trial. All three move together — see learnings #300,
                              # where each fix in the chain created the next bug.
    paymentMarginService.ts   # DEAD: the tier commission must NOT ship (memory/payments-monetization-2026-08.md). The "Vasco rekent 3.5% commissie" notice was REMOVED from the Mollie + Stripe screens 2026-09-28 — Vasco charges nothing there (the contractor's own account). Never re-add a fee claim without a fee.
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
  src/app/admin/      # AdminShell (email-code sign-in, allow-list) + AdminTabs (sidebar routing)
  src/lib/server/     # adminSession (signed cookies, ADMIN_EMAILS) — server only
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
cd admin && ADMIN_EMAILS=you@x.com ADMIN_SESSION_SECRET=$(openssl rand -hex 32) npx next dev -p 3005
                                  # admin at :3005/admin (3000 = CollectAI). No PIN:
                                  # sign-in code prints to the dev log without RESEND_API_KEY.
cd admin && npm run test:auth     # admin sign-in tests (node --test)
cd admin && npm run test:legal    # privacy/terms served per language (?lang=, Accept-Language)
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
npm run check:send-invoice             # LIVE: sending an invoice works — by document
                                       # NUMBER, reminder keeps sent_at, paid stays
                                       # paid, other user 404. Mail → Resend's test
                                       # inbox only. It 404'd on EVERY real send
                                       # until 2026-09-30, hidden by an optimistic
                                       # "mark sent" (learnings #379).
npm run check:portal-totals            # LIVE: the customer's quote page states the
                                       # APP's net/VAT/total (hard-coded, not
                                       # recomputed), incl. Kleinunternehmer = no VAT.
npm run check:kosit                    # THE OFFICIAL XRechnung validator (KoSIT +
                                       # XRechnung 3.0 rules) over our generators'
                                       # output; needs JAVA_HOME=/usr/local/opt/
                                       # openjdk@17. It rejected EVERY XRechnung we
                                       # made until 2026-10-01 while our own
                                       # validator passed them. Run it after ANY
                                       # change to src/integrations/einvoice.ts.
npm run check:einvoice-schemas         # Italy (FatturaPA 1.2.2) + Spain (Facturae
                                       # 3.2.2) against their OFFICIAL XSDs (xmllint),
                                       # built through the real mapper path. Both
                                       # failed on first run (IT element order; ES
                                       # surnames). Schema = gate one; then the
                                       # value rules below.
npm run check:einvoice-rules           # SDI (Elenco controlli v2.0) + FACe (Orden
                                       # HAP/1650/2015 Anexo II) VALUE rules, offline
                                       # — no public validator exists. The same
                                       # checks gate the app's IT/ES export and the
                                       # records archive (einvoiceValueRules.ts).
                                       # Our own output broke 00423/HAP 6a (2-dec
                                       # quantities) until 2026-10-01.
npm run check:pdfa3                    # ZUGFeRD/Factur-X PDF/A-3 hybrids against
                                       # veraPDF 1.30.2 + Mustang 2.26.0 (Java 17,
                                       # ~/.cache/vasco-pdfa). Both validators PASSED
                                       # a PDF whose text did not render — also LOOK
                                       # at the page. Built on the device (pdf-lib):
                                       # ~20 s on the emulator, so the row shows a
                                       # spinner (#388).
npm run check:facturae-signature      # Spain B2G: signed Facturae (XAdES-EPES,
                                       # policy 3.1) against EU DSS 6.5 (Java 17,
                                       # ~/.cache/vasco-xades); a tampered file
                                       # must fail. Crypto on device: verify with
                                       # a temporary logcat bundle (#389).
npm run matrix                         # THE EVERYDAY MATRIX — the baseline. A new
                                       # contractor per market (NL/DE/FR/ES/IT/UK)
                                       # × B2B/B2C goes onboarding → settings →
                                       # customer → quote → accept → invoice → PDF
                                       # + every export, through the REAL screens
                                       # (prod posture, empty account), and the
                                       # OFFICIAL validators judge what came out
                                       # (+ totals vs EN 16931, parties, legal
                                       # mentions). Every check above runs on
                                       # samples we BUILT; this one cannot be fooled
                                       # by them. 0/12 green on 2026-10-03 —
                                       # memory/everyday-matrix-2026-10-03.md. Fix a
                                       # defect only with its cell going green;
                                       # never edit a check to pass. Java 17 +
                                       # the validator caches (check:kosit/pdfa3/
                                       # einvoice-schemas run once).
npm run check:push-owner               # LIVE: a push token belongs to ONE account
                                       # (the previous contractor's pushes stopped
                                       # reaching a shared phone, 2026-09-30).
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
npm run check:rpcs                     # calls every set-returning plpgsql RPC
                                       # in prod with NULLs, rolled back. Eight
                                       # failed on EVERY call (42702: a RETURNS
                                       # TABLE column shadowing a table column)
                                       # and applied cleanly — plpgsql is only
                                       # checked when a statement RUNS. ⚠️ An
                                       # early return hides the main query; seed
                                       # rows in a rolled-back txn for that. #361
npm run check:catalog-import           # DATANORM price lists dedupe on the SERVER
                                       # (`import_catalog_prices`): same list
                                       # skipped, a rise written, users isolated.
                                       # The app keeps no import state (#386).
npm run check:price-reference          # a contractor reads their OWN price
                                       # reference (`get_my_price_reference`),
                                       # never another's; the owner-only view
                                       # price_references stays unreadable.
                                       # WRITES throwaway users — run after
                                       # migration 20261003000001 is applied.
node scripts/ota-preflight.mjs         # i18n/mock/currency gates before `eas update`

# Store + ops gates.
npm run check:listing                  # Play listing copy AND phone screenshots.
                                       # Gates length, formal register, and that
                                       # nothing advertises a feature that is
                                       # DARK in production. ⚠️ It used to read
                                       # the COPY only and was green while a
                                       # screenshot titled "KI-Angebot" pitched
                                       # photo→AI quoting that throws (LLM keys
                                       # unset). A claim is a claim in any
                                       # artefact — copy, screenshot, graphic.
./scripts/make-play-screenshots.sh     # 2 per locale at 1512×2688 (9:16), by
                                       # reframing the 6.9" App Store captures.
                                       # It OWNS the output dir — fastlane
                                       # uploads whatever it finds, so anything
                                       # not in SHOTS is deleted every run.
                                       # ⚠️ `sips` crop fails SILENTLY: origin +
                                       # height must be strictly < the source,
                                       # and --cropOffset is a top-left ORIGIN,
                                       # not a shift. Assert output dimensions.
npm run check:watchdog                 # self-test for the nightly watchdog gate
                                       # (scripts/watchdog-gate.mjs). Acked
                                       # criticals live in
                                       # .github/watchdog-acks.json with a
                                       # MANDATORY expiry. ⚠️ A missing acks file
                                       # is FATAL, not an empty list — the
                                       # workflow once had no actions/checkout,
                                       # so suppression was silently a no-op.
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
  - ✅ **The Alert-as-menu rule now HAS a repo-wide detector** —
    `__screenwalk__/alertIsNotAMenu.test.tsx`. Android renders at most THREE
    Alert buttons and drops the rest silently, so it fails on a fourth literal
    button, on a `.map()` expression, and (since 2026-09-09) on a spread of a
    **named** array — `[...baseOptions, ...muteOption, cancel]` counted as one
    button and hid VascoCard's own Cancel on Android. `...(cond ? [x] : [])` is
    bounded and counted, not flagged.
    - ⚠️ **The chip-strip rule is the one still without real coverage.**
      `chipStripIsNotAMenu.test.tsx` exists but is narrow.
    - ⚠️ Every static guard here strips comments first, and **must** use
      `src/utils/stripComments.ts` (scripts: `scripts/lib/strip-comments.mjs`).
      The obvious `replace(/\/\*[\s\S]*?\*\//g,'')` cannot tell a comment from a
      string: `'image/*'` in `permits.tsx` opened a phantom comment that hid
      8,932 chars of `AppState.tsx` and 11 `Alert.alert` calls from the guards,
      which stayed green. See learnings #298.
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
  ⚠️ That includes `workflowPackService.evaluateTriggers` (fixed 2026-09-22,
  #362) — Vandaag calls it on mount, before the profile merges, and an
  English iPhone baked "End of Day Routine / VIEW" into a Dutch queue. Any
  NEW producer of queue cards needs the same two awaits.
- **A card whose number is zero is not a card.** A nudge that reads "Jobs not
  finished today: 0" to a contractor with no jobs is noise on day one; gate
  every step on its own count (#362).
- **ONE customer form: `AddCustomerSheet`** (`src/components/shared`) — add
  AND edit, with the Free-plan limit, validation, duplicate check, VAT id and
  every market's e-invoice fields. Never call `addCustomer(` from a screen;
  open the sheet. There were three forms, each missing what another had
  (#365). Guard: `customerSheetsCollectEInvoiceAddress`.
- **Queue cards carry the `locale` they were written in.** Pending cards in
  another language are dropped and regenerated (`dropStaleLanguageCards`) —
  but ONLY from producers on its allow-list (`automation_*`, `trade_*`,
  `workflow_*`), the ones rebuilt right after. Everything else is kept: a
  deny-list version deleted maintenance-visit cards whose preparedData was the
  only copy of the visit (#366). A new producer is kept by default; add it to
  the allow-list only if it is rebuilt on every run. **When deleting to
  regenerate, enumerate what regenerates — never what doesn't.**
- **If a form REQUIRES something, ask for it BEFORE the form** — never let
  the contractor fill everything in and then refuse. A quote and a
  maintenance contract need a customer: with none, the shared
  `AddCustomerSheet` (`src/components/shared`) opens on arrival; with some,
  a DKMenu picker comes first. The quote builder had no picker at all and
  ~15 entry points opened it bare (#362). User's rule, 2026-09-22.
- **Placeholders use `SemanticColors.placeholder` / `DK.colors.placeholder`**
  (#B6BCC6), never a text grey — readable yet visibly not an entered value.
  Menus, pop-ups and form labels are WHITE (`DK.colors.text`); the rest of
  the app keeps its secondary grey. User's call, 2026-09-22. ⚠️ The ACTIVE
  `SemanticColors` is `DKTheme` in `colors.ts` — add new tokens THERE.
  Guard: `formsAndMenusAreReadable`.
- **ONE rounding rule for money: `round2` in `src/utils/round2.ts`** (a leaf
  module; `domain/business.ts` re-exports it). Never a private copy, never an
  inline `Math.round(x * 100) / 100` on a money path — both lose 0,285 → 0,28
  and round negatives the wrong way. Guard `oneRoundingRule` (named AND inline).
  #354 fixed it in one file while ten copies kept the bug (#380).
- **VAT follows EN 16931 everywhere**: a line's net is its amount in cents,
  VAT per rate on the sum of those (`vatRateGroups` / `documentNet`). The PDF,
  the screen, the stored total, the XRechnung and the customer portal state the
  same cent — property tests `aDocumentAddsUp` (PDF == XML) and
  `portalTotalsMatchTheApp`. A line WITHOUT a rate is a line at the document's
  rate (the DB stores it so). A document's fallback rate is
  `documentFallbackRate` (highest line rate), never `lineItems[0]?.vatRate ?? 0`.
- **A rule both the app and an edge function need lives in
  `supabase/functions/_shared/` as pure TypeScript that jest imports** — never
  "kept in step by hand" (the portal's copy drifted; the customer accepted a
  cent less than the invoice). See `_shared/documentTotals.ts`.
- **Vasco does not file tax returns** (user, 2026-10-03). `app/contractor/vat-prep.tsx`
  is the VAT REPORT for all six markets (`src/services/vatReport.ts`): sales and
  VAT per rate, purchases, balance, the documents behind them, and what is NOT
  included — PDF/CSV for the accountant. Its figures are the groups the
  invoice's own totals came from (`AutoInvoice.vatGroups`) — never recompute or
  guess them. No box mapping, no "submit/file" button, no nil-return claim
  outside NL/DE. The old `vatPrepService` and the accountant access/handover
  screens stay dormant (user: keep them off). memory/vat-report-not-submissions.md.
- **A legal statement is the contractor's fact, never a default.** A German
  invoice asks for the date of the work before it leaves (`ensureServiceDate`
  in `app/invoices/[id].tsx`), stores it (`documents.delivery_date`), prints it
  and sends it as BT-72 — the PDF never claims "entspricht dem
  Rechnungsdatum". Seller lines on every PDF come from `sellerAddressLine` /
  `registrationParts` (invoicePdfService) — quote and invoice alike.
- **Status follows the artefact, for invoices too**: `markInvoiceSent` only
  behind a delivered email or a confirmed share (guard
  `invoiceSentOnlyWithAnArtefact`). The invoice button says what it does —
  Send invoice / Send reminder / Send invoice again / nothing when paid.
- **An account switch is a logout, then a login** (`handOverFrom` in
  `sessionCleanup`): a direct A→B sign-in kept A's data and could heal A's lines
  into B's backend (#378). Server-side, a push token belongs to one account.
- **Privacy + terms exist in all six languages** — app (`legal.*` keys) and
  web (`content/legal/<lang>/`, both trees identical; guard
  `legalTextsInEveryLanguage`). English prevails; a change to the English text
  must be re-translated in the same change.
- **A success message waits for the write it announces.** "N imported",
  "Prices added" and "Saved" are claims about rows. A writer that swallows
  its errors must RETURN whether it landed (`emitMaterialPurchased` → boolean,
  `feedPricingMoat` → count, `upsertMaterialCatalogRow` → inserted/exists/
  failed) and the screen claims only that (#363).
- **AI features follow the SERVER, not the build.** Gate anything that calls
  an LLM on `useAiCapabilities()` (`src/services/aiCapabilities.ts`, backed by
  the `ai-capabilities` edge function, booleans only): `vision` for photo
  analysis, `text` for drafting. Setting ANTHROPIC_API_KEY switches them on
  within the hour — no build, no OTA. Unreachable = OFF. The build flags in
  `config/ai.ts` are an override and the offline fallback only (#364).
- **Inkoop = supplier invoices in, price intelligence out** (rebuilt #364).
  Do not re-add Herbestellen / Leveranciers / Voorraad / stock figures until
  something WRITES inventory — they were fed only by a test seed.
- **Account deletion = EXPORT, THEN DELETE** (user's call, 2026-09-24).
  Keeping invoices is the CONTRACTOR's legal duty, not Vasco's — never
  build "we keep anonymised records". ONE screen starts a deletion
  (`app/contractor/delete-account.tsx`): duty per country
  (`src/domain/recordRetention.ts` ← `retentionPeriods.ts`), a COMPLETE
  export (`result.complete`), a required acknowledgement, then
  `accountDeletionService`. The worker (`drain-account-deletions`) erases
  everything; the only survivor is the erasure record
  (`account_deletion_requests`, no FK, reason nulled, 3 years).
  - A table whose FK to `auth.users` is NOT `CASCADE` survives the cascade:
    the worker must delete it explicitly. `npm run schema:snapshot` records
    `authUserFks`; guard `erasureReachesEveryOwnedRow` fails on a miss.
  - The Facturae SIGNING CERTIFICATE is device-owned (survives a same-user
    logout) — `clearAllLocalData` removes it on deletion; anything else
    device-owned needs the same (#389).
  - A new owned table the contractor must keep → add it to the export
    (`dataExportService` BackendDataset; child tables via `byParent`).
  - Guards: `deleteAccountExportsFirst`, `deletionRequestLands` (live
    schema), `erasureReachesEveryOwnedRow`. Legal copy lives twice
    (`docs/legal` = `admin/content/legal`, must stay identical).
- **Dormant code is GATED, not deleted** (user's call, 2026-09-24): ~30% of
  the code no signed-in contractor can reach stays for future extensions.
  `src/config/dormant.ts` lists the gated routes (the root layout redirects
  them, deep links included); `src/config/dormant.files.json` is the
  generated manifest (`node scripts/reachability.mjs --write-manifest`) that
  sweeps and guards SKIP. Guard `dormantStaysDormant`: a dormant file wired
  back in must leave the list on purpose, and new unreachable code must be
  added on purpose. Do not sweep or fix dormant code — un-gate it first.
- **Embeddings are DARK in production** — no OPENAI/VOYAGE key.
  `EMBEDDINGS_ENABLED` (`src/config/ai.ts`, off) gates every call to
  `generate-embedding` / `embed-text`; semantic search falls back to its
  local keyword index. Same pattern as `LLM_GENERATION_ENABLED`: set it in
  the change that funds the key. Guard: `embeddingsStayDarkWithoutAKey`.
- **A country-dependent nudge must SKIP when the country is unknown**, never
  default. `context.country || 'NL'` handed a German plumber the Dutch permit
  list, and the same default silently withheld the XRechnung reminder — one
  failing open, one failing closed, from one line.
- **A job's customer is set at creation** — the `DKMenu` picker in the new-job
  sheet (`app/(contractor)/werk.tsx`). `addJob` has exactly ONE caller; before
  R2026-08-22 it passed `customerId: null` and no screen could ever set it, so
  every job was customer-less while `job.customerId` had readers everywhere.
  ⚠️ The job DETAIL screen still cannot change it. #208.
- **Money columns are `numeric`, never `real`/`double`** — totals and costs
  `numeric(14,2)`, unit prices `numeric(14,4)`. REAL keeps ~6 digits: €12.345,67
  came back €12.345,70 (#386, fixed #390). Ratios, hours, confidences may stay REAL.
- **A view you (re)create in a migration states its privileges** (GRANT/REVOKE):
  DROP + CREATE re-applies the project's DEFAULT grants, and a view runs with its
  owner's rights (RLS does not apply) — `price_references` briefly exposed every
  contractor's prices (#390). Guard `recreatedViewsStatePrivileges`. Changing a
  column's type: keep dependent views' OUTPUT types (casts) and run the change in
  a rolled-back txn on prod with a negative control first.
- **A number the contractor TYPES goes through `parseDecimalInput`**
  (`src/utils/decimalInput.ts`), and an editable numeric field is a
  `DecimalInput` (`src/components/shared`), never `value={String(n)}`.
  `parseFloat("12,50")` is 12 on every EU keypad, and re-parsing per keystroke
  eats the separator in every locale — no invoice line or quote price could
  carry cents (#337). Guard: `numericInputsKeepTypedText.test.ts`.
- **No hook below an early `return`.** The repo has NO ESLint, so the rules of
  hooks have never been enforced; the invoice screen crashed on any mount
  before hydrate from May to 2026-09-15 (#338). Guard (body-level only):
  `noHookAfterEarlyReturn.test.ts`.
- **Never `Intl.NumberFormat#formatToParts`** — Hermes lacks it; it passes in
  node and throws on device (`compactCurrency.test.ts`).
- Always run `npx tsc --noEmit | grep "^app/"` after changes
- **A scheduled call is judged by its OUTCOME, not by pg_cron.** `net.http_post`
  inside a cron body can return 401 and pg_cron still records the run
  `succeeded` — the statement enqueued a request, which is all it promised.
  Every job firing HTTP must therefore record its request id into
  `public.cron_http_calls` (`with sent as (select net.http_post(…) as
  request_id) insert into …`), because `net._http_response` carries **no url**
  and the request queue is emptied on completion, so an unrecorded call can
  never be attributed back to its job. `vasco-reconcile-http-outcomes` copies
  verdicts out every 10 min — pg_net prunes within hours, and a digest-time
  join would report a reassuring zero. Guard:
  `cronExpectationsMatchCronSql.test.ts`. See learnings #359.
  - 🔴 **Apply the migrations BEFORE running `supabase/cron.sql`.** The body is
    one statement: no `cron_http_calls` table means the insert aborts it and
    the HTTP call is never made. That stops automations, loudly — which is the
    accepted trade, but only in that order.
  - ⚠️ **Every `net.http_post` sets `timeout_milliseconds := 180000`.**
    pg_net's default is a 5 s CLIENT timeout: three healthy jobs (6–19 s,
    all 200) were raised as criticals on the outcome check's first day (#361).
  - ⚠️ **Four lists of the cron job names must agree** (`cron.sql`, the
    watchdog's `EXPECTED_CRON_JOBS`, `cron-health.sql`, and — derived, never
    written — `scripts/register-crons.mjs`). #357/#358.
- **🔴 CHECK EVERY PIECE OF CODE YOU ADD, EVERY TIME.** Re-read the diff you
  just wrote as if reviewing someone else; run tsc and the touched suites;
  **decoy the guard** (`node scripts/decoy-check.mjs`) — a test that does not
  fail when the defect returns has checked nothing, and a "toothless" verdict is
  run down, never written off. For layout, money, tax or credentials verify the
  EFFECT (the device, the generated artefact, the DB row), not the shape. If a
  check is deferred, say so out loud — "still owed: the device pass" is what
  preceded learnings #343, where a fix broke ten screens that were working.
- Always update memory .md files after completing work
- **Emulator-walk rules (2026-09-28/29, `memory/emulator-walk-2026-09-28.md`)** —
  every one has a guard; use the helper, never the old shape:
  - **Errors in an Alert go through `friendlyError(err, fallback)`**
    (`src/utils/friendlyError.ts`): our own reasons stay, machine text
    ("Edge Function returned a non-2xx…") becomes the localized fallback.
    Guard `alertsShowNoMachineErrors`. A sentence is never an Alert TITLE
    (Android cuts it at 2 lines) — short title + body, `alertTitlesFitAndroid`.
  - **Back buttons call `goBack(router)`** (`src/utils/goBack.ts`), never a
    bare `router.back()`: a screen opened from a push/link has no history.
  - **Scroll content in `app/(contractor)/` pads `TAB_BAR_CLEARANCE`** — the
    tab bar is `position: 'absolute'`; guard `tabScreensClearTheTabBar`.
  - **A control with nothing behind it is hidden, not "Coming soon"** —
    `DORMANT_CONTROLS` in `src/config/dormant.ts` (user: hide until built).
  - **WhatsApp = `sendWhatsApp(phone, text, country)`** → `https://wa.me/…`
    with `toE164` (`src/utils/phone.ts`); `whatsapp://` fails silently
    without the app. Unknown country → contact picker, never a guessed +31.
  - **Hours are valued at `resolveHourlyChargeRate(profile)`**
    (`src/services/hourlyRate.ts`) or not at all — never a literal rate.
  - **Template variables are shown as words** (`[klant]`) and stored as
    tokens (`{{customer}}`) — `src/utils/templateTokens.ts`.
  - **A status write needs the artefact**: don't mark a document "sent" on a
    button tap or a share sheet that may have been dismissed — ask, or open
    the real send flow.
  - **Generator copy with `{{count}}` needs a `<key>_one`** when it can be 1
    (`gt()` picks it) — "1 facturen" shipped.
  - **Colours are DK tokens only** — no `Palette.<hue>NNN`, no hex, no
    `feedbackInfo` blue on the dark UI (Garantie + templates were on the
    retired light palette; guards `warrantyUsesDkPalette`,
    `templatesUseDkPalette`).
  - Connect screens (Mollie/Stripe/Moneybird) speak builder, not developer:
    numbered steps + "Open …" button; never "API key", "live_xxxx",
    "administratie-ID"; never a fee claim without a fee.

## Demo Accounts (any password)
- `contractor@vasco.dev` — Solo contractor
- `aannemer@vasco.dev` — Renovation GC (project mode enabled)
- `site@vasco.dev` — Site lead
