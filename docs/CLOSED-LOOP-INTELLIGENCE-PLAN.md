# Closed-Loop Intelligence Plan
**Pooling contractor + site lead + aannemer + worker + customer data into one moat — with a money-saving sourcing wedge**

Author: design proposal
Date: 2026-05-08
Status: Proposal — awaiting decisions on Phase A wedge, sub-on-Vasco %, k-anon thresholds

---

## 0. Why this exists

We have a strong contractor moat. We have a site lead surface. We have an aannemer flag. **Nothing flows between them.** The site lead's defect data sits in AsyncStorage. The aannemer has no distinct entities. The worker's hours never reach the duration predictor. The customer's portal events partially loop back to the contractor only.

This document proposes the closed-loop redesign and lays out a **materials/sourcing-first wedge** that ships value in weeks, not months — focused on saving contractors money on what they buy.

---

## 1. Current state — what closes vs. what doesn't

### ✅ Closed loops (contractor side)
- 8 data channels → `business_events`, `pricing_intelligence`, `material_price_history`, `quote_line_deltas`, `customer_portal_events`, `photo_analyses`, `job_quality_signals`, `customer_payment_patterns`
- Cohort RPCs (k-anon ≥5): `get_trade_pricing_stats`, `get_material_cohort_stats`, `get_postcode_cohort_stats`, `get_photo_analysis_cohort`, `get_quote_engagement`, `get_customer_quality_weight`
- Consumers: TieredQuoteBuilder, AIQuoteFromPhoto (R35), MoatInsightsCard, market-insights, postcodeCohortService

### ❌ Broken / dormant
- **Site lead data is AsyncStorage-only**: `siteLeadDataService.ts` writes to `@vasco_sl_*` keys, never to BE. The 4 site lead generators (crewPerformance, incidentTrend, defectCluster, certRenewalPlanner) only see one device's local data. Three site leads in the same trade get zero cohort benefit.
- **Aannemer has no distinct entities**: `isAannemer: true` is a flag on the contractor user. No `subcontractors`, `change_orders`, `subcontract_performance` tables exist.
- **Worker hours don't feed the predictor**: `job_time_entries` exists, but `predict-duration` only uses contractor estimate-vs-actual, not worker-clocked time.
- **Customer portal events** write to BE but don't reach the cross-contractor cohort consumer (DORMANT_AUDIT.md R6: "Customer A's choice doesn't inform Contractor B's recommendation").

---

## 2. Vision — five closed loops

### Loop A — Site lead defect data → contractor quality moat
Site lead logs `defect(trade, root_cause, weeks_post_handover)` → BE aggregates → solo contractor's quote builder shows: *"Plumbing cohort defect rate: 2.1/100. Top cause: tile-grout. Add this checklist?"*

### Loop B — Contractor outcomes → site lead inspection rigor
Contractor's `job_quality_signals` cross-reference site lead's inspection records on the same job → site lead inspector sees: *"Last 3 'electrical-rough-in' inspections each missed earth-bonding test — checklist now flags this as required."*

### Loop C — Aannemer subcontractor performance → contractor + site lead trust
New `subcontracts` + `subcontract_performance` tables. Subs scored on on-time %, defect rate, RFI response, change-order ratio, paid-on-time. Aannemer sees relative cohort scores when picking subs. Solo plumber receiving a subcontract sees the aannemer's overall sub portfolio quality.

### Loop D — Worker hours → duration predictor for all roles
Wire `job_time_entries` into the duration moat → solo contractor's quote duration improves, site lead's manpower-vs-progress reading improves, aannemer's Gantt forecast improves.

### Loop E — Customer portal → cross-role recommendations
Customer choices feed cohort regional preferences (already R303). Cross-role: site lead's inspection focus shifts based on what customers chose; aannemer's sub-trust score factors in customer review of work that sub did.

---

## 3. The materials/sourcing money-saving wedge

**Start here.** This is the highest-leverage, fastest-to-ship part of the closed loop because materials are 30-55% of every job's cost and pricing data already lives in `material_price_history`. The infrastructure is there — the consumers and real-time inputs aren't.

### 3.1 Two distinct contractor archetypes

| Archetype | What they buy | Where they buy | Volume | Price sensitivity |
|---|---|---|---|---|
| **Solo / SMB contractor** | SKU items: 22mm copper pipe, 16A breaker, KG of grout | Wholesalers (Technische Unie, Klöckner, Würth) + retail (Hornbach, Praxis) | per-job qty (€500-€5k orders) | Catalog price + occasional discount |
| **CRE aannemer** | Raw materials: m³ concrete, ton steel rebar, m² insulation board | Bulk distributors (Saint-Gobain Distribution, Heijmans Materieel, Jongeneel) + direct from manufacturer | per-project qty (€50k-€500k orders) | Framework agreement + commodity-indexed pricing |

