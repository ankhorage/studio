---
'@ankhorage/studio': patch
---

Fix dashboard project deletion by skipping infrastructure teardown when no owned resources exist and preserving actionable host diagnostics when teardown fails.
