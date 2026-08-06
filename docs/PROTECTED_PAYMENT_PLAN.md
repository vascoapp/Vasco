# Protected Payment — costed plan

**Status:** proposal, nothing built. Written 2026-08-06.
**Supersedes the fee model in** `src/services/paymentMarginService.ts` (see §7).

---

## 1. The idea, in one paragraph

The contractor pays **0%** — payments stay free, which is what actually produces
retention. The **customer** pays a small fee for a real service: their money is
protected until the work is signed off. This is the Vinted structure (selling is
free; the buyer pays a protection fee), and it is chosen because the obvious
alternative — a percentage cut of the contractor's payment — is both
uncompetitive on EU rails and, if ever passed to a consumer, unlawful.

For the contractor this is better than neutral: 0% *and* a trust badge that
helps them win the job against someone quoting on the back of an envelope.

---

## 2. Why this shape, and not a take rate

### The rails are too cheap to skim in the EU

| Method | Mollie's actual cost |
|---|---|
| **iDEAL** (dominant in NL) | **€0.32 flat, no percentage** |
| SEPA Direct Debit | €0.25 + 0.4% |
| Cards | €0.25 + ~1.8% EU |

On a €2,000 invoice paid by iDEAL, processing costs **32 cents**. The current
free-tier model in the codebase would charge **€70**. The contractor's
alternative is to print their IBAN on the invoice — normal practice in NL/DE
trades — so the fee is not defensible.

ServiceTitan's take rate works because US payments are card-based, where 2–3% is
the ambient norm and a platform fee hides inside an expected cost. **That does
not transfer.**

### And a customer-side *payment* surcharge is illegal here

Under PSD2 (in force since Jan 2018):

- **Consumer cards, SEPA credit transfer and SEPA Direct Debit — surcharging is
  banned outright.**
- **iDEAL is not covered by the ban**, but only the **actual cost** may be
  charged (~€0.32). You may charge for the iDEAL *service*, not the underlying
  transfer.
- NL and DE both implemented **partial** bans. ACM enforces in NL.
- The ban is **B2C**; B2B sits outside it and varies by member state.

### Which is exactly why Vinted's fee is not a payment surcharge

Vinted's Buyer Protection fee is a charge for a **service** — refund guarantee,
dispute handling — levied regardless of payment method. That is legally a
different thing from surcharging for the use of a payment instrument.

> **The rule to copy: do not charge for the rails. Charge for a service the
> payer actually wants.**

### The service trades customers actually want

The single biggest consumer fear when hiring a contractor is paying money up
front and the work not happening, or being bad. That is the trades equivalent of
Vinted's buyer risk, and it is why "deposit protection" sells itself.

**Vasco already captures the evidence such a product needs** and nobody else
assembles it: the decision tracker, the customer portal, job photos, completion
evidence, and the customer's signature. The sign-off that releases the money is
a thing the app already records.

---

## 3. Route A — insurance-backed guarantee (no money held)

The contractor keeps being paid directly, exactly as today. At checkout the
customer is offered a guarantee, underwritten by an insurer. Vasco distributes
and earns commission.

**Regulatory position:** no payment-institution licence, because no client money
is ever held. **But insurance distribution is itself regulated** under the IDD —
in NL that means AFM registration as an intermediary (Wft), or operating as a
tied agent / appointed representative of an existing intermediary.

| Item | Estimate | Confidence |
|---|---|---|
| Insurer / MGA partner search + terms | 4–8 weeks elapsed | medium |
| AFM intermediary registration (own) | Wft Basis + product exams, registration fee | **UNVERIFIED — get a quote** |
| Tied-agent route instead (partner holds the licence) | weeks, near-zero capital | medium |
| Engineering (see §5) | ~2–3 weeks | high |
| **Capital requirement** | **none** | high |

**Revenue shape:** commission on premium. The specific % is a negotiation and I
have not verified a market rate — do not model it until an insurer quotes.

**Verdict: this is the short path.** It tests whether customers will pay for
protection at all, without a licence, without capital, and without holding a
cent.

---

## 4. Route B — escrow / split payments (money held until sign-off)

The customer pays into a held balance; funds release to the contractor when the
job is signed off (or auto-release after N days to avoid the contractor being
held hostage).

**This is the higher-value product** — it is closer to the real fear, and it
makes Vasco the settlement layer, which is the "hostages not customers" position
the vertical-software literature keeps pointing at.

**The decisive question, which must be answered before any code:**

> Can **Mollie Connect for Marketplaces** hold and release funds such that
> **Mollie** is the regulated party and Vasco is not holding client money?

Many marketplaces operate this way. If yes, Route B costs weeks, not a licence.
If no, Vasco needs its own permission, and the numbers change completely:

| Own-licence path | Figure | Source |
|---|---|---|
| Payment Institution — own funds | **€125,000** | DNB / market guides |
| E-Money Institution — own funds | €350,000 | as above |
| DNB statutory consideration period | 3 months | DNB |
| Realistic end-to-end | **6–10 months** | market guides |
| Legal/consultancy, AML/compliance officer, audit | six figures, ongoing | **estimate only** |

**Verdict: do not start here.** The capital and the 6–10 months are only worth
it once Route A has proved customers will pay.

---

## 5. Engineering work — what actually changes

### Common to both routes

