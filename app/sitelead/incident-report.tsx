import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../src/theme/spacing';

type IncidentType = 'Incident' | 'Bijna-ongeluk' | 'Observatie';
type Severity = 'Laag' | 'Middel' | 'Hoog' | 'Kritiek';

export default function IncidentReportScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<IncidentType>('Incident');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [people, setPeople] = useState('');
  const [severity, setSeverity] = useState<Severity>('Laag');

  const handleSubmit = () => {
    Alert.alert(
      'Incident Gemeld',
      'Het incident is succesvol geregistreerd.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const renderTypeChip = (type: IncidentType) => (
    <TouchableOpacity
      key={type}
      style={[
        styles.chip,
        selectedType === type && styles.chipSelected,
      ]}
      onPress={() => setSelectedType(type)}
    >
      <Text
        style={[
          styles.chipText,
          selectedType === type && styles.chipTextSelected,
        ]}
      >
        {type}
      </Text>
    </TouchableOpacity>
  );

  const renderSeverityChip = (sev: Severity) => (
    <TouchableOpacity
      key={sev}
      style={[
        styles.chip,
        severity === sev && styles.chipSelected,
      ]}
      onPress={() => setSeverity(sev)}
    >
      <Text
        style={[
          styles.chipText,
          severity === sev && styles.chipTextSelected,
        ]}
      >
        {sev}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2D2926" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incident Melden</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.chipRow}>
            {(['Incident', 'Bijna-ongeluk', 'Observatie'] as IncidentType[]).map(renderTypeChip)}
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Locatie</Text>
          <TextInput
            style={styles.input}
            placeholder="Bijv. Bouwplaats Amsterdam-Zuid, 2e verdieping"
            placeholderTextColor="#8A7E76"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Beschrijving</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Beschrijf wat er is gebeurd..."
            placeholderTextColor="#8A7E76"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* People Involved */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Betrokken personen</Text>
          <TextInput
            style={styles.input}
            placeholder="Namen van betrokkenen"
            placeholderTextColor="#8A7E76"
            value={people}
            onChangeText={setPeople}
          />
        </View>

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ernst</Text>
          <View style={styles.chipRow}>
            {(['Laag', 'Middel', 'Hoog', 'Kritiek'] as Severity[]).map(renderSeverityChip)}
          </View>
        </View>

        {/* Photo Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Foto's</Text>
          <TouchableOpacity style={styles.photoButton}>
            <Ionicons name="camera-outline" size={24} color="#D2691E" />
            <Text style={styles.photoButtonText}>Foto toevoegen</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Incident Melden</Text>
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
  section: {
    marginBottom: Spacing.xl,
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
    borderWidth: 1,
    borderColor: '#F0EAE2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  chipSelected: {
    backgroundColor: '#D2691E',
    borderColor: '#D2691E',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D2926',
  },
  chipTextSelected: {
    color: '#FFFDF9',
  },
  input: {
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 15,
    color: '#2D2926',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: '#F0EAE2',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  photoButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D2691E',
    marginLeft: Spacing.sm,
  },
  submitButton: {
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
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFDF9',
  },
});
