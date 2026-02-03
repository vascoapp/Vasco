import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { AIQuoteFromPhoto } from '../../src/components/contractor';

export default function AIQuoteScreen() {
  const router = useRouter();

  const handleCreateQuote = (items: { description: string; suggestedQuantity: number; suggestedPrice: number }[], jobType: string) => {
    // In real app, this would:
    // 1. Create a quote draft with the detected items
    // 2. Navigate to quote editor for final touches
    // 3. Or go straight to send

    const total = items.reduce((sum, i) => sum + (i.suggestedQuantity * i.suggestedPrice), 0);

    Alert.alert(
      'Quote Created',
      `${jobType} quote created with ${items.length} line items.\n\nSubtotal: €${total.toFixed(2)}`,
      [
        {
          text: 'View Quote',
          onPress: () => router.replace('/contractor/quotes'),
        },
      ]
    );
  };

  return (
    <AIQuoteFromPhoto
      onCreateQuote={handleCreateQuote}
      onClose={() => router.back()}
    />
  );
}
