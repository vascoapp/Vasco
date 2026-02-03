// AI Quote from Photo - Snap photo, get quote draft
// Implements: Photo → AI Analysis → Quote Draft → One-tap send
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

interface DetectedItem {
  id: string;
  description: string;
  category: string;
  confidence: number; // 0-100
  suggestedQuantity: number;
  unit: string;
  suggestedPrice: number;
  pricebookMatch?: string;
  selected: boolean;
}

interface AIAnalysisResult {
  jobType: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedHours: number;
  detectedItems: DetectedItem[];
  notes: string[];
  warnings: string[];
}

interface AIQuoteFromPhotoProps {
  onCreateQuote: (items: DetectedItem[], jobType: string) => void;
  onClose?: () => void;
}

// Simulated AI analysis results based on "photo analysis"
const MOCK_ANALYSES: Record<string, AIAnalysisResult> = {
  bathroom: {
    jobType: 'Bathroom Renovation',
    complexity: 'medium',
    estimatedHours: 16,
    detectedItems: [
      { id: 'ai-1', description: 'Remove existing tiles', category: 'Demolition', confidence: 92, suggestedQuantity: 12, unit: 'm²', suggestedPrice: 25, selected: true },
      { id: 'ai-2', description: 'Wall tile installation', category: 'Tiling', confidence: 95, suggestedQuantity: 12, unit: 'm²', suggestedPrice: 65, selected: true },
      { id: 'ai-3', description: 'Floor tile installation', category: 'Tiling', confidence: 88, suggestedQuantity: 6, unit: 'm²', suggestedPrice: 75, selected: true },
      { id: 'ai-4', description: 'Waterproofing membrane', category: 'Prep', confidence: 85, suggestedQuantity: 18, unit: 'm²', suggestedPrice: 18, selected: true },
      { id: 'ai-5', description: 'Grout and sealant', category: 'Finishing', confidence: 90, suggestedQuantity: 1, unit: 'job', suggestedPrice: 120, selected: true },
      { id: 'ai-6', description: 'Waste removal', category: 'Cleanup', confidence: 80, suggestedQuantity: 1, unit: 'job', suggestedPrice: 150, selected: false },
    ],
    notes: [
      'Standard bathroom size detected (~6m²)',
      'Existing tiles appear to be ceramic',
      'Wall condition looks good for direct tiling',
    ],
    warnings: [
      'Check for water damage behind existing tiles',
      'Verify plumbing locations before starting',
    ],
  },
  painting: {
    jobType: 'Interior Painting',
    complexity: 'simple',
    estimatedHours: 8,
    detectedItems: [
      { id: 'ai-1', description: 'Wall preparation & filling', category: 'Prep', confidence: 88, suggestedQuantity: 45, unit: 'm²', suggestedPrice: 8, selected: true },
      { id: 'ai-2', description: 'Primer coat', category: 'Paint', confidence: 85, suggestedQuantity: 45, unit: 'm²', suggestedPrice: 6, selected: true },
      { id: 'ai-3', description: 'Two coats emulsion paint', category: 'Paint', confidence: 95, suggestedQuantity: 45, unit: 'm²', suggestedPrice: 12, selected: true },
      { id: 'ai-4', description: 'Ceiling paint (if needed)', category: 'Paint', confidence: 70, suggestedQuantity: 15, unit: 'm²', suggestedPrice: 14, selected: false },
      { id: 'ai-5', description: 'Woodwork gloss', category: 'Paint', confidence: 75, suggestedQuantity: 8, unit: 'm²', suggestedPrice: 18, selected: false },
    ],
    notes: [
      'Living room area detected (~45m² walls)',
      'Current paint appears to be light color',
      'Good natural light for color matching',
    ],
    warnings: [
      'Some hairline cracks visible - may need extra prep',
    ],
  },
  kitchen: {
    jobType: 'Kitchen Installation',
    complexity: 'complex',
    estimatedHours: 24,
    detectedItems: [
      { id: 'ai-1', description: 'Base unit installation', category: 'Cabinets', confidence: 94, suggestedQuantity: 6, unit: 'units', suggestedPrice: 85, selected: true },
      { id: 'ai-2', description: 'Wall unit installation', category: 'Cabinets', confidence: 92, suggestedQuantity: 4, unit: 'units', suggestedPrice: 65, selected: true },
      { id: 'ai-3', description: 'Worktop templating & fit', category: 'Countertops', confidence: 90, suggestedQuantity: 3.5, unit: 'm', suggestedPrice: 180, selected: true },
      { id: 'ai-4', description: 'Sink & tap installation', category: 'Plumbing', confidence: 88, suggestedQuantity: 1, unit: 'job', suggestedPrice: 150, selected: true },
      { id: 'ai-5', description: 'Appliance connections', category: 'Electrical', confidence: 82, suggestedQuantity: 3, unit: 'units', suggestedPrice: 75, selected: true },
      { id: 'ai-6', description: 'Splashback tiling', category: 'Tiling', confidence: 78, suggestedQuantity: 2, unit: 'm²', suggestedPrice: 85, selected: false },
      { id: 'ai-7', description: 'Plinth & cornice fitting', category: 'Finishing', confidence: 85, suggestedQuantity: 1, unit: 'job', suggestedPrice: 120, selected: true },
    ],
    notes: [
      'L-shaped kitchen layout detected',
      'Space for standard appliances',
      'Good access for installation',
    ],
    warnings: [
      'Verify electrical capacity for appliances',
      'Check water pressure for dishwasher',
      'Confirm gas connection requirements',
    ],
  },
};

