---
name: extension-boundary
user-invocable: false
description: "Enforce the extension<->core BOUNDARY for cinatra extensions: every rule stated with its enforcing CI gate (repo-relative path in cinatra-ai/cinatra) and what failing looks like. Activates for: 'extension core boundary', 'extension import ban', 'host-peer value import', 'requestedHostPorts grant', 'coupling baseline pinned empty', 'lock equality gate', 'sdk abi byte pin', 'run the extension kind gate', 'can core reference my extension', 'serverEntry import graph'. Host capability ONLY via register(ctx) ports and call-time host services — never @/ imports, never another extension, SDK peers optional-peer-only and type-only over the serverEntry graph; core never imports or even NAMES an extension (generator output is the sole byte-pinned surface; all four coupling baselines are pinned EMPTY); cinatra.extensions == cinatra.systemExtensions == cinatra-required-extensions.lock.json; reproduce locally with node extension-kind-gate.mjs --package-root . plus npm pack --dry-run."
argument-hint: "[imports | core-coupling | locks | sdk-fence | reproduce]"
allowed-tools:
  - Read
  - Bash
triggers:
  - "extension core boundary"
  - "extension import ban"
  - "host-peer value import"
  - "requestedhostports grant"
  - "coupling baseline pinned empty"
  - "lock equality gate"
  - "sdk abi byte pin"
  - "run the extension kind gate"
  - "can core reference my extension"
  - "serverentry import graph"
antiTriggers:
  - "claude code plugin"
  - "browser extension"
  - "chat assistant skill"
  - "court"
  - "pdf"
---

<objective>
Hold the extension<->core boundary from the extension author's side: reach host
capability only through register(ctx) ports and call-time host services, keep
the SDK type-only over the serverEntry graph, and never ask core to reference
your package — core-side coupling gates are pinned empty and reject any edge.
Every rule names its enforcing gate in cinatra-ai/cinatra, what failing looks
like, and the local commands that reproduce the gates before you push.
</objective>

# Workflow: extension-boundary

> Doctrine body for the `extension-boundary` skill. Rules are gate-enforced
> invariants — cite the gate, not vibes. On any conflict a vendored gate copy or
> older prose loses to current cinatra-ai/cinatra origin/main (SOURCE PRECEDENCE).

## Purpose

The extension<->core boundary is a fence of fail-closed CI gates with EMPTY
baselines on both sides. This skill states the rules for authors: what your
package may touch, what core will never do for you, how the declared/locked
universe is pinned, and how to reproduce each gate locally. Narrative reference:
`scripts/audit/extension-coupling-gates.md` in cinatra-ai/cinatra.

## Extension -> core: how an extension may touch the host

- **Host capability comes ONLY through `register(ctx)` ports and per-concern host
  services resolved at call time.** Ports are grant-gated by
  `cinatra.requestedHostPorts` in package.json#cinatra; an ungranted port access
  fail-louds at runtime naming the missing declaration. Never reach around the
  ctx object for host state.
