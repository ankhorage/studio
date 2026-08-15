---
'@ankhorage/studio': patch
---

Preserve Studio administration routes across generated-app runtime syncs by persisting project
generation state instead of inferring Studio inclusion from the removed legacy `src/studio`
directory.
