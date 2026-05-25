import { useRouter } from 'expo-router';
import { DeepReports } from '../../src/components/sitelead';

export default function ReportsScreen() {
  const router = useRouter();

  return <DeepReports onClose={() => router.back()} />;
}
