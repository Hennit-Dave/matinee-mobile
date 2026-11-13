# Handoff: glass NavBar (branch `feat/glass-navbar`)

## What changed
- **`NavBar`** (`src/components/NavBar.tsx`, spec in `docs/COMPONENTS.md` section 7): a floating pill, 56 tall
  with 4 padding (Figma `37:812`), `radius/full`, `border/default` hairline, `elevation/3`, 16 above the safe-area
  inset. Three items (Home, Tickets, Account), each at least 48 by 48, `size/icon-lg` icons, `type/caption`
  labels. Inactive items use `text/primary`; the active item is a filled `primary/default` pill with
  `text/on-primary`, so it never depends on what is behind it or on colour alone. Each item is a button with a
  label and a `selected` state.
- **Two materials.** Glass: an `expo-blur` `BlurView` with the `material/nav` tint over it. Solid:
  `surface/overlay`, no blur, same border and elevation.
- **It replaces the placeholder tab bar** (the default Expo Router bar with the broken box icons).
  `src/app/(tabs)/_layout.tsx` turns the default bar off (`tabBar={() => null}`) and draws the NavBar beside
  the screens. **This is not the navigator's `tabBar` prop**, on purpose; see "Android" below. Active item
  comes from `usePathname()`, a press calls `router.navigate`.
- **Icons:** `home`, `ticket`, `user` added to `Icon.tsx`, geometry from the Figma `Icons` frame (`17:2`).
- **Bottom clearance:** `useNavBarClearance()` (safe-area inset + gap + the 56 pill + a gap of breathing room).
  Home's list and its loading, empty and error states, and the Tickets and Account placeholders use it, so
  nothing hides behind the pill. The lists still run behind the pill; only their ends are padded.
- **Dependency:** `expo-blur ~58.0.6` (via `expo install`). It is in Expo Go's bundled native modules for SDK 58,
  so **no new EAS build is needed for development**.
- Pure logic with tests (`src/components/navBarLogic.ts`, 12 tests): material selection, active item from the
  path, the space the pill takes.

## Reduce Transparency
- iOS: `useReduceTransparency()` reads `AccessibilityInfo.isReduceTransparencyEnabled` and listens for
  `reduceTransparencyChanged`, so toggling the setting switches the bar to Solid live.
- Android has no such system flag, so it is never "on" there. Android falls back to Solid only where blur
  cannot be drawn: under API 31, or without a blur target.

## Android: real glass is ON
- `ANDROID_GLASS_ENABLED = true` in `navBarLogic.ts`. **Dave verified it smooth on a real Android 16 (API 36)
  phone.** The glass and Solid scroll recordings are attached to PR #16 (kept out of the
  repo on purpose; see `docs/evidence/glass-navbar/README.md`). The constant stays as a one-line switch: `false` draws Solid on Android
  everywhere.
- **Why this changed.** This PR first shipped Android Solid, because on the API 37 emulator glass made Home's
  list measurably worse (about 92% janky frames and 167 to 200 missed vsyncs in two of three warm runs, against
  about 69% and at most 22 for Solid). The emulator was already janky with Solid and is not representative
  hardware, and the real-phone check overturned the result. The emulator numbers are kept in the evidence README
  as history, not as a finding about devices.
- **Why the NavBar is beside the navigator, not its `tabBar`:** the first attempt (NavBar as `tabBar`, target
  around the navigator) put the `BlurView` inside the view it blurs. That recurses in `libhwui` until the render
  thread's stack overflows: a native crash. Expo Router cannot wrap only the screens, so the default bar is off
  and the NavBar is drawn as a sibling of the `BlurTargetView`. Details in the evidence README.
- Solid on Android remains the fallback below API 31, or if the blur target is missing.

## Unproven
- **Android devices beyond one.** Glass was verified smooth on one real phone (Android 16, API 36, a 720 by
  1600 screen). Other devices, older Android versions (API 31 to 35) and slower phones are untested; Solid is the
  fallback below API 31 and the constant is the switch if a device needs it.
- **iOS beyond one screenshot:** real glass was seen on the iPhone 17 simulator in light mode only. Dark-mode
  glass, the Reduce Transparency toggle, and scroll smoothness on iOS were not exercised.
- **Blur strength and tint** were tuned by eye on iOS, not measured against the Figma frames.
- The movie data in the evidence is a stub, not the real server.

## Deferred
- **Hiding the NavBar on Seat selection and Checkout:** those screens do not exist yet. They will be pushed
  stack screens outside the `(tabs)` group, so they will not show the bar. Nothing to build now.
- **Movie detail navigation:** `MovieCard` `onPress` is still a no-op.
- **Component gallery:** NavBar is not in it yet (the gallery itself is not built).

## Next
- **Movie detail + Showtimes** slice.
- **ADR 0006 needs an `expo-blur` row** in its native-module table (runs in Expo Go: yes). It lives in the
  server repo (`matinee-server/docs/decisions/`), so it is a small docs PR there; I did not make it.
- The README's stack line still calls Reanimated "decided but not installed"; it was installed in the Browse slice.
