// =============================================================================
// PERMITS — Contractor Permit Dashboard & Wizard
// =============================================================================
// View, create, and track permits for contractor jobs
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { formatDateShortAuto } from '../../src/i18n/formatting';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import type { PermitStatus, PermitType } from '../../src/types/buildos';
import { DKMenu } from '../../src/components/shared/DKMenu';

const PERMITS_STORAGE_KEY = '@vasco_contractor_permits';

type IconName = keyof typeof Ionicons.glyphMap;
type TabType = 'overzicht' | 'nieuw';

// =============================================================================
// STATUS CONFIG
// =============================================================================

const getStatusConfig = (t: (key: string, defaultValue: string) => string): Record<PermitStatus, { label: string; color: string; icon: IconName }> => ({
  'not-submitted': { label: t('permits.statusNotSubmitted', 'Niet ingediend'), color: SemanticColors.textTertiary, icon: 'document-outline' },
  'submitted': { label: t('permits.statusSubmitted', 'Ingediend'), color: SemanticColors.feedbackInfo, icon: 'paper-plane-outline' },
  'under-review': { label: t('permits.statusUnderReview', 'In behandeling'), color: Palette.hermesOrange, icon: 'hourglass-outline' },
  'information-requested': { label: t('permits.statusInfoRequested', 'Info gevraagd'), color: SemanticColors.feedbackWarning, icon: 'alert-circle-outline' },
  'approved': { label: t('permits.statusApproved', 'Goedgekeurd'), color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' },
  'approved-with-conditions': { label: t('permits.statusConditional', 'Voorwaardelijk'), color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle-outline' },
  'rejected': { label: t('permits.statusRejected', 'Afgewezen'), color: SemanticColors.feedbackError, icon: 'close-circle' },
  'appealed': { label: t('permits.statusAppealed', 'Bezwaar'), color: '#a855f7', icon: 'flag-outline' },
});

const getPermitTypes = (t: (key: string, defaultValue: string) => string): { id: PermitType; label: string; description: string; icon: IconName }[] => [
  { id: 'omgevingsvergunning', label: t('permits.typeEnvironmental', 'Omgevingsvergunning'), description: t('permits.typeEnvironmentalDesc', 'Bouw, verbouw, of gebruik wijziging'), icon: 'business-outline' },
  { id: 'building-control', label: t('permits.typeBuildingControl', 'Bouwtoezicht'), description: t('permits.typeBuildingControlDesc', 'Constructieve veiligheid en brandveiligheid'), icon: 'shield-checkmark-outline' },
  { id: 'environmental', label: t('permits.typeEnvPermit', 'Milieuvergunning'), description: t('permits.typeEnvPermitDesc', 'Milieu-impact en afvalverwerking'), icon: 'leaf-outline' },
  { id: 'other', label: t('permits.typeOther', 'Overig'), description: t('permits.typeOtherDesc', 'Sloopmelding, gebruiksvergunning, etc.'), icon: 'document-text-outline' },
];

// =============================================================================
// PERMIT TYPES
// =============================================================================
// R11.3: dropped the hardcoded mockPermits array (3 fake refs incl. "Bakkerij
// Jansen — Winkelstraat 12, Utrecht"). Every contractor opening this screen
// saw someone else's permits seeded in their state. Permits now load from
// AsyncStorage and start as an empty list for new users.

interface ContractorPermit {
  id: string;
  type: PermitType;
  reference: string;
  authority: string;
  status: PermitStatus;
  jobTitle: string;
  address: string;
  submissionDate?: string;
  targetDecisionDate?: string;
  notes?: string;
  documents: string[];
}

// =============================================================================
// WIZARD STATE
// =============================================================================

interface WizardState {
  step: number;
  permitType?: PermitType;
  jobTitle: string;
  address: string;
  authority: string;
  notes: string;
}

// =============================================================================
// SCREEN
// =============================================================================

export default function PermitsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { jobs } = useAppState();
  // R20: route param from queueItemExecutor when an AI queue item like
  // permit_check / cert_renewal carried a jobId in preparedData. Used to
  // scope the permits list + auto-expand the matching permit so the
  // contractor lands oriented instead of having to search the full list.
  const { jobId: focusJobId } = useLocalSearchParams<{ jobId?: string }>();
  const STATUS_CONFIG = getStatusConfig(t);
  const PERMIT_TYPES = getPermitTypes(t);
  const [activeTab, setActiveTab] = useState<TabType>('overzicht');
  // R11.3: real persistence. Permits seed empty + hydrate from AsyncStorage.
  // Any change is written back so created permits survive app restart.
  const [permits, setPermits] = useState<ContractorPermit[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // R20: when launched via queue executor with ?jobId=, scope the rendered
  // list to that job's permits and let the contractor explicitly clear
  // the filter via a dismiss chip.
  const [scopeJobId, setScopeJobId] = useState<string | null>(focusJobId ?? null);
  const focusJob = useMemo(
    () => (scopeJobId ? jobs.find((j: any) => j.id === scopeJobId) : null),
    [scopeJobId, jobs],
  );
  const visiblePermits = useMemo(() => {
    if (!focusJob) return permits;
    const titleLower = (focusJob.title ?? '').toLowerCase();
    return permits.filter((p) => p.jobTitle.toLowerCase().includes(titleLower));
  }, [permits, focusJob]);
  // Auto-expand the first matching permit on entry from the queue.
  useEffect(() => {
    if (!focusJob || expandedId) return;
    if (visiblePermits.length > 0) setExpandedId(visiblePermits[0].id);
  }, [focusJob, visiblePermits, expandedId]);

  // Load on mount
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PERMITS_STORAGE_KEY)
      .then(raw => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setPermits(parsed);
        } catch {}
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Persist on change (skip the initial empty-state write — only save once
  // we've either hydrated or the user has explicitly added a permit).
  useEffect(() => {
    if (permits.length === 0) return;
    AsyncStorage.setItem(PERMITS_STORAGE_KEY, JSON.stringify(permits)).catch(() => {});
  }, [permits]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<WizardState>({
    step: 1,
    jobTitle: '',
    address: '',
    authority: '',
    notes: '',
  });

  // Stats
  const approved = permits.filter(p => p.status === 'approved' || p.status === 'approved-with-conditions').length;
  const pending = permits.filter(p => ['submitted', 'under-review', 'information-requested'].includes(p.status)).length;
  const notSubmitted = permits.filter(p => p.status === 'not-submitted').length;

  // Attach a document to a permit. Without this there was no upload UI
  // anywhere in the file — `documents` was initialised to [] and never
  // mutated, so the "Aanvraag indienen" CTA below could only ever hit its
  // "upload documents first" Alert. The permit could never leave
  // 'not-submitted', which made every later status in STATUS_CONFIG dead.
  const attachDocument = async (permitId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const names = result.assets.map(a => a.name).filter(Boolean);
      setPermits(prev => prev.map(p =>
        p.id === permitId ? { ...p, documents: [...p.documents, ...names] } : p,
      ));
    } catch {
      Alert.alert(
        t('permits.attachFailed', 'Toevoegen mislukt'),
        t('permits.attachFailedDesc', 'Kon het document niet toevoegen. Probeer het opnieuw.'),
      );
    }
  };

  // Vasco has no connection to a municipality or Omgevingsloket — permits are
  // filed through each authority's own counter or portal. So "submit" hands
  // off and then records what the contractor did, rather than pretending to
  // transmit anything.
  const markPermitSubmitted = (permit: ContractorPermit) => {
    Alert.alert(
      t('permits.submitRequest', 'Aanvraag indienen'),
      t('permits.submitHandoffDesc', {
        defaultValue:
          'Vasco cannot file this for you — submit it at {{authority}} yourself, then mark it as submitted here so we can track the decision deadline.',
        authority: permit.authority,
      }),
      [
        { text: t('permits.cancel', 'Annuleren'), style: 'cancel' },
        {
          text: t('permits.markSubmitted', 'Markeer als ingediend'),
          onPress: () => {
            const now = new Date();
            // Standard EU short-track decision window is 8 weeks; this is a
            // reminder date the contractor can correct, not a promise.
            const target = new Date(now.getTime() + 56 * 24 * 60 * 60 * 1000);
            setPermits(prev => prev.map(p =>
              p.id === permit.id
                ? {
                    ...p,
                    status: 'submitted' as PermitStatus,
                    submissionDate: now.toISOString(),
                    targetDecisionDate: target.toISOString(),
                  }
                : p,
            ));
          },
        },
      ],
    );
  };

  const handleCreatePermit = () => {
    if (!wizard.permitType || !wizard.jobTitle.trim()) {
      Alert.alert(t('permits.fillRequired', 'Vul vereiste velden in'), t('permits.fillRequiredDesc', 'Kies een vergunningstype en vul de klusnaam in.'));
      return;
    }

    const newPermit: ContractorPermit = {
      id: `p-${Date.now()}`,
      type: wizard.permitType,
      reference: '',
      // Was a hardcoded Dutch 'Gemeente' written into stored data — wrong for
      // DE/FR/ES/IT contractors, and it now shows in the submit hand-off.
      authority: wizard.authority || t('permits.defaultAuthority', 'Gemeente'),
      status: 'not-submitted',
      jobTitle: wizard.jobTitle,
      address: wizard.address,
      notes: wizard.notes || undefined,
      documents: [],
    };

    setPermits(prev => [newPermit, ...prev]);
    setWizard({ step: 1, jobTitle: '', address: '', authority: '', notes: '' });
    setSelectedJobId(null);
    setActiveTab('overzicht');
    Alert.alert(t('permits.permitCreated', 'Vergunning aangemaakt'), t('permits.permitCreatedDesc', 'De vergunning is opgeslagen als concept. Voeg documenten toe en dien in bij de gemeente.'));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Terug">
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('permits.title', 'Vergunningen')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('permits.headerStats', { defaultValue: '{{approved}} approved · {{pending}} under review · {{notSubmitted}} draft', approved, pending, notSubmitted })}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'overzicht' && styles.tabActive]}
          onPress={() => setActiveTab('overzicht')}
        >
          <Text style={[styles.tabText, activeTab === 'overzicht' && styles.tabTextActive]}>{t('permits.overview', 'Overzicht')}</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'nieuw' && styles.tabActive]}
          onPress={() => { setActiveTab('nieuw'); setWizard(w => ({ ...w, step: 1 })); }}
        >
          <Text style={[styles.tabText, activeTab === 'nieuw' && styles.tabTextActive]}>{t('permits.newRequest', '+ Nieuwe aanvraag')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'overzicht' ? (
          /* Overview Tab */
          <View style={{ gap: 6 }}>
            {/* R20: scope chip — visible when launched from queue with ?jobId.
                 Tap × to clear the filter and see all permits. */}
            {focusJob && (
              <Pressable style={styles.scopeChip} onPress={() => setScopeJobId(null)} accessibilityRole="button" accessibilityLabel={t('permits.clearScope', 'Show all permits')}>
                <Ionicons name="filter" size={14} color={Palette.hermesOrange} />
                <Text style={styles.scopeChipText} numberOfLines={1}>
                  {t('permits.scopedTo', { defaultValue: 'Scoped to: {{job}}', job: focusJob.title ?? '' })}
                </Text>
                <Ionicons name="close" size={14} color={SemanticColors.textTertiary} />
              </Pressable>
            )}
            {visiblePermits.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={36} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyStateTitle}>
                  {focusJob
                    ? t('permits.emptyForJob', 'No permits for this job')
                    : t('permits.emptyTitle', 'No permits yet')}
                </Text>
                <Text style={styles.emptyStateDesc}>
                  {focusJob
                    ? t('permits.emptyForJobDesc', 'Tap "+ New request" to draft one for this job.')
                    : t('permits.emptyDesc', 'Tap "+ New request" to draft a permit for one of your jobs.')}
                </Text>
              </View>
            )}
            {visiblePermits.map(permit => {
              const config = STATUS_CONFIG[permit.status];
              const isExpanded = expandedId === permit.id;

              return (
                <View key={permit.id}>
                  <Pressable
                    style={styles.permitCard}
                    onPress={() => setExpandedId(isExpanded ? null : permit.id)}
                  >
                    <View style={[styles.permitAccent, { backgroundColor: config.color }]} />
                    <Ionicons name={config.icon} size={20} color={config.color} style={{ marginLeft: Spacing.sm }} />
                    <View style={styles.permitInfo}>
                      <Text style={styles.permitTitle} numberOfLines={1}>{permit.jobTitle}</Text>
                      <Text style={styles.permitType} numberOfLines={1}>
                        {PERMIT_TYPES.find(t => t.id === permit.type)?.label ?? permit.type}
                      </Text>
                      {permit.reference ? (
                        <Text style={styles.permitRef}>{permit.reference}</Text>
                      ) : null}
                    </View>
                    <View style={styles.permitRight}>
                      <Text style={[styles.permitStatus, { color: config.color }]}>{config.label}</Text>
                    </View>
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {permit.address ? (
                        <View style={styles.detailRow}>
                          <Ionicons name="location-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.detailText}>{permit.address}</Text>
                        </View>
                      ) : null}
                      {permit.authority ? (
                        <View style={styles.detailRow}>
                          <Ionicons name="business-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.detailText}>{permit.authority}</Text>
                        </View>
                      ) : null}
                      {permit.submissionDate ? (
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.detailText}>
                            {t('permits.submitted', 'Ingediend')}: {formatDateShortAuto(new Date(permit.submissionDate))}
                          </Text>
                        </View>
                      ) : null}
                      {permit.targetDecisionDate ? (
                        <View style={styles.detailRow}>
                          <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.detailText}>
                            {t('permits.decisionExpected', 'Besluit verwacht')}: {formatDateShortAuto(new Date(permit.targetDecisionDate))}
                          </Text>
                        </View>
                      ) : null}
                      {permit.documents.length > 0 && (
                        <View style={styles.docsRow}>
                          <Ionicons name="attach-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.detailText}>{permit.documents.join(', ')}</Text>
                        </View>
                      )}
                      {permit.status === 'not-submitted' && (
                        <>
                          <Pressable style={styles.attachButton} onPress={() => attachDocument(permit.id)}>
                            <Ionicons name="cloud-upload-outline" size={15} color={Palette.hermesOrange} />
                            <Text style={styles.attachButtonText}>{t('permits.addDocuments', 'Documenten toevoegen')}</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.submitButton, permit.documents.length === 0 && styles.submitButtonDisabled]}
                            disabled={permit.documents.length === 0}
                            onPress={() => markPermitSubmitted(permit)}
                          >
                            <Text style={styles.submitButtonText}>{t('permits.submitRequest', 'Aanvraag indienen')}</Text>
                          </Pressable>
                          {permit.documents.length === 0 && (
                            <Text style={styles.submitHint}>
                              {t('permits.documentsNeededDesc', 'Upload eerst de vereiste documenten voordat u de aanvraag kunt indienen.')}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          /* Wizard Tab */
          <View style={{ gap: Spacing.md }}>
            {wizard.step === 1 ? (
              /* Step 1: Choose permit type */
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.wizardTitle}>{t('permits.step1Title', 'Stap 1: Type vergunning')}</Text>
                <Text style={styles.wizardSubtitle}>{t('permits.step1Subtitle', 'Kies het type vergunning dat u nodig heeft')}</Text>
                {PERMIT_TYPES.map(type => (
                  <Pressable
                    key={type.id}
                    style={[styles.typeCard, wizard.permitType === type.id && styles.typeCardSelected]}
                    onPress={() => setWizard(w => ({ ...w, permitType: type.id, step: 2 }))}
                  >
                    <Ionicons
                      name={type.icon}
                      size={24}
                      color={wizard.permitType === type.id ? Palette.hermesOrange : SemanticColors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeName}>{type.label}</Text>
                      <Text style={styles.typeDesc}>{type.description}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                  </Pressable>
                ))}
              </View>
            ) : (
              /* Step 2: Details */
              <View style={{ gap: Spacing.sm }}>
                <Pressable onPress={() => setWizard(w => ({ ...w, step: 1 }))}>
                  <Text style={styles.wizardBack}>{t('permits.backToType', '← Terug naar type')}</Text>
                </Pressable>
                <Text style={styles.wizardTitle}>{t('permits.step2Title', 'Stap 2: Projectgegevens')}</Text>
                <Text style={styles.wizardSubtitle}>
                  {PERMIT_TYPES.find(t => t.id === wizard.permitType)?.label}
                </Text>

                {/* Job picker for auto-fill.

                    Was a horizontal chip strip: picking ONE job out of N, with
                    every option past the right edge invisible — "Rohrbruch
                    Küc…" was already clipped with only two jobs on file. That
                    is the exact case CLAUDE.md reserves for DKMenu; chips are
                    for multi-select filters where every option should be
                    visible at once. */}
                {jobs.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('permits.selectJob', 'Koppel aan klus')}</Text>
                    <DKMenu
                      accessibilityLabel={t('permits.selectJob', 'Link to job')}
                      items={[
                        {
                          key: '__manual__',
                          label: t('permits.manualEntry', 'Handmatig'),
                          selected: !selectedJobId,
                          emphasis: true,
                          onPress: () => {
                            setSelectedJobId(null);
                            setWizard(w => ({ ...w, jobTitle: '', address: '' }));
                          },
                        },
                        ...jobs.map(j => ({
                          key: j.id,
                          label: j.title,
                          selected: selectedJobId === j.id,
                          onPress: () => {
                            setSelectedJobId(j.id);
                            const addr = j.address ? [j.address.street, j.address.city].filter(Boolean).join(', ') : '';
                            setWizard(w => ({ ...w, jobTitle: j.title, address: addr }));
                          },
                        })),
                      ]}
                      renderAnchor={(open) => (
                        <Pressable style={styles.jobPickerAnchor} onPress={open} accessibilityRole="button">
                          <Text style={styles.jobPickerAnchorText} numberOfLines={1}>
                            {jobs.find(j => j.id === selectedJobId)?.title
                              ?? t('permits.manualEntry', 'Handmatig')}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color={SemanticColors.textTertiary} />
                        </Pressable>
                      )}
                    />
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('permits.jobName', 'Klusnaam')} *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={wizard.jobTitle}
                    onChangeText={v => setWizard(w => ({ ...w, jobTitle: v }))}
                    placeholder={t('permits.jobNamePlaceholder', 'bijv. Warmtepomp installatie')}
                    placeholderTextColor={SemanticColors.textTertiary}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('permits.address', 'Adres')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={wizard.address}
                    onChangeText={v => setWizard(w => ({ ...w, address: v }))}
                    placeholder={t('permits.addressPlaceholder', 'Straat, stad')}
                    placeholderTextColor={SemanticColors.textTertiary}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('permits.authority', 'Bevoegd gezag')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={wizard.authority}
                    onChangeText={v => setWizard(w => ({ ...w, authority: v }))}
                    placeholder={t('permits.authorityPlaceholder', 'bijv. Gemeente Amsterdam')}
                    placeholderTextColor={SemanticColors.textTertiary}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('permits.notes', 'Notities')}</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                    value={wizard.notes}
                    onChangeText={v => setWizard(w => ({ ...w, notes: v }))}
                    placeholder={t('permits.optional', 'Optioneel')}
                    placeholderTextColor={SemanticColors.textTertiary}
                    multiline
                  />
                </View>

                <Pressable style={styles.createButton} onPress={handleCreatePermit}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>{t('permits.createPermit', 'Vergunning aanmaken')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center' },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textTertiary },
  tabTextActive: { color: '#fff' },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  // R20: scope chip rendered when entered via queue executor with ?jobId=
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Palette.hermesOrange + '14',
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  scopeChipText: {
    fontSize: 12,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
    maxWidth: 220,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
    marginTop: 8,
  },
  emptyStateDesc: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },

  // Permit cards
  permitCard: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingRight: Spacing.sm,
    gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, overflow: 'hidden',
  },
  permitAccent: { width: 3, alignSelf: 'stretch' },
  permitInfo: { flex: 1 },
  permitTitle: { fontSize: 14, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  permitType: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 1 },
  permitRef: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
  permitRight: { alignItems: 'flex-end' },
  permitStatus: { fontSize: 11, fontFamily: 'Archivo_700Bold' },

  // Expanded
  expandedContent: {
    backgroundColor: SemanticColors.surfacePrimary,
    marginTop: -6, marginBottom: 6,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    padding: Spacing.sm, paddingTop: Spacing.xs, gap: 6,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: SemanticColors.textSecondary },
  submitButton: {
    alignItems: 'center', backgroundColor: Palette.hermesOrange + '10',
    paddingVertical: 8, borderRadius: 8, marginTop: 4,
  },
  submitButtonText: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: Palette.hermesOrange },
  submitButtonDisabled: { opacity: 0.4 },
  submitHint: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 4, lineHeight: 15 },
  attachButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 8, marginTop: 4,
    borderWidth: 1, borderColor: Palette.hermesOrange, borderStyle: 'dashed',
  },
  attachButtonText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },

  // Wizard
  wizardTitle: { fontSize: 20, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  wizardSubtitle: { fontSize: 14, color: SemanticColors.textSecondary },
  wizardBack: { fontSize: 14, color: Palette.hermesOrange, fontFamily: 'Archivo_700Bold' },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12,
    padding: Spacing.md, borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  typeCardSelected: { borderColor: Palette.hermesOrange, backgroundColor: Palette.hermesOrange + '08' },
  typeName: { fontSize: 15, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  typeDesc: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textSecondary },
  textInput: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12,
    padding: Spacing.sm, paddingHorizontal: Spacing.md,
    fontSize: 15, color: SemanticColors.textPrimary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  jobPickerAnchor: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  // flex + minWidth so a long job title shrinks rather than pushing the
  // chevron out of the row.
  jobPickerAnchorText: {
    flex: 1, minWidth: 0,
    fontSize: 15, color: SemanticColors.textPrimary,
  },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, backgroundColor: Palette.hermesOrange,
    borderRadius: 12, padding: Spacing.md, paddingVertical: 14, marginTop: Spacing.sm,
  },
  createButtonText: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: '#fff' },
});
