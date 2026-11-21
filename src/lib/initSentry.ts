import * as Sentry from '@sentry/react-native';
import { readSentryDsn } from './sentry';

/**
 * Initialises Sentry at the app root (`src/app/_layout.tsx`), as early as possible so crashes during startup are
 * captured. `@sentry/react-native` captures JS errors, unhandled rejections and native crashes once initialised.
 * Source-map upload (readable stack traces) is a later slice.
 *
 * Fail-safe: without `EXPO_PUBLIC_SENTRY_DSN` this no-ops and the app still boots.
 */
export function initSentry(): boolean {
  const dsn = readSentryDsn();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0, // errors only; no performance tracing this slice
  });
  return true;
}
