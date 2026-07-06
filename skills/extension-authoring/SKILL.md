---
name: extension-authoring
description: "Run the full development lifecycle for one cinatra extension in Claude Code: discover before creating, collect the exact scaffold inputs, scaffold with the published cinatra CLI, route payload authoring to the kind specialist, validate after every change, drive PR/CI, and stop at a release-readiness report. Activates for: 'create a cinatra extension', 'new cinatra extension', 'scaffold a cinatra extension', 'cinatra create-extension', 'extension development lifecycle', 'author a cinatra connector', 'validate my extension', 'extension release readiness'. Reuse before new — never conclude 'none exist' from one search surface; scope is asked ONLY for connector and skill (agent/artifact/workflow are locked first-party); run node extension-kind-gate.mjs --package-root . plus npm pack --dry-run after EVERY change, never advance on invalid, cap fix retries at 3; the workflow kind is scheduled for removal (cinatra#1030) — do not start new ones; a pushed tag equal to v<package.json.version> (or the published GitHub Release carrying it, on newer workflow generations) IS the marketplace publish trigger — report release-readiness only, never push such a tag, create or publish a GitHub Release, or publish."
argument-hint: "[agent | connector | artifact | skill | workflow] [name]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
triggers:
  - "create a cinatra extension"
  - "new cinatra extension"
  - "scaffold a cinatra extension"
  - "cinatra create-extension"
  - "extension development lifecycle"
  - "author a cinatra connector"
  - "validate my extension"
  - "extension release readiness"
antiTriggers:
  - "claude code plugin"
  - "chat assistant skill"
  - "browser extension"
  - "vscode extension"
  - "pdf"
---


<objective>
Run the core lifecycle for developing one cinatra extension in Claude Code:
discover whether it already exists (reuse before new), collect the exact scaffold
inputs, scaffold with the published cinatra CLI, route payload authoring to the
kind specialist skill, validate with the kind gate after EVERY change, take the
repo through PR/CI, and hand off a release-readiness report. Never release:
a pushed tag equal to v<package.json.version> — or the published GitHub
Release carrying it, on newer workflow generations — IS the marketplace
publish trigger, and the release act needs explicit owner/maintainer approval.
</objective>

# Workflow: extension-authoring

> The lifecycle spine. The `/cinatra-extension-new` and `/cinatra-extension-verify`
> commands drive this skill; per-kind payload doctrine lives in the specialists.

## Purpose