The solo contractor saves money via **better catalog choice** (cheaper supplier for same SKU). The CRE aannemer saves money via **better timing + framework terms** (commodity hedging, volume discount tiers, forward contracts).

The intelligence has to span both. Today the system is biased toward the SMB use case (`material_catalog`, DATANORM importers, supplier price scrape). It misses the commercial layer entirely.

### 3.2 Where money is saved — 9 levers

| # | Lever | Mechanism | Solo SMB | CRE aannemer |
|---|---|---|---|---|
| 1 | **Supplier choice** | Cheapest reliable supplier per SKU/material × region | ✓ already built (R5/R290) | ⚠ extend to bulk-distributor relationships |
| 2 | **Bulk discount tier** | "Order +20% to hit next tier" | ❌ not modeled | ✓ critical |
| 3 | **Timing** | Delay/accelerate purchase based on commodity index forecast | ❌ no real-time inputs | ✓ critical |
| 4 | **Substitution** | Cheaper material meeting same spec (e.g. PVC vs. copper for waste lines) | ⚠ partial via cohort | ✓ critical (BENG/insulation choices) |
| 5 | **Quantity prediction** | Avoid over-ordering; predict from job photo + cohort | ⚠ via AIQuoteFromPhoto cohort | ✓ critical for waste |
| 6 | **Surplus return** | Track returnable surplus, claim refund | ❌ not modeled | ⚠ partial |
| 7 | **Payment timing** | 2% discount for 7-day payment vs. net-30 | ❌ not modeled | ✓ standard practice |
| 8 | **Group buying** | Multiple Vasco contractors pool an order | ❌ no infra | ⚠ aannemer-led for project subs |
| 9 | **Forecast hedging** | Pre-order before predicted price hike | ❌ no inputs | ✓ critical for steel/copper |

**Today's coverage**: 1 + parts of 4 + parts of 5. **Six levers untouched.**

### 3.3 Real-time price inputs to integrate

Without external feeds, the moat learns from contractor purchases only — which means it's always 1-2 weeks behind market moves. To save money proactively (not just diagnose past spend), Vasco needs **live commodity + supplier signals**.

#### Tier 1 — Free/cheap public feeds (start here)
| Feed | What it tracks | Value | Update freq |
|---|---|---|---|
| **CBS Bouwmaterialen-prijsindex** (NL) | Aggregate construction material price index per category | Macro-trend signal: "steel up 4% MoM" | Monthly |
| **ECB exchange rates** | EUR/GBP/CHF/PLN | UK aannemer importing EU steel sees real costs | Daily |
| **Dutch TTF gas spot** (ICE) | NL gas price | Cement, ceramics, steel, glass prices respond | Hourly |
| **EPEX SPOT power** | NL/DE electricity day-ahead | Aluminum, copper smelter cost driver | Hourly |
| **Eurostat PPI** | Producer Price Index for "manufacture of fabricated metal products" | Lagged but free baseline | Monthly |

#### Tier 2 — Paid/licensed (next phase)
| Feed | What it tracks | Cost band | Use case |
|---|---|---|---|
| **LME** (London Metal Exchange) | Copper, aluminum, zinc, lead, nickel spot + 3M futures | $5-50k/yr | CRE aannemer hedging steel rebar, copper pipe |
| **ICIS** (Independent Commodity Intelligence Services) | PVC, PE, PP, polymer spot + contract | $$$ | Insulation, piping, composite materials |
| **Random Lengths / EUWID** | Lumber + panels + paper | $$ | Carpentry, cabinetry, structural wood |
| **Argus / Platts** | Bitumen, asphalt, roofing materials | $$$ | Roofing aannemer |
| **CRU Steel** | Rebar, structural steel, sheet | $$$ | Structural concrete reinforcement |

#### Tier 3 — Supplier APIs (per-supplier integration)
- Wholesaler APIs (Technische Unie, Würth, Klöckner) — real-time stock + price + lead time
- DATANORM standard already supported — extends to live API where supplier offers
- Direct manufacturer APIs (Saint-Gobain, Knauf, Rockwool, ROCKWOOL ISOVER) for CRE aannemer framework pricing

