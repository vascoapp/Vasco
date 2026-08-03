# Progress billing (termijnfacturen) + retentie — spec

**Status:** implemented (schema + service + tests). UI wiring is the remaining step.
**Schema lock:** bumps SCHEMA_LOCK to v1.12.

## Why

An aannemer running an €80k renovation does not send one €80k invoice. They bill
in instalments — typically 30% at start, 30% at rough-in, 30% at finish, 10% at
oplevering — and the customer withholds **retentie** (commonly 5%) until the
waarborgtermijn expires.

Before this change the app could only issue whole invoices, and
`ProjectMilestone` was `{ title, trade, weekNumber, completed, jobIds }` — a
*schedule* milestone with no amount and no invoice link. An aannemer therefore
could not bill a project with Vasco at all.

## Model

Three concepts, deliberately kept separate:

| concept | what it is | where it lives |
|---|---|---|
| **Milestone** | a point in the schedule ("week 3, rough-in") | `Project.milestones` |
| **Billing term** | an instalment ("30% on rough-in") | `Project.billingTerms` |
| **Invoice** | the document raised for one term | `documents` row |

A term *may* reference a milestone (`milestoneId`) as its trigger, but the two
are not the same list: a project can have five milestones and three terms.

### Retentie is a payment deduction, not a discount

This is the part that is easy to get wrong, and getting it wrong misstates VAT.

Dutch practice: retentie is withheld from **payment**. The invoice is still
issued for the full term amount, and **VAT is charged on the full amount**. The
customer simply pays less now and the remainder later.

So an instalment invoice carries:

- `total_amount` — the term's full value, unchanged. VAT and every e-invoice
  format read this.
- `retention_amount` — how much of it is being withheld.
- *payable now* = `total_amount - retention_amount`, a **derived** figure. It is
  never stored, so it cannot drift from the two values it comes from.

Deducting retention from `total_amount` instead would under-report VAT and
produce an e-invoice whose total disagrees with the contract. The service
enforces the split and the tests pin it.

Retention is released by a final invoice with `is_retention_release = true`,
whose amount is the sum of everything withheld and which withholds nothing
itself.

## Schema

Following the five-file rule (workflow rule #8).

### 1. Domain types

`src/types/project.ts`

```ts
export type BillingTermBasis = 'percent' | 'fixed';
export type BillingTermStatus = 'pending' | 'ready' | 'invoiced' | 'paid';

export interface ProjectBillingTerm {
  id: string;
  title: string;
  basis: BillingTermBasis;
  /** percent of contract value when basis==='percent' (0-100) */
  percent?: number;
  /** absolute amount when basis==='fixed' */
  amount?: number;
  /** optional schedule milestone that triggers this term */
  milestoneId?: string;
  status: BillingTermStatus;
  invoiceId?: string;
  invoicedAt?: string;
  sortOrder: number;
}
```

`Project` gains `billingTerms: ProjectBillingTerm[]` and
`retentionPercent: number` (0 when the contract has no retention).

`src/domain/documents.ts` — `Invoice` gains `projectId`, `billingTermId`,
`retentionAmount`, `isRetentionRelease`.

### 2. Migration

`20260803000001_progress_billing.sql`, additive only:

- `projects.billing_terms jsonb NOT NULL DEFAULT '[]'::jsonb`
- `projects.retention_percent numeric(5,2) NOT NULL DEFAULT 0`
- `documents.project_id uuid REFERENCES projects(id) ON DELETE SET NULL`
- `documents.billing_term_id text`
- `documents.retention_amount numeric(12,2) NOT NULL DEFAULT 0`
- `documents.is_retention_release boolean NOT NULL DEFAULT false`

`documents.project_id` is new: projects carried `invoiceIds` but there was no
invoice→project link, and progress billing needs to walk that direction.

### 3–5. Row type, write mapper, read mapper

`DocumentRow` / `ProjectRow` in `src/lib/database.types.ts`;
`documentRowToInvoice` and the project row hydrate in
`src/lib/mappers.ts` / `AppState`; project patch in the AppState mutator.

## Service — `src/services/progressBillingService.ts`

Pure and synchronous, so it is testable without a database.

- `contractValue(project)` — quoted value, falling back to budget.
- `termAmount(project, term)` — resolves percent or fixed to euros.
- `validateBillingSchedule(project)` — the guard rails:
  - percentages must not exceed 100 (over-billing the contract)
  - fixed amounts must not exceed the contract value
  - retention 0–100
  - no duplicate sort orders
  - a term referencing a missing milestone is an error
- `retentionForTerm(project, term)` — the amount withheld from one instalment.
- `payableNow(project, term)` — the derived figure above.
- `retentionHeld(project, invoices)` — total withheld so far, from real invoice
  rows rather than re-derived from percentages, so a manually adjusted invoice
  is respected.
- `canReleaseRetention(project)` — true only when every non-release term is
  invoiced and the project is complete. Releasing early is the failure mode
  that costs a contractor real money.
- `nextTermToInvoice(project)` — the first `ready`/`pending` term in sort order.

## What is deliberately NOT in this change

- **UI.** No screen yet raises a term invoice. The service and schema land
  first so the UI has something correct to sit on.
- **Automatic term status transitions from milestone completion.** A term goes
  `ready` when its milestone completes, but wiring that to the milestone
  toggle is UI work.
- **Meerwerk (change orders).** Related but separate: a change order alters the
  contract value, which then re-bases every percent term. Doing both at once
  would make the contract-value semantics ambiguous. Next.
