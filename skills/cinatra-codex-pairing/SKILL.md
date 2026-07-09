---
name: cinatra-codex-pairing
description: "Converge a cinatra plan or change with Codex before finalizing. Activates for: 'converge with codex', 'codex round-0 / review', 'pair with codex', running 'codex exec', 'is this MERGE-SAFE', or before finalizing any cinatra plan/diff. Codex runs read-only via STDIN only (argv hangs); the verdict is captured to a file (never tail-piped); at most 3 diff rounds; report divergence honestly."
when_to_use: "Trigger phrases: \"converge with codex\", \"codex round-0\", \"codex review\", \"pair with codex\", \"codex exec\", \"merge-safe\", \"is this merge-safe\"."
argument-hint: "[--round-0 | --review]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-codex-pairing

## Objective

Drive a Codex convergence round on a cinatra plan or diff: read-only sandbox,
STDIN-only invocation (argv hangs), capture the verdict to a file (capture, not
tail-pipe), at most 3 diff rounds, adopt or rebut each finding, and report any
unresolved divergence honestly. Never label a recommendation "codex-converged"
without a captured, verified verdict that answers the exact question asked.

> The following block is the canonical shared reference `ref-evidence-recipe.md`, inlined here so this skill is self-contained (the cinatra evidence/state-vocabulary doctrine is load-bearing and must always be present when the skill loads).

# Reference: evidence / verification recipe (the ONE contract)

> Shared reference (codex finding 11). The single source of truth for "what
> counts as proof". Several skills in this pack `@`-include this rather than
> restating it — including `cinatra-doctor` (what a green check means) and
> `cinatra-real-surface-verification` (the verify-stack recipe — its single
> canonical copy lives here).

## What counts as proof

- **Real surface, not a stub.** A check that passes on a green stub proves
  nothing; a conditional stub can mask a real boot crash. Drive the real path.
- **CONCLUDED checks only.** A pending required check is treated as missing. Read
  any RED before acting.
- **The exact head SHA.** Bind a verdict / verify run to the specific commit;
  `--match-head-commit` on the merge side is the correctness backstop.
- **Audit `via:` for OBO vs bypass.** A content-write "proof" authorized by a
  trusted-dev-host admin bypass is NOT production-parity — check the audit actor.
- **Capture, not tail.** Capture command output to a file; a tail-piped or
  filename-collided run is not evidence.
- **Verify the mutation landed.** Confirm the real remote/merge state (remote
  HEAD == pushed SHA; PR state == MERGED); never trust a piped exit code.

## Verify-stack recipe (single canonical copy)

The reusable local verification stack: a dedicated postgres + redis on
dedicated ports, an `.env.local` template, a per-worktree dev port + queue name
so parallel worktrees don't collide, and seeded fixtures. Spin-up to live-prove a
fix is pre-authorized for authoritative read tooling. The concrete ports/template
are filled in by the environment-setup skill(s), which reference THIS recipe so
there is exactly one definition.

## Discipline (non-negotiable)

- Codex runs **read-only** and **advisory**.
- Invoke via **STDIN only**: `codex exec --skip-git-repo-check < prompt.txt`.
  Passing the prompt as an argv **hangs** — never do it.
- **Capture** the verdict to a file; **never** tail-pipe it (a tail-piped or
  filename-collided run is not a captured verdict).
- At most **3** diff rounds. Adopt or rebut each finding; fold adoptions into the
  change. Report any unresolved divergence **honestly** — never label a
  recommendation "codex-converged" without a captured verdict that answers the
  exact question asked.
- At merge time the question is **MERGE-SAFE**; for a plan it is round-0 design
  convergence.

## Mechanics

The pack ships a bridge so the discipline cannot drift to a hanging argv call:

```sh
node "$HOME/.claude/dev-core/bin/lib/codex-bridge.cjs"   # buildCodexArgs / runCodex
```

`runCodex({ prompt, outputFile })` feeds the prompt on STDIN and writes the
combined output to `outputFile` (capture-not-tail).

## Issue-body mode (converge the issue TEXT, not a plan or diff)

When authoring an issue via your issue-authoring workflow, converge the
synthesized issue TEXT with Codex before it is written, the same way you
converge a plan or a diff — read-only, STDIN only, capture the verdict:

- Feed Codex the proposed title + body and the exact question: "Is this issue grounded,
  unambiguous, correctly scoped to the right repo, and free of stale premises or
  leak-unsafe content?" Adopt or rebut each finding; fold adoptions into the body.
- Scope the rounds to the issue's weight: a trivial one-line bug needs no round; a
  feature, an epic, or a cross-repo issue gets a round-0 convergence before it is filed.
- The same capture-not-tail and STDIN-only discipline applies; never label an issue body
  "codex-converged" without a captured verdict answering that exact question.
