/**
 * AFTER probe for traffic slice 5d (mobile): the same server and the same questions as before-probe.ts, now answered by the app's NEW code.
 * It drives the real queue machine (waitingRoomMachine.ts) with real timers and the real `fetch` against the REAL merged matinee-server
 * (waiting room ON, room for ONE active user, one admission every 2 s), and runs the app's own classification and notice code.
 *
 *   npx tsx docs/evidence/traffic-5d/after-probe.ts <apiBase> <showtimeId> [shed]
 *
 * With `shed`, only section E runs: it expects the caller to have saturated the server (every request is answered 503 server_busy),
 * and to let it go again while the probe runs, so the busy screen's countdown and the automatic recovery can be watched.
 * Not part of the app and not imported by it.
 */
import { readClock, remainingMs } from '../../../src/api/holdClock';
import { acquireHold, classifyHoldError, releaseHold } from '../../../src/api/holds';
import { MovieApiError, isWaitingRoomRequiredError } from '../../../src/api/movies';
import { fetchShowtimeSeats } from '../../../src/api/seats';
import { holdOutcomeNotice } from '../../../src/api/seatNotices';
import { joinQueue, leaveQueue, pollQueue, withRequestTimeout } from '../../../src/api/waitingRoom';
import { createWaitingRoomController, type WaitingRoomState } from '../../../src/api/waitingRoomMachine';

const [baseArg, showtimeArg, modeArg] = process.argv.slice(2);
if (!baseArg || !showtimeArg) throw new Error('usage: after-probe.ts <apiBase> <showtimeId> [shed]');
const base: string = baseArg;
const showtimeId: string = showtimeArg;
const CLIENT = '5d5d5d5d-0000-4000-8000-00000000000a';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const started = Date.now();
const t = () => `+${((Date.now() - started) / 1000).toFixed(1).padStart(5)}s`;

function newMachine(clientId: string) {
  return createWaitingRoomController({
    join: () => withRequestTimeout((signal) => joinQueue(showtimeId, clientId, signal, base)),
    poll: () => withRequestTimeout((signal) => pollQueue(showtimeId, clientId, signal, base)),
    leave: () => withRequestTimeout((signal) => leaveQueue(showtimeId, clientId, signal, base)),
    now: readClock,
    schedule: (callback, delayMs) => {
      const timer = setTimeout(callback, delayMs);
      return () => clearTimeout(timer);
    },
    random: Math.random,
  });
}

function show(state: WaitingRoomState): string {
  const parts = [`phase ${state.phase}`];
  if (state.ahead !== null) parts.push(`ahead ${state.ahead}`);
  if (state.stale) parts.push('stale');
  if (state.rejoining) parts.push('rejoining');
  if (state.retry) parts.push(`countdown ${Math.ceil(remainingMs(state.retry, readClock()) / 1000)}s`);
  if (state.retrying) parts.push('retrying');
  if (state.admission) parts.push(`admission #${state.admission.id}${state.admission.waited ? ' (after waiting: "Your turn")' : ' (straight in)'}`);
  if (state.failure) parts.push(`failure ${state.failure.kind}`);
  return parts.join(', ');
}

/** Logs every change of what the screen would show. */
function watch(machine: ReturnType<typeof newMachine>, label: string): () => void {
  let last = '';
  return machine.subscribe(() => {
    const now = show(machine.getState());
    if (now !== last) console.log(`   ${t()}  ${label}: ${now}`);
    last = now;
  });
}

async function raw(method: string, clientId: string): Promise<string> {
  const res = await fetch(`${base}/showtimes/${showtimeId}/queue`, { method, headers: { 'X-Client-Id': clientId } });
  return res.text();
}

async function until(condition: () => boolean, limitMs: number): Promise<boolean> {
  const stop = Date.now() + limitMs;
  while (Date.now() < stop) {
    if (condition()) return true;
    await sleep(100);
  }
  return condition();
}

