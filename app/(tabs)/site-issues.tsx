import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SemanticColors } from '../../src/theme/colors';
import { SiteLeadDashboard } from '../../src/components/dashboards';

export default function SiteIssuesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SiteLeadDashboard initialTab="safety" showTabBar={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
});
