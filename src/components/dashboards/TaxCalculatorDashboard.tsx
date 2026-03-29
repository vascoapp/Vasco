import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import {
  formatCurrency,
  formatPercent,
  calculateTransferTax,
  DE_RETT_RATES,
} from '../../modules/countryModules';
import type { Country } from '../../types/buildos';

const CFO_COLOR = '#2563EB'; // Blue for CFO (per theme)

const BUNDESLAND_LIST = Object.keys(DE_RETT_RATES);

export function TaxCalculatorDashboard() {
  const [taxAmount, setTaxAmount] = useState('');
  const [taxCountry, setTaxCountry] = useState<Country>('UK');
  const [taxBundesland, setTaxBundesland] = useState('Hessen');
  const [isResidential, setIsResidential] = useState(false);

  const taxResult = useMemo(() => {
    const amount = parseFloat(taxAmount);
    if (isNaN(amount) || amount <= 0) return null;
    return calculateTransferTax(taxCountry, amount, {
      bundesland: taxBundesland,
      isResidential,
    });
  }, [taxAmount, taxCountry, taxBundesland, isResidential]);

  const currency = taxCountry === 'UK' ? 'GBP' : 'EUR';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Transfer Tax Calculator</Text>
        <Text style={styles.infoText}>
          Calculate stamp duty (UK), overdrachtsbelasting (NL), or Grunderwerbsteuer (DE)
          for property transactions.
        </Text>
      </View>

      {/* Country Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Country</Text>
        <View style={styles.countrySelector}>
          {(['UK', 'NL', 'DE'] as Country[]).map((country) => (
            <Pressable
              key={country}
              style={[
                styles.countryPill,
                taxCountry === country && styles.countryPillActive,
              ]}
              onPress={() => setTaxCountry(country)}
            >
              <Text style={[
                styles.countryPillText,
                taxCountry === country && styles.countryPillTextActive,
              ]}>
                {country === 'UK' ? 'UK SDLT' : country === 'NL' ? 'NL RETT' : 'DE RETT'}
              </Text>
              <Text style={styles.countryPillSubtext}>
                {country === 'UK' ? 'Stamp Duty' : country === 'NL' ? 'Overdracht' : 'Grunderwerbst.'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Bundesland selector for Germany */}
      {taxCountry === 'DE' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bundesland</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.bundeslandRow}>
              {BUNDESLAND_LIST.map((state) => (
                <Pressable
                  key={state}
                  style={[
                    styles.bundeslandPill,
                    taxBundesland === state && styles.bundeslandPillActive,
                  ]}
                  onPress={() => setTaxBundesland(state)}
                >
                  <Text style={[
                    styles.bundeslandText,
                    taxBundesland === state && styles.bundeslandTextActive,
                  ]}>
                    {state}
                  </Text>
                  <Text style={styles.bundeslandRate}>
                    {(DE_RETT_RATES[state] * 100).toFixed(1)}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Property Type Toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property Type</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.togglePill, !isResidential && styles.togglePillActive]}
            onPress={() => setIsResidential(false)}
          >
            <Text style={[styles.toggleText, !isResidential && styles.toggleTextActive]}>
              Commercial
            </Text>
          </Pressable>
          <Pressable
            style={[styles.togglePill, isResidential && styles.togglePillActive]}
            onPress={() => setIsResidential(true)}
          >
            <Text style={[styles.toggleText, isResidential && styles.toggleTextActive]}>
              Residential
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Amount Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Purchase Price</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currencyLabel}>{currency}</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter amount"
            placeholderTextColor={SemanticColors.textSecondary}
            value={taxAmount}
            onChangeText={setTaxAmount}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Result */}
      {taxResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultLabel}>Tax Payable</Text>
            <Text style={styles.resultValue}>
              {formatCurrency(taxResult.totalTax, currency)}
            </Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultDetails}>
            <View style={styles.resultRow}>
              <Text style={styles.resultDetailLabel}>Effective Rate</Text>
              <Text style={styles.resultDetailValue}>
                {formatPercent(taxResult.effectiveRate)}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultDetailLabel}>Purchase Price</Text>
              <Text style={styles.resultDetailValue}>
                {formatCurrency(parseFloat(taxAmount), currency)}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultDetailLabel}>Total with Tax</Text>
              <Text style={[styles.resultDetailValue, { color: CFO_COLOR }]}>
                {formatCurrency(parseFloat(taxAmount) + taxResult.totalTax, currency)}
              </Text>
            </View>
          </View>

          {/* Breakdown if available */}
          {taxResult.details && 'breakdown' in taxResult.details && taxResult.details.breakdown.length > 0 && (
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle}>Tax Bands</Text>
              {taxResult.details.breakdown.map((band, index) => (
                <View key={index} style={styles.breakdownRow}>
                  <Text style={styles.breakdownRange}>
                    {band.band}
                  </Text>
                  <Text style={styles.breakdownRate}>{formatPercent(band.rate)}</Text>
                  <Text style={styles.breakdownTax}>{formatCurrency(band.tax, currency)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Tax Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoBoxTitle}>
          {taxCountry === 'UK' ? 'UK Stamp Duty Land Tax' :
           taxCountry === 'NL' ? 'Dutch Transfer Tax' :
           'German Real Estate Transfer Tax'}
        </Text>
        <Text style={styles.infoBoxText}>
          {taxCountry === 'UK'
            ? 'SDLT is calculated on a progressive basis with different rates for residential and commercial property.'
            : taxCountry === 'NL'
            ? 'Overdrachtsbelasting is a flat rate tax on property transfers in the Netherlands.'
            : 'Grunderwerbsteuer rates vary by Bundesland, ranging from 3.5% to 6.5%.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.sm,
    gap: Spacing.md,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: CFO_COLOR + '15',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: CFO_COLOR,
  },
  infoTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    lineHeight: 18,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countrySelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  countryPill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  countryPillActive: {
    backgroundColor: CFO_COLOR + '20',
    borderColor: CFO_COLOR,
  },
  countryPillText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
  },
  countryPillTextActive: {
    color: CFO_COLOR,
  },
  countryPillSubtext: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    marginTop: 2,
  },
  bundeslandRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  bundeslandPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
  },
  bundeslandPillActive: {
    borderColor: CFO_COLOR,
    backgroundColor: CFO_COLOR + '15',
  },
  bundeslandText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },
  bundeslandTextActive: {
    color: CFO_COLOR,
  },
  bundeslandRate: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  togglePillActive: {
    backgroundColor: CFO_COLOR + '20',
    borderColor: CFO_COLOR,
  },
  toggleText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: CFO_COLOR,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  currencyLabel: {
    paddingHorizontal: Spacing.md,
    color: CFO_COLOR,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    borderRightWidth: 1,
    borderRightColor: SemanticColors.borderDefault,
    paddingVertical: Spacing.sm,
  },
  input: {
    flex: 1,
    padding: Spacing.sm,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
  },
  resultCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: CFO_COLOR + '30',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '500',
  },
  resultValue: {
    color: CFO_COLOR,
    fontSize: TYPE.displaySize,
    fontWeight: '700',
  },
  resultDivider: {
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: Spacing.sm,
  },
  resultDetails: {
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultDetailLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  resultDetailValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },
  breakdownSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  breakdownTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  breakdownRange: {
    flex: 2,
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  breakdownRate: {
    flex: 1,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.tinySize,
    textAlign: 'center',
  },
  breakdownTax: {
    flex: 1,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.tinySize,
    fontWeight: '500',
    textAlign: 'right',
  },
  infoBox: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoBoxTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoBoxText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    lineHeight: 18,
  },
});
