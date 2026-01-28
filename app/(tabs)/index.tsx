import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionTile } from '../../src/components/ActionTile';
import { KpiChip } from '../../src/components/KpiChip';
import { buildAttentionQueue } from '../../src/logic/attentionEngine';
import { useAppState } from '../../src/state/AppState';
import { Screen } from '../../src/components/Screen';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

export default function DashboardScreen() {
  const router = useRouter();
  const {
    businessProfile,
    invoices,
    quotes,
    priceRisks,
    moneybirdConnected,
    mollieConnected,
  } = useAppState();
  const savingsTotal = priceRisks.reduce((sum, risk) => sum + risk.estimatedSavings, 0);
  const savingsFormatted = `€${savingsTotal.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.sectionLabel}>Today</Text>
            <Text style={Typography.title}>Next best actions</Text>
          </View>
          <View style={styles.helperBadge}>
            <Text style={styles.helperBadgeText}>Vasco Assist</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <KpiChip label="Overdue" value={`${invoices.filter((i) => i.status === 'overdue').length}`} />
          <KpiChip label="Draft quotes" value={`${quotes.filter((q) => q.status === 'draft').length}`} />
          <KpiChip
            label="At risk"
            value={`${buildAttentionQueue({
              businessProfile,
              quotes,
              invoices,
              priceRisks,
              mollieConnected,
            }).filter((a) => a.tone === 'danger').length}`}
          />
          <KpiChip label="Saved" value={savingsFormatted} />
        </View>

        <View style={styles.helperCard}>
          <Text style={Typography.subtitle}>We will guide you step by step</Text>
          <Text style={[Typography.muted, styles.helperCopy]}>
            One clear action at a time to protect profit and save admin hours.
          </Text>
        </View>

        <View style={styles.moneyBar}>
          <Text style={styles.moneyLabel}>This week saved</Text>
          <Text style={styles.moneyValue}>{savingsFormatted}</Text>
          <Text style={styles.moneyHint}>
            From better pricing & faster follow‑ups
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.syncBar, pressed && styles.pressed]}
          onPress={() => router.push('/(modals)/moneybird')}
        >
          <Text style={styles.syncLabel}>Moneybird</Text>
          <Text style={styles.syncValue}>
            {moneybirdConnected ? 'Synced' : 'Not connected'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.syncBar, pressed && styles.pressed]}
          onPress={() => router.push('/(modals)/mollie')}
        >
          <Text style={styles.syncLabel}>Mollie (iDEAL)</Text>
          <Text style={styles.syncValue}>
            {mollieConnected ? 'Connected' : 'Not connected'}
          </Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Action queue</Text>
          <Text style={Typography.subtitle}>Save money now</Text>
        </View>

        <View style={styles.actionList}>
          {buildAttentionQueue({
            businessProfile,
            quotes,
            invoices,
            priceRisks,
            mollieConnected,
          }).map((item) => (
            <ActionTile
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              why={item.why}
              impact={item.impact}
              tag={item.tag}
              onPress={() => router.push(item.route)}
            />
          ))}
        </View>

        <View style={styles.ingestion}>
          <Text style={Typography.subtitle}>Teach Vasco your prices</Text>
          <Text style={[Typography.muted, styles.ingestionCopy]}>
            Share past quotes to get smarter pricing suggestions.
          </Text>
          <Link href="/(modals)/ingestion" asChild>
            <Pressable style={styles.ingestionLink}>
              <Text style={styles.ingestionLinkText}>Add previous work</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionLabel: {
    color: Colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
    fontFamily: 'Inter_500Medium',
  },
  helperBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helperBadgeText: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  sectionHeader: {
    gap: 2,
  },
  actionList: {
    gap: Spacing.sm,
  },
  helperCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  helperCopy: {
    lineHeight: 18,
  },
  moneyBar: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  moneyLabel: {
    color: Colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'Inter_500Medium',
  },
  moneyValue: {
    color: Colors.text,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  moneyHint: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  syncBar: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncLabel: {
    color: Colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'Inter_500Medium',
  },
  syncValue: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  pressed: {
    opacity: 0.9,
  },
  ingestion: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  ingestionCopy: {
    lineHeight: 19,
  },
  ingestionLink: {
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
  },
  ingestionLinkText: {
    color: Colors.accent,
    fontWeight: '700',
  },
});
