// =============================================================================
// RECONCILIATION CARD (R246)
// =============================================================================
// Surfaces banking matchTransactionsToInvoices results: "Vasco found 3
// payments matching your invoices — confirm to mark paid."
//
// Reads from src/integrations/banking.ts (Tink-backed reconciliation matcher).
// Renders nothing when no high-confidence matches exist or no bank connected.
// =============================================================================

import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import {
  isBankConnected,
  listTransactions,
  matchTransactionsToInvoices,
  type ReconciliationMatch,
  type ReconciliationReason,
} from '../../integrations/banking';
import { useAppState } from '../../state/AppState';

function ReconciliationCardImpl() {
  const { t } = useTranslation();
  const { invoices, markInvoicePaid } = useAppState() as any;
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<ReconciliationMatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isOn = await isBankConnected();
      if (cancelled) return;
      setConnected(isOn);
      if (!isOn) {
        setLoading(false);
        return;
      }
      const txs = await listTransactions({ sinceDays: 30 });
      const openInvoices = (invoices ?? []).filter((inv: any) => inv.status !== 'paid');
      const candidates = openInvoices.map((inv: any) => ({
        id: inv.id,
        amount: Number(inv.amount) || 0,
        customerName: inv.customer ?? inv.customerName,
        customerIban: inv.customerIban,
        sentAt: inv.sentAt ?? inv.createdAt,
      }));
      const found = matchTransactionsToInvoices(txs, candidates);
      // Only surface high-confidence (≥0.7) matches to avoid false positives.
      if (!cancelled) {
        setMatches(found.filter((m) => m.confidence >= 0.7));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoices]);

  if (!connected || (loading && matches.length === 0)) return null;
  if (loading) {
    return <View style={styles.loadingCard}><ActivityIndicator color={DK.colors.accent} /></View>;
  }
  if (matches.length === 0) return null;

  const handleConfirm = async (match: ReconciliationMatch) => {
    if (typeof markInvoicePaid === 'function') {
      await markInvoicePaid(match.invoiceId);
    }
    setMatches((prev) => prev.filter((m) => m.invoiceId !== match.invoiceId));
  };

  // Resolved at RENDER time, in the reader's language — see the note on
  // `ReconciliationReason`. The matcher does not know who will read it.
  const reasonText = (r: ReconciliationReason): string => {
    switch (r.code) {
      case 'exactAmount': return t('reconciliation.reasonExactAmount', 'exact amount match');
      case 'amountWithin': return t('reconciliation.reasonAmountWithin', 'amount within 2%');
      case 'iban': return t('reconciliation.reasonIban', 'IBAN match');
      case 'name': return t('reconciliation.reasonName', 'name match');
      case 'daysAfter': return t('reconciliation.reasonDaysAfter', { defaultValue: '{{days}}d after sent', days: r.days });
    }
  };

  return (
    <View style={styles.card}>
      <DKLabel style={styles.title}>{t('reconciliation.title', 'BANK MATCHES')}</DKLabel>
      <Text style={styles.subtitle}>
        {t('reconciliation.subtitle', {
          defaultValue: 'Vasco found {{count}} payments matching open invoices.',
          count: matches.length,
        })}
      </Text>
      {matches.map((m) => {
        // The contractor's own document number, never the storage id. Falls
        // back to the id only when a document genuinely has no reference.
        const inv = (invoices ?? []).find((i: any) => i.id === m.invoiceId);
        const ref = inv?.reference || m.invoiceId;
        return (
        <View key={`${m.transactionId}-${m.invoiceId}`} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.invoiceId}>{t('reconciliation.invoiceLabel', { defaultValue: 'Invoice {{id}}', id: ref })}</Text>
            <Text style={styles.reasons}>{m.reasons.map(reasonText).join(' · ')}</Text>
            <Text style={styles.confidence}>
              {t('reconciliation.confidence', { defaultValue: 'Confidence: {{percent}}%', percent: Math.round(m.confidence * 100) })}
            </Text>
          </View>
          <Pressable
            style={styles.confirmBtn}
            onPress={() => handleConfirm(m)}
            accessibilityRole="button"
            accessibilityLabel={t('reconciliation.markPaidA11y', { defaultValue: 'Mark invoice {{id}} as paid', id: ref })}
          >
            <Ionicons name="checkmark" size={18} color="#000" />
            <Text style={styles.confirmText}>{t('reconciliation.confirmPaid', 'PAID')}</Text>
          </Pressable>
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.lg,
    marginVertical: GRID.md,
    alignItems: 'center',
  },
  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.lg,
    marginVertical: GRID.md,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.accent,
  },
  title: { color: DK.colors.accent },
  subtitle: { color: DK.colors.text, fontFamily: TYPE.bodyFamily, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.sm,
    borderTopWidth: 1,
    borderTopColor: DK.colors.border,
    gap: GRID.md,
  },
  invoiceId: { color: DK.colors.text, fontFamily: TYPE.titleFamily, fontSize: 14 },
  reasons: { color: DK.colors.textMuted, fontFamily: TYPE.captionFamily, fontSize: 12, marginTop: 2 },
  confidence: { color: DK.colors.textMuted, fontFamily: TYPE.captionFamily, fontSize: 12, marginTop: 2 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DK.colors.accent,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderRadius: RADIUS.full,
    gap: GRID.xs,
  },
  confirmText: { color: '#000', fontFamily: TYPE.titleFamily, fontSize: 12, letterSpacing: 1.2 },
});

export const ReconciliationCard = memo(ReconciliationCardImpl);