### 3.4 Schema additions for sourcing intelligence

Six new tables/columns built on top of the existing `material_price_history`:

#### A. `commodity_index_snapshots` (new)
Time-series of public + paid commodity feeds.
```sql
create table commodity_index_snapshots (
  id uuid primary key default gen_random_uuid(),
  feed_source text,                  -- 'cbs','lme','ttf','epex','icis_pvc','eustat_ppi'
  commodity_code text,               -- 'steel_rebar','copper_cu','pvc_polymer','gas_ttf','power_nl'
  unit text,                         -- 'EUR/ton', 'EUR/MWh', 'index_pts'
  value numeric,
  observed_at timestamptz,
  region text,                       -- 'NL','DE','EU','LME-ALL'
  created_at timestamptz default now()
);
create index idx_cis_feed_time on commodity_index_snapshots(feed_source, commodity_code, observed_at desc);
```
Populated by a daily cron edge function (`pull-commodity-feeds`).

#### B. `material_commodity_links` (new)
Maps materials in `material_catalog` to which commodity indexes drive their price.
```sql
create table material_commodity_links (
  material_id uuid references material_catalog(id),
  commodity_code text,
  weight numeric,                    -- 0.0-1.0 — how much this commodity drives the material's price
  -- e.g. 22mm copper pipe: copper_cu weight 0.85, energy_cost weight 0.10, freight 0.05
  primary key (material_id, commodity_code)
);
```
Seeded by trade expert (Vasco team) for top-200 materials; learned from data over time.

#### C. `supplier_quotes` (new)
RFQ workflow for CRE aannemer + group-buying for SMB.
```sql
create table supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),     -- contractor / aannemer who issued the RFQ
  project_id uuid,                             -- optional — bulk per-project
  material_id uuid references material_catalog(id),
  supplier_id uuid references suppliers(id),
  quantity numeric,
  unit text,
  quoted_price_excl_vat numeric,
  quoted_lead_time_days int,
  valid_until timestamptz,
  framework_agreement_id uuid,                 -- optional link to a long-term agreement
  status text,                                 -- 'requested','received','accepted','rejected','expired'
  rfq_sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz default now()
);
```

#### D. `framework_agreements` (new — CRE aannemer focus)
Long-term supply contracts.
```sql
create table framework_agreements (
  id uuid primary key default gen_random_uuid(),
  aannemer_user_id uuid references auth.users(id),
  supplier_id uuid references suppliers(id),
  contract_name text,
  start_date date,
  end_date date,
  pricing_model text,                          -- 'fixed','indexed','tiered'
  index_basis text,                            -- when 'indexed': commodity_code from material_commodity_links
  index_premium_pct numeric,                   -- e.g. LME copper + 12%
  tier_breaks jsonb,                           -- when 'tiered': [{minQty: 0, pricePerUnit: 4.50}, ...]
  payment_terms_days int,
  early_payment_discount_pct numeric,          -- e.g. 2% for 7-day pay
  attachments_url text,
  created_at timestamptz default now()
);
```

#### E. `surplus_returns` (new)
Track returnable surplus + actual refunds.
```sql
create table surplus_returns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  job_id text,
  material_id uuid references material_catalog(id),
  ordered_qty numeric,
  used_qty numeric,
  returned_qty numeric,
  refund_amount numeric,
  return_window_expires timestamptz,
  status text,                                 -- 'pending','returned','refunded','expired'
  created_at timestamptz default now()
);
```

#### F. Extend `material_catalog`
Add columns for substitution + spec hashing:
```sql
alter table material_catalog
  add column spec_hash text,                   -- hash of regulatory specs ('R-value 2.5', 'CE-marking')
  add column substitutable_with uuid[],        -- list of equivalent material_ids
  add column raw_material_intensity jsonb;     -- {steel_kg: 2.4, copper_kg: 0, ...} for traceable cost
```

### 3.5 Cohort RPCs for sourcing intelligence

Eight new RPCs (all k-anon ≥5):

