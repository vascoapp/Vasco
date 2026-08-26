// =============================================================================
// SERVICE AGREEMENTS — Recurring jobs & service contracts
// =============================================================================

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DKMenu } from '../../src/components/shared/DKMenu';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import {
  useServiceAgreements,
  createRecurringJob,
  getFrequencyLabel,
  type RecurringFrequency,
  type ServiceAgreement,
} from '../../src/services/recurringJobService';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency, type Country, formatDayMonthAuto } from '../../src/i18n/formatting';
import { makeEntityLabels } from '../../src/i18n/entityLabels';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { hapticSuccess } from '../../src/utils/haptics';
import { localDateKey } from '../../src/utils/dateKey';

type IconName = keyof typeof Ionicons.glyphMap;

const FREQUENCY_OPTIONS: RecurringFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

export default function ServiceAgreementsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  // Localise the frequency + status enums (getFrequencyLabel returns English;
  // the status badge used a raw capitalised enum).
  const freqLabel = (f: RecurringFrequency) => t(`agreements.freq.${f}`, getFrequencyLabel(f));
  const statusLabel = (st: string) => t(`agreements.status.${st}`, st.charAt(0).toUpperCase() + st.slice(1));
  // The trade meta rendered the raw slug ('plumbing') next to the localised
  // frequency and status the R322 pass fixed — same leak, one row over.
  const { tradeLabel } = makeEntityLabels(t);
  const router = useRouter();
  const { jobs, customers } = useAppState();
  const {
    agreements,
    loading,
    refresh,
    pause,
    resume,
    cancel,
    activeCount,
    annualRevenue,
    monthlyRevenue,
  } = useServiceAgreements();
  const [showNewForm, setShowNewForm] = useState(false);

  // New agreement form state
  const [formJobId, setFormJobId] = useState<string | null>(null);
  const [formFrequency, setFormFrequency] = useState<RecurringFrequency>('monthly');
  const [formStartDate, setFormStartDate] = useState(
    localDateKey(new Date(Date.now() + 7 * 86400000))
  );
  const [formAutoInvoice, setFormAutoInvoice] = useState(true);

  const eligibleJobs = useMemo(
    () => jobs.filter(j => j.status === 'completed' || j.status === 'in-progress' || j.status === 'scheduled'),
    [jobs],
  );

  const handleCreateAgreement = async () => {
    if (!formJobId) {
      Alert.alert(t('agreements.selectJob', 'Select a job'), t('agreements.selectJobDesc', 'Choose a job to use as template for this recurring agreement.'));
      return;
    }
    const job = jobs.find(j => j.id === formJobId);
    if (!job) return;

    const cust = customers.find(c => c.id === job.customerId);
    hapticSuccess();

    await createRecurringJob(
      job,
      { frequency: formFrequency, nextDate: formStartDate, autoInvoice: formAutoInvoice },
      cust?.name || '',
    );
    await refresh();
    setShowNewForm(false);
    setFormJobId(null);
  };

  const handleAction = (agreement: ServiceAgreement) => {
    const actions: any[] = [];
    if (agreement.status === 'active') {
      actions.push({
        text: t('agreements.pause', 'Pause'),
        onPress: () => { hapticSuccess(); pause(agreement.id); },
      });
    }
    if (agreement.status === 'paused') {
      actions.push({
        text: t('agreements.resume', 'Resume'),
        onPress: () => { hapticSuccess(); resume(agreement.id); },
      });
    }
    if (agreement.status !== 'cancelled') {
      actions.push({
        text: t('agreements.cancel', 'Cancel agreement'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            t('agreements.confirmCancel', 'Cancel agreement?'),
            t('agreements.confirmCancelDesc', 'This will stop all future occurrences. Existing jobs are not affected.'),
            [
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
              { text: t('agreements.confirm', 'Confirm'), style: 'destructive', onPress: () => { hapticSuccess(); cancel(agreement.id); } },
            ],
          );
        },
      });
    }
    actions.push({ text: t('common.cancel', 'Cancel'), style: 'cancel' });

    Alert.alert(agreement.jobTitle, `${agreement.customerName} · ${freqLabel(agreement.frequency)}`, actions);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return SemanticColors.feedbackSuccess;
      case 'paused': return '#F59E0B';
      case 'cancelled': return SemanticColors.feedbackError;
      default: return SemanticColors.textDisabled;
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitle}>{t('agreements.title', 'Service Agreements')}</Text>
          <Text style={s.headerSub}>
            {t('agreements.subtitle', { defaultValue: '{{count}} active agreements', count: activeCount })}
          </Text>
        </View>
        <Pressable
          style={s.addButton}
          onPress={() => setShowNewForm(!showNewForm)}
          accessibilityRole="button"
          accessibilityLabel={t('agreements.new', 'New agreement')}
        >
          <Ionicons name={showNewForm ? 'close' : 'add'} size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Revenue KPIs */}
        <FadeIn delay={0}>
          <View style={s.kpiRow}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>{t('agreements.monthlyRevenue', 'Monthly')}</Text>
              <Text style={s.kpiValue}>{formatCurrency(monthlyRevenue, country)}</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>{t('agreements.annualRevenue', 'Annual')}</Text>
              <Text style={s.kpiValue}>{formatCurrency(annualRevenue, country)}</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>{t('agreements.active', 'Active')}</Text>
              <Text style={[s.kpiValue, { color: Palette.hermesOrange }]}>{activeCount}</Text>
            </View>
          </View>
        </FadeIn>

        {/* New agreement form */}
        {showNewForm && (
          <FadeIn delay={0}>
            <View style={s.formCard}>
              <Text style={s.formTitle}>{t('agreements.newAgreement', 'New Service Agreement')}</Text>

              {/* Job selector.

                  Was a horizontal chip strip over every eligible job. This is
                  the SAME control, on the same kind of form, that #221 found
                  in the permit wizard: the strip showed two jobs with the
                  second already clipped, and opening it as a menu revealed
                  eight. A contractor picking the template job for a recurring
                  agreement is choosing one of N — a balloon menu, per
                  CLAUDE.md. */}
              <Text style={s.formLabel}>{t('agreements.templateJob', 'Template job')}</Text>
              <DKMenu
                accessibilityLabel={t('agreements.templateJob', 'Template job')}
                items={eligibleJobs.map((job) => ({
                  key: job.id,
                  label: job.title,
                  selected: job.id === formJobId,
                  onPress: () => setFormJobId(job.id),
                }))}
                renderAnchor={(open) => (
                  <Pressable
                    onPress={open}
                    style={[s.jobChip, s.jobPicker, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    accessibilityRole="button"
                  >
                    <Text style={s.jobChipText} numberOfLines={1}>
                      {eligibleJobs.find((j) => j.id === formJobId)?.title
                        ?? t('agreements.selectJob', 'Choose a job')}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={SemanticColors.textTertiary} />
                  </Pressable>
                )}
              />

              {/* Frequency selector */}
              <Text style={s.formLabel}>{t('agreements.frequency', 'Frequency')}</Text>
              <View style={s.frequencyRow}>
                {FREQUENCY_OPTIONS.map(freq => {
                  const selected = freq === formFrequency;
                  return (
                    <Pressable
                      key={freq}
                      style={[s.freqChip, selected && s.freqChipSelected]}
                      onPress={() => setFormFrequency(freq)}
                    >
                      <Text style={[s.freqChipText, selected && s.freqChipTextSelected]}>
                        {freqLabel(freq)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Start date */}
              <Text style={s.formLabel}>{t('agreements.startDate', 'First occurrence')}</Text>
              <TextInput
                style={s.dateInput}
                value={formStartDate}
                onChangeText={setFormStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={SemanticColors.textDisabled}
              />

              {/* Auto-invoice toggle */}
              <View style={s.toggleRow}>
                <Text style={s.toggleLabel}>{t('agreements.autoInvoice', 'Auto-generate invoice')}</Text>
                <Pressable
                  style={[s.toggleBtn, formAutoInvoice && s.toggleBtnActive]}
                  onPress={() => setFormAutoInvoice(!formAutoInvoice)}
                >
                  <Text style={[s.toggleBtnText, formAutoInvoice && s.toggleBtnTextActive]}>
                    {formAutoInvoice ? t('common.on', 'On') : t('common.off', 'Off')}
                  </Text>
                </Pressable>
              </View>

              {/* Create button */}
              <Pressable style={s.createButton} onPress={handleCreateAgreement}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.createButtonText}>{t('agreements.create', 'Create Agreement')}</Text>
              </Pressable>
            </View>
          </FadeIn>
        )}

        {/* Agreements list */}
        {agreements.length === 0 && !showNewForm ? (
          <FadeIn delay={100}>
            <View style={s.emptyState}>
              <Ionicons name="repeat-outline" size={48} color={SemanticColors.textDisabled} />
              <Text style={s.emptyTitle}>{t('agreements.noAgreements', 'No service agreements')}</Text>
              <Text style={s.emptyDesc}>
                {t('agreements.noAgreementsDesc', 'Create recurring job agreements for maintenance contracts, regular inspections, and more.')}
              </Text>
            </View>
          </FadeIn>
        ) : (
          agreements.map((agreement, i) => (
            <FadeIn key={agreement.id} delay={50 + i * 30}>
              <Pressable
                style={s.agreementCard}
                onPress={() => handleAction(agreement)}
                accessibilityRole="button"
              >
                <View style={s.agreementHeader}>
                  <View style={[s.agreementStatusDot, { backgroundColor: getStatusColor(agreement.status) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.agreementTitle} numberOfLines={1}>{agreement.jobTitle}</Text>
                    <Text style={s.agreementCustomer}>{agreement.customerName}</Text>
                  </View>
                  <View style={s.agreementAmountWrap}>
                    <Text style={s.agreementAmount}>{formatCurrency(agreement.amount, country)}</Text>
                    <Text style={s.agreementFreq}>/{freqLabel(agreement.frequency).toLowerCase()}</Text>
                  </View>
                </View>

                <View style={s.agreementMeta}>
                  <View style={s.metaItem}>
                    <Ionicons name="calendar-outline" size={13} color={SemanticColors.textTertiary} />
                    <Text style={s.metaText}>
                      {t('agreements.next', 'Next')}: {formatDayMonthAuto(new Date(agreement.nextDate))}
                    </Text>
                  </View>
                  {agreement.trade && (
                    <View style={s.metaItem}>
                      <Ionicons name="construct-outline" size={13} color={SemanticColors.textTertiary} />
                      <Text style={s.metaText}>{tradeLabel(agreement.trade)}</Text>
                    </View>
                  )}
                  <View style={s.metaItem}>
                    <Ionicons name="layers-outline" size={13} color={SemanticColors.textTertiary} />
                    <Text style={s.metaText}>{agreement.generatedJobIds.length} {t('agreements.generated', 'generated')}</Text>
                  </View>
                </View>

                {/* Status badge */}
                <View style={[s.statusBadge, { backgroundColor: getStatusColor(agreement.status) + '15' }]}>
                  <Text style={[s.statusBadgeText, { color: getStatusColor(agreement.status) }]}>
                    {statusLabel(agreement.status)}
                  </Text>
                </View>
              </Pressable>
            </FadeIn>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID.md,
    paddingTop: SafeArea.top,
    paddingBottom: GRID.md,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSub: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: GRID.md,
    gap: GRID.md,
  },

  // KPIs
  kpiRow: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    alignItems: 'center',
    gap: GRID.xs,
  },
  kpiLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },

  // Form
  formCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.md,
  },
  formTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  formLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jobPicker: {
    flexDirection: 'row',
  },
  jobChip: {
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: PAGE_BG,
    marginRight: GRID.sm,
  },
  jobChipSelected: {
    backgroundColor: Palette.hermesOrange + '15',
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
  },
  jobChipText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    maxWidth: 180,
  },
  jobChipTextSelected: {
    color: Palette.hermesOrange,
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID.sm,
  },
  freqChip: {
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: PAGE_BG,
  },
  freqChipSelected: {
    backgroundColor: Palette.hermesOrange + '15',
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
  },
  freqChipText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  freqChipTextSelected: {
    color: Palette.hermesOrange,
  },
  dateInput: {
    backgroundColor: PAGE_BG,
    borderRadius: RADIUS.md,
    padding: GRID.md - 4,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  toggleBtn: {
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.xs + 2,
    borderRadius: RADIUS.sm,
    backgroundColor: PAGE_BG,
  },
  toggleBtnActive: {
    backgroundColor: Palette.hermesOrange + '15',
  },
  toggleBtnText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
  },
  toggleBtnTextActive: {
    color: Palette.hermesOrange,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: GRID.md - 4,
  },
  createButtonText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: '#fff',
  },

  // Agreement card
  agreementCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.md - 4,
  },
  agreementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 4,
  },
  agreementStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  agreementTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  agreementCustomer: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  agreementAmountWrap: {
    alignItems: 'flex-end',
  },
  agreementAmount: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  agreementFreq: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },

  // Meta
  agreementMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
  },
  metaText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },

  // Status badge
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: GRID.sm + 2,
    paddingVertical: GRID.xs,
    borderRadius: RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: GRID.xl + GRID.lg,
    gap: GRID.sm,
  },
  emptyTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textTertiary,
  },
  emptyDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textDisabled,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: GRID.xl,
  },
});
