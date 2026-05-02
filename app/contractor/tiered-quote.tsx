import { useRef, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TieredQuoteBuilder } from '../../src/components/contractor';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';

export default function TieredQuoteScreen() {
  const router = useRouter();
  const { addQuote, customers } = useAppState();
  const { t } = useTranslation();
  const sendingRef = useRef(false);

  // R300: prefill customer when reached via R286 executor's draft_quote route
  // (e.g. EVE analyst, customer-question handoff). Looks up by customerId
  // param so the builder opens scoped to the right customer.
  const params = useLocalSearchParams<{ customerId?: string; jobId?: string }>();
  const prefillCustomer = useMemo(() => {
    if (!params.customerId) return undefined;
    return customers.find((c: any) => c.id === params.customerId) as any;
  }, [params.customerId, customers]);

  return (
    <TieredQuoteBuilder
      customer={prefillCustomer}
      onSend={async (quote) => {
        if (sendingRef.current) return;
        sendingRef.current = true;

        const tiers = (quote.tiers ?? []).filter((ti: any) => ti && Array.isArray(ti.lineItems) && ti.lineItems.length > 0);
        if (tiers.length === 0) {
          Alert.alert(t('tieredQuote.error'), t('tieredQuote.noItems'));
          sendingRef.current = false;
          return;
        }

        const sendTier = async (tier: any) => {
          const lineItems = (tier.lineItems ?? []).map((item: any) => ({
            id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            description: item.description || item.name || 'Item',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || item.price || 0,
          }));
          if (lineItems.length === 0) {
            Alert.alert(t('tieredQuote.error'), t('tieredQuote.noItems'));
            return;
          }
          const tierTotal = lineItems.reduce((sum: number, li: any) => sum + li.unitPrice * li.quantity, 0);
          if (tierTotal <= 0) {
            Alert.alert(t('tieredQuote.error'), t('tieredQuote.zeroAmount', 'Quote total must be greater than zero.'));
            return;
          }
          try {
            const quoteId = await addQuote(
              t('tieredQuote.customer'),
              tier.name || t('tieredQuote.quoteLabel'),
              lineItems,
            );
            hapticSuccess();
            Alert.alert(t('tieredQuote.quoteCreated'), t('tieredQuote.quoteSaved', { id: quoteId }), [
              { text: t('tieredQuote.viewQuote'), onPress: () => router.replace(`/quotes/${quoteId}` as any) },
              { text: t('common.close'), onPress: () => router.back() },
            ]);
          } catch (err) {
            Alert.alert(t('tieredQuote.error'), t('tieredQuote.couldNotSave'));
          }
        };

        // If there's only one tier with items, send it. Otherwise prompt the user.
        if (tiers.length === 1) {
          try {
            await sendTier(tiers[0]);
          } finally {
            sendingRef.current = false;
          }
          return;
        }

        Alert.alert(
          t('tieredQuote.pickTierTitle', 'Which package do you want to send?'),
          t('tieredQuote.pickTierDesc', 'Your customer will see only the package you pick. They can still reply asking to see the others.'),
          [
            ...tiers.map((ti: any) => ({
              text: ti.name ?? t('tieredQuote.quoteLabel'),
              onPress: async () => {
                try { await sendTier(ti); } finally { sendingRef.current = false; }
              },
            })),
            { text: t('common.cancel'), style: 'cancel' as const, onPress: () => { sendingRef.current = false; } },
          ],
        );
      }}
      onClose={() => router.back()}
    />
  );
}
