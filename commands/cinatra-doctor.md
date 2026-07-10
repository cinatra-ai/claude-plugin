---
name: cinatra-doctor
description: "Read-only check that a contributor machine is correctly set up: the toolchain (gh, Codex, a GSD install, node/pnpm, Docker, git hooks), toolchain currency, and the global Claude baseline. Reports actionable fixes, never applies them. A thin entry point into the cinatra-doctor skill so the diagnostic keeps a dedicated / slash command now that skills are hidden from the picker."
argument-hint: "[--json]"
disable-model-invocation: true
---

# /cinatra-doctor

Diagnose whether the contributor machine is correctly configured. This command
is a thin entry point — the full check lives in the **`cinatra-doctor`** skill
(which is `user-invocable: false`, hidden from the `/` picker, so this command
is its dedicated slash entry).

1. Invoke the **`cinatra-doctor`** skill. It owns the whole read-only probe:
   toolchain, toolchain currency, and the global Claude baseline, reporting
   accurate state plus actionable fixes and never writing (fixing is `setup`'s
   job).
2. Pass `$ARGUMENTS` through (e.g. `--json` for machine-readable output).
