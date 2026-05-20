# US Market Expansion — Phased Plan

Built from [`us-market-research.md`](./us-market-research.md). The
research report is the strategic input; this doc is the execution plan,
broken into ship-able phases with concrete tickets and effort estimates.

The current codebase is deeply EU-first: VAT schemes, IBAN/BIC, KvK/BTW
registration numbers, Peppol / XRechnung / FatturaPA e-invoicing, EUR/GBP
currency. US needs a parallel set of primitives that live *alongside* the
EU ones, not as a replacement. The country code becomes the dispatch key.

---

## North-star architecture: the Country Adapter pattern

Every place that branches on country today (VAT scheme advisor, invoice
PDF legal fields, bank-details renderer, e-invoice format dispatch, etc.)
should read from **`src/data/countries.ts`** instead of hardcoding `'NL'`
/ `'UK'` checks. Adding a country = one row in the registry + per-feature
gating that says "if `country.eInvoice == null`, hide the e-invoice
panel" etc.

This pattern is already half-built. The phases below complete it.

```
src/data/countries.ts                    ← single source of truth
  ├── CountryConfig.taxRegime: 'vat'|'sales_tax'  (new)
  ├── CountryConfig.bankAccountFormat: 'sepa'|'sepa_uk'|'ach'  (new)
  ├── CountryConfig.terminology.quoteLabel: 'Quote'|'Estimate'  (new)
  ├── CountryConfig.vat?: VatConfig        (now optional)
  ├── CountryConfig.eInvoice?: EInvoiceConfig  (now optional)
  └── CountryConfig.salesTax?: SalesTaxConfig  (new, US only)
```

---

## Phase 0 — Foundational primitives (✅ this session)

Unblocks everything else. No payment integration or feature code; just
the type plumbing so the rest can be built incrementally.

- [x] **`CountryCode` extends with `'US'`**
- [x] **`CurrencyCode` extends with `'USD'`**
- [x] **`LocaleCode` extends with `'en-US'`** (separate from `'en'` which
      stays UK-flavoured)
- [x] **`COUNTRIES.US` registry row** — businessId = EIN format, no VAT,
      no Peppol, sales-tax regime, ACH bank format, "Estimate" terminology
- [x] **`SalesTaxConfig` + per-state sales-tax rates** —
      `src/data/usSalesTax.ts` with 50-state nexus rates (state-level
      only for v1; local rates need TaxJar API later)
- [x] **`CountryConfig.vat` + `eInvoice` made optional**, `taxRegime`
      added as authoritative discriminator
- [x] **`BusinessProfile.country` union widened to include `'US'`**
- [x] **`BusinessProfile.routingNumber` + `bankAccountNumber`** added
      (optional; US ACH analogue of IBAN/BIC)
- [x] **`getTerminology(country)` helper** returning `{quoteLabel, taxLabel, bankAccountLabel}`

After this lands: a US contractor can complete onboarding and pick the
US country, but no feature actually works yet — every downstream feature
needs Phase 1+.

---

## Phase 1 — US onboarding + invoicing MVP (2 weeks)

The minimum that lets a US sole-proprietor run a job end-to-end in demo
mode.

- [ ] **Onboarding country picker** — add US flag/option, hide
      VAT-scheme step when `country == 'US'`, add state picker
- [ ] **`Estimate` terminology throughout** — replace hardcoded "Quote"
      strings (in `tieredQuoteBuilder`, `app/contractor/quotes/...`,
      i18n `en-US.json`) with the registry's `terminology.quoteLabel`
- [ ] **Invoice PDF: US legal layout** — no VAT, sales-tax line, MM/DD
      dates, $ currency, no leveringsdatum / KvK / BTW. Header changes:
      "Estimate" / "Invoice" / "Receipt"
- [ ] **State sales tax**: pulled from `usSalesTax.ts` on invoice
      generation based on `BusinessProfile.state` + customer address.
      Mark as "estimate — operator confirms before submission" (mirrors
      VAT prep gate)
- [ ] **ACH bank fields in onboarding** — render routing + account
      inputs when `country.bankAccountFormat == 'ach'`. Display on
      invoice PDF in lieu of IBAN
- [ ] **en-US locale file** — branch from `en.json`. Swap "Quote" →
      "Estimate", "VAT" → "Sales tax", date format MM/DD, currency
      symbol $. Imperial units where it matters
- [ ] **Demo account** — `contractor@vasco.us.dev` with seeded US-style
      jobs (HVAC service, kitchen remodel, etc.)

Effort: ~80 hours engineering + ~20 hours QA across 6 EU markets to
make sure existing flows don't regress.

---

## Phase 2 — Payments + comms (3 weeks)

Lets US contractors actually take money + run "On my way" texts.

- [ ] **Stripe US Connect activation** — Stripe webhook already exists
      for UK (`stripe-webhook` edge fn). Extend to US accounts; switch
      based on contractor country
- [ ] **Card + ACH payment links** — Stripe handles both natively
- [ ] **SMS via Twilio** — net-new integration. "On my way" + payment
      reminders. Behind a feature flag; opt-in per contractor
- [ ] **Postcard / email review requests** — already exists via
      `customerCommunicationService`. Audit US copy
- [ ] **State licensing schema** — `business_profiles.licenses jsonb`
      column. UI to enter license #, type, expiry per state. Auto-warn
      30 days before expiry (parallel to existing EU compliance pack
      pattern)

Effort: ~120 hours. Twilio is the new cost line item (~$0.0075/SMS).

---

## Phase 3 — US marketing (1 week)

Once Phase 1 works in demo, ship the marketing site for inbound.

