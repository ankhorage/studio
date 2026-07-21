---
'@ankhorage/studio': patch
---

Fix generated nested navigator layouts so theme-dependent screen option declarations are scoped after `useZoraTheme()`, preventing `theme is not defined` crashes during Expo static rendering and infrastructure startup.
