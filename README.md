# Vasco

AI-native admin app for construction trades — plumbers, electricians,
carpenters, painters, and small renovation contractors across NL / DE /
FR / ES / IT / UK. One-tap approve EVE-style AI: prepares quotes, chases
invoices, monitors compliance. You stay in the loop, Vasco does the
typing.

> **Repo state (R66r69, 2026-05-12):** 871 / 871 tests pass · 0 TS
> errors · 8 pending Supabase migrations · branded placeholder icons
> shipped · fastlane scaffolded for iOS + Android · TestFlight blocked
> only on operator-side Apple credentials. See
> [`docs/SHIP-READINESS.md`](./docs/SHIP-READINESS.md) for the single
> source of truth on what's still required to ship.

---

## Architecture at a glance

| Layer | Tech |
|---|---|
| Mobile app | React Native + Expo Router v6 (file-based routing under `app/`) |
| Language | TypeScript, strict mode |
| State | React Context + AsyncStorage persistence + Supabase realtime |
| Backend | Supabase (Postgres + RLS + Edge Functions + pg_cron) |
| Payments | Mollie (EU) + Stripe (UK) |
| AI | Claude Haiku (photo analysis, customer reply classification), 45 in-app generators |
| i18n | i18next, 6 locales (en/nl/de/fr/es/it), ~2500 keys each |
| Theme | DraftKings Sunset Slate — `src/theme/draftkings.ts` |
| Icons | Ionicons |
| Admin dashboard | Next.js 16 + Tailwind v4 in `admin/` (separate Vercel deploy) |

---

## Repo layout

```
.
├── app/                        Expo Router screens (contractor + tabs + modals)
│   ├── (contractor)/           5-tab contractor layout: Vandaag / Werk / Geld / Bedrijf / AI
│   ├── (tabs)/                 4-tab site-lead enterprise layout
│   ├── contractor/             30+ drill-down screens
│   ├── customer/               Anonymous customer portal
│   └── _layout.tsx             Root: auth gates, realtime watchers, push tokens
├── src/
│   ├── intelligence/           Compound AI engine (6 layers, ontology, semantic search, ML)
│   ├── services/               50+ business services (workflowPack, aiActionQueue, signatureService…)
│   ├── integrations/           Mollie + Stripe + accounting providers
│   ├── components/             Shared + contractor + sitelead + dashboards
│   ├── i18n/locales/           6 locale JSONs
│   ├── theme/                  DraftKings tokens
│   └── lib/                    Supabase client, errorReporting (Sentry), idShape, dataProvider
├── admin/                      Admin dashboard (Next.js — separate deploy)
├── supabase/
│   ├── migrations/             Versioned SQL migrations (8 pending push)
│   ├── functions/              21 deployed edge functions
│   └── cron.sql                10 cron schedules (run once with service-role JWT)
├── assets/
│   ├── source/                 SVG sources for icons + feature graphic
│   └── *.png                   Rendered icons (don't edit by hand — run `npm run render:icons`)
├── fastlane/                   App Store + Play Store metadata + screenshots upload
├── .maestro/                   Maestro flows (golden-path smoke + screenshot capture)
├── scripts/                    Operator scripts (preflight, render-icons, sentry-upload, etc.)
└── docs/                       Long-form docs (see "Documentation" below)
```

---

## Key commands

### Development

```bash
npx expo start                    # dev server (any device on same network)
npx expo start --port 8083        # alternate port
npx expo start --ios              # boot iOS simulator
npx tsc --noEmit                  # TypeScript check (app/)
npm test                          # full jest suite (871 tests as of R66r69)
```

### Pre-build sanity

```bash
npm run preflight                 # full preflight: tsc + jest + assets + fastlane + app.json
npm run preflight:quick           # skip jest (faster, used in CI)
```

### Asset generation

```bash
npm run render:icons              # SVG sources → PNG outputs (icon, splash, favicon, feature graphic)
```

### App Store / Play Store upload

```bash
# After eas build --profile production --platform ios:
cd fastlane && bundle exec fastlane ios release     # iOS metadata + screenshots → ASC

# After eas build --profile production --platform android:
cd fastlane && bundle exec fastlane android release # Play metadata + featureGraphic + screenshots
```

