# App Privacy & Data Safety — Questionnaire Answers

R66r68 (2026-05-12). Pre-filled answers for:
- **App Store Connect → App Privacy** (Apple's data-disclosure form)
- **Google Play Console → App Content → Data Safety**

Both forms ask roughly the same questions in different shapes. This doc
maps each field to the answer that matches what Vasco actually collects
(per `app.json:expo.ios.privacyManifests` + `src/services/eventTrackingService.ts` +
the consent layer in `src/services/consentService.ts`).

> ⚠️ Verify each answer before clicking "Submit" in the respective form.
> A wrong "Yes" can trigger a delayed App Store review; a wrong "No" can
> trigger a take-down notice later.

---

## App Store Connect → App Privacy

Path: My Apps → Vasco → App Privacy → Get Started.

### Step 1: Does this app collect data?

**Yes** — we collect contact info, financial info, identifiers, usage data,
diagnostics. Continue to detail each category.

### Step 2: Data type categories

For each "Yes" below, click into the type and answer the follow-up
questions consistently (linked-to-identity: Yes, used-for-tracking: No).

| Apple data type | Collected? | Linked? | Tracking? | Purposes |
|---|---|---|---|---|
| **Contact Info** | | | | |
| → Name | Yes | Yes | No | App Functionality, Customer Support |
| → Email Address | Yes | Yes | No | App Functionality, Customer Support |
| → Phone Number | Yes | Yes | No | App Functionality, Customer Support |
| → Physical Address | Yes | Yes | No | App Functionality (invoicing) |
| → Other User Contact Info | No | — | — | — |
| **Health & Fitness** | No | — | — | — |
| **Financial Info** | | | | |
| → Payment Info | No | — | — | — *(we don't store card numbers — Mollie/Stripe holds them)* |
| → Credit Info | No | — | — | — |
| → Other Financial Info | Yes | Yes | No | App Functionality *(invoice amounts, payment status, business revenue figures)* |
| **Location** | No | — | — | — *(we use postcode for address autocomplete only — not device GPS)* |
| **Sensitive Info** | No | — | — | — |
| **Contacts** | No | — | — | — |
| **User Content** | | | | |
| → Emails or Text Messages | No | — | — | — |
| → Photos or Videos | Yes | Yes | No | App Functionality *(job site + invoice scan photos)* |
| → Audio Data | No | — | — | — |
| → Gameplay Content | No | — | — | — |
| → Customer Support | Yes | Yes | No | Customer Support |
| → Other User Content | Yes | Yes | No | App Functionality *(quote/invoice line items, notes)* |
| **Browsing History** | No | — | — | — |
| **Search History** | No | — | — | — |
| **Identifiers** | | | | |
| → User ID | Yes | Yes | No | App Functionality, Analytics |
| → Device ID | No | — | — | — *(we use Expo push tokens, not advertising IDs)* |
| **Purchases** | | | | |
| → Purchase History | Yes | Yes | No | App Functionality *(supplier orders, material purchases)* |
| **Usage Data** | | | | |
| → Product Interaction | Yes | Yes | No | Analytics, Product Personalization |
| → Advertising Data | No | — | — | — |
| → Other Usage Data | No | — | — | — |
| **Diagnostics** | | | | |
| → Crash Data | Yes | Yes | No | App Functionality *(Sentry, opt-out via consent)* |
| → Performance Data | Yes | Yes | No | App Functionality *(Sentry breadcrumbs)* |
| → Other Diagnostic Data | No | — | — | — |
| **Other Data** | No | — | — | — |

### Apple "Tracking" definition

We answer **No** to tracking across all categories because:
- We do NOT use third-party SDKs that link our data to other apps/websites
- We do NOT share data with data brokers
- We do NOT use IDFA / advertising identifiers
- We do NOT show personalized ads (we show no ads)

This is why the iOS app does NOT prompt with AppTrackingTransparency.

---

## Google Play Console → Data Safety

Path: Play Console → Vasco → Policy → App Content → Data Safety.

Same data categories, different naming. Use the table above to fill in,
then answer the cross-cutting questions below.

### Cross-cutting questions

| Question | Answer |
|---|---|
| Is your data encrypted in transit? | **Yes** — HTTPS/TLS 1.3 everywhere, Supabase enforces it |
| Do you have a way for users to request data deletion? | **Yes** — Profile → Legal → Delete my account (GDPR Art. 17, drained via `drain-account-deletions` edge fn) |
| Do you share user data with third parties? | **Yes** — Mollie + Stripe (payment processing), Resend (transactional email), Supabase (data hosting), Sentry (crash reporting, opt-in). All as data processors under DPA. **No** ad networks, no analytics SDKs beyond Sentry. |
| Is your data collection optional? | **Some** — auth + invoicing data is required; Sentry analytics is opt-in via consent banner |
| Is the user notified about data collection? | **Yes** — cookie banner on first launch + Profile → Legal → Privacy Policy |

### Specific data types for Play (mostly maps from Apple table)

Confirm each Yes from the Apple table also marked Yes in Play:
- Personal info: Name, Email, Phone, Address, User ID
- Financial info: Other financial (NO Payment Info / Credit Info)
- Files & docs: Other docs (quotes, invoices), Photos & videos
- App activity: App interactions, Other actions
- App info & performance: Crash logs, Performance diagnostics
- Device or other IDs: **No** (we don't collect advertising ID)

---

## Source mapping

For every "Yes" above, the corresponding code is documented for audit:

| Data type | Where it's collected |
|---|---|
| Email + password | `src/context/AuthContext.tsx:login`, `signup` |
| Phone + address | Customer record (`src/state/AppState.tsx:addCustomer`) |
| Business address + KvK + BTW | `src/state/AppState.tsx:updateBusinessProfile` (business_settings) |
| Photos | `src/services/jobPhotoService.ts`, `src/components/contractor/SignaturePad.tsx`, `src/services/customerPhotoUploadService.ts` |
| Quote/invoice line items | `src/state/AppState.tsx:addQuote`, `addInvoice` |
| Purchase history | `src/services/purchaseOrderService.ts` |
| Product interaction (analytics) | `src/services/eventTrackingService.ts` — gated by `consentService.getConsent('analytics')` |
| Crash data | `src/lib/errorReporting.ts` — lazy-loads `@sentry/react-native` if `EXPO_PUBLIC_SENTRY_DSN` is set and user consented |
| User ID | Supabase `auth.uid()` — server-side, never logged client-side |

## What we explicitly do NOT collect

For Apple's "App does not collect data" attestation on excluded categories:

- **No location services.** `app.json` has no `expo-location` plugin. The
  blocked permissions list explicitly excludes `LOCATION_*` permissions
  on Android. Address fields are typed text, not GPS-derived.
- **No contacts.** No `expo-contacts` import; permission also blocklisted.
- **No browsing/search history** — we don't have a web view layer that
  could collect it.
- **No advertising ID** — no AdMob, no Facebook SDK, no analytics SDK
  that uses IDFA. iOS `infoPlist` declares
  `ITSAppUsesNonExemptEncryption: false` (only standard HTTPS).
- **No health/fitness** data.
- **No microphone audio** captured (we declare `RECORD_AUDIO` on Android
  only for future voice-note features; not used today).

---

## iOS Privacy Manifest mapping

The `expo.ios.privacyManifests` block in `app.json` declares 4 accessed
API categories + 9 collected data types. Each maps to an answer above:

| Privacy Manifest entry | App Store Connect answer |
|---|---|
| `NSPrivacyAccessedAPICategoryUserDefaults` (CA92.1) | Implicit — AsyncStorage uses NSUserDefaults |
| `NSPrivacyAccessedAPICategoryFileTimestamp` (C617.1) | Implicit — expo-file-system reads timestamps |
| `NSPrivacyAccessedAPICategorySystemBootTime` (35F9.1) | Implicit — React Native runtime |
| `NSPrivacyAccessedAPICategoryDiskSpace` (E174.1) | Implicit — used by photo gallery cache |
| `NSPrivacyCollectedDataTypeEmailAddress` | Contact Info → Email ✅ |
| `NSPrivacyCollectedDataTypeName` | Contact Info → Name ✅ |
| `NSPrivacyCollectedDataTypePhoneNumber` | Contact Info → Phone ✅ |
| `NSPrivacyCollectedDataTypePhysicalAddress` | Contact Info → Physical Address ✅ |
| `NSPrivacyCollectedDataTypePurchaseHistory` | Purchases → Purchase History ✅ |
| `NSPrivacyCollectedDataTypePhotosorVideos` | User Content → Photos or Videos ✅ |
| `NSPrivacyCollectedDataTypeCustomerSupport` | User Content → Customer Support ✅ |
| `NSPrivacyCollectedDataTypeUserID` | Identifiers → User ID ✅ |
| `NSPrivacyCollectedDataTypeProductInteraction` | Usage Data → Product Interaction ✅ |
| `NSPrivacyCollectedDataTypeCrashData` | Diagnostics → Crash Data ✅ |
| `NSPrivacyCollectedDataTypePerformanceData` | Diagnostics → Performance Data ✅ |
| `NSPrivacyCollectedDataTypeOtherDiagnosticData` | Diagnostics → Other Diagnostic Data — set to **No** in our manifest |

Verify the manifest list in `app.json` matches the "Yes" rows above before
submission. Apple cross-checks these two.
