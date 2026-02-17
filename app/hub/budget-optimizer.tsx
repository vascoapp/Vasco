// Hub: Budget Optimizer — AI-powered budget optimization for project directors
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SemanticColors } from '../../src/theme/colors';
import BudgetOptimizerDashboard from '../../src/components/dashboards/BudgetOptimizerDashboard';

export default function BudgetOptimizerScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Budget Optimalisatie',
          headerStyle: { backgroundColor: SemanticColors.surfaceBackground },
          headerTintColor: SemanticColors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <BudgetOptimizerDashboard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
});
