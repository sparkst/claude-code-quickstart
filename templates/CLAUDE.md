# Claude Code Guidelines (Sparkry Revamp)

> **Purpose**: lock in consistent TDD, keep requirements front‑and‑center, and wire Claude Code’s **sub‑agents** to your **QShortcuts** so the right specialist runs at the right time—safely, predictably, and fast.

---

## Table of Contents
1. Principles (tightened)
2. Requirements Discipline (the “requirements.lock” pattern)
3. TDD Enforcement Flow
4. QShortcuts (verbatim) + Agent Guidance
5. Sub‑Agent Suite (definitions live under `.claude/agents/`)
6. Permissions & Modes (`.claude/settings.json`)
7. Progressive Documentation (unchanged templates)

---

## 1) Principles (tightened)

### 0 — Purpose
Ensure maintainability, safety, and developer velocity. **MUST** rules are CI‑enforced; **SHOULD** rules are strongly recommended.

### 1 — Before Coding
- **BP‑1 (MUST)** Ask clarifying questions when requirements are ambiguous.
- **BP‑2 (MUST)** Draft/confirm an approach for non‑trivial work; record acceptance criteria under **`requirements/current.md`**.
- **BP‑3 (SHOULD)** If ≥2 approaches exist, list pros/cons and choose the simplest that meets the requirements.

### 2 — While Coding
- **C‑1 (MUST)** **TDD**: create a failing test that references requirement IDs **before** implementation.
- **C‑2 (MUST)** Use domain vocabulary for names; prefer small, composable, pure functions.
- **C‑3 (MUST)** Type safety: branded `type`s for identifiers; `import type { … }` for type‑only imports.
- **C‑4 (SHOULD NOT)** Add comments except for hard caveats; code should explain itself.
- **C‑5 (SHOULD)** Prefer `type` over `interface` unless interface merging/readability wins.

### 3 — Testing
- **T‑1 (MUST)** Co‑locate unit tests as `*.spec.ts` near sources; separate integration tests.
- **T‑2 (MUST)** Any API change extends integration tests; avoid heavy mocks.
- **T‑3 (MUST)** Tests should cite requirement IDs (e.g., `REQ‑123`) in titles.
- **T‑4 (SHOULD)** Favor property‑based tests for algorithmic code.

### 4 — Database
- **D‑1 (MUST)** DB helpers type to work with connections and transactions.
- **D‑2 (SHOULD)** Override incorrect generated types with docs.

### 5 — Organization
- **O‑1 (MUST)** Share code only when used by ≥2 modules.
- **O‑2 (SHOULD)** Organize by feature (e.g., `user/`), not layers.

### 6 — Docs & Discoverability
- **DOC‑1 (MUST)** Self‑documenting code first.
- **DOC‑2 (MUST)** Domain READMEs per feature; root README is the map.
- **DOC‑3 (SHOULD)** `.claude-context` for complex domains.
- **DOC‑4 (MUST)** Conventional commits.

### 7 — Tooling Gates
- **G‑1 (MUST)** prettier, lint, and typecheck green.
- **G‑2 (MUST)** Tests green locally before `qgit`.

---

## 2) Requirements Discipline: `requirements.lock` Pattern

**Goal:** Stop forgetting requirements mid‑flow.

- Keep **canonical acceptance criteria** in `requirements/current.md`.
- At the start of any non‑trivial task (`qnew`/`qplan`), snapshot to **`requirements/requirements.lock.md`**.
- Tests must reference **REQ IDs** defined in the lock file headings:
  - Example heading: `## REQ‑123: User can reset password via email link`.
  - Example test title: `REQ‑123 — sends token with 15‑min TTL`.

Minimal template (`requirements/current.md`):
```markdown
# Current Requirements

## REQ-101: <Concise requirement>
- Acceptance: <bullet points>
- Non-Goals: <optional>
- Notes: <links>

## REQ-102: <...>
```

The lock file (`requirements/requirements.lock.md`) is a snapshot from `current.md` for the active task and is regenerated per task.

---

## 3) TDD Enforcement Flow

1. **QNEW/QPLAN** → Agents: **planner** + **docs-writer**
   - Planner extracts REQ IDs and writes `requirements/current.md`.
   - Snapshot to `requirements/requirements.lock.md`.
