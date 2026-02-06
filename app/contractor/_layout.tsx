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
      <Stack.Screen name="ai-assistant" />
      <Stack.Screen name="smart-pricing" />
      <Stack.Screen name="follow-up" />
      <Stack.Screen name="customer-insights" />
      <Stack.Screen name="reputation" />
      <Stack.Screen name="leads" />
      <Stack.Screen name="receipts" />
      <Stack.Screen name="reorder" />
      <Stack.Screen name="team" />
      <Stack.Screen name="planning" />
      <Stack.Screen name="route" />
      <Stack.Screen name="capacity" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="compliance" />
      <Stack.Screen name="cashflow" />
      <Stack.Screen name="warranty" />
      <Stack.Screen name="benchmark" />
      <Stack.Screen name="complete-job" />
      <Stack.Screen name="ai-quote" />
      <Stack.Screen name="materials" />
      <Stack.Screen name="handover/[jobId]" />
    </Stack>
  );
}
