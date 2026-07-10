---
name: setup
description: "Bootstrap a fresh cinatra contributor machine: install the missing toolchain (VS Code + the Claude Code extension, Codex CLI, gh, node/pnpm, Docker, git, and a GSD install) then configure the global Claude baseline. Dry-run by default; writes only on --apply. A thin entry point into the setup skill so machine bootstrap keeps a dedicated / slash command now that skills are hidden from the picker."
argument-hint: "[--dry-run | --apply]"
disable-model-invocation: true
---

# /setup

Bootstrap a fresh contributor machine. This command is a thin entry point — the
full procedure lives in the **`setup`** skill (which is `user-invocable: false`,
hidden from the `/` picker, so this command is its dedicated slash entry).

1. Invoke the **`setup`** skill. It owns the whole procedure: installing the
   missing toolchain and configuring the global Claude baseline, with an OS
   matrix and separately-confirmed privileged steps.
2. Honor `$ARGUMENTS`: default to a read-only `--dry-run` (show exact diffs,
   write nothing) and only install/configure on an explicit `--apply`.
