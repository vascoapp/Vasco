import { ScrollView, StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { CFODashboard } from '../../src/components/dashboards/CFODashboard';

export default function CFOCostsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CFODashboard initialTab="costs" showTabBar={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
