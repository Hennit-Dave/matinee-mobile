# Evidence: glass NavBar (branch `feat/glass-navbar`)

| File | What it shows |
|---|---|
| `before-android-placeholder-tabbar.png` | `main` before this slice: Expo Router's default tab bar with broken box icons, flat, no active-item treatment. The baseline commit. |
| `ios-glass-home-light.png` | **iOS simulator (iPhone 17, Expo Go): real glass.** The poster gradients behind the bar are frosted under the `material/nav` tint; Home is the filled pill. |
| `android-solid-home-light-list-end.png` | **Android emulator: the shipping Solid material.** Home scrolled to the end: the last row (title and year) clears the pill. |
| `android-solid-tickets-active-light.png` | Tapping Tickets switches screens and moves the filled pill. |
| `android-solid-home-dark-text-1.5x.png` | Dark mode (designed Solid, light active pill) at 1.5× system text: labels stay readable and the pill grows upward by about 10 px. |
| `android-glass-experiment-crop.png` | **Android real blur, switched off in the app.** The poster edges and checkerboard under the bar are smoothly diffused. This is what turning `ANDROID_GLASS_ENABLED` on draws. |

The movie data in these screenshots is a throwaway stub (24 fictional movies with generated gradient
posters), not the real server and not TMDB. Android was reached with `adb reverse`; the emulator's own
`10.0.2.2` route did not carry the app's sockets on this API 37 image. No `.env` was read or written
(`EXPO_PUBLIC_API_URL` was overridden inline).

## Why Android ships Solid: scroll measurements

Home scrolled up and down 10 times each (`scroll_run.sh`, via `adb input swipe`), frame stats from
`dumpsys gfxinfo host.exp.exponent` reset before each run. Pixel_10a emulator (API 37, software-ish GPU),
Expo Go 58.0.5, dev mode. A warm-up pass was discarded, then three runs per material, the only change
between them being `ANDROID_GLASS_ENABLED`.

| Run | Material | Frames | Janky | Median | 90th | 99th | Missed vsync |
|---|---|---|---|---|---|---|---|
| 1 | Solid | 349 | 69.3% | 32 ms | 65 ms | 85 ms | 14 |
| 2 | Solid | 357 | 69.2% | 46 ms | 69 ms | 93 ms | 22 |
| 3 | Solid | 360 | 67.8% | 32 ms | 65 ms | 77 ms | 4 |
| 1 | Glass | 299 | 92.0% | 81 ms | 93 ms | 109 ms | 200 |
| 2 | Glass | 324 | 80.6% | 29 ms | 44 ms | 85 ms | 7 |
| 3 | Glass | 294 | 92.5% | 81 ms | 93 ms | 121 ms | 167 |

Reading it honestly:
- The emulator is **already janky with Solid** (about 69%), so the absolute numbers say nothing about a
  real phone. Only the difference matters.
- Glass is **worse in two of three runs** (fewer frames delivered, 167 to 200 missed vsyncs against at
  most 22) and about equal in one. The run-to-run spread is large, which is why there are three.
- Two earlier, un-warmed runs agreed in direction: Solid 69% and 68%, Glass 94% and 78%.
- This is a guardrail decision (fall back to Solid on Android if glass makes Home's list janky), not a
  proof that glass is slow on hardware. **It has not been tried on a real Android phone.** Flip
  `ANDROID_GLASS_ENABLED` to `true` in `src/components/navBarLogic.ts` and run Expo Go on a phone to judge
  it; nothing else needs to change.

## What the first attempt taught (kept so nobody repeats it)

Rendering the NavBar as the navigator's `tabBar`, with the `BlurTargetView` around the whole navigator,
crashed Expo Go natively: `SIGSEGV` on `RenderThread`, "stack pointer is not in a rw map; likely due to
stack overflow", a 512-frame-deep loop of `RenderNode::prepareTreeImpl` / `SkiaDisplayList::prepareListAndChildren`
in `libhwui`. The `BlurView` was inside the view it blurs, so its own display list contained itself. Also,
`expo-blur`'s `BlurView` reads `blurTarget.current` once at mount, so a target that is an ancestor is not
attached yet and the blur silently stays off. The working structure puts the NavBar beside the target.