- **Never import host internals via the `@/` alias, and never statically import
  another extension.** Gate: `scripts/audit/extension-import-ban.mjs`
  (run `--strict-sdk-only` in build-image CI). PINNED EMPTY (cinatra#172): any
  hostInternal, crossExtension, or sdkOnly edge fails immediately;
  `--write-baseline` refuses non-empty output; the strict-SDK allowlist is empty
  and stale entries hard-fail. Failing looks like: the gate exits non-zero
  listing each offending import edge by file and specifier.
- **First-party dependencies are ONLY `@cinatra-ai/sdk-extensions` and
  `@cinatra-ai/sdk-ui`, and ONLY as optional peerDependencies**
  (`peerDependenciesMeta.<name>.optional: true`). Any first-party package leaking
  into dependencies, devDependencies, or optionalDependencies fails the standalone
  repo CI classifier and the kind gate. Failing looks like: exit code 2 from the
  repo build job before install even runs.
- **Host-peer VALUE-import ban over the serverEntry static import graph.** Every
  import of `@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui`, or
  `@cinatra-ai/mcp-client` reachable from `cinatra.serverEntry` must be type-only;
  values arrive through the injected ctx. The classifier is FAIL-CLOSED: inline
  type specifiers (`import { type X, Y }`) and bare side-effect imports both count
  as value edges — only full `import type` statements are safe. Gate:
  `scripts/audit/host-peer-value-import-ban.mjs`. Failing looks like: the gate
  lists the value edge in CI; at runtime the same edge is ERR_MODULE_NOT_FOUND or
  a double-loaded SDK under the prod file:// loader.
- **serverEntry preflight.** `cinatra.serverEntry` must be a relative path that
  resolves to an existing file in the package. Enforced by the vendored
  `extension-kind-gate.mjs` common rules. Failing looks like: gate exit 1 naming
  the unresolvable entry before any boundary scan runs.
- **README contract.** Exactly one H1; the only H2 sections allowed are
  "Works with" and "Capabilities"; Capabilities is REQUIRED with at least 2
  bullets; sections are bullets-only; total size 250-2500 bytes. Gate:
  `scripts/audit/extension-readme-gate.mjs` via its own dedicated workflow (the
  main build workflow path-ignores markdown). Failing looks like: the README
  gate red on a docs-only change the build workflow never saw.
- **License: Apache-2.0 for the first-party `@cinatra-ai` scope.** Gate:
  `scripts/audit/extension-license-gate.mjs`. Failing looks like: any other
  `license` value fails (a GPL-derived port is the sole exception class).
- **Connector access-config gates.** `cinatra/config.json` is MANDATORY for
  kind=connector — an absent file HARD-FAILS at both submit and install
  (cinatra#955). The `cinatra.visibility` key is DELETED for connectors: its
  presence with ANY value is a validation error; declare scope in
  `cinatra/config.json` only (older vendored kind-gate copies still accept
  `visibility` — the current core rule wins). Gates:
  `scripts/audit/connector-access-config-gate.mjs` and
  `scripts/audit/connector-access-policy-write-gate.mjs`. Failing looks like:
  rejection naming the missing config file or the forbidden key.

## Core -> extension: why you never ask core to reference you

Never open (or request) a core PR that names your package. All four coupling
baselines — extension-import-ban, core-extension-import-ban,
core-extension-instance-coupling-ban, discovery-dispatcher-bypass-ban — are
PINNED EMPTY: any edge fails; a non-empty committed baseline is ITSELF a failure.

- **Core never imports an extension package.** Gate:
  `scripts/audit/core-extension-import-ban.mjs`, baseline pinned empty with a
  tamper check. Failing looks like: immediate red on the first core->extension
  import edge.
- **Core never even NAMES an extension** — no string, JSX, prompt, metadata, or
  path literal of an extension package name or `extensions/<scope>/<name>` path
  anywhere in `src/` or `packages/`. Gate:
  `scripts/audit/core-extension-instance-coupling-ban.mjs` (frozen scanner-epoch
  tamper check). The generator-emitted static maps are the SOLE sanctioned
  surface, byte-pinned by `node scripts/extensions/generate-extension-manifest.mjs
  --check`, which fails closed on any byte drift, missing file, or catalog-parity
  break. Failing looks like: the ban naming the literal, or the check reporting
  drift against regenerated output.
- **Identity-surface guard.** Core route allowlists use the generated
  public-paths constant, never a concrete extension name; host `src/` imports SDK
  capability-id constants, never re-declares them. Gate:
  `scripts/audit/identity-coupling-gate.mjs` (stateless — every finding fails).
- **Discovery-dispatcher bypass ban.** Direct native-reader references outside the
  in-gate sanctioned-readers allowlist fail. Gate:
  `scripts/audit/discovery-dispatcher-bypass-ban.mjs`.

## Declaration/lock layer: the pinned universe

- **The equality gate:** `cinatra.extensions == cinatra.systemExtensions ==
  cinatra-required-extensions.lock.json` (exact key names — there is no
  `requiredExtensions` key), enforced ON TOP of a live code-derived
  bootable-coverage check. Gate:
  `scripts/audit/required-extensions-cover-host-imports.mjs`. Failing looks like:
  a bootable package missing from `cinatra.extensions` or the lock; "stale lock" /
  "regenerate the lock" drift in either direction; either list not a subset of the
  other. Growing the bootable set is an owner-ruling change editing BOTH lists in
  ONE reviewed PR — never grow one side alone.
- **Two locks, two regimes.** The dev lock (`cinatra-dev-extensions.lock.json`,
  entries `{packageName, repo, resolvedSha}`) is auto-bumped by ONE rolling PR —
  never manually relocked; a hand relock fights the bump and lands a phantom pin.
  The required lock (`cinatra-required-extensions.lock.json`) adds
  `packageVersion` + `treeSha256` per entry and moves ONLY by deliberate human
  bump.
- **Pinned clone-back, fail-closed.** CI clones every companion extension repo
  back DETACHED at the lock SHA (`scripts/ci/sync-dev-extensions.mjs --pinned`)
  before install; an empty or under-populated tree exits non-zero so the
  boundary gates can never pass vacuously against an empty tree.
- **Seed the transitive required-closure BEFORE any boot verification** — a
  missing closure member crashes boot, and a boot proof taken without the closure
  seeded proves nothing.

## SDK surface fence

- **The SDK ABI version is byte-pinned three ways** — identical across
  `packages/sdk-extensions/src/register.ts`, the SDK package.json ABI field, and
  the SDK README (read the current number from `register.ts`; never hardcode it
  in guidance). Gate: `.github/workflows/sdk-abi-doc-gate.yml`. Failing looks
  like: any one of the three files drifting a single byte from the others.
- **The public SDK root must not VALUE-export host capability-id constants** —
  they live behind the host-only `./internal` subpath; the pattern match is
  fail-closed. Gate: `scripts/audit/sdk-public-surface-ban.mjs` (runs inside the
  ABI doc gate workflow).
- **No npm publish from core at all.** The publish allowlist is INTENTIONALLY
  EMPTY (`scripts/audit/package-publish-allowlist.mjs`) and no workflow or
  composite action in the monorepo may execute a publish command
  (`scripts/audit/verdaccio-publish-ban.mjs`). The marketplace proxy is the ONLY
  publish path, driven from the extension's own repo. Release doctrine: a pushed
  tag equal to `v<package.json.version>` — or, on newer workflow generations, the
  published GitHub Release carrying it — IS the publish trigger (marketplace
  submit) — NEVER push such a tag, create or publish a GitHub Release, or publish
  autonomously; report release-readiness only; the release act needs explicit
  owner/maintainer approval.

## Local reproduction (the author's loop)

- **Run the repo's OWN vendored kind gate:** `node extension-kind-gate.mjs
  --package-root .` from the extension repo root. Use the copy vendored in YOUR
  repo — copies drift across the fleet (the newest adds an artifact-parity
  ratchet); on any conflict the current cinatra-ai/cinatra origin/main rules win
  (SOURCE PRECEDENCE).
- **Run `npm pack --dry-run`:** the `files` packlist is the tarball boundary —
  what pack emits is exactly what the marketplace and installers ever see.
- **Read the narrative doc** `scripts/audit/extension-coupling-gates.md` in
  cinatra-ai/cinatra when a gate message is not self-explanatory.

## Boundaries (what this skill defers)

- Extension LIFECYCLE (scaffold, author, verify, release-readiness) belongs to
  `extension-authoring`.
- Per-kind payload rules belong to the specialists: `connector-authoring`,
  `agent-authoring`, `artifact-authoring`, `skill-extension-authoring`.
- Lock choreography operational steps (companion merges, pins riding the same
  core PR, closure seeding mechanics) belong to `extension-conventions` — this
  skill states only the invariants the gates enforce.

## Steps (operational)

1. If your change needs core to import or name your package, STOP — the
   pinned-empty gates reject it; the generated manifest is the sole surface.
2. Route every host capability through `register(ctx)` ports declared in
   `cinatra.requestedHostPorts` and per-concern host services resolved at call
   time; remove any `@/` or cross-extension import.
3. Make SDK imports type-only over the serverEntry graph (only full
   `import type` statements are safe); keep `@cinatra-ai/sdk-extensions` +
   `sdk-ui` as optional peerDependencies only.
4. Verify `cinatra.serverEntry` is a relative path to an existing file; bring the
   README into the one-H1 / Works-with + Capabilities / 250-2500-byte contract;
   set license Apache-2.0. For a connector: ship a valid `cinatra/config.json`
   and delete any `cinatra.visibility` key.
5. Reproduce locally: `node extension-kind-gate.mjs --package-root .` (own
   vendored copy) and `npm pack --dry-run`; fix until both are clean.
6. If the change touches the bootable set: edit `cinatra.extensions` AND
   `cinatra.systemExtensions` AND the required lock together, in one reviewed PR,
   under an owner ruling — never one list alone, never a manual dev-lock relock.
7. Before any boot verification, seed the transitive required-closure; only then
   trust a boot proof.
8. Report gate results by name (which gate, which rule, green or the exact
   failure line) — never claim "boundary is fine" without having run the gates.
