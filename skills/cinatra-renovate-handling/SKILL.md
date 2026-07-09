---
name: cinatra-renovate-handling
description: "Handle a Renovate (or dependency) PR on a cinatra-ai repo correctly. Activates for: 'a renovate PR', 'this dependency PR', 'bump this dependency', 'update the lockfile', 'a dependabot PR', or a dependency-update PR. The windows: an onboarding/config-only Renovate PR may land any time; routine dependency PRs wait for the weekly window (early Monday, Berlin time); security/vulnerability updates are allowed outside the window; serialize a dep PR behind any active lane on the same repo; never manually bump a rolling dev/required lock — its auto-bump absorbs tip drift."
when_to_use: "Trigger phrases: \"renovate pr\", \"a renovate pr\", \"this dependency pr\", \"bump this dependency\", \"update the lockfile\", \"dependabot pr\", \"dependency update pr\", \"renovate window\"."
argument-hint: "[<owner/repo#N> | <dependency>]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-renovate-handling

## Objective

Apply the cinatra dependency-update windows to a Renovate / dependency PR. Land an
onboarding or config-only Renovate PR any time; hold a routine dependency PR for
the weekly window (early Monday, Berlin time); allow a security/vulnerability
update outside the window. Serialize a dependency PR behind any active lane
touching the same repo, and never manually bump a rolling dev or required lock —
its auto-bump absorbs tip drift, and a hand bump fights it.

> The following block is the canonical shared reference `ref-evidence-recipe.md`, inlined here so this skill is self-contained (the cinatra evidence/state-vocabulary doctrine is load-bearing and must always be present when the skill loads).

# Reference: evidence / verification recipe (the ONE contract)

> Shared reference. The single source of truth for "what
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
- **Audit `via:` for a real authorization vs an admin bypass.** A content-write
  "proof" authorized by a privileged admin-bypass path is NOT
  production-parity — check the audit actor.
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

## The windows

- **Onboarding / config-only Renovate PR** (the PR that only touches the Renovate
  config) — may land **at any time**; it unblocks every later dependency PR.
- **Routine dependency PR** — holds for the **weekly window** (the early-Monday
  Berlin-time slot the org's Renovate config defines). Do not merge routine dep
  bumps outside the window.
- **Security / vulnerability update** — allowed **outside** the window; a
  vulnerability fix is not held for the weekly slot.
- **GitHub Actions bumps** keep actions pinned to a SHA (so the actions-pinned
  gate stays green) and update the SHA together with its version comment.

## Serialize behind active lanes

A dependency PR that touches a repo with an active lane is **serialized behind
that lane** — a concurrent dep bump can re-stale the lane's branch or collide on
the lockfile. Let the lane finish (or reach a safe point), then process the dep
PR.

## Never manually bump a rolling lock

A rolling dev or required lock auto-bumps to absorb tip drift. **Do not hand-bump
it** — a manual relock fights the auto-bump and can pin a SHA the remote does not
yet carry. Confirm a SHA is actually on the remote before anything depends on it,
and let the rolling lock's own mechanism move the pin.

## Renovate blind spot — vendored `file:`/`link:`/`workspace:` deps

Renovate's npm manager **skips** `file:`/`link:`/`workspace:`-protocol deps (no
registry version to resolve → `skipReason: local`), so a **vendored** dependency
NEVER surfaces a dashboard PR. Do not expect Renovate to keep such a dep current —
route its currency to a **manual currency-review** path (a periodic, deliberate
review of that dependency's `package.json` pin against the latest upstream),
never a dashboard PR. Example: the vendored MCP SDK server
`@modelcontextprotocol/server` (`file:vendor` at `packages/mcp-server`) is
Renovate-invisible and must be advanced by hand via that tracked currency review.

## Merge discipline still applies

A dependency PR is still a PR: every required check CONCLUDED, the merge actually
landed (not just a green pipe exit), the truthful attribution record present
(`Assisted-by: none` for a bot bump). Apply your org's merge discipline — the
window governs WHEN, the merge doctrine governs HOW.
