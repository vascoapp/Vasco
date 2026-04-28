// =============================================================================
// RECEIPT SCANNER COMPONENT
// =============================================================================
// Allows contractors to scan/photograph receipts and invoices
// Extracted data feeds into the pricing intelligence moat
// =============================================================================

import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import {
  invoiceExtractor,
  ExtractedInvoice,
  ExtractedLineItem,
  ExtractionResult,
} from '../../ingestion/invoiceExtractor';
import {
  scanInvoicePhoto,
  type ScannedInvoice,
} from '../../services/invoiceScanService';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MAIN COMPONENT
// ============================================

interface ReceiptScannerProps {
  onComplete?: (result: ExtractionResult) => void;
  onClose?: () => void;
}

export function ReceiptScanner({ onComplete, onClose }: ReceiptScannerProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'capture' | 'review' | 'result'>('capture');
  const [rawText, setRawText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // -------------------------------------------------------
  // Convert ScannedInvoice (from Claude Vision) → ExtractionResult
  // -------------------------------------------------------
  const scannedToResult = (scanned: ScannedInvoice, uri: string): ExtractionResult => ({
    success: true,
    invoice: {
      id: scanned.id,
      documentType: scanned.documentType === 'delivery_note' ? 'unknown' : scanned.documentType,
      documentNumber: scanned.documentNumber,
      documentDate: scanned.documentDate,
      supplierName: scanned.supplierName,
      supplierId: scanned.supplierName.toLowerCase().replace(/\s+/g, '_'),
      subtotal: scanned.subtotal,
      vatAmount: scanned.vatAmount,
      total: scanned.total,
      currency: 'EUR',
      lineItems: scanned.lineItems.map((li, idx) => ({
        id: `item_${idx}`,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unitPrice: li.unitPrice,
        totalPrice: li.totalPrice,
        confidence: li.confidence / 100,
        productName: li.description,
        brand: li.brand,
        sku: li.articleNumber,
        category: li.category,
      })),
      rawText: '',
      extractionConfidence: scanned.confidence / 100,
      extractedAt: scanned.scannedAt,
      sourceUri: uri,
    },
    errors: [],
    warnings: scanned.confidence < 70 ? [t('receipt.lowConfidence', 'Low confidence - please verify extracted data')] : [],
    priceObservationsCreated: scanned.lineItems.length,
    materialsResolved: scanned.lineItems.filter(li => li.brand || li.articleNumber).length,
  });

  // -------------------------------------------------------
  // Take photo with camera
  // -------------------------------------------------------
  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error', 'Error'), t('receipt.cameraPermission', 'Camera permission is required to scan receipts.'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setIsProcessing(true);

    try {
      // Use base64 from ImagePicker directly (set base64: true above)
      const base64 = asset.base64;
      if (!base64) {
        Alert.alert(t('common.error', 'Error'), t('receipt.processingFailed', 'Could not process the receipt. Please try again.'));
        setIsProcessing(false);
        return;
      }

      const scanned = await scanInvoicePhoto(base64);
      if (scanned) {
        const extractResult = scannedToResult(scanned, asset.uri);
        setExtractionResult(extractResult);
        setMode('review');
      } else {
        // Rate limited or failed — fall back to manual entry prompt
        Alert.alert(
          t('receipt.scanFailed', 'Scan not available'),
          t('receipt.scanFailedDesc', 'Could not process the photo. You can enter the receipt content manually below.'),
        );
      }
    } catch {
      Alert.alert(t('common.error', 'Error'), t('receipt.processingFailed', 'Could not process the receipt. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  }, [t]);

  // -------------------------------------------------------
  // Pick PDF / image from gallery
  // -------------------------------------------------------
  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const isPdf = asset.mimeType?.includes('pdf') || asset.name?.endsWith('.pdf');

      setIsProcessing(true);

      if (isPdf) {
        // PDF: binary PDFs can't be text-extracted client-side easily
        // Read as text — if it's a text-based PDF export, regex extraction works
        try {
          const file = new ExpoFile(asset.uri);
          const text = await file.text();
          // PDF binary won't parse as text — inform user to use photo instead
          if (!text || text.length < 20 || text.includes('%PDF')) {
            Alert.alert(
              t('receipt.pdfNotSupported', 'PDF text extraction'),
              t('receipt.pdfNotSupportedDesc', 'Take a photo of the document instead for best results, or paste the content manually.'),
            );
            setIsProcessing(false);
            return;
          }
          const extractResult = await invoiceExtractor.extractFromText(text, asset.uri);
          setExtractionResult(extractResult);
          setMode('review');
        } catch {
          Alert.alert(
            t('receipt.pdfNotSupported', 'PDF text extraction'),
            t('receipt.pdfNotSupportedDesc', 'Take a photo of the document instead for best results, or paste the content manually.'),
          );
        }
      } else {
        // Image file — read as base64 via File.arrayBuffer and send to Claude Vision
        setPhotoUri(asset.uri);
        try {
          const file = new ExpoFile(asset.uri);
          const buffer = await file.arrayBuffer();
          // Convert ArrayBuffer to base64
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const scanned = await scanInvoicePhoto(base64);
          if (scanned) {
            const extractResult = scannedToResult(scanned, asset.uri);
            setExtractionResult(extractResult);
            setMode('review');
          } else {
            Alert.alert(
              t('receipt.scanFailed', 'Scan not available'),
              t('receipt.scanFailedDesc', 'Could not process the image. You can enter the receipt content manually below.'),
            );
          }
        } catch {
          Alert.alert(
            t('receipt.scanFailed', 'Scan not available'),
            t('receipt.scanFailedDesc', 'Could not process the image. You can enter the receipt content manually below.'),
          );
        }
      }
    } catch {
      Alert.alert(t('common.error', 'Error'), t('receipt.processingFailed', 'Could not process the receipt. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  }, [t]);

  const handleExtract = useCallback(async () => {
    if (!rawText.trim()) {
      Alert.alert(t('receipt.noText', 'No text'), t('receipt.enterContentOrPhoto', 'Enter the receipt content or take a photo.'));
      return;
    }

    setIsProcessing(true);

    try {
      const result = await invoiceExtractor.extractFromText(rawText, 'manual_entry');
      setExtractionResult(result);
      setMode('review');
    } catch (error) {
      Alert.alert(t('common.error', 'Error'), t('receipt.processingFailed', 'Could not process the receipt. Please try again.'));
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
          {mode === 'capture' && t('receipt.scanReceipt', 'Scan Receipt')}
          {mode === 'review' && t('receipt.review', 'Review')}
          {mode === 'result' && t('receipt.processed', 'Processed')}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {mode === 'capture' && (
        <CaptureMode
          rawText={rawText}
          onTextChange={setRawText}
          onExtract={handleExtract}
          onTakePhoto={handleTakePhoto}
          onPickDocument={handlePickDocument}
          isProcessing={isProcessing}
          photoUri={photoUri}
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
  onTakePhoto: () => void;
  onPickDocument: () => void;
  isProcessing: boolean;
  photoUri: string | null;
}

function CaptureMode({ rawText, onTextChange, onExtract, onTakePhoto, onPickDocument, isProcessing, photoUri }: CaptureModeProps) {
  const { t } = useTranslation();

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

  if (isProcessing) {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color={Palette.hermesOrange} />
        <Text style={styles.processingText}>
          {t('receipt.analyzing', 'Analyzing receipt with AI...')}
        </Text>
        <Text style={styles.processingHint}>
          {t('receipt.analyzingHint', 'This takes a few seconds')}
        </Text>
        {photoUri && (
          <Image source={{ uri: photoUri }} style={styles.processingPreview} resizeMode="contain" />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
      {/* Capture Options */}
      <View style={styles.captureOptions}>
        <Pressable style={styles.captureOption} onPress={onTakePhoto}>
          <View style={[styles.captureOptionIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
            <Ionicons name="camera" size={32} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.captureOptionLabel}>
            {t('receipt.takePhoto', 'Foto maken')}
          </Text>
          <Text style={styles.captureOptionHint}>
            {t('receipt.takePhotoHint', 'Maak een foto van de bon')}
          </Text>
        </Pressable>

        <Pressable style={styles.captureOption} onPress={onPickDocument}>
          <View style={[styles.captureOptionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
            <Ionicons name="document" size={32} color={SemanticColors.feedbackInfo} />
          </View>
          <Text style={styles.captureOptionLabel}>
            {t('receipt.uploadDocument', 'PDF uploaden')}
          </Text>
          <Text style={styles.captureOptionHint}>
            {t('receipt.uploadDocumentHint', 'Selecteer een PDF factuur')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('receipt.orManualEntry', 'or enter manually')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Manual Text Entry */}
      <View style={styles.manualEntry}>
        <View style={styles.manualEntryHeader}>
          <Text style={styles.manualEntryLabel}>{t('receipt.receiptContent', 'Receipt content')}</Text>
          <Pressable onPress={handleDemoText}>
            <Text style={styles.demoLink}>{t('receipt.demoText', 'Demo text')}</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.textArea}
          placeholder={t('receipt.placeholder', 'Paste the receipt or invoice text here…')}
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
          <Text style={styles.extractButtonText}>{t('receipt.processing', 'Processing…')}</Text>
        ) : (
          <>
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.extractButtonText}>{t('receipt.processWithAi', 'Process with AI')}</Text>
          </>
        )}
      </Pressable>

      {/* Info */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color={SemanticColors.feedbackInfo} />
        <Text style={styles.infoText}>
          {t('receipt.infoText', 'Prices are auto-saved to give you better purchasing recommendations.')}
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
  const { t } = useTranslation();
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
            {t('receipt.confidence', '{{pct}}% confident', { pct: confidencePercent })}
          </Text>
        </View>
        {confidencePercent < 70 && (
          <Text style={styles.confidenceHint}>
            {t('receipt.checkCarefully', 'Double-check the data below carefully')}
          </Text>
        )}
      </View>

      {/* Invoice Header */}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewCardTitle}>{t('receipt.invoiceData', 'Invoice data')}</Text>

        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('receipt.type', 'Type')}</Text>
          <Text style={styles.reviewValue}>
            {invoice.documentType === 'invoice' && t('receipt.docInvoice', 'Invoice')}
            {invoice.documentType === 'receipt' && t('receipt.docReceipt', 'Receipt')}
            {invoice.documentType === 'quote' && t('receipt.docQuote', 'Quote')}
            {invoice.documentType === 'order' && t('receipt.docOrder', 'Order')}
            {invoice.documentType === 'unknown' && t('receipt.docUnknown', 'Unknown')}
          </Text>
        </View>

        {invoice.supplierName && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{t('receipt.supplier', 'Supplier')}</Text>
            <Text style={styles.reviewValue}>{invoice.supplierName}</Text>
          </View>
        )}

        {invoice.documentNumber && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{t('receipt.number', 'Number')}</Text>
            <Text style={styles.reviewValue}>{invoice.documentNumber}</Text>
          </View>
        )}

        {invoice.documentDate && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{t('receipt.date', 'Date')}</Text>
            <Text style={styles.reviewValue}>{invoice.documentDate}</Text>
          </View>
        )}
      </View>

      {/* Line Items */}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewCardTitle}>
          {t('receipt.articles', 'Articles ({{count}})', { count: invoice.lineItems.length })}
        </Text>

        {invoice.lineItems.map((item, index) => (
          <LineItemRow key={item.id} item={item} index={index} />
        ))}
      </View>

      {/* Totals */}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewCardTitle}>{t('receipt.totals', 'Totals')}</Text>

        {invoice.subtotal && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{t('receipt.subtotal', 'Subtotal')}</Text>
            <Text style={styles.reviewValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
        )}

        {invoice.vatAmount && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{t('receipt.vat', 'VAT')} ({invoice.vatRate || 21}%)</Text>
            <Text style={styles.reviewValue}>{formatCurrency(invoice.vatAmount)}</Text>
          </View>
        )}

        {invoice.total && (
          <View style={[styles.reviewRow, styles.reviewRowTotal]}>
            <Text style={styles.reviewLabelTotal}>{t('receipt.total', 'Total')}</Text>
            <Text style={styles.reviewValueTotal}>{formatCurrency(invoice.total)}</Text>
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
          <Text style={styles.secondaryButtonText}>{t('receipt.scanAgain', 'Scan again')}</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onConfirm}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>{t('receipt.confirm', 'Confirm')}</Text>
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
              x {formatCurrency(item.unitPrice)}
            </Text>
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{item.category}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.lineItemTotal}>{formatCurrency(item.totalPrice)}</Text>
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
  const { t } = useTranslation();
  return (
    <View style={styles.resultContainer}>
      <View style={styles.resultIcon}>
        <Ionicons name="checkmark-circle" size={64} color={SemanticColors.feedbackSuccess} />
      </View>

      <Text style={styles.resultTitle}>{t('receipt.processedTitle', 'Receipt processed!')}</Text>
      <Text style={styles.resultSubtitle}>
        {t('receipt.processedDesc', 'Prices have been added to your pricing intelligence')}
      </Text>

      <View style={styles.resultStats}>
        <View style={styles.resultStat}>
          <Text style={styles.resultStatValue}>{result.priceObservationsCreated}</Text>
          <Text style={styles.resultStatLabel}>{t('receipt.pricesSaved', 'Prices saved')}</Text>
        </View>
        <View style={styles.resultStatDivider} />
        <View style={styles.resultStat}>
          <Text style={styles.resultStatValue}>{result.materialsResolved}</Text>
          <Text style={styles.resultStatLabel}>{t('receipt.materialsRecognized', 'Materials recognized')}</Text>
        </View>
      </View>

      <View style={styles.resultActions}>
        <Pressable style={styles.primaryButton} onPress={onScanAnother}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>{t('receipt.scanAnother', 'Scan another receipt')}</Text>
        </Pressable>
        <Pressable style={styles.textButton} onPress={onClose}>
          <Text style={styles.textButtonText}>{t('common.close', 'Close')}</Text>
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
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
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
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  captureOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  captureOptionLabel: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  captureOptionHint: {
    fontSize: TYPE.labelSize,
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
    fontSize: TYPE.labelSize,
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
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  demoLink: {
    fontSize: TYPE.captionSize,
    color: Palette.hermesOrange,
    fontFamily: TYPE.labelFamily,
  },
  textArea: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    fontSize: TYPE.bodySize - 1,
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
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  extractButtonDisabled: {
    opacity: 0.5,
  },
  extractButtonText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    padding: Spacing.md,
    borderRadius: RADIUS.md,
  },
  infoText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },

  // Review Mode
  confidenceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
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
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  confidenceHint: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.feedbackWarning,
    marginTop: 4,
    marginLeft: 32,
  },
  reviewCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  reviewCardTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
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
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  reviewValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  reviewLabelTotal: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  reviewValueTotal: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
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
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemNumberText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  lineItemContent: {
    flex: 1,
  },
  lineItemDescription: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
    fontFamily: TYPE.labelFamily,
  },
  lineItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  lineItemQty: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  lineItemUnitPrice: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
  },
  categoryBadge: {
    backgroundColor: Palette.hermesOrange + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  lineItemTotal: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
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
    borderRadius: RADIUS.md,
    marginBottom: Spacing.md,
  },
  warningsList: {
    flex: 1,
  },
  warningText: {
    fontSize: TYPE.captionSize,
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
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  secondaryButtonText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.md,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange,
  },
  primaryButtonText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
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
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  resultStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
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
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },
  resultStatLabel: {
    fontSize: TYPE.labelSize,
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
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },

  // Processing state
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: 12,
  },
  processingText: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 8,
  },
  processingHint: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textTertiary,
  },
  processingPreview: {
    width: 200,
    height: 200,
    borderRadius: RADIUS.md,
    marginTop: 16,
    opacity: 0.6,
  },
});
