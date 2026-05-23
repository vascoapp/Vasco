import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { invoiceAutomationService } from '../../src/services/invoiceAutomationService';
import { generateInvoicePdf } from '../../src/services/invoicePdfService';
import { useAppState } from '../../src/state/AppState';
import { checkInvoiceReadiness } from '../../src/utils/businessProfileValidation';

// R116: full i18n pass. Pre-R116 every label, alert title, alert body,
// section header, and button caption in this modal was hardcoded Dutch
// ("Factuur" / "Profiel onvolledig" / "Vul je bedrijfsgegevens..." /
// "Wat gebeurt er" / "Genereren..."). Visible to ALL contractors
// regardless of locale — the PDF share flow is hit on every quote /
// invoice send.
export default function PdfModal() {
  const { t } = useTranslation();
  const { source, id } = useLocalSearchParams<{ source?: string; id?: string }>();
  const router = useRouter();
  const { businessProfile, jobs, invoices } = useAppState();
  const [generating, setGenerating] = useState(false);

  const label = source === 'invoice'
    ? t('pdfModal.labelInvoice', 'Invoice')
    : t('pdfModal.labelQuote', 'Quote');

  const handleGenerate = async () => {
    if (source === 'invoice' && id) {
      // R66 round 34: legal gate. Same Belastingdienst Art. 35 reasoning
      // as the in-detail PDF button — block generation when KvK / BTW /
      // business name are missing.
      const readiness = checkInvoiceReadiness(businessProfile);
      if (!readiness.ready) {
        Alert.alert(
          t('pdfModal.profileIncomplete', 'Profile incomplete'),
          t('pdfModal.profileIncompleteBody', 'Fill in your business details before sharing an invoice.') + '\n\n' +
            [...readiness.missingLabels, ...readiness.invalidLabels].map((l) => `• ${l}`).join('\n'),
        );
        return;
      }
      const invoice = invoiceAutomationService.getInvoice(id);
      if (!invoice) {
        Alert.alert(
          t('common.error', 'Error'),
          t('pdfModal.invoiceNotFound', 'Invoice not found.'),
        );
        return;
      }
      setGenerating(true);
      try {
        // R303: customer-handover signature embed when linked job has one
        const linkedJob = (invoice as any).jobId
          ? jobs.find((j: any) => j.id === (invoice as any).jobId)
          : null;
        const customerSignature = linkedJob?.signatureSvg && linkedJob?.customerSignoffAt
          ? {
              svgDataUri: linkedJob.signatureSvg,
              signedAt: linkedJob.customerSignoffAt,
              signerName: invoice.customerName ?? 'Customer',
            }
          : undefined;
        // R66 round 47: prefer persisted documents.delivery_date (hydrated
        // into AppState invoice.deliveryDate via mapper) over FE-derive from
        // linked job. AutoInvoice in-memory store doesn't hydrate from BE
        // automatically — look up the AppState invoice by id to grab the
        // persisted snapshot.
        const appStateInvoice = invoices.find((inv: any) => inv.id === invoice.id || inv.id === invoice.invoiceNumber);
        const persistedDeliveryDate = (appStateInvoice as any)?.deliveryDate as string | undefined;
        const enriched: typeof invoice = {
          ...invoice,
          deliveryDate: persistedDeliveryDate
            ? new Date(persistedDeliveryDate)
            : linkedJob?.completedAt
              ? new Date(linkedJob.completedAt)
              : invoice.deliveryDate,
        };
        await generateInvoicePdf(enriched, businessProfile, undefined, customerSignature ? { customerSignature } : undefined);
      } catch (err) {
        Alert.alert(
          t('common.error', 'Error'),
          t('pdfModal.generateFailed', 'PDF could not be generated.'),
        );
      } finally {
        setGenerating(false);
      }
    } else {
      Alert.alert(
        t('common.info', 'Info'),
        t('pdfModal.quotePdfComingSoon', '{{label}} PDF support is coming soon.', { label }),
      );
    }
  };

  return (
    <Screen backgroundColor={SemanticColors.surfacePrimary}>
      <View style={styles.container}>
        <Text style={Typography.title}>{label} PDF</Text>
        <Text style={Typography.muted}>
          {t('pdfModal.intro', 'Generate a professional PDF and share it via email, WhatsApp, or save it.')}
        </Text>
        <View style={styles.card}>
          <Text style={Typography.subtitle}>{t('pdfModal.whatHappens', 'What happens')}</Text>
          <Text style={Typography.muted}>
            {t('pdfModal.whatHappensBody', 'Vasco creates a branded PDF with your business details, line items, VAT calculation, and payment information. You can share or save the PDF directly.')}
          </Text>
        </View>
        <PrimaryButton
          label={generating
            ? t('pdfModal.generating', 'Generating…')
            : t('pdfModal.generateLabel', 'Generate {{label}} PDF', { label })}
          onPress={handleGenerate}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
});
