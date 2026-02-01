import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { JobDetailScreen } from '../../../src/components/contractor';
import { MOCK_JOBS } from '../../../src/data/mockContractor';
import { SemanticColors } from '../../../src/theme/colors';

export default function JobDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const job = MOCK_JOBS.find((j) => j.id === id);

  if (!job) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Job not found</Text>
      </View>
    );
  }

  return (
    <JobDetailScreen
      job={job}
      onClose={() => router.back()}
      onStatusChange={(jobId, newStatus) => {
        console.log('Status change:', jobId, newStatus);
      }}
      onAddPhoto={(jobId, type) => {
        console.log('Add photo:', jobId, type);
      }}
      onClockIn={(jobId) => {
        console.log('Clock in:', jobId);
      }}
      onClockOut={(jobId) => {
        console.log('Clock out:', jobId);
      }}
    />
  );
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    color: SemanticColors.textSecondary,
    fontSize: 16,
  },
});
