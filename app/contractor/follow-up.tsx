import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomerFollowUp } from '../../src/components/contractor';
import { useAppState } from '../../src/state/AppState';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default function FollowUpScreen() {
  const { quotes, customers } = useAppState();

  const staleQuotes = useMemo(() => {
    const now = Date.now();
    return quotes
      .filter((q) => {
        if (q.status !== 'sent') return false;
        const sentTime = new Date(q.lastUpdated).getTime();
        return now - sentTime >= THREE_DAYS_MS;
      })
      .map((q) => {
        const customer = customers.find((c) => c.id === q.customer);
        const sentTime = new Date(q.lastUpdated).getTime();
        const days = Math.floor((Date.now() - sentTime) / (24 * 60 * 60 * 1000));
        return { id: q.id, customer: customer?.name ?? q.customer, days, reference: q.id };
      })
      .sort((a, b) => b.days - a.days);
  }, [quotes, customers]);

  return (
    <View style={{ flex: 1 }}>
      {staleQuotes.length > 0 && (
        <View style={styles.staleSection}>
          <View style={styles.staleHeader}>
            <Ionicons name="document-text-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.staleTitle}>Openstaande offertes</Text>
          </View>
          {staleQuotes.map((sq) => (
            <View key={sq.id} style={styles.staleRow}>
              <View style={styles.staleIndicator} />
              <View style={{ flex: 1 }}>
                <Text style={styles.staleCustomer}>
                  Offerte voor {sq.customer}
                </Text>
                <Text style={styles.staleDays}>
                  {sq.reference} — {sq.days} dagen geleden verstuurd
                </Text>
              </View>
              <Ionicons name="time-outline" size={16} color={SemanticColors.textTertiary} />
            </View>
          ))}
        </View>
      )}
      <CustomerFollowUp />
    </View>
  );
}

const styles = StyleSheet.create({
  staleSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: 16,
    padding: Spacing.md,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
  },
  staleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  staleTitle: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.2,
  },
  staleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.borderDefault,
  },
  staleIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  staleCustomer: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
  },
  staleDays: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
});
