# Matinee mobile

Matinee is a cinema ticket booking app: browse movies, pick seats on a seat map, pay, get a QR ticket. Built with React Native and Expo.

> GIF, Android download link and demo video link go here once they exist.

**Server repo:** https://github.com/Hennit-Dave/matinee-server

## Status

Slice 0: an Expo Router skeleton with a 3-tab layout (Home, Tickets, Account) themed from
`src/tokens/tokens.ts`, and a dev-only `/health` check screen proving the app can reach the server. No
real screens or features yet. This README is written as the build goes.

## Tech stack

React Native + Expo · TypeScript · TanStack Query · Zustand · Reanimated · expo-secure-store · Sentry

(Zustand, Reanimated, expo-secure-store and Sentry are decided but not installed yet — ADR 0006 defers
each native module to the slice that first needs it, so Expo Go covers slice 0.)

## How to run locally

```
npm install
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_URL` in `.env` to point at your running `matinee-server`.
How depends on the target:

- **Android emulator (recommended):** forward the server port over adb, then
  use `localhost`:
  ```
  adb reverse tcp:3000 tcp:3000
  ```
  `.env`: `EXPO_PUBLIC_API_URL=http://localhost:3000`. Re-run that `adb reverse`
  after every emulator cold start — Expo restores the Metro port (8081) itself,
  but not this one.
- **Fallback:** `http://10.0.2.2:3000` (the emulator's host-loopback alias)
  works on some machines without adb reverse, but not reliably on all.
- **Physical device:** must be `https`. `src/api/config.ts` allows plain http
  only to `localhost`, `127.0.0.1` and `10.0.2.2`, so a LAN IP such as
  `http://192.168.x.x:3000` is rejected by design.

The dev-only health screen at `/dev-health` confirms the app can reach the
server (it calls `GET /health`). It is not in the tab bar; while Expo is
running, open it with a deep link:
```
npx uri-scheme open "exp://<metro-host>:8081/--/dev-health" --android
```
Use the `exp://…` host Expo prints on start.

`npm run typecheck`, `npm run lint` and `npm test` (unit tests only — see
`.github/workflows/ci.yml`).

## Public environment variables

Every `EXPO_PUBLIC_*` variable is bundled into the app and readable by anyone.

| Variable | Why it is safe to expose |
|---|---|
| `EXPO_PUBLIC_API_URL` | The public address of the Matinee server. Not a secret. |

## Docs

- `AGENTS.md` — how AI agents work in this repo
- Full requirement checklist and decision records live in the server repo.

## Still to write

Problem it solves · how to run locally · architecture summary · key decisions · app store billing rules (Apple/Google in-app purchase) · what I'd do next

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

## Licence

MIT
