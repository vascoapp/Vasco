import { useRouter } from 'expo-router';
import { Pricebook } from '../../src/components/contractor';

export default function PricebookScreen() {
  const router = useRouter();

  return (
    <Pricebook
      // "new" is not an entry id — the editor reads it as "create".
      onCreateItem={() => router.push('/contractor/pricebook/new')}
      onEditItem={(id) => router.push(`/contractor/pricebook/${id}`)}
      onClose={() => router.back()}
    />
  );
}
