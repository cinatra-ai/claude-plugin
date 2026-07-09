---
name: cinatra-source-leak-discipline
description: "Ship cinatra planning-tracked work past the org source-leak gate without tripping it. Activates for: 'run the source-leak gate locally', 'make this PR branch gate-clean', 'the GSD planning-branch helper is not gate-clean', 'filter .planning out of a PR', 'the two-branch model', or before opening a PR on a gated cinatra repo. The planning-branch helper preserves the structural planning documents so it is NOT gate-clean — use a private planning branch (never pushed) plus a product branch cut fresh from the remote default with the product diff only, and prove it clean (no planning paths in the diff, run the repo gate locally) before opening the PR. Carry any post-merge-gate squash-marker in the squash body."
when_to_use: "Trigger phrases: \"source-leak gate\", \"source leak gate\", \"leak gate\", \"two-branch model\", \"gate-clean pr\", \"pr branch clean\", \"pr branch is clean\", \"filter .planning\", \"filter planning from a pr\", \"gsd-pr-branch\", \"squash marker\", \"squash body marker\", \"squash-marker trap\", \"skills-drift marker\", \"post-merge gate marker\"."
argument-hint: "[--check]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-source-leak-discipline

## Objective

Get planning-tracked work past the org source-leak gate cleanly. Use the
two-branch model: a private planning branch that is never pushed, and a product
branch cut fresh from the remote default branch carrying only the product diff —
no planning paths, no provenance tokens, in files, commit messages, or the branch
name. The GSD planning-branch helper preserves the structural planning documents,
so it is NOT gate-clean on its own. Before opening a PR, prove the product branch
clean: the name-only diff against the remote default branch shows zero planning
paths, and the repo's own gate (plus the pack's static gate) runs green locally.
Carry any post-merge-gate squash-marker in the squash body, not only on the PR
head.

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

## What this is

The OPERATIONAL discipline for shipping planning-tracked work past the org
**source-leak gate** without tripping it: run the gate locally first, and use the
**two-branch model** because the GSD planning-branch filter is NOT gate-clean on
its own. The sibling skill `cinatra-gsd-planning-hygiene` owns the POLICY (what the
banned tokens are and why planning stays local); this skill owns the MECHANICS.

## The source-leak gate (what it is)

The org ships a reusable **source-leak gate** as a required check (it lives in the
org CI repo and is consumed by each repo through a thin per-repo caller — there is
no org-wide auto-apply; every gated repo commits its own caller). It bans, in
tracked content:

- planning-working-directory paths;
- planning/provenance tokens (ordinal build-stage numbers, requirement / task /
  workstream ids, roadmap / state / spec reference tokens);
- bare milestone version strings (a `vMAJOR.MINOR.PATCH` — and it fires **even for
  a third-party version**, so phrase versions as prose).

It runs on a **line-ratchet**: existing grandfathered planning debt is tolerated,
but any NEW banned line blocks. Its required-check context string is frozen
(workflow-name / job-id) so one context can be required everywhere and a pinned
SHA bump never changes it.

## Why the planning-branch filter is NOT enough

The GSD planning-branch helper filters *transient* planning commits, but it
**deliberately preserves the structural planning documents** (the roadmap / state
/ project / requirements documents and the milestone directory). Those structural
files carry exactly the provenance tokens the gate bans. So running the
planning-branch helper and opening a PR from its output will **still trip the
gate** — the helper was never designed to produce a gate-clean branch.

## The TWO-BRANCH model (the fix)

Separate the planning history from the product history:

1. **Planning branch** — do ALL planning / execution commits here. This branch is
   **private and never pushed, never PRed.** It holds the planning working-set and
   its provenance.
2. **Product branch** — cut a **fresh branch from the remote default branch** and
   apply only the product diff (implementation + tests + docs). It carries **no
   planning paths and no provenance tokens** — in its files, its commit messages,
   or its branch name. The planning context goes in the PR description (the
   contributor-readable record), never in the tracked tree.

Build the product branch deliberately clean — do not try to "scrub" a planning
branch into shape.

