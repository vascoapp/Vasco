import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { TieredQuoteBuilder } from '../../src/components/contractor';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';

export default function TieredQuoteScreen() {
  const router = useRouter();
  const { addQuote } = useAppState();

  return (
    <TieredQuoteBuilder
      onSend={async (quote) => {
        // Extract line items from the "Better" tier (middle option) as default
        const tier = quote.tiers?.[1] ?? quote.tiers?.[0];
        if (!tier) {
          Alert.alert('Fout', 'Geen items in de offerte.');
          return;
        }

        const lineItems = (tier.lineItems ?? []).map((item: any) => ({
          id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          description: item.description || item.name || 'Item',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || item.price || 0,
        }));

        try {
          const quoteId = await addQuote(
            'Klant', // customer placeholder
            tier.name || 'Offerte',
            lineItems,
          );
          hapticSuccess();
          Alert.alert('Offerte aangemaakt', `Offerte ${quoteId} is opgeslagen.`, [
            { text: 'Bekijken', onPress: () => router.replace(`/quotes/${quoteId}` as any) },
            { text: 'Sluiten', onPress: () => router.back() },
          ]);
        } catch (err) {
          Alert.alert('Fout', 'Kon offerte niet opslaan.');
        }
      }}
      onClose={() => router.back()}
    />
  );
}
