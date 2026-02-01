import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Colors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';
import { parsePdfText } from '../../src/ingestion/pdfParser';
import { extractDocumentFromText } from '../../src/ingestion/pdfExtract';

export default function IngestionModal() {
  const { ingestPdfHistory, extractedDocs, priceRisks, addExtractedDoc } = useAppState();
  const pdfCount = extractedDocs.length;
  const formatCurrency = (value: number) =>
    `€${value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;
  const handlePdfUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      try {
        const fileUri = result.assets[0]?.uri;
        if (!fileUri) {
          ingestPdfHistory();
          return;
        }
        const text = await parsePdfText(fileUri);
        const doc = extractDocumentFromText(text);
        addExtractedDoc(doc);
      } catch (error) {
        ingestPdfHistory();
      }
    }
  };

  return (
    <Screen backgroundColor={Colors.surface}>
      <View style={styles.container}>
        <Text style={Typography.title}>Ingestion pool</Text>
        <Text style={Typography.muted}>
          Add past quotes, invoices, emails, or PDFs. You choose what gets shared.
        </Text>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Accepted files</Text>
          <Text style={Typography.muted}>PDFs, email exports, photos, and notes</Text>
          <PrimaryButton label="Upload PDF" onPress={handlePdfUpload} />
          <Text style={Typography.muted}>
            {pdfCount === 0 ? 'No PDFs added yet.' : `${pdfCount} PDFs added.`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>What we learn</Text>
          <Text style={Typography.muted}>
            Pricing benchmarks, missing scope items, and payment risk signals.
          </Text>
          <Text style={Typography.muted}>
            Price‑risk signals found: {priceRisks.length}
          </Text>
          <Link href="/(modals)/insights" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>View insights</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.card}>
          <Text style={Typography.subtitle}>Parsed documents</Text>
          {extractedDocs.length === 0 ? (
            <Text style={Typography.muted}>No parsed PDFs yet.</Text>
          ) : (
            extractedDocs.map((doc, index) => (
              <View key={`${doc.docType}-${index}`} style={styles.docRow}>
                <View>
                  <Text style={Typography.body}>
                    {doc.docType === 'invoice' ? 'Invoice' : 'Quote'}
                  </Text>
                  <Text style={Typography.muted}>
                    {doc.lineItems.length} line items
                  </Text>
                </View>
                <Text style={Typography.body}>{formatCurrency(doc.total)}</Text>
              </View>
            ))
          )}
        </View>
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
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryText: {
    color: Colors.text,
    fontWeight: '600',
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
