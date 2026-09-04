---
'@ankhorage/studio': patch
---

Adopt the released `AppNavigatorManifest`/`NavigatorNode` contract model from `@ankhorage/contracts@10` without changing Studio navigation behavior.

Preserve app-level navigator metadata when switching the root navigator type, while removing settings specific to the previous navigator type.
