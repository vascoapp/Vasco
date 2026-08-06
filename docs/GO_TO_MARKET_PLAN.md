# Go-to-market plan

**Written 2026-08-06 from the research in this folder.** Decision-ready, not built.
Companions: `PROTECTED_PAYMENT_PLAN.md`, `EMBEDDED_LENDING_RESEARCH.md`.

---

## The finding that reframes everything

**Vasco is built Dutch-first and priced German.**

| | Netherlands | Germany |
|---|---|---|
| What solo trades pay for software | **€5–14/month** — OutSmart €168/yr, invoicing tools from €5/mo, SnelStart/e-Boekhouden dominant | **€15–120 per user/month**, typically **€20–80**; Hawepro €35–39 |
| E-invoicing B2B mandate | B2G only; B2B indicated ~2030 | **Receive obligation live since Jan 2025, no turnover threshold.** Issue: **2027 >€800k**, **2028 everyone** |
| Incumbents for a solo trade | Moneybird, SnelStart, e-Boekhouden, OutSmart, Rompslomp | Meisterwerk, ToolTime, Plancraft, HERO, sevdesk, Hawepro |
| Vasco's price (€39 Pro / €69 Contractor) | **3–5× the going rate** | **in range** |

Vasco's tiers are priced for the German market. Its AEO content (84 pages) is
aimed at the German mandate. Its one genuinely unsold wedge — an XRechnung
*reader* — solves a German obligation that is **already law**.

The app's Dutch-first surface is a UI fact. The business case is German.

> **Recommendation: Germany is the beachhead, not the Netherlands.**

---

## Why the German wedge is real

Every competitor in the list above is selling to the **2027/2028 issuing**
deadline. That is a future problem a contractor can defer.

**The receive obligation is present-tense and already binding.** Since January
2025 every German B2B business must be able to accept a structured e-invoice,
with **no turnover exemption**. Merchants are already sending them. A
Handwerker receives an XML file today and cannot open it.

Vasco has a working XRechnung/ZUGFeRD reader that turns that file into readable
data — and, uniquely, into pricing data. Nobody is selling to this.

**That's the entry product:** not "run your business on Vasco", but *"you can
open the invoice your supplier just sent you."*

---

## What to stop

- **Do not build the protection product, Mollie Connect, or lending.** All are
  downstream of having users. Lending is explicitly year-two
  (`EMBEDDED_LENDING_RESEARCH.md` §4).
- **Do not wire the tier commission.** It cannot ship (see
  `PROTECTED_PAYMENT_PLAN.md` §7).
- **Do not add features.** The audit found 20k+ lines that reached no screen;
  the constraint is not capability.
- **Do not invest further in the accountant seat.** Its premise was false.

---

## The plan

### Phase 0 — this week, no engineering

1. **Deploy the admin site.** One `vercel login`. 84 AEO pages plus a free
   e-invoice validator, aimed at a legally forced buying event, are sitting
   undeployed. AEO/SEO needs months to index — **every day undeployed is a day
   the clock is not running.** Highest-regret item on the list.
2. **Push and ship what exists.** OTA is behind; migrations are already ahead of
   the client, which is the safe order.
3. **Re-check the pricing tiers against the German comparators** (€20–80). €39
   is defensible there; €69 needs a reason a Handwerker recognises.

### Phase 1 — the wedge, 2–4 weeks

4. **Make the XRechnung reader the front door.** It exists
   (`einvoiceImportService`, entered from `inkoop`). Today it is a feature
   inside an app; it should be the *reason to install*. Landing page →
   validator → "open your supplier's invoice" → account.
5. **The validator is the lead magnet.** It is free, it is already built, and it
   found a bug in itself on day one. Instrument it: how many uploads, how many
   convert.
6. **German-first onboarding path.** Not a translation — the fastest possible
   route from "I got an XML I can't read" to value.

### Phase 2 — one real contractor, weeks 2–6

7. **Get one German Handwerker using it.** Not ten. One who answers the phone.
   Every strategic question left is unanswerable from the repo and answerable in
   a fortnight: do they finish onboarding, does the mandate frighten them, do
   they invoice from it, would they put a protection fee in front of a customer.
8. **Watch, don't ask.** Where do they stop. What do they do outside the app.

### Phase 3 — only after Phase 2 says so

9. Payments as **retention, free to the contractor**; monetise the subscription.
10. Protected payment (Route A, insurance-backed) if contractors will front it.
11. Lending, once repayment and completion history exist.

---

## What would falsify this

- **German contractors won't buy from a foreign unknown.** The trade press,
  wholesaler channels and Innung networks matter there. AEO may bring traffic
  and still not convert.
- **The receive problem is solved by their accountant/DATEV** and never reaches
  the contractor as pain.
- **€39 is too much** even in Germany for a solo Handwerker, whose comparator is
  Hawepro at €35 with local support and references.
- **The Netherlands is right after all** because it's your home market, your
  network, and your language — a real advantage the numbers above don't capture.
  **This is the plan's weakest assumption and you are better placed to judge it
  than I am.**

---

## The honest summary

The product is not short of capability. It is short of **one user and one live
front door**. Everything in this folder is a reason to do the two cheap things
first — deploy the site, get one contractor — and to stop treating strategy
questions as build questions.

## Sources

- NL market/pricing — [Bedrijfssoftwaregids: software installatiebedrijven 2026](https://bedrijfssoftwaregids.nl/blog/software-installatiebedrijven-2026/),
  [OutSmart planningssoftware](https://blog.out-smart.com/outsmart-blog/planningssoftware-installateurs-2026),
  [vergelijk-factuurprogramma.nl](https://www.vergelijk-factuurprogramma.nl/)
- DE market/pricing — [Handwerker-Software Vergleich 2026 (work5)](https://work5.de/blog/handwerker-software-vergleich-2026-beste-programme),
  [handwerker-kosmos Vergleich](https://handwerker-kosmos.de/handwerker-software/vergleich/),
  [Meisterwerk Anbietervergleich](https://blog.meisterwerk.app/handwerksunternehmer/handwerker-software-vergleich-6-anbieter)
- DE mandate dates — [sevdesk: E-Rechnung Pflicht für Handwerker](https://sevdesk.de/ratgeber/buchhaltung-finanzen/rechnungen/e-rechnung/e-rechnung-handwerker/)