## Prove it clean BEFORE opening the PR

Before you open a PR on a gated repo, prove the product branch is clean:

- **No planning paths in the diff.** The set of files changed vs the remote
  default branch contains zero planning-working-directory paths:

  ```sh
  git fetch origin
  git diff --name-only "origin/<default-branch>...HEAD"   # must show no planning paths
  ```

- **Run the repo's gate locally** with the repo's own profile (each gated repo
  carries its gate caller + config; run the same check the required check runs)
  so a finding is caught on your machine, not in CI.

- **The pack's own static gate** catches local/stale/private tokens in any
  authored doctrine before it ships:

  ```sh
  node "$HOME/.claude/dev-core/bin/dev-tools.cjs" delocalize --scan <paths>
  ```

- **Commit messages and the PR / squash title carry no banned token.** A
  provenance token in a commit message or squash title trips the gate (and the
  post-merge run on the default branch) just like one in a file.

## Net-new lines are policed EVERYWHERE you write — carry the self-check in every lane prompt

The gate's two hottest bans — a bare milestone version token (the letter `v`
followed by `digits.digits`) and ANY reference to the private engineering
tracker — bite on every NET-NEW line an agent writes into a PUBLIC repo:
source, docs, commit messages, PR-body drafts, AND issue/PR **comments**. The
repeated real-world trips this milestone were not tracked files at all — they
were lane-agent comments on public issues/PRs (five separate trips in one day,
each caught only after it landed). Two disciplines close that hole:

- **Every lane/agent prompt that can write to a public repo carries the leak
  self-check VERBATIM** (no bare version tokens — write "this milestone" / "the
  current release" instead; no private-engineering references in any form).
  A lane brief without the self-check is the defect; do not rely on the agent
  remembering doctrine it was never handed.
- **Comments are pre-checked like diffs.** Before posting any comment to a
  public repo, run the same token scan over the comment text you would run over
  a diff. The PRIVATE repos are exempt — write freely there.

## The squash-marker trap (a related gate)

A separate org gate (the **skills-drift gate** on a watched-skill surface) runs
not only on the PR but also on the push to the default branch, and on that push it
reads the **squash commit message of the merged range**. A squash **discards the
individual commit messages** and uses the squash body. So any post-merge-gate
marker the PR head carried (a skills-review / paired-PR / unaffected marker) is
**lost unless it is written into the SQUASH BODY**. Carry every such marker in the
squash body, not only on the PR head commit — otherwise the post-merge run reds the
default branch even though the PR check was green. (Same shape as the attribution
trailer: squash bodies must carry every post-merge-gate marker.)

A direct-push correction cannot green a post-merge gate on a protected default
branch (no PR context). The sanctioned recovery is **green-tip-supersedes**: the
next PR's push-event run, with a correct marker (or touching no watched surface),
clears it.

## Source / acceptance matrix (this skill)

| source doctrine | acceptance check |
|---|---|
| the org source-leak gate (reusable, per-repo caller, frozen context, line-ratchet, bans planning paths + provenance tokens + bare version strings incl. third-party) | the skill describes the gate generically (no private issue refs, no pinned SHAs as provenance); names the line-ratchet + frozen-context behaviors |
| the planning-branch helper is NOT gate-clean (it preserves structural planning documents) | the skill states the helper preserves the structural planning docs and therefore is not gate-clean |
| the two-branch model (private planning branch never pushed; product branch fresh from the remote default with product diff only) + prove-clean-before-PR | the skill gives the two-branch split and the pre-PR proof steps (name-only diff vs the remote default branch; run the repo gate locally; the pack static gate; clean commit/squash titles) |
| the skills-drift squash-marker trap (post-merge run reads the squash body; marker on the PR head is discarded) | the skill states the marker must live in the squash body and that the recovery is green-tip-supersedes |
| net-new-line scope: version tokens / private-tracker refs trip the gate from comments and commit messages too; repeated lane-comment trips (this milestone's closeout, recorded on the skills-update wave issue) | the skill states the every-surface scope, the lane-prompt self-check requirement, and the pre-post comment scan |