2. **QCODE** → Agent: **test-writer** (first)
   - Generates failing tests for each REQ‑ID in the lock; runs tests; confirms failures.
   - Only then may implementation proceed.
3. **QCODE (implement)** → Main or **debugger** as needed
   - Implement minimal code to satisfy the failing tests.
4. **QCHECK/QCHECKF/QCHECKT** → Agent: **PE-Reviewer** (+ **security-reviewer** if touching IO/auth/network/fs/templates)
5. **QDOC** → **docs-writer** updates READMEs/CHANGELOG from diffs & REQ lock.
6. **QGIT** → **release-manager** verifies gates: tests, lint, types, versioning, CHANGELOG.

If any step misses REQ coverage, **test-writer** blocks and prompts to add the missing failing test.

---

## 4) QShortcuts (verbatim) + Agent Guidance

> Use these exactly in chat. The agents’ descriptions include when they should activate for each shortcut.

### QNEW
```
Understand all BEST PRACTICES listed in CLAUDE.md.
Your code SHOULD ALWAYS follow these best practices.
```
**Agents:** planner → docs-writer (snapshot requirements.lock)

### QPLAN
```
Analyze similar parts of the codebase and determine whether your plan:
- is consistent with rest of codebase
- introduces minimal changes
- reuses existing code
```
**Agent:** planner

### QCODE
```
Implement your plan and make sure your new tests pass.
Always run tests to make sure you didn't break anything else.
Always run `prettier` on the newly created files to ensure standard formatting.
Always run your project's type checking and linting commands (e.g., `npm run typecheck`, `npm run lint`, or `turbo typecheck lint`).
```
**Agents:** test-writer (first; must create failing tests), then debugger as needed

### QCHECK
```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR code change you introduced (skip minor changes):

1. CLAUDE.md checklist Writing Functions Best Practices.
2. CLAUDE.md checklist Writing Tests Best Practices.
3. CLAUDE.md checklist Implementation Best Practices.
```
**Agents:** PE-Reviewer (+ security-reviewer when touching auth/network/fs/templates/db/crypto)

### QCHECKF
```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR function you added or edited (skip minor changes):

1. CLAUDE.md checklist Writing Functions Best Practices.
```
**Agent:** PE-Reviewer

### QCHECKT
```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR test you added or edited (skip minor changes):

1. CLAUDE.md checklist Writing Tests Best Practices.
```
**Agents:** PE-Reviewer + test-writer (suggestions)

### QUX
```
Imagine you are a human UX tester of the feature you implemented. 
Output a comprehensive list of scenarios you would test, sorted by highest priority.
Provide enough details that a human UX tester can run the tests independently
```
**Agent:** ux-tester

### QDOC
```
You are an expert technical writer.  Review the work we just did and ensure it is fully documented based on the project's Progressive Documentation Guide below. Output that documentation per the guide.
```
**Agent:** docs-writer

### QGIT
```
Add all changes to staging, create a commit, and push to remote.

Follow this checklist for writing your commit message:
- SHOULD use Conventional Commits format: https://www.conventionalcommits.org/en/v1.0.0
- SHOULD NOT refer to Claude or Anthropic in the commit message.
- SHOULD structure commit message as follows:
<type>[optional scope]: <description>
[optional body]
[optional footer(s)]
- commit SHOULD contain the following structural elements to communicate intent: 
fix: a commit of the type fix patches a bug in your codebase (this correlates with PATCH in Semantic Versioning).
feat: a commit of the type feat introduces a new feature to the codebase (this correlates with MINOR in Semantic Versioning).
BREAKING CHANGE: a commit that has a footer BREAKING CHANGE:, or appends a ! after the type/scope, introduces a breaking API change (correlating with MAJOR in Semantic Versioning). A BREAKING CHANGE can be part of commits of any type.
types other than fix: and feat: are allowed, for example @commitlint/config-conventional (based on the Angular convention) recommends build:, chore:, ci:, docs:, style:, refactor:, perf:, test:, and others.
footers other than BREAKING CHANGE: <description> may be provided and follow a convention similar to git trailer format.
```
**Agent:** release-manager

---

