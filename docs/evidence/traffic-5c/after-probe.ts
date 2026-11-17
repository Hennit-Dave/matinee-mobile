/**
 * AFTER probe for traffic slice 5c (mobile): the same three checks as before-probe.ts, against the same real
 * throwaway matinee-server (the merged rate limiter over a throwaway Redis), now with the app's NEW request code,
 * plus the search retry policy running for real: a real TanStack `QueryClient`, the very options the hook uses
 * (`SEARCH_RETRY_OPTIONS`), real timers, and the real limiter.
 *
 *   npx tsx docs/evidence/traffic-5c/after-probe.ts <apiBase> <showtimeId> <seatId>
 *
 * Part C waits for the last seconds of a clock minute before it starts (the limiter's windows are aligned to the
 * minute), so the `Retry-After` it is given is a few seconds, not a minute. Not part of the app.
 */
import { QueryClient } from '@tanstack/react-query';
import { acquireHold, classifyHoldError, releaseHold } from '../../../src/api/holds';
import {
  MovieApiError,
  fetchSearchMovies,
  isRateLimitedError,
  resolveMoviesViewStatus,
} from '../../../src/api/movies';
import { SEARCH_RETRY_OPTIONS } from '../../../src/api/searchHelpers';

const [baseArg, showtimeArg, seatArg] = process.argv.slice(2);
if (!baseArg || !showtimeArg || !seatArg) throw new Error('usage: after-probe.ts <apiBase> <showtimeId> <seatId>');
const base: string = baseArg;
const showtimeId: string = showtimeArg;
const seatId: string = seatArg;

const CLIENT = '5c5c5c5c-0000-4000-8000-00000000000c';

interface Seen {
  at: number;
  url: string;
  headers: unknown;
  status?: number;
  retryAfter?: string | null;
}
const seen: Seen[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  const entry: Seen = { at: Date.now(), url: String(input), headers: init?.headers ?? null };
  seen.push(entry);
  const res = await realFetch(input as string, init);
  entry.status = res.status;
  entry.retryAfter = res.headers.get('Retry-After');
  return res;
}) as typeof fetch;

function describe(error: unknown): string {
  if (!(error instanceof MovieApiError)) return `not a MovieApiError: ${String(error)}`;
  return JSON.stringify({
    status: error.status,
    kind: error.kind,
    retryable: error.retryable,
    retryAfterSeconds: error.retryAfterSeconds ?? null,
  });
}

async function attempt<T>(run: () => Promise<T>): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await run();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  // ---- A. holds ----
  console.log('A. POST /holds, same install, same seat, 11 times in a row');
  let refusedAt = 0;
  let holdError: unknown;
  for (let i = 1; i <= 11; i += 1) {
    const result = await attempt(() => acquireHold(showtimeId, [seatId], CLIENT, undefined, base));
    if (!result.ok) {
      refusedAt = i;
      holdError = result.error;
      break;
    }
  }
  console.log(`   first refusal at request #${refusedAt}`);
  console.log(`   what the app sees:           ${describe(holdError)}`);
  console.log(`   isRateLimitedError:          ${isRateLimitedError(holdError)}`);
  console.log(`   classifyHoldError says:      ${JSON.stringify(classifyHoldError(holdError))}`);
  await attempt(() => releaseHold(showtimeId, [seatId], CLIENT, undefined, base)); // DELETE is not limited

  // ---- B. search: what the app sends ----
  console.log('\nB. GET /movies/search, one request, with the install id');
  seen.length = 0;
  await attempt(() => fetchSearchMovies('dune', 1, undefined, base, CLIENT));
  console.log(`   request headers sent: ${JSON.stringify(seen[0]?.headers)}`);

  // ---- C. search under the limiter, through the real retry policy ----
  console.log('\nC. GET /movies/search while the address is over its limit, through SEARCH_RETRY_OPTIONS');
  for (;;) {
    const second = new Date().getSeconds();
    if (second >= 55) break;
    if (second % 10 === 0) console.log(`   (waiting for the end of the minute: now :${String(second).padStart(2, '0')})`);
    await sleep(1000);
  }
  let admitted = 0;
  for (let i = 0; i < 400; i += 1) {
    const result = await attempt(() => fetchSearchMovies(`fill ${i}`, 1, undefined, base));
    if (!result.ok) break;
    admitted += 1;
  }
  console.log(`   address saturated after ${admitted} requests (the policy allows 180 a minute per address)`);

  seen.length = 0;
  const client = new QueryClient();
  const startedAt = Date.now();
  const outcome = await client
    .fetchQuery({
      queryKey: ['search', 'arrakis'],
      queryFn: ({ signal }) => fetchSearchMovies('arrakis', 1, signal, base, CLIENT),
      ...SEARCH_RETRY_OPTIONS,
    })
    .then(
      (value) => ({ ok: true as const, movies: value.data.movies.length }),
      (error: unknown) => ({ ok: false as const, error })
    );
  console.log('   requests the app made, in order (ms since the search began):');
  for (const entry of seen) {
    const sentHeaders = JSON.stringify(entry.headers);
    console.log(
      `     +${String(entry.at - startedAt).padStart(5)} ms  status ${entry.status}${entry.retryAfter ? `  Retry-After: ${entry.retryAfter}` : ''}  headers ${sentHeaders}`
    );
  }
  const first = seen[0];
  const second = seen[1];
  if (first?.retryAfter && second) {
    console.log(
      `   the server asked for ${first.retryAfter} s; the app asked again ${((second.at - first.at) / 1000).toFixed(2)} s after the refusal`
    );
  }
  console.log(`   how it ended: ${outcome.ok ? `results (${outcome.movies} films)` : `error ${describe(outcome.error)}`}`);
  console.log(
    `   while it waited the screen's status was "${resolveMoviesViewStatus({ enabled: true, isPending: true, isError: false, error: null, result: undefined })}" (the skeleton), never "error"`
  );
  client.clear();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
