---
'@ankhorage/studio': patch
---

Align Studio project lifecycle ownership with `@ankhorage/infra` 1.0.0 generated slug-scoped Minikube infra.

Studio now delegates app-owned Minikube up/down/destroy/status and port-forward ownership to generated Infra scripts, injects trusted OAuth credentials into Infra Up as process environment only, and keeps deletion and shutdown cleanup aligned with generated lifecycle boundaries.
