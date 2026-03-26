import { useRef } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TieredQuoteBuilder } from '../../src/components/contractor';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';

export default function TieredQuoteScreen() {
  const router = useRouter();
  const { addQuote } = useAppState();
  const { t } = useTranslation();
  const sendingRef = useRef(false);

  return (
    <TieredQuoteBuilder
      onSend={async (quote) => {
        if (sendingRef.current) return;
        sendingRef.current = true;
        // Extract line items from the "Better" tier (middle option) as default
        const tier = quote.tiers?.[1] ?? quote.tiers?.[0];
        if (!tier) {
          Alert.alert(t('tieredQuote.error'), t('tieredQuote.noItems'));
          return;
        }

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
        } finally {
          sendingRef.current = false;
        }
      }}
      onClose={() => router.back()}
    />
  );
}
