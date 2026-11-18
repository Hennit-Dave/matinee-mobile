/**
 * BASELINE probe for traffic slice 5d (mobile). It runs the app's request code exactly as it is on `main` against the REAL merged
 * matinee-server (PRs #25 and #26: the waiting room, the hold caps and load shedding) over a throwaway Redis and Postgres, with the
 * waiting room ON, and prints what the app makes of each answer the new server can give.
 *
 *   npx tsx docs/evidence/traffic-5d/before-probe.ts <apiBase> <showtimeId>
 *
 * It only calls the app's own functions (plus plain fetches to set up a pass). Not part of the app and not imported by it.
 */
import { acquireHold, classifyHoldError, releaseHold } from '../../../src/api/holds';
import { MovieApiError } from '../../../src/api/movies';
import { fetchShowtimeSeats, isStaleRefresh, resolveSeatsViewStatus } from '../../../src/api/seats';

const [baseArg, showtimeArg] = process.argv.slice(2);
if (!baseArg || !showtimeArg) throw new Error('usage: before-probe.ts <apiBase> <showtimeId>');
const base: string = baseArg;
const showtimeId: string = showtimeArg;
const CLIENT = '5d5d5d5d-0000-4000-8000-00000000000a';

function describe(error: unknown): string {
  if (!(error instanceof MovieApiError)) return `not a MovieApiError: ${String(error)}`;
  return JSON.stringify({ status: error.status, kind: error.kind, retryable: error.retryable, retryAfterSeconds: error.retryAfterSeconds ?? null, message: error.message });
}
async function attempt<T>(run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error };
  }
}
async function main(): Promise<void> {
  // A. The seat map, as the seat screen asks for it, with NO pass (the app has no waiting room, so it never joins).
  console.log('A. GET /showtimes/:id/seats with no pass (the current app never joins the line)');
  const map = await attempt(() => fetchShowtimeSeats(showtimeId, undefined, base, CLIENT));
  if (map.ok) {
    console.log('   (the map loaded: the waiting room is not on)');
  } else {
    console.log(`   what the app sees:       ${describe(map.error)}`);
    const status = resolveSeatsViewStatus({ enabled: true, isPending: false, isError: true, error: map.error, result: undefined });
    console.log(`   the seat screen shows:   status "${status}" -> the "Couldn't load seats" EmptyState with the server's raw sentence and a Try again that fails the same way`);
  }

  // B. A hold with no pass.
  console.log('\nB. POST /holds with no pass');
  const seatIds = ['00000000-0000-4000-8000-000000000001'];
  const hold = await attempt(() => acquireHold(showtimeId, seatIds, CLIENT, undefined, base));
  if (!hold.ok) {
    console.log(`   what the app sees:       ${describe(hold.error)}`);
    console.log(`   classifyHoldError says:  ${JSON.stringify(classifyHoldError(hold.error))}`);
  }

  // C. With a pass (set up with a plain request), the 9th seat: the hold cap.
  console.log('\nC. a pass, then 8 seats held, then a 9th seat (the per-install hold cap)');
  await fetch(`${base}/showtimes/${showtimeId}/queue`, { method: 'POST', headers: { 'X-Client-Id': CLIENT } });
  const okMap = await fetchShowtimeSeats(showtimeId, undefined, base, CLIENT);
  const free = okMap.data.rows.flatMap((row) => row.seats).filter((s) => s.kind === 'standard' && s.status === 'available').map((s) => s.id);
  const first = await attempt(() => acquireHold(showtimeId, free.slice(0, 8), CLIENT, undefined, base));
  console.log(`   8 seats:                 ${first.ok ? 'held' : describe(first.error)}`);
  const ninth = await attempt(() => acquireHold(showtimeId, [free[8]!], CLIENT, undefined, base));
  if (!ninth.ok) {
    console.log(`   the 9th seat, the app sees: ${describe(ninth.error)}`);
    console.log(`   classifyHoldError says:  ${JSON.stringify(classifyHoldError(ninth.error))}`);
  }
  await attempt(() => releaseHold(showtimeId, free.slice(0, 8), CLIENT, undefined, base));
  await fetch(`${base}/showtimes/${showtimeId}/queue`, { method: 'DELETE', headers: { 'X-Client-Id': CLIENT } });

  // D. What a 503 server_busy would mean to the seat map (the unit of "very busy"): built from the app's own error class.
  console.log('\nD. a shed request (503 server_busy with Retry-After 12) as the app reads it');
  const busy = new MovieApiError('We are very busy right now. Please try again shortly.', { status: 503, kind: 'server_busy' as never, retryAfterSeconds: 12 });
  console.log(`   classifyHoldError says:  ${JSON.stringify(classifyHoldError(busy))}`);
  console.log(`   seat map status:         "${resolveSeatsViewStatus({ enabled: true, isPending: false, isError: true, error: busy, result: undefined })}" (the plain "Server overloaded" EmptyState: no countdown, nothing retries by itself)`);
  console.log(`   stale-map rule applies:  ${isStaleRefresh({ isError: true, error: busy, result: undefined, consecutiveFailures: 1 })}`);
}
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