| RPC | Returns | Where used |
|---|---|---|
| `get_material_price_forecast(material_id, horizon_days)` | 30/60/90-day forecast based on commodity-link weights × commodity_index_snapshots | TieredQuoteBuilder hint, inkoop tab "Buy now or wait?" |
| `get_supplier_price_distribution(material_id, country)` | p25/median/p75 per supplier — solo contractor sees "Hornbach is 18% above cohort median" | inkoop, AddJobMaterialModal |
| `get_volume_discount_curve(material_id, supplier_id)` | Tier breaks observed across cohort RFQs | inkoop "order +20% to hit next tier saves €X" |
| `get_substitution_savings(material_id, country)` | List of cohort-validated cheaper substitutes meeting same spec_hash | quote builder "Switch to PE for 30% saving — same spec" |
| `get_optimal_order_window(material_id, urgency)` | Best 7-day window in next 30 days based on forecast + lead time | Vandaag morning briefing nudge |
| `get_framework_agreement_benchmark(material_id, country)` | Median framework price vs spot — tells aannemer if their framework is competitive | aannemer profile + project startup |
| `get_surplus_return_rate(material_id, trade)` | Cohort % of returnable surplus actually returned + average refund | New "claim your surplus" workflow |
| `get_group_buy_opportunity(material_id, region, qty)` | When N other contractors in postcode have the same need within 14 days | inkoop "join group order — save 12%" |

### 3.6 UI surfaces — where the savings show up

#### Solo contractor surfaces
1. **Inkoop tab top banner**: *"You'd save €847/month by switching 3 frequent buys to cohort-cheaper suppliers"* — tap to see the 3.
2. **AddJobMaterialModal price input**: when contractor types unit price, compare to cohort distribution. *"This is in p90 — cohort p50 is €18.50. Try [supplier]"*. (R279 partially built this; needs price-distribution RPC).
3. **Quote builder — substitution row**: per line item with substitutable spec_hash, surface 1 cohort-validated alternative. *"PE waste pipe — same NEN-EN 1453 spec, 30% cheaper"*.
4. **Vandaag morning briefing**: *"Steel rebar forecast +6% next 14 days. Pre-order Pieter's project rebar now to save €1,200"*.
5. **Job photos → AIQuoteFromPhoto**: extend the existing R35 cohort panel with **predicted-purchase-cost** alongside hours/cost — uses the new `get_material_price_forecast`.

#### CRE aannemer surfaces
1. **Project budget — commodity exposure**: *"This project has €120k of steel-indexed materials. LME-Cu is +4% MoM — projected cost +€4,800. Hedge advice: lock now."*
2. **Framework agreement dashboard**: per agreement, real-time vs. cohort + spot. *"Your concrete framework: €92/m³. Cohort median: €87. Renegotiate?"*
3. **RFQ workflow**: invite 3 suppliers per material, level bids, award. Auto-evaluates against `supplier_quotes` cohort.
4. **Surplus tracking dashboard**: *"You have €4,800 of returnable surplus expiring in 14 days across 3 suppliers"*.
5. **Group-buy invitations**: when an aannemer's project ships need overlaps with 5+ others, surface a group order option.

### 3.7 Cohort threshold strategy for early NL launch

Per the existing pattern (R303 RegionalPreferencePanel): **show cohort data only when k-anon ≥5**, fall back to local-history-only or sub-cohort widening when not met.

For NL bootstrap (low contractor density per trade × postcode in week 1):
1. Start cohort buckets at **trade × country** level (not postcode)
2. Promote to **trade × city-region** once 30+ contractors per trade × country
3. Promote to **trade × postcode-3** once 80+ per trade × city-region
4. Below threshold: show "your-history-only" with explicit label *"Showing your data only — cohort threshold not met yet"*

The same fallback that R303 uses for regional preferences applies here.

---

## 4. Phasing — sourcing wedge first

### Phase A — Sourcing wedge (4-6 weeks) ⭐ START HERE

**Goal**: ship measurable monthly savings for a real solo contractor by week 4.

#### A.1 — Real-time public feeds (week 1)
- New `commodity_index_snapshots` table
- Edge function `pull-commodity-feeds` (daily cron) — fetches CBS, ECB, TTF, EPEX
- New `material_commodity_links` seeded for top-50 materials (manual seed by Vasco trade team)

#### A.2 — Sourcing cohort RPCs (week 2)
- `get_material_price_forecast` (commodity-link math)
- `get_supplier_price_distribution`
- `get_substitution_savings`
- `get_optimal_order_window`

#### A.3 — Solo contractor savings surfaces (week 3)
- Inkoop tab top banner (3-supplier switch)
- AddJobMaterialModal price-distribution comparison
- Vandaag morning briefing pre-order nudge

#### A.4 — Photo-to-procurement (week 4)
- Extend AIQuoteFromPhoto cohort panel (R35) with predicted-purchase-cost row
- Auto-create draft RFQ from detected materials

**Phase A ships value to existing solo contractor users without any aannemer/site-lead schema work.**

