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
import { useAppState } from '../../../src/state/AppState';
import type { HandoverPackage } from '../../../src/types/contractor';

export default function HandoverScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { jobs, customers } = useAppState();
  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<{ id: string; title: string; customerName: string; customerEmail: string; address: string; agreedAmount: number; description: string } | null>(null);

  useEffect(() => {
    const loadJob = async () => {
      setIsLoading(true);

      // Find real job from AppState
      const realJob = jobs.find(j => j.id === jobId);
      if (realJob) {
        const customer = customers.find(c => c.id === realJob.customerId);
        setJob({
          id: realJob.id,
          title: realJob.title || realJob.description || 'Project',
          customerName: customer?.name || realJob.customerId || 'Klant',
          customerEmail: customer?.email || '',
          address: (realJob as any).address?.street ? `${(realJob as any).address.street}, ${(realJob as any).address.city || ''}` : '',
          agreedAmount: realJob.agreedAmount || realJob.quotedAmount || 0,
          description: realJob.description || realJob.title || '',
        });
      } else if (jobId) {
        setJob({
          id: jobId,
          title: 'Project',
          customerName: 'Klant',
          customerEmail: '',
          address: '',
          agreedAmount: 0,
          description: '',
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