The operational CORE skill for developing a cinatra extension end to end. It owns
the sequence and the input contract; it deliberately does NOT own per-kind payload
rules, repo conventions, or boundary rules — it routes to the skills that do. Every
extension is its own repo, scaffolded by the CLI, gated by its vendored validator,
and released only by an explicitly approved release act (the version tag push or
the published GitHub Release, per the repo's workflow generation).

## SOURCE-PRECEDENCE (named rule — applies to every step)

**On any conflict about manifest fields, gate rules, naming, or CLI behavior, the
order of authority is fixed:**

1. Current `cinatra-ai/cinatra` and `cinatra-ai/cinatra-cli` `origin/main` — fetch
   first; local clones drift.
2. Written guidance — this skill, the specialists, and any authoring prose.
3. Never authoritative: a repo's vendored `extension-kind-gate.mjs` copy. Copies
   drift across repos; an old vendored gate that still accepts a retired field does
   not make that field valid. The current core rule wins.

## Lifecycle (the spine)

discover -> collect inputs -> scaffold -> author payload (kind specialist) ->
validate after EVERY change -> PR/CI -> release-readiness handoff.

- **Never skip discover.** Reuse or extend an existing extension before creating a
  new one.
- **Never scaffold before inputs are complete.** The CLI is non-interactive here;
  it will not rescue a missing decision (see the scaffold contract).
- **Never advance past an invalid state.** Validation is a loop, not a phase.

## Discover (reuse-before-new)

- **Search before scaffolding.** Surfaces: the public registry `registry.cinatra.ai`
  (search), the `cinatra-ai` GitHub org (one repo per extension — search by the
  `<slug>-<kind>` suffix), and the target app's pinned/installed extension set.
- **Never conclude "none exist" from one surface.** Scope every negative answer to
  the surfaces actually probed.
- **An empty search is not proof.** Retry with synonyms and the unscoped slug before
  reporting absence.
- **A user-provided package URL outranks a prior empty result** — verify it and
  report the discrepancy; never deny it exists.
- The storefront `marketplace.cinatra.ai` is browse-only with no search API — do not
  treat it as a search surface.

## Input collection (ask vs default)

| Input | Policy |
| --- | --- |
| `kind` | REQUIRED. One of agent, connector, artifact, skill, workflow. Ask if missing — never guess. |
| `name` | REQUIRED. Ask if missing — never guess. Normalized per the rules below. |
| description | Ask if missing; otherwise the CLI defaults to boilerplate. |
| display name | Ask if missing; otherwise the CLI titleizes the slug base. |
| `--scope` | Ask ONLY for connector (any vendor scope) and skill (first-party or the vendored allowlist). Agent, artifact, and workflow are LOCKED first-party — never ask. |
| `--dir` | Choose the parent directory deliberately (each extension is its own repo); output lands at `<dir>/<slug>`. |

**Connector-only extras** — collect now, apply via `connector-authoring`:

- **Access scope**: which lowercase token (user, project, team, organization,
  workspace, admin) and whether it is a changeable `default` or a locked `only`
  (exactly one of the two).
- **UI surface**: declarative schema-config (the default) vs the legacy
  bundled-react surface.
- **Stateful vs stateless**: does the connector own database state? Stateful keeps
  the scaffolded migrations directory; stateless deletes it and the manifest's
  migrations pointer.

**Name normalization** (the CLI enforces this — pre-check before invoking):

- kebab-case slug only.
- The kind suffix is auto-appended when absent: `-agent`, `-connector`,
  `-artifact`, `-skills`, `-workflow`.
- Agent base names reject topology tokens: `pipeline`, `orchestrator`, `handler`,
  `child`, `stage-N`. Name the domain capability, not the topology.

## Scaffold contract

```
cinatra create-extension <kind> <name> \
  --scope <s> --display-name "<dn>" --description "<d>" --dir <parent> --yes
```

- The scaffolder is the published `@cinatra-ai/cinatra` CLI. Probe availability
  first (`cinatra --version`); if absent, fall back to
  `npx @cinatra-ai/cinatra@latest create-extension ...`.
- **Non-interactive exit semantics**: with `--yes` (or no TTY) the CLI never
  prompts; a missing kind or name exits with the usage error (exit code 2);
  scope, display name, and description silently default. Collect inputs BEFORE
  invoking — never rely on prompts.
- The target `<dir>/<slug>` must be empty; `--force` is for a deliberate
  re-scaffold only.
- Never hand-roll the repo tree — the scaffold carries the manifest stub, the
  kind gate, the README shape, and the CI gates.

## Kind routing (payload authoring goes to the specialist)

| Kind | Specialist | Scope policy |
| --- | --- | --- |
| agent | `agent-authoring` | first-party only |
| connector | `connector-authoring` | any vendor scope |
| artifact | `artifact-authoring` | first-party only |
| skill | `skill-extension-authoring` | first-party or vendored allowlist |
| workflow | none — scheduled for removal (cinatra#1030) | do not start new ones |

**Workflow doctrine**: the kind still exists in the CLI and the gate, but its
removal is a converged open epic (cinatra#1030 — project agents plus a typed
project template replace BPMN). Do not start new workflow extensions. On an
explicit user override, re-check the epic state first and record the override.

## Validate loop (after EVERY change)

- Run both, in the extension repo root, after every change:
  - `node extension-kind-gate.mjs --package-root .`
  - `npm pack --dry-run`
- **Never advance on invalid.** Fix, then re-run both.
- **Cap fix retries at 3.** After the third failed fix, stop and report the exact
  failing rule, the attempts made, and the current state.
- A green vendored gate is necessary, not sufficient — re-check any suspect field
  against the current core rule (SOURCE-PRECEDENCE).

## PR / CI

- Branch, commit, open a PR in the extension repo; never work on a default branch.
- Every scaffolded repo gate must be CONCLUDED green (ci, source-leak-gate,
  actions-pinned-gate, gitignore-gate). Pending is not green.
- A red gate follows the same fix loop and the same 3-retry cap.

## Release-readiness handoff (hard stop)

- The lifecycle ENDS with a release-readiness report: gate and pack results bound
  to the exact commit SHA, CI conclusions, the current `package.json` version, and
  what the release act would entail.
- A pushed tag equal to `v<package.json.version>` — or, on newer workflow
  generations, the published GitHub Release carrying it — IS the publish trigger
  (marketplace submit). NEVER push such a tag, create or publish a GitHub
  Release, or publish autonomously — release-readiness reporting only; the
  release act needs explicit owner/maintainer approval.

## Boundaries (what this skill defers)

- `extension-conventions` — repo conventions, manifest-shape doctrine, and the
  lock-pin/companion-merge choreography with the app repo.
- `extension-boundary` — what may cross the extension/host boundary (imports,
  host ports, SDK peer rules).
- `agent-authoring`, `connector-authoring`, `artifact-authoring`,
  `skill-extension-authoring` — per-kind payload doctrine.
- `/cinatra-extension-new` and `/cinatra-extension-verify` — thin entry points;
  they orchestrate, this skill owns the procedure.

## Steps (operational)

1. Establish `kind` and `name`; normalize the name (kebab-case, kind suffix,
   agent topology-token check). Missing kind or name: ask, never guess.
2. Discover: probe `registry.cinatra.ai` and the `cinatra-ai` org (plus any
   installed set). Never conclude absence from one surface. On a match, propose
   reuse/extend and stop unless the user still wants a new extension.
3. Collect the remaining inputs per the table: description and display name if
   missing; scope only for connector/skill; the connector extras for connectors.
4. If kind is workflow: state the removal doctrine (cinatra#1030) and do not
   start one; on explicit override, re-check the epic state first.
5. Probe the CLI, then scaffold with the non-interactive form above; verify exit
   code 0 and the tree at `<dir>/<slug>`.
6. Baseline-validate the fresh scaffold (gate + `npm pack --dry-run`) before any
   authoring.
7. Route payload authoring to the kind specialist; re-run the validate loop after
   EVERY change; never advance invalid; stop and report after 3 failed fixes.
8. PR/CI: branch, push, open the PR, and get every gate to a CONCLUDED green.
9. Hand off the release-readiness report bound to the exact SHA, then STOP —
   never tag, Release, or publish.
