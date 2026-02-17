import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SemanticColors } from '../../src/theme/colors';
import { SiteLeadDashboard } from '../../src/components/dashboards';

export default function SiteQualityScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SiteLeadDashboard initialTab="quality" showTabBar={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
});
