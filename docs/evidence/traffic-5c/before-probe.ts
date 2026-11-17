/**
 * BASELINE probe for traffic slice 5c (mobile). It runs the app's request code exactly as it is on `main`
 * against a real throwaway matinee-server (the merged rate limiter, `eaaa82c`, over a throwaway Redis) and prints
 * what the app makes of a 429 and what it sends on search.
 *
 *   npx tsx docs/evidence/traffic-5c/before-probe.ts <apiBase> <showtimeId> <seatId>
 *
 * It only reads what the app's own functions return. Not part of the app and not imported by it.
 */
import { acquireHold, classifyHoldError, releaseHold } from '../../../src/api/holds';
import { MovieApiError, fetchSearchMovies, isServerOverloadedError, resolveMoviesViewStatus } from '../../../src/api/movies';

const [baseArg, showtimeArg, seatArg] = process.argv.slice(2);
if (!baseArg || !showtimeArg || !seatArg) throw new Error('usage: before-probe.ts <apiBase> <showtimeId> <seatId>');
const base: string = baseArg;
const showtimeId: string = showtimeArg;
const seatId: string = seatArg;

const CLIENT = '5c5c5c5c-0000-4000-8000-00000000000b';

// Record every request the app makes, so "what is sent on search" is read from the request itself.
const sent: { url: string; headers: unknown }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  sent.push({ url: String(input), headers: init?.headers ?? null });
  return realFetch(input as string, init);
}) as typeof fetch;

function describe(error: unknown): string {
  if (!(error instanceof MovieApiError)) return `not a MovieApiError: ${String(error)}`;
  return JSON.stringify({
    status: error.status,
    kind: error.kind,
    retryable: error.retryable,
    retryAfterSeconds: error.retryAfterSeconds ?? null,
    message: error.message,
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

async function main(): Promise<void> {
  // ---- A. holds: the 11th hold in a minute from one install is refused by the limiter (hold: 10 per install) ----
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
  console.log(`   classifyHoldError says:      ${JSON.stringify(classifyHoldError(holdError))}`);
  await attempt(() => releaseHold(showtimeId, [seatId], CLIENT, undefined, base)); // DELETE is not limited

  // ---- B. search: what the app sends ----
  console.log('\nB. GET /movies/search, one request');
  sent.length = 0;
  await attempt(() => fetchSearchMovies('dune', 1, undefined, base));
  console.log(`   request headers sent: ${JSON.stringify(sent[0]?.headers)}`);
  console.log('   (no X-Client-Id: the server can only count search by address, so the per-install search limit never applies)');

  // ---- C. search: the address limit (search: 180 per address) is reached ----
  console.log('\nC. GET /movies/search until the limiter refuses (address limit 180 a minute)');
  let admitted = 1; // B was the first
  let searchError: unknown;
  for (let i = 0; i < 400; i += 1) {
    const result = await attempt(() => fetchSearchMovies(`dune ${i}`, 1, undefined, base));
    if (!result.ok) {
      searchError = result.error;
      break;
    }
    admitted += 1;
  }
  console.log(`   requests admitted before the refusal: ${admitted}`);
  console.log(`   what the app sees:                    ${describe(searchError)}`);
  console.log(
    `   screen status the search hook derives: ${resolveMoviesViewStatus({
      enabled: true,
      isPending: false,
      isError: true,
      error: searchError,
      result: undefined,
    })}   (the "Search failed" EmptyState; isServerOverloadedError=${isServerOverloadedError(searchError)})`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
