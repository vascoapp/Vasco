import { Stack } from 'expo-router';
import { SemanticColors } from '../../../src/theme/colors';

export default function HandoverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: SemanticColors.surfacePrimary,
        },
        headerTintColor: SemanticColors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="[jobId]"
        options={{
          title: 'Handover Package',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
