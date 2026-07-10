---
name: cinatra-grounding
user-invocable: false
description: "Re-verify a cinatra issue's stated assumptions against the LIVE code before planning or implementing. Activates for: 'ground this issue', 'is this still true', 'check the live code', 'verify the assumptions before planning', 'this checkout might be stale', or any issue-body claim about code state ('X still calls Y', 'feature Z is missing'). Always fetch origin and read the default branch (local clones drift behind) and cross-check a 'missing feature' claim against already-merged PRs; deviate from the issue only with Codex agreement and a note on the issue."
when_to_use: "Trigger phrases: \"ground this issue\", \"is this still true\", \"check the live code\", \"verify the assumptions before planning\", \"this checkout might be stale\", \"stale checkout\", \"ground the assumptions\", \"is the issue premise still valid\"."
argument-hint: "[<owner/repo#N> | <assumption to check>]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-grounding

## Objective

Before planning or implementing any cinatra issue, confirm its stated assumptions
still hold in the CURRENT code. Fetch origin and read the default branch (never a
possibly-stale local working tree), cross-check any "missing" or "still calls Y"
claim against the already-merged PR list, and if an assumption is wrong, correct
course — but only with Codex agreement and a note recorded on the issue. A
confident-but-stale fact poisons every downstream decision.

> The following block is the canonical shared reference `ref-evidence-recipe.md`, inlined here so this skill is self-contained (the cinatra evidence/state-vocabulary doctrine is load-bearing and must always be present when the skill loads).

# Reference: evidence / verification recipe (the ONE contract)

> Shared reference. The single source of truth for "what
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
- **Audit `via:` for a real authorization vs an admin bypass.** A content-write
  "proof" authorized by a privileged admin-bypass path is NOT
  production-parity — check the audit actor.
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

## The grounding rule

Before planning or implementing any issue, ground it in the current codebase:
read the relevant code and check that the issue's stated assumptions still hold —
they DRIFT. If one is wrong, correct course (overrule the issue) **only with Codex
agreement**, and record a note of the correction on the issue. A wrong premise
caught at grounding time is far cheaper than one discovered mid-implementation.

## The stale-checkout trap (read the fetched default branch, not the local tree)

The autonomous loop does its real work in worktrees branched from the remote
default branch, so the parent clones' local default branch is rarely pulled and
drifts continuously — often many commits behind. **Grepping a local working tree
for grounding produces WRONG facts.** A "this still calls the old API / this
feature is missing" claim read off a stale tree is reading history, not current
state.

Apply:

1. Before grounding code state, `git -C <repo> fetch origin -q` and read the
   **remote default branch** (`git show origin/<default>:<path>`, or
   `git -C <repo> grep -n <pattern> origin/<default> -- <path>`) — not the local
   working tree.
2. A ground-phase that greps the bare local checkout is reading the wrong thing —
   fetch first, or do the work in a worktree branched from the remote default
   branch.
3. Cross-check a load-bearing "X does not exist / still calls Y" claim against the
   **already-merged PR list** before asserting it — a "missing" feature is often
   already merged and waiting on the local clone to catch up.
4. When two readings disagree (one says "absent", one says "already merged"), the
   one that FETCHED origin wins — re-verify directly.
5. Periodically fast-forward the active clones so inline greps stay trustworthy.

## Deviating from the issue

A grounded deviation is allowed, but it is not unilateral: it requires Codex
agreement (the convergence discipline) and an explicit note on the issue so the
record shows WHY the implementation departed from the written assumption.

## Pre-create mode (ground an issue's premise BEFORE it is authored)

Grounding is not only for issues you are about to implement — it also gates issue
AUTHORING, wherever your issue-authoring workflow lives. Before writing an
issue from a rough intent, re-verify every load-bearing claim the intent makes about
code state against the LIVE default branch:

1. Fetch origin and read `origin/<default>` (never a possibly-stale local tree) for each
   "X still calls Y" / "feature Z is missing" / "the code does W" claim the intent rests on.
2. Cross-check any "missing"/"already removed" claim against the already-merged PR list —
   a feature the intent calls absent is often already merged and just not pulled locally.
3. If a premise is wrong, correct it IN THE ISSUE BODY (and note the correction) rather
   than filing an issue that is born on a stale assumption — only with Codex agreement
   where the correction is a real judgment call.

An issue grounded at authoring time costs far less than one discovered wrong mid-implementation.
