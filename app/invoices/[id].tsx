// =============================================================================
// INVOICE DETAIL — Pro-grade, fully editable invoice view
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { DK } from '../../src/theme/draftkings';
import { SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { recordHandover, channelForCountry } from '../../src/services/submissionStore';
import { hapticError, hapticSuccess } from '../../src/utils/haptics';
import { generateInvoicePdf, buildInvoicePdfBase64 } from '../../src/services/invoicePdfService';
import { invoiceAutomationService } from '../../src/services/invoiceAutomationService';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../src/config/paymentMethods';
import { formatCurrency, formatDate, formatDateShort, formatDayMonth } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';
import {
  getCustomerPaymentPreference,
  getPaymentMethodLabel,
} from '../../src/services/customerPaymentPreferenceService';
import { sendInvoice as sendInvoiceEmail } from '../../src/services/sendInvoiceService';
import { effectiveStep, renderReminder } from '../../src/services/reminderCadenceService';
import { computeLateFee, disclosureLineLocalized, type LateFeeCountry } from '../../src/services/lateFeeService';
import { generateXRechnungXML, generateZUGFeRDXML, type EInvoiceData } from '../../src/integrations/einvoice';
import { Share as RNShare } from 'react-native';
// react-native's Share ignores `url` on Android (message/title only), so the
// e-invoice XML exports below silently shared nothing there — and because it
// resolves rather than throws, the plain-text catch never fired. expo-sharing
// is the cross-platform file share, and is what the PDF services already use.
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { checkInvoiceReadiness } from '../../src/utils/businessProfileValidation';
import { getEffectiveVatRate } from '../../src/domain/business';
import { useCohortDso } from '../../src/services/paymentTimingMoatService';
import { predictPaymentTiming } from '../../src/intelligence/mlModels';
import { useTimeOfDayPaymentHint, dayPart as paymentDayPart, classifyPaymentNow } from '../../src/services/timeOfDayPaymentService';
import { findDocumentCustomer } from '../../src/domain/customers';
import { wasShareDismissed } from '../../src/utils/shareOutcome';

type IconName = keyof typeof Ionicons.glyphMap;

interface EditableLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const VAT_RATE = 0.21;

// Status badge colors
const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return SemanticColors.feedbackSuccess;
    case 'sent': return SemanticColors.feedbackInfo;
    case 'overdue': return SemanticColors.feedbackError;
    case 'draft': return SemanticColors.textTertiary;
    default: return SemanticColors.textTertiary;
  }
};

const getStatusBg = (status: string) => {
  switch (status) {
    case 'paid': return SemanticColors.feedbackSuccess + '15';
    case 'sent': return SemanticColors.feedbackInfo + '15';
    case 'overdue': return SemanticColors.feedbackError + '15';
    case 'draft': return SemanticColors.surfaceSecondary;
    default: return SemanticColors.surfaceSecondary;
  }
};

