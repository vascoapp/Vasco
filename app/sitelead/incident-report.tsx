import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showPhotoPicker, type PhotoResult } from '../../src/utils/photoPicker';
import { Toast } from '../../src/components/shared/Toast';
import { useIncidents } from '../../src/services/siteLeadDataService';
import { useTranslation } from 'react-i18next';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';

type IncidentType = 'Incident' | 'Bijna-ongeluk' | 'Observatie';
type Severity = 'Laag' | 'Middel' | 'Hoog' | 'Kritiek';

export default function IncidentReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const inlineTip = useInlineInsight('sitelead', 'incident-report', 'overview');
  const [selectedType, setSelectedType] = useState<IncidentType>('Incident');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [people, setPeople] = useState('');
  const [severity, setSeverity] = useState<Severity>('Laag');
  const [photos, setPhotos] = useState<PhotoResult[]>([]);
  const [showToast, setShowToast] = useState(false);
  const { addIncident } = useIncidents();

  const FORM_KEY = '@vasco_incident_draft';

  // Restore saved draft
  useEffect(() => {
    AsyncStorage.getItem(FORM_KEY).then(saved => {
      if (saved) {
        const data = JSON.parse(saved);
        if (data.type) setSelectedType(data.type);
        if (data.location) setLocation(data.location);
        if (data.description) setDescription(data.description);
        if (data.severity) setSeverity(data.severity);
      }
    }).catch(() => {});
  }, []);

  // Auto-save draft on changes
  useEffect(() => {
    const draft = { type: selectedType, location, description, severity };
    AsyncStorage.setItem(FORM_KEY, JSON.stringify(draft)).catch(() => {});
  }, [selectedType, location, description, severity]);

  const handleSubmit = () => {
    const typeMap: Record<IncidentType, 'incident' | 'near-miss' | 'observation'> = {
      'Incident': 'incident',
      'Bijna-ongeluk': 'near-miss',
      'Observatie': 'observation',
    };
    addIncident({
      type: typeMap[selectedType],
      date: new Date().toISOString().split('T')[0],
      location,
      description,
      severity,
      peopleInvolved: people || '',
      photoCount: photos.length,
    });
    hapticSuccess();
    AsyncStorage.removeItem(FORM_KEY).catch(() => {});
    setShowToast(true);
  };

  const typeLabels: Record<IncidentType, string> = {
    'Incident': t('sitelead.incidentTypeIncident', 'Incident'),
    'Bijna-ongeluk': t('sitelead.incidentTypeNearMiss', 'Bijna-ongeluk'),
    'Observatie': t('sitelead.incidentTypeObservation', 'Observatie'),
  };

  const renderTypeChip = (type: IncidentType) => (
    <Pressable
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
        {typeLabels[type]}
      </Text>
    </Pressable>
  );

  const severityLabels: Record<Severity, string> = {
    'Laag': t('sitelead.incidentSeverityLow', 'Laag'),
    'Middel': t('sitelead.incidentSeverityMedium', 'Middel'),
    'Hoog': t('sitelead.incidentSeverityHigh', 'Hoog'),
    'Kritiek': t('sitelead.incidentSeverityCritical', 'Kritiek'),
  };

  const renderSeverityChip = (sev: Severity) => (
    <Pressable
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
        {severityLabels[sev]}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('sitelead.incidentReport', 'Incident Melden')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {inlineTip && <InlineInsight icon={inlineTip.icon as any} message={inlineTip.message} />}

        <FadeIn delay={0} duration={400}>
        {/* Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.incidentType', 'Type')}</Text>
          <View style={styles.chipRow}>
            {(['Incident', 'Bijna-ongeluk', 'Observatie'] as IncidentType[]).map(renderTypeChip)}
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.incidentLocation', 'Locatie')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('sitelead.incidentLocationPlaceholder', 'Bijv. Bouwplaats Amsterdam-Zuid, 2e verdieping')}
            placeholderTextColor={SemanticColors.textSecondary}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.incidentDescription', 'Beschrijving')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('sitelead.incidentDescriptionPlaceholder', 'Beschrijf wat er is gebeurd...')}
            placeholderTextColor={SemanticColors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* People Involved */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.incidentPeopleInvolved', 'Betrokken personen')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('sitelead.incidentPeoplePlaceholder', 'Namen van betrokkenen')}
            placeholderTextColor={SemanticColors.textSecondary}
            value={people}
            onChangeText={setPeople}
          />
        </View>

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.incidentSeverity', 'Ernst')}</Text>
          <View style={styles.chipRow}>
            {(['Laag', 'Middel', 'Hoog', 'Kritiek'] as Severity[]).map(renderSeverityChip)}
          </View>
        </View>

        {/* Photo Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.incidentPhotos', "Foto's")}</Text>
          <Pressable style={styles.photoButton} onPress={() => showPhotoPicker((photo) => setPhotos(prev => [...prev, photo]))}>
            <Ionicons name="camera-outline" size={24} color={Palette.hermesOrange} />
            <Text style={styles.photoButtonText}>{t('sitelead.incidentAddPhoto', 'Foto toevoegen')}</Text>
          </Pressable>
          {photos.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {photos.map((p, i) => (
                <View key={i} style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                  <Image source={{ uri: p.uri }} style={{ width: 64, height: 64 }} />
                  <Pressable
                    style={{ position: 'absolute', top: -4, right: -4 }}
                    onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  >
                    <Ionicons name="close-circle" size={18} color={SemanticColors.feedbackError} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Submit Button */}
        <Pressable style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>{t('sitelead.incidentSubmit', 'Incident Melden')}</Text>
        </Pressable>
        </FadeIn>
      </ScrollView>
      <Toast
        message={t('sitelead.incidentSubmitted', 'Incident Gemeld') + ' — ' + t('sitelead.incidentSubmittedDesc', 'Het incident is succesvol geregistreerd.')}
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
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
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
    borderRadius: RADIUS.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.surfaceSecondary,
  },
  chipSelected: {
    backgroundColor: Palette.hermesOrange,
    borderColor: Palette.hermesOrange,
  },
  chipText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  chipTextSelected: {
    color: SemanticColors.surfacePrimary,
  },
  input: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: SemanticColors.surfaceSecondary,
    borderStyle: 'dashed',
  },
  photoButtonText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
    marginLeft: Spacing.sm,
  },
  submitButton: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  submitButtonText: {
    fontSize: TYPE.titleSize,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.surfacePrimary,
  },
});
