# Handoff: the waiting room, the busy screen and the seat cap, mobile side (branch `feat/waiting-room-mobile`)

Traffic slice 5d, mobile only (the third and last part). It uses the server from matinee-server PR #25 (hold caps, ADR 0018, `b9e0df0`) and PR #26 (waiting room + load shedding, ADR 0017, `0f4f92f`), both squash-merged. Built as the approved 5d plan's section 9 lays out, with your four amendments (D3 copy, D4 position only, D8 overload on the booking funnel only, D9 `X-Client-Id` required). Hand-written contract, no zod. No new dependency, environment variable, migration, service or **native build** (the new haptic is `expo-haptics`, already in). `tokens.ts`, `.env` and `LEARNING-LOG.md` untouched.

## A deliberate Figma deviation (D3), flagged as you asked

Figma `56:6607` says "Your place is held. You can lock your phone; we'll tell you when it's your turn." That promises a push notification the app does not send (a new native module, an FCM credential and a server job: a later enhancement). The note reads instead: **"Your place is held. Keep Matinee open and we'll move you the moment it's your turn."** Recorded in `COMPONENTS.md`, in the component's comment, and pinned by a test that fails if the Figma wording comes back.

## What changed

- **Contract, hand-written** (`src/api/waitingRoom.ts`, `movies.ts`, `holds.ts`): `QueueState` is `admitted | waiting | not_queued` with type guards that reject nonsense (a negative place, a poll delay of NaN); `joinQueue`, `pollQueue`, `leaveQueue`. `waiting_room_required`, `hold_limit_reached`, `server_busy` and `waiting_room_full` join `ApiErrorCode`; a `hold_limit_reached` body's `scope`, `limit` and `held` are read defensively. `classifyHoldError` gains `needsPass` (nothing held), `limitReached` (nothing held) and `busy` (a shed or timed-out call, so the seats MAY be held, like a 503).
- **The queue machine** (`waitingRoomMachine.ts`, pure, injected like `holdMachine`): join, poll after the server's `pollAfterMs` (floored at 1 s, capped at 30 s, jittered 20%), pause in the background and refresh on return, keep the place through two failed polls and show the third, a quiet re-join after a 403 or a `not_queued`, leave on unmount (also covers a join still in flight). `useWaitingRoom` binds it; every call has a 10 s timeout.
- **`WaitingRoomView`** (Figma `56:6729`: default, skeleton, light, dark, 1.3x) and **`OverloadedState`** (Figma `107:15558`, `107:15536`), with gallery entries and `COMPONENTS.md`. `EmptyState` gains `footnote`, `actionLoading` and `iconSize`; `Icon` gains `xl` (48, `space/12`, no new token); `useClockSeconds` counts a `Retry-After` down with the seat-hold clock rules.
- **The seat screen** gates behind the queue: the waiting view (or its skeleton) until admitted, then the map and the polling. A 403 from the map re-joins quietly; a 403 on Continue re-joins and then takes the hold. A busy server shows `OverloadedState` with a countdown on the seat screen and in the waiting room. Back, swipe and **Leave the queue** leave. A success pulse and a "Your turn" Toast on admission after waiting; a "You can hold up to 8 seats for one showing." Toast for the 409.
- **Touched outside the new files, for you to look at:** `useSeats.ts` (an `enabled` option, and an `overloadClock` it returns), `showtimes.tsx` (the link now passes a `showing` param so the waiting room can show the day, time and format before the map exists), `seatNotices.ts` (`holdOutcomeNotice` can now return `null`, because a missing pass is fixed silently), `seats.ts` (`quietRejoinStatus`), `haptics` (`success()`).

## Decisions I made that you may want to change

