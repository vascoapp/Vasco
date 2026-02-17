import { Stack } from 'expo-router';
import { SemanticColors } from '../../../src/theme/colors';

export default function HubLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: SemanticColors.surfaceBackground,
        },
        headerTintColor: SemanticColors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: SemanticColors.surfaceBackground,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Agent Hub',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="projects"
        options={{
          title: 'Projects',
          headerBackTitle: 'Hub',
        }}
      />
      <Stack.Screen
        name="documents"
        options={{
          title: 'Documents',
          headerBackTitle: 'Hub',
        }}
      />
      <Stack.Screen
        name="metrics"
        options={{
          title: 'ROI Metrics',
          headerBackTitle: 'Hub',
        }}
      />
      <Stack.Screen
        name="risks"
        options={{
          title: 'Risk Register',
          headerBackTitle: 'Hub',
        }}
      />
      <Stack.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          headerBackTitle: 'Hub',
        }}
      />
      <Stack.Screen
        name="s106"
        options={{
          title: 'S106 & CIL',
          headerBackTitle: 'Hub',
        }}
      />
    </Stack>
  );
}
