# Vasco UI Playbook

The rules that govern every screen and component in this repo — `app/**`,
`src/components/**`, and the customer-facing pages in `admin/src/app/**`.

This consolidates what was scattered across `CLAUDE.md`, `memory/draftkings-theme.md`
and hard-won screen-walk findings. It is the doc the md-gate asks for before a
UI edit, and it is meant to be read, not ticked off.

**Active design system: DraftKings Sunset Slate** (since 2026-04-18, R175).
It replaced a light "Wolt-inspired" system. ⚠️ Some older text still describes
the light theme as LOCKED — it is not active. `WarmSemanticColors` remains
exported but nothing should use it.

---

## 1. Tokens — never a raw hex

Import from `src/theme/`. `SemanticColors`, `TYPE`, `RADIUS`, `GRID` and
`PAGE_BG` already point at DK values, so either entry point is correct:

```ts
import { DK } from '../theme/draftkings';          // DK-specific access
import { SemanticColors, TYPE, RADIUS, GRID } from '../theme/tabStyles';
```

| Slot | Value | Use for |
|---|---|---|
| `bg` | `#0B0E11` | page background |
| `panel` / `panel2` / `panel3` | `#14181F` / `#1C2128` / `#242A33` | elevated surfaces |
| `border` | `#2A3038` | hairlines |
| `text` / `textMuted` | `#FFFFFF` / `#9CA3AF` | primary / secondary copy |
| `primaryDark → primary → accent` | `#9A3412 → #C2410C → #F97316` | CTA gradient ramp |
| `highlight` | `#F59E0B` | amber stat callouts |
| `success` / `danger` | `#10B981` / `#EF4444` | semantic only |

**Spacing** is an 8px grid: `GRID.xs=4, sm=8, md=16, lg=24, xl=32`.
**Radii** are soft: `RADIUS.sm=8, md=10, lg=14, xl=18, full=28`.
**Type scale**: display 28 / section 18 / title 16 / body 15 / caption 13 /
label 12 / tiny 11. Display = Archivo (900/800/700/600), body = Inter.

A hardcoded `#fff`, `#000`, `12`, or `borderRadius: 16` is a defect even when it
looks right — a past sweep had to undo 44 light-background and 45 black-text
callsites that each looked fine in isolation.

**Exception, deliberate:** `src/services/*Pdf*.ts`, `invoicePdfService`,
`quotePdfService`, `financialReportService`, `vatPrepExportService`,
`budgetPdfService` keep black-on-white. They render for print. Do not "fix" them.

---

## 2. 🔴 Picking one of N is a MENU, never a chip row

Use `DKMenu` (`src/components/shared/DKMenu.tsx`): an anchor showing the current
choice, opening an iOS-style popover listing every option with a tick on the
selected one.

A horizontal chip strip hides every option past the right edge, never says how
many exist, and reads as a filter rather than a choice.

**Chips are still correct for multi-select filters and toggles** (Alle / Lopend /
Afgerond) — where every option should be visible at once and more than one can
be on. The test: *is the user choosing one thing?* → menu.

`DKMenu` is deliberately a JS popover, not a native `UIMenu`: a native module
would force a native rebuild and take fixes off the OTA channel, and `UIMenu`
does not exist on Android.

---

## 3. Shared primitives — use them, don't re-roll them

| Need | Component |
|---|---|
| UPPERCASE label | `DKLabel` — preserves screen-reader text via `accessibilityLabel` |
| Drill-down header | `DKScreenHeader` — consistent back + title |
| Gradient CTA | `DKButton`, or inline `LinearGradient` with the ramp above |
| One-of-N choice | `DKMenu` |

UPPERCASE styling must never reach the accessibility tree — a screen reader
spelling out "V-A-N-D-A-A-G" is why `DKLabel` exists.

---

## 4. Screen shape (main contractor tabs)

1. Top bar — uppercase title, Archivo 900, 28pt
2. Hero feature card — gradient, status chip, 22pt title, primary CTA
3. Horizontal quick-link chip row
4. Segmented tab strip — `TAB | count` pills, active = solid accent
5. Tab-driven content — only the selected tab renders; no long stacked scrolls
6. FAB or gradient creation CTA

Drill-down screens use `DKScreenHeader` and skip the hero.

---

## 5. Text is data, not chrome

- **Never hardcode Dutch.** Generator strings go through `gt()` from
  `generatorTranslations.ts`; UI strings through `t()`.
