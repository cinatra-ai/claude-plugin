---
name: cinatra-doctor
description: "Check that a cinatra contributor machine is correctly set up: verify the toolchain (gh authed + repo/project scopes, Codex CLI present, a GSD install, node/pnpm version floors, Docker daemon, git identity + core.hooksPath + commit-msg hook), toolchain currency (installed vs latest), and the global Claude baseline (settings.json attribution keys, the org CLAUDE.md block, the Playwright output-dir pin, no per-repo .claude). Activates for: 'run doctor', 'check my cinatra setup', 'is my environment ready', 'verify the toolchain', 'what's missing for cinatra', 'am I configured'. READ-ONLY: it reports accurate state + actionable fixes and never writes — fixing is setup's job."
when_to_use: "Trigger phrases: \"doctor\", \"run doctor\", \"check my cinatra setup\", \"check my setup\", \"is my environment ready\", \"verify the toolchain\", \"verify toolchain\", \"what's missing for cinatra\", \"am i configured\"."
argument-hint: "[--json]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-doctor

## Objective

Report the accurate state of a cinatra contributor machine — toolchain presence
+ correctness + currency, and the global Claude baseline — with an actionable fix
for every gap. READ-ONLY: this skill never writes; applying fixes is setup.


<process>
1. Run the deterministic, read-only probe (this is the source of truth — never
   eyeball tool versions):

   ```sh
   node "$HOME/.claude/dev-core/bin/dev-tools.cjs" doctor --json
   ```

   It probes gh (authed + repo/project scopes), the Codex CLI (presence only —
   it NEVER runs `codex exec`, whose argv form hangs), a GSD install, node/pnpm floors, the
   Docker daemon, git identity + core.hooksPath + the commit-msg hook, and the
   global Claude baseline. Every probe is read-only and time-bounded.
2. Relay each FAIL/WARN with its `fix` string verbatim; do not invent fixes.
3. For toolchain CURRENCY and the global baseline, hand off to `setup`
   (apply) or `cinatra-workspace` (repos) — doctor only diagnoses.
4. Exit non-zero only on a FAIL; warnings are advisory.
</process>

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

## What doctor checks (all read-only)

The deterministic probe (`dev-tools.cjs doctor`) is the source of truth — never
eyeball a tool version. It reports, for each item, `ok | warn | fail` + a fix.

### Toolchain (installed + correct + current)

- **gh** — installed, authenticated, and the token carries the scopes the loop
  needs (`repo`, project read). A missing scope is a WARN with the exact
  `gh auth refresh` command; not-authenticated is a FAIL.
- **Codex CLI** — PRESENT only. The probe never runs `codex exec` — the argv form
  hangs, so convergence is always STDIN-only (`codex exec --skip-git-repo-check <
  file`). That rule lives in the cinatra-codex-pairing doctrine, not in this probe.
- **a GSD install** — reported as co-resident (the pack runs alongside a GSD
  install without clobbering it). Absence is informational, never a failure.
- **node / pnpm** — present and above the version floors.
- **Docker** — installed AND the daemon reachable (the local verify stack needs
  it). Installed-but-daemon-down is a FAIL with a start-the-daemon fix.
- **git** — user identity set (the agent identity for agent PRs / the owner
  identity otherwise), `core.hooksPath` set, and the commit-msg hook present (the
  local attribution backstop — the CI gate owns truth; do not remove the hook).

### Currency

Toolchain currency is reported per the `currency.dependency` knob, and it is
OFFLINE-SAFE by default: the doctor probe does NOT make a network call (an
unbounded registry/`brew outdated` call could hang and would make the probe
host-dependent). So currency reports `unknown` with the EXACT command to run a
real latest-check and the mode it honors — `notify-only` shows the upgrade
command, `auto-update` (on the setup --apply path) applies only user-scope-
safe upgrades, never a silent downgrade, always recording the change. The real
bounded latest-probe is opt-in via `setup`, never silently run from doctor.

### Global Claude baseline

From `dev-tools.cjs global-settings-diff` (also read-only):

- `settings.json` attribution keys per the LIVE org enforcement state — read from
  the ENFORCEMENT artifacts (the commit-msg hook the org ships), NOT a hard-coded
  date. Today: no AI co-authorship lines (`includeCoAuthoredBy:false`).
- The global `CLAUDE.md` org baseline block (a managed block).
- The Playwright MCP `--output-dir` pinned under the org `.claude/` (hygiene).
- No per-repo `.claude/` in active repos (advisory; the convention lives in the
  cinatra-global-settings-hygiene skill).

## How to run it

```sh
# full machine-readable report (read-only):
node "$HOME/.claude/dev-core/bin/dev-tools.cjs" doctor --json

# the global-baseline drift on its own:
node "$HOME/.claude/dev-core/bin/dev-tools.cjs" global-settings-diff
```

## Boundary

Doctor only DIAGNOSES. To FIX the toolchain or apply the global baseline, hand
off to `setup`; to clone missing org repos, hand off to `cinatra-workspace`. The
global-settings POLICY/conventions live in the cinatra-global-settings-hygiene skill;
this skill owns the machine-level verify/ENFORCE half.
