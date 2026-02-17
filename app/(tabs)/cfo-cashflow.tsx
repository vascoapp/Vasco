import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SemanticColors } from '../../src/theme/colors';
import { CFODashboard } from '../../src/components/dashboards/CFODashboard';

export default function CFOCashflowScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CFODashboard initialTab="cashflow" showTabBar={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
});
