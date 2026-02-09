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

type DefectType = 'Gebrek' | 'Garantie';
type Severity = 'Laag' | 'Middel' | 'Hoog' | 'Kritiek';
type Trade = 'Elektra' | 'Loodgieter' | 'Timmerman' | 'Schilder' | 'Anders';

export default function LogDefectScreen() {
  const router = useRouter();
  const [defectType, setDefectType] = useState<DefectType>('Gebrek');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [guaranteeRef, setGuaranteeRef] = useState('');
  const [guaranteeExpiry, setGuaranteeExpiry] = useState('');

  const handleSubmit = () => {
    const type = defectType === 'Gebrek' ? 'Gebrek' : 'Garantie';
    Alert.alert(
      'Geregistreerd',
      `Het ${type.toLowerCase()} is succesvol geregistreerd en toegewezen voor afhandeling.`,
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2D2926" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Gebrek / Garantie</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[
                styles.chip,
                defectType === 'Gebrek' && styles.chipActive,
              ]}
              onPress={() => setDefectType('Gebrek')}
            >
              <Text
                style={[
                  styles.chipText,
                  defectType === 'Gebrek' && styles.chipTextActive,
                ]}
              >
                Gebrek
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                defectType === 'Garantie' && styles.chipActive,
              ]}
              onPress={() => setDefectType('Garantie')}
            >
              <Text
                style={[
                  styles.chipText,
                  defectType === 'Garantie' && styles.chipTextActive,
                ]}
              >
                Garantie
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Locatie</Text>
          <TextInput
            style={styles.input}
            placeholder="bijv. Blok A - Badkamer 201"
            placeholderTextColor="#8A7E76"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Beschrijving</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Beschrijf het probleem..."
            placeholderTextColor="#8A7E76"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ernst</Text>
          <View style={styles.chipRow}>
            {(['Laag', 'Middel', 'Hoog', 'Kritiek'] as Severity[]).map((sev) => (
              <TouchableOpacity
                key={sev}
                style={[
                  styles.chip,
                  severity === sev && styles.chipActive,
                ]}
                onPress={() => setSeverity(sev)}
              >
                <Text
                  style={[
                    styles.chipText,
                    severity === sev && styles.chipTextActive,
                  ]}
                >
                  {sev}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trade */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Vakgebied</Text>
          <View style={styles.chipRow}>
            {(['Elektra', 'Loodgieter', 'Timmerman', 'Schilder', 'Anders'] as Trade[]).map(
              (t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.chip,
                    trade === t && styles.chipActive,
                  ]}
                  onPress={() => setTrade(t)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      trade === t && styles.chipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {/* Guarantee Fields */}
        {defectType === 'Garantie' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Garantie referentie</Text>
              <TextInput
                style={styles.input}
                placeholder="Referentienummer"
                placeholderTextColor="#8A7E76"
                value={guaranteeRef}
                onChangeText={setGuaranteeRef}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Garantie verloopdatum</Text>
              <TextInput
                style={styles.input}
                placeholder="DD-MM-JJJJ"
                placeholderTextColor="#8A7E76"
                value={guaranteeExpiry}
                onChangeText={setGuaranteeExpiry}
              />
            </View>
          </>
        )}

        {/* Photo Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.photoButton}>
            <Ionicons name="camera-outline" size={24} color="#D2691E" />
            <Text style={styles.photoButtonText}>Foto toevoegen</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>
            {defectType === 'Gebrek' ? 'Gebrek Registreren' : 'Garantie Registreren'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xl }} />
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
    paddingTop: Spacing.xl + 20,
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
    fontWeight: '600',
    color: '#2D2926',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2926',
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  chipActive: {
    backgroundColor: '#D2691E',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A7E76',
  },
  chipTextActive: {
    color: '#FFFDF9',
  },
  input: {
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: '#2D2926',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    paddingVertical: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: Spacing.sm,
  },
  photoButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#D2691E',
  },
  submitButton: {
    backgroundColor: '#D2691E',
    borderRadius: 12,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginTop: Spacing.md,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFDF9',
  },
});
