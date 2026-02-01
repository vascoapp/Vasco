import { Stack } from 'expo-router';
import { SemanticColors } from '../../src/theme/colors';

export default function ContractorLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: SemanticColors.surfaceBackground },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="pricebook" />
      <Stack.Screen name="tiered-quote" />
      <Stack.Screen name="purchasing" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="jobs" />
      <Stack.Screen name="job/[id]" />
    </Stack>
  );
}
