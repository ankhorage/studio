---
'@ankhorage/studio': patch
---

Keep global-auth startup out of Studio administration, require a real authenticated session for generated `/ankh` routes, and fail those routes closed for integrated or disabled auth scopes.
