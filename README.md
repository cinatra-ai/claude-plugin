# cinatra-ai/claude-plugin

Claude Code skills that help a single developer set up and build **with**
Cinatra. Install once; the skills activate on natural-language triggers inside
Claude Code.

> Licensed under the Apache License 2.0 — see [LICENSE](./LICENSE).

## What is this repo?

This repository ships a set of Claude Code skills for contributors working on
or with Cinatra. The skills cover:

- **Toolchain bootstrap** — get a fresh machine ready to contribute.
- **New-contributor orientation** — find your first issue and follow the
  standard issue → PR → merge flow.
- **Local dev/verify stack** — bring up the local Cinatra stack for testing.
- **Extension development** — scaffold, author, validate, and audit a Cinatra
  extension end to end: a core lifecycle skill, one specialist skill per active
  extension kind (agent, connector, artifact, skill), the extension ↔ core
  boundary doctrine, and two slash commands that drive them.
- **Extension authoring conventions** — the rules for building, pinning, and
  integrating a Cinatra extension.
- **Domain gotchas** — per-repo traps that have cost real rework.

This is a **public** package, shipped as a native **Claude Code plugin**. The
recommended way to install is `claude plugin marketplace add` + `claude plugin
install` (see [Install](#install)); an `npx`-based installer is also kept during
the transition. Skill source lives in [`skills/`](./skills/), one
`skills/<name>/SKILL.md` per skill — the layout Claude Code auto-discovers.

**What belongs here vs elsewhere:** skills that guide *how to develop with
Cinatra* live here. Runtime application code, extension source, and
organisation-internal runbooks live in their own repos.

---

## Requirements

- Claude Code (with the `claude plugin` command) — for the native plugin install
- Node.js 20 or later — for the `dev-tools` CLI engine the skills shell out to,
  and for the optional `npx` installer
- Git (to add the marketplace), **or** `npx` (bundled with npm) for the
  transitional installer

---

## Install

### Option A — native Claude Code plugin (recommended)

Add this repo as a plugin marketplace, then install the foundation plugin:

```sh
claude plugin marketplace add git@github.com:cinatra-ai/claude-plugin.git
claude plugin install cinatra@cinatra
```

(Use the `https://github.com/cinatra-ai/claude-plugin.git` URL instead of the SSH one if
you clone over HTTPS.)

Claude Code stages the skills from `skills/<name>/SKILL.md`, the slash commands
from `commands/*.md`, and resolves the bundled `dev-tools` CLI engine at
`$CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs`. The skills then activate on their
natural-language triggers.

> **Migration note — already on `cinatra-foundation`?** The plugin identity
> (the chat namespace shown before every skill, e.g. `cinatra:setup`) was
> renamed from `cinatra-foundation` to `cinatra`. A rename is a new plugin
> identity to Claude Code, not an in-place update — `claude plugin update
> cinatra-foundation` will not pick it up. Uninstall the old name and install
> the new one:
>
> ```sh
> claude plugin uninstall cinatra-foundation
> claude plugin marketplace update
> claude plugin install cinatra@cinatra
> ```
>
> If skills still don't activate after that, refresh the marketplace/plugin
> cache: remove and re-add the marketplace (`claude plugin marketplace remove
> cinatra-foundation` — the OLD marketplace identity — then the `marketplace
> add` command above) and reload Claude Code.

**Updates use the native plugin update model** (no self-updater). Manually:

```sh
claude plugin marketplace update   # refresh the marketplace from main
claude plugin update cinatra
```

Or let the bundled engine check and apply per-plugin updates for the installed
Cinatra-family plugins (see the [`plugin-update` subcommand](#b-dev-tools-cli-subcommands)):

```sh
node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs plugin-update --check   # read-only report
node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs plugin-update           # apply per the mode knob
```

### Option B — `npx` installer (transitional)

A clone-based installer is kept during the transition. It stages the skills into
your global Claude profile (`~/.claude/skills/dev-*`) and a `dev-core/` payload:

```sh
npx --yes github:cinatra-ai/claude-plugin --claude --global \
  --i-understand-this-writes-my-real-claude-dir
```

Pin to a specific tag for a reproducible install (recommended for CI):

```sh
npx --yes github:cinatra-ai/claude-plugin#<tag> --claude --global \
  --i-understand-this-writes-my-real-claude-dir
```

`npx` fetches this exact ref and installs the skills it carries — the version
you pin is the version you get (the installer no longer re-clones a moving
default branch).

### Option C — clone and run the installer

```sh
git clone https://github.com/cinatra-ai/claude-plugin.git
cd claude-plugin
node bin/install.mjs --claude --global --i-understand-this-writes-my-real-claude-dir
```

### Required acknowledgement + dry run

The `--i-understand-this-writes-my-real-claude-dir` flag is required for every
install path. The installer's preflight guard **fails closed** — it refuses to
write your real `~/.claude` directory without an explicit acknowledgement — see
[Configuration](#configuration) for why.

To preview what would be written without making any changes, add `--dry-run`.
The preflight runs before dry-run handling, so the acknowledgement flag is
still required:

```sh
npx --yes github:cinatra-ai/claude-plugin --claude --global --dry-run \
  --i-understand-this-writes-my-real-claude-dir
```

---

## Commands / usage

This plugin has **three** kinds of user-invocable surface: the slash commands
under [`commands/`](./commands/) (manual-only orchestrators), the skills
(invoked by typing `/<skill-name>` in a Claude Code session, or auto-activated
by their trigger phrases), and the `dev-tools` CLI (shelled out to by the
skills, not a slash command, but runnable directly).

### A. Slash commands

Commands are manual-only (`disable-model-invocation: true`) thin orchestrators —
the procedure lives in the skills they drive. They ship via the native plugin
install (Option A); the transitional `npx` installer stages skills only.

| Invoke | Purpose |
|---|---|
| `/cinatra-extension-new` | Guided scaffold of a new Cinatra extension: collects missing inputs (kind, name, description, scope where allowed; connector access scope, UI surface, migrations), drives `cinatra create-extension` non-interactively, writes the mandatory connector `cinatra/config.json`, validates, then hands payload authoring to the kind specialist skill. |
| `/cinatra-extension-verify` | Conformance + boundary audit of an existing extension repo: kind gate, packlist dry-run, first-class connector scope-config audit, the `extension-boundary` sweep, the kind specialist checklist, and a report-only release-readiness section. |

### B. Slash-invocable skills

Each skill also activates on its natural-language trigger phrases (not just
the slash form) — see the `triggers:` list in each skill's frontmatter.

| Invoke | Purpose | When to use |
|---|---|---|
| `/setup` | Bootstrap a fresh contributor machine: install the missing toolchain (VS Code + the Claude Code extension, Codex CLI, gh, node/pnpm, Docker, git, GSD) and configure the global Claude baseline. Dry-run by default; writes only on `--apply`. | First thing on a new machine, or to check/repair your toolchain and global Claude config. |
| `/onboarding` | Walk a new contributor from "nothing installed" to "working on a first issue": install this pack, run `setup`, get oriented, then find and start a first piece of work. | You're new to the Cinatra dev process and want the ordered how-to path. |
| `/cinatra-dev-tools` | Bring up or refresh the local Cinatra dev/verify stack (dedicated db/redis ports, `.env.local` template, per-worktree dev port + queue) and explain the dev extension locks and the LLM-call credential principle. | You need to run or test something against a local Cinatra stack, or need the local LLM-credential rules. |
| `/extension-conventions` | Conventions for authoring, pinning, and integrating a Cinatra extension: one repo per extension, the five kinds (workflow scheduled for removal, cinatra#1030), `cinatra create-extension`, the `package.json#cinatra` manifest shape per kind, the mandatory connector `cinatra/config.json` access declaration, the lock-pin choreography. | You're building or integrating a Cinatra extension and need the cross-kind conventions. |
| `/extension-authoring` | The extension development lifecycle: discover (reuse-before-new), collect scaffold inputs (asking for anything missing), scaffold with the published `cinatra` CLI, route payload authoring to the kind specialist, validate after every change, PR/CI, release-readiness handoff (never releases). | You're creating or developing a Cinatra extension end to end. |
| `/connector-authoring` | Connector specialist: the mandatory `cinatra/config.json` access scope (lowercase tokens, `default` XOR `only`, protected slugs), UI surfaces (`schema-config` vs `bundled-react`), registration-only `register(ctx)` with type-only SDK imports, least-privilege host ports, the migrations decision, current fleet archetypes. | You're authoring or reviewing a Cinatra connector. |
| `/agent-authoring` | Agent specialist: the three-file package (OpenAgentSpec flow, system-prompt SKILL.md, manifest), the type decision table, declarative HITL, orchestrator composition, the 8 cross-cutting OAS rules, llm-bridge and object-envelope runtime contracts, dual version bump. | You're authoring or reviewing a Cinatra agent extension. |
| `/artifact-authoring` | Artifact specialist: metadata-only content-TYPE definition, the strict manifest key allowlist, the full `cinatra.artifact` descriptor contract, the typed mirror, and the paired matcher skill with confidence bands. | You're authoring or reviewing a Cinatra artifact extension. |
| `/skill-extension-authoring` | Skill-bundle specialist: `skills/<name>/SKILL.md` payload (one dir per capability), the `cinatra.capabilities` map (host-enforced), `metadata.match_when` agent binding, `-skills` naming and the vendored-scope policy. NOT for Claude Code plugin skills. | You're authoring or reviewing a Cinatra product skill bundle. |
| `/extension-boundary` | The extension ↔ core boundary: every gate-enforced rule (import bans, type-only SDK peers, optional-peer discipline, pinned-empty core coupling baselines, the lock equality invariant, the SDK surface fence) with its enforcing gate and the local reproduction commands. | Your extension change touches anything that crosses (or must not cross) the host boundary, or a boundary gate went red. |
| `/domain-gotchas` | Per-repo domain traps that have cost real rework: design-repo asset/spec conformance, reusable release CI, schema-migration fixture re-apply, Next.js cold-compile staleness, browser-URL vs container-URL, CodeQL false-positive dismissal, the docs-repo convention, real-host CLI testing, and more. | Before touching a repo with a known non-obvious trap, or when something behaves unexpectedly in a way that looks environmental. |

See each skill file under [`skills/`](./skills/) (`skills/<name>/SKILL.md`) for
the full trigger list and workflow body.

### C. `dev-tools` CLI subcommands

The skills above shell out to a deterministic CLI engine at
`$CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs` (source of truth: the `switch` in
[`bin/dev-tools.cjs`](./bin/dev-tools.cjs)) so operations like model
resolution or an environment probe are never an LLM free-choice. It is not a
slash command — run it directly with Node.

| Subcommand | Purpose | Args | Example |
|---|---|---|---|
| `route` | Resolve which model to use for a task class or a dispatching skill. | `--class <c> \| --skill <id>` `[--runtime r]` `[--json]` | `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs route --class <c> --json` |
| `update-context` | Print the installed package, version, resolved payload directory, and runtime. | `[--runtime r]` `[--json]` | `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs update-context --json` |
| `doctor` | READ-ONLY toolchain/currency/global-settings probe; exits 1 on any FAIL. `--online` opts in to the read-only plugin currency probe (installed → available for the runtime-discovered Cinatra-family plugins). | `[--online]` `[--json]` | `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs doctor --online` |
| `plugin-update` | Check and (per the `currency.plugin` mode knob, default `auto`) apply **per-plugin** updates for the **installed** first-party Cinatra-family plugins, discovered at runtime via the plugin registry (marketplace-source owner or the `x-cinatra-dev-tools.update` manifest opt-in marker). Never installs a new plugin; every not-possible case degrades to a visible notify + the exact manual command. | `[--check]` `[--apply]` `[--notify-only]` `[--json]` | `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs plugin-update --check` |
| `global-settings-diff` | READ-ONLY exact diff of the machine-global Claude baseline; exits 1 if drifted. | `[--json]` | `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs global-settings-diff` |
| `shadcn-install` | Install the pinned upstream shadcn skill for both Claude and Codex. Refuses the real `~/.codex` without `--force`. | `[--home d]` `[--codex-home d]` `[--force]` `[--json]` | `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs shadcn-install --home <sandbox> --json` |
| `ensure` | The SHARED detect → consent → apply path (claude-plugin#16): READ-ONLY by default (reports the tool's status and, if action is needed, the exact fix command — never installs); `--apply` runs the fix for that one tool and re-verifies. Known tools: `shadcn-skill`. | `--tool <id>` `[--apply]` `[--home d]` `[--codex-home d]` `[--force]` `[--json]` | `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs ensure --tool shadcn-skill --json` |
| `version` | Print the installed pack version. | — | `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs version` |

---

## Configuration

### Installer safety model

The installer writes skill files into `~/.claude/` through a layered safety
stack:

- **Preflight guard** — refuses to write the live `~/.claude` unless the
  explicit flag `--i-understand-this-writes-my-real-claude-dir` is passed.
  Tests always run against a sandbox `HOME` so the live config is never
  touched automatically.
- **Containment** — every write and `mkdir` is proven to be inside the target
  Claude directory before the syscall. File writes go through an atomic
  temp-then-rename path so a symlinked destination is never silently
  truncated.
- **Settings merge** — `settings.json` changes use a keyed-sentinel merge that
  never clobbers existing tool or user blocks. An unparseable `settings.json`
  causes the installer to refuse rather than overwrite it.
- **Ownership assertion** — if `~/.claude/dev-core/` already exists but is not
  provably owned by this package (missing or mismatched `.identity`), the
  installer fails closed rather than removing a foreign directory.

### Install source

The installer resolves its source in this order:

1. `--source <path>` — a local pack checkout (used by the tests and local
   development).
2. **This package's own checkout** — when the installer runs from a complete
   pack (the `npx github:cinatra-ai/claude-plugin[#<ref>]` / `npx @cinatra-ai/dev` path,
   where the package has already been fetched into place). Installing from the
   fetched tree makes the install reproducible: the ref you pin is the content
   you get, with no second network round-trip.
3. A shallow clone of `cinatra-ai/claude-plugin` — a fallback used only when the running
   checkout is not itself a pack.

The skills in this package carry their workflow body **inline**, so no separate
`payload/` directory is required for them to install. If a future build ships a
`payload/` directory, its contents are staged into `~/.claude/dev-core/`
alongside the skills. If you see a "Skipping install (nothing written)" notice,
the resolved source was not a valid pack (it needs both a `skills/<name>/SKILL.md`
tree and a `bin/` directory) — re-run from a complete checkout or via `npx`.

### Profile selection

Pass `--profile <name>` to install a subset of skills. Without this flag the
`full` profile installs all skills.

---

## Uninstall

```sh
node bin/uninstall.mjs --claude --global \
  --i-understand-this-writes-my-real-claude-dir
```

The same preflight guard applies. The uninstaller removes the installed skill
files (`~/.claude/skills/dev-*`) and agent files (`~/.claude/agents/dev-*.md`),
un-merges only the `settings.json` entries this package wrote (leaving any
user-edited values in place), and removes the `dev-core/` payload directory.
It never touches settings entries owned by other tools.

---

## Versioning and updates

This plugin uses the **native** Claude Code plugin update model. The version is
declared once, as explicit semver, in
[`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json) (mirrored in the
`version` of the matching entry in
[`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json)). The
marketplace tracks the **main branch**, and there is **no self-updater** — the
old git-based version check has been retired.

**To cut a release:**

1. Bump the `version` in `.claude-plugin/plugin.json` **and** the matching
   `plugins[].version` in `.claude-plugin/marketplace.json` — keep them in sync.
2. Merge the bump to `main`. The marketplace tracks `main`, so the new version
   is published as soon as the bump lands.

**To update an installed copy** — manually:

```sh
claude plugin marketplace update   # refresh the marketplace from main
claude plugin update cinatra
```

or via the bundled engine, which discovers the installed Cinatra-family
plugins at runtime and runs the same native commands per plugin:

```sh
node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs plugin-update
```

The `doctor` probe itself stays read-only: `doctor --online` reports
installed → available versions but never refreshes marketplace metadata or
applies anything — that is `plugin-update`'s job. The apply behaviour is
governed by the `currency.plugin` knob in `.cinatra-dev/config.json`
(`auto`, the default — apply eligible updates when possible — or
`notify-only`), and auto-apply is limited to updates of already-installed
first-party plugins: nothing new is ever installed, and an update that would
add hooks/MCP servers/permissions degrades to a visible notify for explicit
consent.

---

## Troubleshooting

**The installer refuses with "refusing to install: HOME resolves to the running user's real HOME"**

The preflight guard requires an explicit acknowledgement before writing your
real `~/.claude`. Add the flag:

```sh
node bin/install.mjs --claude --global --i-understand-this-writes-my-real-claude-dir
```

**Skills are not activating after install**

- Confirm the install completed without errors.
- Restart Claude Code after install so the new skill files are picked up.
- Check `~/.claude/skills/` for directories named `dev-<skill>/` each
  containing a `SKILL.md` file.
- Re-run with `--dry-run` (plus the acknowledgement flag) to see what the
  installer would write, then run without `--dry-run` to apply.

**"Skipping install (nothing written)" / clone fallback fails**

When run via `npx` or from a cloned checkout, the installer uses that checkout
directly as its source. The clone fallback only runs if the checkout is not a
valid pack; it fails soft (prints a notice, writes nothing) if `cinatra-ai/claude-plugin`
cannot be reached. Re-run from a complete checkout or via
`npx --yes github:cinatra-ai/claude-plugin`.

**The installer refuses: "dev-core/ exists but has no .identity marker"**

A directory at `~/.claude/dev-core/` exists that is not owned by this package.
Remove it manually if you intend to replace it:

```sh
rm -rf ~/.claude/dev-core
```

Then re-run the installer.

**The local dev stack won't start**

A stray published-marker artifact in the tree can break a pinned sync. Clean
strays before trusting a refresh. See the
[`cinatra-dev-tools` skill](./skills/cinatra-dev-tools/SKILL.md) for the full
recipe.

---

## Contributing

Issues and PRs welcome. This package contains no proprietary mechanics.

When contributing:

- Keep skill bodies inside `skills/` — one `skills/<name>/SKILL.md` per skill
  (the native plugin auto-discovery layout).
- Do not push planning or scratch artifacts into this repo; keep them local.
- All CI gates must be green before merging. The org gate suite runs on every
  push.
- Verify your change on the real surface before opening a PR.
