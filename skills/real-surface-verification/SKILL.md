---
name: real-surface-verification
user-invocable: false
description: "Prove a cinatra change works on the REAL surface — a real browser (Playwright) for UI, the real MCP tools for integrations, a real authenticated end-to-end run against seeded fixtures — never a stub or a hand-waved 'should work'. Activates for: 'verify on the real surface', 'real surface verification', 'playwright real surface', 'real mcp verification', 'seeded e2e verification', 'prove the change on the running app', 'check the audit via'. A green stub can mask a real boot crash (3 deterministic failures = a real bug, not a flake); a content-write proof authorized by an admin bypass is NOT production parity — check the audit `via:`. References (does not restate) the shared verify-stack recipe; bringing the stack UP is dev-tools's job."
when_to_use: "Trigger phrases: \"verify on the real surface\", \"real surface verification\", \"playwright real surface\", \"real mcp verification\", \"seeded e2e verification\", \"prove the change on the running app\", \"check the audit via\", \"stub masks a boot crash\"."
argument-hint: "[ui | tools | e2e]"
allowed-tools:
  - Read
  - Bash
---

# real-surface-verification

## Objective

Prove a cinatra change works on the REAL surface: a real browser for UI, the real
MCP tools for integrations, a real authenticated end-to-end run against seeded
fixtures. A green stub can mask a real boot crash (3 deterministic failures = a real
bug); a write authorized by an admin bypass is not production parity — check the
audit `via:`. Reference the shared verify-stack recipe rather than restating it;
bringing the stack UP belongs to dev-tools. Refuse to certify an
undrivable surface rather than silently waiving it.

> The following block is the canonical shared reference `ref-evidence-recipe.md`, inlined here so this skill is self-contained (the cinatra evidence/state-vocabulary doctrine is load-bearing and must always be present when the skill loads).

# Reference: evidence / verification recipe (the ONE contract)

