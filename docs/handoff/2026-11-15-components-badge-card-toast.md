# Handoff: Badge, Card, Toast (branch `feat/components-badge-card-toast`)

Builds the three remaining components the brief requires (RULES.md D3.1: Button, Text, Card, MovieCard, Input, Chip, Badge, BottomSheet, Skeleton, Toast, EmptyState, SeatMap). Built **from the Figma frames**, pulled with the Figma MCP: Badge `17:134`, Card `18:2`, Toast `18:94` (file `76VKO0l9gGt5YMNYtH8yvM`). No new native dependency, so no new EAS build.

## What changed
- **`Badge`** ([Badge.tsx](../../src/components/Badge.tsx), tone table in [badgeLogic.ts](../../src/components/badgeLogic.ts))
  - 5 tones (`neutral`, `success`, `warning`, `error`, `info`), default `neutral`; `label`; optional `accessibilityLabel`.
  - Outline plus `caption` label, `space/1` × `space/2` padding, `radius/sm`, `border-width/default`. Not interactive: one accessible element, role `text`.
- **`Card`** ([Card.tsx](../../src/components/Card.tsx))
  - `title`, `body`, optional `children` (the slot, below the body). `surface/raised`, `border/default`, `radius/lg`, `space/4` padding, `space/2` gap. `elevation/1` shadow (transparent in dark, where the surface and hairline show height).
- **`Toast`, `ToastProvider`, `useToast`** ([Toast.tsx](../../src/components/Toast.tsx), [ToastProvider.tsx](../../src/components/ToastProvider.tsx), [toastLogic.ts](../../src/components/toastLogic.ts))
  - `Toast` is the visual: 3 tones (`info`, `success`, `error`), each with its own icon shape, a message, and an optional text action (a `Button` text variant).
  - `ToastProvider` is mounted once in the root layout. `useToast()` gives `show({ message, tone?, action?, duration?, bottomOffset? })` and `dismiss()`. One toast at a time; a new one replaces the current one and restarts the timer. Self-contained: no data model, nothing stored.
  - Auto-dismiss: 4 s for a plain message, 6 s for an error or a toast with an action; an explicit `duration` is never below 2 s. Pressing the action runs it and dismisses.
  - `bottomOffset` lets a screen with its own footer keep the toast off the main button. The default sits one gap above the floating NavBar.
  - Accessibility: icon and message are one spoken unit with the tone first ("Error. Payment failed."). Android uses a polite live region, iOS an explicit announcement. Reduce-motion: no animation.
- **Gallery:** all three moved out of `PLANNED_COMPONENTS` and into real sections with every state: `Card` (cinema card, long text, ticket row with a Badge, slot with an action) under Cards and posters; `Badge` (all tones, default, long label, beside a title) under Selection and labels, after `Chip`; `Toast` (all tones, with and without an action, a long message, plus live buttons that use `useToast`) under Feedback. `registry.test.ts` stays green; 6 components are still honestly listed as not built (QRCode, Switch, ListRow, Countdown, Seat, SeatMap).
- **Docs:** `Card`, `Badge` and `Toast` entries in [COMPONENTS.md](../COMPONENTS.md) have a "Built" note; the gallery section's not-built list is updated.
- **Root layout:** wraps the app in `ToastProvider` (one line pair in `src/app/_layout.tsx`).
- **Tests:** [src/tokens/contrast.ts](../../src/tokens/contrast.ts) (a pure WCAG helper), `badgeLogic.test.ts`, `toastLogic.test.ts`. They check that every Badge tone's label meets 4.5:1 on `surface/default`, `raised` and `overlay` in light and dark; that each Toast icon is at least 3:1 on `surface/overlay` and the message 4.5:1; that each tone has a distinct icon; the duration rules; the spoken text; and the dismiss timer (mock timers: fires once, and cancel stops it).

## Not touched
`tokens.ts`, `LEARNING-LOG.md`, the existing components, the theme, Home, Search, Movie detail.

## What passed
- `npm run typecheck`, `npm run lint`
- `npm test`: 114 passed, 0 failed (45 new)
- `gitleaks git .`: no leaks
- No raw colour or numeric style values in the new code (scanned); the only literals are `left: 0` and `right: 0` for absolute positioning, as in the NavBar.
- On an Android emulator (Pixel_10a, Expo Go, against a running Metro, no server). Evidence in [docs/evidence/components-badge-card-toast/](../evidence/components-badge-card-toast/).
  - Card, Badge and Toast match their Figma frames, in light and dark (Card: shadow in light, hairline in dark).
  - Live toast through `useToast`: it appears above the content and auto-dismisses (plain message about 4 s, error and action toasts about 6 s).
  - A second toast replaces the first (one live toast at a time).
  - The action runs its callback (the caption changed to "Retry") and dismisses the toast.
  - An untouched action toast dismisses itself.
  - Timing was read from the accessibility tree, whose dumps take a few seconds, so durations are accurate to about a second; the exact values are covered by the unit tests.

## Unproven / known limits
- Checked on an Android emulator only. iOS and a real phone were not run, so the iOS announcement path (`announceForAccessibility`) is untested, and so is TalkBack's reading of the Android live region.
- Toast motion (rise in, drop out) is not in Figma, which draws only the static toast; it is my choice, and easy to change.
- Nothing in the app calls `useToast()` yet: the gallery is its only caller. It is ready for checkout, hold-expiry and offline messages.
- `Card` is not interactive. A tappable card (for example a cinema row that opens showtimes) would need its own `onPress` and role; the spec has none.
- Reduce-motion is read once at app start (Reanimated), so toggling the OS setting needs an app restart, as with `Skeleton`.

## Next
- **Dave:** review and squash-merge.
- Remaining unbuilt components from the Figma Gallery: QRCode, Switch, ListRow, Countdown, Seat, SeatMap. Each lands with a gallery entry.
