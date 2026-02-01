import { useRouter } from 'expo-router';
import { IntegratedPayments } from '../../src/components/contractor';

export default function PaymentsScreen() {
  const router = useRouter();

  return <IntegratedPayments onClose={() => router.back()} />;
}
