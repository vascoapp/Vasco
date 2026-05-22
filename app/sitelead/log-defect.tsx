import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { showPhotoPicker, type PhotoResult } from '../../src/utils/photoPicker';
import { Toast } from '../../src/components/shared/Toast';
import { useDefects } from '../../src/services/siteLeadDataService';
import { useTranslation } from 'react-i18next';
import { FadeIn } from '../../src/components/shared/FadeIn';

type DefectType = 'Gebrek' | 'Garantie';
type Severity = 'Laag' | 'Middel' | 'Hoog' | 'Kritiek';
type Trade = 'Elektra' | 'Loodgieter' | 'Timmerman' | 'Schilder' | 'Anders';

export default function LogDefectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [defectType, setDefectType] = useState<DefectType>('Gebrek');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [guaranteeRef, setGuaranteeRef] = useState('');
  const [guaranteeExpiry, setGuaranteeExpiry] = useState('');
  const [photos, setPhotos] = useState<PhotoResult[]>([]);
  const [showToast, setShowToast] = useState(false);
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { addDefect } = useDefects(undefined, projectId);

  const handleSubmit = () => {
    addDefect({
      type: defectType.toLowerCase() as any,
      title: description.slice(0, 50) || 'Nieuw gebrek',
      location,
      description,
      severity: severity ? severity.toLowerCase() as any : 'laag',
      trade: trade || 'Anders',
      photos: photos.map(p => p.uri),
      guaranteeRef: guaranteeRef || undefined,
      guaranteeExpiry: guaranteeExpiry || undefined,
    });
    hapticSuccess();
    setShowToast(true);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('sitelead.defectTitle', 'Log Gebrek / Garantie')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <FadeIn delay={0} duration={400}>
        {/* Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.defectType', 'Type')}</Text>
          <View style={styles.chipRow}>
            <Pressable
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
                {t('sitelead.defectTypeDefect', 'Gebrek')}
              </Text>
            </Pressable>
            <Pressable
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
                {t('sitelead.defectTypeWarranty', 'Garantie')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.defectLocation', 'Locatie')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('sitelead.defectLocationPlaceholder', 'bijv. Blok A - Badkamer 201')}
            placeholderTextColor={SemanticColors.textSecondary}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.defectDescription', 'Beschrijving')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={t('sitelead.defectDescriptionPlaceholder', 'Beschrijf het probleem...')}
            placeholderTextColor={SemanticColors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.defectSeverity', 'Ernst')}</Text>
          <View style={styles.chipRow}>
            {(['Laag', 'Middel', 'Hoog', 'Kritiek'] as Severity[]).map((sev) => {
              const sevLabels: Record<Severity, string> = {
                'Laag': t('sitelead.incidentSeverityLow', 'Laag'),
                'Middel': t('sitelead.incidentSeverityMedium', 'Middel'),
                'Hoog': t('sitelead.incidentSeverityHigh', 'Hoog'),
                'Kritiek': t('sitelead.incidentSeverityCritical', 'Kritiek'),
              };
              return (
              <Pressable
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
                  {sevLabels[sev]}
                </Text>
              </Pressable>
              );
            })}
          </View>
        </View>

        {/* Trade */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('sitelead.defectTrade', 'Vakgebied')}</Text>
          <View style={styles.chipRow}>
            {(['Elektra', 'Loodgieter', 'Timmerman', 'Schilder', 'Anders'] as Trade[]).map(
              (tr) => {
                const tradeLabels: Record<Trade, string> = {
                  'Elektra': t('sitelead.defectTradeElectrical', 'Elektra'),
                  'Loodgieter': t('sitelead.defectTradePlumber', 'Loodgieter'),
                  'Timmerman': t('sitelead.defectTradeCarpenter', 'Timmerman'),
                  'Schilder': t('sitelead.defectTradePainter', 'Schilder'),
                  'Anders': t('sitelead.defectTradeOther', 'Anders'),
                };
                return (
                <Pressable
                  key={tr}
                  style={[
                    styles.chip,
                    trade === tr && styles.chipActive,
                  ]}
                  onPress={() => setTrade(tr)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      trade === tr && styles.chipTextActive,
                    ]}
                  >
                    {tradeLabels[tr]}
                  </Text>
                </Pressable>
                );
              }
            )}
          </View>
        </View>

        {/* Guarantee Fields */}
        {defectType === 'Garantie' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('sitelead.defectGuaranteeRef', 'Garantie referentie')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('sitelead.defectGuaranteeRefPlaceholder', 'Referentienummer')}
                placeholderTextColor={SemanticColors.textSecondary}
                value={guaranteeRef}
                onChangeText={setGuaranteeRef}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('sitelead.defectGuaranteeExpiry', 'Garantie verloopdatum')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('sitelead.defectGuaranteeExpiryPlaceholder', 'DD-MM-JJJJ')}
                placeholderTextColor={SemanticColors.textSecondary}
                value={guaranteeExpiry}
                onChangeText={setGuaranteeExpiry}
              />
            </View>
          </>
        )}

        {/* Photo Section */}
        <View style={styles.section}>
          <Pressable style={styles.photoButton} onPress={() => showPhotoPicker((photo) => setPhotos(prev => [...prev, photo]))}>
            <Ionicons name="camera-outline" size={24} color={Palette.hermesOrange} />
            <Text style={styles.photoButtonText}>{t('sitelead.defectAddPhoto', 'Foto toevoegen')}</Text>
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
          <Text style={styles.submitButtonText}>
            {defectType === 'Gebrek' ? t('sitelead.defectSubmitDefect', 'Gebrek Registreren') : t('sitelead.defectSubmitWarranty', 'Garantie Registreren')}
          </Text>
        </Pressable>

        <View style={{ height: Spacing.xl }} />
        </FadeIn>
      </ScrollView>
      <Toast
        message={defectType === 'Gebrek' ? t('sitelead.defectRegisteredDefect', 'Gebrek succesvol geregistreerd') : t('sitelead.defectRegisteredWarranty', 'Garantie succesvol geregistreerd')}
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
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
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
  },
  chipActive: {
    backgroundColor: Palette.hermesOrange,
  },
  chipText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  chipTextActive: {
    color: SemanticColors.surfacePrimary,
  },
  input: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  photoButtonText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },
  submitButton: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  submitButtonText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.surfacePrimary,
  },
});
