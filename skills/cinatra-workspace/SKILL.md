---
name: cinatra-workspace
user-invocable: false
description: "Set up the cinatra repo workspace: clone every reachable cinatra-ai repo into ONE parent folder so the agent always opens in the parent. Enumerates org repos via gh, clones ONLY the repos this account can reach (skip-with-notice per unreachable one), ALWAYS excludes the off-limits archived repos (the named set enforced in repo-clone.cjs), and bootstraps the org .claude/ artifacts convention. Activates for: 'clone all the cinatra repos', 'set up the cinatra workspace', 'clone the org', 'where do the cinatra repos live', 'which parent folder for repos', 'a new cinatra repo to clone'. New reachable repos auto-clone per the repo-currency knob; renames/archivals are surfaced and never auto-deleted."
when_to_use: "Trigger phrases: \"clone all the cinatra repos\", \"clone all repos\", \"set up the cinatra workspace\", \"cinatra workspace\", \"clone the org\", \"where do the cinatra repos live\", \"which parent folder for repos\", \"new cinatra repo to clone\"."
argument-hint: "[--into <parent-dir>]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-workspace

## Objective

Clone all reachable cinatra-ai repos into a single parent folder so the agent
always opens in the parent. Clone only what the account can reach (skip the rest
with a notice), ALWAYS exclude the archived repos, never auto-delete, and bootstrap
the org .claude/ artifacts convention.


<process>
1. Enumerate org repos via gh (privacy is the access gate):

   ```sh
   gh repo list cinatra-ai --limit 200 --json name,isArchived,sshUrl
   ```

2. Clone ONLY reachable, non-archived repos into the chosen parent folder. For a
   repo the account cannot reach, SKIP IT WITH A NOTICE (repo name + reason + how
   to get access) — never hard-fail the whole run.
3. ALWAYS exclude the off-limits archived repos — the named set lives in
   `bin/lib/repo-clone.cjs` (`ALWAYS_EXCLUDE_ARCHIVED`) and is enforced by the
   planner, not hand-typed here. Never clone or edit those repos.
4. Bootstrap the org .claude/ artifacts convention (worktrees / scratch /
   screenshots live under the org .claude/, never repo siblings or a temp dir).
5. New reachable repos: auto-clone or notify per the `currency.repo` knob.
   Renames/archivals are surfaced; cloned repos are NEVER auto-deleted (a removed
   local clone is the user's call).
</process>

## The single-parent convention

All cinatra-ai repos live as siblings under ONE parent folder, and the agent
always opens in that parent (so cross-repo work and grounding are one `cd` away).

## Clone-all (tier-aware, reachable only)

The pure clone/skip/exclude planning is deterministic in
`bin/lib/repo-clone.cjs` (`planCloneAll`) — drive it from the live listing rather
than hand-deciding which repos to clone.

1. Enumerate org repos via gh — privacy IS the access gate:

   ```sh
   gh repo list cinatra-ai --limit 200 --json name,isArchived,sshUrl
   ```

2. Clone ONLY repos this account can reach, into the parent folder. For any repo
   the clone cannot reach, **skip it with a notice** — print the repo name, the
   reason, and how to get access. NEVER hard-fail the whole run on one
   unreachable repo (that is the only fallback for a gated repo).

3. **ALWAYS exclude the off-limits archived repos.** The named set is a constant
   in `repo-clone.cjs` (`ALWAYS_EXCLUDE_ARCHIVED`) and the planner excludes them
   unconditionally — never clone or edit them. The exclusion is not gated by the
   `isArchived` flag alone; the named set is authoritative.

## org .claude/ artifacts convention

Bootstrap the workspace hygiene rule: worktrees, scratch, screenshots, and any
agent artifacts live UNDER the org `.claude/` folder — never as repo siblings and
never in a temp dir. Ad-hoc / out-of-worktree artifacts (screenshots, temp
scripts, logs, downloads, one-off files) are written to ABSOLUTE paths under the
task's own `.claude/scratch/` subdir — never a bare relative filename, because
the working directory may be the org root, and the org root contains repo clones
ONLY. (Repo build/test artifacts that belong inside a worktree are unaffected.)
The sanctioned org-root allowlist is exactly: repo clone directories, the
`.claude/` tree, and `.DS_Store` — anything else is a stray. Scope any cleanup to
your own uniquely-named subdir; never blanket-remove the shared scratch tree (it
can hold other live worktrees).

## New-repo currency + deletions

- A NEW reachable cinatra-ai repo (one not yet cloned) is auto-cloned or notified
  per the `currency.repo` knob (`auto-clone` | `notify`).
- Renames and archivals are SURFACED so the workspace stays current.
- A cloned repo is **NEVER auto-deleted** — removing a local clone is the user's
  call (it may hold uncommitted work or local branches).

## Boundary

The clone mechanics live here; the workspace HYGIENE policy (artifacts under the
org `.claude/`, absolute paths for ad-hoc artifacts, the org-root allowlist,
settings centralized) is owned by the cinatra-global-settings-hygiene convention skill —
this skill bootstraps the policy and mirrors it verbatim above, it does not
redefine it.
