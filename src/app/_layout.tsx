import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
      {/* Development-only check screen: not reachable from the tab bar. */}
      <Stack.Screen name="dev-health" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootContent />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
