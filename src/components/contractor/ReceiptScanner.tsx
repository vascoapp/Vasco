// =============================================================================
// RECEIPT SCANNER COMPONENT
// =============================================================================
// Allows contractors to scan/photograph receipts and invoices
// Extracted data feeds into the pricing intelligence moat
// =============================================================================

import { useState, useCallback } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  invoiceExtractor,
  ExtractedInvoice,
  ExtractedLineItem,
  ExtractionResult,
} from '../../ingestion/invoiceExtractor';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MAIN COMPONENT
// ============================================

interface ReceiptScannerProps {
  onComplete?: (result: ExtractionResult) => void;
  onClose?: () => void;
}

export function ReceiptScanner({ onComplete, onClose }: ReceiptScannerProps) {
  const [mode, setMode] = useState<'capture' | 'review' | 'result'>('capture');
  const [rawText, setRawText] = useState('');
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExtract = useCallback(async () => {
    if (!rawText.trim()) {
      Alert.alert('Geen tekst', 'Voer de boninhoud in of maak een foto.');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await invoiceExtractor.extractFromText(rawText, 'manual_entry');
      setExtractionResult(result);
      setMode('review');
    } catch (error) {
      Alert.alert('Fout', 'Kon de bon niet verwerken. Probeer opnieuw.');
    } finally {
      setIsProcessing(false);
    }
  }, [rawText]);

  const handleConfirm = useCallback(() => {
    if (extractionResult) {
      setMode('result');
      onComplete?.(extractionResult);
    }
  }, [extractionResult, onComplete]);

  const handleScanAgain = useCallback(() => {
    setRawText('');
    setExtractionResult(null);
    setMode('capture');
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'capture' && 'Bon Scannen'}
          {mode === 'review' && 'Controleren'}
          {mode === 'result' && 'Verwerkt'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {mode === 'capture' && (
        <CaptureMode
          rawText={rawText}
          onTextChange={setRawText}
          onExtract={handleExtract}
          isProcessing={isProcessing}
        />
      )}

      {mode === 'review' && extractionResult?.invoice && (
        <ReviewMode
          invoice={extractionResult.invoice}
          result={extractionResult}
          onConfirm={handleConfirm}
          onScanAgain={handleScanAgain}
        />
      )}

      {mode === 'result' && extractionResult && (
        <ResultMode
          result={extractionResult}
          onScanAnother={handleScanAgain}
          onClose={onClose}
        />
      )}
    </View>
  );
}

// ============================================
// CAPTURE MODE
// ============================================

interface CaptureModeProps {
  rawText: string;
  onTextChange: (text: string) => void;
  onExtract: () => void;
  isProcessing: boolean;
}

function CaptureMode({ rawText, onTextChange, onExtract, isProcessing }: CaptureModeProps) {
  const handleDemoText = () => {
    // Insert demo invoice text for testing
    onTextChange(`HORNBACH - Factuur
Factuurnr: HB-2024-00847
Datum: 28-01-2024

Artikelen:
Flexa Strak in de Lak wit 2.5L      2x    €34,95    €69,90
Dulux Muurverf mat wit 10L          1x    €89,00    €89,00
Afplaktape blauw 50mm               3x    €4,95     €14,85
Verfroller 25cm                     2x    €8,50     €17,00
Kwasten set 5-delig                 1x    €12,95    €12,95
Schuurpapier P120 pak              2x    €6,50     €13,00

Subtotaal excl. BTW:                      €179,92
BTW 21%:                                  €37,78
Totaal:                                   €217,70`);
  };

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      {/* Capture Options */}
      <View style={styles.captureOptions}>
        <Pressable style={styles.captureOption}>
          <View style={[styles.captureOptionIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
            <Ionicons name="camera" size={32} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.captureOptionLabel}>Foto maken</Text>
          <Text style={styles.captureOptionHint}>Maak een foto van de bon</Text>
        </Pressable>

        <Pressable style={styles.captureOption}>
          <View style={[styles.captureOptionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
            <Ionicons name="document" size={32} color={SemanticColors.feedbackInfo} />
          </View>
          <Text style={styles.captureOptionLabel}>PDF uploaden</Text>
          <Text style={styles.captureOptionHint}>Selecteer een PDF factuur</Text>
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>of voer handmatig in</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Manual Text Entry */}
      <View style={styles.manualEntry}>
        <View style={styles.manualEntryHeader}>
          <Text style={styles.manualEntryLabel}>Bon inhoud</Text>
          <Pressable onPress={handleDemoText}>
            <Text style={styles.demoLink}>Demo tekst</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.textArea}
          placeholder="Plak hier de tekst van de bon of factuur..."
          placeholderTextColor={SemanticColors.textTertiary}
          value={rawText}
          onChangeText={onTextChange}
          multiline
          numberOfLines={10}
          textAlignVertical="top"
        />
      </View>

      {/* Extract Button */}
      <Pressable
        style={[styles.extractButton, !rawText.trim() && styles.extractButtonDisabled]}
        onPress={onExtract}
        disabled={!rawText.trim() || isProcessing}
      >
        {isProcessing ? (
          <Text style={styles.extractButtonText}>Verwerken...</Text>
        ) : (
          <>
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.extractButtonText}>Verwerk met AI</Text>
          </>
        )}
      </Pressable>

      {/* Info */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color={SemanticColors.feedbackInfo} />
        <Text style={styles.infoText}>
          Prijzen worden automatisch opgeslagen om u betere inkoopadviezen te geven.
        </Text>
      </View>
    </ScrollView>
  );
}

// ============================================
// REVIEW MODE
// ============================================

interface ReviewModeProps {
  invoice: ExtractedInvoice;
  result: ExtractionResult;
  onConfirm: () => void;
  onScanAgain: () => void;
}

function ReviewMode({ invoice, result, onConfirm, onScanAgain }: ReviewModeProps) {
  const confidencePercent = Math.round(invoice.extractionConfidence * 100);

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      {/* Confidence Indicator */}
      <View style={styles.confidenceCard}>
        <View style={styles.confidenceHeader}>
          <Ionicons
            name={confidencePercent >= 70 ? 'checkmark-circle' : 'alert-circle'}
            size={24}
            color={confidencePercent >= 70 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning}
          />
          <Text style={styles.confidenceText}>
            {confidencePercent}% zekerheid
          </Text>
        </View>
        {confidencePercent < 70 && (
          <Text style={styles.confidenceHint}>
            Controleer de gegevens hieronder extra goed
          </Text>
        )}
      </View>

      {/* Invoice Header */}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewCardTitle}>Factuurgegevens</Text>

        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Type</Text>
          <Text style={styles.reviewValue}>
            {invoice.documentType === 'invoice' && 'Factuur'}
            {invoice.documentType === 'receipt' && 'Kassabon'}
            {invoice.documentType === 'quote' && 'Offerte'}
            {invoice.documentType === 'order' && 'Bestelling'}
            {invoice.documentType === 'unknown' && 'Onbekend'}
          </Text>
        </View>

        {invoice.supplierName && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Leverancier</Text>
            <Text style={styles.reviewValue}>{invoice.supplierName}</Text>
          </View>
        )}

        {invoice.documentNumber && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Nummer</Text>
            <Text style={styles.reviewValue}>{invoice.documentNumber}</Text>
          </View>
        )}

        {invoice.documentDate && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Datum</Text>
            <Text style={styles.reviewValue}>{invoice.documentDate}</Text>
          </View>
        )}
      </View>

      {/* Line Items */}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewCardTitle}>
          Artikelen ({invoice.lineItems.length})
        </Text>

        {invoice.lineItems.map((item, index) => (
          <LineItemRow key={item.id} item={item} index={index} />
        ))}
      </View>

      {/* Totals */}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewCardTitle}>Totalen</Text>

        {invoice.subtotal && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Subtotaal</Text>
            <Text style={styles.reviewValue}>€{invoice.subtotal.toFixed(2)}</Text>
          </View>
        )}

        {invoice.vatAmount && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>BTW ({invoice.vatRate || 21}%)</Text>
            <Text style={styles.reviewValue}>€{invoice.vatAmount.toFixed(2)}</Text>
          </View>
        )}

        {invoice.total && (
          <View style={[styles.reviewRow, styles.reviewRowTotal]}>
            <Text style={styles.reviewLabelTotal}>Totaal</Text>
            <Text style={styles.reviewValueTotal}>€{invoice.total.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <View style={styles.warningsCard}>
          <Ionicons name="warning" size={18} color={SemanticColors.feedbackWarning} />
          <View style={styles.warningsList}>
            {result.warnings.map((warning, index) => (
              <Text key={index} style={styles.warningText}>{warning}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.reviewActions}>
        <Pressable style={styles.secondaryButton} onPress={onScanAgain}>
          <Text style={styles.secondaryButtonText}>Opnieuw scannen</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onConfirm}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Bevestigen</Text>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ============================================
// LINE ITEM ROW
// ============================================

function LineItemRow({ item, index }: { item: ExtractedLineItem; index: number }) {
  const confidenceColor = item.confidence >= 0.7
    ? SemanticColors.feedbackSuccess
    : item.confidence >= 0.5
      ? SemanticColors.feedbackWarning
      : SemanticColors.feedbackError;

  return (
    <View style={styles.lineItem}>
      <View style={styles.lineItemMain}>
        <View style={styles.lineItemNumber}>
          <Text style={styles.lineItemNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.lineItemContent}>
          <Text style={styles.lineItemDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.lineItemDetails}>
            <Text style={styles.lineItemQty}>
              {item.quantity} {item.unit}
            </Text>
            <Text style={styles.lineItemUnitPrice}>
              × €{item.unitPrice.toFixed(2)}
            </Text>
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{item.category}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.lineItemTotal}>€{item.totalPrice.toFixed(2)}</Text>
      </View>
      <View style={[styles.confidenceBar, { backgroundColor: confidenceColor + '30' }]}>
        <View
          style={[
            styles.confidenceBarFill,
            { width: `${item.confidence * 100}%`, backgroundColor: confidenceColor },
          ]}
        />
      </View>
    </View>
  );
}

// ============================================
// RESULT MODE
// ============================================

interface ResultModeProps {
  result: ExtractionResult;
  onScanAnother: () => void;
  onClose?: () => void;
}

function ResultMode({ result, onScanAnother, onClose }: ResultModeProps) {
  return (
    <View style={styles.resultContainer}>
      <View style={styles.resultIcon}>
        <Ionicons name="checkmark-circle" size={64} color={SemanticColors.feedbackSuccess} />
      </View>

      <Text style={styles.resultTitle}>Bon verwerkt!</Text>
      <Text style={styles.resultSubtitle}>
        De prijzen zijn toegevoegd aan uw prijsintelligentie
      </Text>

      <View style={styles.resultStats}>
        <View style={styles.resultStat}>
          <Text style={styles.resultStatValue}>{result.priceObservationsCreated}</Text>
          <Text style={styles.resultStatLabel}>Prijzen opgeslagen</Text>
        </View>
        <View style={styles.resultStatDivider} />
        <View style={styles.resultStat}>
          <Text style={styles.resultStatValue}>{result.materialsResolved}</Text>
          <Text style={styles.resultStatLabel}>Materialen herkend</Text>
        </View>
      </View>

      <View style={styles.resultActions}>
        <Pressable style={styles.primaryButton} onPress={onScanAnother}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Nog een bon scannen</Text>
        </Pressable>
        <Pressable style={styles.textButton} onPress={onClose}>
          <Text style={styles.textButtonText}>Sluiten</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },

  // Capture Options
  captureOptions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  captureOption: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  captureOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  captureOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  captureOptionHint: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
  },
  dividerText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Manual Entry
  manualEntry: {
    marginBottom: Spacing.lg,
  },
  manualEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  manualEntryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  demoLink: {
    fontSize: 13,
    color: Palette.hermesOrange,
    fontWeight: '500',
  },
  textArea: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 14,
    color: SemanticColors.textPrimary,
    minHeight: 200,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },

  // Extract Button
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  extractButtonDisabled: {
    opacity: 0.5,
  },
  extractButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    padding: Spacing.md,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },

  // Review Mode
  confidenceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  confidenceText: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  confidenceHint: {
    fontSize: 13,
    color: SemanticColors.feedbackWarning,
    marginTop: 4,
    marginLeft: 32,
  },
  reviewCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  reviewCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  reviewRowTotal: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    marginTop: 8,
    paddingTop: 12,
  },
  reviewLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  reviewLabelTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  reviewValueTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },

  // Line Item
  lineItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  lineItemMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  lineItemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  lineItemContent: {
    flex: 1,
  },
  lineItemDescription: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
    fontWeight: '500',
  },
  lineItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  lineItemQty: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  lineItemUnitPrice: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  categoryBadge: {
    backgroundColor: Palette.hermesOrange + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  lineItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  confidenceBar: {
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Warnings
  warningsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackWarningBg,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  warningsList: {
    flex: 1,
  },
  warningText: {
    fontSize: 13,
    color: SemanticColors.feedbackWarning,
  },

  // Review Actions
  reviewActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.md,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Result Mode
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  resultIcon: {
    marginBottom: Spacing.lg,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  resultStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  resultStat: {
    flex: 1,
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  resultStatLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  resultStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.lg,
  },
  resultActions: {
    width: '100%',
    gap: Spacing.md,
  },
  textButton: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  textButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
});
