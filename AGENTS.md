# Matinee mobile — agent instructions

Expo React Native app for Matinee (cinema booking). Read by Codex, Antigravity agents and Claude Code.

**The full rules live in the server repo:** `../matinee-server/AGENTS.md` (how to work) and `../matinee-server/docs/RULES.md` (every graded requirement). Read both before writing code. If that repo is not checked out next to this one, stop and ask Dave. Authority order: graduation brief PDF > RULES.md > AGENTS.md.

## Working loop
Plan → wait for Dave's go → branch `feat/<slice>` → build → prove → PR with description and screenshots → **Dave merges**. Conventional Commits. Never merge, never force-push, never write or edit `LEARNING-LOG.md`.
Tell Dave **before** any change that needs a new EAS native build.

## Non-negotiables in this repo
- **No AI attribution in git.** Never add `Co-Authored-By`, `Claude-Session`, "Generated with" or any other AI credit line to a commit message or PR description. Dave is the only author. The `.githooks/commit-msg` hook rejects them; after a fresh clone run `git config core.hooksPath .githooks`.
- **Figma first.** No screen is built before its Figma frame exists.
- **Tokens only** for colour, type, spacing (multiples of 4 or 8), radius, shadow. No raw values like `margin: 13`. CI lint fails on them.
- **No money maths.** The server sends finished price strings. The app never computes a total or fee.
- **Never call TMDB.** The app only calls the Matinee server.
- **No secrets.** Every `EXPO_PUBLIC_*` variable is public; list each in the README with why it is safe. Auth tokens go in `expo-secure-store`, never AsyncStorage.
- **Never trust the app.** It displays what the server allows; no check that matters lives here.
- **API types mirror the server contract.** A contract change lands in a `matinee-server` PR first; link it from the mobile PR.
- Components live in the in-app library, are documented in `docs/COMPONENTS.md`, and appear in the hidden component gallery in every state.
- Accessibility: contrast ≥ 4.5:1, labels on every button and image, text scales with system font size, touch targets ≥ 44×44.
- Skeletons not spinners; designed empty, error and dark-mode states; Reanimated for transitions, seat selection, confirmation; haptics on seat select and payment confirm.
- TMDB attribution on the About screen (RULES.md D1.1).

## Layout
```
src/    app, tokens, component library
docs/   COMPONENTS.md DESIGN-STUDY.md evidence/
README.md  LEARNING-LOG.md  .env.example  LICENSE (MIT)
```
ADRs for mobile decisions go in `../matinee-server/docs/decisions/`.

Commands: _TBD at slice 0._ Do not invent script names.
