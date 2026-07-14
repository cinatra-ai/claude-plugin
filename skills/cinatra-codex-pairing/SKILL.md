---
name: cinatra-codex-pairing
user-invocable: false
description: "Converge a cinatra plan or change with Codex before finalizing. Activates for: 'converge with codex', 'codex round-0 / review', 'pair with codex', running 'codex exec', 'is this MERGE-SAFE', or before finalizing any cinatra plan/diff. Codex inspects the SAME ground truth as the author — the real repo/worktree/files and the exact diff against a pinned base SHA — never a fed summary/subset, and grounds independently to form its own opinion. Codex runs read-only via STDIN only (argv hangs); the verdict is captured to a file (never tail-piped) together with the source it inspected; at most 3 diff rounds; report divergence honestly."
argument-hint: "[--round-0 | --review]"
allowed-tools:
  - Read
  - Bash
triggers:
  - "converge with codex"
  - "codex round-0"
  - "codex review"
  - "pair with codex"
  - "codex exec"
  - "merge-safe"
  - "is this merge-safe"
antiTriggers:
  - "claude code plugin"
  - "chat assistant skill"
  - "icd codex"
  - "manuscript codex"
  - "openai codex model"
---

# cinatra-codex-pairing

## Objective

Drive a Codex convergence round on a cinatra plan or diff: read-only sandbox,
STDIN-only invocation (argv hangs), capture the verdict to a file (capture, not
tail-pipe), at most 3 diff rounds, adopt or rebut each finding, and report any
unresolved divergence honestly. Codex judges the SAME authoritative source the
author has — the real repo/worktree/files and the exact diff against a pinned base
SHA — and grounds itself independently; a fed summary or subset may frame the
question but never substitutes for the source. Never label a recommendation
"codex-converged" without a captured, verified verdict that answers the exact
question asked.

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

## Discipline (non-negotiable)

- Codex runs **read-only** and **advisory** — the bridge pins `-s read-only`
  (`codex exec` defaults to a **writable** sandbox), so a convergence round can
  never write to the worktree it is reviewing.
- Invoke via **STDIN only**, and always through the bridge
  (`buildCodexArgs`/`runCodex` in `bin/lib/codex-bridge.cjs`), which pins the
  sandbox, model, and reasoning effort:
  `codex exec --strict-config --skip-git-repo-check -s read-only -m gpt-5.6-sol -c model_reasoning_effort=max < prompt.txt`.
  Passing the prompt as an argv **hangs** — never do it. The model tracks the
  **latest Codex** — currently GPT-5.6 "sol" (`gpt-5.6-sol`), resolved from the
  installed CLI, not a frozen guess — at **maximum reasoning effort**
  (`model_reasoning_effort=max`: the CLI's model catalog lists this model's
  levels as low/medium/high/xhigh/max/ultra, and `max` is the highest pure
  reasoning tier — `ultra` adds automatic task delegation, which would break the
  read-only, single-verdict, bounded-round contract, so `max` is pinned). Both flags are
  **always applied** under `--strict-config`, never left to the CLI default. If
  the installed CLI rejects the pinned model or effort — an invalid effort
  *value*, or (thanks to `--strict-config`) an unrecognized config *key* such as
  a future rename of `model_reasoning_effort` — the round **fails visibly**
  (non-zero exit → `ok:false`) rather than silently downgrading to the default.
- **Capture** the verdict to a file; **never** tail-pipe it (a tail-piped or
  filename-collided run is not a captured verdict).
- At most **3** diff rounds. Adopt or rebut each finding; fold adoptions into the
  change. Report any unresolved divergence **honestly** — never label a
  recommendation "codex-converged" without a captured verdict that answers the
  exact question asked.
- At merge time the question is **MERGE-SAFE**; for a plan it is round-0 design
  convergence.

## Same ground truth — Codex inspects the real source, not a fed subset

Codex must judge the **same authoritative source the author has** and ground itself
independently. A subset or summary may frame the *question*; it must never stand in
for the *source*. A verdict reached against different ground truth than the primary
inspected — a stale tree, a paraphrase, a substituted summary — is **not a
convergence**, however green it reads.

