import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/theme/colors';
import { SiteLeadDashboard } from '../../src/components/dashboards';

export default function SiteSafetyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SiteLeadDashboard initialTab="safety" showTabBar={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
