---
name: cinatra-plugin-baseline
user-invocable: false
description: "Recommend and install the cinatra org's Claude plugin baseline — the versioned, pinned set of plugins (superpowers, frontend-design, claude-mem, ui-ux-pro-max) with a per-plugin required/recommended tier, rationale, privacy/hooks/MCP note, and disable/uninstall command. Activates for: 'which Claude plugins should I install for cinatra', 'the recommended cinatra plugins', 'set up the plugin baseline', 'the cinatra plugin manifest', 'install superpowers / claude-mem'. Installs each with --scope user and runtime-PROBES that a plugin actually loads before relying on it; the pinned SHAs are design-seed references, treated as unverified until probed."
when_to_use: "Trigger phrases: \"which claude plugins should i install for cinatra\", \"recommended cinatra plugins\", \"the recommended cinatra plugins\", \"set up the plugin baseline\", \"plugin baseline\", \"cinatra plugin manifest\", \"install superpowers\", \"install claude-mem\"."
argument-hint: "[--install | --list]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-plugin-baseline

## Objective

Present the org-RECOMMENDED Claude plugin baseline (pinned + versioned) and, on
request, install it with --scope user — runtime-probing each plugin before
relying on it. None are required; all are recommended.


<process>
1. Read the baseline manifest (the single source of truth):

   ```sh
   cat "$HOME/.claude/dev-core/shared/plugin-baseline.manifest.json"
   ```

   Each entry carries name, marketplace, version, sha, tier, rationale, a
   privacy/hooks/MCP note, and the disable command.
2. For --install: install each plugin with `--scope user` via the Claude plugin
   CLI, then RUNTIME-PROBE that it loads (a manifest entry is a recommendation,
   not proof of install). The pinned SHAs are design-seed and UNVERIFIED until
   the probe confirms them.
3. Surface each plugin's privacy note before enabling it — notably claude-mem
   bundles an MCP server and persists session observations to a LOCAL database.
4. To remove a plugin, use its `disable` command from the manifest.
</process>

## The manifest is the source of truth

```sh
cat "$HOME/.claude/dev-core/shared/plugin-baseline.manifest.json"
```

Each entry carries: `name`, `marketplace`, `version`, `sha`, `tier`
(required | recommended), `rationale`, a privacy/hooks/MCP `privacyNote`, and the
`disable` command. The manifest is config-driven and versioned (a `lastVerified`
date + the Claude Code version it was checked against).

None of the baseline plugins are REQUIRED — all are RECOMMENDED. The current seed
is superpowers, frontend-design, claude-mem, and ui-ux-pro-max.

## Install (on request)

1. Install each plugin with `--scope user` via the Claude plugin CLI.
2. **Runtime-probe** that the plugin actually loads (and its version) before
   relying on it — a manifest entry is a recommendation, not proof of install.
3. The pinned `sha` values are **design-seed and UNVERIFIED** until the runtime
   probe confirms them; never imply a pin is freshly verified.

## Privacy first

Surface a plugin's `privacyNote` before enabling it. In particular, **claude-mem**
bundles an MCP server and persists session observations to a LOCAL database — it
indexes session content, so confirm what it stores before enabling it on
sensitive work. It is local-only by default.

## Removal

Use the per-plugin `disable` command from the manifest (e.g. `claude plugin
uninstall <name> --scope user`).

## Currency

Pins are refreshed on the maintenance cadence; the cinatra-doctor/setup flow can surface
when a recommended plugin is absent. Bump `lastVerified` + the per-plugin
`version`/`sha` when the manifest is reviewed.
