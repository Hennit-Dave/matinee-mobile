# Learning log

One paragraph per slice, written by Dave in his own words after closing the chat. Agents never write or edit entries here.

## Slice 0 · Reaching the local server from the Android emulator — 2026-11-13

`10.0.2.2` lets the Android emulator reach my computer, but requests through it failed in my setup; `adb reverse tcp:3000 tcp:3000` forwarded the emulator's port 3000 to my computer, making `localhost` work.
HTTP is allowed only for local development addresses; other addresses require HTTPS to protect data in transit.
The forwarding resets after an emulator reboot, so I must run the command again before testing.
