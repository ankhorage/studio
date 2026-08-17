---
'@ankhorage/studio': patch
---

Keep stationary selection gesture callbacks inline while `runOnJS(true)` executes them on the JS thread, avoiding native Reanimated/Worklets serialization recursion in generated apps.
