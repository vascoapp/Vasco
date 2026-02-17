import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SemanticColors } from '../../src/theme/colors';
import { CFODashboard } from '../../src/components/dashboards/CFODashboard';

export default function CFOReturnsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CFODashboard initialTab="returns" showTabBar={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
});
