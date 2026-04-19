// =============================================================================
// WORKER CERTIFICATIONS — Per-worker certificate overview
// =============================================================================
// Shows all team members with their certification status
// Site lead can verify certs before assigning workers to tasks
// =============================================================================

import { useState, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useTranslation } from 'react-i18next';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;
type CertStatus = 'valid' | 'expiring' | 'expired' | 'missing';

interface WorkerCert {
  name: string;
  type: string;
  expiryDate: string;
  status: CertStatus;
}

interface WorkerProfile {
  id: string;
  name: string;
  trade: string;
  tradeIcon: IconName;
  team: string;
  certs: WorkerCert[];
}

const SEED_WORKERS: WorkerProfile[] = [
  {
    id: 'w-1', name: 'Mohammed Al-Rashid', trade: 'Elektricien', tradeIcon: 'flash', team: 'Elektra Team A',
    certs: [
      { name: 'VCA Basis', type: 'Veiligheid', expiryDate: '2027-03-15', status: 'valid' },
      { name: 'NEN 1010', type: 'Vakbekwaam', expiryDate: '2026-11-30', status: 'valid' },
      { name: 'BHV', type: 'EHBO', expiryDate: '2026-04-10', status: 'expiring' },
    ],
  },
  {
    id: 'w-2', name: 'Pieter de Groot', trade: 'Loodgieter', tradeIcon: 'water', team: 'Loodgieter Team',
    certs: [
      { name: 'VCA Basis', type: 'Veiligheid', expiryDate: '2026-08-20', status: 'valid' },
      { name: 'Uneto-VNI', type: 'Vakbekwaam', expiryDate: '2026-12-31', status: 'valid' },
      { name: 'F-gassen (STEK)', type: 'Milieu', expiryDate: '2026-02-01', status: 'expired' },
    ],
  },
  {
    id: 'w-3', name: 'Erik Jansen', trade: 'Timmerman', tradeIcon: 'hammer', team: 'Timmerwerk',
    certs: [
      { name: 'VCA Vol', type: 'Veiligheid', expiryDate: '2027-01-15', status: 'valid' },
      { name: 'Steigerbouwer', type: 'Vakbekwaam', expiryDate: '2026-06-30', status: 'valid' },
      { name: 'BHV', type: 'EHBO', expiryDate: '2025-12-01', status: 'expired' },
    ],
  },
  {
    id: 'w-4', name: 'Lisa Bakker', trade: 'Schilder', tradeIcon: 'color-palette', team: 'Schilders',
    certs: [
      { name: 'VCA Basis', type: 'Veiligheid', expiryDate: '2026-09-15', status: 'valid' },
      { name: 'Hoogwerker', type: 'Machine', expiryDate: '2026-05-20', status: 'expiring' },
    ],
  },
  {
    id: 'w-5', name: 'Jan van Bergen', trade: 'Metselaar', tradeIcon: 'cube', team: 'Metselwerk',
    certs: [
      { name: 'VCA Basis', type: 'Veiligheid', expiryDate: '2026-07-01', status: 'valid' },
      { name: 'Steigerkeuring', type: 'Vakbekwaam', expiryDate: '2026-04-01', status: 'expiring' },
      { name: 'Heftruckcertificaat', type: 'Machine', expiryDate: '2027-02-28', status: 'valid' },
    ],
  },
  {
    id: 'w-6', name: 'Ahmed Khalil', trade: 'Elektricien', tradeIcon: 'flash', team: 'Elektra Team A',
    certs: [
      { name: 'VCA Basis', type: 'Veiligheid', expiryDate: '2026-10-10', status: 'valid' },
      { name: 'NEN 3140', type: 'Vakbekwaam', expiryDate: '2026-03-25', status: 'expiring' },
    ],
  },
];

const STATUS_CONFIG: Record<CertStatus, { labelKey: string; color: string; bg: string; icon: IconName }> = {
  valid: { labelKey: 'workerCerts.valid', color: SemanticColors.feedbackSuccess, bg: SemanticColors.feedbackSuccessBg, icon: 'checkmark-circle' },
  expiring: { labelKey: 'workerCerts.expiring', color: SemanticColors.feedbackWarning, bg: SemanticColors.feedbackWarningBg, icon: 'alert-circle' },
  expired: { labelKey: 'workerCerts.expired', color: SemanticColors.feedbackError, bg: SemanticColors.feedbackErrorBg, icon: 'close-circle' },
  missing: { labelKey: 'workerCerts.missing', color: SemanticColors.textTertiary, bg: SemanticColors.surfaceSecondary, icon: 'help-circle' },
};