### Phase B — Aannemer commercial layer (6-8 weeks)
- New `framework_agreements`, `supplier_quotes` tables
- RFQ workflow UI (CRE aannemer)
- Framework dashboard (vs. spot vs. cohort)
- LME/ICIS Tier 2 integration (paid feeds)
- `surplus_returns` tracking + claim workflow
- Group-buy opportunity surface

### Phase C — Cross-role + site lead (4-6 weeks)
- Site lead `site_quality_signals` to BE (Loop A + B)
- Subcontractor + change-order entities (Loop C)
- Worker-hours into duration predictor (Loop D)
- Customer-portal events into all roles (Loop E)

### Phase D — Procore-class collaboration (8-12 weeks)
- RFIs, submittals, drawings, lookahead schedule
- Closeout package automation
- Multi-party messaging

---

## 5. Open decisions

Lock these before any code:

1. **Phase A wedge approval** — start with sourcing intelligence (vs. site lead lift, vs. Procore RFI/submittal). I recommend sourcing because it's the highest data-to-savings ratio and contractor sees money in pocket within weeks.
2. **Free vs. paid commodity feeds for v1** — Tier 1 (free CBS + ECB + TTF + EPEX + Eurostat) gets us 80% of the signal. Tier 2 (LME + ICIS + CRU) costs $20-100k/yr and unlocks the CRE aannemer use case. **Recommendation**: Tier 1 in Phase A, Tier 2 as part of Phase B (CRE aannemer).
3. **Trade-team seed effort** — `material_commodity_links` needs human seeding for the top 50-100 materials. Estimate: 1 week of trade-expert time. Worth it (the math is otherwise blind).
4. **Group-buy infra** — does the Phase A scope include any group-buy mechanism, or only signal ("5 others in your postcode need this")? Recommendation: signal-only in Phase A, full group-buy aggregation in Phase B.
5. **CRE aannemer profile flag** — currently `isAannemer: true` is binary. CRE vs. small-residential aannemer is a real spectrum. Add `aannemer_tier: 'small_residential' | 'cre'` to the user profile so we can surface different RFP/framework UI per tier.
6. **K-anon thresholds for sourcing** — same ≥5 floor as the rest of the moat? Or relax for top-50 SKUs where data density is high? Recommendation: ≥5 universally for transparency.

---

## 6. Why this works as a strategy

The materials-first wedge is the right starting point because:

- **Money-saving is measurable** — contractors track their material spend; saving 8% on €4k/month = €320/month, easily attributable to the app.
- **Data already exists** — `material_price_history` has 6+ months of data; we don't need to wait for new schema to fill before consumers fire.
- **Cohort effect is immediate** — even 5 contractors in a trade × country generate meaningful price-distribution data on the day they start using inkoop.
- **CRE aannemer lift is incremental** — Phase B builds on Phase A's commodity feeds and adds the framework + RFQ layer; no foundational rework.
- **Site lead + worker + customer loops follow naturally** — once the closed-loop pattern (write to BE moat → cohort RPC → cross-role consumer) is established for sourcing, the same pattern repeats for defects, time entries, and customer choices in Phase C.

The end state: a contractor opening Vasco sees not just *"your invoice is overdue"* but *"steel is up 4% next week — pre-order Pieter's project rebar today, save €1,200; your KOR-tier wholesaler bills 22% above cohort, switch saves €340/month; 3 other contractors in 1015XX need 22mm copper this week — group order saves 12%."*

That's the moat customers can't get from QuickBooks, can't get from Procore, and can't get from any single-supplier loyalty app.

---

## Appendix — file locations referenced

- `src/intelligence/dataCollector.ts` — event emission + offline queue
- `src/intelligence/cloudSync.ts` — AsyncStorage ↔ Supabase
- `src/services/cohortBenchmarkService.ts` — existing cohort hooks
- `src/services/siteLeadDataService.ts` — local-only site lead data (lift target)
- `src/services/postcodeCohortService.ts` — postcode-level cohort
- `src/services/intelligenceCaptureService.ts` — write-side helpers
- `supabase/migrations/002_ai_moat_infrastructure.sql` — base moat schema
- `supabase/migrations/20260421000001_cohort_moat_fix.sql` — cohort RPC fixes
- `supabase/migrations/20260421000002_moat_enrichment.sql` — moat enrichment patterns
- `docs/intelligence.md` — current 45-generator architecture
- `docs/DORMANT_AUDIT.md` — known dormancies (R6 cross-contractor learning, R34 fake sample sizes)
