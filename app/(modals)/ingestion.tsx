import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';
import { useAppState } from '../../src/state/AppState';
import { extractInvoice, type ExtractionResult, type ExtractedInvoice } from '../../src/ingestion/invoiceExtractor';
import { invoiceToExtractedDocument, extractedInvoiceToRow, extractedLineItemsToRows } from '../../src/ingestion/extractionBridge';
import { saveExtractedDocument, saveExtractedLineItems } from '../../src/lib/intelligenceDataProvider';
import { parsePdfText } from '../../src/ingestion/pdfParser';
import { parseSpreadsheet, detectSpreadsheetType, type ParsedSpreadsheet } from '../../src/ingestion/spreadsheetParser';
import { extractFromSpreadsheet } from '../../src/ingestion/spreadsheetExtractor';
import { extractBudgetWorkbook } from '../../src/ingestion/budgetExtractor';
import { processExtraction, type ProcessExtractionStats } from '../../src/ingestion/intelligenceBridge';
import { formatMoney2, formatMoney } from '../../src/i18n/formatting';

type Tab = 'upload' | 'paste' | 'excel';

export default function IngestionModal() {
  const { t } = useTranslation();
  const { extractedDocs, priceRisks, addExtractedDoc, setPendingBudgetExtraction } = useAppState();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [pasteText, setPasteText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [detectedBudget, setDetectedBudget] = useState(false);

  // Excel/CSV state
  const [parsedSpreadsheet, setParsedSpreadsheet] = useState<ParsedSpreadsheet | null>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);

  const pdfCount = extractedDocs.length;

  const formatCurrency = (value: number) => formatMoney2(value);

  const confidenceLabel = (c: number) => {
    if (c >= 0.8) return 'High';
    if (c >= 0.5) return 'Medium';
    return 'Low';
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return SemanticColors.feedbackSuccess;
    if (c >= 0.5) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  // ── Extract from text ───────────────────────────────────────

  const runExtraction = async (text: string, sourceType: 'pdf' | 'paste', sourceUri?: string) => {
    setExtracting(true);
    setResult(null);
    setStatusMessage('');
    try {
      const res = await extractInvoice(text, sourceUri ?? 'manual');
      setResult(res);
      if (!res.success) {
        setStatusMessage(res.errors.join(', '));
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  // ── PDF upload ──────────────────────────────────────────────

  const handlePdfUpload = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (!picked.canceled) {
      const fileUri = picked.assets[0]?.uri;
      if (!fileUri) return;
      try {
        const text = await parsePdfText(fileUri);
        await runExtraction(text, 'pdf', fileUri);
      } catch {
        setStatusMessage('Could not read PDF');
      }
    }
  };

  // ── Paste submit ────────────────────────────────────────────

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    runExtraction(pasteText.trim(), 'paste');
  };

  // ── Excel/CSV upload ────────────────────────────────────────

  const handleExcelUpload = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/comma-separated-values',
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (!picked.canceled) {
      const fileUri = picked.assets[0]?.uri;
      if (!fileUri) return;
      setExtracting(true);
      setResult(null);
      setStatusMessage('');
      setParsedSpreadsheet(null);
      setSelectedSheet(0);

      try {
        const parsed = await parseSpreadsheet(fileUri);
        setParsedSpreadsheet(parsed);

        if (parsed.sheets.length === 0 || parsed.totalRows === 0) {
          setStatusMessage('Spreadsheet is empty');
          setExtracting(false);
          return;
        }

        // Check if this looks like a budget workbook
        const firstSheet = parsed.sheets[0];
        const sheetType = detectSpreadsheetType(firstSheet);
        if (sheetType === 'budget') {
          setDetectedBudget(true);

          // Extract budget data and store for optimizer handoff
          try {
            const budgetResult = extractBudgetWorkbook(parsed);
            setPendingBudgetExtraction(budgetResult);

            const fmtCurrency = (n: number) => formatMoney(n);

            Alert.alert(
              'Begroting gedetecteerd',
              `${budgetResult.projectName}\n${fmtCurrency(budgetResult.totalBudget)} \u2022 ${budgetResult.lines.length} regels`,
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'Ga naar Optimizer',
                  onPress: () => router.push('/hub/budget-optimizer' as any),
                },
              ],
            );
          } catch {
            // Budget extraction failed — continue with normal flow
          }
        }

        // Auto-extract from first sheet
        const sheet = parsed.sheets[0];
        const invoice = extractFromSpreadsheet(sheet, fileUri);
        setResult({
          success: true,
          invoice,
          errors: [],
          warnings: invoice.lineItems.length === 0 ? ['No line items detected — check column names'] : [],
          priceObservationsCreated: 0,
          materialsResolved: 0,
        });
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : 'Could not read spreadsheet');
      } finally {
        setExtracting(false);
      }
    }
  };

  const handleSheetChange = (index: number) => {
    if (!parsedSpreadsheet) return;
    setSelectedSheet(index);
    const sheet = parsedSpreadsheet.sheets[index];
    if (!sheet) return;

    const invoice = extractFromSpreadsheet(sheet, parsedSpreadsheet.fileName);
    setResult({
      success: true,
      invoice,
      errors: [],
      warnings: invoice.lineItems.length === 0 ? ['No line items detected — check column names'] : [],
      priceObservationsCreated: 0,
      materialsResolved: 0,
    });
  };

  // ── Save to Supabase + local state + intelligence bridge ──

  const handleSave = async () => {
    if (!result?.invoice) return;
    setSaving(true);
    try {
      // Determine source type
      const sourceType = activeTab === 'upload' ? 'pdf' as const
        : activeTab === 'paste' ? 'paste' as const
        : 'excel' as const;

      // Save to extracted_documents table
      const row = extractedInvoiceToRow(result.invoice, sourceType);
      const docId = await saveExtractedDocument(row);
      if (docId) {
        const itemRows = extractedLineItemsToRows(result.invoice);
        await saveExtractedLineItems(docId, itemRows);
      }

      // Feed intelligence bridge (all 7 stages)
      const bridgeStats = await processExtraction(result.invoice, sourceType);

      // Also add to local AppState for priceRisk
      const doc = invoiceToExtractedDocument(result.invoice);
      addExtractedDoc(doc);

      // Build enriched status message
      const parts: string[] = ['Saved!'];
      if (bridgeStats.materialsCreated > 0) parts.push(`${bridgeStats.materialsCreated} materials`);
      if (bridgeStats.priceObservationsCreated > 0) parts.push(`${bridgeStats.priceObservationsCreated} prices`);
      if (bridgeStats.trainingExamplesCreated > 0) parts.push(`${bridgeStats.trainingExamplesCreated} training examples`);
      if (bridgeStats.calibrationsResolved > 0) parts.push(`${bridgeStats.calibrationsResolved} calibrations resolved`);

      setStatusMessage(parts.length > 1 ? parts.join(' \u2022 ') : 'Saved successfully');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Clear result ────────────────────────────────────────────

  const handleClear = () => {
    setResult(null);
    setStatusMessage('');
    setPasteText('');
    setParsedSpreadsheet(null);
    setSelectedSheet(0);
    setDetectedBudget(false);
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <Screen backgroundColor={SemanticColors.surfacePrimary}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={Typography.title}>{t('ingestion.title', 'Ingestion pool')}</Text>
        <Text style={Typography.muted}>
          {t('ingestion.subtitle', 'Add past quotes, invoices, emails, or PDFs. You choose what gets shared.')}
        </Text>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, activeTab === 'upload' && styles.tabActive]}
            onPress={() => { setActiveTab('upload'); handleClear(); }}
          >
            <Text style={[styles.tabText, activeTab === 'upload' && styles.tabTextActive]}>
              {t('ingestion.tabUpload', 'Upload PDF')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'paste' && styles.tabActive]}
            onPress={() => { setActiveTab('paste'); handleClear(); }}
          >
            <Text style={[styles.tabText, activeTab === 'paste' && styles.tabTextActive]}>
              {t('ingestion.tabPaste', 'Paste text')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'excel' && styles.tabActive]}
            onPress={() => { setActiveTab('excel'); handleClear(); }}
          >
            <Text style={[styles.tabText, activeTab === 'excel' && styles.tabTextActive]}>
              {t('ingestion.tabExcel', 'Excel/CSV')}
            </Text>
          </Pressable>
        </View>

        {/* Input area */}
        {!result && (
          <View style={styles.card}>
            {activeTab === 'upload' ? (
              <>
                <Text style={Typography.subtitle}>{t('ingestion.uploadPdf', 'Upload a PDF')}</Text>
                <Text style={Typography.muted}>
                  {t('ingestion.uploadPdfDesc', 'Select an invoice, quote, or receipt PDF to extract data from.')}
                </Text>
                <PrimaryButton label={extracting ? t('ingestion.extracting', 'Extracting…') : t('ingestion.choosePdf', 'Choose PDF')} onPress={handlePdfUpload} />
              </>
            ) : activeTab === 'paste' ? (
              <>
                <Text style={Typography.subtitle}>{t('ingestion.pasteText', 'Paste invoice text')}</Text>
                <Text style={Typography.muted}>
                  {t('ingestion.pasteDesc', 'Paste the full text of an invoice, quote, or receipt.')}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={pasteText}
                  onChangeText={setPasteText}
                  placeholder={t('ingestion.pastePlaceholder', 'Paste invoice / quote text here…')}
                  placeholderTextColor={SemanticColors.textSecondary}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
                <PrimaryButton
                  label={extracting ? t('ingestion.extracting', 'Extracting…') : t('ingestion.extract', 'Extract')}
                  onPress={handlePasteSubmit}
                />
              </>
            ) : (
              <>
                <Text style={Typography.subtitle}>{t('ingestion.importExcel', 'Import Excel or CSV')}</Text>
                <Text style={Typography.muted}>
                  {t('ingestion.importExcelDesc', 'Select a supplier price list, invoice export, or material spreadsheet.')}
                </Text>
                {parsedSpreadsheet && parsedSpreadsheet.sheets.length > 1 && (
                  <View style={styles.sheetSelector}>
                    <Text style={Typography.muted}>{t('ingestion.sheet', 'Sheet:')}</Text>
                    <View style={styles.sheetChips}>
                      {parsedSpreadsheet.sheets.map((sheet, idx) => (
                        <Pressable
                          key={sheet.name}
                          style={[styles.sheetChip, idx === selectedSheet && styles.sheetChipActive]}
                          onPress={() => handleSheetChange(idx)}
                        >
                          <Text style={[
                            styles.sheetChipText,
                            idx === selectedSheet && styles.sheetChipTextActive,
                          ]}>
                            {sheet.name} ({sheet.rowCount})
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                <PrimaryButton
                  label={extracting ? t('ingestion.reading', 'Reading…') : t('ingestion.chooseFile', 'Choose file')}
                  onPress={handleExcelUpload}
                />
              </>
            )}
            {extracting && <ActivityIndicator style={{ marginTop: Spacing.sm }} color={SemanticColors.actionPrimary} />}
          </View>
        )}

        {/* Status message — failed extraction empty state */}
        {statusMessage !== '' && !result?.success && (
          <View style={[styles.card, { alignItems: 'center', gap: Spacing.sm }]}>
            <Ionicons name="alert-circle-outline" size={36} color={SemanticColors.feedbackError} />
            <Text style={[Typography.subtitle, { textAlign: 'center' }]}>{t('ingestion.extractionFailed', 'Extraction failed')}</Text>
            <Text style={[Typography.muted, { color: SemanticColors.feedbackError, textAlign: 'center' }]}>{statusMessage}</Text>
            <PrimaryButton label={t('ingestion.tryAgain', 'Try again')} onPress={handleClear} />
          </View>
        )}

        {/* Results view */}
        {/* Budget detected banner */}
        {detectedBudget && (
          <Pressable
            style={[styles.card, { borderColor: SemanticColors.actionPrimary, borderWidth: 2 }]}
            onPress={() => router.push('/hub/budget-optimizer' as any)}
          >
            <Text style={[Typography.subtitle, { color: SemanticColors.actionPrimary }]}>
              {t('ingestion.budgetDetected', 'Budget detected')}
            </Text>
            <Text style={Typography.muted}>
              {t('ingestion.budgetDetectedDesc', 'This file looks like a cost budget. Open the Budget Optimizer for AI analysis and savings opportunities.')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs }}>
              <Text style={{ color: SemanticColors.actionPrimary, fontWeight: '600' }}>{t('ingestion.openBudgetOptimizer', 'Open Budget Optimizer')}</Text>
              <Text style={{ color: SemanticColors.actionPrimary }}>→</Text>
            </View>
          </Pressable>
        )}

        {result?.invoice && (
          <View style={styles.card}>
            <View style={styles.resultHeader}>
              <Text style={Typography.subtitle}>{t('ingestion.result', 'Extraction result')}</Text>
              <View style={[styles.badge, { backgroundColor: confidenceColor(result.invoice.extractionConfidence) + '22' }]}>
                <Text style={[styles.badgeText, { color: confidenceColor(result.invoice.extractionConfidence) }]}>
                  {confidenceLabel(result.invoice.extractionConfidence)} ({Math.round(result.invoice.extractionConfidence * 100)}%)
                </Text>
              </View>
            </View>

            {/* Header info */}
            <View style={styles.metaRow}>
              <Text style={Typography.muted}>{t('ingestion.type', 'Type')}</Text>
              <Text style={Typography.body}>{result.invoice.documentType}</Text>
            </View>
            {result.invoice.supplierName && (
              <View style={styles.metaRow}>
                <Text style={Typography.muted}>{t('ingestion.supplier', 'Supplier')}</Text>
                <Text style={Typography.body}>{result.invoice.supplierName}</Text>
              </View>
            )}
            {result.invoice.documentNumber && (
              <View style={styles.metaRow}>
                <Text style={Typography.muted}>{t('ingestion.docNumber', 'Doc #')}</Text>
                <Text style={Typography.body}>{result.invoice.documentNumber}</Text>
              </View>
            )}
            {result.invoice.documentDate && (
              <View style={styles.metaRow}>
                <Text style={Typography.muted}>{t('ingestion.date', 'Date')}</Text>
                <Text style={Typography.body}>{result.invoice.documentDate}</Text>
              </View>
            )}

            {/* Sheet selector (for Excel, when result is showing) */}
            {activeTab === 'excel' && parsedSpreadsheet && parsedSpreadsheet.sheets.length > 1 && (
              <View style={styles.sheetSelector}>
                <Text style={Typography.muted}>Sheet:</Text>
                <View style={styles.sheetChips}>
                  {parsedSpreadsheet.sheets.map((sheet, idx) => (
                    <Pressable
                      key={sheet.name}
                      style={[styles.sheetChip, idx === selectedSheet && styles.sheetChipActive]}
                      onPress={() => handleSheetChange(idx)}
                    >
                      <Text style={[
                        styles.sheetChipText,
                        idx === selectedSheet && styles.sheetChipTextActive,
                      ]}>
                        {sheet.name} ({sheet.rowCount})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Line items */}
            {result.invoice.lineItems.length > 0 && (
              <>
                <Text style={[Typography.subtitle, { marginTop: Spacing.md }]}>
                  {t('ingestion.lineItems', 'Line items ({{count}})', { count: result.invoice.lineItems.length })}
                </Text>
                {result.invoice.lineItems.map((item) => (
                  <View key={item.id} style={styles.lineItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={Typography.body} numberOfLines={2}>{item.description}</Text>
                      <Text style={Typography.muted}>
                        {item.quantity} {item.unit} x {formatCurrency(item.unitPrice)}
                        {item.brand ? ` \u2022 ${item.brand}` : ''}
                      </Text>
                    </View>
                    <Text style={Typography.body}>{formatCurrency(item.totalPrice)}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Totals */}
            <View style={styles.totalSection}>
              {result.invoice.subtotal != null && (
                <View style={styles.metaRow}>
                  <Text style={Typography.muted}>{t('ingestion.subtotal', 'Subtotal')}</Text>
                  <Text style={Typography.body}>{formatCurrency(result.invoice.subtotal)}</Text>
                </View>
              )}
              {result.invoice.vatAmount != null && (
                <View style={styles.metaRow}>
                  <Text style={Typography.muted}>
                    {t('ingestion.vat', 'VAT')}{result.invoice.vatRate ? ` (${result.invoice.vatRate}%)` : ''}
                  </Text>
                  <Text style={Typography.body}>{formatCurrency(result.invoice.vatAmount)}</Text>
                </View>
              )}
              {result.invoice.total != null && (
                <View style={styles.metaRow}>
                  <Text style={Typography.subtitle}>{t('ingestion.total', 'Total')}</Text>
                  <Text style={Typography.subtitle}>{formatCurrency(result.invoice.total)}</Text>
                </View>
              )}
            </View>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <View style={{ marginTop: Spacing.sm }}>
                {result.warnings.map((w, i) => (
                  <Text key={i} style={[Typography.muted, { color: SemanticColors.feedbackWarning }]}>{w}</Text>
                ))}
              </View>
            )}

            {/* Success message */}
            {statusMessage !== '' && (
              <Text style={[Typography.muted, {
                color: statusMessage.startsWith('Saved') ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError,
                marginTop: Spacing.sm,
              }]}>
                {statusMessage}
              </Text>
            )}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <PrimaryButton
                label={saving ? t('ingestion.saving', 'Saving…') : t('common.save', 'Save')}
                onPress={handleSave}
              />
              <Pressable style={styles.secondaryButton} onPress={handleClear}>
                <Text style={styles.secondaryText}>{t('ingestion.newExtraction', 'New extraction')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Insights link */}
        <View style={styles.card}>
          <Text style={Typography.subtitle}>{t('ingestion.whatWeLearn', 'What we learn')}</Text>
          <Text style={Typography.muted}>
            {t('ingestion.whatWeLearnDesc', 'Pricing benchmarks, missing scope items, and payment risk signals.')}
          </Text>
          <Text style={Typography.muted}>
            {t('ingestion.priceRiskCount', 'Price-risk signals found: {{count}}', { count: priceRisks.length })}
          </Text>
          <Link href="/(modals)/insights" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{t('ingestion.viewInsights', 'View insights')}</Text>
            </Pressable>
          </Link>
        </View>

        {/* Parsed documents list */}
        <View style={styles.card}>
          <Text style={Typography.subtitle}>{t('ingestion.parsedDocuments', 'Parsed documents')}</Text>
          {pdfCount === 0 ? (
            <Text style={Typography.muted}>{t('ingestion.noParsedDocs', 'No parsed documents yet.')}</Text>
          ) : (
            extractedDocs.map((doc, index) => (
              <View key={`${doc.docType}-${index}`} style={styles.docRow}>
                <View>
                  <Text style={Typography.body}>
                    {doc.docType === 'invoice' ? 'Invoice' : 'Quote'}
                    {doc.vendorName ? ` \u2014 ${doc.vendorName}` : ''}
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.lg * 2,
  },
  card: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  tabBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  tabActive: {
    borderColor: SemanticColors.actionPrimary,
    backgroundColor: Palette.peachCream,
  },
  tabText: {
    ...Typography.body,
    fontWeight: '500',
  },
  tabTextActive: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 160,
    ...Typography.body,
  },
  statusBar: {
    padding: Spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  totalSection: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryText: {
    color: SemanticColors.textPrimary,
    fontWeight: '600',
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  sheetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  sheetChips: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    flex: 1,
  },
  sheetChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  sheetChipActive: {
    borderColor: SemanticColors.actionPrimary,
    backgroundColor: Palette.peachCream,
  },
  sheetChipText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  sheetChipTextActive: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
});
