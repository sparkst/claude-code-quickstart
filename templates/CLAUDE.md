# CLAUDE.md — Sparkry.AI House Rules

## Principles
- **Ask/Plan first.** Clarify goals/constraints; propose options with trade-offs; await approval.
- **TDD by default.** Write/extend a failing test, then implement; prefer integration over heavy mocks.
- **Small diffs.** Read first; change the minimum; align with repo vocabulary.
- **Security-forward.** Don’t touch `.env`, keys, `~/.ssh/**`, or secret stores. Ask before any Bash/edit.

## Before coding
- Confirm user story + constraints; propose the **simplest reversible plan** & risks.
- State test strategy and success criteria.

## While coding
- TDD loop: scaffold → fail test → implement → pass tests → self-review.
- Keep types clear; don’t add abstractions without reuse/testability benefits.

## Testing
- Unit tests near source; integration/API tests in project test dirs.
- Prefer meaningful assertions; cover edges; avoid tests redundant with types.

## Tooling gates (before proposing commit)
- formatter check, lint, typecheck, and all modified tests pass locally.

## Git hygiene
- Conventional Commits; messages about code/intent (no AI chatter).
- Keep commits focused and easy to revert.

## Short prompts (rhythm)
- **qnew**  → Summarize how you’ll apply these rules now.
- **qplan** → Validate plan vs. codebase norms; ensure minimal change.
- **qcode** → Implement approved plan; ensure gates/tests pass.
- **qcheck**/**qcheckf**/**qcheckt** → Self-review (all/functions/tests).
- **qux**   → Manual UX test checklist for the change.

## Safety bumpers
- Default **Plan Mode**; don’t edit/run Bash without approval.
- Never use bypass modes unless explicitly instructed and time-boxed.