async function sectionsAtoD(): Promise<void> {
  // A. Empty room: the screen joins, is let straight in, and only then asks for the seat map (which now succeeds).
  console.log('A. the seat screen opens on an empty room');
  const a = newMachine(CLIENT);
  const stopA = watch(a, 'screen');
  a.start();
  await until(() => a.getState().phase === 'admitted', 5_000);
  const map = await fetchShowtimeSeats(showtimeId, undefined, base, CLIENT);
  console.log(`   ${t()}  seat map loaded with the pass: ${map.data.rows.length} rows (before: 403 waiting_room_required, "Couldn't load seats")`);
  const free = map.data.rows.flatMap((row) => row.seats).filter((s) => s.kind === 'standard' && s.status === 'available').map((s) => s.id);
  stopA();

  // B. Full room (room for 1): three other installs are ahead. The screen shows the line, counts it down, and lets us in.
  console.log('\nB. the room is full: 1 install inside and 2 waiting ahead of us');
  a.leave();
  await sleep(300);
  const others = ['5d5d5d5d-0000-4000-8000-0000000000b1', '5d5d5d5d-0000-4000-8000-0000000000b2', '5d5d5d5d-0000-4000-8000-0000000000b3'];
  for (const id of others) await raw('POST', id);
  const b = newMachine(CLIENT);
  const stopB = watch(b, 'screen');
  b.start();
  // The first install leaves after 3 s and the others each leave as soon as they are let in, so the line moves at the server's admission rate.
  const gone = new Set<string>();
  void (async () => {
    await sleep(3_000);
    await raw('DELETE', others[0]!);
    gone.add(others[0]!);
    while (gone.size < others.length && b.getState().phase !== 'admitted') {
      for (const id of others) {
        if (gone.has(id)) continue;
        const body = await raw('GET', id);
        if (body.includes('"admitted"')) {
          await raw('DELETE', id);
          gone.add(id);
        }
      }
      await sleep(700);
    }
  })();
  const turned = await until(() => b.getState().phase === 'admitted', 40_000);
  console.log(`   ${t()}  let in after waiting: ${turned && b.getState().admission?.waited === true}`);
  stopB();

  // C. The pass goes missing while the person is choosing seats. Continue is refused (403), the screen joins again by itself, and the hold is taken.
  console.log('\nC. the pass is lost, then Continue is pressed (the hold is refused, the screen re-joins, the hold is taken)');
  const stopC = watch(b, 'screen');
  await raw('DELETE', CLIENT); // the pass lapses (server side)
  const refused = await acquireHold(showtimeId, free.slice(0, 2), CLIENT, undefined, base).then(
    () => null,
    (error: unknown) => error
  );
  const failure = classifyHoldError(refused);
  console.log(`   ${t()}  Continue answered: ${refused instanceof MovieApiError ? `${refused.status} ${refused.kind}` : 'ok?'}; classifyHoldError says ${JSON.stringify(failure)}`);
  console.log(`   ${t()}  notice shown for it: ${JSON.stringify(holdOutcomeNotice({ id: 1, kind: 'needsPass' }, undefined))} (none: it is fixed silently)`);
  console.log(`   ${t()}  isWaitingRoomRequiredError: ${isWaitingRoomRequiredError(refused)}`);
  b.rejoin();
  await until(() => !b.getState().rejoining && b.getState().admission?.id === 2, 5_000);
  const held = await acquireHold(showtimeId, free.slice(0, 2), CLIENT, undefined, base).then(
    (h) => `held ${h.seatIds.length} seats, ${Math.round(h.expiresInMs / 1000)} s left`,
    (error: unknown) => `refused: ${String(error)}`
  );
  console.log(`   ${t()}  the hold, asked again once re-admitted: ${held}`);
  stopC();
  await releaseHold(showtimeId, free.slice(0, 2), CLIENT, undefined, base).catch(() => {});

  // D. The 9th seat: the cap, in the server's own numbers, as the Toast the person reads.
  console.log('\nD. the 9th seat (the per-install hold cap)');
  await acquireHold(showtimeId, free.slice(0, 8), CLIENT, undefined, base);
  const ninth = await acquireHold(showtimeId, [free[8]!], CLIENT, undefined, base).then(
    () => null,
    (error: unknown) => error
  );
  const limit = classifyHoldError(ninth);
  console.log(`   ${t()}  the app sees: ${ninth instanceof MovieApiError ? `${ninth.status} ${ninth.kind}, holdLimit ${JSON.stringify(ninth.holdLimit)}` : 'ok?'}`);
  console.log(`   ${t()}  classifyHoldError says: ${JSON.stringify(limit)}`);
  if (limit.kind === 'limitReached') {
    console.log(`   ${t()}  the Toast: ${JSON.stringify(holdOutcomeNotice({ id: 2, kind: 'limitReached', holdLimit: limit.holdLimit }, undefined))}`);
  }
  await releaseHold(showtimeId, free.slice(0, 8), CLIENT, undefined, base).catch(() => {});
  b.leave();
  await sleep(300);
}

async function sectionE(): Promise<void> {
  console.log('E. the server is saturated (503 server_busy on every request) when the screen opens, and is let go after about 16 s');
  const e = newMachine(CLIENT);
  const stop = watch(e, 'screen');
  e.start();
  const recovered = await until(() => e.getState().phase === 'admitted' || e.getState().phase === 'waiting', 60_000);
  console.log(`   ${t()}  recovered by itself, with no tap: ${recovered}`);
  stop();
  e.leave();
  await sleep(300);
}

async function main(): Promise<void> {
  if (modeArg === 'shed') await sectionE();
  else await sectionsAtoD();
}

main()
  .then(async () => {
    await raw('DELETE', CLIENT).catch(() => undefined);
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
