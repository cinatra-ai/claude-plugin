---
name: cinatra-real-surface-verification
description: "Prove a cinatra change works on the REAL surface — a real browser (Playwright) for UI, the real MCP tools for integrations, a real authenticated end-to-end run against seeded fixtures — never a stub or a hand-waved 'should work'. Activates for: 'verify on the real surface', 'real surface verification', 'playwright real surface', 'real mcp verification', 'seeded e2e verification', 'prove the change on the running app', 'check the audit via'. A green stub can mask a real boot crash (3 deterministic failures = a real bug, not a flake); a content-write proof authorized by an admin bypass is NOT production parity — check the audit `via:`. References (does not restate) the shared verify-stack recipe; bringing the stack UP is cinatra-dev-tools's job."
when_to_use: "Trigger phrases: \"verify on the real surface\", \"real surface verification\", \"playwright real surface\", \"real mcp verification\", \"seeded e2e verification\", \"prove the change on the running app\", \"check the audit via\", \"stub masks a boot crash\"."
argument-hint: "[ui | tools | e2e]"
allowed-tools:
  - Read
  - Bash
---

# cinatra-real-surface-verification

## Objective

Prove a cinatra change works on the REAL surface: a real browser for UI, the real
MCP tools for integrations, a real authenticated end-to-end run against seeded
fixtures. A green stub can mask a real boot crash (3 deterministic failures = a real
bug); a write authorized by an admin bypass is not production parity — check the
audit `via:`. Reference the shared verify-stack recipe rather than restating it;
bringing the stack UP belongs to cinatra-dev-tools. Refuse to certify an
undrivable surface rather than silently waiving it.

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

## Purpose

