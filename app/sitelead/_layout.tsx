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
      <Stack.Screen name="index" />
      <Stack.Screen name="dispatch" />
      <Stack.Screen name="reports" />
    </Stack>
  );
}
