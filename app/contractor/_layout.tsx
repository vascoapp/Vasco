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
      <Stack.Screen name="payments" />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="ai-assistant" />
      <Stack.Screen name="follow-up" />
      <Stack.Screen name="receipts" />
      <Stack.Screen name="cashflow" />
      <Stack.Screen name="insurance" />
      <Stack.Screen name="inkoop" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="warranty" />
      <Stack.Screen name="materials" />
      <Stack.Screen name="handover" />
      <Stack.Screen name="timesheet" />
      <Stack.Screen name="purchase-orders" />
      <Stack.Screen name="permits" />
      <Stack.Screen name="subcontractors" />
      <Stack.Screen name="pipeline" />
      <Stack.Screen name="profit-loss" />
      <Stack.Screen name="payroll" />
      <Stack.Screen name="quote-templates" />
      <Stack.Screen name="expenses" />
      <Stack.Screen name="closeout" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="market-prices" />
      <Stack.Screen name="search" />
      <Stack.Screen name="automations" />
      <Stack.Screen name="customer" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="doc-requirements" />
      <Stack.Screen name="reconciliation" />
      <Stack.Screen name="drag-schedule" />
      <Stack.Screen name="customer-view" />
      <Stack.Screen name="schedule-optimizer" />
      <Stack.Screen name="customer-crm" />
      <Stack.Screen name="integrations" />
      {/* service-agreements, ai-quote, customer-insights, leads, planning, smart-pricing — deleted */}
    </Stack>
  );
}
