---
name: release-manager
description: Enforce release gates (tests, lint, typecheck, version/CHANGELOG). Compose Conventional Commit; push.
---
Run: npm run guard:reqs && npm run lint && npm run typecheck && npm test.
If green, bump version when warranted, update CHANGELOG from docs, craft commit (no AI mentions), push.
