import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfigError, readApiBaseUrl } from '../api/config';
import { primitives } from '../tokens/tokens';
import { useTheme } from '../theme';

type CheckStatus = 'ok' | 'error';
/** Mirrors matinee-server's HealthReport (src/health/health.ts). A contract change lands in a server PR first. */
interface HealthReport {
  ok: boolean;
  checks: Record<'postgresPrimary' | 'postgresReplica' | 'redis', { status: CheckStatus; reason?: string }>;
}

/** Development only. Proves the app and the API talk by calling GET /health. No feature, no fake data. */
export default function DevHealth() {
  const { colors, text } = useTheme();

  let apiUrl = '';
  let configError: string | null = null;
  try {
    apiUrl = readApiBaseUrl();
  } catch (err) {
    configError = err instanceof ConfigError ? err.message : 'Could not read EXPO_PUBLIC_API_URL.';
  }

  const health = useQuery({
    queryKey: ['dev-health', apiUrl],
    enabled: configError === null,
    queryFn: async ({ signal }): Promise<HealthReport> => {
      const res = await fetch(`${apiUrl}/health`, { signal });
      return (await res.json()) as HealthReport;
    },
  });

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors['surface/default'] }}>
      <ScrollView contentContainerStyle={{ padding: primitives['space/6'], gap: primitives['space/4'] }}>
        <Text style={[text['type/title'], { color: colors['text/primary'] }]}>/health check</Text>
        <Text style={[text['type/caption'], { color: colors['text/secondary'] }]}>
          {configError ? configError : `API: ${apiUrl}`}
        </Text>

        {configError ? null : health.isPending ? (
          <Text style={[text['type/body'], { color: colors['text/secondary'] }]}>Checking the API…</Text>
        ) : health.isError ? (
          <Text style={[text['type/body'], { color: colors['status/error'] }]}>
            Could not reach the API: {health.error instanceof Error ? health.error.message : 'unknown error'}
          </Text>
        ) : (
          <View style={{ gap: primitives['space/2'] }}>
            <Text style={[text['type/label'], { color: health.data.ok ? colors['status/success'] : colors['status/error'] }]}>
              {health.data.ok ? 'OK' : 'FAILED'} — overall
            </Text>
            {Object.entries(health.data.checks).map(([name, check]) => (
              <View key={name}>
                <Text style={[text['type/label'], { color: check.status === 'ok' ? colors['status/success'] : colors['status/error'] }]}>
                  {check.status === 'ok' ? 'OK' : 'FAIL'}  {name}
                </Text>
                {check.reason ? (
                  <Text style={[text['type/caption'], { color: colors['text/secondary'] }]}>{check.reason}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check again"
          disabled={configError !== null || health.isFetching}
          onPress={() => void health.refetch()}
          style={{
            minHeight: primitives['size/touch-min'],
            borderRadius: primitives['radius/md'],
            backgroundColor: colors['primary/default'],
            alignItems: 'center',
            justifyContent: 'center',
            opacity: configError !== null || health.isFetching ? 0.6 : 1,
          }}
        >
          <Text style={[text['type/label'], { color: colors['text/on-primary'] }]}>
            {health.isFetching ? 'Checking…' : 'Check again'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