> Shared reference. The single source of truth for "what
> counts as proof". Several skills in this pack `@`-include this rather than
> restating it — including `doctor` (what a green check means) and
> `real-surface-verification` (the verify-stack recipe — its single
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

## Purpose

Prove a cinatra change actually works on the REAL surface — not on a stub, not on
a green-looking proxy. This skill is the *proving* discipline; it consumes the
shared evidence/verification recipe above (the single source of truth for "what
counts as proof") and the single canonical verify-stack recipe it carries, rather
than restating either.

**Boundary vs `dev-tools`.** `dev-tools` BRINGS UP / refreshes
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
  never a bare relative filename (the working directory may be the org root), and
  never into the product repository's own checkout. That capture is local and
  temporary; a picture that must be visible on a PR is then made visible per the
  proof-publish procedure below — published and embedded for a public repository,
  checklist-recorded for a private one — never committed into the repo.
  A passing unit test is not a substitute for seeing the change in the running UI.
- **Tool / integration changes → the real tools.** Exercise the real MCP tools and
  the real integration path, not a mocked shim. A connector or agent surface is
  verified by invoking it the way the host invokes it.
- **Auth / end-to-end flows → a real authenticated run.** Run the genuine
  end-to-end path with real auth against seeded fixtures; a fixture-seeded run that
  exercises the production code path is evidence, a hand-waved "should work" is not.
  A REAL verification input is a named fixture in a normal fixture location
  (`tests/**`, `__fixtures__/`) with a descriptive name — never a `proof/` or
  `evidence/` folder, and never named after an issue number.
- **Never a silent waiver.** If a surface genuinely cannot be driven here, say so
  explicitly and route to the operator — do not quietly downgrade to a stub and
  call it proven.

## UI verification and approval

Every changed UI surface needs actual captures and an independent grade against
an approved design. A unit test, source review or green CI result cannot replace
seeing and exercising the running interface. Evidence must cover every frozen
cell and acceptance item, including the issue's own subject.

An implementation fully covered by an owner-approved design and a current,
authenticated independent UI-grade PASS needs neither owner-facing PR screenshot
attachments nor UI-only owner approval. The organization's UI-conformance
workflow owns the trusted receipt producer, live verifier and merge integration;
a PR-body boolean, plain checklist or self-reported `mergeReady` is not authority.
Without that verifier or a valid receipt, do not claim the exemption.

If approved design coverage is missing or partial, create or amend the design
spec first. A design-spec PR always requires owner approval and full inline
screenshots with matching immutable links. Approving a design does not approve
separate security, protected-path, suite-less, release or deployment actions.
Those gates remain in force for every implementation.

## Private evidence procedure

1. **Capture the real surface.** Drive the production-equivalent application in
   the browser and write captures to an absolute path in the task's private
   working area, outside every product checkout and branch. Never commit media
   or run-evidence bundles to a product repository, including an evidence branch.
2. **Keep captures and full grading private.** Product visibility does not grant
   permission to publish evidence publicly. Use verified private storage selected
   by the operator. Preserve actual frame hashes, the frozen design/checklist,
   application head and independent execution provenance. Do not replace missing
   captures with a checklist or a claimed pass.
3. **Grade complete coverage.** Extract every governing spec requirement and
   check both spec-to-render and render-to-spec. Every structural region,
   behavioral item and issue-subject requirement must pass. The established
   detail tolerance applies separately to every cell: at least 95% of wording,
   spacing and detail items pass, with every tolerated miss recorded as a
   follow-up. Full coverage is mandatory even when a detail miss is tolerated.
4. **Use the verified receipt for an implementation.** The trusted workflow
   derives a sanitized receipt from the actual frozen contract, capture bytes,
   structured independent grade and execution journal. It binds the exact PR/head,
   complete changed scope, approved immutable design and governing dependencies.
   Before relying on it, verify its authenticated author, unedited content,
   current reference, grading threshold and freshness. A later failed/stale grade,
   deleted referenced receipt or changed governing spec invalidates the exemption.
   Keep private paths, images, raw agent identities and full grade prose private.
5. **Attach private pairs for a design-spec PR.** Use full-resolution inline
   screenshots plus matching explicit links at immutable revisions in a verified
   private host. Confirm the host is private and distinct from the product repo,
   and confirm every image resolves through the authorized reader's access.
   Capture locally first; publish only by the established private evidence road.
   A local path or a graded checklist cannot replace those screenshot pairs.
6. **Record truthful completion.** The implementing PR may reference its
   authenticated receipt without attaching its private media. Closeout still
   verifies that the shipped surface renders and works on the actual default
   branch; retain that evidence privately. A spec-only change never closes an
   implementation issue. Any durable product record is concise text only and
   follows the repository's documentation contract.

An infeasible surface means verification remains incomplete. Record the blocker
and the strongest interim checks, but do not certify the UI or close its issue
on source review or a stub. Escalate only the concrete unresolved blocker; no
extra owner approval is introduced for an otherwise eligible implementation.

## Design-surface conformance — bidirectional, against the pinned spec

A **design-surface** change (a user-visible surface covered by a design spec —
your organization's authoritative `specs/*.html` + tokens source; the issue
carries the `design-surface` label and pins the exact spec commit) is proven
by complete BIDIRECTIONAL coverage under the strict structure/behavior and
per-cell detail rubric above, driven as a live Playwright render on a **production-equivalent
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
  anchor, each graded) plus actual screenshots/video retained privately under the
  procedure above. The implementation PR references its authenticated receipt;
  a design-spec PR retains its required private screenshot/link pairs. Data fields are part of
  conformance (e.g. a rendered name = the manifest displayName, never the
  packageName). Where the spec shows them, the checklist covers the state axes:
  per-kind variants, empty/loading/error/disabled states, responsive breakpoints,
  permission-gated states, hover/active, long-text truncation.
- **No captured proof, no close.** Claiming "design-verified" without an actual captured
  render is fabrication — exactly like claiming codex-converged without
  a captured verdict. Per the universal close invariant above, the
  infeasible-surface fallback (record the reason + strongest replacement checks)
  does NOT satisfy the gate for a design-surface close either: a surface that
  cannot be driven means the issue stays open (or explicitly blocked), routed to
  the operator. Until the mechanical conformance gate exists, every design-surface
  change — fix, feature, or refactor — also ships targeted Playwright tests for
  the known failure classes (missing functionality, stale elements, wrong data
  field), with CI status + artifacts preceding the close.

What the ISSUE must carry (the label, the pinned spec commit, the checklist as
acceptance criteria) is owned by your issue-authoring workflow; this section owns
the PROVING of it. Making this check ALWAYS-ON for any UI diff (not only when
someone asks for it) and driving the actual Playwright pass, private capture and authenticated
receipt belongs to a dedicated UI-conformance skill, which operationalizes
this section rather than restating it.

## A green stub can mask a real boot crash

A check that "passes on main" but fails on a PR may be a REAL bug masked by a
conditional stub — some smoke checks run a green stub unless a path-filter trigger
flips them to the real path. THREE deterministic fresh-attempt failures are a real
bug, not a flake. Drive the real path before concluding green; reaching for "it's
flaky" on a reproducible failure hides production boot crashes.

## Check the audit `via:` — real authorization vs an admin bypass

A content-write "proof" can be authorized by a privileged admin-bypass path
rather than the real, authenticated user/agent-run path — which is NOT
production parity. Before claiming a write path is proven, check the audit
actor (`via:`): an admin-bypass actor is not the same as a real production
authorization path. When in doubt, turn the bypass off or drive the real
wrapper, and re-check the actor.

## How to verify (operational)

1. Bring the surface up via `dev-tools` (or confirm it is already up on a
   worktree-local port + queue name so parallel worktrees never collide).
2. Drive the REAL surface for the change class (browser / tools / auth e2e) against
   seeded fixtures.
3. Apply the shared evidence recipe: CONCLUDED checks only, bind the verdict to the
   exact head SHA, capture output to a file (never tail-piped), confirm the mutation
   landed on the real remote/merge state, and check the audit `via:` for any
   privileged write.
4. For UI-work, run the private evidence procedure above and the organization's
   trusted UI-conformance verifier. Apply the implementation exemption only after
   its live authenticated PASS; retain design-spec screenshot/approval and all
   separate merge/release gates.
5. If a surface cannot be driven, REFUSE to certify it and hand off to the operator
   — never a silent waiver.
