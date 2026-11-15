# Handoff: Hidden component gallery (branch `feat/component-gallery`)

The living style guide required by RULES.md D3.4: every component in the library, in every state, in light and dark, with mock data and no network. Self-contained: no data model, no server, no new native dependency (so no new EAS build).

## What changed
- **Route:** [gallery.tsx](../../src/app/gallery.tsx), registered in the root layout. It is not linked from the app. Open it by its path: `matinee://gallery` in a dev build, or `exp://<host>:8081/--/gallery` in Expo Go (for example `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081/--/gallery" host.exp.exponent`). It is available in every build, not only `__DEV__`, because the submission needs it.
- **Sections** live in [src/gallery/](../../src/gallery/) (outside `src/app/`, so they are not routes), in the order of the Figma Gallery page (`73:3973`):
  - Typography: all 9 `Text` variants, text colours, on-fill colours, status colours, tabular figures.
  - Icons: all 10 icons at sm / md / lg, and the colour tokens.
  - Buttons: primary / secondary / text × default, disabled, loading, plus `fullWidth`.
  - Cards and posters: `MovieCard` (3 layouts × image, no poster, long title), `SearchResultRow` (4 cases), `HeroBackdrop` (loaded, fallback after a failed image, no image, loading).
  - Selection and labels: `Chip` default / selected / disabled "Sold out", plus interactive date and time pickers.
  - Input: default, filled, focused, error, disabled, search with a value and clear, search empty.
  - Feedback: `Skeleton` (4 shapes) and `EmptyState` (plain, info, error with a secondary action).
  - Navigation and sheets: `NavBar` (3 active × glass and solid), `BottomSheet` (standard and destructive patterns, opened from buttons).
  - Motion: `CrossfadeStack` with a swap button.
- **Light and dark:** System / Light / Dark chips at the top use the platform's own override (`Appearance.setColorScheme`), so no theme or component code changed. The gallery hands control back to the device setting when it closes.
- **Mock posters** are tiny generated PNGs held as data URIs in [posterImages.ts](../../src/gallery/posterImages.ts), so there is no network and no asset file. The design's `poster/*` colours are not in `tokens.ts`, so no raw colour values appear in styles.
- **Coverage is enforced.** [registry.ts](../../src/gallery/registry.ts) lists what each section covers, and [registry.test.ts](../../src/gallery/registry.test.ts) fails CI if a component is exported from `src/components/index.ts` without a gallery entry, if the gallery lists something that is not exported, or if a "planned" component has been built. `gallery.tsx` types its section map over the registry ids, so a section cannot be listed without being rendered.
- **Docs ([COMPONENTS.md](../COMPONENTS.md)):** new section 13 (how to open it and the rule that a component is not done until it is in the gallery); a `HeroBackdrop` entry (the #19 gap, now closed); and the `SearchResultRow` entry moved from the end of the file (under "12. Not components") into "3. Cards and posters".

## Not in the gallery, and why
- **`Badge` does not exist in code.** The brief asks for it, and it is specified in COMPONENTS.md and drawn in Figma, but it has not been built. The same is true of `Card`, `QRCode`, `Switch`, `ListRow`, `Toast`, `Countdown`, `Seat` and `SeatMap`. Rather than fake them, the gallery lists all nine at the bottom as "not built yet", and the registry test makes each one move into a real section the moment it is built. Building `Badge` is its own small slice.

## Not touched
`tokens.ts`, `LEARNING-LOG.md`, every library component, the theme, Home, Search, Movie detail.

## What passed
- `npm run typecheck`, `npm run lint`
- `npm test`: 69 passed, 0 failed (4 new, all in `registry.test.ts`)
- `gitleaks git .`: no leaks
- No raw colour or numeric style values in the gallery code (scanned); everything is a token.
- On an Android emulator (Pixel_10a, Expo Go), against a running Metro, no network or server. Evidence in [docs/evidence/component-gallery/](../evidence/component-gallery/).
  - The whole page, scrolled end to end in light (18 screens) and dark (22 screens).
  - The System / Light / Dark chips switch the app live, and System restores the device setting.
  - Jump chips scroll to their section (this found a bug, now fixed: the heading landed under the sticky header).
  - Both BottomSheet patterns open from their buttons, show the right actions, close from the primary action, and close from the system back action.
  - The CrossfadeStack demo swaps its slides.
  - The accessibility tree carries the labels (`Theme: Dark`, `Jump to <section>`, `Open standard sheet`, and so on).
  - A first run also caught two demo bugs, both fixed: the swap slide collapsed to a narrow box, and its title was unreadable on a dark scrim.

## Unproven / known limits
- Pressed and focused cannot be drawn statically, so the gallery tells you how to see them (press and hold, tap a field). They were exercised by hand, not captured.
- The glass NavBar was checked on an Android emulator only (software-rendered, so it says little about blur performance). iOS was not run.
- The six NavBar demos each hold their own blur view, which is heavier than a real screen. It is a developer screen, but worth knowing on a low-end phone.
- Reduce-motion is read once at app start (Reanimated), so the Motion demo's "reduce-motion is on/off" line only changes after a restart.
- Not tested with TalkBack. Interactive controls carry labels (`Theme: Dark`, `Jump to <section>`, and so on) and section titles are headers, as the accessibility tree shows.
- Mock film names are invented. No real film art is used.

## Next
- **Dave:** review and squash-merge. After that, build `Badge` (and the other eight) as their own slices; each lands with a gallery entry.
