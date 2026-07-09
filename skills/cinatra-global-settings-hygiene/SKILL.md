---
name: cinatra-global-settings-hygiene
description: "The POLICY for machine-global agent configuration in the cinatra org: settings live in the global Claude config (~/.claude/settings.json), NOT per-repo; no per-repo .claude/ in active repos; workspace artifacts (scratch, screenshots, browser-automation output, worktrees) go under the org .claude/ folder. Activates for: 'where do Claude settings live', 'global settings policy', 'settings hygiene policy', 'per-repo .claude', 'centralize claude settings', 'workspace artifacts under org .claude'. Boundary: this owns the agent-config POLICY; cinatra-doctor / setup own the machine-level ENFORCEMENT (verify + apply the exact diffs); repo/org GOVERNANCE levers (org rulesets, admin-bypass, tags, archived repos) belong to your org's repo-governance conventions. Cross-link, no overlap."
when_to_use: "Trigger phrases: \"where do claude settings live\", \"global settings policy\", \"settings hygiene policy\", \"per-repo .claude\", \"centralize claude settings\", \"workspace artifacts under org .claude\"."
argument-hint: "[settings | artifacts]"
allowed-tools:
  - Read
---

# cinatra-global-settings-hygiene

## Objective

State the machine-global agent-config POLICY: settings live in the global Claude
config (not per-repo); no per-repo .claude/ in active repos; workspace artifacts go
under the org .claude/ folder; org rulesets are the Team-plan lever that auto-covers
new repos (classic branch protection is the fallback), with admin bypass preserved.
This skill owns the policy only — verifying or applying the machine baseline is
cinatra-doctor (read-only) / setup (apply). Cross-link, no overlap.

## Purpose

The POLICY for machine-global agent configuration in the cinatra org — *where*
config lives and *which conventions* hold. This skill owns the policy/conventions;
it does NOT verify or apply them.

> **Boundary (the design's codex finding 2).** THIS skill owns the POLICY. The
> `cinatra-doctor` / `setup` skills own the machine-level ENFORCEMENT —
> `cinatra-doctor` reads the global baseline drift (read-only), `setup` applies the
> exact diffs. Cross-link, no overlap: come HERE for "what the convention is and
> why", go to `cinatra-doctor` / `setup` for "check / fix my machine against it".

## Settings live in the global config, not per-repo

- **Global, centralized.** Agent settings (hooks, permissions, statusLine, MCP
  config) live in the GLOBAL Claude config (`~/.claude/settings.json`), not scattered
  per repository. One source of truth keeps every repo's session consistent and
  avoids drift between repos.
- **No per-repo `.claude/` in active repos.** Active repos do not carry their own
  `.claude/` settings folder; the centralized global config governs. A stray
  per-repo `.claude/` re-introduces the drift centralization exists to remove —
  remove it and rely on the global config. (`cinatra-doctor` flags a stray one;
  `setup` is where it gets reconciled.)

## Workspace-artifacts hygiene

Scratch, screenshots, browser-automation output, and worktrees belong UNDER the org
`.claude/` folder — never as siblings of a repo and never in a system temp dir.
Ad-hoc / out-of-worktree artifacts — screenshots (browser-automation MCP or ad-hoc
scripts), temp scripts, logs, downloads, one-off files — are written to ABSOLUTE
paths under the task's own `.claude/scratch/` subdir; NEVER a bare relative
filename (the working directory may be the org root, and the org root contains
repo clones ONLY — repo build/test artifacts that belong inside a worktree are
unaffected). The sanctioned org-root allowlist is exactly: repo clone
directories, the `.claude/` tree, and `.DS_Store`; anything else is a stray.
Pin browser-automation output (e.g. the Playwright `--output-dir`) under the org
`.claude/` folder so artifacts are contained and discoverable. Scope any cleanup to
your OWN uniquely-named subdir — shared scratch can hold another task's live work.

> Repo/org GOVERNANCE levers — org rulesets (the Team-plan lever that auto-covers
> new repos), per-repo branch protection, admin-bypass, tags and archived repos — are
> NOT agent-config hygiene; they belong to your org's repo-governance conventions.
> This skill cross-links there and does not restate that doctrine.

## Steps (operational)

1. For a "where should this config live / is a per-repo `.claude` ok" question:
   apply the centralized-global policy above.
2. For an "how do I make a protection cover all repos / org ruleset" question: defer
   to your org's repo-governance skill/doctrine, not this skill.
3. To actually VERIFY or APPLY the machine baseline against this policy, hand off to
   `cinatra-doctor` (read-only check) / `setup` (apply the diffs) — this skill does
   not write.

## Source / acceptance matrix (this skill)

| source doctrine | acceptance check |
|---|---|
| Machine-global agent-config POLICY: settings centralized in the global config (not per-repo); no per-repo `.claude/` in active repos; workspace-artifacts under the org `.claude/` (global-settings + workspace-hygiene memory) | The skill states the policy only and explicitly defers ENFORCEMENT to `cinatra-doctor`/`setup` (codex finding 2 boundary, no overlap) and repo/org GOVERNANCE (rulesets, admin-bypass) to your org's repo-governance conventions; it covers centralized-settings, no-per-repo-`.claude`, and artifacts-under-org-`.claude`; it carries no machine-local paths or private tokens; the static leak gate is green over the shipped content. |
