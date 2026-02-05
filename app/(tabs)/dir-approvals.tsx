import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/theme/colors';
import { DirectorDashboard } from '../../src/components/dashboards';

export default function DirApprovalsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DirectorDashboard initialTab="approvals" showTabBar={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
