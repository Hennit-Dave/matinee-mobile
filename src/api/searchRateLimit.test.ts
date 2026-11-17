import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { CLIENT_ID_HEADER } from './clientId';
import { MAX_RETRY_AFTER_SECONDS, MovieApiError, fetchSearchMovies, type MoviesFetchResult } from './movies';
import {
  RATE_LIMITED_SEARCH_MESSAGE,
  SEARCH_MIN_RETRY_MS,
  SEARCH_RATE_LIMIT_RETRIES,
  SEARCH_RETRY_OPTIONS,
  isOfflineNetworkError,
  isWaitingOnRateLimit,
  searchErrorCopy,
  searchRetryDelayMs,
  shouldRetrySearch,
} from './searchHelpers';

const BASE = 'https://api.example.test';
const CLIENT = '0a11ce00-0000-4000-8000-000000000001';

const PAGE = { movies: [{ id: 1, title: 'Dune', posterUrl: null, year: 2021, overview: null }], page: 1, totalPages: 1, totalResults: 1 };

interface Sent {
  url: string;
  init: RequestInit | undefined;
}

/** Runs `body` with `fetch` replaced by `handler`, and gives back what was sent. Always puts fetch back. */
async function withFetch(
  handler: (n: number) => Response,
  body: (sent: Sent[]) => Promise<void>
): Promise<void> {
  const original = globalThis.fetch;
  const sent: Sent[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    sent.push({ url: String(input), init });
    return handler(sent.length);
  }) as typeof fetch;
  try {
    await body(sent);
  } finally {
    globalThis.fetch = original;
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
const limited = (retryAfter?: string) =>
  json(429, { error: { code: 'rate_limited', message: 'Too many requests.', requestId: 'req-1' } }, retryAfter ? { 'Retry-After': retryAfter } : {});
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const rateLimitedError = (retryAfterSeconds?: number) =>
  new MovieApiError('x', { status: 429, kind: 'rate_limited', retryAfterSeconds });

// ---- The retry policy -----------------------------------------------------------------------------

test('only a 429 is retried, and only up to the cap', () => {
  const limit = rateLimitedError(2);
  for (let failures = 0; failures < SEARCH_RATE_LIMIT_RETRIES; failures += 1) {
    assert.equal(shouldRetrySearch(failures, limit), true, `failure #${failures + 1} is retried`);
  }
  assert.equal(shouldRetrySearch(SEARCH_RATE_LIMIT_RETRIES, limit), false, 'then it stops');

  for (const other of [
    new MovieApiError('x', { status: 503, kind: 'service_unavailable' }),
    new MovieApiError('x', { status: 0, kind: 'network_error' }),
    new MovieApiError('x', { status: 404, kind: 'not_found' }),
    new MovieApiError('x', { status: 400, kind: 'validation_failed' }),
    new Error('boom'),
    null,
  ]) {
    assert.equal(shouldRetrySearch(0, other), false, String(other));
  }
});

test('the wait is the server\'s Retry-After, never under a second, with a fallback when there is none', () => {
  assert.equal(searchRetryDelayMs(rateLimitedError(7)), 7000);
  assert.equal(searchRetryDelayMs(rateLimitedError(0)), SEARCH_MIN_RETRY_MS, 'a 0 must not become a tight loop');
  assert.equal(searchRetryDelayMs(rateLimitedError()), 2000, 'no header: the same 2 s fallback holds use');
  assert.equal(searchRetryDelayMs(rateLimitedError(MAX_RETRY_AFTER_SECONDS)), MAX_RETRY_AFTER_SECONDS * 1000);
  assert.equal(SEARCH_RETRY_OPTIONS.retryDelay(0, rateLimitedError(9)), 9000, 'the options use the same rule');
});

test('waiting on the limiter is true only while a 429 is being waited out', () => {
  const waiting = { isFetching: true, failureCount: 1, failureReason: rateLimitedError(3) };
  assert.equal(isWaitingOnRateLimit(waiting), true);
  assert.equal(isWaitingOnRateLimit({ ...waiting, isFetching: false }), false, 'retries used up: an ordinary error now');
  assert.equal(isWaitingOnRateLimit({ ...waiting, failureCount: 0 }), false, 'the first attempt is not a retry');
  assert.equal(
    isWaitingOnRateLimit({ ...waiting, failureReason: new MovieApiError('x', { status: 503, kind: 'service_unavailable' }) }),
    false,
    'a different failure is not the limiter'
  );
  assert.equal(isWaitingOnRateLimit({ isFetching: true, failureCount: 0, failureReason: null }), false);
});

test('the Toast wording', () => {
  assert.equal(RATE_LIMITED_SEARCH_MESSAGE, 'Slow down a moment. Searching again shortly…');
});

test('the error state says what it always said, and something kinder for a spent 429', () => {
  assert.deepEqual(searchErrorCopy(new MovieApiError('x', { status: 0, kind: 'network_error' })), {
    headline: 'You’re offline',
    body: 'Search needs a connection. Your saved tickets still open without one.',
  });
  assert.deepEqual(searchErrorCopy(new MovieApiError('Movie request failed.', { status: 500, kind: 'internal_error' })), {
    headline: 'Search failed',
    body: 'Movie request failed.',
  });
  assert.deepEqual(searchErrorCopy(null), { headline: 'Search failed', body: 'Check your connection and try again.' });
  assert.deepEqual(searchErrorCopy(rateLimitedError(5)), {
    headline: 'Too many searches',
    body: 'Give it a moment, then try again.',
  });
  assert.equal(isOfflineNetworkError(rateLimitedError()), false);
});

// ---- The policy, run for real through TanStack Query -----------------------------------------------
// The same options object the hook spreads into useQuery (SEARCH_RETRY_OPTIONS), a real QueryClient, the real
// request code, and a stand-in for fetch. Timers are mocked, so a 7 s wait costs no time and cannot be early.

type SearchOutcome = { ok: true; value: MoviesFetchResult } | { ok: false; error: unknown };

/**
 * `steps` drives the clock. It gets `outcome()`, which says how the search ended and FAILS (it does not hang) if the
 * search has not ended: a regression that retries too often must turn the test red, never freeze the suite.
 */
async function runSearch(
  handler: (n: number) => Response,
  steps: (tick: (ms: number) => Promise<void>, sent: Sent[], outcome: () => Promise<SearchOutcome>) => Promise<void>
): Promise<void> {
  mock.timers.enable({ apis: ['setTimeout'] });
  const client = new QueryClient();
  try {
    await withFetch(handler, async (sent) => {
      let ended: SearchOutcome | null = null;
      void client
        .fetchQuery({
          queryKey: ['search', 'dune'],
          queryFn: ({ signal }) => fetchSearchMovies('dune', 1, signal, BASE, CLIENT),
          ...SEARCH_RETRY_OPTIONS,
        })
        .then(
          (value) => {
            ended = { ok: true, value };
          },
          (error: unknown) => {
            ended = { ok: false, error };
          }
        );
      await flush();
      const tick = async (ms: number) => {
        mock.timers.tick(ms);
        await flush();
      };
      const outcome = async () => {
        await flush();
        assert.ok(ended, 'the search has not finished: it is still waiting to retry');
        return ended;
      };
      await steps(tick, sent, outcome);
    });
  } finally {
    client.clear();
    mock.timers.reset();
  }
}

test('a 429 then success: the app waits exactly Retry-After, asks again once, and the results arrive', async () => {
  await runSearch(
    (n) => (n === 1 ? limited('7') : json(200, PAGE)),
    async (tick, sent, outcome) => {
      assert.equal(sent.length, 1, 'the first request went out');
      await tick(6_999);
      assert.equal(sent.length, 1, 'still waiting: 1 ms short of the 7 s the server asked for');
      await tick(1);
      assert.equal(sent.length, 2, 'asked again the moment Retry-After was over');
      const result = await outcome();
      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value.data.movies[0]?.title, 'Dune');
      assert.equal((sent[1]!.init?.headers as Record<string, string>)[CLIENT_ID_HEADER], CLIENT, 'the retry names the install too');
    }
  );
});

