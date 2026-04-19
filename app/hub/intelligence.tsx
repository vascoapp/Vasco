// Hub: Data Intelligence — Contractor ingestion overview
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useIngestionStats } from '../../src/services/ingestionIntelligenceService';

type IconName = keyof typeof Ionicons.glyphMap;

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'zojuist';
  if (mins < 60) return `${mins}m geleden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u geleden`;
  const days = Math.floor(hrs / 24);
  return `${days}d geleden`;
}

const SOURCE_LABELS: Record<string, string> = {
  pdf: 'PDF Import',
  paste: 'Tekst Plak',
  excel: 'Excel Import',
  csv: 'CSV Import',
  camera: 'Camera Scan',
};

export default function IntelligenceHubScreen() {
  const router = useRouter();
  const { stats, loading, refresh } = useIngestionStats();

  const SYSTEM_STATS: {
    label: string;
    value: string | number;
    icon: IconName;
    color: string;
    bgColor: string;
  }[] = [
    {
      label: 'Documenten verwerkt',
      value: stats.documentsProcessed,
      icon: 'document-text',
      color: '#3B82F6',
      bgColor: '#3B82F610',
    },
    {
      label: 'Training examples',
      value: stats.trainingExamplesCount,
      icon: 'school',
      color: '#8B5CF6',
      bgColor: '#8B5CF610',
    },
    {
      label: 'Calibratie-entries',
      value: stats.calibrationAccuracy > 0
        ? `${stats.calibrationAccuracy}%`
        : '—',
      icon: 'flask',
      color: Palette.hermesOrange,
      bgColor: Palette.hermesOrange + '10',
    },
    {
      label: 'Nauwkeurigheid',
      value: stats.calibrationAccuracy > 0
        ? `${stats.calibrationAccuracy}%`
        : '—',
      icon: 'checkmark-circle',
      color: '#16A34A',
      bgColor: '#16A34A10',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Data Intelligence</Text>
          <Text style={styles.headerSubtitle}>Jouw ingestion-overzicht</Text>
        </View>
        {loading && <ActivityIndicator size="small" color={Palette.hermesOrange} />}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero KPIs */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroKPI}>
              <Text style={styles.heroValue}>
                {stats.materialsCount.toLocaleString(undefined)}
              </Text>
              <Text style={styles.heroLabel}>Materialen</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroKPI}>
              <Text style={styles.heroValue}>
                {stats.priceObservationsCount.toLocaleString(undefined)}
              </Text>
              <Text style={styles.heroLabel}>Prijsobservaties</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroKPI}>
              <Text style={styles.heroValue}>
                {stats.suppliersCount.toLocaleString(undefined)}
              </Text>
              <Text style={styles.heroLabel}>Leveranciers</Text>
            </View>
          </View>
          <View style={styles.heroTrendRow}>
            <Ionicons name="analytics" size={16} color={Palette.hermesOrange} />
            <Text style={styles.heroTrendText}>
              {stats.documentsProcessed} documenten verwerkt
              {stats.calibrationAccuracy > 0 ? ` · ${stats.calibrationAccuracy}% nauwkeurigheid` : ''}
            </Text>
          </View>
        </View>

        {/* System Stats */}
        <Text style={styles.sectionTitle}>SYSTEEM STATISTIEKEN</Text>
        <View style={styles.statsGrid}>
          {SYSTEM_STATS.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: stat.bgColor }]}>
                <Ionicons name={stat.icon} size={18} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Recent Processing */}
        <Text style={styles.sectionTitle}>RECENTE VERWERKING</Text>
        {stats.recentEvents.length > 0 ? (
          <View style={styles.timelineCard}>
            {stats.recentEvents.map((evt, idx) => (
              <View
                key={evt.id}
                style={[
                  styles.timelineItem,
                  idx < stats.recentEvents.length - 1 && styles.timelineItemBorder,
                ]}
              >
                <View style={styles.timelineDot}>
                  <View style={styles.timelineDotInner} />
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineType}>
                      {SOURCE_LABELS[evt.sourceType] ?? evt.sourceType}
                    </Text>
                    <Text style={styles.timelineTime}>{timeAgo(evt.createdAt)}</Text>
                  </View>
                  {evt.supplier ? (
                    <Text style={styles.timelineSupplier}>{evt.supplier}</Text>
                  ) : null}
                  <Text style={styles.timelineDetail}>
                    {evt.lineItemCount} regelitems
                    {evt.total > 0
                      ? ` · \u20AC${evt.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-upload-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>Nog geen verwerkingen</Text>
            <Text style={styles.emptySubtext}>Importeer een factuur of catalogus om te beginnen</Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <Pressable
            style={styles.quickActionButton}
            onPress={() => router.push('/hub/materials')}
          >
            <Ionicons name="cube" size={20} color={Palette.hermesOrange} />
            <Text style={styles.quickActionText}>Materialen</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </Pressable>
          <Pressable
            style={styles.quickActionButton}
            onPress={() => router.push('/hub/suppliers')}
          >
            <Ionicons name="business" size={20} color={Palette.hermesOrange} />
            <Text style={styles.quickActionText}>Leveranciers</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </Pressable>
        </View>
        <View style={styles.quickActionsRow}>
          <Pressable
            style={styles.quickActionButton}
            onPress={() => router.push('/(modals)/ingestion')}
          >
            <Ionicons name="scan" size={20} color={Palette.hermesOrange} />
            <Text style={styles.quickActionText}>Importeren</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
    backgroundColor: '#FAFAF8',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#14181F",
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: "#FFFFFF", textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Hero KPIs
  heroCard: {
    backgroundColor: "#14181F",
    borderRadius: 16,
    padding: Spacing.md,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroKPI: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  heroValue: {
    fontSize: 20,
    fontWeight: '800',
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E8E4DF',
  },
  heroTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange + '0A',
    borderRadius: 8,
    padding: 8,
  },
  heroTrendText: {
    fontSize: 12,
    color: Palette.hermesOrange,
    fontWeight: '600',
  },

  // Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.hermesOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.xs,
  },

  // System Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: "#14181F",
    borderRadius: 14,
    padding: Spacing.md,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
  },

  // Timeline
  timelineCard: {
    backgroundColor: "#14181F",
    borderRadius: 16,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  timelineItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.hermesOrange,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineType: {
    fontSize: 14,
    fontWeight: '600',
    color: "#FFFFFF",
  },
  timelineTime: {
    fontSize: 11,
    color: '#999',
  },
  timelineSupplier: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  timelineDetail: {
    fontSize: 12,
    color: '#999',
  },

  // Empty state
  emptyCard: {
    backgroundColor: "#14181F",
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: "#14181F",
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: "#FFFFFF",
  },
});
