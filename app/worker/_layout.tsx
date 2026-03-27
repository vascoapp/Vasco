import { Stack } from 'expo-router';
import { SemanticColors } from '../../src/theme/colors';

export default function WorkerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: SemanticColors.surfaceBackground },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="my-schedule" />
      <Stack.Screen name="my-timesheets" />
    </Stack>
  );
}
