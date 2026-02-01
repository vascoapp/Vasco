import { useRouter } from 'expo-router';
import { SmartPurchasing } from '../../src/components/contractor';

export default function PurchasingScreen() {
  const router = useRouter();

  return <SmartPurchasing onClose={() => router.back()} />;
}
