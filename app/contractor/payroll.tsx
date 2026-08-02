// =============================================================================
// PAYROLL — Verloning overzicht
// =============================================================================
// Team hours + rates summary with export capability
// =============================================================================

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { EmptyState } from '../../src/components/shared/EmptyState';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useTeamMembers, useTimeTracking } from '../../src/services/teamManagementService';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';

type PeriodType = 'week' | 'maand';

interface PayrollLine {
  memberId: string;
  name: string;
  role: string;
  hourlyRate: number;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
}

export default function PayrollScreen() {
  const { t } = useTranslation();
  // Dutch 'u' (uren) was hardcoded here — an English contractor read "7.5u".
  // common.durationH is the localised unit: {{h}}h · {{h}}u · {{h}} Std.
  const hoursLabel = (h: number) =>
    t('common.durationH', { defaultValue: '{{h}}h', h: h.toFixed(1) });
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodType>('week');
  const { members } = useTeamMembers();
  const { entries } = useTimeTracking();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;

  const roleNames: Record<string, string> = {
    owner: 'Eigenaar',
    foreman: 'Voorman',
    technician: 'Monteur',
    apprentice: 'Leerling',
    admin: 'Administratie',
  };

  const payrollData = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const lines: PayrollLine[] = members.map(member => {
      const memberEntries = entries.filter(
        e => e.memberId === member.id && e.date >= startDate && e.status !== 'disputed',
      );

      const totalHours = memberEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
      const regularHours = Math.min(totalHours, period === 'week' ? 40 : 160);
      const overtimeHours = Math.max(totalHours - regularHours, 0);
      const overtimeRate = member.hourlyRate * 1.5;

      return {
        memberId: member.id,
        name: `${member.firstName} ${member.lastName}`,
        role: roleNames[member.role] ?? member.role,
        hourlyRate: member.hourlyRate,
        regularHours,
        overtimeHours,
        regularPay: regularHours * member.hourlyRate,
        overtimePay: overtimeHours * overtimeRate,
        totalPay: regularHours * member.hourlyRate + overtimeHours * overtimeRate,
      };
    });

    const totalRegular = lines.reduce((sum, l) => sum + l.regularPay, 0);
    const totalOvertime = lines.reduce((sum, l) => sum + l.overtimePay, 0);
    const grandTotal = lines.reduce((sum, l) => sum + l.totalPay, 0);
    const totalHours = lines.reduce((sum, l) => sum + l.regularHours + l.overtimeHours, 0);

    return { lines, totalRegular, totalOvertime, grandTotal, totalHours };
  }, [members, entries, period]);

  const fmt = (n: number) => formatCurrency(n, country);

  const handleExport = async () => {
    const header = 'Naam;Functie;Uurtarief;Regulier (u);Overwerk (u);Regulier (€);Overwerk (€);Totaal (€)';
    const rows = payrollData.lines.map(l =>
      `${l.name};${l.role};${l.hourlyRate};${l.regularHours.toFixed(1)};${l.overtimeHours.toFixed(1)};${l.regularPay.toFixed(2)};${l.overtimePay.toFixed(2)};${l.totalPay.toFixed(2)}`,
    );
    const csv = [header, ...rows].join('\n');

    try {
      await Share.share({
        message: csv,
        title: `Verloning ${period === 'week' ? 'week' : 'maand'} export`,
      });
    } catch {
      Alert.alert('Export mislukt', 'Probeer het opnieuw.');
    }
  };

  const periodLabel = period === 'week' ? 'Deze week' : 'Deze maand';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Verloning</Text>
          <Text style={styles.headerSubtitle}>{periodLabel} · {members.length} medewerkers</Text>
        </View>
        <Pressable style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="share-outline" size={20} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      {/* Period Tabs */}
      <View style={styles.tabBar}>
        {(['week', 'maand'] as PeriodType[]).map(p => (
          <Pressable key={p} style={[styles.tab, period === p && styles.tabActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
              {p === 'week' ? 'Week' : 'Maand'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{hoursLabel(payrollData.totalHours)}</Text>
            <Text style={styles.summaryLabel}>Totaal uren</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{fmt(payrollData.totalRegular)}</Text>
            <Text style={styles.summaryLabel}>Regulier</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, payrollData.totalOvertime > 0 && { color: Palette.hermesOrange }]}>
              {fmt(payrollData.totalOvertime)}
            </Text>
            <Text style={styles.summaryLabel}>Overwerk</Text>
          </View>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Totaal verloning</Text>
          <Text style={styles.grandTotalValue}>{fmt(payrollData.grandTotal)}</Text>
        </View>
      </View>

      {/* Per-member breakdown */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {payrollData.lines.length === 0 && (
          <EmptyState
            icon="people-outline"
            title="Nog geen teamleden"
            description="Voeg teamleden toe om hun uren en verloning hier te zien."
          />
        )}
        {payrollData.lines.map(line => (
          <View key={line.memberId} style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{line.name.split(' ').map(n => n[0]).join('')}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{line.name}</Text>
                <Text style={styles.memberRole}>{line.role} · {fmt(line.hourlyRate)}/u</Text>
              </View>
              <Text style={styles.memberTotal}>{fmt(line.totalPay)}</Text>
            </View>
            <View style={styles.memberDetails}>
              <View style={styles.detailCol}>
                <Text style={styles.detailValue}>{hoursLabel(line.regularHours)}</Text>
                <Text style={styles.detailLabel}>Regulier</Text>
              </View>
              <View style={styles.detailCol}>
                <Text style={[styles.detailValue, line.overtimeHours > 0 && { color: Palette.hermesOrange }]}>
                  {line.overtimeHours.toFixed(1)}u
                </Text>
                <Text style={styles.detailLabel}>Overwerk</Text>
              </View>
              <View style={styles.detailCol}>
                <Text style={styles.detailValue}>{fmt(line.regularPay)}</Text>
                <Text style={styles.detailLabel}>Reg. loon</Text>
              </View>
              <View style={styles.detailCol}>
                <Text style={styles.detailValue}>{fmt(line.overtimePay)}</Text>
                <Text style={styles.detailLabel}>OW loon</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Export banner */}
        <Pressable style={styles.exportBanner} onPress={handleExport}>
          <Ionicons name="download-outline" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.exportBannerTitle}>Exporteren</Text>
            <Text style={styles.exportBannerSub}>Deel als CSV voor Moneybird of boekhouder</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>

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
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  exportButton: { width: 40, height: 40, borderRadius: 16, backgroundColor: Palette.hermesOrange + '0A', alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center' },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textTertiary },
  tabTextActive: { color: '#fff' },
  summaryCard: {
    marginHorizontal: SafeArea.side, backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md,
  },
  summaryRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  summaryLabel: { fontSize: 10, color: SemanticColors.textSecondary, marginTop: 2, letterSpacing: 0.3 },
  summaryDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginHorizontal: Spacing.xs },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault, paddingTop: Spacing.sm },
  grandTotalLabel: { fontSize: 14, fontFamily: 'Archivo_700Bold', color: SemanticColors.textSecondary },
  grandTotalValue: { fontSize: 18, fontFamily: 'Archivo_900Black', color: SemanticColors.textPrimary },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  memberCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm, marginBottom: 6,
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.hermesOrange + '15', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  memberRole: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 1 },
  memberTotal: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  memberDetails: { flexDirection: 'row', marginTop: Spacing.sm, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  detailCol: { flex: 1, alignItems: 'center' },
  detailValue: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  detailLabel: { fontSize: 10, color: SemanticColors.textTertiary, marginTop: 1 },
  exportBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Palette.hermesOrange, borderRadius: 16, padding: Spacing.md, paddingVertical: 16, marginTop: Spacing.md,
  },
  exportBannerTitle: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: '#fff' },
  exportBannerSub: { fontSize: 12, color: '#ffffffCC', marginTop: 2 },
});
