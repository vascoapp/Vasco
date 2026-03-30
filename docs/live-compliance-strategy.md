# Live Compliance Data Strategy

## Problem
`EU5_Compliance_Bible.txt` and `complianceKnowledgeBase.ts` are static files. EU regulations change — VAT rates shift, e-invoicing mandates roll out, certification requirements evolve. A static file goes stale.

## Strategy: 3-Layer Architecture

### Layer 1: Static Baseline (current)
- `src/data/EU5_Compliance_Bible.txt` — human-readable reference
- `src/data/complianceKnowledgeBase.ts` — structured TypeScript extract
- Updated manually when regulations change (quarterly review cycle)
- **This is always the fallback** — app works offline with this data

### Layer 2: Supabase Remote Config (near-term)
Store compliance rules in a Supabase table that the app fetches on launch:

```sql
CREATE TABLE compliance_rules (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  trade TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  mandatory BOOLEAN DEFAULT true,
  law_reference TEXT,
  source_url TEXT,
  evidence_required JSONB DEFAULT '[]',
  expiry_tracked BOOLEAN DEFAULT false,
  renewal_period TEXT,
  penalty TEXT,
  effective_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  version INTEGER DEFAULT 1
);

CREATE TABLE compliance_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT REFERENCES compliance_rules(id),
  change_type TEXT NOT NULL, -- 'new', 'modified', 'deprecated'
  change_summary TEXT NOT NULL,
  effective_date DATE,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_field_requirements (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  field_name TEXT NOT NULL,
  description TEXT NOT NULL,
  mandatory BOOLEAN DEFAULT true,
  vat_only BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**App flow:**
1. On launch, fetch `compliance_rules` where `updated_at > last_sync`
2. Merge with local static data (remote overrides local)
3. Cache locally in AsyncStorage for offline use
4. Show badge if new rules since last viewed

### Layer 3: Supabase Edge Functions + Webhooks (long-term)

**Automated monitoring sources:**
- EUR-Lex API — EU-wide regulatory changes
- National gazette feeds (Staatsblad NL, Bundesgesetzblatt DE, JORF FR, BOE ES, Gazzetta IT)
- GOV.UK legislation feed
- Tax authority RSS/API (Belastingdienst, ELSTER, HMRC MTD)

**Edge function: `compliance-monitor`**
```
Runs daily via cron:
1. Poll regulatory feeds for keywords: "construction", "electrical", "gas", "VAT", "e-invoicing"
2. Use Claude to classify: is this relevant to VascoApp users?
3. If yes → create draft compliance_update row
4. Notify admin dashboard for human review
5. After admin approval → update compliance_rules table
6. Push notification to affected users
```

**Edge function: `vat-rate-checker`**
```
Runs monthly:
1. Query EU VAT rate database (ec.europa.eu/taxation_customs)
2. Compare with stored rates
3. If changed → flag for update
```

### Admin Dashboard Integration
Add a "Compliance Admin" tab:
- View all rules with last-updated dates
- Edit rules directly (CRUD)
- Review AI-suggested updates from edge functions
- Bulk publish updates to app users
- View which users are affected by changes

## Implementation Timeline

| Phase | What | When |
|-------|------|------|
| **Done** | Static Bible + KB file | Now |
| **Next** | Supabase tables + sync on launch | 2-3 weeks |
| **Then** | Admin CRUD for rules | 1-2 weeks |
| **Later** | Edge function monitors | 4-6 weeks |
| **Future** | AI classification of regulatory changes | 8-12 weeks |

## Key Principle
**Static first, live later.** The app must always work with the static KB (offline, no Supabase). Remote data enhances and overrides but never replaces the baseline.
