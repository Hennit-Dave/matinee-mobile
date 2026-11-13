# Learning log

One paragraph per slice, written by Dave in his own words after closing the chat. Agents never write or edit entries here.

## Slice 0 · Reaching the local server from the Android emulator — 2026-11-13

`10.0.2.2` lets the Android emulator reach my computer, but requests through it failed in my setup; `adb reverse tcp:3000 tcp:3000` forwarded the emulator's port 3000 to my computer, making `localhost` work.
HTTP is allowed only for local development addresses; other addresses require HTTPS to protect data in transit.
The forwarding resets after an emulator reboot, so I must run the command again before testing.

## Slice 2 · Browse — contract mirroring, view states, and offline UX — 2026-11-13

The mobile app keeps matching copies of `Movie` and `MoviesPage` so it knows what data to expect from the server. The server defines that format, so contract changes land in a server PR first, then the app updates its types to match.

`resolveMoviesViewStatus` decides whether a screen should show loading, an error, empty results, or saved data. Sharing this logic keeps Home and Search consistent and avoids repeating checks across screens.

I set `retry: false` because the server already retries TMDB requests and handles cached fallbacks. Automatic retries from the app would multiply requests and add pressure when the service is struggling; users can still retry manually.

When the server returns an older cached copy, the app displays the movies with a "showing saved data" notice and a Retry button. This keeps useful content available while making it clear that the list may be outdated.

## Slice 3 · Glass NavBar

In our blur setup, putting the `BlurView` inside the view it captures made it repeatedly capture itself and crash. We moved the NavBar outside that view as a separate floating overlay because the built-in tab-bar placement did not provide the separation we needed.

The floating NavBar reads the current route and matches it to a tab to show which one is active.

Scrolling looked choppy on the emulator but felt smooth on my real phone. I learned to confirm performance on physical devices because emulator performance does not reliably reflect what users experience; one smooth phone also does not prove every device will perform equally well.

The bar switches to a solid colour when Reduce Transparency is enabled or the device does not support the blur effect. It keeps navigation clear and usable while respecting accessibility settings and device limits.