export default function InvoiceDetailScreen() {
  const { t } = useTranslation();
  const { id, submit } = useLocalSearchParams<{ id: string; submit?: string }>();
  const router = useRouter();
  const {
    invoices,
    updateInvoice,
    markInvoicePaid,
    markInvoiceSent,
    moneybirdConnected,
    exportInvoice,
    lastMoneybirdExport,
    mollieConnected,
    createPaymentLink,
    lastMolliePayment,
    businessProfile,
    lineItems: appLineItems,
    jobs,
    customers,
    markEInvoiceSubmitted,
  } = useAppState();
  const { user } = useAuth();
  const invoice = invoices.find((item) => item.id === id);
  // The customer RECORD, not the display string on the invoice. Every
  // structured e-invoice needs the buyer's city, post code and tax id as
  // separate elements, and `invoice.customer` is a name. Matched on
  // customerId, falling back to the name because older invoices carry only
  // that (`documentRowToInvoice` maps `customer` from customer_id).
  const invoiceCustomer = findDocumentCustomer(customers, invoice);
  // What a HUMAN should read wherever this invoice names its customer. The
  // `customer` field is a name on seeded rows and on anything created after
  // R2026-08-22, but an id on invoices converted from R13.2-era quotes — and
  // both the header title and the customer card rendered it raw, so this
  // screen was headed "RECHNUNG C-1787349342347".
  const invoiceCustomerName = invoiceCustomer?.name ?? invoice?.customer ?? '';
  const country = user?.country ?? 'NL';
  // Country/scheme-aware VAT rate (honors DE 19%, FR 20%, KOR/Kleinunternehmer
  // 0%, etc.). Falls back to the NL VAT_RATE only when no profile is loaded.
  // Was hardcoded 21% everywhere — wrong tax on every non-NL invoice + export.
  const effectiveRate = businessProfile ? getEffectiveVatRate(businessProfile) / 100 : VAT_RATE;
  const paymentMethods = getPaymentDisplayForCountry(country);
  // R214: cohort-backed payment timing for the invoice detail caption.
  // Hook unconditionally; consumer below is null-safe.
  const cohortDso = useCohortDso(businessProfile?.country ?? country, null);
  const { hint: paymentTimingHint, buckets: paymentTimingBuckets } = useTimeOfDayPaymentHint(
    (user as any)?.trade ?? (businessProfile as any)?.trade,
    businessProfile?.country ?? country,
  );
  const [paymentPrediction, setPaymentPrediction] = useState<{ days: number; confidence: number } | null>(null);
  useEffect(() => {
    if (!invoice || invoice.status === 'paid') return;
    let cancelled = false;
    predictPaymentTiming({
      amount: invoice.amount,
      country: businessProfile?.country ?? country,
      customerId: invoice.customerId,
    }).then(p => {
      if (!cancelled && p) setPaymentPrediction({ days: p.predictedDays, confidence: p.confidence });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [invoice?.id, invoice?.amount, invoice?.status, businessProfile?.country, country]);

  // Editable state — R66 round 13: editingCustomer/customerName removed
  // along with the broken inline rename feature.
  const [editingItems, setEditingItems] = useState(false);
  const [localItems, setLocalItems] = useState<EditableLineItem[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  // Customer preference
  const [customerPreference, setCustomerPreference] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      // R66 round 13: notes is now a real Invoice field — no `as any` cast.
      setNotes(invoice.notes ?? '');
      getCustomerPaymentPreference(invoice.id).then(setCustomerPreference);
      // Build line items from appLineItems or synthesize from amount
      const existing = appLineItems[invoice.id];
      if (existing && existing.length > 0) {
        setLocalItems(existing.map((li, idx) => ({
          id: li.id || `item-${idx}`,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })));
      } else {
        // Synthesize a single line item from total. Same NL-constant bug as
        // handleSaveItems: an invoice whose amount is gross at 19% was split
        // back out at 21%, so the one line on a German invoice read low and
        // the totals below it no longer matched the amount.
        setLocalItems([{
          id: 'item-1',
          description: invoice.job || t('invoices.services', 'Services rendered'),
          quantity: 1,
          unitPrice: invoice.amount / (1 + effectiveRate),
        }]);
      }
    }
  }, [invoice?.id]);

  if (!invoice) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('invoices.notFound', 'Invoice not found')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>
    );
  }

  const lastExport = lastMoneybirdExport[invoice.id];
  const lastPayment = lastMolliePayment[invoice.id];

  // Calculations
  const subtotal = localItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const vatAmount = subtotal * effectiveRate;
  const total = subtotal + vatAmount;

  // R66 round 13: handleSaveCustomer removed. The flow wrote the
  // customer's display NAME into the documents.customer_id UUID FK
  // column — every save was rejected by the BE and the local state
  // retained a phantom field that reverted on next refresh. Renaming
  // a customer belongs on the customer record, not on each invoice.

  const handleUpdateItem = (itemId: string, field: keyof EditableLineItem, value: string) => {
    setLocalItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      if (field === 'description') return { ...item, description: value };
      const numVal = parseFloat(value) || 0;
      return { ...item, [field]: numVal };
    }));
  };

  const handleAddItem = () => {
    const newId = `item-${Date.now()}`;
    setLocalItems(prev => [...prev, { id: newId, description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (localItems.length <= 1) return;
    setLocalItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleSaveItems = () => {
    const newTotal = localItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    // Was the NL constant. Every edit to an invoice's lines re-grossed the
    // total at 21% — 19% for a German contractor, 0% for a Kleinunternehmer /
    // KOR contractor who may not charge VAT at all. `effectiveRate` is the
    // profile's own rate and is what the totals above the button already show,
    // so the saved amount disagreed with the figure on screen.
    const finalTotal = newTotal * (1 + effectiveRate);
    updateInvoice(invoice.id, { amount: Math.round(finalTotal * 100) / 100 });
    setEditingItems(false);
    hapticSuccess();
  };

  const handleSaveNotes = () => {
    // R66 round 13: notes is now a real Invoice field + persisted column.
    // The `as any` cast was masking the silent-loss bug.
    updateInvoice(invoice.id, { notes });
    setEditingNotes(false);
    hapticSuccess();
  };

  const handleCreatePayment = async () => {
    try {
      await createPaymentLink(invoice.id, invoice.amount);
      hapticSuccess();
    } catch (err) {
      // R66 round 8: was silent (just a vibration). Now surfaces the reason
      // so the contractor knows their payment-provider config needs attention.
      hapticError();
      Alert.alert(
        t('paymentAlerts.paymentLinkFailedTitle'),
        err instanceof Error && err.message ? err.message : t('paymentAlerts.paymentLinkFailedBody'),
      );
    }
  };

  const handleExportMoneybird = async () => {
    try {
      await exportInvoice(invoice.id);
      hapticSuccess();
    } catch (err) {
      // R66 round 9: was silent (vibration only). Surface the reason so the
      // contractor knows their Moneybird OAuth needs re-auth or a network
      // hiccup happened.
      hapticError();
      Alert.alert(
        t('paymentAlerts.moneybirdFailedTitle'),
        err instanceof Error && err.message ? err.message : t('paymentAlerts.moneybirdFailedBody'),
      );
    }
  };

  const handleMarkPaid = () => {
    markInvoicePaid(invoice.id);
    hapticSuccess();
    Alert.alert(
      t('invoices.paidTitle', 'Payment received!'),
      t('invoices.paidDesc', {
        defaultValue: '{{amount}} from {{customer}} marked as paid.',
        amount: formatCurrency(invoice.amount, country),
        // Not `invoice.customer` — that is an id on anything converted from an
        // R13.2-era quote, so the confirmation read "106,00 € von
        // c-1787349342347 als bezahlt markiert."
        customer: invoiceCustomerName,
      }),
      [
        { text: t('invoices.viewAll', 'View all invoices'), onPress: () => router.push('/(contractor)/geld' as any) },
        { text: t('common.close', 'Close') },
      ],
    );
  };

  const handleMarkSent = async () => {
    // Legal gate: invoice must carry country-required fields (KvK/HRB/SIRET,
    // VAT ID, etc.) or it's non-compliant. Block send until profile complete.
    const readiness = checkInvoiceReadiness(businessProfile);
    if (!readiness.ready) {
      Alert.alert(
        t('invoices.profileIncomplete', 'Profile incomplete'),
        t('invoices.profileIncompleteDesc', 'Complete your business details before sending invoices.') +
          '\n\n' + [...readiness.missingLabels, ...readiness.invalidLabels].map((l) => `• ${l}`).join('\n'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('invoices.completeProfile', 'Complete profile'), onPress: () => router.push('/(modals)/business-settings' as any) },
        ],
      );
      return;
    }

    // `Invoice` has no `customerEmail` field — not in src/domain/documents.ts,
    // and nothing anywhere writes one — so this read was ALWAYS undefined and
    // every "mark as sent" fell into the no-email branch below. The address is
    // on the customer RECORD, which is already resolved above for the
    // e-invoice buyer party. Familie Schneider has schneider@example.de and the
    // app told the contractor it had no email for them.
    const customerEmail =
      invoiceCustomer?.email
      ?? (invoice as any).customerEmail
      ?? (invoice as any).customer_email;
    const language = (user?.language ?? 'nl') as 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

    // Optimistic local update
    markInvoiceSent(invoice.id);
    hapticSuccess();

    if (!customerEmail) {
      Alert.alert(
        t('invoices.noEmail', 'No customer email'),
        t('invoices.noEmailDesc', 'Marked as sent locally. Add the customer email to send the invoice automatically next time.'),
      );
      return;
    }

    const paymentUrl = lastMolliePayment?.invoiceId === invoice.id ? lastMolliePayment.checkoutUrl : undefined;

    // Cadence-aware escalation: if the invoice is already overdue we pick a
    // gentle / firm / final template so the tone matches the situation.
    const daysOverdue = invoice.dueInDays < 0 ? Math.abs(invoice.dueInDays) : 0;
    let subject: string | undefined;
    let bodyOverride: string | undefined;
    if (daysOverdue >= 3) {
      // Key the dunning cadence on a STABLE identity, so the same customer
      // does not get two independent escalation ladders depending on which
      // shape their invoices happen to carry.
      const step = await effectiveStep(invoiceCustomer?.id ?? (invoice as any).customer ?? '', daysOverdue);
      if (step) {
        // EU Directive 2011/7/EU: B2B is entitled to statutory interest +
        // €40 recovery fee. Disclosure required on firm/final steps.
        const supportedCountries: LateFeeCountry[] = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];
        const feeCountry: LateFeeCountry = supportedCountries.includes(country as LateFeeCountry)
          ? (country as LateFeeCountry)
          : 'NL';
        const feeBreakdown = computeLateFee({
          invoiceAmount: invoice.amount,
          daysOverdue,
          country: feeCountry,
          customerType: 'business',
        });
        const disclosure = feeBreakdown.applicable
          ? disclosureLineLocalized(feeBreakdown, language)
          : undefined;
        const rendered = renderReminder({
          step,
          locale: language,
          // This string is the greeting in the reminder EMAIL the customer
          // reads. `invoice.customer` is an id on converted quotes, so this
          // would have opened "Hallo c-1787349342347".
          customer: invoiceCustomerName,
          ref: invoice.id,
          amount: formatCurrency(invoice.amount, country),
          days: daysOverdue,
          link: paymentUrl ?? '',
          business: (businessProfile as any)?.businessName ?? 'Vasco',
          lateFeeDisclosure: disclosure,
        });
        subject = rendered.subject;
        bodyOverride = rendered.body;
      }
    }

    // R66 round 36: attach the actual invoice PDF. Pre-R36 the customer
    // received only a payment link in the email body — no invoice document.
    // NL Belastingdienst requires the structured invoice for VAT reclaim;
    // customers couldn't book the cost or process the VAT until the
    // contractor sent a separate PDF via WhatsApp/Drive. Now we generate
    // the same PDF the share-button produces and attach it.
    let pdfBase64: string | undefined;
    const autoInvForPdf = invoiceAutomationService.getInvoice(invoice.id);
    if (autoInvForPdf) {
      const linkedJob = (invoice as any).jobId
        ? jobs.find((j: any) => j.id === (invoice as any).jobId)
        : null;
      const customerSignature = linkedJob?.signatureSvg && linkedJob?.customerSignoffAt
        ? {
            svgDataUri: linkedJob.signatureSvg,
            signedAt: linkedJob.customerSignoffAt,
            signerName: linkedJob.customerId ?? 'Customer',
          }
        : undefined;
      const enriched: typeof autoInvForPdf = {
        ...autoInvForPdf,
        deliveryDate: linkedJob?.completedAt ? new Date(linkedJob.completedAt) : autoInvForPdf.deliveryDate,
      };
      const built = await buildInvoicePdfBase64(
        enriched,
        businessProfile,
        paymentUrl,
        customerSignature ? { customerSignature } : undefined,
      );
      pdfBase64 = built ?? undefined;
    }

    const result = await sendInvoiceEmail({
      invoiceId: invoice.id,
      to: customerEmail,
      paymentUrl,
      locale: language,
      subject,
      bodyOverride,
      pdfBase64,
    });
    if (result.ok) {
      Alert.alert(
        t('invoices.sentTitle', 'Invoice sent'),
        t('invoices.sentDesc', {
          defaultValue: 'Sent to {{email}}. Vasco will remind you if payment is late.',
          email: customerEmail,
        }),
      );
    } else {
      Alert.alert(
        t('invoices.sendFailedTitle', 'Email not sent'),
        t('invoices.sendFailedDesc', {
          defaultValue: 'Marked as sent locally, but the email could not be delivered: {{error}}',
          error: result.error ?? 'unknown',
        }),
      );
    }
  };

  const handleViewPdf = async () => {
    // R66 round 34: legal gate. Pre-R34 the PDF button generated a document
    // even with empty businessName / KvK / BTW — that's a non-compliant
    // invoice (Belastingdienst Art. 35) which the contractor could share
    // before realizing the gap. The same gate already exists on handleMarkSent.
    const readiness = checkInvoiceReadiness(businessProfile);
    if (!readiness.ready) {
      hapticError();
      Alert.alert(
        t('invoices.profileIncomplete', 'Profile incomplete'),
        t('invoices.profileIncompleteDesc', 'Complete your business details before sending invoices.') +
          '\n\n' + [...readiness.missingLabels, ...readiness.invalidLabels].map((l) => `• ${l}`).join('\n'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('invoices.completeProfile', 'Complete profile'), onPress: () => router.push('/(modals)/business-settings' as any) },
        ],
      );
      return;
    }
    hapticSuccess();
    const autoInv = invoiceAutomationService.getInvoice(invoice.id);
    if (autoInv) {
      // R303: embed customer-handover signature when the linked job has one
      // captured. Same pattern as facturen.tsx PDF button (R301).
      const linkedJob = (invoice as any).jobId
        ? jobs.find((j: any) => j.id === (invoice as any).jobId)
        : null;
      const customerSignature = linkedJob?.signatureSvg && linkedJob?.customerSignoffAt
        ? {
            svgDataUri: linkedJob.signatureSvg,
            signedAt: linkedJob.customerSignoffAt,
            signerName: linkedJob.customerId ?? 'Customer',
          }
        : undefined;
      // R66 round 34: enrich with leveringsdatum from the linked job's
      // completedAt. Cloned (not mutated) so the cached AutoInvoice in
      // invoiceAutomationService stays untouched between renders.
      const enriched: typeof autoInv = {
        ...autoInv,
        // R66 round 47: prefer the persisted documents.delivery_date (hydrated
        // via mapper into invoice.deliveryDate) over FE-derived from the
        // linked job. The persisted value is the snapshot at invoice-create
        // time and survives if the linked job is later deleted.
        deliveryDate: (invoice as any).deliveryDate
          ? new Date((invoice as any).deliveryDate)
          : linkedJob?.completedAt
            ? new Date(linkedJob.completedAt)
            : autoInv.deliveryDate,
      };
      await generateInvoicePdf(enriched, businessProfile, undefined, customerSignature ? { customerSignature } : undefined);
    }
  };

  /**
   * Open a filing record for this invoice.
   *
   * The key is derived from the XML, so re-sharing the same document is the
   * SAME filing rather than a second one — duplicate submission means two
   * invoices carrying one number. It records `submitted`, never `accepted`:
   * there is no transport here, the contractor hands the file over themselves,
   * and only they will see what the authority says back.
   *
   * Fire-and-forget: an audit-trail write must never block or fail the export
   * the contractor actually asked for.
   */
  const recordFiling = (xml: string) => {
    recordHandover({
      channel: channelForCountry(country),
      subjectId: invoice.id,
      payload: xml,
    }).catch(() => {});
  };


  /**
   * Hand the payload off, then find out whether it was actually filed.
   *
   * `recordHandover`'s own contract says "by the time we are called the XML has
   * already left via the share sheet" — and every caller here violated it.
   * `Sharing.shareAsync` returns `Promise<void>` and CANNOT report
   * cancellation, `RNShare.share` resolves with `dismissedAction` rather than
   * throwing, and the result was discarded either way. So cancelling the share
   * sheet recorded the invoice as submitted, and the `catch` block — reached on
   * a real filesystem failure — recorded it as submitted too.
   *
   * That is not a cosmetic mis-record. `einvoiceSubmitted` is what
   * `aiActionQueueService` filters on to raise the e-invoice mandate reminder,
   * so a cancelled export silently switched the reminder off for good; and for
   * Italy a FatturaPA that never reached SDI is a legal non-event — the invoice
   * was never issued. [[regulated-submissions-uk-eu]] puts it exactly: "a
   * contractor who believes they filed and did not is worse off than one who
   * never tried."
   *
   * Vasco has no SDI/FACe/PDP adapter and deliberately never will guess at one,
   * so the only honest source for "was it filed" is the contractor. Where the
   * share sheet CAN tell us it was dismissed we record nothing; where it cannot
   * we ask. Same shape as insurance.tsx, which stopped claiming a claim had
   * reached an insurer it never contacted.
   */
  const shareEInvoiceThenConfirm = async (xml: string, filename: string, format: string) => {
    let dismissed = false;
    try {
      const file = new File(Paths.cache, filename);
      file.write(xml);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/xml',
          dialogTitle: filename,
          UTI: 'public.xml',
        });
      } else {
        const res = await RNShare.share({ message: xml, title: filename });
        dismissed = wasShareDismissed(res);
      }
    } catch {
      // Fallback: share the XML as plain text if the filesystem/share fails.
      try {
        const res = await RNShare.share({ message: xml, title: filename });
        dismissed = wasShareDismissed(res);
      } catch {
        return; // nothing left the device
      }
    }
    if (dismissed) return;
    Alert.alert(
      t('einvoice.filedTitle', 'Did you file it?'),
      t('einvoice.filedBody', { format, defaultValue: 'Vasco creates the file — it does not send it to the authority. Confirm only once you have actually filed {{format}}.' }),
      [
        { text: t('einvoice.filedNotYet', 'Not yet'), style: 'cancel' },
        {
          text: t('einvoice.filedYes', 'Yes, filed'),
          onPress: () => {
            hapticSuccess();
            markEInvoiceSubmitted(invoice.id);
            recordFiling(xml);
          },
        },
      ],
    );
  };

  const handleExportEInvoice = async (format: 'XRechnung' | 'ZUGFeRD') => {
    // Tier gate: e-invoicing is Contractor-only
    try {
      const { loadSubscription } = await import('../../src/services/subscriptionService');
      const { canUseEInvoiceFormat } = await import('../../src/services/complianceGatingService');
      const sub = await loadSubscription();
      const formatId = format === 'XRechnung' ? 'xrechnung' : country === 'FR' ? 'facturx' : 'zugferd';
      const gate = canUseEInvoiceFormat(sub, formatId as any);
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired', 'Upgrade required'),
          gate.reason ?? t('billing.formatNeedsContractor', 'This format needs the Contractor plan.'),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as any) },
          ],
        );
        return;
      }
    } catch {}
    const currency = country === 'UK' ? 'GBP' : country === 'US' ? 'USD' : 'EUR';
    const vatAmount = subtotal * effectiveRate;
    const data: EInvoiceData = {
      sellerName: (businessProfile as any)?.businessName ?? 'Vasco',
      sellerAddress: (businessProfile as any)?.address ?? '',
      sellerVatId: businessProfile?.vatNumber ?? '',
      // XRechnung needs all of these and the generator can only emit what it
      // is given. BR-DE-5/6/7 (contact) and BR-DE-8/9 (address detail) are
      // rejections at the buyer's gateway, not warnings — see
      // src/integrations/einvoice.ts. checkInvoiceReadiness now requires them
      // for DE so the contractor is asked before they export, not after the
      // invoice bounces.
      sellerCity: (businessProfile as any)?.city,
      sellerPostalCode: (businessProfile as any)?.postcode,
      sellerCountry: country,
      sellerContactName: (businessProfile as any)?.businessName,
      sellerPhone: (businessProfile as any)?.phone,
      sellerEmail: (businessProfile as any)?.email,
      // The buyer's legal name on a structured e-invoice — an id here is a
      // rejected submission, not a cosmetic slip.
      buyerName: invoiceCustomerName,
      buyerAddress: (invoice as any).customerAddress ?? '',
      // Was `(invoice as any).customerCity` / `.customerPostcode` — fields
      // that existed nowhere, so they were undefined on every invoice and the
      // elements were simply omitted. XRechnung BR-DE-8/9 require both, which
      // means every German invoice this app has ever produced was invalid on
      // the buyer address alone. Now read from the customer record
      // (migration 20260819000010).
      buyerCity: invoiceCustomer?.city,
      buyerPostalCode: invoiceCustomer?.postcode,
      buyerCountry: invoiceCustomer?.country ?? country,
      buyerVatId: invoiceCustomer?.vatId ?? (invoice as any).customerVatId,
      invoiceNumber: (invoice as any).reference ?? invoice.id,
      invoiceDate: (invoice.sentAt ?? invoice.createdAt ?? invoice.deliveryDate ?? new Date().toISOString()).slice(0, 10),
      dueDate: (invoice.dueDate ?? new Date(Date.now() + (invoice.dueInDays || 14) * 24 * 60 * 60 * 1000).toISOString()).slice(0, 10),
      currency,
      lineItems: localItems.map((li: EditableLineItem) => ({
        description: li.description,
        quantity: li.quantity,
        unitCode: 'piece',
        unitPrice: li.unitPrice,
        vatRate: effectiveRate * 100,
        vatAmount: li.quantity * li.unitPrice * effectiveRate,
        lineTotal: li.quantity * li.unitPrice,
      })),
      totalNet: subtotal,
      totalVat: vatAmount,
      totalGross: total,
      iban: (businessProfile as any)?.iban,
      bic: (businessProfile as any)?.bic,
      paymentReference: (invoice as any).reference ?? invoice.id,
    };
    const xml = format === 'XRechnung' ? generateXRechnungXML(data) : generateZUGFeRDXML(data);
    const filename = `${data.invoiceNumber}-${format.toLowerCase()}.xml`;

    await shareEInvoiceThenConfirm(xml, filename, format);
  };

  // R302: ES Facturae 3.2.2 export. Mandatory in Spain for B2G + large B2B.
  // EInvoiceData → FacturaeInvoice mapper. Many Spanish-specific fields
  // (province, NIF, person type, regime fiscal) aren't on the businessProfile
  // today — sensible defaults applied; user can extend businessProfile schema
  // if they want richer XML.
  /**
   * The neutral model both country mappers take. Built once so ES and IT
   * cannot drift apart — which is exactly what happened before: each handler
   * assembled its own `const data: any` and one of them (IT) did not match the
   * generator at all, while the other (ES) matched the shape but filled the
   * buyer's NIF, city, post code and province with empty strings.
   */
  const buildEInvoiceSource = (): import('../../src/integrations/einvoiceMapping').EInvoiceSource => ({
    seller: {
      name: (businessProfile as any)?.businessName ?? '',
      vatId: businessProfile?.vatNumber,
      taxId: (businessProfile as any)?.registrationNumber,
      address: (businessProfile as any)?.address,
      city: (businessProfile as any)?.city,
      postcode: (businessProfile as any)?.postcode,
      province: (businessProfile as any)?.province,
      country: country,
      fiscalRegime: (businessProfile as any)?.fiscalRegime,
      personType: (businessProfile as any)?.personType,
      email: (businessProfile as any)?.email,
      phone: (businessProfile as any)?.phone,
      iban: (businessProfile as any)?.iban,
    },
    buyer: {
      name: invoice?.customer ?? '',
      vatId: invoiceCustomer?.vatId,
      taxId: invoiceCustomer?.taxId,
      address: invoiceCustomer?.address,
      city: invoiceCustomer?.city,
      postcode: invoiceCustomer?.postcode,
      province: invoiceCustomer?.province,
      country: invoiceCustomer?.country ?? country,
      einvoiceRouting: invoiceCustomer?.einvoiceRouting,
      einvoiceEmail: invoiceCustomer?.einvoiceEmail,
    },
    invoiceNumber: (invoice as any)?.reference ?? invoice?.id ?? '',
    invoiceDate: (invoice?.sentAt ?? invoice?.createdAt ?? invoice?.deliveryDate ?? new Date().toISOString()).slice(0, 10),
    dueDate: (invoice?.dueDate ?? new Date(Date.now() + ((invoice?.dueInDays ?? 14) * 24 * 60 * 60 * 1000)).toISOString()).slice(0, 10),
    currency: country === 'UK' ? 'GBP' : country === 'US' ? 'USD' : 'EUR',
    lines: localItems.map((li: EditableLineItem) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      lineTotal: li.quantity * li.unitPrice,
      vatRate: effectiveRate * 100,
    })),
    totalNet: subtotal,
    totalVat: subtotal * effectiveRate,
    totalGross: total,
  });

  /**
   * One place that turns "we are missing fields" into something a contractor
   * can act on. The mapper refuses rather than inventing a value; this is what
   * tells them WHICH field and WHERE, instead of a silent no-op or an invoice
   * the authority rejects days later.
   */
  const reportMissing = (missing: Array<{ key: string; where: 'profile' | 'customer' }>) => {
    const labels = missing.map((m) => t(m.key, m.key.split('.').pop() ?? m.key)).join('\n• ');
    Alert.alert(
      t('invoices.einvoiceMissingTitle', 'Some details are missing'),
      `${t('invoices.einvoiceMissingBody', 'This format needs a few more details before it can be sent:')}\n\n• ${labels}`,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        missing.some((m) => m.where === 'profile')
          ? { text: t('invoices.einvoiceFixProfile', 'Open business profile'), onPress: () => router.push('/(modals)/business-settings' as any) }
          : { text: t('common.ok', 'OK') },
      ],
    );
  };

  const handleExportFacturae = async () => {
    try {
      const { loadSubscription } = await import('../../src/services/subscriptionService');
      const { canUseEInvoiceFormat } = await import('../../src/services/complianceGatingService');
      const sub = await loadSubscription();
      const gate = canUseEInvoiceFormat(sub, 'facturae');
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired', 'Upgrade required'),
          gate.reason ?? t('billing.formatNeedsContractor', 'This format needs the Contractor plan.'),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as any) },
          ],
        );
        return;
      }
    } catch {}
    const { generateFacturaeXml } = await import('../../src/integrations/einvoice-es');
    const { toFacturae } = await import('../../src/integrations/einvoiceMapping');
    const invoiceNumber = (invoice as any).reference ?? invoice.id;
    // The old block built this object by hand and filled the buyer's NIF,
    // city, post code and province with empty strings, and hardcoded
    // sellerPersonType 'J'. It did not throw — it produced a Facturae that
    // looked complete and was missing every mandatory buyer field, which is
    // the worse failure: nothing to notice until the receiver rejects it.
    const mapped = toFacturae(buildEInvoiceSource());
    if (!mapped.ok) { reportMissing(mapped.missing); return; }
    const data = mapped.document;
    const xml = generateFacturaeXml(data);
    const filename = `${invoiceNumber}-facturae.xml`;
    // The comment that used to sit here said recording at queue approval "would
    // mark unfiled invoices as filed" — right, and recording on the share had
    // the same fault one step later. See shareEInvoiceThenConfirm.
    await shareEInvoiceThenConfirm(xml, filename, 'Facturae');
  };

  // R302: IT FatturaPA via SDI export. MANDATORY for ALL Italian invoices
  // (B2B + B2C) since 2019. The generator and types live in einvoice-it.ts.
  const handleExportFatturaPA = async () => {
    try {
      const { loadSubscription } = await import('../../src/services/subscriptionService');
      const { canUseEInvoiceFormat } = await import('../../src/services/complianceGatingService');
      const sub = await loadSubscription();
      const gate = canUseEInvoiceFormat(sub, 'fatturapa');
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired', 'Upgrade required'),
          gate.reason ?? t('billing.formatNeedsContractor', 'This format needs the Contractor plan.'),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as any) },
          ],
        );
        return;
      }
    } catch {}
    const { generateFatturaPAXml } = await import('../../src/integrations/einvoice-it');
    const { toFatturaPA } = await import('../../src/integrations/einvoiceMapping');
    const invoiceNumber = (invoice as any).reference ?? invoice.id;
    // The old block passed a flat object with `lineItems`, while the generator
    // reads `dettaglioLinee` off nested party objects — so this threw
    // "items is not iterable" on every tap, outside the try below.
    const mapped = toFatturaPA(buildEInvoiceSource());
    if (!mapped.ok) { reportMissing(mapped.missing); return; }
    const data = mapped.document;
    const xml = generateFatturaPAXml(data);
    const filename = `${invoiceNumber}-fatturapa.xml`;
    // The comment that used to sit here said recording at queue approval "would
    // mark unfiled invoices as filed" — right, and recording on the share had
    // the same fault one step later. See shareEInvoiceThenConfirm.
    await shareEInvoiceThenConfirm(xml, filename, 'FatturaPA');
  };

  // R20: when launched from queue executor with `?submit=einvoice`, auto-fire
  // the country-default e-invoice export. Was R1 deferral — destination
  // didn't read prefill, so the contractor approved the queue item then had
  // to find and tap the export button themselves. Country-routing matches
  // the explicit buttons rendered later in the screen (XRechnung/ZUGFeRD
  // for DE+others, Facturae for ES, FatturaPA for IT). One-shot via ref so
  // re-renders don't re-fire.
  const submitFiredRef = useRef(false);
  useEffect(() => {
    if (submitFiredRef.current) return;
    if (submit !== 'einvoice') return;
    if (!invoice) return;
    submitFiredRef.current = true;
    const fire = async () => {
      try {
        // ES/IT no longer route here: their handlers build an object shaped
        // nothing like what the generators take and throw on the first field.
        // And because the handlers are `async`, that throw was a REJECTED
        // PROMISE, not a synchronous one — so the catch below never saw it and
        // an approved queue action failed in total silence.
        // Awaited, all three. Without it a throw inside these async handlers
        // is a rejected promise the catch below cannot see — which is how the
        // IT crash reached production silently through this exact path.
        if (country === 'ES') return await handleExportFacturae();
        if (country === 'IT') return await handleExportFatturaPA();
        // DE / NL / FR / UK / others: XRechnung.
        return await handleExportEInvoice('XRechnung');
      } catch {
        // Silent — surfaced via the in-flow alert/share sheet errors.
      }
    };
    // Defer one tick so the screen is mounted + scroll-positioned first.
    const timer = setTimeout(fire, 120);
    return () => clearTimeout(timer);
  }, [submit, invoice?.id, country]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {/* Label by document reference or customer — NEVER invoice.id. The
              row id ("inv-seed-1") is internal and meaningless to a contractor;
              it was rendering as the screen title. */}
          <Text style={styles.headerTitle}>
            {t('invoices.invoice', 'Invoice')}
            {(invoice.reference || invoice.customerName || invoiceCustomerName)
              ? ` ${invoice.reference || invoice.customerName || invoiceCustomerName}`
              : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(invoice.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
            {t(`invoices.status.${invoice.status}`, invoice.status)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* R66r44 DK polish — invoice hero with gradient backdrop + amber glow */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[DK.colors.panel2, DK.colors.panel]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.heroLabel}>
            {invoice.status === 'paid'
              ? t('invoices.heroLabelPaid', 'Paid').toUpperCase()
              : invoice.dueInDays < 0
                ? t('invoices.heroLabelOverdue', 'Overdue').toUpperCase()
                : t('invoices.heroLabelOutstanding', 'Outstanding').toUpperCase()}
          </Text>
          <Text style={styles.heroAmount}>{formatCurrency(total, country)}</Text>
          <Text style={styles.heroDue}>
            {invoice.status === 'paid'
              ? t('invoices.paymentReceived', 'Payment received')
              : invoice.dueInDays >= 0
                ? t('invoices.dueIn', { defaultValue: 'Due in {{count}} days', count: invoice.dueInDays })
                : t('invoices.overdueDays', { defaultValue: '{{count}} days overdue', count: Math.abs(invoice.dueInDays) })
            }
          </Text>
        </View>

        {/* R261/R262: time-of-day payment timing — only when unsent/unpaid */}
        {invoice.status !== 'paid' && paymentTimingHint && (() => {
          const dows = [
            t('quotes.todSun', 'Sunday'),
            t('quotes.todMon', 'Monday'),
            t('quotes.todTue', 'Tuesday'),
            t('quotes.todWed', 'Wednesday'),
            t('quotes.todThu', 'Thursday'),
            t('quotes.todFri', 'Friday'),
            t('quotes.todSat', 'Saturday'),
          ];
          const partKey = `quotes.todPart_${paymentDayPart(paymentTimingHint.bestBucket.hourOfDay)}`;
          const partFallback = paymentDayPart(paymentTimingHint.bestBucket.hourOfDay);
          const day = dows[paymentTimingHint.bestBucket.dayOfWeek] ?? '';
          const part = t(partKey, partFallback);
          const days = paymentTimingHint.daysSavedVsWorst;

          const now = new Date();
          const nowTone = classifyPaymentNow(paymentTimingBuckets, now.getHours(), now.getDay());
          const slowerDays = Math.round(nowTone.daysSlowerVsBest);

          const accent = nowTone.tone === 'send_later' ? '#F59E0B' : Palette.hermesOrange;
          const headline =
            nowTone.tone === 'send_later' && slowerDays >= 2
              ? t('invoices.todHintWait', 'Waiting until {{day}} {{part}} → paid ~{{days}} days faster', {
                  day, part, days: slowerDays,
                })
              : nowTone.tone === 'send_now'
                ? t('invoices.todHintNow', 'Good time to send — {{day}} {{part}} is the peak slot', {
                    day, part,
                  })
                : days >= 2
                  ? t('invoices.todHintFaster', '{{day}} {{part}} — paid ~{{days}} days faster on average', {
                      day, part, days: Math.round(days),
                    })
                  : t('invoices.todHintHigher', '{{day}} {{part}} — {{lift}}pp higher paid rate', {
                      day, part, lift: Math.round(paymentTimingHint.paidRateLiftPoints * 100),
                    });

          return (
            <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: accent }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="time-outline" size={18} color={accent} />
                <Text style={styles.cardTitle}>{t('invoices.todTitle', 'Best time to send')}</Text>
              </View>
              <Text style={{ color: SemanticColors.textPrimary, fontFamily: TYPE.bodyFamily, fontSize: 14, marginTop: 4 }}>
                {headline}
              </Text>
              <Text style={{ color: SemanticColors.textTertiary, fontFamily: TYPE.captionFamily, fontSize: 11, marginTop: 4 }}>
                {t('invoices.todSample', 'Across {{count}} invoices from peers in {{country}}', {
                  count: paymentTimingHint.totalSamples,
                  country: businessProfile?.country ?? country,
                })}
              </Text>
            </View>
          );
        })()}

        {/* Customer Section — R66 round 13: pencil-edit removed.
            Inline rename wrote the display name string into the customer_id
            UUID FK column, BE rejected, local state reverted on refresh.
            Customer-record edits live on the customer screen. */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.customer', 'Customer')}</Text>
          </View>
          <Text style={styles.customerName}>{invoiceCustomerName}</Text>
          <Text style={styles.customerJob}>{invoice.job}</Text>
        </View>

        {/* Line Items Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.lineItems', 'Line items')}</Text>
            <Pressable
              onPress={() => {
                if (editingItems) handleSaveItems();
                else setEditingItems(true);
              }}
              style={styles.editBtn}
            >
              <Ionicons name={editingItems ? 'checkmark' : 'pencil'} size={14} color={Palette.hermesOrange} />
            </Pressable>
          </View>

          {/* Column headers — only while EDITING, where the row really is four
              columns. The read view stacks (see below) and a four-column header
              over a two-line stack just mislabels it. */}
          {editingItems && (
            <View style={styles.lineHeaderRow}>
              <Text style={[styles.lineHeaderText, { flex: 2 }]}>{t('invoices.description', 'Description')}</Text>
              <Text style={[styles.lineHeaderText, { width: 40, textAlign: 'center' }]}>{t('invoices.qty', 'Qty')}</Text>
              <Text style={[styles.lineHeaderText, { width: 82, textAlign: 'right' }]} numberOfLines={1}>{t('invoices.unitPrice', 'Price')}</Text>
              <Text style={[styles.lineHeaderText, { width: 82, textAlign: 'right' }]} numberOfLines={1}>{t('invoices.total', 'Total')}</Text>
            </View>
          )}

          {/* Items */}
          {localItems.map((item) => (
            <View key={item.id} style={editingItems ? styles.lineItemRow : styles.lineItemStack}>
              {editingItems ? (
                <>
                  <TextInput
                    style={[styles.lineInput, { flex: 2 }]}
                    value={item.description}
                    onChangeText={(v) => handleUpdateItem(item.id, 'description', v)}
                    placeholder={t('invoices.itemDescription', 'Description')}
                    placeholderTextColor={SemanticColors.textTertiary}
                  />
                  <TextInput
                    style={[styles.lineInput, { width: 40, textAlign: 'center' }]}
                    value={String(item.quantity)}
                    onChangeText={(v) => handleUpdateItem(item.id, 'quantity', v)}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.lineInput, { width: 82, textAlign: 'right' }]}
                    value={String(item.unitPrice)}
                    onChangeText={(v) => handleUpdateItem(item.id, 'unitPrice', v)}
                    keyboardType="numeric"
                  />
                  <Pressable onPress={() => handleRemoveItem(item.id)} style={styles.removeItemBtn}>
                    <Ionicons name="close-circle" size={18} color={SemanticColors.feedbackError} />
                  </Pressable>
                </>
              ) : (
                /* The description was one cell of a four-column row, so it got
                   ~130pt of a 402pt screen. iOS breaks a word wider than its
                   box BETWEEN CHARACTERS, then ellipsizes at two lines — the
                   German seed rendered "Trinkwasserleitun / g erneuern — B…",
                   i.e. an invoice line whose contractor cannot read what is
                   being billed. Seen on device 2026-08-26. Compound nouns are
                   normal German, so no column width fixes this: the
                   description takes the full row and the numbers sit under it.
                   Editing keeps the four-column form, where each cell is a
                   separate input. */
                <>
                  <Text style={styles.lineText} numberOfLines={3}>{item.description}</Text>
                  <View style={styles.lineNumbers}>
                    <Text style={styles.lineTextMuted} numberOfLines={1}>
                      {item.quantity} × {formatCurrency(item.unitPrice, country)}
                    </Text>
                    <Text style={styles.lineText} numberOfLines={1}>
                      {formatCurrency(item.quantity * item.unitPrice, country)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          ))}

          {editingItems && (
            <Pressable style={styles.addItemBtn} onPress={handleAddItem}>
              <Ionicons name="add-circle-outline" size={18} color={Palette.hermesOrange} />
              <Text style={styles.addItemText}>{t('invoices.addItem', 'Add item')}</Text>
            </Pressable>
          )}
        </View>

        {/* Totals Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calculator" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.totals', 'Totals')}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('invoices.subtotal', 'Subtotal')}</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal, country)}</Text>
          </View>
          <View style={styles.totalRow}>
            {/* The "(21%)" was literal, next to a figure computed at the
                profile's real rate: a German invoice showed 19% of the net
                labelled as 21%, and a Kleinunternehmer's 0 was labelled 21%
                too. Read the same rate the arithmetic uses. */}
            <Text style={styles.totalLabel}>
              {t('invoices.vat', 'VAT')} ({Math.round(effectiveRate * 1000) / 10}%)
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(vatAmount, country)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalFinalLabel}>{t('invoices.totalAmount', 'Total')}</Text>
            <Text style={styles.totalFinalValue}>{formatCurrency(total, country)}</Text>
          </View>
          {lastExport ? (
            <View style={styles.statusNote}>
              <Ionicons name="checkmark-circle" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.statusNoteText}>{t('invoices.exportedMoneybird', 'Exported to Moneybird')}</Text>
            </View>
          ) : null}
          {lastPayment ? (
            <View style={styles.statusNote}>
              <Ionicons name="link" size={14} color={SemanticColors.feedbackInfo} />
              <Text style={styles.statusNoteText}>{t('invoices.mollieCreated', 'Mollie payment link created')}</Text>
            </View>
          ) : null}
        </View>

        {/* Payment Methods.

            This card and the "Connect Mollie" row in Actions below were two
            controls for one thing, and the pair was worse than redundant: the
            card led with a green shield and closed with "Secure via Mollie ·
            PCI DSS compliant" while Mollie was NOT connected, so it promised a
            checkout the customer cannot reach — and then the action list asked
            for the same setup a screen-length away.

            One place now. Not connected → this card says these are the methods
            the customer WOULD get and carries the connect button itself, and
            the Actions row is not rendered. Connected → the card is a factual
            list and Actions offers "Create payment link", which is a different
            action. */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name={mollieConnected ? 'shield-checkmark' : 'shield-outline'}
              size={18}
              color={mollieConnected ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
            />
            <Text style={styles.cardTitle}>
              {mollieConnected
                ? t('invoices.offeredPaymentMethods', 'Payment methods')
                : t('invoices.paymentMethodsAvailable', 'Payment methods you could offer')}
            </Text>
          </View>
          <View style={styles.paymentMethodList}>
            {paymentMethods.map((pm) => {
              const brandColor = getPaymentBrandColor(pm.name);
              const isPreferred = customerPreference
                ? pm.name.toLowerCase().replace(/\s+/g, '_') === customerPreference.toLowerCase()
                  || pm.name.toLowerCase() === customerPreference.toLowerCase()
                : false;
              return (
                <View
                  key={pm.name}
                  style={[
                    styles.paymentMethodRow,
                    isPreferred && [styles.paymentMethodPreferred, { borderColor: brandColor + '40' }],
                  ]}
                >
                  <View style={[styles.paymentMethodIconWrap, { backgroundColor: brandColor + '12' }]}>
                    <View style={[styles.paymentMethodDot, { backgroundColor: brandColor }]} />
                  </View>
                  <Text
                    style={[
                      styles.paymentMethodName,
                      isPreferred && { fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
                    ]}
                  >
                    {pm.name}
                  </Text>
                  {isPreferred && (
                    <View style={[styles.preferredBadge, { backgroundColor: brandColor + '15' }]}>
                      <Ionicons name="heart" size={10} color={brandColor} />
                      <Text style={[styles.preferredBadgeText, { color: brandColor }]}>{t('invoices.preferred', 'Preferred')}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          {customerPreference && (
            <View style={styles.preferenceNote}>
              <Ionicons name="heart" size={14} color={Palette.hermesOrange} />
              <Text style={styles.preferenceNoteText}>
                {t('invoices.customerPrefers', { defaultValue: 'Customer prefers: {{method}}', method: getPaymentMethodLabel(customerPreference) })}
              </Text>
            </View>
          )}
          {mollieConnected ? (
            <View style={styles.securityNote}>
              <Ionicons name="lock-closed" size={12} color={SemanticColors.textTertiary} />
              <Text style={styles.securityNoteText}>
                {t('invoices.secureVia', { defaultValue: 'Secure via {{provider}} · PCI DSS compliant', provider: country === 'UK' ? 'Stripe' : 'Mollie' })}
              </Text>
            </View>
          ) : (
            <ActionRow
              icon="card-outline"
              label={t('invoices.connectMollie', 'Connect Mollie')}
              onPress={() => router.push('/(modals)/mollie' as any)}
              accent
              border
            />
          )}
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.actions', 'Actions')}</Text>
          </View>
          <ActionRow
            icon="document-text-outline"
            label={t('invoices.viewSharePdf', 'View & share PDF')}
            onPress={handleViewPdf}
          />
          {/* Only when connected — the un-connected case lives in the payment
              methods card above, so the contractor is asked once. */}
          {mollieConnected && (
            <ActionRow
              icon="card-outline"
              label={t('invoices.createPaymentLink', 'Create payment link')}
              onPress={handleCreatePayment}
              border
            />
          )}
          {/* Moneybird is DUTCH bookkeeping software. Offering it by name as
              the only export route sent a German Handwerksbetrieb to a Dutch
              tool's OAuth screen — the same market leak as the "(NL)" permits.
              `getProvidersForCountry` already exists and business-settings
              already renders it, so an unconnected contractor goes there and
              sees DATEV / lexoffice / sevDesk in DE, Pennylane in FR, and so
              on. Once they HAVE connected Moneybird, naming it is correct. */}
          <ActionRow
            icon="cloud-upload-outline"
            label={moneybirdConnected
              ? t('invoices.exportMoneybird', 'Export to Moneybird')
              : t('invoices.connectAccounting', 'Connect accounting')}
            onPress={() => moneybirdConnected
              ? handleExportMoneybird()
              : router.push('/(modals)/business-settings' as any)}
            border
          />
          {/* R289: FR Factur-X button removed until proper FacturXInvoice
              mapping lands. Previously labelled "Factur-X" but called
              generateZUGFeRDXML — produced legally wrong German XML for
              French B2G/B2B. ES/IT formats also gap (Facturae, FatturaPA
              generators exist but no UI mapper). See DORMANT_AUDIT.md R4. */}
          {country === 'DE' && (
            <ActionRow
              icon="code-slash-outline"
              label={t('invoices.exportXRechnung', 'Export XRechnung (XML)')}
              onPress={() => handleExportEInvoice('XRechnung')}
              border
            />
          )}
          {/* Restored 2026-08-19 once the mappers existed. They were removed
              earlier the same day because IT threw "items is not iterable" on
              every tap and ES silently produced an invoice with an empty buyer
              NIF, city, post code and province. Both now go through
              src/integrations/einvoiceMapping.ts, which returns the format's
              own TYPE — so the compiler carries the shape — and REFUSES with a
              named list of missing fields rather than inventing a value.
              That refusal matters: RF01 defaulted for a forfettario is a
              fiscally wrong invoice SDI accepts, and nobody finds out. */}
          {country === 'ES' && (
            <ActionRow
              icon="code-slash-outline"
              label={t('invoices.exportFacturae', 'Export Facturae (XML)')}
              onPress={handleExportFacturae}
              border
            />
          )}
          {country === 'IT' && (
            <ActionRow
              icon="code-slash-outline"
              label={t('invoices.exportFatturaPA', 'Export FatturaPA (XML)')}
              onPress={handleExportFatturaPA}
              border
            />
          )}
          {/* R300: was mislabeled "Send reminder" but onPress fires
              handleMarkSent (marks the invoice as sent, no reminder).
              Real reminder send lives on the facturen list per-row button
              with R287's gateReminderSend gate. */}
          <ActionRow
            icon="send-outline"
            label={t('invoices.markAsSent', 'Mark as sent')}
            onPress={handleMarkSent}
            border
          />
          {invoice.status !== 'paid' && (
            <ActionRow
              icon="checkmark-circle-outline"
              label={t('invoices.markPaid', 'Mark as paid')}
              onPress={handleMarkPaid}
              accent
              border
            />
          )}
        </View>

        {/* Activity Timeline */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.activityTimeline', 'Activity')}</Text>
          </View>
          <View style={styles.timelineList}>
            {/* Created */}
            <TimelineEntry
              icon="add-circle-outline"
              color={SemanticColors.textTertiary}
              label={t('invoices.created', 'Invoice created')}
              date={invoice.lastUpdated
                ? formatDateShort(new Date(invoice.lastUpdated), country as Country)
                : t('invoices.recently', 'Recently')}
              showLine
            />
            {/* Sent */}
            {(invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'paid') && (
              <TimelineEntry
                icon="send"
                color={SemanticColors.feedbackInfo}
                label={t('invoices.sentToCustomer', 'Sent to customer')}
                date={invoice.dueDate
                  ? formatDayMonth(new Date(new Date(invoice.dueDate).getTime() - 14 * 86400000), country as Country)
                  : ''}
                showLine
              />
            )}
            {/* Overdue */}
            {invoice.status === 'overdue' && (
              <TimelineEntry
                icon="alert-circle"
                color={SemanticColors.feedbackError}
                label={t('invoices.overdueNotice', 'Payment overdue')}
                labelColor={SemanticColors.feedbackError}
                date={`${invoice.dueDate
                  ? formatDayMonth(new Date(invoice.dueDate), country as Country)
                  : ''} · ${Math.abs(invoice.dueInDays)} ${t('invoices.daysLate', 'days late')}`}
                showLine
              />
            )}
            {/* EU Directive 2011/7/EU — statutory interest + €40 recovery fee */}
            {invoice.status === 'overdue' && (() => {
              const supportedCountries: LateFeeCountry[] = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];
              const feeCountry: LateFeeCountry = supportedCountries.includes(country as LateFeeCountry)
                ? (country as LateFeeCountry)
                : 'NL';
              const fee = computeLateFee({
                invoiceAmount: invoice.amount,
                daysOverdue: Math.abs(invoice.dueInDays),
                country: feeCountry,
                customerType: 'business',
              });
              if (!fee.applicable || fee.interest + fee.recoveryFee < 1) return null;
              const cur = fee.currency === 'GBP' ? '£' : '€';
              return (
                <TimelineEntry
                  icon="warning-outline"
                  color={SemanticColors.feedbackWarning}
                  label={t('invoices.lateFeeEntitled', {
                    defaultValue: 'Entitled: {{fee}} late-fee + recovery',
                    fee: `${cur}${(fee.interest + fee.recoveryFee).toFixed(2)}`,
                  })}
                  labelColor={SemanticColors.textPrimary}
                  date={t('invoices.lateFeeBreakdown', {
                    defaultValue: '{{rate}}% interest ({{interest}}) + {{recovery}} fee',
                    rate: fee.effectiveRatePct.toFixed(2),
                    interest: `${cur}${fee.interest.toFixed(2)}`,
                    recovery: `${cur}${fee.recoveryFee.toFixed(0)}`,
                  })}
                  showLine
                />
              );
            })()}
            {/* Paid */}
            {invoice.status === 'paid' && (
              <TimelineEntry
                icon="checkmark"
                color={SemanticColors.feedbackSuccess}
                label={t('invoices.paymentReceived', 'Payment received')}
                labelColor={SemanticColors.feedbackSuccess}
                date={formatCurrency(invoice.amount, country)}
              />
            )}
            {/* Due date for unpaid */}
            {invoice.status !== 'paid' && (
              <TimelineEntry
                icon="calendar-outline"
                color={invoice.dueInDays < 0 ? SemanticColors.feedbackError : SemanticColors.textTertiary}
                label={invoice.dueInDays >= 0
                  ? t('invoices.dueIn', { defaultValue: 'Due in {{count}} days', count: invoice.dueInDays })
                  : t('invoices.overdueDays', { defaultValue: '{{count}} days overdue', count: Math.abs(invoice.dueInDays) })}
                date={invoice.dueDate
                  ? formatDate(new Date(invoice.dueDate), country as Country)
                  : ''}
              />
            )}
            {/* R214: cohort-backed payment timing caption. Hidden on paid
                invoices and when the cohort row is k-anonymity-suppressed. */}
            {invoice.status !== 'paid' && (paymentPrediction || (cohortDso?.medianDso && cohortDso.sampleSize > 0)) && (
              <Text style={{
                fontSize: TYPE.captionSize,
                fontFamily: TYPE.captionFamily,
                color: SemanticColors.textSecondary,
                marginTop: GRID.xs,
                marginLeft: GRID.sm,
              }}>
                {paymentPrediction
                  ? t('invoices.predictedPayment', 'Predicted: ~{{days}}d', { days: paymentPrediction.days })
                  : null}
                {paymentPrediction && cohortDso?.medianDso ? ' · ' : ''}
                {cohortDso?.medianDso && cohortDso.sampleSize > 0
                  ? t('invoices.cohortDso', 'Cohort median: {{days}}d', { days: Math.round(cohortDso.medianDso) })
                  : null}
              </Text>
            )}
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubble-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('invoices.notes', 'Internal notes')}</Text>
            <Pressable onPress={() => {
              if (editingNotes) handleSaveNotes();
              else setEditingNotes(true);
            }} style={styles.editBtn}>
              <Ionicons name={editingNotes ? 'checkmark' : 'pencil'} size={14} color={Palette.hermesOrange} />
            </Pressable>
          </View>
          {editingNotes ? (
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('invoices.addNotes', 'Add internal notes...')}
              placeholderTextColor={SemanticColors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.notesText}>
              {notes || t('invoices.noNotes', 'No notes yet. Tap the pencil to add.')}
            </Text>
          )}
        </View>

        <View style={{ height: SafeArea.bottom + GRID.xl }} />
      </ScrollView>
    </View>
  );
}

// Action row component
function ActionRow({ icon, label, onPress, border, accent }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  border?: boolean;
  accent?: boolean;
}) {
  // R66r44 DK polish — accent rows ("Mark as paid", primary CTAs) get the
  // DK gradient + amber glow treatment so they read as load-bearing actions
  // instead of one-of-N list items. Non-accent rows stay as quiet list rows.
  if (accent) {
    return (
      <Pressable style={styles.actionRowAccent} onPress={onPress}>
        <LinearGradient
          colors={DK.effects.ctaGradient as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name={icon} size={18} color="#fff" />
        <Text style={styles.actionLabelAccent}>{label.toUpperCase()}</Text>
        <Ionicons name="chevron-forward" size={16} color="#fff" />
      </Pressable>
    );
  }
  return (
    <Pressable style={[styles.actionRow, border && styles.actionRowBorder]} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={18} color={SemanticColors.textSecondary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

// Timeline entry component
function TimelineEntry({ icon, color, label, labelColor, date, showLine }: {
  icon: IconName;
  color: string;
  label: string;
  labelColor?: string;
  date: string;
  showLine?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <View style={[styles.timelineDot, { backgroundColor: color }]}>
          <Ionicons name={icon} size={10} color="#fff" />
        </View>
        {showLine && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={[styles.timelineLabel, labelColor ? { color: labelColor } : undefined]}>{label}</Text>
        {date ? <Text style={styles.timelineDate}>{date}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
    paddingTop: SafeArea.top,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    backgroundColor: DK.colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: DK.colors.border,
    gap: GRID.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: DK.type.display900,
    color: DK.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  // R66r44: status pill with subtle border separator + display800 weight
  statusBadge: {
    paddingHorizontal: GRID.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  statusText: {
    fontSize: 10,
    fontFamily: DK.type.display800,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.md,
    gap: GRID.md,
  },
  // R66r44 DK polish — Hero with gradient + amber glow + Archivo display
  heroCard: {
    borderRadius: DK.radius.card,
    paddingVertical: GRID.lg + 8,
    paddingHorizontal: GRID.lg,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DK.colors.border,
    ...DK.effects.heroGlow,
  },
  heroLabel: {
    fontSize: 11,
    fontFamily: DK.type.display800,
    color: DK.colors.textMuted,
    letterSpacing: 1.8,
  },
  heroAmount: {
    fontSize: 38,
    fontFamily: DK.type.display900,
    color: DK.colors.text,
    letterSpacing: -1,
  },
  heroDue: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    marginTop: 2,
  },
  // Card
  card: {
    backgroundColor: "#14181F",
    borderRadius: RADIUS.lg,
    padding: GRID.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    marginBottom: GRID.sm + 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Customer
  customerName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  customerJob: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.sm + 4,
    paddingVertical: GRID.sm,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Line items
  lineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.xs,
    gap: GRID.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    marginBottom: GRID.xs,
  },
  lineHeaderText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    // German "STÜCKPREIS" is 10 characters; at 0.5 letter-spacing it did not
    // fit the 70pt money column and RN broke it INSIDE the word
    // ("STÜCKPREI / S"). learnings #113: fix the width, not the font — a
    // single word longer than its line box breaks at any font size. Columns
    // widened to 82 and the spacing trimmed.
    letterSpacing: 0.2,
  },
  lineItemStack: {
    paddingVertical: GRID.sm,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  lineNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: GRID.sm,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.sm,
    gap: GRID.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  lineText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  lineTextMuted: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  lineInput: {
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.xs + 2,
    paddingVertical: GRID.xs,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  removeItemBtn: {
    width: 24,
    alignItems: 'center',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingVertical: GRID.sm,
    justifyContent: 'center',
  },
  addItemText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  // Totals
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: GRID.xs + 2,
  },
  totalLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  totalValue: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: GRID.sm,
    marginTop: GRID.xs,
  },
  totalFinalLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  totalFinalValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: TYPE.sectionTracking,
    color: SemanticColors.textPrimary,
  },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    marginTop: GRID.sm,
  },
  statusNoteText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.feedbackSuccess,
  },
  // Payment methods
  paymentMethodList: {
    gap: GRID.xs + 2,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.sm,
    paddingHorizontal: GRID.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  paymentMethodPreferred: {
    backgroundColor: SemanticColors.surfaceBackground,
  },
  paymentMethodIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentMethodName: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  preferredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingHorizontal: GRID.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  preferredBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  preferenceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs + 2,
    marginTop: GRID.sm,
    paddingTop: GRID.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  preferenceNoteText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs + 2,
    marginTop: GRID.sm,
    paddingTop: GRID.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  securityNoteText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.sm + 4,
    gap: GRID.sm + 4,
  },
  actionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  // R66r44 DK polish — accent action row reads as a primary CTA pill.
  // Used for "Mark as paid" + future high-priority actions.
  actionRowAccent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm + 4,
    marginTop: GRID.sm,
    paddingVertical: GRID.md,
    paddingHorizontal: GRID.md,
    borderRadius: DK.radius.button,
    overflow: 'hidden',
    minHeight: 48,
    ...DK.effects.ctaShadow,
  },
  actionLabelAccent: {
    flex: 1,
    fontSize: 13,
    fontFamily: DK.type.display800,
    color: '#fff',
    letterSpacing: 1.2,
  },
  // Timeline
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: GRID.sm,
    minHeight: 40,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: GRID.sm,
  },
  timelineLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  timelineDate: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  // Notes
  notesInput: {
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.sm + 4,
    paddingVertical: GRID.sm,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    minHeight: 80,
  },
  notesText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 20,
  },
});