- [ ] **`/us` marketing route** — clone of `/` with en-US copy variant
      in `marketing-content.ts`. Headline pivot per research: "Stop
      losing profit on every job" / "Close more jobs with estimates,
      scheduling & invoicing"
- [ ] **App Store listing en-US** — fastlane already has en-US locale
      scaffolded but copy is currently UK-tuned. Rewrite for US idiom
      per research report Section C
- [ ] **Re-render App Store screenshots in en-US** — pipeline already
      supports per-locale taglines. Add en-US tagline set, render via
      `video/scripts/render-app-store.sh`
- [ ] **AEO landing pages** — 25 pages: top 5 US states × top 5 trades.
      "Best app for [trade] in [state]" pattern. Existing
      `admin/src/app/answers/[slug]` route can host them; generate
      content via the existing AEO pipeline
- [ ] **TikTok/Instagram content pack** — research Section C provides
      10 hook templates; pipe into the existing `video/` Remotion
      compositions

Effort: ~40 hours. Mostly content + copywriting, no new platform code.

---

## Phase 4 — CRM/pipeline (4-6 weeks)

This is the deepest architectural change and the biggest competitive
moat per the research. Defer until Phase 1-3 validate US demand.

- [ ] **Lead entity + table** — new `leads` table, separate from
      `customers` until converted. Status enum: `new` / `contacted` /
      `estimate_sent` / `won` / `lost`
- [ ] **Pipeline Kanban UI** — `app/contractor/pipeline.tsx`. Drag
      between status columns
- [ ] **Lead capture forms** — embeddable widget for contractor's
      website. Inbound leads create rows + push notify
- [ ] **Auto-lead-from-rejected-estimate** — when an Estimate goes
      30+ days without acceptance, downgrade to "lost" lead and prompt
      follow-up
- [ ] **Online booking links** — customer can pick a slot from the
      contractor's calendar (read-only window of availability)

Effort: ~200 hours. Net-new domain model + UI.

---

## Phase 5 — Advanced US features (4+ weeks)

Big-ticket items that depend on Phase 1-4 maturity.

- [ ] **BNPL integration (Affirm or Sunbit)** — partnership + API
      certification. Adds a "finance" button on estimates ≥$500. Heavy
      compliance lift (Truth-in-Lending disclosures, APR display)
- [ ] **TaxJar / Avalara integration** — replaces the static
      `usSalesTax.ts` with live per-zip rate lookup. Required as soon
      as contractors hit multi-state nexus
- [ ] **QuickBooks Online sync** — already 1 of 19 accounting providers
      in repo; needs US-specific account-mapping (sales tax liability
      account, etc.) and OAuth flow
- [ ] **Crew dispatch + GPS tracking** — already partially exists via
      `liveTrackingService`. US dispatch UX (drag-to-tech assignment)
      not yet built
- [ ] **AI office-manager bot** — natural-language commands ("Joe
      needs a roof quote"). Backed by Claude API; minor extension of
      `eveAgentService`

Effort: ~400+ hours.

---

## Phase 6 — Compliance + scale (ongoing)

- [ ] **CCPA + emerging state privacy regs** — existing GDPR consent
      flow needs a "California Resident" variant + opt-out-of-sale link
- [ ] **1099-NEC generation** — when contractors pay subcontractors
      ≥$600/yr. Year-end IRS export
- [ ] **Multi-state nexus tracking** — once contractor crosses
      economic-nexus thresholds, prompt sales-tax registration in the
      new state
- [ ] **PCI compliance audit** — required once we handle live US card
      volume

---

## Key risks (from research report Section F)

1. **Competition** — Housecall Pro, Jobber, ServiceTitan are dominant
   incumbents with massive sales orgs. Differentiation must lean on AI
   (we have ~12 months head start on photo-to-estimate, EVE auto-prep,
   cohort intelligence) and freemium pricing (Free + 3.5%, no
   subscription required)
2. **Feature gap perception** — US pros expect QuickBooks sync + Stripe
   on day one. Phase 1 doesn't include QBO; flag this loudly in the
   waitlist copy until Phase 5
3. **Multi-state sales tax complexity** — TaxJar/Avalara mitigation
   exists but adds ~$50/mo per contractor in API costs at scale.
   Pricing must absorb this
4. **Pen-and-paper habit** — many US solo pros still scribble on a
   notepad. Onboarding must show first invoice sent in <5 min
5. **Regulatory** — BNPL integration triggers state lender-licensing
   requirements; Affirm/Sunbit handle most of this but vetting is real

---

## Decision points for the operator

1. **Lead market**: Texas vs California? Research recommends both;
   Texas has lower licensing friction (no statewide GC license for
   most trades). Recommendation: pilot TX, then expand to CA + FL
2. **Pricing**: stick with EU model (Free + 3.5% / Pro €39+2% /
   Contractor €69+1%) or US-typical ($59-$129/mo subscription)? Research
   suggests US tolerates higher SaaS pricing; recommendation is to
   *price up* in USD (Free + 3.5% / Pro $79+2% / Contractor $149+1%)
   to fund the heavier US CAC
3. **Distribution**: paid (Google + FB) vs partnerships (Home Depot
   Pro, NFIB) vs content (TikTok + AEO)? Research weights toward paid
   + content. Partnerships are slow but free CAC; defer to Phase 5
4. **Brand**: keep "Vasco" universal or sub-brand for US ("Vasco Pro")?
   Recommendation: keep "Vasco" — the brand is generic enough to
   travel

---

## Tracking

Live progress on the foundation phase below. Each Phase 1+ ticket
should become a separate R-round on the production-launch log when
worked.
