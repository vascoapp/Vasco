import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { AppStateProvider } from '../src/state/AppState';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

// Enterprise roles use the (tabs) layout
const ENTERPRISE_ROLES = ['cfo', 'coo', 'site-lead', 'director'];

function RootLayoutNav() {
  const { isAuthenticated, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === 'login';
    const inCustomerPortal = segments[0] === 'customer';

    // Customer portal is public - no auth required
    if (inCustomerPortal) {
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Route based on user role
      const isEnterprise = user?.role && ENTERPRISE_ROLES.includes(user.role);

      if (isEnterprise) {
        // Enterprise users (CFO/COO/Site Lead) go to project software
        router.replace('/(tabs)');
      } else {
        // Solo contractors go to contractor app (default experience)
        router.replace('/(contractor)');
      }
    }
  }, [isAuthenticated, user, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(contractor)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="contractor" />
      <Stack.Screen name="sitelead" />
      <Stack.Screen name="customer/[code]" />
      <Stack.Screen name="hub" />
      <Stack.Screen name="(modals)/ingestion" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/insights" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <AppStateProvider>
        <RootLayoutNav />
      </AppStateProvider>
    </AuthProvider>
  );
}
