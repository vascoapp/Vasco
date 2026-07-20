// =============================================================================
// ACCOUNTING LOOP SERVICE
// =============================================================================
// Full lifecycle: Quote → Customer Decision → Job → Complete → Invoice →
//                 Payment Link → Payment → Reconcile → Close
//
// Each step triggers the next action + AI learning + accounting sync
// =============================================================================

import { localDateKey, todayKey } from '../utils/dateKey';
import { exportInvoice, syncPaymentStatus } from '../integrations/accounting';
import { createPaymentLink } from '../integrations/mollie';
import type { UnifiedInvoice, UnifiedLineItem } from '../integrations/accounting';
import { MS_PER_DAY } from '../utils/timeConstants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoopStage =
  | 'quote_created'      // Offerte aangemaakt
  | 'quote_sent'         // Offerte verstuurd naar klant
  | 'customer_deciding'  // Klant bekijkt opties (Decision Tracker)
  | 'quote_accepted'     // Klant heeft gekozen
  | 'job_scheduled'      // Klus ingepland
  | 'job_in_progress'    // Bezig met klus
  | 'job_completed'      // Klus afgerond
  | 'invoice_created'    // Factuur aangemaakt
  | 'invoice_sent'       // Factuur verstuurd
  | 'payment_pending'    // Wacht op betaling
  | 'payment_received'   // Betaling ontvangen
  | 'reconciled'         // Afgestemd in boekhouding
  | 'closed';            // Volledig afgesloten

