---
name: cinatra-dev-tools
description: "Bring up or refresh the Cinatra LOCAL dev / verify stack and explain the dev extension locks and the LLM-call credential principle. Covers the reusable verify-stack recipe (dedicated db/redis ports + an .env.local template + a per-worktree dev port and queue name) and the common pitfall where a stray published-marker artifact breaks a pinned sync. Activates for: 'run cinatra locally', 'bring up the cinatra dev environment', 'spin up the verify stack', 'make LLM calls locally', 'the dev extension locks'. Credentials resolve from the environment and stay in memory — the skill never surfaces or writes a secret value. Distinct from the `dev-tools` CLI engine (`bin/dev-tools.cjs`): this skill is the natural-language workflow; the CLI is the deterministic engine the skills in this pack shell out to."
argument-hint: "[--up | --refresh | update [--check | --apply | --notify-only]]"
allowed-tools:
  - Read
  - Bash
triggers:
  - "run cinatra locally"
  - "bring up the cinatra dev environment"
  - "cinatra dev environment"
  - "spin up the verify stack"
  - "make llm calls locally"
  - "dev extension locks"
antiTriggers:
  - "pdf"
  - "personal repo"
  - "court"
---


<objective>
Bring up or refresh the Cinatra LOCAL dev/verify stack and explain the dev
extension locks and the verify-stack recipe. Keep credentials environment-sourced
and in-memory only — never surface or write a secret value.
</objective>

<process>
1. Bring up the LOCAL verify stack from the recipe in the workflow body (its
   dedicated db/redis ports + the .env.local template + a per-worktree dev port
   and queue name). Spinning up the local stack to live-prove a fix is fine;
   use authoritative read-only DB/CLI reads only.
2. Dev extension locks: the dev-lock auto-bump absorbs tip drift — never manually
   relock; the required-extension equality is untouchable (see the conventions
   skill for the full choreography).
3. Credential principle for LLM calls: keys resolve ENV-FIRST and stay RAM-only; a
   key value is NEVER passed as a CLI subcommand argument (that would expose it)
   and NEVER written into a skill, log, or commit.