type FilterType = 'all' | 'issues';

export default function WorkerCertsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const inlineTip = useInlineInsight('sitelead', 'worker-certs', 'overview');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);

  // Load from AsyncStorage, seed if empty
  useEffect(() => {
    AsyncStorage.getItem('@vasco_sl_workers').then(raw => {
      if (raw) {
        setWorkers(JSON.parse(raw));
      } else {
        setWorkers(SEED_WORKERS);
        AsyncStorage.setItem('@vasco_sl_workers', JSON.stringify(SEED_WORKERS)).catch(() => {});
      }
    }).catch(() => setWorkers(SEED_WORKERS));
  }, []);

  const filteredWorkers = useMemo(() => {
    if (filter === 'all') return workers;
    return workers.filter(w => w.certs.some(c => c.status === 'expired' || c.status === 'expiring'));
  }, [filter]);

  const totalIssues = useMemo(() =>
    workers.reduce((sum, w) => sum + w.certs.filter(c => c.status !== 'valid').length, 0),
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{t('workerCerts.title')}</Text>
          <Text style={styles.headerSubtitle}>{workers.length} {t('workerCerts.workers')} · {totalIssues} {t('workerCerts.attentionPoints')}</Text>
        </View>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>{t('workerCerts.all')} ({workers.length})</Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, filter === 'issues' && styles.filterChipActive]}
          onPress={() => setFilter('issues')}
        >
          <Text style={[styles.filterText, filter === 'issues' && styles.filterTextActive]}>{t('workerCerts.attention')} ({totalIssues})</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {inlineTip && <InlineInsight icon={inlineTip.icon as any} message={inlineTip.message} />}

        {filteredWorkers.map(worker => {
          const hasIssues = worker.certs.some(c => c.status !== 'valid');
          const expanded = expandedWorker === worker.id;

          return (
            <Pressable
              key={worker.id}
              style={[styles.workerCard, hasIssues && styles.workerCardIssue]}
              onPress={() => setExpandedWorker(expanded ? null : worker.id)}
            >
              <View style={styles.workerHeader}>
                <View style={[styles.tradeIcon, { backgroundColor: Palette.hermesOrange + '12' }]}>
                  <Ionicons name={worker.tradeIcon} size={18} color={Palette.hermesOrange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.workerTeam}>{worker.team} · {worker.trade}</Text>
                </View>
                <View style={styles.certSummary}>
                  {worker.certs.some(c => c.status === 'expired') && (
                    <Ionicons name="close-circle" size={16} color={SemanticColors.feedbackError} />
                  )}
                  {worker.certs.some(c => c.status === 'expiring') && (
                    <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackWarning} />
                  )}
                  {!hasIssues && (
                    <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
                  )}
                  <Text style={styles.certCount}>{worker.certs.length}</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={SemanticColors.textTertiary} />
              </View>

              {/* Expanded cert list */}
              {expanded && (
                <View style={styles.certList}>
                  {worker.certs.map((cert, i) => {
                    const cfg = STATUS_CONFIG[cert.status];
                    const expiryDate = new Date(cert.expiryDate);
                    const dateStr = expiryDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

                    return (
                      <View key={i} style={styles.certRow}>
                        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.certName}>{cert.name}</Text>
                          <Text style={styles.certType}>{cert.type} · {t('workerCerts.expires', 'Verloopt')} {dateStr}</Text>
                        </View>
                        <View style={[styles.certBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.certBadgeText, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Pressable>
          );
        })}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SafeArea.side, paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1.5, borderColor: SemanticColors.borderDefault,
  },
  filterChipActive: { backgroundColor: Palette.hermesOrange, borderColor: Palette.hermesOrange },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  filterTextActive: { color: Palette.white },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: 8 },
  workerCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: 14,
  },
  workerCardIssue: {
    borderLeftWidth: 3, borderLeftColor: SemanticColors.feedbackWarning,
  },
  workerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tradeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  workerName: { fontSize: 15, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  workerTeam: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  certSummary: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  certCount: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textSecondary },
  certList: { marginTop: 12, gap: 6, borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault, paddingTop: 12 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  certName: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  certType: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  certBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  certBadgeText: { fontSize: 11, fontFamily: 'Archivo_700Bold' },
});
