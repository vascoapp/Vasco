import { useRouter } from 'expo-router';
import { JobsList } from '../../src/components/contractor';

export default function JobsScreen() {
  const router = useRouter();

  return (
    <JobsList
      onSelectJob={(job) => router.push(`/contractor/job/${job.id}`)}
      onNewJob={() => router.push('/contractor/tiered-quote')}
      onNewQuote={() => router.push('/contractor/tiered-quote')}
    />
  );
}