export interface LoopEvent {
  stage: LoopStage;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AccountingLoopState {
  jobId: string;
  customerId: string;
  quoteId?: string;
  invoiceId?: string;
  paymentId?: string;
  moneybirdId?: string;
  currentStage: LoopStage;
  history: LoopEvent[];
  amounts: {
    quoted: number;
    agreed: number;
    invoiced: number;
    paid: number;
  };
}

// ---------------------------------------------------------------------------
// Stage transitions — what's the next logical step
// ---------------------------------------------------------------------------

const NEXT_STAGE: Partial<Record<LoopStage, LoopStage>> = {
  quote_created: 'quote_sent',
  quote_sent: 'customer_deciding',
  customer_deciding: 'quote_accepted',
  quote_accepted: 'job_scheduled',
  job_scheduled: 'job_in_progress',
  job_in_progress: 'job_completed',
  job_completed: 'invoice_created',
  invoice_created: 'invoice_sent',
  invoice_sent: 'payment_pending',
  payment_pending: 'payment_received',
  payment_received: 'reconciled',
  reconciled: 'closed',
};

const STAGE_LABELS: Record<LoopStage, string> = {
  quote_created: 'Offerte aangemaakt',
  quote_sent: 'Offerte verstuurd',
  customer_deciding: 'Klant bekijkt opties',
  quote_accepted: 'Offerte geaccepteerd',
  job_scheduled: 'Klus ingepland',
  job_in_progress: 'Bezig',
  job_completed: 'Afgerond',
  invoice_created: 'Factuur aangemaakt',
  invoice_sent: 'Factuur verstuurd',
  payment_pending: 'Wacht op betaling',
  payment_received: 'Betaald',
  reconciled: 'Afgestemd',
  closed: 'Afgesloten',
};

const STAGE_ACTIONS: Record<LoopStage, string> = {
  quote_created: 'Verstuur offerte',
  quote_sent: 'Wacht op klant',
  customer_deciding: 'Volg op',
  quote_accepted: 'Plan klus in',
  job_scheduled: 'Start klus',
  job_in_progress: 'Rond af',
  job_completed: 'Maak factuur',
  invoice_created: 'Verstuur factuur',
  invoice_sent: 'Stuur betaallink',
  payment_pending: 'Controleer betaling',
  payment_received: 'Stem af in boekhouding',
  reconciled: 'Sluit af',
  closed: '',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getStageLabel(stage: LoopStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function getNextAction(stage: LoopStage): string {
  return STAGE_ACTIONS[stage] ?? '';
}

export function getNextStage(stage: LoopStage): LoopStage | null {
  return NEXT_STAGE[stage] ?? null;
}

export function createLoop(jobId: string, customerId: string, quotedAmount: number): AccountingLoopState {
  return {
    jobId,
    customerId,
    currentStage: 'quote_created',
    history: [{ stage: 'quote_created', timestamp: new Date().toISOString() }],
    amounts: { quoted: quotedAmount, agreed: 0, invoiced: 0, paid: 0 },
  };
}

export function advanceLoop(
  state: AccountingLoopState,
  metadata?: Record<string, any>,
): AccountingLoopState {
  const next = NEXT_STAGE[state.currentStage];
  if (!next) return state;

  return {
    ...state,
    currentStage: next,
    history: [...state.history, { stage: next, timestamp: new Date().toISOString(), metadata }],
  };
}

// ---------------------------------------------------------------------------
// Automated actions per stage transition
// ---------------------------------------------------------------------------

export async function executeStageAction(
  state: AccountingLoopState,
  lineItems?: UnifiedLineItem[],
): Promise<{ success: boolean; updatedState: AccountingLoopState; message: string }> {
  const stage = state.currentStage;

  switch (stage) {
    case 'job_completed': {
      // Auto-create invoice from job data
      if (lineItems && lineItems.length > 0) {
        const invoice: UnifiedInvoice = {
          contactExternalId: state.customerId,
          reference: `INV-${state.jobId}`,
          invoiceDate: todayKey(),
          dueDate: localDateKey(new Date(Date.now() + 14 * MS_PER_DAY)),
          lineItems,
          currency: 'EUR',
          status: 'draft',
          totalExclVat: lineItems.reduce((s, li) => s + li.totalExclVat, 0),
          totalInclVat: lineItems.reduce((s, li) => s + li.totalExclVat * (1 + li.vatRate / 100), 0),
        };

        const exportResult = await exportInvoice(invoice);
        const newState = advanceLoop(state, { moneybirdId: exportResult.externalId });
        return {
          success: exportResult.success,
          updatedState: { ...newState, moneybirdId: exportResult.externalId, invoiceId: `INV-${state.jobId}` },
          message: exportResult.success ? 'Factuur aangemaakt en gesynchroniseerd' : 'Factuur aangemaakt (sync mislukt)',
        };
      }
      return { success: false, updatedState: state, message: 'Geen regelitems voor factuur' };
    }

    case 'invoice_sent': {
      // Auto-create payment link via Mollie
      const link = await createPaymentLink({
        invoiceId: state.invoiceId ?? state.jobId,
        amount: state.amounts.invoiced || state.amounts.agreed || state.amounts.quoted,
        // CUSTOMER-FACING: this is the Mollie payment-page description.
        // Invoice.id IS the document number in this app, so it is fine to
        // show — but jobId is an internal id, so omit rather than fall back.
        description: state.invoiceId ? `Factuur ${state.invoiceId}` : 'Factuur',
      });
      if (link) {
        const newState = advanceLoop(state, { paymentUrl: link.url, paymentLinkId: link.id });
        return {
          success: true,
          updatedState: { ...newState, paymentId: link.id },
          message: `Betaallink aangemaakt: ${link.url}`,
        };
      }
      return { success: false, updatedState: state, message: 'Betaallink aanmaken mislukt' };
    }

    case 'payment_pending': {
      // Check payment status from Mollie via accounting sync
      const { paidInvoiceIds } = await syncPaymentStatus();
      const isPaid = state.moneybirdId ? paidInvoiceIds.includes(state.moneybirdId) : false;
      if (isPaid) {
        const newState = advanceLoop(state, { paidAt: new Date().toISOString() });
        return {
          success: true,
          updatedState: { ...newState, amounts: { ...newState.amounts, paid: newState.amounts.invoiced } },
          message: 'Betaling ontvangen!',
        };
      }
      return { success: true, updatedState: state, message: 'Nog geen betaling ontvangen' };
    }

    default: {
      // Simple stage advance
      const newState = advanceLoop(state);
      return { success: true, updatedState: newState, message: getStageLabel(newState.currentStage) };
    }
  }
}

// ---------------------------------------------------------------------------
// Loop progress calculation
// ---------------------------------------------------------------------------

const ALL_STAGES: LoopStage[] = [
  'quote_created', 'quote_sent', 'customer_deciding', 'quote_accepted',
  'job_scheduled', 'job_in_progress', 'job_completed',
  'invoice_created', 'invoice_sent', 'payment_pending', 'payment_received',
  'reconciled', 'closed',
];

export function getLoopProgress(state: AccountingLoopState): {
  current: number;
  total: number;
  percent: number;
} {
  const idx = ALL_STAGES.indexOf(state.currentStage);
  return {
    current: idx + 1,
    total: ALL_STAGES.length,
    percent: Math.round(((idx + 1) / ALL_STAGES.length) * 100),
  };
}

export function isLoopComplete(state: AccountingLoopState): boolean {
  return state.currentStage === 'closed';
}

export function getTimeSinceLastAction(state: AccountingLoopState): number {
  const last = state.history[state.history.length - 1];
  return Date.now() - new Date(last.timestamp).getTime();
}

export function needsAttention(state: AccountingLoopState): boolean {
  const ms = getTimeSinceLastAction(state);
  const days = ms / MS_PER_DAY;

  switch (state.currentStage) {
    case 'quote_sent':
    case 'customer_deciding':
      return days > 3; // Follow up after 3 days
    case 'payment_pending':
      return days > 7; // Remind after 7 days
    case 'invoice_created':
      return days > 1; // Send within 1 day
    case 'job_completed':
      return days > 2; // Invoice within 2 days
    default:
      return false;
  }
}
