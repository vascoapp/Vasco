import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { Toast } from '../../src/components/shared/Toast';
import { useInspections } from '../../src/services/siteLeadDataService';
import { useTranslation } from 'react-i18next';
import { FadeIn } from '../../src/components/shared/FadeIn';

interface ChecklistItem {
  id: string;
  label: string;
  note?: string;
}

const CHECKLIST_KEYS = [
  { id: '1', key: 'sitelead.inspectionPpeCheck', fallback: 'PBM controle' },
  { id: '2', key: 'sitelead.inspectionScaffolding', fallback: 'Stellingen veilig' },
  { id: '3', key: 'sitelead.inspectionFireExtinguishers', fallback: 'Brandblussers aanwezig' },
  { id: '4', key: 'sitelead.inspectionEscapeRoutes', fallback: 'Vluchtroutes vrij' },
  { id: '5', key: 'sitelead.inspectionTools', fallback: 'Gereedschap in orde' },
  { id: '6', key: 'sitelead.inspectionElectrical', fallback: 'Elektra veilig' },
  { id: '7', key: 'sitelead.inspectionScaffoldApproved', fallback: 'Steigers gekeurd' },
  { id: '8', key: 'sitelead.inspectionFirstAid', fallback: 'EHBO beschikbaar' },
];

export default function InspectionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [customItems, setCustomItems] = useState<{id: string; label: string}[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const { addInspection } = useInspections();

  const checklistItems: ChecklistItem[] = CHECKLIST_KEYS.map(ck => ({
    id: ck.id,
    label: t(ck.key, ck.fallback),
  }));

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleComplete = () => {
    addInspection({
      date: new Date().toISOString().split('T')[0],
      location: 'Bouwplaats Amsterdam-Zuid',
      checkedItems: Array.from(checkedItems),
      totalItems: checklistItems.length + customItems.length,
      notes: notes || '',
    });
    hapticSuccess();
    setShowToast(true);
  };

  const checkedCount = checkedItems.size;
  const totalCount = checklistItems.length + customItems.length;
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('sitelead.inspectionTitle', 'Veiligheidsinspectie')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <FadeIn delay={0} duration={400}>
        {/* Location */}
        <View style={styles.locationCard}>
          <Ionicons name="location" size={20} color={Palette.hermesOrange} />
          <Text style={styles.locationText}>{t('sitelead.inspectionLocation', 'Bouwplaats Amsterdam-Zuid')}</Text>
        </View>

        {/* Checklist Items */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.inspectionCheckpoints', 'Controle Punten')}</Text>
          {checklistItems.map((item) => {
            const isChecked = checkedItems.has(item.id);
            return (
              <Pressable
                key={item.id}
                style={styles.checklistItem}
                onPress={() => toggleItem(item.id)}
              >
                <Ionicons
                  name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={28}
                  color={isChecked ? Palette.hermesOrange : SemanticColors.textSecondary}
                />
                <View style={styles.checklistContent}>
                  <Text style={[styles.checklistLabel, isChecked && styles.checklistLabelDone]}>
                    {item.label}
                  </Text>
                  {item.note && (
                    <Text style={styles.checklistNote}>{item.note}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}

          {/* Custom Items */}
          {customItems.map((item) => {
            const isChecked = checkedItems.has(item.id);
            return (
              <Pressable
                key={item.id}
                style={styles.checklistItem}
                onPress={() => toggleItem(item.id)}
              >
                <Ionicons
                  name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={28}
                  color={isChecked ? Palette.hermesOrange : SemanticColors.textSecondary}
                />
                <View style={styles.checklistContent}>
                  <Text style={[styles.checklistLabel, isChecked && styles.checklistLabelDone]}>
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {/* Add Custom Item */}
          {showAddItem && (
            <View style={styles.addItemRow}>
              <TextInput
                style={styles.addItemInput}
                placeholder="Nieuw controlepunt..."
                placeholderTextColor={SemanticColors.textSecondary}
                value={newItemText}
                onChangeText={setNewItemText}
                autoFocus
                onSubmitEditing={() => {
                  if (newItemText.trim()) {
                    setCustomItems(prev => [...prev, { id: 'c-' + Date.now(), label: newItemText.trim() }]);
                    setNewItemText('');
                    setShowAddItem(false);
                  }
                }}
              />
              <Pressable
                style={[styles.addItemConfirm, !newItemText.trim() && { opacity: 0.4 }]}
                onPress={() => {
                  if (newItemText.trim()) {
                    setCustomItems(prev => [...prev, { id: 'c-' + Date.now(), label: newItemText.trim() }]);
                    setNewItemText('');
                    setShowAddItem(false);
                  }
                }}
              >
                <Text style={styles.addItemConfirmText}>Toevoegen</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={styles.addItemButton}
            onPress={() => setShowAddItem(!showAddItem)}
          >
            <Ionicons name={showAddItem ? 'close' : 'add-circle-outline'} size={22} color={Palette.hermesOrange} />
            <Text style={styles.addItemButtonText}>
              {showAddItem ? 'Annuleren' : 'Punt toevoegen'}
            </Text>
          </Pressable>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <Text style={styles.progressText}>
            {t('sitelead.inspectionProgress', '{{checked}}/{{total}} punten gecontroleerd', { checked: checkedCount, total: totalCount })}
          </Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.inspectionNotes', 'Aanvullende notities')}</Text>
          <TextInput
            style={styles.notesInput}
            placeholder={t('sitelead.inspectionNotesPlaceholder', 'Voeg eventuele opmerkingen toe...')}
            placeholderTextColor={SemanticColors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Complete Button */}
        <Pressable
          style={[styles.completeButton, checkedCount < totalCount && styles.completeButtonDisabled]}
          onPress={handleComplete}
        >
          <Text style={styles.completeButtonText}>{t('sitelead.inspectionComplete', 'Inspectie Afronden')}</Text>
        </Pressable>
        </FadeIn>
      </ScrollView>
      <Toast
        message={t('sitelead.inspectionCompleted', 'Inspectie succesvol afgerond')}
        visible={showToast}
        onHide={() => { setShowToast(false); router.back(); }}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.lg,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  locationText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginLeft: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  checklistContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  checklistLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  checklistLabelDone: {
    color: SemanticColors.textSecondary,
    textDecorationLine: 'line-through',
  },
  checklistNote: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: Spacing.xs,
  },
  progressSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  progressText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 4,
  },
  notesInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  completeButton: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    fontSize: TYPE.titleSize,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.surfacePrimary,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  addItemButtonText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  addItemInput: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
  },
  addItemConfirm: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addItemConfirmText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
});
