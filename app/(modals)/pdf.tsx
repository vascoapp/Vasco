import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen } from '../../src/components/Screen';
import { SemanticColors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { invoiceAutomationService } from '../../src/services/invoiceAutomationService';
import { generateInvoicePdf } from '../../src/services/invoicePdfService';
import { useAppState } from '../../src/state/AppState';

export default function PdfModal() {
  const { source, id } = useLocalSearchParams<{ source?: string; id?: string }>();
  const router = useRouter();
  const { businessProfile, jobs } = useAppState();
  const [generating, setGenerating] = useState(false);

  const label = source === 'invoice' ? 'Factuur' : 'Offerte';

  const handleGenerate = async () => {
    if (source === 'invoice' && id) {
      const invoice = invoiceAutomationService.getInvoice(id);
      if (!invoice) {
        Alert.alert('Fout', 'Factuur niet gevonden.');
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
        await generateInvoicePdf(invoice, businessProfile, undefined, customerSignature ? { customerSignature } : undefined);
      } catch (err) {
        Alert.alert('Fout', 'PDF kon niet worden gegenereerd.');
      } finally {
        setGenerating(false);
      }
    } else {
      Alert.alert('Info', `${label} PDF wordt binnenkort ondersteund.`);
    }
  };

  return (
    <Screen backgroundColor={SemanticColors.surfacePrimary}>
      <View style={styles.container}>
        <Text style={Typography.title}>{label} PDF</Text>
        <Text style={Typography.muted}>
          Genereer een professionele PDF en deel deze via e-mail, WhatsApp of sla op.
        </Text>
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Wat gebeurt er</Text>
          <Text style={Typography.muted}>
            Vasco maakt een merk-PDF aan met uw bedrijfsgegevens, regelitems, BTW-berekening en betalingsinformatie. U kunt de PDF direct delen of opslaan.
          </Text>
        </View>
        <PrimaryButton
          label={generating ? 'Genereren...' : `${label} PDF genereren`}
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
