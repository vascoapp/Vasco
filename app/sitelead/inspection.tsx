import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../src/theme/spacing';

interface ChecklistItem {
  id: string;
  label: string;
  note?: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: '1', label: 'PBM controle' },
  { id: '2', label: 'Stellingen veilig' },
  { id: '3', label: 'Brandblussers aanwezig' },
  { id: '4', label: 'Vluchtroutes vrij' },
  { id: '5', label: 'Gereedschap in orde' },
  { id: '6', label: 'Elektra veilig' },
  { id: '7', label: 'Steigers gekeurd' },
  { id: '8', label: 'EHBO beschikbaar' },
];

export default function InspectionScreen() {
  const router = useRouter();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

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
    Alert.alert(
      'Inspectie Afgerond',
      'De inspectie is afgerond en automatisch toegevoegd aan het compliance overzicht.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const checkedCount = checkedItems.size;
  const totalCount = CHECKLIST_ITEMS.length;
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2D2926" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Veiligheidsinspectie</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Location */}
        <View style={styles.locationCard}>
          <Ionicons name="location" size={20} color="#D2691E" />
          <Text style={styles.locationText}>Bouwplaats Amsterdam-Zuid</Text>
        </View>

        {/* Checklist Items */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Controle Punten</Text>
          {CHECKLIST_ITEMS.map((item) => {
            const isChecked = checkedItems.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.checklistItem}
                onPress={() => toggleItem(item.id)}
              >
                <Ionicons
                  name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={28}
                  color={isChecked ? '#D2691E' : '#8A7E76'}
                />
                <View style={styles.checklistContent}>
                  <Text style={[styles.checklistLabel, isChecked && styles.checklistLabelDone]}>
                    {item.label}
                  </Text>
                  {item.note && (
                    <Text style={styles.checklistNote}>{item.note}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <Text style={styles.progressText}>
            {checkedCount}/{totalCount} punten gecontroleerd
          </Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Aanvullende notities</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Voeg eventuele opmerkingen toe..."
            placeholderTextColor="#8A7E76"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Complete Button */}
        <TouchableOpacity
          style={[styles.completeButton, checkedCount < totalCount && styles.completeButtonDisabled]}
          onPress={handleComplete}
        >
          <Text style={styles.completeButtonText}>Inspectie Afronden</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl * 2,
    paddingBottom: Spacing.lg,
    backgroundColor: '#FFFDF9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D2926',
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
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2926',
    marginLeft: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2926',
    marginBottom: Spacing.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  checklistContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  checklistLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2D2926',
  },
  checklistLabelDone: {
    color: '#8A7E76',
    textDecorationLine: 'line-through',
  },
  checklistNote: {
    fontSize: 13,
    color: '#8A7E76',
    marginTop: Spacing.xs,
  },
  progressSection: {
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2926',
    marginBottom: Spacing.sm,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#F0EAE2',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#D2691E',
    borderRadius: 4,
  },
  notesInput: {
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 15,
    color: '#2D2926',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    paddingTop: Spacing.md,
  },
  completeButton: {
    backgroundColor: '#D2691E',
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFDF9',
  },
});