## 5) Writing Functions Best Practices (restored)

When evaluating whether a function you implemented is good or not, use this checklist:

1. Can you read the function and HONESTLY easily follow what it's doing? If yes, then stop here.
2. Does the function have very high cyclomatic complexity? (number of independent paths, or, in a lot of cases, number of nesting if if-else as a proxy). If it does, then it's probably sketchy.
3. Are there any common data structures and algorithms that would make this function much easier to follow and more robust? Parsers, trees, stacks / queues, etc.
4. Are there any unused parameters in the function?
5. Are there any unnecessary type casts that can be moved to function arguments?
6. Is the function easily testable without mocking core features (e.g. sql queries, redis, etc.)? If not, can this function be tested as part of an integration test?
7. Does it have any hidden untested dependencies or any values that can be factored out into the arguments instead? Only care about non-trivial dependencies that can actually change or affect the function.
8. Brainstorm 3 better function names and see if the current name is the best, consistent with rest of codebase.

IMPORTANT: you SHOULD NOT refactor out a separate function unless there is a compelling need, such as:
  - the refactored function is used in more than one place
  - the refactored function is easily unit testable while the original function is not AND you can't test it any other way
  - the original function is extremely hard to follow and you resort to putting comments everywhere just to explain it

---

## 6) Writing Tests Best Practices (restored)

When evaluating whether a test you've implemented is good or not, use this checklist:

1. SHOULD parameterize inputs; never embed unexplained literals such as 42 or "foo" directly in the test.
2. SHOULD NOT add a test unless it can fail for a real defect. Trivial asserts (e.g., expect(2).toBe(2)) are forbidden.
3. SHOULD ensure the test description states exactly what the final expect verifies. If the wording and assert don't align, rename or rewrite.
4. SHOULD compare results to independent, pre-computed expectations or to properties of the domain, never to the function's output re-used as the oracle.
5. SHOULD follow the same lint, type-safety, and style rules as prod code (prettier, ESLint, strict types).
6. SHOULD express invariants or axioms (e.g., commutativity, idempotence, round-trip) rather than single hard-coded cases whenever practical. Use `fast-check` library e.g.
```ts
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { getCharacterCount } from './string';

describe('properties', () => {
  test('concatenation functoriality', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (a, b) =>
          getCharacterCount(a + b) ===
          getCharacterCount(a) + getCharacterCount(b)
      )
    );
  });
});
```
7. Unit tests for a function should be grouped under `describe(functionName, () => ...`.
8. Use `expect.any(...)` when testing for parameters that can be anything (e.g. variable ids).
9. ALWAYS use strong assertions over weaker ones e.g. `expect(x).toEqual(1)` instead of `expect(x).toBeGreaterThanOrEqual(1)`.
10. SHOULD test edge cases, realistic input, unexpected input, and value boundaries.
11. SHOULD NOT test conditions that are caught by the type checker.

---

## 7) Permissions & Modes (`.claude/settings.json`)

- Default mode: `acceptEdits` (no destructive ops).
- Narrow write scope to repo files; deny secrets and dangerous commands.

---

## 8) Progressive Documentation (templates)

(Kept from the previous version; unchanged apart from brevity.)

**Root `README.md`**
```markdown
# Project Name

## Mental Model
One‑paragraph purpose.

## Entry Points
- `src/auth/` — authN/Z
- `src/api/` — HTTP endpoints
- `src/core/` — domain logic
- `src/ui/` — UI components

## Getting Started
<dev setup>

## Architecture
Short overview; details in domain READMEs.
```

**Domain `README.md`**
```markdown
# [Domain]

## Purpose
What and why.

## Boundaries
What’s in vs. out.

## Key Files
- `types.ts` — core types
- `service.ts` — business logic
- `api.ts` — integrations
- `__tests__/` — tests

## Patterns
Idioms to follow.

## Dependencies
Upstream/downstream domains.
```

**`.claude-context`**
```
Domain: [Feature]
Purpose: [Brief]

Key Concepts:
- [Concept]: [Explanation]

Important Files:
- [file.ts]: [What it does]

Common Tasks:
- "Add new [thing]": Start in [file.ts]

Gotchas:
- [List]

Dependencies: [List]
```
