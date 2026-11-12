export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

// A development build may talk to the local API over plain http (an Android emulator reaches the host
// machine at 10.0.2.2, never at localhost — that's the real reason to never hardcode localhost here).
// Anything else must be https, so a release build can never send anything in clear text.
const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

/** Validates EXPO_PUBLIC_API_URL. Pure, so it is unit-tested. */
export function parseApiBaseUrl(raw: string | undefined, allowLocalHttp: boolean): string {
  if (!raw) throw new ConfigError('EXPO_PUBLIC_API_URL is not set.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError('EXPO_PUBLIC_API_URL is not a valid URL.');
  }
  const isHttps = url.protocol === 'https:';
  const isLocalHttp = url.protocol === 'http:' && allowLocalHttp && LOCAL_HTTP_HOSTS.has(url.hostname);
  if (!isHttps && !isLocalHttp) {
    throw new ConfigError('EXPO_PUBLIC_API_URL must be https (http only for the local API in a development build).');
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new ConfigError('EXPO_PUBLIC_API_URL must be a plain address with no query, fragment or credentials.');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

/**
 * The one EXPO_PUBLIC_ variable (README). It is a public server address, readable by anyone who has the
 * APK, and carries no secret: the server decides every permission. Expo inlines it at bundle time, so it
 * must be referenced exactly as process.env.EXPO_PUBLIC_API_URL.
 */
export function readApiBaseUrl(): string {
  return parseApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);
}
