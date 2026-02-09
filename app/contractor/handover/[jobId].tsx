// =============================================================================
// HANDOVER SCREEN
// =============================================================================
// Screen for contractors to build and deliver handover packages to customers
// Integrates HandoverPackBuilder wizard for evidence assembly
// =============================================================================

import { useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HandoverPackBuilder } from '../../../src/components/contractor/HandoverPackBuilder';
import { SemanticColors } from '../../../src/theme/colors';
import { Spacing } from '../../../src/theme/spacing';
import type { HandoverPackage } from '../../../src/types/contractor';

// Mock job data - in real app this would come from a job service
const MOCK_JOBS: Record<string, {
  id: string;
  title: string;
  customerName: string;
  customerEmail: string;
  address: string;
  agreedAmount: number;
  description: string;
}> = {
  'job-001': {
    id: 'job-001',
    title: 'Kitchen Renovation',
    customerName: 'Van der Berg Family',
    customerEmail: 'info@vanderberg.nl',
    address: 'Keizersgracht 123, Amsterdam',
    agreedAmount: 2450.00,
    description: 'Complete kitchen renovation including cabinets, countertops, and appliance installation',
  },
  'job-002': {
    id: 'job-002',
    title: 'Bathroom Remodel',
    customerName: 'De Groot',
    customerEmail: 'degroot@email.nl',
    address: 'Herengracht 456, Amsterdam',
    agreedAmount: 3800.00,
    description: 'Full bathroom remodel with new fixtures, tiling, and plumbing',
  },
  'job-003': {
    id: 'job-003',
    title: 'Office Painting',
    customerName: 'Tech Startup BV',
    customerEmail: 'facilities@techstartup.nl',
    address: 'Zuidas 789, Amsterdam',
    agreedAmount: 1200.00,
    description: 'Interior painting of office space including walls and ceilings',
  },
};

export default function HandoverScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<typeof MOCK_JOBS[string] | null>(null);

  useEffect(() => {
    const loadJob = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (jobId && MOCK_JOBS[jobId]) {
        setJob(MOCK_JOBS[jobId]);
      } else if (jobId) {
        setJob({
          id: jobId,
          title: 'Construction Project',
          customerName: 'Customer',
          customerEmail: 'customer@email.com',
          address: 'Project Site',
          agreedAmount: 0,
          description: 'Project work',
        });
      }
      setIsLoading(false);
    };

    loadJob();
  }, [jobId]);

  const handleComplete = (handover: HandoverPackage) => {
    Alert.alert(
      'Opleverpakket klaar',
      `Het opleverpakket voor ${job?.title || 'deze klus'} is succesvol aangemaakt.`,
      [
        { text: 'Terug', onPress: () => router.back() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SemanticColors.actionPrimary} />
        <Text style={styles.loadingText}>Opleverpakket laden...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Klus niet gevonden</Text>
        <Text style={styles.errorText}>
          De gevraagde klus kon niet gevonden worden. Probeer het opnieuw.
        </Text>
      </View>
    );
  }

  return (
    <HandoverPackBuilder
      jobId={job.id}
      contractorId="contractor_1"
      customerId="customer_1"
      job={{
        id: job.id,
        title: job.title,
        customerName: job.customerName,
        address: job.address,
        quotedAmount: job.agreedAmount,
        finalAmount: job.agreedAmount,
        currency: 'EUR',
      }}
      onComplete={handleComplete}
      onClose={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  errorText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
});
