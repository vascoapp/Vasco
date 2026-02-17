import { Stack } from 'expo-router';
import { SemanticColors } from '../../src/theme/colors';

export default function HubLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: SemanticColors.surfacePrimary },
        headerTintColor: SemanticColors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="approvals" options={{ title: 'Goedkeuringen' }} />
      <Stack.Screen name="schedule" options={{ title: 'Planning' }} />
      <Stack.Screen name="reports" options={{ title: 'Rapportages' }} />
      <Stack.Screen name="costs" options={{ title: 'Kostenanalyse' }} />
      <Stack.Screen name="projects" options={{ title: 'Projecten' }} />
      <Stack.Screen name="appraisal" options={{ title: 'Taxatie' }} />
      <Stack.Screen name="metrics" options={{ title: 'Metrics & KPIs' }} />
      <Stack.Screen name="risks" options={{ title: 'Risico Register' }} />
      <Stack.Screen name="evidence" options={{ title: 'Bewijsketen' }} />
      <Stack.Screen name="intelligence" options={{ headerShown: false }} />
      <Stack.Screen name="materials" options={{ headerShown: false }} />
      <Stack.Screen name="suppliers" options={{ headerShown: false }} />
      <Stack.Screen name="kosten-tools" options={{ title: 'Kosten Tools' }} />
      <Stack.Screen name="budget-optimizer" options={{ title: 'Budget Optimalisatie' }} />
    </Stack>
  );
}
