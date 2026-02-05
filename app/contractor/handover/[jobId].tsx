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
import { useEvidencePack, useHandoverPackage } from '../../../src/services/evidencePackService';
import { SemanticColors } from '../../../src/theme/colors';
import { Spacing } from '../../../src/theme/spacing';
import type { EvidencePack, HandoverPackage, CustomerSignOff } from '../../../src/types/contractor';

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

  // Hooks for evidence pack and handover management
  const { data: evidencePack, loading: evidenceLoading } = useEvidencePack(jobId || '');
  const {
    data: handoverPackage,
    loading: handoverLoading,
    createPackage,
    generatePDF,
    sendToCustomer,
  } = useHandoverPackage(jobId || '');

  useEffect(() => {
    // Simulate loading job data
    const loadJob = async () => {
      setIsLoading(true);
      // In real app, this would fetch from a service
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (jobId && MOCK_JOBS[jobId]) {
        setJob(MOCK_JOBS[jobId]);
      } else if (jobId) {
        // Create a generic job for unknown IDs
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

  const handleComplete = async (pack: EvidencePack, handover: HandoverPackage) => {
    try {
      // Create the handover package
      await createPackage(pack);

      // Generate PDF if requested
      if (handover.pdfUri) {
        await generatePDF();
      }

      // Show success message
      Alert.alert(
        'Handover Package Ready',
        `The handover package for ${job?.title || 'this job'} has been prepared successfully.\n\nYou can now share it with the customer.`,
        [
          {
            text: 'Share Now',
            onPress: async () => {
              // Send to customer
              if (job?.customerEmail) {
                await sendToCustomer(job.customerEmail);
                Alert.alert(
                  'Sent!',
                  'The handover package has been sent to the customer.',
                  [{ text: 'OK', onPress: () => router.back() }]
                );
              }
            },
          },
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to create handover package. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSendToCustomer = async (pack: EvidencePack, email: string) => {
    try {
      await sendToCustomer(email);
      Alert.alert(
        'Success',
        `Handover package sent to ${email}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to send handover package. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleGeneratePDF = async (pack: EvidencePack) => {
    try {
      const pdfUri = await generatePDF();
      Alert.alert(
        'PDF Generated',
        'The handover PDF has been created and is ready to share.',
        [{ text: 'OK' }]
      );
      return pdfUri || '';
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to generate PDF. Please try again.',
        [{ text: 'OK' }]
      );
      return '';
    }
  };

  const handleSignatureCapture = async (signOff: CustomerSignOff) => {
    // In real app, this would save the signature
    console.log('Signature captured:', signOff);
  };

  // Loading state
  if (isLoading || evidenceLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SemanticColors.actionPrimary} />
        <Text style={styles.loadingText}>Loading handover package...</Text>
      </View>
    );
  }

  // No job found
  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Job Not Found</Text>
        <Text style={styles.errorText}>
          The requested job could not be found. Please try again.
        </Text>
      </View>
    );
  }

  return (
    <HandoverPackBuilder
      jobId={job.id}
      jobTitle={job.title}
      customerName={job.customerName}
      customerEmail={job.customerEmail}
      existingPack={evidencePack || undefined}
      onComplete={handleComplete}
      onSendToCustomer={handleSendToCustomer}
      onGeneratePDF={handleGeneratePDF}
      onCaptureSignature={handleSignatureCapture}
      onCancel={() => router.back()}
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
