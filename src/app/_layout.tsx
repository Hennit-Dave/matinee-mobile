import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';
import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../components';
import { readStripePublishableKey } from '../lib/stripe';
import { useTheme } from '../theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootContent() {
  const { colors } = useTheme();
  // A font that fails to load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors['surface/default'] } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="search" />
      {/* Seat selection is a root-level route, outside (tabs), so the glass NavBar is not drawn on it. */}
      <Stack.Screen name="showtime/[id]/seats" />
      {/* Checkout is a MODAL over the seat screen, so the seat screen (and its hold) stays mounted underneath. */}
      <Stack.Screen name="showtime/[id]/checkout" options={{ presentation: 'modal' }} />
      {/* The ticket after a confirmed booking (D4.6). */}
      <Stack.Screen name="ticket/[reference]" />
      {/* Development-only check screen: not reachable from the tab bar. */}
      <Stack.Screen name="dev-health" />
      {/* Hidden component gallery (RULES.md D3.4): unlinked, open it by its path, /gallery. */}
      <Stack.Screen name="gallery" />
    </Stack>
  );
}

export default function RootLayout() {
  // GestureHandlerRootView: the seat map's pinch, pan and tap (react-native-gesture-handler) need it at the root.
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={readStripePublishableKey() ?? ''}>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <RootContent />
            </ToastProvider>
          </QueryClientProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
