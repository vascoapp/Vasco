# App Store Connect API Key — setup

R66r69 (2026-05-12). Generate a long-lived API key once so fastlane +
EAS submit can authenticate to App Store Connect without an expiring
app-specific password.

Time: ~5 minutes once you have App Store Connect admin access.

---

## Why an API key (not user/password)

| | Username + app-specific password | API Key (.p8) |
|---|---|---|
| Expires | Every 6 months (rotates) | When you revoke it |
| 2FA prompts | Every CLI run on a new machine | Never |
| CI compatible | Painful (needs secret env vars + 2FA workaround) | Native |
| Apple's recommendation | Deprecated for automation | ✅ |

If you're going to run `fastlane release` or `eas submit` from CI, you
**need** the API key — username/password breaks the moment 2FA fires.

---

## Generate the key

1. Go to https://appstoreconnect.apple.com/access/integrations/api
2. Click **+** next to "Active" → **Generate API Key**
3. **Name:** `Vasco — fastlane + EAS automation`
4. **Access:** `App Manager` (full submit power) — not `Admin` (more
   power than you need)
5. Click **Generate**
6. **Download the .p8 file** — Apple only lets you download it ONCE.
   Save to `~/.appstoreconnect/AuthKey_XXXXXXXXXX.p8`
7. Note the **Key ID** (10-char alphanumeric, shown on the page)
8. Note the **Issuer ID** (UUID at the top of the API Keys page —
   different from Team ID)

---

## Wire it into fastlane

Add to your shell rc (`~/.zshrc` or `~/.bashrc`):

```bash
export FASTLANE_API_KEY_PATH="$HOME/.appstoreconnect/AuthKey_XXXXXXXXXX.p8"
export FASTLANE_API_KEY_ID="XXXXXXXXXX"           # the Key ID
export FASTLANE_API_ISSUER_ID="00000000-0000-..."  # the Issuer ID UUID
```

Source the file (`source ~/.zshrc`) and verify:

```bash
cd fastlane && bundle exec fastlane run ensure_xcode_version 2>&1 | head -5
# If it lists your iOS app without prompting for password → key is wired.
```

---

## Wire it into EAS

EAS submit needs separate ASC credentials. Two options:

### Option A — same .p8 file

```bash
eas credentials -p ios
# Pick "App Store Connect: Manage your API Keys"
# → Choose "Add new API Key" → paste path to AuthKey_*.p8 + Key ID + Issuer ID
```

EAS stores it server-side, so future `eas submit` commands work
without env vars.

### Option B — env vars in `eas.json`

Already done in r65 — `eas.json:submit.preview.ios` uses
`$EXPO_APPLE_ID` / `$EXPO_APPLE_TEAM_ID` / `$EXPO_ASC_APP_ID`. EAS prompts
for a password the first time, then caches it. If your Apple account has
2FA on (it should), EAS prompts for the 6-digit code. With Option A
(the API key approach), this prompt goes away.

Recommended: **Option A**. Set up once, run forever.

---

## CI integration

For GitHub Actions, add the secrets:

```yaml
# .github/workflows/release.yml (not yet shipped)
- name: Upload metadata via fastlane
  run: bundle exec fastlane ios metadata
  env:
    APP_STORE_CONNECT_API_KEY_KEY_ID: ${{ secrets.ASC_KEY_ID }}
    APP_STORE_CONNECT_API_KEY_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
    APP_STORE_CONNECT_API_KEY_KEY: ${{ secrets.ASC_PRIVATE_KEY }}  # contents of the .p8 file
    APP_STORE_CONNECT_API_KEY_IN_HOUSE: "false"
```

Repo secrets to add (GitHub → Settings → Secrets → Actions):
- `ASC_KEY_ID` — the 10-char Key ID
- `ASC_ISSUER_ID` — the UUID
- `ASC_PRIVATE_KEY` — paste the entire contents of the .p8 file
  (start with `-----BEGIN PRIVATE KEY-----`, end with `-----END PRIVATE KEY-----`)

---

## Security notes

- **Never commit the .p8 file.** `.gitignore` already excludes `secrets/`
  and `*.p8` — verify before adding to your repo.
- The .p8 can mint App Store Connect tokens. Treat it like a database
  password. Rotate every 12 months.
- If a key leaks, revoke it immediately at the API Keys page; downloads
  + submissions will fail until you generate a new one and update the
  env vars.
- The `App Manager` role can submit + manage versions but cannot manage
  users or change banking info. Don't use an `Admin` key for automation.

---

## Play Console equivalent

For Android, it's a JSON service account key, not a .p8:

1. https://play.google.com/console → Settings → API access
2. Create a new Google Cloud service account named `vasco-fastlane-supply`
3. Grant role `Release Manager` (full Play Console submit power)
4. Download the JSON key → save to `secrets/play-service-account.json`
5. `.gitignore` already excludes `secrets/`

`eas.json:submit.production.android.serviceAccountKeyPath` already
points at this path. `fastlane/Fastfile`'s android lanes also read from
the same path.

CI secret: `GOOGLE_PLAY_JSON_KEY_CONTENT` — paste the entire JSON file
contents.
