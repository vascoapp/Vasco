# Embedded lending — research findings

**Status:** research only, nothing designed or built. 2026-08-06.
Companion to `docs/PROTECTED_PAYMENT_PLAN.md`.

---

## 1. The headline: this is an existing product category, not an invention

What I described as "materials financing at job start" already has a name and a
mature European market: **B2B BNPL / digital trade credit**.

Europe is *"the world's most mature B2B BNPL market outside the United
States,"* with specialist providers competing specifically for **platform
integration partnerships**. That is exactly the slot Vasco would occupy.

**Vasco therefore does not need to build lending.** It needs to integrate a
provider at the point of materials purchase and contribute the one thing the
provider cannot get anywhere else: **the underwriting signal**.

### The providers (verified August 2026)

| Provider | Notes |
|---|---|
| **Mondu** (Berlin) | Holds its **own EMI licence** — operates across EU jurisdictions without fronting banks. Already integrated with **Metro AG and Contorion** (tools distribution). Closest adjacency to trades materials. |
| **Billie** (Germany) | Best-capitalised pure-play; **already expanded into the Netherlands**. |
| **Defacto** (France) | API-first, expanded into Germany. |
| Kriya, Playter | Also active. |
| ~~Hokodo~~ | ⚠️ **Ceased operations November 2025.** Do not design around it. |

That last row is why this section exists: the obvious search result is a dead
company.

---

## 2. The regulatory question — and why the design already answers it

The concern was that Vasco's core user is a **ZZP'er (sole trader)**, a natural
person, so credit to them might be *consumer* credit.

**Finding:** in the Wft and EU regulation, **no licensing rules apply to
offering credit to business customers.** The test is **purpose**: a ZZP'er
taking credit for genuinely business purposes is a business borrower; where the
credit serves consumer purposes, the ZZP'er is treated as a **consumer** and the
full Wft consumer-credit regime applies, supervised by AFM.

The penalty for getting this wrong is not trivial — unlicensed consumer-credit
provision carries **fines up to €5,000,000 or imprisonment**.

### 🔑 The design that was chosen for fraud reasons also settles this

Financing **specific materials against an accepted quote, paid directly to the
merchant**, is about as unambiguously business-purpose as credit gets. The money
never reaches the contractor's personal account and is traceable to named goods
for a named job.

A general cash advance to a ZZP'er is the opposite: fungible, and much closer to
the consumer-purpose line. **So the merchant-direct design is not just safer
commercially, it is the version that stays cleanly on the business side of the
regulatory boundary.**

### ⚠️ CCD2 lands 20 November 2026

The revised Consumer Credit Directive (EU 2023/2225) applies from **20 November
2026** — about three months out — and **expands scope** to previously excluded
products including **BNPL and small-value loans**. It remains a *consumer* credit
directive, so business-purpose credit should stay outside it, but anything that
drifts toward consumer purpose gets caught by a tighter regime, imminently.

### Still unverified — do not assume

- **Vasco's own role.** Introducing a borrower to a lender can constitute
  **credit intermediation**. For consumer credit that is itself licensable; for
  business credit it should not be. **This needs a Dutch financial-regulatory
  opinion before anything is designed**, and it is the question most likely to
  add cost.
- Country-by-country treatment beyond NL (DE/FR/ES/IT each differ).
- Whether partners will serve ZZP'ers at all, and at what limits — though the
  fact that B2B BNPL providers already operate in NL/DE suggests they have
  answered this for their own book, and Vasco would inherit their posture.

---

## 3. What Vasco actually brings

A lender underwriting a solo contractor normally sees a bank statement and a
KvK registration. Vasco sees the **chain**:

- **the quote is accepted** — revenue is contracted, not forecast. This is the
  strongest single signal and the app already owns the state.
- **the materials cost** — pricebook, purchase orders, supplier catalogue.
- **completion evidence** — photos, signature, sign-off.
- **payment history per customer** — who pays, and how late.

That is a genuinely differentiated credit file, and it is only assemblable
because the quote→job→invoice chain exists. The chain work is the prerequisite,
not a detour.

**Revenue shape:** commission / referral on financed volume. Vasco provides
signals and distribution; the partner provides capital, collections and the
balance sheet. Lending Vasco's own money means provisioning and default risk —
a different company.

**Second-order benefit:** financing a materials purchase means seeing the
supplier invoice, which feeds `material_price_history`. Lending and the pricing
moat compound.

---

## 4. The catch, stated plainly

This is the strongest long-term moat idea on the table **and the most dependent
on data that does not exist yet**:

- zero users
- zero repayment history
- `material_price_history` currently holds **0 rows**
- cohort benchmarks need **5 distinct contractors** before they show anything

No lending partner will price off Vasco's signals until there is a track record,
and the signals only become valuable at volume. **This is a year-two product.**

It does not change the near-term recommendation — it is a reason the chain and
capture work matters, not a reason to build financing now.

---

## 5. If it is picked up later, the order is

1. Legal opinion on **credit intermediation** by the platform (NL first).
2. Conversation with **Mondu** (tools-distribution adjacency, own EMI licence)
   and **Billie** (already in NL) — what signals would actually move their
   underwriting, and will they serve ZZP'ers.
3. Only then design: merchant-direct disbursement, accepted-quote trigger,
   repayment on invoice settlement.

---

## Sources

- [Europe B2B BNPL report 2026 — GlobeNewswire](https://www.globenewswire.com/news-release/2026/04/30/3284583/28124/en/Europe-B2B-Buy-Now-Pay-Later-Business-and-Investment-Report-2026-Market-Intensifies-as-Billie-Mondu-and-Hokodo-Lead-Fintech-Competition-While-Banks-Accelerate-Digital-Trade-Credit-.html)
- [Best B2B BNPL providers in Europe — Mondu](https://www.mondu.ai/blog/best-b2b-bnpl-providers-europe/)
- [Compare B2B BNPL / trade credit providers — Hokodo](https://www.hokodo.co/resources/compare-b2b-buy-now-pay-later-digital-trade-credit-providers)
- [Kredietverstrekking: leent uw geld zich ervoor? — BDO](https://www.bdo.nl/nl-nl/actueel/kredietverstrekking-leent-uw-geld-zich-ervoor)
- [Vergunning kredietaanbieder — AFM](https://www.afm.nl/nl-nl/sector/kredietaanbieders/1-vergunning-kredietaanbieder---nieuw)
- [CCD2 scope and timetable — LexisNexis](https://www.lexisnexis.com/en-gb/legal/guidance/eu-consumer-credit-directive-ii-essentials)
- [Directive (EU) 2023/2225 — EUR-Lex](https://eur-lex.europa.eu/eli/dir/2023/2225/oj/eng)
