---
'@ankhorage/studio': minor
---

Update generated-app runtime registry composition to source the base ZORA registry from `@ankhorage/zora` and compose app extensions through Runtime's generic registry helpers.

Remove Studio's compatibility ownership of the base ZORA registry from `@ankhorage/studio/runtime`; Studio now exports only its own extension registry and generic runtime composition helpers.
