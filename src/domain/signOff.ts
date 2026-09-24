/**
 * The customer's sign-off on a job, as an invoice PDF embeds it.
 *
 * Four screens built this by hand; three put `job.customerId` in the signer's
 * NAME slot, so the PDF printed "c-1787349342347" under the customer's
 * signature (sweep 2026-09-23, E1 — the #214 shape). The name comes from the
 * job's customer, then the document's (findDocumentCustomer), never an id.
 */
import { findDocumentCustomer } from './customers';
import { isUuid } from '../lib/idShape';

/** A customer slot holding an id, not a name (uuid, `c-…`, `cust-…`). */
const looksLikeId = (v: string) => isUuid(v) || /^(c|cust)-[\w-]+$/.test(v);

export interface CustomerSignOff {
  svgDataUri: string;
  signedAt: string;
  signerName: string;
}

export function customerSignOffFor(
  job: { signatureSvg?: string | null; customerSignoffAt?: string | null; customerId?: string | null } | null | undefined,
  customers: ReadonlyArray<{ id: string; name: string }>,
  doc?: { customerId?: string | null; customer?: string | null; customerName?: string | null } | null,
): CustomerSignOff | undefined {
  if (!job?.signatureSvg || !job.customerSignoffAt) return undefined;
  const signerName =
    (job.customerId ? customers.find((c) => c.id === job.customerId)?.name : undefined)
    ?? findDocumentCustomer(customers, doc)?.name
    ?? doc?.customerName
    // The customer row may be gone while the document still carries the name
    // (review 2026-09-24) — a NAME, never an id.
    ?? (doc?.customer && !looksLikeId(doc.customer) ? doc.customer : undefined)
    ?? '';
  return { svgDataUri: job.signatureSvg, signedAt: job.customerSignoffAt, signerName };
}
