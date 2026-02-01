import { useRouter } from 'expo-router';
import { DispatchBoard } from '../../src/components/sitelead';

export default function DispatchScreen() {
  const router = useRouter();

  return <DispatchBoard onClose={() => router.back()} />;
}