4. UI-relevant work needs the shadcn skill (cinatra's UI is shadcn/ui-based).
   Ensure it via the pack's shared detect -> consent -> apply path — READ-ONLY
   by default, it never installs anything on its own:

   ```sh
   node "$CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs" ensure --tool shadcn-skill --json
   ```

   `needsAction:true` means missing/misconfigured for Claude and/or Codex —
   relay the exact `fixCommand` and ASK before doing anything else; only on
   yes, re-run with `--apply` (installs via `shadcn-install`, then
   re-verifies). Already-present is a clean no-op. Never silently skip a
   missing tool and never install without consent.
5. `update` — keep the installed Cinatra-family Claude Code plugins current via
   the deterministic engine (never hand-roll the update):

   ```sh
   node "$CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs" plugin-update            # per the mode knob (default: auto)
   node "$CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs" plugin-update --check    # read-only report
   node "$CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs" plugin-update --apply    # apply on demand
   ```

   Relay every NOTE line verbatim (each carries the reason + the exact manual
   command) — never silently skip one.
</process>

# Workflow: cinatra-dev-tools

> Engine body for the `cinatra-dev-tools` skill. Bring up / refresh the local
> dev + verify stack; explain the dev extension locks and the LLM-call credential
> principle.
>
> **Not the `dev-tools` CLI.** This skill (`cinatra-dev-tools`, the
> natural-language workflow) is a different thing from the `dev-tools` CLI
> engine at `bin/dev-tools.cjs` (a deterministic script the skills in this pack
> shell out to). Both carry the `dev-tools` token by design — the skill is what
> you *talk to*; the CLI is what the skills *invoke*.

> Evidence rule (what counts as proof): drive the real surface (never a stub),
> only trust a CONCLUDED check, bind a verdict to the exact commit SHA, capture
> output rather than a piped exit code, and confirm a change actually landed.

## Local verify stack

The reusable local verification stack: a dedicated postgres + redis on their own
ports, an `.env.local` template, and a per-worktree dev port + queue name so
parallel worktrees never collide, plus seeded fixtures. Spinning up the LOCAL
stack to live-prove a fix is fine; use authoritative read-only DB/CLI reads only.
Run a worktree's dev server on its OWN port + queue name.

Common pitfall: a stray published-marker artifact left in the tree breaks a
pinned sync — clean strays before trusting a refresh.

## Dev extension universe (locks)

- The rolling **dev-lock auto-bump** absorbs tip drift — NEVER manually relock a
  dev/required lock.
- The `requiredExtensions == systemExtensions == lock` equality is untouchable;
  pins ride the same core PR as the baseline/manifest. The full choreography is
  the extension-conventions skill — this skill only points at it for local dev.

## Credential principle for local LLM calls

- Keys resolve **ENV-FIRST** and stay **RAM-only**.
- A key value is **NEVER** passed as a CLI subcommand argument (that would expose
  it), and **NEVER** written into a skill, a log, or a commit.
- No secret value appears in this pack, ever.

## UI tooling — the shadcn skill (consent-gated)

cinatra's UI is shadcn/ui-based (`components.json`, style `radix-nova`), so
UI-relevant local-dev work needs the shadcn skill available for both Claude
and Codex. This skill ensures it via the pack's SHARED
detect -> consent -> apply engine (`bin/lib/ensure.cjs`, claude-plugin#16) —
the same engine `setup` uses, so consent behavior never drifts between
skills:

```sh
node "$CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs" ensure --tool shadcn-skill --json   # read-only check
node "$CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs" ensure --tool shadcn-skill --apply  # only after the user says yes
```

- The check is **READ-ONLY** and reports the exact fix command
  (`shadcn-install`) when the skill is missing/misconfigured for either tool —
  it never installs anything on its own.
- **Always ask** the user before running `--apply`; never silently skip a
  missing tool and never install without consent (the pack's shared consent
  doctrine — see `setup`).
- Already-present is a clean no-op; re-running is safe.
- `doctor` (this skill's step 1 in `setup`, and `dev-tools.cjs doctor`)
  reports shadcn-skill presence as part of its normal read-only sweep — a
  missing/misconfigured leg shows up there too, it just never gets installed
  from `doctor` itself.

## Plugin updates (`update`)

Keeping the installed Cinatra-family Claude Code plugins current is engine
work — shell out to `dev-tools.cjs plugin-update`; never improvise
`claude plugin ...` sequences yourself.

- **Discovery is runtime + generic.** The engine enumerates the *installed*
  plugins from the local plugin registry (falling back to
  `claude plugin list --json`) and filters to the Cinatra family by public
  metadata (the marketplace source's owner) or the manifest opt-in marker
  `"x-cinatra-dev-tools": { "update": true }`. No plugin name is hardcoded.
- **`doctor` stays read-only.** The doctor currency probe reports installed →
  available only; `doctor --online` opts in to the bounded read-only network
  check. Refreshing marketplace metadata and applying updates happen only in
  the explicit `plugin-update` step.
- **Mode knob** (`currency.plugin` in `.cinatra-dev/config.json`): `auto`
  (default — apply eligible updates when possible) or `notify-only` (report +
  the manual command, never apply). `--apply` / `--notify-only` override per
  run; `--check` is always read-only.
- **Consent boundary:** auto-apply covers **updates to already-installed
  first-party plugins only**. Installing a NEW/missing tool always asks first
  (the pack's consent doctrine, claude-plugin#16) — `plugin-update` never
  installs anything new. An update that would add hooks, MCP servers, or
  permissions is never auto-applied; it degrades to a notify for explicit
  consent.
- **No silent skips.** Every "not possible" case (offline/auth/marketplace
  missing/CLI too old/no source metadata/pinned/editable checkout/conflict/
  read-only fs/capability expansion/version undeterminable) is a visible
  NOTE with the exact manual command, e.g.
  `claude plugin marketplace update <marketplace> && claude plugin update <plugin>@<marketplace>`.

## Remote / hosted ingress

Connecting the local stack to any hosted service is an operator-managed step and
is out of scope for this public skill — it depends on your own deployment. Keep
the local-stack work above self-contained; never improvise a remote ingress or
embed environment-specific endpoints or credentials here.
