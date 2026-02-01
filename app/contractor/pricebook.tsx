import { useRouter } from 'expo-router';
import { Pricebook } from '../../src/components/contractor';

export default function PricebookScreen() {
  const router = useRouter();

  return (
    <Pricebook
      onSelectItem={(item) => {
        // Could navigate to item detail or add to quote
        console.log('Selected pricebook item:', item.id);
      }}
      onClose={() => router.back()}
    />
  );
}