The existing integration is **"bring your own API key"**: the contractor pastes
their own Mollie/Stripe secret, and Vasco calls the processor *as them*. Money
never touches Vasco. That model cannot carry a platform fee **or** a split.

1. **OAuth / Connect flow** (new). None exists for Mollie or Stripe today —
   OAuth exists only for Moneybird/Xero accounting.
2. **Move payment creation server-side.** With Connect, the refresh token is a
   *platform* credential and must not ship in the app bundle. New edge function;
   the client stops holding processor secrets. This is also strictly better
   security than today.
3. **Second Mollie organisation for testing.** Mollie: *"You cannot charge
   Application fees to the same organization on which you created the OAuth
   application."*
4. **Fee/premium is computed server-side** and shown to the customer before they
   pay, itemised — never bundled silently into the invoice total.

### Route A only
5. Insurer quote call at checkout; store policy reference against the job.
6. Claim trigger = existing completion evidence (photos, signature, sign-off).

### Route B only
5. Split/hold configuration; release on sign-off, with an **auto-release timer**
   so a silent customer cannot strand a contractor's money.
6. Dispute state machine — and a decision about who adjudicates. **This is the
   part that looks small and is not.**

### ⚠️ The e-invoice collision — applies to both

An e-invoice (XRechnung, FatturaPA, Facturae) carries a **payable amount**. If
the customer pays €2,060 against a €2,000 invoice, the payment no longer
reconciles with the filed document — in an app whose entire wedge is *correct*
e-invoicing.

**The protection fee must therefore be a separate transaction between Vasco and
the customer, with its own VAT treatment — never added to the contractor's
invoice total.** This constraint is non-negotiable and shapes the checkout UI.

---

## 6. Sequence

1. **Validate demand before building.** Ask 10 contractors: *would you offer
   your customer a protected payment at no cost to you?* And ideally ask a few
   homeowners what they would pay. Cost: a week, zero engineering.
2. **Confirm the Mollie marketplace question** (§4). One call. It determines
   whether Route B is a quarter or a year.
3. **Route A pilot** in one country (NL) — insurance-backed, no money held.
4. **Route B** only if A shows customers pay.

Meanwhile: **switch the current tier commission off** (§7). It is not shippable.

---

## 7. What to do with the existing fee model

`paymentMarginService.ts` defines Free 3.5% / Pro 2% / Contractor 1%, charged to
the **contractor**. Findings:

- `getCommissionPercent`, `COMMISSION_BY_TIER`, `calculatePaymentFees` and
  `getFeeDisclosure` have **zero callers**. Only the static `VASCO_FEE_DISCLOSURE`
  string renders, in the two connect modals.
- `applicationFee` is a commented-out block in `src/integrations/mollie.ts`.
- The docstring says *"Defaults to free-tier (3%)"* while the constant is **3.5**
  — the disclosure text and the model already disagree.
- On iDEAL the model is ~200× the underlying cost.

**Recommendation: do not wire it.** Replace the disclosure copy with the
protected-payment proposition once §6.1 validates. Keep the file until then, but
it should not be the thing that ships.

---

## 8. What would kill this

- **Contractors refuse to put a fee in front of their customer**, even at 0% to
  them, fearing it costs them the job. §6.1 finds this out for the price of a
  week.
- **Customers do not perceive the risk** at quote time — protection sells when
  the fear is live (large deposit, unknown contractor), and may be a hard sell on
  a €200 callout.
- **Mollie says no** to marketplace holds for this use case → Route B needs
  €125k and 6–10 months, and the plan reduces to Route A alone.
- **B2B customers** get no benefit from consumer-style protection; the product is
  B2C-shaped, which narrows the addressable base to the homeowner segment.

---

## Sources

- PSD2 surcharge ban scope — [Bookwhen](https://support.bookwhen.com/en/articles/1429468-surcharge-ban-under-psd2),
  [Stripe (B2C vs B2B scope)](https://support.stripe.com/questions/scope-of-the-surcharge-ban-under-psd2-for-b2c-and-b2b-payments),
  [Mollie](https://help.mollie.com/hc/en-us/articles/360012564454-Can-I-charge-a-surcharge),
  [ACM](https://www.acm.nl/en/publications/acm-enforces-competition-regard-payment-service-directive-psd2)
- Mollie Connect — [Platforms](https://docs.mollie.com/docs/connect-platforms-getting-started),
  [Marketplaces](https://docs.mollie.com/docs/connect-marketplaces-getting-started),
  [OAuth API](https://docs.mollie.com/reference/oauth-api)
- Mollie pricing — [Finexer breakdown](https://blog.finexer.com/mollie-pricing/),
  [PaymentGatewayCost](https://paymentgatewaycost.com/mollie-pricing/)
- DNB licensing — [Application timeline](https://www.dnb.nl/en/sector-information/open-book-supervision/open-book-supervision-sectors/payment-institutions/licensing-requirement-for-payment-service-providers-overview/application-process-timeline/),
  [Crassula DNB guide](https://crassula.io/guides/licenses/netherlands-dnb/)
- Embedded finance revenue layering — [SaaS Mag](https://www.saasmag.com/embedded-finance-rewriting-saas-unit-economics/),
  [Apideck](https://www.apideck.com/blog/embedded-finance-vertical-saas)
