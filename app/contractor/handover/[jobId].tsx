// =============================================================================
// HANDOVER SCREEN
// =============================================================================
// Screen for contractors to build and deliver handover packages to customers
// Integrates HandoverPackBuilder wizard for evidence assembly
// =============================================================================

import { useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HandoverPackBuilder } from '../../../src/components/contractor/HandoverPackBuilder';
import { SemanticColors } from '../../../src/theme/colors';
import { Spacing } from '../../../src/theme/spacing';
import { useAppState } from '../../../src/state/AppState';
import { useAuth } from '../../../src/context/AuthContext';
import type { HandoverPackage } from '../../../src/types/contractor';

export default function HandoverScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { jobs, customers } = useAppState();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  // R15.3: thread real customerId so the evidence pack + handover record is
  // attributed to the correct customer (was hardcoded "customer_1" passed
  // to HandoverPackBuilder, which carries it into evidencePackService.
  // assembleEvidencePack and createHandoverPackage — every contractor's
  // evidence rows were stamped with the same fake id).
  const [job, setJob] = useState<{ id: string; title: string; customerId: string; customerName: string; customerEmail: string; address: string; agreedAmount: number; description: string } | null>(null);

  useEffect(() => {
    const loadJob = async () => {
      setIsLoading(true);

      // Find real job from AppState
      const realJob = jobs.find(j => j.id === jobId);
      if (realJob) {
        const customer = customers.find(c => c.id === realJob.customerId);
        setJob({
          id: realJob.id,
          title: realJob.title || realJob.description || t('common.project', 'Project'),
          customerId: realJob.customerId || customer?.id || '',
          customerName: customer?.name || realJob.customerId || t('common.customer', 'Customer'),
          customerEmail: customer?.email || '',
          address: (realJob as any).address?.street ? `${(realJob as any).address.street}, ${(realJob as any).address.city || ''}` : '',
          agreedAmount: realJob.agreedAmount || realJob.quotedAmount || 0,
          description: realJob.description || realJob.title || '',
        });
      } else if (jobId) {
        setJob({
          id: jobId,
          title: t('common.project', 'Project'),
          customerId: '',
          customerName: t('common.customer', 'Customer'),
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
      t('handover.packageReady', 'Handover package ready'),
      t('handover.packageReadyMessage', 'The handover package for {{title}} has been created successfully.', { title: job?.title || t('common.thisJob', 'this job') }),
      [
        { text: t('common.back', 'Back'), onPress: () => router.back() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SemanticColors.actionPrimary} />
        <Text style={styles.loadingText}>{t('handover.loading', 'Loading handover package...')}</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>{t('handover.jobNotFound', 'Job not found')}</Text>
        <Text style={styles.errorText}>
          {t('handover.jobNotFoundMessage', 'The requested job could not be found. Please try again.')}
        </Text>
      </View>
    );
  }

  return (
    <HandoverPackBuilder
      jobId={job.id}
      contractorId={user?.id ?? ''}
      customerId={job.customerId}
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