export function AIQuoteFromPhoto({ onCreateQuote, onClose }: AIQuoteFromPhotoProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);

  const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`;

  // Simulate taking a photo
  const takePhoto = () => {
    // In real app, this opens camera
    // For demo, we'll use a random mock image and analysis
    setPhoto(`https://picsum.photos/600/400?random=${Date.now()}`);
    analyzePhoto();
  };

  // Simulate AI analysis
  const analyzePhoto = () => {
    setAnalyzing(true);

    // Simulate processing time
    setTimeout(() => {
      // Randomly pick an analysis type for demo
      const types = Object.keys(MOCK_ANALYSES);
      const randomType = types[Math.floor(Math.random() * types.length)];
      const result = MOCK_ANALYSES[randomType];

      setAnalysis(result);
      setItems(result.detectedItems);
      setAnalyzing(false);
    }, 2000);
  };

  const toggleItem = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const adjustQuantity = (id: string, delta: number) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, suggestedQuantity: Math.max(0.5, item.suggestedQuantity + delta) }
        : item
    ));
  };

  // Calculate totals
  const selectedItems = items.filter(i => i.selected);
  const subtotal = selectedItems.reduce((sum, i) => sum + (i.suggestedQuantity * i.suggestedPrice), 0);
  const vatAmount = subtotal * 0.21;
  const total = subtotal + vatAmount;

  const handleCreateQuote = () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Items', 'Please select at least one item for the quote.');
      return;
    }

    Alert.alert(
      'Create Quote',
      `Create quote for ${formatCurrency(total)} with ${selectedItems.length} line items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: () => onCreateQuote(selectedItems, analysis?.jobType || 'General Work'),
        },
      ]
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return SemanticColors.feedbackSuccess;
    if (confidence >= 75) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  // Initial state - no photo yet
  if (!photo) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          {onClose && (
            <Pressable onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          )}
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>AI Quote Builder</Text>
            <Text style={styles.headerSubtitle}>Photo → Quote in seconds</Text>
          </View>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="sparkles" size={48} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.emptyTitle}>Snap a Photo, Get a Quote</Text>
          <Text style={styles.emptyText}>
            Take a photo of the work area and our AI will analyze it to create a quote draft automatically.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.featureText}>Detects work type and scope</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.featureText}>Suggests line items from your pricebook</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.featureText}>Estimates quantities and pricing</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.featureText}>Flags potential issues</Text>
            </View>
          </View>

          <Pressable style={styles.takePhotoButton} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.takePhotoText}>Take Photo</Text>
          </Pressable>

          <Pressable style={styles.galleryButton} onPress={takePhoto}>
            <Ionicons name="images" size={20} color={SemanticColors.actionPrimary} />
            <Text style={styles.galleryText}>Choose from Gallery</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Analyzing state
  if (analyzing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          {onClose && (
            <Pressable onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          )}
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Analyzing Photo</Text>
            <Text style={styles.headerSubtitle}>AI is working...</Text>
          </View>
        </View>

        <View style={styles.analyzingState}>
          <Image source={{ uri: photo }} style={styles.analyzingImage} />
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color={Palette.hermesOrange} />
            <Text style={styles.analyzingText}>Detecting work scope...</Text>
            <View style={styles.analyzingSteps}>
              <Text style={styles.analyzingStep}>✓ Image captured</Text>
              <Text style={styles.analyzingStep}>⟳ Analyzing room type</Text>
              <Text style={styles.analyzingStepPending}>○ Identifying work items</Text>
              <Text style={styles.analyzingStepPending}>○ Matching pricebook</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Analysis complete - show results
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Quote Draft</Text>
          <Text style={styles.headerSubtitle}>{analysis?.jobType}</Text>
        </View>
        <View style={styles.aiChip}>
          <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} />
          <Text style={styles.aiChipText}>AI Generated</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Photo Preview */}
        <View style={styles.photoPreview}>
          <Image source={{ uri: photo }} style={styles.previewImage} />
          <Pressable style={styles.retakeButton} onPress={() => { setPhoto(null); setAnalysis(null); }}>
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>
        </View>

        {/* Job Summary */}
        <View style={styles.jobSummary}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>{analysis?.jobType}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Complexity</Text>
              <View style={[styles.complexityBadge, {
                backgroundColor: analysis?.complexity === 'simple'
                  ? SemanticColors.feedbackSuccessBg
                  : analysis?.complexity === 'medium'
                    ? SemanticColors.feedbackWarningBg
                    : SemanticColors.feedbackErrorBg
              }]}>
                <Text style={[styles.complexityText, {
                  color: analysis?.complexity === 'simple'
                    ? SemanticColors.feedbackSuccess
                    : analysis?.complexity === 'medium'
                      ? SemanticColors.feedbackWarning
                      : SemanticColors.feedbackError
                }]}>
                  {analysis?.complexity}
                </Text>
              </View>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Est. Hours</Text>
              <Text style={styles.summaryValue}>{analysis?.estimatedHours}h</Text>
            </View>
          </View>
        </View>

        {/* AI Notes */}
        {analysis?.notes && analysis.notes.length > 0 && (
          <View style={styles.notesSection}>
            <View style={styles.notesSectionHeader}>
              <Ionicons name="bulb" size={16} color={SemanticColors.feedbackInfo} />
              <Text style={styles.notesSectionTitle}>AI Observations</Text>
            </View>
            {analysis.notes.map((note, idx) => (
              <Text key={idx} style={styles.noteItem}>• {note}</Text>
            ))}
          </View>
        )}

        {/* Warnings */}
        {analysis?.warnings && analysis.warnings.length > 0 && (
          <View style={styles.warningsSection}>
            <View style={styles.warningSectionHeader}>
              <Ionicons name="warning" size={16} color={SemanticColors.feedbackWarning} />
              <Text style={styles.warningSectionTitle}>Check Before Quoting</Text>
            </View>
            {analysis.warnings.map((warning, idx) => (
              <Text key={idx} style={styles.warningItem}>⚠ {warning}</Text>
            ))}
          </View>
        )}

        {/* Detected Items */}
        <View style={styles.itemsSection}>
          <View style={styles.itemsSectionHeader}>
            <Text style={styles.itemsSectionTitle}>Detected Line Items</Text>
            <Text style={styles.itemsCount}>{selectedItems.length}/{items.length} selected</Text>
          </View>

          {items.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.itemCard, item.selected && styles.itemCardSelected]}
              onPress={() => toggleItem(item.id)}
            >
              <View style={styles.itemHeader}>
                <View style={[
                  styles.itemCheckbox,
                  item.selected && styles.itemCheckboxSelected
                ]}>
                  {item.selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  <Text style={styles.itemCategory}>{item.category}</Text>
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(item.confidence) + '20' }]}>
                  <Text style={[styles.confidenceText, { color: getConfidenceColor(item.confidence) }]}>
                    {item.confidence}%
                  </Text>
                </View>
              </View>

              {item.selected && (
                <View style={styles.itemDetails}>
                  <View style={styles.quantityControl}>
                    <Pressable
                      style={styles.quantityBtn}
                      onPress={() => adjustQuantity(item.id, -0.5)}
                    >
                      <Ionicons name="remove" size={16} color={SemanticColors.textPrimary} />
                    </Pressable>
                    <Text style={styles.quantityText}>
                      {item.suggestedQuantity} {item.unit}
                    </Text>
                    <Pressable
                      style={styles.quantityBtn}
                      onPress={() => adjustQuantity(item.id, 0.5)}
                    >
                      <Ionicons name="add" size={16} color={SemanticColors.textPrimary} />
                    </Pressable>
                  </View>
                  <View style={styles.priceInfo}>
                    <Text style={styles.unitPrice}>{formatCurrency(item.suggestedPrice)}/{item.unit}</Text>
                    <Text style={styles.lineTotal}>
                      {formatCurrency(item.suggestedQuantity * item.suggestedPrice)}
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT (21%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.editButton}>
          <Ionicons name="create" size={18} color={SemanticColors.textPrimary} />
          <Text style={styles.editButtonText}>Edit Details</Text>
        </Pressable>
        <Pressable style={styles.createButton} onPress={handleCreateQuote}>
          <Ionicons name="document-text" size={18} color="#fff" />
          <Text style={styles.createButtonText}>Create Quote</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange + '20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  aiChipText: {
    color: Palette.hermesOrange,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  featureList: {
    width: '100%',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  takePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: Spacing.md,
  },
  takePhotoText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  galleryText: {
    color: SemanticColors.actionPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  analyzingState: {
    flex: 1,
    position: 'relative',
  },
  analyzingImage: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  analyzingText: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  analyzingSteps: {
    gap: 8,
    marginTop: Spacing.md,
  },
  analyzingStep: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 14,
  },
  analyzingStepPending: {
    color: SemanticColors.textTertiary,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  photoPreview: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 180,
  },
  retakeButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retakeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  jobSummary: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  summaryValue: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  complexityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  complexityText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  notesSection: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  notesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesSectionTitle: {
    color: SemanticColors.feedbackInfo,
    fontSize: 13,
    fontWeight: '600',
  },
  noteItem: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    paddingLeft: 4,
  },
  warningsSection: {
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  warningSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningSectionTitle: {
    color: SemanticColors.feedbackWarning,
    fontSize: 13,
    fontWeight: '600',
  },
  warningItem: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
    paddingLeft: 4,
  },
  itemsSection: {
    gap: Spacing.sm,
  },
  itemsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsSectionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  itemsCount: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
  itemCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  itemCardSelected: {
    borderColor: SemanticColors.actionPrimary,
    backgroundColor: SemanticColors.actionPrimary + '05',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCheckboxSelected: {
    backgroundColor: SemanticColors.actionPrimary,
    borderColor: SemanticColors.actionPrimary,
  },
  itemInfo: {
    flex: 1,
  },
  itemDescription: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  itemCategory: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'center',
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  lineTotal: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  totalsSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
  totalValue: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
  },
  grandTotalRow: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
    marginTop: 4,
  },
  grandTotalLabel: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  grandTotalValue: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 20,
    fontWeight: '700',
  },
  bottomBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
  },
  editButtonText: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  createButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
