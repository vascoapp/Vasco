// Hub: Kosten Tools — Benchmarking, leveranciers, onderhandelingen & TCO
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useSupplierNegotiation } from '../../src/services/supplierNegotiationService';
import { useTCOSummary } from '../../src/services/tcoCalculatorService';

type IconName = keyof typeof Ionicons.glyphMap;

const CFO_COLOR = SemanticColors.roleCFO;

export default function KostenToolsScreen() {
  const router = useRouter();
  const negotiation = useSupplierNegotiation();
  const tco = useTCOSummary();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Benchmarking */}
      <View style={[styles.sectionHeader, { marginTop: 0 }]}>
        <Text style={styles.sectionTitle}>Benchmarking</Text>
      </View>
      <Pressable style={styles.card} onPress={() => router.push('/contractor/market-prices' as any)}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: CFO_COLOR + '15' }]}>
            <Ionicons name="bar-chart" size={18} color={CFO_COLOR} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>Kostenbenchmarking</Text>
            <Text style={styles.itemSubtitle}>Kostenvergelijking tussen projecten</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
        </View>
      </Pressable>

      {/* Leveranciers */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leveranciers</Text>
      </View>
      <Pressable style={styles.card} onPress={() => router.push('/contractor/purchase-orders' as any)}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
            <Ionicons name="cart" size={18} color={SemanticColors.feedbackSuccess} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>Leverancierskostenbeheer</Text>
            <Text style={styles.itemSubtitle}>Inkoop, bestellingen & prijsvergelijking</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
        </View>
      </Pressable>

      {/* Onderhandelingskansen */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Onderhandelingskansen</Text>
        <Text style={styles.sectionSubtitle}>{negotiation.quickWins.length} kansen</Text>
      </View>
      {negotiation.quickWins.map((win, index) => (
        <Pressable
          key={win.supplier}
          style={styles.card}
          onPress={() => Alert.alert(
            `${win.supplier} \u2014 Actie`,
            `${win.action}\n\nGeschatte besparing: \u20AC${win.saving}/jaar`,
            [
              { text: 'Later' },
              {
                text: 'Contact opnemen',
                onPress: () => Alert.alert(
                  'Herinnering ingesteld',
                  `We herinneren je om contact op te nemen met ${win.supplier}.`,
                ),
              },
            ],
          )}
        >
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Ionicons name="business" size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{win.supplier}</Text>
              <Text style={styles.itemSubtitle}>{win.action}</Text>
            </View>
            <Text style={styles.savingText}>{'\u20AC'}{win.saving}/jr</Text>
          </View>
        </Pressable>
      ))}

      {/* TCO Vergelijking */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>TCO Vergelijking</Text>
        <Text style={styles.sectionSubtitle}>{tco.comparisons.length} categorieën</Text>
      </View>
      {tco.comparisons.map((comp) => (
        <Pressable
          key={comp.category}
          style={styles.card}
          onPress={() => Alert.alert(
            `TCO: ${comp.category}`,
            `${comp.customerPitch}\n\nAanbeveling: ${comp.recommendation.name} (${comp.recommendation.brand})\nTCO/jaar: \u20AC${comp.recommendation.tcoPerYear} vs \u20AC${comp.materials[0].tcoPerYear} (budget)\n\nBesparing: \u20AC${comp.savingsVsBudget}/jaar`,
          )}
        >
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
              <Ionicons name="calculator" size={18} color={SemanticColors.feedbackInfo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{comp.category}</Text>
              <Text style={styles.itemSubtitle}>
                {comp.recommendation.brand} {comp.recommendation.name} — beste TCO
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.savingText}>-{'\u20AC'}{comp.savingsVsBudget}/jr</Text>
              <Text style={styles.savingMeta}>vs budget</Text>
            </View>
          </View>
        </Pressable>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  content: {
    paddingHorizontal: SafeArea.side,
    paddingTop: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  itemSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  savingText: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  savingMeta: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
});
