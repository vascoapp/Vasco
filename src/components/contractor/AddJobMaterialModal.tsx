// Add Job Material Modal — Select material from catalog, set quantity, pick supplier
import { useState, useMemo } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useAppState } from '../../state/AppState';
import type { Material } from '../../domain/materials';

type IconName = keyof typeof Ionicons.glyphMap;

interface AddJobMaterialModalProps {
  visible: boolean;
  jobId: string;
  onClose: () => void;
}

type Step = 'select' | 'configure';

export function AddJobMaterialModal({ visible, jobId, onClose }: AddJobMaterialModalProps) {
  const { materials, suppliers, priceObservations, addJobMaterial } = useAppState();

  const [step, setStep] = useState<Step>('select');
  const [search, setSearch] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return materials;
    const q = search.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.brand && m.brand.toLowerCase().includes(q)) ||
        m.category.toLowerCase().includes(q) ||
        m.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [materials, search]);

  // Best price for selected material
  const bestPrice = useMemo(() => {
    if (!selectedMaterial) return undefined;
    const obs = priceObservations[selectedMaterial.id];
    if (!obs || obs.length === 0) return undefined;
    return obs.reduce((min, o) => (o.price < min.price ? o : min), obs[0]);
  }, [selectedMaterial, priceObservations]);

  const handleSelectMaterial = (mat: Material) => {
    setSelectedMaterial(mat);
    setUnit(mat.baseUnit);
    // Auto-select cheapest supplier if available
    if (bestPrice?.supplierId) {
      setSelectedSupplierId(bestPrice.supplierId);
    }
    setStep('configure');
  };

  const handleSave = async () => {
    if (!selectedMaterial) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Ongeldig', 'Vul een geldige hoeveelheid in.');
      return;
    }

    setSaving(true);
    try {
      const unitPrice = bestPrice?.price;
      await addJobMaterial({
        jobId,
        materialId: selectedMaterial.id,
        quantity: qty,
        unit: unit || selectedMaterial.baseUnit,
        unitPrice,
        totalPrice: unitPrice ? unitPrice * qty : undefined,
        supplierId: selectedSupplierId,
        status: 'planned',
        notes: notes.trim() || undefined,
      });
      handleClose();
    } catch {
      Alert.alert('Fout', 'Kon materiaal niet toevoegen.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSearch('');
    setSelectedMaterial(null);
    setQuantity('1');
    setUnit('');
    setSelectedSupplierId(undefined);
    setNotes('');
    onClose();
  };

  const handleBack = () => {
    setStep('select');
    setSelectedMaterial(null);
  };

  const formatCurrency = (n: number) => `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`;

  const renderMaterialItem = ({ item }: { item: Material }) => (
    <Pressable style={s.materialRow} onPress={() => handleSelectMaterial(item)}>
      <View style={s.materialIcon}>
        <Ionicons name="cube" size={20} color={SemanticColors.actionPrimary} />
      </View>
      <View style={s.materialInfo}>
        <Text style={s.materialName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.materialMeta}>
          {item.brand ? `${item.brand} · ` : ''}{item.category} · {item.baseUnit}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={step === 'configure' ? handleBack : handleClose} style={s.headerBtn}>
            <Ionicons
              name={step === 'configure' ? 'arrow-back' : 'close'}
              size={22}
              color={SemanticColors.textPrimary}
            />
          </Pressable>
          <Text style={s.headerTitle}>
            {step === 'select' ? 'Materiaal kiezen' : 'Hoeveelheid & leverancier'}
          </Text>
          <View style={s.headerBtn} />
        </View>

        {step === 'select' ? (
          /* ── Step 1: Select material from catalog ── */
          <View style={s.body}>
            <View style={s.searchBar}>
              <Ionicons name="search" size={18} color={SemanticColors.textTertiary} />
              <TextInput
                style={s.searchInput}
                placeholder="Zoek materiaal..."
                placeholderTextColor={SemanticColors.textTertiary}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              )}
            </View>

            {filteredMaterials.length > 0 ? (
              <FlatList
                data={filteredMaterials}
                keyExtractor={(m) => m.id}
                renderItem={renderMaterialItem}
                contentContainerStyle={s.listContent}
              />
            ) : (
              <View style={s.emptyState}>
                <Ionicons name="search-outline" size={40} color={SemanticColors.textTertiary} />
                <Text style={s.emptyText}>Geen materialen gevonden</Text>
              </View>
            )}
          </View>
        ) : (
          /* ── Step 2: Configure quantity, supplier, notes ── */
          <View style={s.body}>
            {/* Selected material card */}
            <View style={s.selectedCard}>
              <Ionicons name="cube" size={22} color={SemanticColors.actionPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={s.selectedName}>{selectedMaterial?.name}</Text>
                <Text style={s.selectedMeta}>
                  {selectedMaterial?.brand ? `${selectedMaterial.brand} · ` : ''}
                  {selectedMaterial?.category}
                </Text>
              </View>
              {bestPrice && (
                <View style={s.priceBadge}>
                  <Text style={s.priceText}>{formatCurrency(bestPrice.price)}</Text>
                  <Text style={s.priceUnit}>/{bestPrice.unit}</Text>
                </View>
              )}
            </View>

            {/* Quantity row */}
            <View style={s.fieldRow}>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Hoeveelheid</Text>
                <TextInput
                  style={s.fieldInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={SemanticColors.textTertiary}
                />
              </View>
              <View style={[s.fieldGroup, { flex: 0.6 }]}>
                <Text style={s.fieldLabel}>Eenheid</Text>
                <TextInput
                  style={s.fieldInput}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder={selectedMaterial?.baseUnit}
                  placeholderTextColor={SemanticColors.textTertiary}
                />
              </View>
            </View>

            {/* Supplier picker */}
            <View style={s.fieldSection}>
              <Text style={s.fieldLabel}>Leverancier</Text>
              <View style={s.supplierList}>
                {suppliers.map((sup) => {
                  const isSelected = selectedSupplierId === sup.id;
                  return (
                    <Pressable
                      key={sup.id}
                      style={[s.supplierChip, isSelected && s.supplierChipActive]}
                      onPress={() => setSelectedSupplierId(isSelected ? undefined : sup.id)}
                    >
                      <Text style={[s.supplierChipText, isSelected && s.supplierChipTextActive]}>
                        {sup.name}
                      </Text>
                      {sup.reliabilityScore && sup.reliabilityScore >= 90 && (
                        <Ionicons name="star" size={10} color={isSelected ? '#fff' : Palette.hermesOrange} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Notes */}
            <View style={s.fieldSection}>
              <Text style={s.fieldLabel}>Notities (optioneel)</Text>
              <TextInput
                style={[s.fieldInput, { height: 60, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Bijv. specifieke kleurcode..."
                placeholderTextColor={SemanticColors.textTertiary}
                multiline
              />
            </View>

            {/* Cost preview */}
            {bestPrice && quantity && (
              <View style={s.costPreview}>
                <Text style={s.costLabel}>Geschatte kosten</Text>
                <Text style={s.costValue}>
                  {formatCurrency(bestPrice.price * (parseFloat(quantity) || 0))}
                </Text>
              </View>
            )}

            {/* Save button */}
            <Pressable
              style={[s.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={s.saveButtonText}>
                {saving ? 'Toevoegen...' : 'Materiaal toevoegen'}
              </Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  body: {
    flex: 1,
    padding: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },
  listContent: {
    paddingBottom: 40,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 10,
  },
  materialIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  materialMeta: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.actionPrimary + '10',
    borderRadius: 12,
    padding: Spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '30',
    marginBottom: Spacing.md,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  selectedMeta: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  priceUnit: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fieldGroup: {
    flex: 1,
  },
  fieldSection: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: SemanticColors.textPrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  supplierList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  supplierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  supplierChipActive: {
    backgroundColor: SemanticColors.actionPrimary,
    borderColor: SemanticColors.actionPrimary,
  },
  supplierChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  supplierChipTextActive: {
    color: '#fff',
  },
  costPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    padding: Spacing.md,
    borderRadius: 10,
    marginBottom: Spacing.md,
  },
  costLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  costValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SemanticColors.actionPrimary,
    padding: Spacing.md,
    borderRadius: 12,
    marginTop: 'auto',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
