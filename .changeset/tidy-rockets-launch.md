---
'@ankhorage/studio': patch
---

Keep generated standalone Android apps independent from the Studio Host by omitting the implicit Studio API health check and reverse mapping when `includeStudio` is disabled, while retaining the ZORA runtime peers required by standalone apps.