- **Two failed polls are kept quiet, the third is shown** (`TOLERATED_FAILURES`), the same rule as the seat map's three. An overloaded server answering the **join** is shown at once: there is no place to keep, and the countdown is the retry. A 429 on the queue is treated like "very busy".
- **A request timeout of 10 s on every queue call** (`QUEUE_REQUEST_TIMEOUT_MS`). React Native's `fetch` has none, so a hung poll would never count as a failure and the person would watch a number that stopped being true while the server forgot them after 90 s. Found while trying to simulate a dropped connection on the device: cutting the app's route to the server changed nothing (a live connection survives), which is how a hung one would behave. **The seat-map poll, the hold calls and the release have no timeout either** (unchanged, 5b): the same failure mode, not fixed here.
- **"You're next"** for 0 ahead (no Figma frame; `type/title-lg` in the number's place, because 64-point "You're next" wraps). **"Trying to update..."** for the freshness line while polls fail (Figma's "Updated just now" would be untrue). **"Your turn"** as the Toast (the brief's words). **"We're very busy right now. Try again in a moment."** as a Toast when a HOLD is shed (the busy screen would throw the picks away). All four have no frame.
- **The cap's wording** takes the limit from the server's answer. The address cap (16) reads "Too many seats are held from this connection for one showing." with no number, because a person cannot act on it. A body the app cannot read says "You've reached the most seats you can hold for one showing."
- **Leave the queue on a deep link with nothing beneath it goes home** (`router.replace('/')`) rather than doing nothing.
- **A 403 for a person the room has let in is drawn as the loading state**, not the error, and every re-admission after the first refetches the map (see the bug below).

## A bug the device run found

Saturating the server for more than 30 s made the pass lapse (the heartbeat polls were refused). After the server was let go, the first seat request got a 403 and the app re-joined 1.3 s later, but the screen stayed on "Couldn't load seats / Join the waiting room before choosing seats for this showing." for good: polling had stopped after three failures, so nothing asked for the map again, and the 403 was drawn as an error. Fixed in `b4cbbd0` (`quietRejoinStatus`, refetch on re-admission), unit-tested for the status; re-run on the device: 403 at 03:02:28.467, re-join at :29.236, the map asked for again at :31.981, polling resumed. `device-run.txt` section 8 has the sequence.

## What passed

- `npm run typecheck`, `npm run lint`: clean. `npm test`: **421 passed, 0 failed** (302 on main + 119 new). **Every commit passes on its own** (302, 348, 403, 411, 416, 420, 421): `after.txt`.
- **The tests can fail.** `mutation-checks.txt`: 23 deliberate breakages (a negative place accepted, no poll floor, no jitter, a missing pass called "maybe held", the cap hardcoded to 8, a shed hold not waiting, three quiet failures instead of two, polling in the background, no refresh on return, no "Your turn", leaving a join in flight, a lost place not re-joined, a retry that joins instead of polls, Retry-After ignored, a 429 not treated as busy, a missing showing retried, a timeout that never fires, a timer not cleared, a 403 drawn as an error, the wrong pulse, a notification promise, "people" for one). **21 of 23 on the first run; the two that got through exposed a weak test and a test that hung, both fixed; 23 of 23 on the final run.**
- **Against the real server** (`before.txt`, `after.txt`): before, every answer was a dead end; after, the machine joins, waits with `ahead` 2, 1, 0 in real time and is admitted "after waiting", a lapsed pass is re-joined silently and the hold taken, the cap comes back in the server's numbers, and a saturated server gets a busy countdown, automatic retries and recovery with no tap.
- **On the device** (`device-run.txt`, 20 screenshots, light, dark and 1.3x): the server's request log is the oracle for each. Highlights: a restart that wiped the room under an open screen was re-joined in 301 ms with nothing visible; 11 people ahead at 3 s polls; no request for 25 s in the background; Leave sends one DELETE; admission 0.3 to 0.55 s before the first seat request (the server gives 15 s); the busy screen on a real shed, restarting its countdown, and recovering by itself; the place kept through two refused polls; a pass lost while Continue was pressed re-joined and held in about 130 ms; the 409 Toast.
- `gitleaks`: no leaks. No AI attribution in any commit.

## Unproven

- **iOS, a real phone, TalkBack and VoiceOver.** The waiting screen reads one sentence for the place ("128 people ahead of you", announced politely); nobody listened to it.
- **The haptic.** An emulator cannot show it. `haptics.success()` is the tested wrapper.
- **A real line of 128** and the server's slow end (`pollAfterMs` 15 s). The run used 11 and 3 s. The bounds (1 to 30 s) are unit-tested.
- **The dark busy screen** (`107:15536`) and **the skeleton on a real join** (a join answers in 10 to 80 ms; the gallery shows it).
- **The pass heartbeat under a slow first map load.** On this emulator in a dev build the first seat-map response takes about 7 s to reach JavaScript (6.9 s on `main`, 7.4 s here; the server answers in 12 to 24 ms and sees the request 0.3 to 0.55 s after admission), so the 15 s claim window is met by the request, not the render. Not a regression, not measured on a release build.
- **System back from the root screen** exits to the launcher without unmounting, so no leave is sent; the pass lapses by itself within 30 s (the server's safety net). Not changed here.
- **Hook wiring is not unit-tested** (no React Native renderer, ADR 0005): `useWaitingRoom`, `useClockSeconds` and the seat screen's effects are shown by the device runs; every decision inside them is a tested pure function.

## Ship together

A server with `WAITING_ROOM_ENABLED=true` and the OLD app is a dead end for every booking (`before.txt`); this PR is what makes the room usable. If the server is deployed before this app ships, keep `WAITING_ROOM_ENABLED=false` until it does.

## Carry-forwards

- **`WAITING_ROOM_MAX_ACTIVE` defaults to 2, a DEMO value, and MUST be raised for production in the deploy slice** (server ADR 0017, README, `.env.example`, the `waiting_room_demo_defaults` boot warning). With 2 inside, a real crowd queues behind two people.
- **Push** ("we'll tell you when it's your turn") is a later enhancement: a native module, an FCM credential and a server job. Until then the copy asks people to keep the app open.
- **5e:** the k6 load test (500 users from one address meets the waiting room and the limits; it needs the `loadtest` profile), `TRAFFIC.md`, `SHARDING.md`.
- **Deploy slice:** `verify-client-ip.sh` against the real Railway edge (5c carry-forward). **A timeout on the seat-map poll and the hold calls**, the same gap fixed here for the queue.

## Next

Payments (Figma Checkout `60:12130` shows the SAME hold's countdown, so lift the hold controller above the screens and do not release on forward navigation). Note that the waiting-room pass is also released when the seat screen unmounts, so a checkout screen pushed on top will need the pass kept alive (the heartbeat is the seat-map poll, which pauses under another screen).
