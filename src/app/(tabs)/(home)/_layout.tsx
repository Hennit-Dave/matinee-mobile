import { Stack } from 'expo-router';
import { useTheme } from '../../../theme';

export default function HomeStackLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors['surface/default'] },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="movie/[id]/index" />
      <Stack.Screen name="movie/[id]/showtimes" />
    </Stack>
  );
}