- Six locales, key-for-key equal: en/nl/de/fr/es/it. `npm run i18n:audit` must
  report 0 missing, 0 extra.
- UPPERCASE via `t('...').toUpperCase()` — keep the JSON lowercase so other
  contexts can reuse the key.
- **German is `Sie`, not `du`** — including copy addressing the contractor's own
  customer. 138 strings were swept for this once already.
- **Dates and numbers follow `i18n.language`, never the device locale.**
  `toLocaleDateString(undefined)` and `toFixed()` are both defects here.
  `grep "toISOString().split('T')[0]"` — more of these remain.

---

## 6. Nothing fabricated on screen

The recurring, most damaging class of bug in this codebase is a number that
looks computed and is not.

- A quantity identical **with data and with no data** is not computed from the
  contractor's data. That is the tell.
- Do not invent a rate, a permit, a benchmark or a saving to fill a gap. A
  missing figure is better than a wrong one — **fix the claim, not the number.**
- Demo fixtures live behind `DEMO_MODE` (`const X = DEMO_MODE ? DEMO_X : []`),
  never inline. `npm run walk:prod` is what proves none of them reach a real
  build.

---

## 7. Before you build

```bash
python3 scripts/audit-dead-fields.py   # optional fields nothing writes
npm run audit:unmounted                # components no screen reaches
npx tsc --noEmit                       # after every change
npm run walk                           # 79 screens, 6 market postures
npm run walk:prod                      # DEMO_MODE off — the shipping build
```

**Ask where it lives in the nav.** A route with no entry point is dead code;
"where does this go?" is half the work. Group by job-to-be-done, daily tools
top-level, set-and-forget in settings, and gate locale-specific features at the
entry point.

**Check who writes the store.** Grep the mutator (`addX`) across `app/` — zero
call sites means the surface can only ever show fixtures.

---

## 8. Customer-facing web pages (`admin/src/app/**`)

The public landings — `/quote`, `/customer`, `/accept`, `/ref`, `/auth/callback` —
are read by the contractor's **customer**, who does not have the app installed.

- Mirror the DK palette inline (these pages ship without the RN theme module).
- Six languages, chosen from `navigator.language`.
- Currency follows the **contractor's** country, not the reader's browser.
- Every universal-link path claimed in `.well-known/apple-app-site-association`
  must have both an app route **and** a web fallback page here. A claim without
  a fallback is a 404 for everyone without the app — which is most people.
- **One link, not two.** The quote portal (`/quote/[id]?t=`) and the acceptance
  link (`/accept/[token]`) were two capabilities over the same decision: the
  rich one showed line items and could not accept, the other could accept and
  showed nothing. The contractor had to know to send the second. Both accept
  now — `verify-quote-token` hands the holder of a valid signed link an
  acceptance token, looked up before it is minted so viewing twice does not
  create two.
- **A customer decision has to reach the CONTRACTOR.** Accepting wrote to
  `quote_acceptance_links`, and `getAcceptanceStatus()` — the only thing that
  reads it from the contractor's side — has zero callers. The decision landed
  in a table nobody opened. `decide_acceptance_link` now mirrors it onto
  `documents.status`, which every contractor surface already reads. Adding a
  read path would have been the second mistake.
- **Never render a control that isn't wired.** A dead "Accept" button is worse
  than an honest "open in the app to accept" handoff.
  ⚠️ **But that rule expires the day the endpoint lands.** `/accept/[token]`
  sat as a pure deep-link bouncer for months after `decide_acceptance_link`
  existed, because the comment justifying the gap made the page read as
  deliberate rather than blocked. When you write a comment justifying a
  limitation, **name the condition that would reverse it** — "no accept
  endpoint exists" is checkable later, "accepting happens in the app" is not.
  The tell was copy arguing with the UI beneath it: "No account needed",
  directly above two app-store buttons.
- **An irreversible customer action takes two taps**, and the confirm restates
  the amount. A thumb landing on a CTA in a chat app must not commit someone to
  several thousand euros.
- **German is Sie** on these pages too — they address the contractor's own
  client. The 138-string du→Sie sweep covered the app's i18n JSON and never
  reached `admin/`, which is how four of these pages kept saying du for months.
- **Use the market's own trade noun**: vakman / Handwerksbetrieb / artisan /
  profesional / tecnico. "contractor" is not an Italian word and was sitting in
  the Italian copy of two pages.
