import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSentryDsn } from './sentry';

test('readSentryDsn returns the trimmed DSN when set, or null when unset/blank', () => {
  const before = process.env.EXPO_PUBLIC_SENTRY_DSN;
  try {
    process.env.EXPO_PUBLIC_SENTRY_DSN = '  https://abc@example.ingest.sentry.io/123  ';
    assert.equal(readSentryDsn(), 'https://abc@example.ingest.sentry.io/123');

    process.env.EXPO_PUBLIC_SENTRY_DSN = '';
    assert.equal(readSentryDsn(), null);

    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    assert.equal(readSentryDsn(), null);
  } finally {
    if (before === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    else process.env.EXPO_PUBLIC_SENTRY_DSN = before;
  }
});
