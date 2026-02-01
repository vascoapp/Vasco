import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { TieredQuoteBuilder } from '../../src/components/contractor';

export default function TieredQuoteScreen() {
  const router = useRouter();

  return (
    <TieredQuoteBuilder
      onSend={(quote) => {
        Alert.alert(
          'Quote Created',
          `Good-Better-Best quote ready to send!\n\nTiers: ${quote.tiers?.length || 3}`,
          [
            { text: 'Send Later', style: 'cancel' },
            {
              text: 'Send Now',
              onPress: () => {
                Alert.alert('Sent!', 'Quote sent to customer');
                router.back();
              },
            },
          ]
        );
      }}
      onClose={() => router.back()}
    />
  );
}
