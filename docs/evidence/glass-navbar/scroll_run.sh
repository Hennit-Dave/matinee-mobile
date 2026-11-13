#!/bin/sh
# Scrolls Home up and down 10 times each and prints the frame stats for the Expo Go process.
PKG=host.exp.exponent
adb shell dumpsys gfxinfo $PKG reset > /dev/null 2>&1
for i in 1 2 3 4 5 6 7 8 9 10; do
  adb shell input swipe 540 1900 540 700 400
  adb shell input swipe 540 700 540 1900 400
done
sleep 1
adb shell dumpsys gfxinfo $PKG | grep -E "Total frames rendered|Janky frames|50th percentile|90th percentile|95th percentile|99th percentile|Number Missed Vsync|Number High input latency|Number Slow UI thread|Number Slow bitmap uploads|Number Slow issue draw commands|Number Frame deadline missed"