### TestFlight

```bash
# Once Apple credentials are exported:
export EXPO_APPLE_ID="you@example.com"
export EXPO_APPLE_TEAM_ID="ABCDEFGHIJ"
export EXPO_ASC_APP_ID="1234567890"
eas login
eas build --profile preview --platform ios
eas submit --profile preview --platform ios
```

Walk-through: [`docs/testflight-checklist.md`](./docs/testflight-checklist.md).

### Sentry sourcemap upload (post-prod-build)

```bash
npm run sentry:upload:ios         # uploads JS bundle + sourcemap to Sentry
npm run sentry:upload:android
```

Setup: [`docs/sentry-setup.md`](./docs/sentry-setup.md).

---

## Documentation

| Doc | When to read |
|---|---|
| [`docs/SHIP-READINESS.md`](./docs/SHIP-READINESS.md) | **Start here.** What's still required to ship to TestFlight + App Store |
| [`docs/testflight-checklist.md`](./docs/testflight-checklist.md) | Exact commands to get a build on your iPhone |
| [`docs/release-runbook.md`](./docs/release-runbook.md) | End-to-end production release process |
| [`docs/asc-api-key.md`](./docs/asc-api-key.md) | Generate App Store Connect API key for fastlane / EAS |
| [`docs/sentry-setup.md`](./docs/sentry-setup.md) | Wire Sentry crash reporting end-to-end |
| [`docs/app-privacy-questionnaire.md`](./docs/app-privacy-questionnaire.md) | Pre-filled answers for ASC App Privacy + Play Data Safety |
| [`docs/app-review-info.md`](./docs/app-review-info.md) | Paste-into-ASC reviewer info form values |
| [`docs/beta-app-description.md`](./docs/beta-app-description.md) | External TestFlight Beta App Review submission text |
| [`docs/store-listings.md`](./docs/store-listings.md) | Store metadata copy in 6 locales (drafts) |
| [`docs/launch-checklist.md`](./docs/launch-checklist.md) | Rolling log of launch-readiness work (history + operator actions) |
| [`docs/supabase-go-live.md`](./docs/supabase-go-live.md) | Supabase project setup (migrations, edge fns, cron, secrets) |
| [`docs/SCHEMA_LOCK.md`](./docs/SCHEMA_LOCK.md) | BE↔FE schema contract (v1.6, locked) |
| [`docs/DORMANT_AUDIT.md`](./docs/DORMANT_AUDIT.md) | Dormant-feature audit log (60+ rounds of hardening) |
| [`docs/ID_COLUMN_MAP.md`](./docs/ID_COLUMN_MAP.md) | Required reading before touching id-keyed code |
| [`LAUNCH.md`](./LAUNCH.md) | Current state snapshot |
| [`CLAUDE.md`](./CLAUDE.md) | Project conventions (read by Claude Code on every session) |

---

## Demo accounts

`EXPO_PUBLIC_DEMO_MODE=true` (set in preview profile by default):

- `contractor@vasco.dev` — solo contractor
- `aannemer@vasco.dev` — renovation GC (multi-trade project mode)
- `site@vasco.dev` — site lead enterprise view
- `new@vasco.dev` — fresh user, exercises onboarding

Any non-empty password works in demo mode.

---

## Contributing

This repo is private to Vasco. Internal conventions:

- TypeScript for all new files
- Use `TYPE` / `RADIUS` / `GRID` constants from `src/theme/tabStyles.ts` — never hardcode font sizes or radii
- Use `SemanticColors` / `DK` tokens from `src/theme/draftkings.ts` — never hardcode hex
- Generator strings use `gt()` from `generatorTranslations.ts` — never hardcode Dutch
- UPPERCASE labels: use `DKLabel` for VoiceOver accessibility
- Drill-down screens: use `DKScreenHeader` for consistent back + title
- Run `npx tsc --noEmit | grep "^app/"` after every change
- Run `npm run preflight:quick` before opening a PR (CI runs it too)

---

## License

Proprietary. © Vasco B.V., Amsterdam, The Netherlands.
