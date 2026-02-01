import { useRouter } from 'expo-router';
import { SiteLeadDashboard } from '../../src/components/sitelead';

export default function SiteLeadScreen() {
  const router = useRouter();

  return (
    <SiteLeadDashboard
      onNavigate={(screen) => {
        switch (screen) {
          case 'dispatch':
            router.push('/sitelead/dispatch');
            break;
          case 'reports':
            router.push('/sitelead/reports');
            break;
          case 'schedule':
            router.push('/sitelead/dispatch');
            break;
          case 'inspections':
            router.push('/sitelead/reports');
            break;
        }
      }}
    />
  );
}
