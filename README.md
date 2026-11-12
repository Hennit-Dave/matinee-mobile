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
cp .env.example .env   # fill in EXPO_PUBLIC_API_URL, e.g. http://10.0.2.2:3000 for an Android emulator
npm start               # opens Expo Go / the Metro bundler
```

`npm run typecheck`, `npm run lint` and `npm test` (unit tests only — see `.github/workflows/ci.yml`).

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
