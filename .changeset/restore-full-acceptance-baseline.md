---
'@ankhorage/studio': patch
---

Restore generated-app and standalone registry acceptance by emitting formatter-stable Auth screen imports, validating owner ranges from the installed Studio dependency graph, aligning the Expo 57.0.23 consumer contract, allowing Metro to crawl nested package-owned dependencies instead of excluding them with a custom node_modules blocklist, and requiring the released Infra 5.1.5 destroy semantics so deleting a never-provisioned project remains idempotent without provider resolution.
