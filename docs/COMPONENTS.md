# Matinee components: Figma to code handoff

Source of truth: the Figma file "Matinee" (fileKey `76VKO0l9gGt5YMNYtH8yvM`), page **Components** for the masters and page **Gallery** for every variant in Dark and Light. Tokens: `src/tokens/tokens.ts` (154 variables, checksum 2974593486).

## How to read this

- **Code name** is the exported component name. It matches the Figma component name exactly.
- **Props** are the proposed code API. Each Figma property maps to one prop. No component code exists in the repo yet, so these names are the contract to build against. Change them in code and in this file together.
- **Tokens** use the keys in `tokens.ts` unchanged.
  - Colour: `semantic[mode]['surface/raised']`.
  - Everything else: `primitives['space/4']`, `primitives['radius/md']`, `primitives['size/touch-min']`, `primitives['border-width/default']`.
  - Type: `textStyles['type/body']`.
  - Elevation: `elevation[mode]['elevation/1']`.
- **Never** write a raw value. Tokens-only is enforced by code review and convention (no custom ESLint token rule is configured yet).
- Pressed, Focused and Loading are runtime states, not props. Disabled and Loading are props because the caller decides them.
- Theme is switched by mode (`light` / `dark`). No component reads a mode name directly.

Rules that apply to every component:

- Touch target is at least 48 (`size/touch-min`). Where the drawing is smaller, the hit area is bigger. These are marked **hit slop**.
- Every control has an accessibility label.
- State is never carried by colour alone. Shape, mark, text or position backs it up.
- Text scales with the system font size.
- Skeletons, never spinners on a blank screen.
- Show a reason and a retry on every error.

---

## 1. Typography

### Text
- **Figma:** `Text` (`17:78`). **Code:** `Text`.
- **Props:**

| Figma | Code prop | Values | Default |
|---|---|---|---|
| Style | `variant` | `display`, `title-lg`, `title`, `body-lg`, `body`, `label-lg`, `label`, `caption`, `numeral` | `body` |
| (colour, applied per use) | `color` | any `text/*` semantic token | `text/primary` |

- **Tokens:** `textStyles['type/<variant>']`. These bundle family, size, line height and weight. Colour is `text/primary`, `text/secondary` or `text/disabled`.
- **Fonts:** Newsreader for `display`, `title-lg` and `numeral`. Inter for the rest.
- **Tabular figures:** turn on `fontVariant: ['tabular-nums']` for the numeric uses listed in section 10.
- **Notes:**
  - `numeral` is 64/72 and is used on the waiting-room position.
  - Newsreader has no bold. Use `title` (Inter 600) when you need weight.

---

## 2. Buttons

### Button
- **Figma:** `Button` (`17:112`), 3 variants × 4 states. **Code:** `Button`.
- **Props:**

| Figma | Code prop | Values | Default |
|---|---|---|---|
| Variant | `variant` | `primary`, `secondary`, `text` | `primary` |
| State = Disabled | `disabled` | boolean | `false` |
| State = Loading | `loading` | boolean | `false` |
| State = Pressed | (press feedback, not a prop) | | |
| Label | `label` | string, also the accessibility label | required |
| (layout) | `fullWidth` | boolean. In screens the button fills the footer width | `false` |
| | `onPress` | handler | |

- **Tokens by state:**

| Variant / state | Background | Border | Label |
|---|---|---|---|
| Primary / Default, Loading | `primary/default` | none | `text/on-primary` |
| Primary / Pressed | `primary/pressed` | none | `text/on-primary` |
| Primary / Disabled | `primary/disabled` | none | `text/disabled` |
| Secondary / Default, Loading | `secondary/default` | `secondary/border` | `text/on-secondary` |
| Secondary / Pressed | `secondary/pressed` | `secondary/border` | `text/on-secondary` |
| Secondary / Disabled | `secondary/default` | `border/default` | `text/disabled` |
| Text / Default, Loading | none | none | `text/primary` |
| Text / Pressed | `secondary/pressed` | none | `text/primary` |
| Text / Disabled | none | none | `text/disabled` |

- **Size and shape:** height `size/button-height` (48) with `size/touch-min` as the minimum. Radius `radius/md`. Border `border-width/default`. Label `type/label-lg`. Padding from `space/*`.
- **Loading:** three dots, label kept at 0% opacity so the width never changes. Taps are ignored while loading. No spinner.
- **Rule:** one solid Primary per screen. Do not put anything between the price lines and the Pay button that isn't needed to decide.

---

## 3. Cards and posters

### Card
- **Figma:** `Card` (`18:2`), one component with a content slot. **Code:** `Card`.
- **Props:** `title: string`, `body: string`, `children` (the slot, optional).
- **Tokens:** `surface/raised`, `border/default`, `radius/lg`, `border-width/default`, `shadow/1` (light mode only), `space/4` padding, `space/2` gap, `type/label-lg` (title), `type/body` (body), `text/primary`, `text/secondary`. Elevation: `elevation/1`.
- **Variants used in screens:**
  - **Cinema card:** title and body only (Showtimes).
  - **Ticket row:** a `Badge` plus a text note in the slot (Tickets tab). Build it as a `TicketCard` composition. It is not a separate component.