- **Same ground truth (run from the repo/worktree).** Invoke Codex read-only **from
  the relevant repo or worktree**, with read access to the real source — the actual
  files and the **exact diff against a pinned base SHA** (the specific commit the
  change forks from, not a bare `origin/main`, which may be a stale local ref).
  "Same ground truth" means access to the same authoritative *source*, not identical
  unstated human context. The handoff **points Codex at the concrete primary
  artifacts** it must judge, not at a description of them.
- **No subset substitution.** Never feed Codex a pre-digested summary **as** the
  ground truth. The named anti-pattern is prohibited: a prompt supplying the author's
  conclusions with "treat these facts as true / do not inspect the source." A summary
  may accompany and frame the *question*; it never replaces the *source*.
- **Independent opinion.** Codex does its OWN grounding and reaches its OWN verdict,
  and may disagree with the author's premises or framing. Do **not** pre-constrain it
  to your conclusion. You then adopt or rebut each finding (see Discipline), but never
  constrain Codex to the answer you want. Divergence is reported honestly.
- **Scope attention, don't close the evidence set.** Give Codex **bounded starting
  pointers to intact primary artifacts** while it retains read access to the relevant
  repo/worktree and permission to follow dependencies and inspect adjacent source.
  Scoping *attention* is allowed; imposing a *closed evidentiary subset* is not.
  STDIN-only invocation still holds (argv hangs) — the prompt carries the question
  plus the pointers, and Codex reads the source itself.
- **Mode-specific source (every mode).** Each pairing mode points Codex at the real
  artifact: round-0 **plan** → the actual plan document; **diff / MERGE-SAFE** → the
  exact diff against the pinned base SHA plus worktree access; **issue-body** → the
  full proposed title + body (see below).
- **Capture the source Codex saw.** Record, alongside the captured verdict, the
  pinned base SHA / worktree path / artifact the round actually inspected, so a
  reviewer can confirm Codex judged the same ground truth as the primary. A verdict
  that inspected a different tree or a substituted summary is not a valid convergence.
- **Private pairing IO stays private.** Prompts and captured verdicts that contain
  private code or content remain in approved private storage — never pasted into a
  public issue, log, or other public surface. This governs the pairing IO and
  complements the write-time leak partition; it does **not** restrict Codex's read
  access to the authoritative source it is judging.

## Mechanics

The pack ships a bridge so the discipline cannot drift to a hanging argv call —
and so every convergence round carries an explicit, auditable model + reasoning
effort:

```sh
node "$HOME/.claude/dev-core/bin/lib/codex-bridge.cjs"   # buildCodexArgs / runCodex
```

`buildCodexArgs()` always emits the pinned `-s read-only`, `-m <model>`, and
`-c model_reasoning_effort=<effort>` flags — the latest Codex model (currently
`gpt-5.6-sol`) at `max`, the maximum reasoning tier, in a read-only sandbox —
under `--strict-config`, never falling back to the CLI default (which is a
*writable* sandbox). A caller's `extraArgs` cannot escalate the sandbox or
override the pins — a last-write-wins override is rejected. `runCodex({ prompt, outputFile })` feeds the
prompt on STDIN, writes the combined output to `outputFile` (capture-not-tail)
with a header recording the pinned model + effort, and returns
`{ ok, code, model, reasoningEffort, … }` so the captured verdict is attributable
to a specific model and effort. A pinned model or effort the installed CLI
rejects — an invalid effort value, or an unrecognized config key (`--strict-config`
turns a silently-ignored key into a hard error) — surfaces as `ok:false` (a
visible failure), never a silent downgrade.

## Issue-body mode (converge the issue TEXT, not a plan or diff)

When authoring an issue via your issue-authoring workflow, converge the
synthesized issue TEXT with Codex before it is written, the same way you
converge a plan or a diff — read-only, STDIN only, capture the verdict:

- Give Codex the **full proposed title + body** (the whole artifact verbatim, never a
  summary of it) and the exact question: "Is this issue grounded, unambiguous, correctly
  scoped to the right repo, and free of stale premises or leak-unsafe content?" Per the
  same-ground-truth rule above, where the issue makes a claim about code state, point
  Codex at the repo so it can ground the premise itself rather than trust your framing.
  Adopt or rebut each finding; fold adoptions into the body.
- Scope the rounds to the issue's weight: a trivial one-line bug needs no round; a
  feature, an epic, or a cross-repo issue gets a round-0 convergence before it is filed.
- The same capture-not-tail and STDIN-only discipline applies; never label an issue body
  "codex-converged" without a captured verdict answering that exact question.
