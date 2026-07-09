---
name: cinatra-gsd-planning-hygiene
description: "Apply the cinatra org GSD-usage and planning-hygiene rules. Activates for: 'GSD planning hygiene', 'keep .planning local', 'planning artifacts stay untracked', 'no planning/provenance tokens in commits', 'milestone naming', 'run a completeness sweep', or any cinatra planning-hygiene question. Planning artifacts are strictly local + gitignored + never pushed; no planning/provenance token (planning-folder paths, build-stage ordinals, requirement/task ids, roadmap/state/spec refs, milestone version strings) ever leaks into committed code, comments, commit messages, branch names, or PR titles; the loop never runs the autonomous or complete-milestone commands and keeps a milestone open. Includes the pre-build completeness sweep with adversarial Codex validation."
when_to_use: "Trigger phrases: \"planning hygiene\", \"gsd planning hygiene\", \"gsd hygiene\", \"keep .planning local\", \".planning local\", \"planning artifacts local\", \"planning artifacts untracked\", \"planning provenance tokens\", \"provenance tokens\", \"milestone naming\", \"completeness sweep\"."
argument-hint: "[--completeness-sweep]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-gsd-planning-hygiene

## Objective

Keep cinatra planning artifacts strictly local and untracked, and keep every
planning/provenance token out of the published surface (committed code, comments,
commit messages, branch names, PR titles). Apply the org GSD-usage rules: a
milestone is named for the work-tracking project it drives, phases are per-repo, the loop never
runs the autonomous or complete-milestone commands, and a milestone stays open
until it is deliberately retired. When planning a non-trivial change, run the
pre-build completeness sweep and validate it adversarially with a captured Codex
round before building.

## What this is

How the cinatra loop and its contributors use a GSD install for org work, and
the hygiene rules that keep planning/provenance out of the published surface. The
pack co-exists with a live GSD install; this skill is the *org usage policy*, not
the GSD product itself.

## GSD usage in this org

- **Milestone naming follows the work-tracking project it drives** — a milestone
  exists to drive one project's work, so its name is that project's name (not an
  invented label).
- **Per-repo phases.** Each repo carries its own planning phases for its slice of
  a milestone; phases are a per-repo local working device, never a cross-repo
  shared artifact.
- **The loop keeps a milestone OPEN.** The autonomous loop never runs the
  whole-milestone autonomous command or the complete-milestone / archive command
  on its own — closing or archiving a milestone is an explicit, deliberate act,
  not loop-automatic. The loop advances work, it does not unilaterally retire a
  milestone.
- Planning context (the WHY, the design notes, the working plan) belongs in the
  issue and PR descriptions — the durable, contributor-readable record — not in
  committed code, comments, or commit metadata.

## Planning artifacts are strictly LOCAL (the core rule)

The planning working-set is **strictly local and untracked** in every cinatra-ai
repo:

- The planning working directory is listed in the repo's `.gitignore` (and in the
  org's baseline ignore template) and is **never tracked, never committed, never
  pushed**. It exists only on the working machine.
- The org policy is that planning/provenance is **invisible on the remotes**. A
  tracked planning file appearing on a remote is a violation to fix (untrack it
  with a `--cached` removal so the local copy survives), not a state to accept.
- Filesystem walkers and scanners keep their skip-entry for the planning directory
  (the org leak gate already excludes it) — the local untracked working-set still
  exists on disk and tooling must step over it.
- Planning working notes live only on local-only working branches; those branches
  are never pushed.

## No planning/provenance tokens in the published surface

A **planning/provenance token must never leak into committed content** — not into
tracked code, comments, commit messages, branch names, or PR / squash titles. The
banned token classes:

- planning-working-directory **paths** (any reference to the local planning folder
  by its on-disk path);
- ordinal **build-stage** identifiers (a numbered planning phase);
- **requirement / task / workstream** identifiers (the planning-system's internal
  item tags);
- planning-document and methodology **reference tokens** (the names of the planning
  roadmap / state / spec documents, used as provenance markers);
- **milestone version strings** used as provenance (a bare `vMAJOR.MINOR.PATCH`
  fires even when it names a third-party version — phrase versions so they read as
  prose, not as a provenance tag).

The org **source-leak gate** enforces these classes on a line-ratchet: an existing
grandfathered planning reference is tolerated, but any NEW banned line blocks. So
the discipline is *author the published surface clean from the start* — the gate
is the backstop, not the author.

> The sibling skill `cinatra-source-leak-discipline` owns the operational mechanics of
> getting a PR past that gate (the two-branch model + the local pre-PR gate run).
> This skill owns the POLICY: what the tokens are and why planning stays local.

## Completeness sweep (pre-build lenses + adversarial validation)

Before building a non-trivial change, run a **completeness sweep**: walk a fixed
set of lenses over the plan to surface what a first pass misses, then validate the
plan adversarially with a Codex round (the pack already enforces Codex pairing —
this reuses it; it does not restate the pairing mechanics).

The portable lenses (ground each example seam against current product docs at
authoring time — the seam *names* drift, the lenses do not):

- **Surface coverage** — every integration surface the change touches is
  accounted for (the tool/capability surface a change exposes; the
  authorization/permission kernel; the scope model the org layers work under
  — account / team / workspace / project; the object/artifact/context model; the
  extension → registry → marketplace lifecycle; durable execution and agents).
- **State + lifecycle** — creation, update, migration, and teardown paths; what a
  half-applied change leaves behind; idempotency on re-run.
- **Failure + degradation** — what happens when a dependency is absent, a remote
  is unreachable, or an external surface is unsupported; does it fail closed with
  a notice rather than silently degrade.
- **Verification surface** — can the change be proven on a REAL surface (not a
  stub), with seeded fixtures, at the exact reviewed revision.
- **Boundaries** — public vs private surface; what must not leak; the
  destination-first ordering when a change spans coupled repos.

Then converge the swept plan with Codex (read-only, STDIN, captured verdict) and
fold the findings before building. A completeness sweep that is not adversarially
validated is incomplete.