- In dark mode elevation is shown by surface and border, not shadow. `shadow/*` is transparent there.
- **Built (components-badge-card-toast slice).** Code: `src/components/Card.tsx` (props: `title`, `body`, `children?`). Measured from Figma `18:2`: padding `space/4`, content gap `space/2`, radius `radius/lg`, a `border-width/default` hairline in `border/default`, fill `surface/raised`. The Figma instance is 328 wide; in code the card fills its parent. `children` render below the body in the same `space/2` stack, so a Badge and a note, or a Button, fit the slot. It is not interactive and has no accessibility role of its own: its title and body are read as text, and anything in the slot keeps its own role.

### MovieCard
- **Figma:** `MovieCard` (`18:18`), 3 layouts. **Code:** `MovieCard`.
- **Props:**

| Figma | Code prop | Values |
|---|---|---|
| Layout | `layout` | `poster`, `poster-title`, `list` |
| Title | `title` | string |
| Meta | `meta` | string, for example "Thriller, 2h 08m" |
| (poster image) | `posterUrl` | URL from the Matinee server |
| | `onPress` | handler |

- **Tokens:** `size/poster-width` (128) × `size/poster-height` (192) for poster layouts. `size/thumb-width` (64) × `size/thumb-height` (96) for the list layout. `radius/md` on the poster, `radius/sm` on the thumb. `skeleton/base` while the image loads. `border/default`, `border-width/default`. `type/label-lg` (title), `type/label`, `type/body` and `type/caption` (meta). `text/primary`, `text/secondary`. `space/1`, `space/2`, `space/3`.
- **Rules:**
  - The app never calls TMDB. `posterUrl` always comes from the server.
  - Placeholder posters in the designs use `poster/red`, `poster/green`, `poster/pale` and `poster/dark` from the Placeholder collection. They are design placeholders only and are not in `tokens.ts`.
  - Poster images need alt text (the film title).

### SearchResultRow
- **Figma:** `Browse / Search / Results` row (`41:1474`). **Code:** `SearchResultRow`.
- **Props:** `title: string`, `meta?: string`, `posterUrl: string | null`, `onPress?: () => void`.
- **Tokens:** `size/thumb-width` (64) × `size/thumb-height` (96), `radius/sm`, `border-width/default`, `border/default`, `skeleton/base`, `space/3` gap, `space/1` text gap, `type/label-lg` (`text/primary`), `type/body` (`text/secondary`), `size/touch-min` minimum height.

### HeroBackdrop
- **Figma:** the hero of Home (`40:1339`, 448 tall on a 360×800 frame, 512 on tall phones). **Code:** `HeroBackdrop`.
- **Props:** `height: number`, `imageUrl?: string | null`, `fallbackImageUrl?: string | null`, `accessibilityLabel?: string` (alt text for the image), `loading?: boolean`, `children` (the content slot, pinned to the bottom).
- **States:**

| State | When |
|---|---|
| Loading | `loading`: a flat `skeleton/base` fill, for the screen's own skeleton |
| Image loading | an image URL is set but has not loaded: a `Skeleton` block |
| Image loaded | the image replaces the block, behind the gradients |
| Fallback | the primary image fails: `fallbackImageUrl` is tried next |
| No image | no usable URL: the `Skeleton` block stays |

