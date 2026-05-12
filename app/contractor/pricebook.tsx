import { useRouter } from 'expo-router';
import { Pricebook } from '../../src/components/contractor';

export default function PricebookScreen() {
  const router = useRouter();

  return (
    <Pricebook
      onSelectItem={() => {
        // Placeholder — selecting from this screen doesn't route anywhere
        // (callers that want to add-to-quote use the embedded Pricebook
        // inside TieredQuoteBuilder, which handles selection directly).
      }}
      onClose={() => router.back()}
    />
  );
}
