import { useRouter } from 'expo-router';
import { JobMaterialsSuggestion } from '../../src/components/contractor';

export default function MaterialsScreen() {
  const router = useRouter();

  return (
    <JobMaterialsSuggestion
      jobCategory="general"
      onClose={() => router.back()}
      onAddToList={(materials) => {
        // In a real app, this would add to a shopping list/cart
        console.log('Materials added:', materials);
      }}
    />
  );
}