- **Tokens:** a fade from `surface/default-clear` to `surface/default` (stops at 30% and 92%) so the content below reads on the page colour, a status-bar scrim from `surface/scrim` to `surface/scrim-clear` (112 high), `skeleton/base`, `space/4` padding and `space/2` gap for the slot.
- **Rules:** the image is drawn **behind** the gradients (the #18 fix). `react-native-svg` ignores the alpha inside `rgba(...)` on `stopColor`, so the stops go through `svgStopProps`, which splits a token into `rgb(...)` plus `stopOpacity`. Pass a movie title as `accessibilityLabel`.
- **Used by:** Home hero (with `CrossfadeStack`) and the Movie detail hero.

### QR
- **Figma:** `QR` (`59:3968`), 177×177. **Code:** `QRCode`.
- **Props:** `value: string` (the ticket payload from the server), `size?: number` (default 177; Ticket detail scales it to 230).
- **Tokens:** `qr/background` (`#FFFFFF`), `qr/foreground` (`#0E0E0F`), `radius/md`. These two are **identical in Light and Dark** so the code always scans.
- **Notes:**
  - The art in Figma is a placeholder. Use a real QR renderer in code.
  - Keep a quiet zone around the code. The white plate provides it.
  - Must render from saved data with no network.

---

## 4. Selection and labels

### Chip
- **Figma:** `Chip` (`17:123`). **Code:** `Chip`.
- **Props:**

| Figma | Code prop | Values |
|---|---|---|
| State | `selected` / `disabled` | boolean each |
| Label | `label` | string, for example "19:30" |
| Note | `note` | string, for example "Sold out". Shown only when disabled |
| | `onPress` | handler |

- **Tokens:**
  - Default: `border/strong` outline, `text/primary` label.
  - Selected: `primary/default` fill, `text/on-primary` label, no outline.
  - Disabled: `border/default` outline, `text/disabled` label, `text/secondary` note.
  - Shape `radius/full`, height `size/chip-height` (32), `border-width/default`, label `type/label`, note `type/caption`.
- **Hit slop:** the pill is 32 high, the tap area is 48 (`size/touch-min`). Selected is told apart by fill and text colour. Add `accessibilityState={{ selected }}`.
- **Tabular figures:** on for showtime labels.
- **Built (movie-detail-screen slice).** Code: `src/components/Chip.tsx` (props: `label`, `selected?`, `disabled?`, `note?`, `tabularNums?`, `accessibilityLabel?`, `onPress?`). Uses `space/2` vertical wrapper padding so the pill stays 32 high inside a 48px touch target.

### Badge
- **Figma:** `Badge` (`17:134`). **Code:** `Badge`.
- **Props:** `tone: 'neutral' | 'success' | 'warning' | 'error' | 'info'` (default `neutral`), `label: string`.
- **Tokens:** outline and label colour by tone.

| Tone | Outline | Label |
|---|---|---|
| neutral | `border/strong` | `text/secondary` |
| success | `status/success` | `status/success` |
| warning | `status/warning` | `status/warning` |
| error | `status/error` | `status/error` |
| info | `status/info` | `status/info` |

- Radius `radius/sm`, `border-width/default`, label `type/caption`. Padding `space/1` and `space/2`.
- **Rule:** the label carries the meaning ("Confirming", "Cancelled"). Tone is only reinforcement.
- **Built (components-badge-card-toast slice).** Code: `src/components/Badge.tsx`, tone table in `src/components/badgeLogic.ts` (pure, unit-tested). Props: `tone?` (default `neutral`), `label`, `accessibilityLabel?` (defaults to the label). Not interactive: it is one accessible element with role `text`, sized to its content. **Contrast, checked in `badgeLogic.test.ts`:** every tone's label colour meets 4.5:1 on `surface/default`, `surface/raised` and `surface/overlay`, in light and dark.

### Switch
- **Figma:** `Switch` (`66:3974`) 52×32. **Code:** `Switch`.
- **Props:** `value: boolean`, `disabled: boolean`, `onValueChange`.
- **Tokens:**

| State | Track | Knob |
|---|---|---|
| On | `primary/default` | `text/on-primary`, right |
| Off | `surface/raised` + `border/strong` (`border-width/strong`) | `text/secondary`, left |
| Disabled | `primary/disabled` | `text/disabled` |

- Radius `radius/full`, padding `space/1`.
- **Rule:** on/off is shown by knob position, and the `ListRow` carries the text value. Never rely on track colour alone.
- Do not use it standalone for settings. Use it inside `ListRow` so the whole row is the touch target.

### ListRow
- **Figma:** `ListRow` (`66:3997`), 4 trailing types. **Code:** `ListRow`.
- **Props:**

| Figma | Code prop | Values |
|---|---|---|
| Title | `title` | string |
| Value | `value` | string, optional secondary line |
| Trailing | `trailing` | `chevron`, `switch`, `none` |
| Trailing = Switch On/Off | `switchValue`, `onSwitchChange` | boolean, handler |
| | `onPress` | handler for chevron rows |

- **Tokens:** `surface/raised` (set by the parent group), `border/default` bottom hairline (hidden on the last row), `type/label-lg` title, `type/body` value, `text/primary`, `text/secondary`, `size/icon-lg` chevron, `space/2` to `space/4`.
- **Size:** at least 56 high (hugs when the value line is shown, 60 in Figma). The whole row is the touch target.
- **Composition:** rows are grouped inside a bordered `surface/raised` container with `radius/lg`. The container is a layout wrapper, not a component.

---

## 5. Input

### Input
- **Figma:** `Input` (`18:61`), 6 states. **Code:** `Input`.
- **Props:**

| Figma | Code prop | Values |
|---|---|---|
| Label | `label` | string |
| Placeholder | `placeholder` | string |
| Value | `value`, `onChangeText` | string |
| Helper | `error` | string, the reason in plain words. Setting it gives the Error state |
| State = Disabled | `disabled` | boolean |
| State = Focused | (focus, not a prop) | |
| Leading icon | `leadingIcon` | `'search'` or none |
| State = Code | `mode` | `'text'` (default) or `'code'` with `digits` (default 6) |

- **Tokens by state:**

| State | Field fill | Border | Notes |
|---|---|---|---|
| Default, Filled | `surface/raised` | `border/strong`, `border-width/default` | |
| Focused | `surface/raised` | `text/primary`, `border-width/strong` | caret visible |
| Error | `surface/raised` | `status/error`, `border-width/strong` | helper in `status/error` with the Error icon |
| Disabled | `surface/default` | `border/default` | label and value `text/disabled` |
| Code | cells `surface/raised`, `border/strong`; the active cell uses `text/primary` at `border-width/strong` | | digits `type/title` |

- Height `size/input-height` (48), radius `radius/md`, label `type/label`, value `type/body-lg`, helper `type/caption`. Placeholder `text/secondary`.
- **Rules:**
  - An error always has a reason (the helper line), never colour alone. The icon and text come with the red border.
  - Code mode: one hidden `TextInput` drives the cells. Support one-time-code autofill.
- **Tabular figures:** on for the code digits.

---

## 6. Feedback

### Toast
- **Figma:** `Toast` (`18:94`). **Code:** `Toast`.
- **Props:** `tone: 'info' | 'success' | 'error'`, `message: string`, `action?: { label, onPress }`.
- **Tokens:** `surface/overlay`, `border/default`, `radius/md`, `text/primary`, `type/body`, `elevation/2` (`shadow/2`), `size/icon-md` icon (Info, Success or Error), action uses `Button` text variant.
- **Rule:** place it **above the footer** so it never covers content or the main button. Tone is shown by the icon shape as well as colour.
- **Built (components-badge-card-toast slice).** Code: `src/components/Toast.tsx` (the visual), `ToastProvider.tsx` (`ToastProvider` and `useToast`), and `toastLogic.ts` (pure, unit-tested). Measured from Figma `18:94`: minimum height 56, padding `space/4` across and `space/2` down, gap `space/3`, radius `radius/md`, `border-width/default` in `border/default`, fill `surface/overlay`, `elevation/2`. The action is a `Button` text variant (48 minimum touch target).
  - **Showing one:** mount `ToastProvider` once, inside the `SafeAreaProvider` (the root layout does). Anywhere below it, `const toast = useToast()` then `toast.show({ message, tone?, action?, duration?, bottomOffset? })`, or `toast.dismiss()`. One toast shows at a time: a new one replaces the current one and restarts the timer. There is no data model and nothing is stored.
  - **Auto-dismiss:** 4 s for a plain message, 6 s for an error or a toast with an action (the person needs time to read and decide). An explicit `duration` is used but never below 2 s. Pressing the action runs it and dismisses the toast.
  - **Placement:** `bottomOffset` is the distance from the screen bottom to the toast's bottom edge. A screen with its own footer passes the footer's height so the toast never covers the main button; the default sits one gap above the floating NavBar.
  - **Accessibility:** icon and message are one spoken unit with the tone said first ("Error. Payment failed."), since the icon shape is not visible to a screen reader. Android reads it through a polite live region; iOS gets an explicit announcement. The action stays a separate focusable button. Message text is 4.5:1 on `surface/overlay` and each tone's icon is at least 3:1 (tested).
  - **Motion:** it rises into place while fading in (`duration/base`) and drops away while fading out (`duration/fast`), using Reanimated's `FadeInDown` / `FadeOutDown`. With OS reduce-motion on, it appears and disappears without animation. Not in Figma: the frames show only the static toast.

### Skeleton
- **Figma:** `Skeleton` (`18:70`), 4 shapes × 2 phases. **Code:** `Skeleton`.
- **Props:** `shape: 'block' | 'text' | 'poster' | 'circle'`, `width?`, `height?`.
- **Tokens:** `skeleton/base` and `skeleton/highlight`, `radius/md` (block), `radius/sm` (text), `radius/full` (circle), poster `size/poster-width` × `size/poster-height`.
- **Motion:** pulse between Base and Highlight with Reanimated. With reduce-motion on, hold Base.
- **Contrast note:** on `surface/default` the Highlight phase is almost the same colour as the page in light mode. Run the pulse and leave the bars on a `surface/default` or `surface/raised` background as the screens do.

### Countdown
- **Figma:** `Countdown` (`37:819`). **Code:** `Countdown`.
- **Props:** `time: string` (formatted "9:58" by the server clock logic), `state` derived from remaining time.

| State | When | Fill | Text |
|---|---|---|---|
| Calm | 2:00 or more left | none | `text/secondary` |
| Urgent | under 2:00 | `urgent/default` | `text/on-urgent` |

- **Tokens:** `size/chip-height` (32), `radius/full`, `type/label` and `type/label-lg`.
- **Rules:**
  - Orange (`urgent/*`) appears here and nowhere else.
  - Urgent is also signalled by the filled pill, not colour alone.
  - Announce time left to screen readers at sensible intervals, not every second.
- **Tabular figures:** on for `time`.
- **Built (seat-selection slice).** Code: `src/components/Countdown.tsx`, decisions in `countdownLogic.ts`. Props: `secondsRemaining: number` (not a `time` string: the pill formats it itself, "9:58", and works out the state). Urgent is strictly under 2:00, so 2:00 is still calm and 1:59 is urgent. It is **presentational and never counts down on its own**: the live seat hold, and so the live timer, belong to the traffic slice. Nothing mounts it on a real screen yet (a frozen "10:00 left" with no hold behind it would mislead), so only the gallery shows it. It is one `timer` element read out as words ("9 minutes 58 seconds left"); periodic announcements arrive with the live timer.

### EmptyState
- **Figma:** `EmptyState` (`19:21`). **Code:** `EmptyState`.
- **Props:** `headline: string`, `body: string`, `actionLabel: string`, `onAction`.
- **Tokens:** `type/title-lg` headline (Newsreader), `type/body-lg` body, `text/primary`, `text/secondary`, `Button` primary inside, `space/2`, `space/3`, `space/6`, `space/8`.
- **System layout:** the same component with an `Icon` above it (Info in `status/info`, or Error in `status/error` for server errors). Used for No internet, Server error, Maintenance, Update required, Session expired and the Notification primer.
- **Rules:** exactly one action in the component. A second, quieter action ("Open saved tickets", "Not now") is a `Button` text variant placed below it.

### CrossfadeStack
- **Figma:** none. It is behaviour, not a visual: it swaps the slides of the Home featured hero (frame `40:1339`). **Code:** `CrossfadeStack`.
- **Props:** `incoming: { key: string; node: ReactNode }`, `outgoing?: { key: string; node: ReactNode } | null`, `reducedMotion?: boolean`.
- **Tokens:** `duration/slow` (350 ms) for the fade. It has no colour, spacing or type of its own.
- **Motion:** the incoming slide fades in with Reanimated (`FadeIn`) on top of the outgoing slide, which stays fully opaque underneath until it is removed, so the content never dips to the page colour mid-fade. With `reducedMotion` on, the swap is instant.
- **Rules:**
  - The outgoing layer ignores touches and is hidden from screen readers, so only the visible slide can be focused or tapped.
  - Give a slide the same `key` in both roles. It then stays mounted when it moves from incoming to outgoing, so its image does not reload.
  - The caller removes `outgoing` once the fade has finished (Home does this in `useHeroCycle`).
- **Built (home-dynamic slice).** Code: `src/components/CrossfadeStack.tsx`.

---

## 7. Navigation and sheets

### NavBar
- **Figma:** `NavBar` (`37:812`), 3 active states × 2 materials. **Code:** `NavBar`.
- **Props:**

| Figma | Code prop | Values |
|---|---|---|
| Active | `active` | `home`, `tickets`, `account` |
| Material | `reduceTransparency` | `false` = Glass (default), `true` = Solid fallback |
| | `onNavigate(item)` | handler, called with `home`, `tickets` or `account` |
| | `blurTarget` | Android only: ref to the `BlurTargetView` behind the bar. See "Built" below |

- **Glass (default):** a frosted floating pill. Two layers:
  - Background blur of `primitives['blur/nav']` (24).
  - Tint fill `semantic[mode]['material/nav']` over the blur. This is `glass/light` (`#FFFFFF` at 60%) in light and `glass/dark` (`#222225` at 70%) in dark.
  - Plus `border/default` hairline (`border-width/default`) and `elevation/3` (`shadow/3`), unchanged.
- **Solid (reduce-transparency fallback):** `surface/overlay` fill, no blur, same border and elevation. Use it when the OS reduce-transparency setting is on, when backdrop blur isn't available, or when blur can't be done smoothly on the device.
- **Shared:** shape `radius/full`, height `size/nav-height` (56) plus its own padding, icons `size/icon-lg`, labels `type/caption`. Inactive icons and labels use `text/primary` (in both materials), so the tint can stay clear. The active item is a **filled pill**: `primary/default` fill with `text/on-primary` icon and label, so it doesn't depend on what is behind the bar and doesn't rely on colour.
- **Contrast, checked:**
  - The tint is as clear as it can be while legibility holds over any background.
  - The worst case for the inactive labels is dark under the light tint and white under the dark tint.
  - With `text/primary` labels, the contrast is **6.52:1** in light over pure black (60% tint) and **5.39:1** in dark over pure white (70% tint). Both clear 4.5:1.
  - With `text/secondary` labels the same tint would fail (2.36:1 in light and 2.46:1 in dark at these opacities), so the label colour and the tint opacity go together. The older 90% tint with `text/secondary` labels passed (5.36:1 and 4.89:1) but looked heavy.
  - The minimum tint with `text/primary` is about 50% in light and 65% in dark. If you lower the opacity, re-run the numbers first.
- **Rules:** three items only (Home, Tickets, Account). Each item is at least 48 wide and tall. **Hidden during Seat selection and Checkout**, which have their own footer. Safe-area bottom inset applies.
- **Built (glass-navbar slice).** Code: `src/components/NavBar.tsx`, decisions in `src/components/navBarLogic.ts` (pure, unit-tested).
  - **Measurements from the Figma frame (`37:812`):** the pill is **56 tall in total**, not 56 plus padding: 4 (`space/1`) of padding all round, items 48 tall (4 + 24 icon + 16 caption + 4) with 12 (`space/3`) side padding, 4 between items, 16 (`space/4`) side margins. The hairline is drawn over the material rather than as a layout border, so it does not eat the padding.
  - **Blur:** `expo-blur`'s `intensity` is not Figma's unit. It is `blur/nav` × 2 (48): a 12 px radius on Android (radius = intensity / 4, which is what Figma's 24 means in CSS terms) and a 1 to 100 strength on iOS. The thinnest built-in tint is used so `material/nav` does the colouring. Checked by eye against the Gallery frames on iOS only; light mode only so far.
  - **iOS:** real glass, drawn when Reduce Transparency is off. `AccessibilityInfo.isReduceTransparencyEnabled` and its change event switch it to Solid live.
  - **Android: real glass is ON** (`ANDROID_GLASS_ENABLED = true` in `navBarLogic.ts`). Dave verified it smooth on a real Android 16 (API 36) phone; recordings of the glass and Solid bars are attached to PR #16 (see `docs/evidence/glass-navbar/README.md`). An earlier emulator measurement showed glass much worse than Solid, but that emulator was already janky with Solid and is not representative of real hardware (numbers kept in the evidence README as history). Android has no Reduce Transparency flag, so Solid on Android is the fallback for where blur cannot be drawn: below API 31, or with no blur target. Setting the constant to `false` draws Solid on Android everywhere.
  - **The NavBar must be a sibling of the `BlurTargetView`, never inside it.** A `BlurView` inside the view it blurs makes the renderer recurse until the render thread's stack overflows (a native `SIGSEGV`, seen on the emulator). That is why the NavBar is drawn beside the tab screens (`src/app/(tabs)/_layout.tsx`) and not as the navigator's `tabBar`: Expo Router draws that bar inside the navigator next to the screens, with no way to wrap only the screens.
  - **Text size:** labels scale with the system font size up to 1.3× (`maxFontSizeMultiplier`), so the 56 pill never grows far. The gap above the last content (`navBarClearance`) leaves room for the pill to grow a little. Beyond 1.3× the labels stop growing; that is a deliberate cap for a fixed-height navigation control.
  - **Active item:** a filled `primary/default` pill with `text/on-primary` icon and label; each item is a button with a label and a `selected` state.

### BottomSheet
- **Figma:** `BottomSheet` (`19:13`) with a content slot. **Code:** `BottomSheet`.
- **Props:** `visible`, `onClose`, `children`.
- **Tokens:** `surface/overlay`, `border/default`, `radius/lg` (top corners), grabber `border/strong` at `radius/full`, `elevation/3` (`shadow/3`), `space/4` to `space/8`. Scrim behind it: `surface/scrim`. `type/title` and `type/body-lg` defaults.
- **Two patterns** (compositions of `Text` and `Button`, not separate components):
  - **Standard:** headline in `title-lg`, one body paragraph, **one Primary** action. Examples: Hold expired ("Choose seats again"), Accessible seat.
  - **Destructive:** headline in `title-lg`, one paragraph saying what happens, the **safe action as Primary** ("Keep my account", "Stay signed in") and the **destructive action as Secondary** ("Delete my account", "Sign out"). Never make the destructive action the solid button and never use red for it.
- **Suggested, not drawn in Figma:** dismiss by drag, back button and scrim tap, except Hold expired, which should require its one action. Animate with Reanimated using `duration/base`, `easing/enter` in and `easing/exit` out. Confirm both when the component is built.
- **Built (movie-detail-screen slice).** Code: `src/components/BottomSheet.tsx` (props: `visible`, `onClose`, `accessibilityLabel?`, `children`). Dismisses via scrim tap, handle drag-down (`PanResponder`), or system back action. Uses `Modal` fade + `surface/scrim` + `surface/overlay` + `elevation/3`.

---

## 8. Seats

### Seat
- **Figma:** `SeatMap/Seat` (`19:58`), 6 states. **Code:** `Seat` (internal to `SeatMap`, not used on its own).
- **Props:** `state: 'available' | 'selected' | 'held' | 'sold' | 'accessible' | 'accessible-selected'`.
- **Tokens and shape:** the shape and mark tell the states apart, colour only reinforces.

| State | Look | Tokens |
|---|---|---|
| available | empty outline square | stroke `seat/available` |
| selected | filled square with a tick | fill `seat/selected`, tick `seat/selected-mark` |
| held | diagonal hatch | fill `seat/held`, hatch `surface/default` |
| sold | filled square with a cross | fill `seat/sold`, cross `seat/sold-mark` |
| accessible | circle with the wheelchair icon | stroke and icon `seat/accessible` |
| accessible-selected | filled circle with a tick | fill `seat/selected`, tick `seat/selected-mark` |

- Size `size/seat` (36), gap `size/seat-gap` (8), `border-width/strong`, radius `radius/sm` (circle uses `radius/full`).
- **Hit slop:** the zoomed seat is 36 with an 8 gap, so use `hitSlop` of 6 on each side to reach 48. Neighbouring slop areas overlap by 4, so the nearest seat centre wins. Test on a real device.
- Announce row, number and state to screen readers ("Row D, seat 8, available").
- **Built (seat-selection slice).** Code: `src/components/Seat.tsx` (the look of each state, drawn from the Figma `SeatMap/Seat` artwork: tick, cross, 6-line hatch and wheelchair glyph in the seat's own 36 × 36 space, so they scale with it). Props: `state`, `size` (default 36; the legend draws 24), and, only for the map, `seatId`, `accessibilityLabel` and `onActivate` (a screen-reader activation). It is `React.memo` with primitive props only. **It is exported** (the legend and the gallery use it) although the spec called it internal. The tick pops in with Reanimated when a seat is picked (not with reduced motion). **Haptics** are not the `Seat`'s job: the seat screen fires them (see SeatMap below) through the shared helper `src/lib/haptics.ts`.
- **Hit slop:** not per-seat `hitSlop`. The map hit-tests the whole tap in one place (nearest seat centre within half a seat pitch), which implements the same rule with one handler instead of 320 touchables (ADR 0014).

### SeatMap / Legend
- **Figma:** `SeatMap/Legend` (`19:59`). **Code:** `SeatLegend`.
- **Props:** none. It is a fixed list of the six looks in two columns.
- **Tokens:** the `seat/*` tokens above, `type/caption`, `text/secondary`, `size/icon-lg`, `space/2`, `space/4`.
- **Built.** Code: `src/components/SeatLegend.tsx`; the entries and their words come from `SEAT_LEGEND_ITEMS` in `seatMapLogic.ts`, and a test fails if one seat look is missing. Each entry is one spoken label; the swatch is decorative.

### SeatMap
- **Figma:** `SeatMap` (`54:4988`), 4 levels. **Code:** `SeatMap`.
- **Props:**

| Figma | Code prop | Values |
|---|---|---|
| Level | `level` | `skeleton`, `overview`, `overview-300`, `zoomed` (derived from room size and zoom) |
| | `seats` | seat data from the server (row, number, state, accessible) |
| | `selectedIds`, `onSelect(id)` | selection |
| | `onZoom(region)` | tap an overview region to zoom |

- **Tokens:** `size/seat`, the `seat/*` set, `skeleton/base` (skeleton level), `surface/raised` and `surface/overlay` for the zoom controls and mini-map, `border/default`, `border/strong`, `text/primary`, `text/secondary`, `type/caption` (row letters and "Screen"), `size/icon-md` and `size/icon-lg` (Plus and Minus).
- **Levels:**
  - **Overview** draws seats at 0.5× in rooms under 300 seats. **Overview 300+** draws them at 0.3×. Seats are **not** tappable one by one here. A tap zooms.
  - **Zoomed** shows full-size, tappable seats with row letters, a mini-map and Plus/Minus controls.
- **Rules:**
  - Seat state and prices come from the server. The app never computes them.
  - Selection feedback uses Reanimated and a haptic.
  - Tense moment: the map and the hold `Countdown` are the only places the design is allowed to feel tense.
- **Built (seat-selection slice).** Code: `src/components/SeatMap.tsx`; every decision that can be tested without a renderer is in `seatMapLogic.ts` (layout, which seat a tap lands on, zoom and pan limits, selection, mini-map, labels). Decision record: matinee-server `docs/decisions/0014-seat-data-model-and-seat-map-rendering.md`.
  - **Props (differ from the table above):** `rows` and `totalSeats` (the server's room), `selectedIds`, `onSelectSeat(id)`, `loading` (the Skeleton level), and `initialZoomedSeatId` (the gallery starts zoomed with it). The level is derived inside from room size and zoom; there is no `onZoom(region)` because a tap on the Overview zooms by itself.
  - **How it works:** the whole map is one layer moved and scaled on the UI thread (Reanimated), so a gesture re-renders no React. Rows are memoized on their own picked seats, so **picking a seat re-renders one seat, not 320** (measured on a device: 1 `Seat` render per pick; a cold mount renders all 320 once). Pinch settles on the Overview, full size, or 1.5×; pan only exists while zoomed, so the Overview never swallows a parent list's scroll. Plus steps 1× to 1.5× so it is never a dead control; Minus steps back.
  - **Deviations from Figma, on purpose:**
    - The whole map is one scaled layer, so at the 0.3× 300+ Overview the gaps and the aisle scale with the seats (about 2.4 and 12) where Figma keeps them at 4 and 20. The 0.5× Overview is exact (18 seats, 4 gaps, 20 aisle, 328 wide for a 14-seat row).
    - The "Screen" bar is the flat pill Figma draws (its layer is named "arc"), not a curve.
    - The aisle is drawn after seat `ceil(n / 2)`; it is not in the data.
  - **Haptics (seat screen only, for now):** a light selection tick on every pick **and** drop, and a warning when the 8-seat cap refuses a pick (the existing Toast still shows). Nothing on pan, pinch, zoom, scroll or render, none on a tap that changes nothing (a sold seat, the Overview zooming), and none on Continue, which is inert. The rule is `selectionHaptic` in `seatMapLogic.ts`. The calls go through `src/lib/haptics.ts` (see below), and the gallery's demo maps do not buzz.
  - **Accessibility:** zoomed, every seat is its own element ("Row D, seat 8, held by someone else") with an activate action; the Overview is one element ("Seat map, 320 of 320 seats available. Double tap to zoom in.") with a zoom action, so a screen-reader user is never stranded behind a pinch. Not yet checked with TalkBack or VoiceOver.

---

## 9. Icons

- **Figma:** frame `Icons` (`17:2`), 24×24. **Code:** `Icon` with `name`.

| Name | Used in |
|---|---|
| `check`, `close` | Seat tick, dismiss |
| `info`, `success`, `error` | Toast, Input helper, EmptyState system layout |
| `search` | Input leading icon, Home search entry |
| `accessible` | Accessible seat |
| `chevron-right`, `chevron-left` | ListRow, back buttons |
| `home`, `ticket`, `user` | NavBar |
| `plus`, `minus` | Seat map zoom (**built**, seat-selection slice; geometry from the Figma `Icon/Plus` and `Icon/Minus` assets) |

- Sizes `size/icon-sm` (16), `size/icon-md` (20), `size/icon-lg` (24). Colour comes from a semantic token passed in, never a raw hex.
- There are no offline, settings or wrench icons. System screens reuse `info` and `error` on purpose.

---

## 10. Tabular figures (set `fontVariant: ['tabular-nums']`)

- `Countdown` time.
- `Chip` label for showtimes.
- `Input` code digits.
- Seat footer price and seats picked.
- Waiting-room position (`type/numeral`).
- Checkout price lines (tickets, service fee, total). The strings come from the server, finished.
- Date, time and seats on Booking confirmed and Ticket detail.
- Ticket code (for example `MTN-4829`).
- Refund amounts in the Refunded and Cancelled text.
- Version line on About and the reference code on Server error.
- The preview line on Accessibility.

---

## 11. Screen-level compositions (build from the components above, not new components)

| Composition | Built from |
|---|---|
| TicketCard | `Card` + `Badge` + text in the slot |
| Price lines | `surface/raised` box, `radius/lg`, `Text` `label-lg` for the total, tabular figures |
| Order summary | poster thumb (`size/thumb-*`) + `Text` |
| Account group | `ListRow`s in a bordered `surface/raised` container |
| Profile header | initials circle (64, `surface/raised`, `radius/full`, `type/title-lg`) + `Text`. **Open question:** make this an `Avatar` component? It appears once today |
| Offline strip | `surface/raised` row, `border/default`, `radius/md`, text only. Sits in the flow, never over content |
| Payment provider sheet | the provider's own sheet. Matinee draws only the handoff frame and never sees card details |

---

## 12. Not components

- Status bar in the frames is a placeholder.
- Placeholder poster colours (`poster/*`) are design-only.
- Gallery frames are documentation, not screens.
- **Haptics helper (`src/lib/haptics.ts`).** The one place the app produces haptic feedback, for any screen to reuse. Import it and call a wrapper; never call `expo-haptics` directly:

  ```ts
  import * as haptics from '../lib/haptics';
  haptics.selection();   // a light tick: a selection changed (a seat picked or dropped)
  haptics.impactLight(); // a light tap: a small control pressed
  haptics.warning();     // a refused action (the seat cap)
  ```

  Every call is fire-and-forget (it returns nothing, never a promise) and safe: it does nothing on the web or where the native module is missing, and it swallows any thrown error or rejected promise, so it cannot crash a render, a handler or a test. The safety logic is in `hapticsCore.ts` and unit-tested without React Native. Use it for deliberate moments only, never on scroll, pan, pinch or render. `expo-haptics` is at Expo SDK 58's version and ships in Expo Go, so it needs no new native build. Today only the seat screen calls it.

---

## 13. Component gallery (hidden screen)

The in-app living style guide required by RULES.md D3.4. Every component in the library, in every state, in light and dark, with mock data and no network.

- **Open it:** it is not linked from the app. Go to the path `/gallery`. In a dev build use `matinee://gallery`; in Expo Go use `exp://<host>:8081/--/gallery` (for example `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081/--/gallery" host.exp.exponent`).
- **Code:** the route is `src/app/gallery.tsx`. The sections live in `src/gallery/` (not under `src/app/`, so they are not routes). What the gallery covers is declared in `src/gallery/registry.ts`.
- **Light and dark:** the System / Light / Dark chips at the top switch the whole app with the platform's own override (`Appearance.setColorScheme`); the gallery hands control back to the device setting when it closes.
- **Sections follow the Figma Gallery page (`73:3973`):** Typography, Buttons, Cards and posters, Selection and labels, Input, Feedback, Navigation and sheets, plus Icons, Seats and Motion for components Figma draws no gallery frame for.
- **States that are not props** (pressed, focused) cannot be drawn statically, so the gallery says how to see them (press and hold a button, tap a field).
- **Rule: a new component is not done until it is in the gallery.** `src/gallery/registry.test.ts` fails CI if a component is exported from `src/components/index.ts` without an entry in `GALLERY_SECTIONS`, or if a component is listed as planned after it has been built.
- **Not built yet:** QRCode, Switch and ListRow are specified above and drawn in Figma but do not exist in code, so they are listed at the bottom of the gallery rather than shown. Move each into a section when it is built. (`Seat`, `SeatLegend` and `SeatMap` are in the Seats section, and `Countdown` is under Feedback.)
