# OTA Updates — Ship JS-Only Fixes for Free

Vasco uses EAS Updates (expo-updates) to push JavaScript-only changes over-the-air to installed TestFlight builds. **JS-only fixes ship for $0**. Native changes ($1.50/build) only happen when truly necessary.

## What's "JS-only"

Ship via `eas update`:
- i18n key changes (`src/i18n/locales/*.json`)
- React component / JSX changes (text, layout, padding, conditional rendering)
- Style fixes (font size, color, border, spacing)
- Service logic, AppState mutations
- Service worker / hook changes
- New screens that don't pull in native modules
- Logic changes in any `.ts` / `.tsx` file under `src/` or `app/`
- Removing or rearranging UI

## What requires a new native build

- Adding or removing npm packages (`npm install`/`uninstall`)
- Changes to `app.json` native config:
  - permissions (`ios.infoPlist`, `android.permissions`)
  - URL schemes / associated domains
  - app icon / splash assets
  - bundle identifier
- New fonts that are loaded at boot via `useFonts`
- EAS env var changes (`EXPO_PUBLIC_*`) — Metro inlines these at build time
- App version bump in `app.json` (`expo.version`)
- Adding new native modules (camera, geolocation, biometrics, etc.)
- iOS entitlements changes (push, Apple Pay, App Groups)

## Cost reality

EAS Starter plan: **$45/month, ~30 builds at ~$1.50 each**. Reset date: 23rd of each month.

| Change | Method | Cost |
|---|---|---|
| Typo in i18n string | `eas update` | $0 |
| 14 bugs across 13 files (R119) | `eas update` | $0 |
| Add new feature with new package | New build | $1.50 |
| Change EAS env var | New build | $1.50 |

## Workflow

### Before every OTA update

```bash
npm run ota:preflight              # full check (~80s, includes tsc)
npm run ota:preflight:fast         # skip tsc, ~1s
```

The preflight catches:
1. TypeScript errors
2. Locale JSONs that don't parse
3. `t('foo.bar', 'fallback')` calls where `foo.bar` is missing from `en.json`
4. Unconditional `SEED_/MOCK_/DEMO_` arrays in `app/` not gated by `DEMO_MODE`
5. `{{variable}}` placeholders in i18n values that don't match the call site's options object

Fail = don't push. Fix and re-run.

### Pushing the update

```bash
# Preview channel first (recommended)
eas update --channel preview --message "R120 — i18n key sweep round 4"

# Promote to production once tested
eas update --channel production --message "R120 — i18n key sweep round 4"
```

Users see the update on next app launch (downloads in the background before the JS bundle runs — if the download or parse fails, falls back to the previous bundle automatically).

### Rolling back

```bash
# List recent updates
eas update:list --channel production --limit 5

# Republish a previous update
eas update:republish --channel production --group <previous-update-group-id>
```

Rollback takes ~30 seconds. Faster than a hotfix build.

## When in doubt

Default to `eas update` first. If something doesn't apply (because it's actually native), `eas update` will publish but the change won't take effect for users — no harm done, just queue a real build for the next iteration.

## runtimeVersion gotcha

`app.json` has `runtimeVersion: { policy: 'appVersion' }`. This means an OTA update only applies to builds with the same `expo.version` (e.g., 1.0.0). If you bump version to 1.1.0, that's a hard cutoff — users on 1.0.0 won't receive 1.1.0 updates. Bump version only when you intentionally want to retire an old build.

## History

- R120 (2026-05-24): OTA workflow documented + `scripts/ota-preflight.mjs` shipped after burning 80% of the monthly Starter quota in one day on per-fix builds. R119's 14-bug batch was the inflection point — all 14 were JS-only and should have been an OTA, not a native build.
