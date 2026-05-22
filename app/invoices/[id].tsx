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
import { hapticError, hapticSuccess } from '../../src/utils/haptics';
import { generateInvoicePdf, buildInvoicePdfBase64 } from '../../src/services/invoicePdfService';
import { invoiceAutomationService } from '../../src/services/invoiceAutomationService';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../src/config/paymentMethods';
import { formatCurrency } from '../../src/i18n/formatting';
import {
  getCustomerPaymentPreference,
  getPaymentMethodLabel,
} from '../../src/services/customerPaymentPreferenceService';
import { sendInvoice as sendInvoiceEmail } from '../../src/services/sendInvoiceService';
import { effectiveStep, renderReminder } from '../../src/services/reminderCadenceService';
import { computeLateFee, disclosureLineLocalized, type LateFeeCountry } from '../../src/services/lateFeeService';
import { generateXRechnungXML, generateZUGFeRDXML, type EInvoiceData } from '../../src/integrations/einvoice';
import { Share as RNShare } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { checkInvoiceReadiness } from '../../src/utils/businessProfileValidation';
import { useCohortDso } from '../../src/services/paymentTimingMoatService';
import { predictPaymentTiming } from '../../src/intelligence/mlModels';
import { useTimeOfDayPaymentHint, dayPart as paymentDayPart, classifyPaymentNow } from '../../src/services/timeOfDayPaymentService';

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
  } = useAppState();
  const { user } = useAuth();
  const invoice = invoices.find((item) => item.id === id);
  const country = user?.country ?? 'NL';
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
        // Synthesize a single line item from total
        setLocalItems([{
          id: 'item-1',
          description: invoice.job || t('invoices.services', 'Services rendered'),
          quantity: 1,
          unitPrice: invoice.amount / (1 + VAT_RATE),
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
  const vatAmount = subtotal * VAT_RATE;
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
    const finalTotal = newTotal * (1 + VAT_RATE);
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
        customer: invoice.customer,
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

    const customerEmail = (invoice as any).customerEmail ?? (invoice as any).customer_email;
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
      const step = await effectiveStep((invoice as any).customer ?? '', daysOverdue);
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
          customer: invoice.customer,
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
    const currency = country === 'UK' ? 'GBP' : 'EUR';
    const vatAmount = total * VAT_RATE;
    const data: EInvoiceData = {
      sellerName: (businessProfile as any)?.businessName ?? 'Vasco',
      sellerAddress: (businessProfile as any)?.address ?? '',
      sellerVatId: (businessProfile as any)?.vatId ?? '',
      buyerName: invoice.customer ?? '',
      buyerAddress: (invoice as any).customerAddress ?? '',
      buyerVatId: (invoice as any).customerVatId,
      invoiceNumber: (invoice as any).reference ?? invoice.id,
      invoiceDate: (invoice as any).issuedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + (invoice.dueInDays || 14) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      currency,
      lineItems: localItems.map((li: EditableLineItem) => ({
        description: li.description,
        quantity: li.quantity,
        unitCode: 'piece',
        unitPrice: li.unitPrice,
        vatRate: VAT_RATE * 100,
        vatAmount: li.quantity * li.unitPrice * VAT_RATE,
        lineTotal: li.quantity * li.unitPrice,
      })),
      totalNet: total,
      totalVat: vatAmount,
      totalGross: total + vatAmount,
      iban: (businessProfile as any)?.iban,
      bic: (businessProfile as any)?.bic,
      paymentReference: (invoice as any).reference ?? invoice.id,
    };
    const xml = format === 'XRechnung' ? generateXRechnungXML(data) : generateZUGFeRDXML(data);
    const filename = `${data.invoiceNumber}-${format.toLowerCase()}.xml`;

    try {
      const file = new File(Paths.cache, filename);
      file.write(xml);
      await RNShare.share({ url: file.uri, title: filename });
      hapticSuccess();
    } catch {
      // Fallback: share XML as plain text if filesystem/share fails
      await RNShare.share({ message: xml, title: filename });
    }
  };

  // R302: ES Facturae 3.2.2 export. Mandatory in Spain for B2G + large B2B.
  // EInvoiceData → FacturaeInvoice mapper. Many Spanish-specific fields
  // (province, NIF, person type, regime fiscal) aren't on the businessProfile
  // today — sensible defaults applied; user can extend businessProfile schema
  // if they want richer XML.
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
    const vatAmount = total * VAT_RATE;
    const invoiceNumber = (invoice as any).reference ?? invoice.id;
    const data = {
      schemaVersion: '3.2.2' as const,
      sellerName: (businessProfile as any)?.businessName ?? 'Vasco',
      sellerNif: (businessProfile as any)?.vatId ?? (businessProfile as any)?.nifNumber ?? '',
      sellerAddress: (businessProfile as any)?.address ?? '',
      sellerCity: (businessProfile as any)?.city ?? '',
      sellerPostalCode: (businessProfile as any)?.postcode ?? '',
      sellerProvince: (businessProfile as any)?.province ?? '',
      sellerCountry: 'ESP',
      sellerPersonType: 'J' as const,           // Default to legal entity
      sellerRegimeFiscal: '01' as const,         // General regime
      buyerName: invoice.customer ?? '',
      buyerNif: (invoice as any).customerVatId ?? '',
      buyerAddress: (invoice as any).customerAddress ?? '',
      buyerCity: '',
      buyerPostalCode: '',
      buyerProvince: '',
      buyerCountry: 'ESP',
      buyerPersonType: 'J' as const,
      invoiceNumber,
      invoiceDate: (invoice as any).issuedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + (invoice.dueInDays || 14) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      currency: 'EUR',
      lineItems: localItems.map((li: EditableLineItem) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        lineTotal: li.quantity * li.unitPrice,
        ivaRate: VAT_RATE * 100,
        ivaAmount: li.quantity * li.unitPrice * VAT_RATE,
      })),
      totalNet: total,
      totalVat: vatAmount,
      totalIrpf: 0,
      totalGross: total + vatAmount,
      iban: (businessProfile as any)?.iban,
      bic: (businessProfile as any)?.bic,
      paymentMethod: '04', // bank transfer
    };
    const xml = generateFacturaeXml(data);
    const filename = `${invoiceNumber}-facturae.xml`;
    try {
      const file = new File(Paths.cache, filename);
      file.write(xml);
      await RNShare.share({ url: file.uri, title: filename });
      hapticSuccess();
    } catch {
      await RNShare.share({ message: xml, title: filename });
    }
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
    const vatAmount = total * VAT_RATE;
    const invoiceNumber = (invoice as any).reference ?? invoice.id;
    const data: any = {
      sellerName: (businessProfile as any)?.businessName ?? 'Vasco',
      sellerVatId: (businessProfile as any)?.vatId ?? '',
      sellerCodiceFiscale: (businessProfile as any)?.codiceFiscale ?? (businessProfile as any)?.vatId ?? '',
      sellerAddress: (businessProfile as any)?.address ?? '',
      sellerCity: (businessProfile as any)?.city ?? '',
      sellerPostalCode: (businessProfile as any)?.postcode ?? '',
      sellerProvince: (businessProfile as any)?.province ?? '',
      sellerCountry: 'IT',
      buyerName: invoice.customer ?? '',
      buyerVatId: (invoice as any).customerVatId,
      buyerCodiceFiscale: (invoice as any).customerCodiceFiscale ?? '',
      buyerAddress: (invoice as any).customerAddress ?? '',
      buyerCity: '',
      buyerPostalCode: '',
      buyerProvince: '',
      buyerCountry: 'IT',
      invoiceNumber,
      invoiceDate: (invoice as any).issuedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + (invoice.dueInDays || 14) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      currency: 'EUR',
      lineItems: localItems.map((li: EditableLineItem) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        lineTotal: li.quantity * li.unitPrice,
        ivaRate: VAT_RATE * 100,
        ivaAmount: li.quantity * li.unitPrice * VAT_RATE,
      })),
      totalNet: total,
      totalVat: vatAmount,
      totalGross: total + vatAmount,
      iban: (businessProfile as any)?.iban,
      paymentMethod: 'MP05', // SDI code for bank transfer
    };
    const xml = generateFatturaPAXml(data);
    const filename = `${invoiceNumber}-fatturapa.xml`;
    try {
      const file = new File(Paths.cache, filename);
      file.write(xml);
      await RNShare.share({ url: file.uri, title: filename });
      hapticSuccess();
    } catch {
      await RNShare.share({ message: xml, title: filename });
    }
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
        if (country === 'ES') return handleExportFacturae();
        if (country === 'IT') return handleExportFatturaPA();
        // DE / NL / FR / UK / others default to XRechnung (works for B2G;
        // consumer can manually pick ZUGFeRD if they want hybrid PDF+XML).
        return handleExportEInvoice('XRechnung');
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
          <Text style={styles.headerTitle}>{t('invoices.invoice', 'Invoice')} {invoice.id}</Text>
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
          <Text style={styles.customerName}>{invoice.customer}</Text>
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

          {/* Column headers */}
          <View style={styles.lineHeaderRow}>
            <Text style={[styles.lineHeaderText, { flex: 2 }]}>{t('invoices.description', 'Description')}</Text>
            <Text style={[styles.lineHeaderText, { width: 40, textAlign: 'center' }]}>{t('invoices.qty', 'Qty')}</Text>
            <Text style={[styles.lineHeaderText, { width: 70, textAlign: 'right' }]}>{t('invoices.unitPrice', 'Price')}</Text>
            <Text style={[styles.lineHeaderText, { width: 70, textAlign: 'right' }]}>{t('invoices.total', 'Total')}</Text>
          </View>

          {/* Items */}
          {localItems.map((item) => (
            <View key={item.id} style={styles.lineItemRow}>
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
                    style={[styles.lineInput, { width: 70, textAlign: 'right' }]}
                    value={String(item.unitPrice)}
                    onChangeText={(v) => handleUpdateItem(item.id, 'unitPrice', v)}
                    keyboardType="numeric"
                  />
                  <Pressable onPress={() => handleRemoveItem(item.id)} style={styles.removeItemBtn}>
                    <Ionicons name="close-circle" size={18} color={SemanticColors.feedbackError} />
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.lineText, { flex: 2 }]} numberOfLines={2}>{item.description}</Text>
                  <Text style={[styles.lineTextMuted, { width: 40, textAlign: 'center' }]}>{item.quantity}</Text>
                  <Text style={[styles.lineTextMuted, { width: 70, textAlign: 'right' }]}>{formatCurrency(item.unitPrice, country)}</Text>
                  <Text style={[styles.lineText, { width: 70, textAlign: 'right' }]}>{formatCurrency(item.quantity * item.unitPrice, country)}</Text>
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
            <Text style={styles.totalLabel}>{t('invoices.vat', 'VAT')} (21%)</Text>
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

        {/* Payment Methods */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.cardTitle}>{t('invoices.offeredPaymentMethods', 'Payment methods')}</Text>
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
          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={12} color={SemanticColors.textTertiary} />
            <Text style={styles.securityNoteText}>
              {t('invoices.secureVia', { defaultValue: 'Secure via {{provider}} · PCI DSS compliant', provider: country === 'UK' ? 'Stripe' : 'Mollie' })}
            </Text>
          </View>
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
          <ActionRow
            icon="card-outline"
            label={mollieConnected ? t('invoices.createPaymentLink', 'Create payment link') : t('invoices.connectMollie', 'Connect Mollie')}
            onPress={() => mollieConnected ? handleCreatePayment() : router.push('/(modals)/mollie' as any)}
            border
          />
          <ActionRow
            icon="cloud-upload-outline"
            label={t('invoices.exportMoneybird', 'Export to Moneybird')}
            onPress={() => moneybirdConnected ? handleExportMoneybird() : router.push('/(modals)/moneybird' as any)}
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
          {/* R302: ES Facturae export — mandatory for B2G + large B2B in Spain. */}
          {country === 'ES' && (
            <ActionRow
              icon="code-slash-outline"
              label={t('invoices.exportFacturae', 'Export Facturae (XML)')}
              onPress={handleExportFacturae}
              border
            />
          )}
          {/* R302: IT FatturaPA export — mandatory for ALL Italian invoices via SDI. */}
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
                ? new Date(invoice.lastUpdated).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
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
                  ? new Date(new Date(invoice.dueDate).getTime() - 14 * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
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
                  ? new Date(invoice.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
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
                  ? new Date(invoice.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
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
    letterSpacing: 0.5,
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
