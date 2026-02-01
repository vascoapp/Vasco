import { Stack } from 'expo-router';
import { Colors } from '../../../src/theme/colors';

export default function HubLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTintColor: Colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: Colors.background,
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