test('a 429 that keeps coming: retried exactly the cap, then the error is shown (never an endless loop)', async () => {
  await runSearch(
    () => limited('2'),
    async (tick, sent, outcome) => {
      for (let retry = 1; retry <= SEARCH_RATE_LIMIT_RETRIES; retry += 1) {
        assert.equal(sent.length, retry, `attempt ${retry} is out and waiting`);
        await tick(2_000);
      }
      assert.equal(sent.length, SEARCH_RATE_LIMIT_RETRIES + 1, 'one try plus the allowed retries');
      const result = await outcome();
      assert.equal(result.ok, false);
      assert.ok(!result.ok && result.error instanceof MovieApiError);
      assert.equal(!result.ok && (result.error as MovieApiError).kind, 'rate_limited');
      await tick(600_000);
      assert.equal(sent.length, SEARCH_RATE_LIMIT_RETRIES + 1, 'and nothing more is ever sent');
    }
  );
});

test('a failure that is not a 429 is not retried: it is shown at once, as before', async () => {
  for (const response of [
    () => json(500, { error: { code: 'internal_error', message: 'boom', requestId: 'r' } }),
    () => json(503, { error: { code: 'service_unavailable', message: 'down', requestId: 'r' } }, { 'Retry-After': '2' }),
    () => json(404, { error: { code: 'not_found', message: 'nope', requestId: 'r' } }),
  ]) {
    await runSearch(response, async (tick, sent, outcome) => {
      assert.equal((await outcome()).ok, false, 'it ended straight away, with no retry pending');
      await tick(600_000);
      assert.equal(sent.length, 1);
    });
  }
});
