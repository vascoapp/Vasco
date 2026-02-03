import { useRouter, useLocalSearchParams } from 'expo-router';
import { JobCompletionEvidence } from '../../src/components/contractor';
import { Alert } from 'react-native';

// Mock job data - in real app this would come from a service
const MOCK_JOB = {
  id: 'job-001',
  title: 'Kitchen Renovation',
  customerName: 'Van der Berg Family',
  address: 'Keizersgracht 123, Amsterdam',
  agreedAmount: 2450.00,
  lineItems: [
    { description: 'Cabinet installation', quantity: 1, unitPrice: 800, total: 800 },
    { description: 'Countertop fitting', quantity: 1, unitPrice: 650, total: 650 },
    { description: 'Plumbing connections', quantity: 1, unitPrice: 350, total: 350 },
    { description: 'Electrical work', quantity: 1, unitPrice: 450, total: 450 },
    { description: 'Final finishing', quantity: 1, unitPrice: 200, total: 200 },
  ],
};

export default function CompleteJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // In real app, fetch job by params.id
  const job = MOCK_JOB;

  const handleGenerateInvoice = (evidencePackage: {
    jobId: string;
    completedAt: string;
    photos: { uri: string }[];
    totalPhotos: number;
  }) => {
    // In real app, this would:
    // 1. Create invoice draft with evidence attached
    // 2. Navigate to invoice preview/send screen
    Alert.alert(
      'Invoice Generated',
      `Invoice for €${job.agreedAmount.toFixed(2)} created with ${evidencePackage.totalPhotos} evidence photos attached.\n\nJob marked as complete.`,
      [
        {
          text: 'View Invoice',
          onPress: () => {
            router.replace('/contractor/invoices');
          },
        },
      ]
    );
  };

  return (
    <JobCompletionEvidence
      job={job}
      onGenerateInvoice={handleGenerateInvoice}
      onClose={() => router.back()}
    />
  );
}
