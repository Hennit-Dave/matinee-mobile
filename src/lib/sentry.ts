/**
 * Error tracking (observability slice). This file is PURE (no React Native, no `@sentry/react-native` import) so it
 * is unit-tested with `node --test`. The DSN is an ingestion endpoint + project id — public by design, like the
 * Stripe publishable key (it cannot read data or charge). Fail-safe: without `EXPO_PUBLIC_SENTRY_DSN` the app still
 * boots, it just doesn't report.
 *
 * The `Sentry.init` side effect lives in `initSentry.ts` (which imports the native module) and is called at the app
 * root.
 */

/** The public DSN, or `null` when unset/blank (a build without it still runs, it just doesn't report). */
export function readSentryDsn(): string | null {
  const raw = process.env.EXPO_PUBLIC_SENTRY_DSN;
  return raw && raw.trim() ? raw.trim() : null;
}