Prove a cinatra change actually works on the REAL surface — not on a stub, not on
a green-looking proxy. This skill is the *proving* discipline; it consumes the
shared evidence/verification recipe above (the single source of truth for "what
counts as proof") and the single canonical verify-stack recipe it carries, rather
than restating either.

**Boundary vs `cinatra-dev-tools`.** `cinatra-dev-tools` BRINGS UP / refreshes
the local dev + verify stack (the environment). THIS skill is about RUNNING the
change on that surface and confirming the behaviour is real. The verify-stack
recipe (dedicated db/redis ports + an `.env.local` template + a per-worktree dev
port and queue name + seeded fixtures) has exactly one definition — in the shared
evidence reference above — and both skills reference it. Do not duplicate it here.

## Verify on the REAL surface

- **UI changes → a real browser.** Drive the running app through a real browser
  automation surface (e.g. Playwright), observe the actual rendered behaviour, and
  pin the artifact output under the org `.claude/` folder (workspace hygiene):
  the Playwright MCP output dir AND any ad-hoc script's screenshots/artifacts are
  written to ABSOLUTE paths under the task's org `.claude/scratch/` subdir —
  never a bare relative filename (the working directory may be the org root). A
  passing unit test is not a substitute for seeing the change in the running UI.
- **Tool / integration changes → the real tools.** Exercise the real MCP tools and
  the real integration path, not a mocked shim. A connector or agent surface is
  verified by invoking it the way the host invokes it.
- **Auth / end-to-end flows → a real authenticated run.** Run the genuine
  end-to-end path with real auth against seeded fixtures; a fixture-seeded run that
  exercises the production code path is evidence, a hand-waved "should work" is not.
- **Never a silent waiver.** If a surface genuinely cannot be driven here, say so
  explicitly and route to the operator — do not quietly downgrade to a stub and
  call it proven.

## Design-surface conformance — bidirectional, against the pinned spec

A **design-surface** change (a user-visible surface covered by a design spec —
cinatra-ai/design `specs/*.html` + tokens; the issue carries the `design-surface`
label and pins the exact spec commit) is proven only by BIDIRECTIONAL 100%
conformance, driven as a live Playwright render on a **production-equivalent
build** — not only a dev server:

- **spec→render:** every element, state, and interactive affordance the spec shows
  exists and FUNCTIONS. Each tab/button/flyout/modal/link in the spec is a
  functional item: click it and assert the promised behavior (a spec sentence
  "More details opens the §V detail modal" is a click-and-assert item, not a
  visual spot-check).
- **render→spec:** nothing renders that the spec does not specify — a stale/legacy
  element is a violation, not a leftover to ignore.
- **The recorded proof at close:** the item-by-item checklist extracted from the
  spec (every spec sentence about the surface = a numbered item citing its section
  anchor, each marked pass/fail) plus screenshots/video, recorded on the PR/issue.
  Data fields are part of conformance (e.g. a rendered name = the manifest
  displayName, never the packageName). Where the spec shows them, the checklist
  covers the state axes: per-kind variants, empty/loading/error/disabled states,
  responsive breakpoints, permission-gated states, hover/active, long-text
  truncation.
- **No captured proof, no close.** Claiming "design-verified" without a captured
  render is fabrication — exactly like claiming codex-converged without a captured
  verdict. The general infeasible-surface fallback (record the reason + strongest
  replacement checks) does NOT apply to a design-surface close: a surface that
  cannot be driven means the issue stays open, routed to the operator. Until the
  mechanical conformance gate exists, every design-surface change — fix, feature,
  or refactor — also ships targeted Playwright tests for the known failure classes
  (missing functionality, stale elements, wrong data field), with CI status +
  artifacts preceding the close.

What the ISSUE must carry (the label, the pinned spec commit, the checklist as
acceptance criteria) is owned by your issue-authoring workflow; this section owns
the PROVING of it. Making this check ALWAYS-ON for any UI diff (not only when
someone asks for it) and driving the actual Playwright pass + screenshots to
land on the PR belongs to a dedicated UI-conformance skill, which operationalizes
this section rather than restating it.

## A green stub can mask a real boot crash

A check that "passes on main" but fails on a PR may be a REAL bug masked by a
conditional stub — some smoke checks run a green stub unless a path-filter trigger
flips them to the real path. THREE deterministic fresh-attempt failures are a real
bug, not a flake. Drive the real path before concluding green; reaching for "it's
flaky" on a reproducible failure hides production boot crashes.

## Check the audit `via:` — OBO vs bypass

A content-write "proof" can be authorized by a trusted-dev-host admin BYPASS rather
than the real on-behalf-of / agent-run path — which is NOT production parity. Before
claiming a write path is proven, check the audit actor (`via:`): a `platform_admin`
bypass is not the same as a real production authorization path. When in doubt, turn
the bypass off or drive the real wrapper, and re-check the actor.

## How to verify (operational)

1. Bring the surface up via `cinatra-dev-tools` (or confirm it is already up on a
   worktree-local port + queue name so parallel worktrees never collide).
2. Drive the REAL surface for the change class (browser / tools / auth e2e) against
   seeded fixtures.
3. Apply the shared evidence recipe: CONCLUDED checks only, bind the verdict to the
   exact head SHA, capture output to a file (never tail-piped), confirm the mutation
   landed on the real remote/merge state, and check the audit `via:` for any
   privileged write.
4. If a surface cannot be driven, REFUSE to certify it and hand off to the operator
   — never a silent waiver.

## Source / acceptance matrix (this skill)

| source doctrine | acceptance check |
|---|---|
| Verify on REAL surfaces + the reusable verify-stack recipe + spin-up pre-authorization + the OBO-vs-bypass caveat + the stub-masks-boot-crash trap (W1 memory-transfer row → `cinatra-real-surface-verification`) | The skill references the shared verify-stack recipe (does not restate the ports/template); it mandates a real browser / real tools / real auth e2e with seeded fixtures; it states the green-stub-masks-boot-crash trap (3 deterministic failures = real bug) and the audit-`via:` OBO-vs-bypass check; it refuses to certify an undrivable surface instead of waiving; the static leak gate is green over the shipped content. |
| Design-surface verification doctrine (owner-ratified 2026-07-05, codex-converged) — bidirectional Playwright-vs-spec conformance + proof-at-close | The skill defines design-surface proof as BIDIRECTIONAL conformance against the pinned spec commit (spec→render: every affordance functions, click-and-assert; render→spec: no unspecified/stale elements) on a production-equivalent build; it requires the spec-extracted numbered checklist + screenshots/video recorded on the PR/issue with data-field conformance and the state axes; it treats an uncaptured "design-verified" claim as fabrication; it carries the immediate-slice targeted-Playwright-tests rule until the mechanical gate exists. |
