// =============================================================================
// SCENARIO COMPARISON CARD - Abacum-style 3-column scenario analysis
// =============================================================================

import { View, Text, StyleSheet } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
export interface ScenarioData {
  name: string;
  irr: string;
  profit: string;
  equityMultiple: string;
  isBase?: boolean;
}

interface ScenarioComparisonCardProps {
  scenarios: ScenarioData[];
  accentColor?: string;
}

export function ScenarioComparisonCard({ scenarios, accentColor = '#2563EB' }: ScenarioComparisonCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.columnsRow}>
        {scenarios.map((scenario, idx) => (
          <View
            key={idx}
            style={[
              styles.column,
              scenario.isBase && { borderColor: accentColor, borderWidth: 1.5 },
            ]}
          >
            {/* Scenario name */}
            <Text
              style={[
                styles.scenarioName,
                scenario.isBase && { color: accentColor, fontFamily: TYPE.sectionFamily },
              ]}
            >
              {scenario.name}
            </Text>

            {/* Metrics */}
            <View style={styles.metricsStack}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>IRR</Text>
                <Text style={[styles.metricValue, scenario.isBase && { color: accentColor }]}>
                  {scenario.irr}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Winst</Text>
                <Text style={styles.metricValue}>{scenario.profit}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Eq. Multiple</Text>
                <Text style={styles.metricValue}>{scenario.equityMultiple}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  columnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    gap: 10,
    alignItems: 'center',
  },
  scenarioName: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  metricsStack: {
    gap: 8,
    width: '100%',
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: TYPE.tinySize - 2,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
