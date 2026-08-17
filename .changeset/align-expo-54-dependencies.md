---
'@ankhorage/studio': patch
---

Align generated apps and the first-party Studio Expo app with the Expo SDK 54 package baseline, including Reanimated `~4.1.1`, Worklets `0.5.1`, Expo `~54.0.37`, Expo Constants `~18.0.14`, and Expo Updates `~29.0.20`. Remove the custom animation compatibility shim and explicit Worklets/Reanimated Babel plugin wiring so Expo's Babel preset owns the supported setup.
