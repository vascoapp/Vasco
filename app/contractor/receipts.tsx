import { useRouter } from 'expo-router';
import { ReceiptScanner } from '../../src/components/contractor';

export default function ReceiptsScreen() {
  const router = useRouter();

  return (
    <ReceiptScanner
      onComplete={(receipt) => router.back()}
      onClose={() => router.back()}
    />
  );
}
