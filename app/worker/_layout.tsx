import { Stack, Redirect } from 'expo-router';
import { View } from 'react-native';
import { SemanticColors } from '../../src/theme/colors';
import { useAuth } from '../../src/context/AuthContext';

export default function WorkerLayout() {
  // Auth gate, mirroring app/contractor/_layout.tsx. Without it an
  // unauthenticated deep link rendered a blank WHITE screen -- not even the
  // dark app background -- instead of redirecting to login. `vasco://` links
  // are what push notifications and emails open, so a worker tapping a
  // notification after their session expired landed on a white void.
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
      <Stack.Screen name="my-schedule" />
      <Stack.Screen name="my-timesheets" />
    </Stack>
  );
}
