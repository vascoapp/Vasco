import { Stack, Redirect } from 'expo-router';
import { View } from 'react-native';
import { SemanticColors } from '../../src/theme/colors';
import { useAuth } from '../../src/context/AuthContext';

export default function ContractorLayout() {
  // Auth gate, mirroring app/(contractor)/_layout.tsx.
  //
  // These 41 drill-downs had NO gate, so an unauthenticated visit rendered a
  // blank WHITE screen — not even the dark app background — instead of the
  // login redirect the tab group performs. Found by deep-linking the routes on
  // Android after a JS reload dropped the demo session; the breadcrumb read
  // `{ authenticated: false }` while the screen showed nothing at all.
  //
  // Not merely theoretical: `vasco://` deep links are what push notifications
  // and emails open. A contractor tapping a payment-reminder notification after
  // their session expired lands here, and a white void is the worst possible
  // answer — it reads as a broken app rather than "please sign in".
  //
  // No data exposure either way (services return empty with no user); this is
  // purely about not showing a dead screen.
  const { isAuthenticated, isAuthHydrating } = useAuth();

  if (isAuthHydrating) {
    // Themed blank while the session restores, so a cold start does not flash
    // white before resolving.
    return <View style={{ flex: 1, backgroundColor: SemanticColors.surfaceBackground }} />;
  }
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

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
      <Stack.Screen name="eve" />
      <Stack.Screen name="cashflow" />
      <Stack.Screen name="insurance" />
      <Stack.Screen name="inkoop" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="warranty" />
      <Stack.Screen name="material-search" />
      <Stack.Screen name="handover" />
      <Stack.Screen name="timesheet" />
      <Stack.Screen name="purchase-orders" />
      <Stack.Screen name="permits" />
      <Stack.Screen name="payroll" />
      <Stack.Screen name="quote-templates" />
      <Stack.Screen name="expenses" />
      <Stack.Screen name="closeout" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="project-billing/[id]" />
      <Stack.Screen name="market-prices" />
      <Stack.Screen name="search" />
      <Stack.Screen name="automations" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="drag-schedule" />
      <Stack.Screen name="customer-view" />
      <Stack.Screen name="customer-crm" />
      <Stack.Screen name="message-templates" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="calendar-settings" />
      <Stack.Screen name="service-agreements" />
    </Stack>
  );
}
