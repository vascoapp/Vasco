// Job Materials Suggestion - Suggests materials based on similar past jobs
import { useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';

// Job type categories with typical materials
type JobCategory = 'painting' | 'plumbing' | 'electrical' | 'carpentry' | 'tiling' | 'general';

interface MaterialSuggestion {
  id: string;
  name: string;
  category: string;
  typicalQuantity: number;
  unit: string;
  estimatedCost: number;
  frequency: number; // How often used in similar jobs (0-100%)
  supplierSku?: string;
  notes?: string;
}

interface PastJobReference {
  id: string;
  title: string;
  date: string;
  totalMaterialCost: number;
  materialsUsed: number;
}

// Mock data - materials commonly used by job type
const JOB_MATERIALS: Record<JobCategory, MaterialSuggestion[]> = {
  painting: [
    { id: 'pm-1', name: 'Interior Wall Paint (White)', category: 'Paint', typicalQuantity: 10, unit: 'L', estimatedCost: 89.90, frequency: 95 },
    { id: 'pm-2', name: 'Primer/Undercoat', category: 'Paint', typicalQuantity: 5, unit: 'L', estimatedCost: 45.00, frequency: 85 },
    { id: 'pm-3', name: 'Masking Tape', category: 'Supplies', typicalQuantity: 3, unit: 'rolls', estimatedCost: 12.50, frequency: 90 },
    { id: 'pm-4', name: 'Drop Cloths', category: 'Supplies', typicalQuantity: 2, unit: 'pcs', estimatedCost: 18.00, frequency: 75 },
    { id: 'pm-5', name: 'Roller Covers (9")', category: 'Tools', typicalQuantity: 4, unit: 'pcs', estimatedCost: 16.00, frequency: 88 },
    { id: 'pm-6', name: 'Paint Brushes Set', category: 'Tools', typicalQuantity: 1, unit: 'set', estimatedCost: 24.00, frequency: 70 },
    { id: 'pm-7', name: 'Filler/Spackle', category: 'Prep', typicalQuantity: 1, unit: 'kg', estimatedCost: 8.50, frequency: 80 },
    { id: 'pm-8', name: 'Sandpaper (Mixed Grit)', category: 'Prep', typicalQuantity: 10, unit: 'sheets', estimatedCost: 6.00, frequency: 78 },
  ],
  plumbing: [
    { id: 'pl-1', name: 'Copper Pipe 15mm', category: 'Pipes', typicalQuantity: 3, unit: 'm', estimatedCost: 24.00, frequency: 85 },
    { id: 'pl-2', name: 'Flexible Connectors', category: 'Fittings', typicalQuantity: 4, unit: 'pcs', estimatedCost: 32.00, frequency: 80 },
    { id: 'pl-3', name: 'PTFE Tape', category: 'Supplies', typicalQuantity: 2, unit: 'rolls', estimatedCost: 4.00, frequency: 95 },
    { id: 'pl-4', name: 'Pipe Clips', category: 'Fittings', typicalQuantity: 10, unit: 'pcs', estimatedCost: 8.00, frequency: 75 },
    { id: 'pl-5', name: 'Silicone Sealant', category: 'Supplies', typicalQuantity: 1, unit: 'tube', estimatedCost: 7.50, frequency: 90 },
    { id: 'pl-6', name: 'Stop Valve 15mm', category: 'Valves', typicalQuantity: 2, unit: 'pcs', estimatedCost: 18.00, frequency: 65 },
  ],
  electrical: [
    { id: 'el-1', name: 'Twin & Earth Cable 2.5mm', category: 'Cable', typicalQuantity: 10, unit: 'm', estimatedCost: 22.00, frequency: 90 },
    { id: 'el-2', name: 'Junction Box', category: 'Accessories', typicalQuantity: 2, unit: 'pcs', estimatedCost: 8.00, frequency: 75 },
    { id: 'el-3', name: 'Socket Outlet (Double)', category: 'Accessories', typicalQuantity: 2, unit: 'pcs', estimatedCost: 14.00, frequency: 70 },
    { id: 'el-4', name: 'Light Switch', category: 'Accessories', typicalQuantity: 1, unit: 'pcs', estimatedCost: 6.00, frequency: 65 },
    { id: 'el-5', name: 'Cable Clips', category: 'Supplies', typicalQuantity: 50, unit: 'pcs', estimatedCost: 5.00, frequency: 85 },
    { id: 'el-6', name: 'Electrical Tape', category: 'Supplies', typicalQuantity: 2, unit: 'rolls', estimatedCost: 4.00, frequency: 92 },
  ],
  carpentry: [
    { id: 'ca-1', name: 'Softwood Timber 2x4', category: 'Timber', typicalQuantity: 6, unit: 'm', estimatedCost: 36.00, frequency: 85 },
    { id: 'ca-2', name: 'Wood Screws (Mixed)', category: 'Fixings', typicalQuantity: 100, unit: 'pcs', estimatedCost: 12.00, frequency: 95 },
    { id: 'ca-3', name: 'Wood Glue', category: 'Adhesive', typicalQuantity: 1, unit: 'bottle', estimatedCost: 8.50, frequency: 75 },
    { id: 'ca-4', name: 'Sandpaper (Mixed)', category: 'Supplies', typicalQuantity: 10, unit: 'sheets', estimatedCost: 6.00, frequency: 80 },
    { id: 'ca-5', name: 'Wood Filler', category: 'Supplies', typicalQuantity: 1, unit: 'tin', estimatedCost: 9.00, frequency: 70 },
  ],
  tiling: [
    { id: 'ti-1', name: 'Tile Adhesive', category: 'Adhesive', typicalQuantity: 20, unit: 'kg', estimatedCost: 28.00, frequency: 98 },
    { id: 'ti-2', name: 'Grout', category: 'Grout', typicalQuantity: 5, unit: 'kg', estimatedCost: 15.00, frequency: 95 },
    { id: 'ti-3', name: 'Tile Spacers 3mm', category: 'Supplies', typicalQuantity: 200, unit: 'pcs', estimatedCost: 4.00, frequency: 90 },
    { id: 'ti-4', name: 'Silicone Sealant', category: 'Supplies', typicalQuantity: 2, unit: 'tubes', estimatedCost: 15.00, frequency: 88 },
    { id: 'ti-5', name: 'Tile Trim', category: 'Trim', typicalQuantity: 3, unit: 'm', estimatedCost: 18.00, frequency: 70 },
  ],
  general: [
    { id: 'ge-1', name: 'All-Purpose Screws', category: 'Fixings', typicalQuantity: 50, unit: 'pcs', estimatedCost: 8.00, frequency: 85 },
    { id: 'ge-2', name: 'Wall Plugs', category: 'Fixings', typicalQuantity: 30, unit: 'pcs', estimatedCost: 5.00, frequency: 80 },
    { id: 'ge-3', name: 'Silicone Sealant', category: 'Supplies', typicalQuantity: 1, unit: 'tube', estimatedCost: 7.50, frequency: 75 },
    { id: 'ge-4', name: 'Dust Sheets', category: 'Protection', typicalQuantity: 2, unit: 'pcs', estimatedCost: 12.00, frequency: 70 },
  ],
};

// Mock past jobs for reference
const MOCK_PAST_JOBS: Record<JobCategory, PastJobReference[]> = {
  painting: [
    { id: 'pj-1', title: 'Living Room Repaint - Van der Berg', date: '2025-01-15', totalMaterialCost: 156.40, materialsUsed: 7 },
    { id: 'pj-2', title: 'Bedroom Paint - Jansen', date: '2025-01-08', totalMaterialCost: 98.50, materialsUsed: 5 },
    { id: 'pj-3', title: 'Kitchen Refresh - De Vries', date: '2024-12-20', totalMaterialCost: 124.00, materialsUsed: 6 },
  ],
  plumbing: [
    { id: 'pj-4', title: 'Bathroom Tap Replacement', date: '2025-01-12', totalMaterialCost: 85.00, materialsUsed: 4 },
    { id: 'pj-5', title: 'Kitchen Sink Install', date: '2025-01-05', totalMaterialCost: 112.00, materialsUsed: 6 },
  ],
  electrical: [
    { id: 'pj-6', title: 'Socket Addition - Office', date: '2025-01-10', totalMaterialCost: 45.00, materialsUsed: 5 },
  ],
  carpentry: [
    { id: 'pj-7', title: 'Shelving Unit Install', date: '2025-01-14', totalMaterialCost: 68.00, materialsUsed: 4 },
  ],
  tiling: [
    { id: 'pj-8', title: 'Bathroom Floor Tiles', date: '2025-01-11', totalMaterialCost: 180.00, materialsUsed: 5 },
  ],
  general: [],
};

interface JobMaterialsSuggestionProps {
  jobCategory?: JobCategory;
  jobTitle?: string;
  onAddToList?: (materials: MaterialSuggestion[]) => void;
  onClose?: () => void;
  compact?: boolean;
}

export function JobMaterialsSuggestion({
  jobCategory = 'general',
  jobTitle,
  onAddToList,
  onClose,
  compact = false,
}: JobMaterialsSuggestionProps) {
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [showPastJobs, setShowPastJobs] = useState(false);

  const suggestedMaterials = JOB_MATERIALS[jobCategory] || JOB_MATERIALS.general;
  const pastJobs = MOCK_PAST_JOBS[jobCategory] || [];

  // formatCurrency imported from ../../i18n/formatting

  // Sort by frequency (most commonly used first)
  const sortedMaterials = useMemo(() =>
    [...suggestedMaterials].sort((a, b) => b.frequency - a.frequency),
    [suggestedMaterials]
  );

  // Calculate totals
  const selectedItems = sortedMaterials.filter(m => selectedMaterials.has(m.id));
  const totalEstimate = selectedItems.reduce((sum, m) => sum + m.estimatedCost, 0);

  const toggleMaterial = (id: string) => {
    const next = new Set(selectedMaterials);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMaterials(next);
  };

  const selectAll = () => {
    setSelectedMaterials(new Set(sortedMaterials.map(m => m.id)));
  };

  const selectEssentials = () => {
    // Select materials with 80%+ frequency
    setSelectedMaterials(new Set(
      sortedMaterials.filter(m => m.frequency >= 80).map(m => m.id)
    ));
  };

  const handleAddToList = () => {
    if (selectedMaterials.size === 0) {
      Alert.alert('No Materials', 'Please select materials to add.');
      return;
    }

    const materialsToAdd = sortedMaterials.filter(m => selectedMaterials.has(m.id));
    onAddToList?.(materialsToAdd);
    Alert.alert(
      'Added to List',
      `${materialsToAdd.length} materials added to your shopping list.\nEstimated cost: ${formatCurrency(totalEstimate)}`
    );
  };

  // Compact mode for embedding in quote builder
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Ionicons name="bulb" size={16} color={SemanticColors.feedbackInfo} />
          <Text style={styles.compactTitle}>
            Suggested materials for {jobCategory} jobs
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.compactScroll}>
          <View style={styles.compactChips}>
            {sortedMaterials.slice(0, 5).map((material) => {
              const isSelected = selectedMaterials.has(material.id);
              return (
                <Pressable
                  key={material.id}
                  style={[styles.compactChip, isSelected && styles.compactChipSelected]}
                  onPress={() => toggleMaterial(material.id)}
                >
                  <Text
                    style={[styles.compactChipText, isSelected && styles.compactChipTextSelected]}
                    numberOfLines={1}
                  >
                    {isSelected ? '✓ ' : '+ '}{material.name}
                  </Text>
                  <Text style={styles.compactChipPrice}>{formatCurrency(material.estimatedCost)}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        {selectedMaterials.size > 0 && (
          <View style={styles.compactSummary}>
            <Text style={styles.compactSummaryText}>
              {selectedMaterials.size} items • {formatCurrency(totalEstimate)}
            </Text>
            <Pressable style={styles.compactAddBtn} onPress={handleAddToList}>
              <Ionicons name="cart" size={14} color="#fff" />
              <Text style={styles.compactAddBtnText}>Add</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // Full view
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Materials Needed</Text>
          <Text style={styles.headerSubtitle}>
            {jobTitle || `Based on similar ${jobCategory} jobs`}
          </Text>
        </View>
      </View>

      {/* Smart Suggestion Banner */}
      <View style={styles.smartBanner}>
        <View style={styles.smartBannerIcon}>
          <Ionicons name="sparkles" size={20} color={SemanticColors.actionPrimary} />
        </View>
        <View style={styles.smartBannerContent}>
          <Text style={styles.smartBannerTitle}>AI-Suggested from Job History</Text>
          <Text style={styles.smartBannerText}>
            Based on {pastJobs.length} similar {jobCategory} jobs you've completed
          </Text>
        </View>
        {pastJobs.length > 0 && (
          <Pressable onPress={() => setShowPastJobs(!showPastJobs)}>
            <Ionicons
              name={showPastJobs ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={SemanticColors.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {/* Past Jobs Reference */}
      {showPastJobs && pastJobs.length > 0 && (
        <View style={styles.pastJobsSection}>
          <Text style={styles.pastJobsTitle}>Reference Jobs</Text>
          {pastJobs.slice(0, 3).map((job) => (
            <View key={job.id} style={styles.pastJobRow}>
              <View style={styles.pastJobInfo}>
                <Text style={styles.pastJobTitle}>{job.title}</Text>
                <Text style={styles.pastJobDate}>{job.date}</Text>
              </View>
              <View style={styles.pastJobStats}>
                <Text style={styles.pastJobCost}>{formatCurrency(job.totalMaterialCost)}</Text>
                <Text style={styles.pastJobCount}>{job.materialsUsed} items</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Selection Buttons */}
      <View style={styles.quickSelect}>
        <Pressable style={styles.quickSelectBtn} onPress={selectEssentials}>
          <Ionicons name="star" size={14} color={SemanticColors.actionPrimary} />
          <Text style={styles.quickSelectText}>Essential Items</Text>
        </Pressable>
        <Pressable style={styles.quickSelectBtn} onPress={selectAll}>
          <Ionicons name="checkmark-done" size={14} color={SemanticColors.actionPrimary} />
          <Text style={styles.quickSelectText}>Select All</Text>
        </Pressable>
        <Pressable
          style={styles.quickSelectBtn}
          onPress={() => setSelectedMaterials(new Set())}
        >
          <Ionicons name="close" size={14} color={SemanticColors.textSecondary} />
          <Text style={[styles.quickSelectText, { color: SemanticColors.textSecondary }]}>Clear</Text>
        </Pressable>
      </View>

      {/* Materials List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Group by category */}
        {Array.from(new Set(sortedMaterials.map(m => m.category))).map((category) => {
          const categoryMaterials = sortedMaterials.filter(m => m.category === category);
          return (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {categoryMaterials.map((material) => {
                const isSelected = selectedMaterials.has(material.id);
                return (
                  <Pressable
                    key={material.id}
                    style={[styles.materialRow, isSelected && styles.materialRowSelected]}
                    onPress={() => toggleMaterial(material.id)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <View style={styles.materialInfo}>
                      <Text style={styles.materialName}>{material.name}</Text>
                      <Text style={styles.materialQty}>
                        Typical: {material.typicalQuantity} {material.unit}
                      </Text>
                    </View>
                    <View style={styles.materialMeta}>
                      <Text style={styles.materialCost}>{formatCurrency(material.estimatedCost)}</Text>
                      <View style={styles.frequencyBadge}>
                        <Text style={styles.frequencyText}>{material.frequency}%</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {/* Savings Tip */}
        <View style={styles.savingsTip}>
          <Ionicons name="bulb" size={16} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.savingsTipText}>
            Order in bulk with your next 2 jobs to save ~15% on these materials
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Summary & Actions */}
      <View style={styles.bottomBar}>
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Selected: {selectedMaterials.size} items</Text>
          <Text style={styles.summaryTotal}>{formatCurrency(totalEstimate)}</Text>
        </View>
        <Pressable
          style={[styles.addButton, selectedMaterials.size === 0 && styles.addButtonDisabled]}
          onPress={handleAddToList}
          disabled={selectedMaterials.size === 0}
        >
          <Ionicons name="cart" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Add to Shopping List</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Export job categories for use elsewhere
export const JOB_CATEGORIES: { id: JobCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'painting', label: 'Painting', icon: 'color-palette' },
  { id: 'plumbing', label: 'Plumbing', icon: 'water' },
  { id: 'electrical', label: 'Electrical', icon: 'flash' },
  { id: 'carpentry', label: 'Carpentry', icon: 'hammer' },
  { id: 'tiling', label: 'Tiling', icon: 'grid' },
  { id: 'general', label: 'General', icon: 'construct' },
];

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
  smartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: SemanticColors.actionPrimary + '10',
    borderRadius: 12,
    gap: Spacing.sm,
  },
  smartBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.actionPrimary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartBannerContent: {
    flex: 1,
  },
  smartBannerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  smartBannerText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  pastJobsSection: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pastJobsTitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pastJobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  pastJobInfo: {
    flex: 1,
  },
  pastJobTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  pastJobDate: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  pastJobStats: {
    alignItems: 'flex-end',
  },
  pastJobCost: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  pastJobCount: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  quickSelect: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  quickSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickSelectText: {
    color: SemanticColors.actionPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  categorySection: {
    gap: 8,
  },
  categoryTitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  materialRowSelected: {
    borderColor: SemanticColors.actionPrimary,
    backgroundColor: SemanticColors.actionPrimary + '08',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: SemanticColors.actionPrimary,
    borderColor: SemanticColors.actionPrimary,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  materialQty: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  materialMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  materialCost: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  frequencyBadge: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  frequencyText: {
    color: SemanticColors.feedbackInfo,
    fontSize: 10,
    fontWeight: '600',
  },
  savingsTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 10,
  },
  savingsTipText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 12,
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  summarySection: {
    flex: 1,
  },
  summaryLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  summaryTotal: {
    color: SemanticColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 12,
  },
  addButtonDisabled: {
    backgroundColor: SemanticColors.textTertiary,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Compact mode styles
  compactContainer: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: 10,
    padding: Spacing.sm,
    gap: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactTitle: {
    color: SemanticColors.feedbackInfo,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  compactScroll: {
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  compactChips: {
    flexDirection: 'row',
    gap: 6,
  },
  compactChip: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: 200,
  },
  compactChipSelected: {
    backgroundColor: SemanticColors.actionPrimary + '20',
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary,
  },
  compactChipText: {
    color: SemanticColors.textPrimary,
    fontSize: 11,
    fontWeight: '500',
  },
  compactChipTextSelected: {
    color: SemanticColors.actionPrimary,
  },
  compactChipPrice: {
    color: SemanticColors.textTertiary,
    fontSize: 10,
  },
  compactSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  compactSummaryText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  compactAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 8,
  },
  compactAddBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
