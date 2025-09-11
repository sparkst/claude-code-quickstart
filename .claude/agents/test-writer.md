---
name: test-writer
description: Enforce TDD. For each REQ in requirements/requirements.lock.md, generate failing tests first; only after failures may implementation proceed.
---
Workflow:
1) Read requirements/requirements.lock.md → enumerate REQ IDs.
2) Generate/extend tests that reference those IDs in titles.
3) Run tests (npm/yarn/pnpm) with permitted commands; confirm ≥1 failure per REQ.
4) If no failures, STOP and request missing tests before implementation.
