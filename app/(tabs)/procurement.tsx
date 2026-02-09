// COO Emerging Tab - Emerging 2026 Priorities
import { Screen } from '../../src/components/Screen';
import { COODashboard } from '../../src/components/dashboards';
import { useAuth } from '../../src/context/AuthContext';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../src/theme/colors';

export default function ProcurementScreen() {
  const { user } = useAuth();

  // Only render for COO role
  if (user?.role !== 'coo') {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={styles.text}>Procurement view not available for this role</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <COODashboard initialTab="emerging" showTabBar={false} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.muted,
    fontSize: 16,
  },
});
