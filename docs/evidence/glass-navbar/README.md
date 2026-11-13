# Evidence: glass NavBar (branch `feat/glass-navbar`)

| File | What it shows |
|---|---|
| `before-android-placeholder-tabbar.png` | `main` before this slice: Expo Router's default tab bar with broken box icons, flat, no active-item treatment. The baseline commit. |
| `ios-glass-home-light.png` | **iOS simulator (iPhone 17, Expo Go): real glass.** The poster gradients behind the bar are frosted under the `material/nav` tint; Home is the filled pill. |
| `android-solid-home-light-list-end.png` | **Android emulator: the Solid material** (now the fallback state on Android).  Home scrolled to the end: the last row (title and year) clears the pill. |
| `android-solid-tickets-active-light.png` | Tapping Tickets switches screens and moves the filled pill. |
| `android-solid-home-dark-text-1.5x.png` | Dark mode (designed Solid, light active pill) at 1.5× system text: labels stay readable and the pill grows upward by about 10 px. |
| `android-glass-experiment-crop.png` | **Android emulator: real blur.** The poster edges and checkerboard under the bar are smoothly diffused. |
| `android-solid-scroll.mp4` | **Real Android phone: the Solid bar** (12.0 s). Home scrolling over real movie posters. |
| `android-glass-scroll.mp4` | **Real Android phone: the glass bar** (41.4 s). Home scrolling with the posters blurred behind the bar, switching to Account and back, and opening Search. This is the recording behind turning Android glass on. |

## Real-phone recordings

Dave recorded both clips on a real Android 16 (API 36) phone (720 by 1600 screen) and judged the glass
bar smooth. The movies are real titles with real posters, not the stub used for the emulator screenshots below. They are the evidence for
`ANDROID_GLASS_ENABLED = true`.

Both were **trimmed at the end and nothing else was changed** (no re-encode; same video and audio streams). The
originals finish by pulling down Android's Quick Settings panel to stop the recording, and that panel shows the
phone's Wi-Fi network name, which should not go in a public repo. The last 2.8 s of the Solid clip (14.8 s to 12.0 s)
and 1.9 s of the glass clip (43.3 s to 41.4 s) were cut, ending on the app. The audio tracks are digital
silence. The untrimmed originals stay with Dave.

## Emulator screenshots

The movie data in the emulator screenshots is a throwaway stub (24 fictional movies with generated gradient
posters), not the real server and not TMDB. Android was reached with `adb reverse`; the emulator's own
`10.0.2.2` route did not carry the app's sockets on this API 37 image. No `.env` was read or written
(`EXPO_PUBLIC_API_URL` was overridden inline).

## Earlier emulator scroll measurements (history; not representative of real hardware)

These made this PR first ship Android Solid. A real phone then showed glass smooth (above), so they are kept
only to show what was measured and why it did not carry over.


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
- At the time this was a guardrail decision (fall back to Solid on Android if glass makes Home's list janky).
  It was then checked on a real phone, where glass was smooth, so Android glass is on. The gap on the emulator
  was a property of that emulator's rendering, not of the blur on devices.

## What the first attempt taught (kept so nobody repeats it)

Rendering the NavBar as the navigator's `tabBar`, with the `BlurTargetView` around the whole navigator,
crashed Expo Go natively: `SIGSEGV` on `RenderThread`, "stack pointer is not in a rw map; likely due to
stack overflow", a 512-frame-deep loop of `RenderNode::prepareTreeImpl` / `SkiaDisplayList::prepareListAndChildren`
in `libhwui`. The `BlurView` was inside the view it blurs, so its own display list contained itself. Also,
`expo-blur`'s `BlurView` reads `blurTarget.current` once at mount, so a target that is an ancestor is not
attached yet and the blur silently stays off. The working structure puts the NavBar beside the target.
