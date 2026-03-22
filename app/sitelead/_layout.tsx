import { Stack } from 'expo-router';
import { SemanticColors } from '../../src/theme/colors';

export default function SiteLeadLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: SemanticColors.surfaceBackground },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="dispatch" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="incident-report" />
      <Stack.Screen name="inspection" />
      <Stack.Screen name="compliance" />
      <Stack.Screen name="log-defect" />
      <Stack.Screen name="close-defect" />
      <Stack.Screen name="daily-report" />
      <Stack.Screen name="safety-docs" />
      <Stack.Screen name="worker-certs" />
    </Stack>
  );
}
