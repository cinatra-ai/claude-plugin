---
name: registry-authoring
user-invocable: false
description: "Author extension-contributed shadcn DESIGN-REGISTRY items for a cinatra artifact extension — declaring cinatra.artifact.ui.registryItems so an extension publishes its own presentational components to the shared registry WITHOUT a core rebuild (cinatra#1623, epic cinatra#1620 S5). Covers: the strict per-item declaration { name, entry, type, description } (type one of registry:ui|registry:lib; name a strict-lowercase <component> token, unique per manifest; entry a path-contained, files-resolvable subpath), the PRESENTATIONAL-ONLY rule (a registry item is consumer-executed source copied by shadcn add — public npm + other registry items ONLY, never an app/host import, auth context, or data fetching), the @<registryNamespace>/<slug>-<component> vendor identity grammar (namespace immutable + assigned at onboarding, cinatra-ai reserved case-insensitively, first-party served flat slug-prefixed), and the publish-time guarantees (fully-qualified dependency DAG, per-item clean-consumer install+typecheck, content/provenance scan, digest-pinned frozen closures, immutable digest URLs beside explicitly-mutable stable-name aliases, permanent tombstoning). Activates for: 'declare registryItems', 'cinatra.artifact.ui.registryItems', 'publish a shadcn registry item', 'contribute a design-registry component', 'registry item identity', 'registry namespace', 'digest-pinned registry blob', 'registry item type registry:ui'. registryItems is OPTIONAL and independent of renderers (a ui block declares renderers, registryItems, or both, at least one non-empty); npm + registry deps are extracted from the item SOURCE by the publish pipeline, never declared in the manifest; the identity grammar is namespace-general but the artifact kind that declares registryItems is first-party-locked, so examples use the -artifact extension-slug suffix (owner naming ruling), never a -renderer kind."
argument-hint: "[declare | identity | presentational-rule | serving | lifecycle]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
triggers:
  - "declare registryItems"
  - "cinatra.artifact.ui.registryItems"
  - "publish a shadcn registry item"
  - "contribute a design-registry component"
  - "registry item identity"
  - "registry namespace"
  - "digest-pinned registry blob"
  - "registry item type registry:ui"
antiTriggers:
  - "claude code plugin"
  - "chat assistant skill"
  - "npm registry token"
  - "container registry"
  - "court"
---


<objective>
Author the shadcn registry items a cinatra artifact extension CONTRIBUTES to the
shared @cinatra-ai design registry through cinatra.artifact.ui.registryItems
(cinatra#1623, epic cinatra#1620 S5). The registry is extensible by extensions
WITHOUT a core rebuild: an extension declares presentational components, the
marketplace publish pipeline validates and digest-pins them, and the registry
host serves them dynamically. Fill the strict per-item declaration, keep every
item presentational-only, get the vendor identity right, and know the
publish-time guarantees. This is distinct from VENDORING host primitives to build
a renderer (that is artifact-authoring's renderer section) — declaring
registryItems is PUBLISHING your own.
</objective>

# Workflow: registry-authoring

> Specialist for the extensible design registry. `artifact-authoring` routes here
> when an artifact extension contributes its own registry items. On any conflict a
> vendored copy or older prose loses to current cinatra-ai/cinatra origin/main
> (SOURCE PRECEDENCE); the schema of record is
> `packages/sdk-extensions/src/artifact-contract.ts` (declaration) +
> `packages/sdk-extensions/src/registry-contract.ts` (identity, serving,
> publish-time DAG) in cinatra-ai/cinatra.

## Vendoring primitives vs. declaring registryItems (do not conflate)

- **Vendoring host primitives = CONSUMING.** To build a renderer you vendor the
  `@cinatra-ai` shadcn primitives into your tree with the pinned CLI (`pnpm dlx
  shadcn@4.8.2 add …`, never `@latest`) and import them by relative path. That is
  the renderer section of `artifact-authoring`.
- **Declaring registryItems = PUBLISHING.** To publish your OWN presentational
  components to the shared registry — so other extensions can vendor them the same
  way — you declare `cinatra.artifact.ui.registryItems`. That is this skill.

An artifact extension may do either, both, or neither. `registryItems` needs no
renderer, and a renderer needs no `registryItems`.

## The registryItems declaration (strict per item)

`registryItems` is an OPTIONAL list inside the versioned `cinatra.artifact.ui`
block. Since S5 a `ui` block may declare `renderers`, `registryItems`, or both —
`renderers` is now optional — but **at least one of the two must be non-empty**
(the leaf enforces the at-least-one-of refinement).

```jsonc
"ui": {
  "abiVersion": 1,
  "sdkAbiRange": "^2.4.0",              // the single canonical ^<SDK ABI> value (copy it)
  "registryItems": [
    { "name": "stat-tile", "entry": "./src/registry/stat-tile.tsx", "type": "registry:ui",  "description": "A compact labelled metric tile." },
    { "name": "format",    "entry": "./src/registry/format.ts",     "type": "registry:lib", "description": "Presentational number/date formatting helpers." }
  ]
}
```

Each item is `{ name, entry, type, description }` and **nothing else** — the leaf
schema is `.strict()`:

- **`name`** — the `<component>` token: strict lowercase kebab (`[a-z0-9]`,
  hyphen-joined, e.g. `stat-tile`). Becomes the last segment of the published
  identity. Item `name`s are **unique within the manifest**.
- **`entry`** — a package-relative, path-contained subpath (`"./…"`, no `".."`,
  no absolute path or URL) that resolves to a real file inside the published
  `files` allowlist (the same containment guard as a renderer `entry`).
- **`type`** — one of the closed enum `{ registry:ui, registry:lib }`
  (`registry:ui` = a presentational component; `registry:lib` = a plain library
  module). The conformance gate derives this enum from the leaf source
  (`ARTIFACT_UI_REGISTRY_ITEM_TYPES`), so it is never a re-listed copy.
- **`description`** — a non-empty, presentational, human-readable string.

**Do NOT declare npm or registry-item dependencies here.** They are extracted
from the item's SOURCE by the publish pipeline's `shadcn build`; the manifest
surface is presentational metadata only, which is why the schema is strict. Mirror
the same `ui` block in the typed `SemanticArtifactManifest` in `src/index.ts`.

## Presentational-only — the import rule

A registry item is **consumer-executed source** — copied by `shadcn add` into a
consumer's tree, never host-executed — so it carries none of the host's trust and
may import ONLY:

- public npm packages, and
- other registry items.

It may **NEVER** import an app/host module (`@/…`), an authentication or
authorization context, or any data-fetching surface (no request/session/`ctx`, no
server actions). A registry item is presentation, not behavior that reaches
platform state; host data belongs in the renderer's host-supplied props snapshot,
not fetched inside a registry item. The publish pipeline's per-item
clean-consumer install + typecheck runs the item exactly as a downstream consumer
would, so a smuggled host import fails at publish, not at some consumer's build.

## Vendor identity — @<registryNamespace>/<slug>-<component>

The full published identity is composed by the publish pipeline:

```
@<registryNamespace>/<slug>-<component>
```

- **`registryNamespace`** — the vendor namespace: strict lowercase kebab,
  **immutable**, **assigned at vendor onboarding** (never declared in the
  manifest). Uniqueness is by a case-folded canonical token (`acme` == `Acme` ==
  `ACME`).
- **`<slug>`** — the extension package slug (e.g. `report-artifact`).
- **`<component>`** — the item's `name` token.

`cinatra-ai` is **reserved case-insensitively** for the host and first-party — no
vendor onboards any case variant. First-party items publish under the flat
`@cinatra-ai` mapping, slug-prefixed, so the 14 host primitives (bare names) and
first-party extension items (`<slug>-<component>`) share one flat roster without
collision. The identity grammar itself is namespace-general — any onboarded
namespace and any strict-kebab `<slug>`. In practice the only kind that declares
`registryItems` is the artifact kind, and artifact extensions are
first-party-locked (`@cinatra-ai/<slug>-artifact`), so a shipped item today is
first-party — its identity is `@cinatra-ai/<slug>-artifact-<component>` (e.g. a
`stat-tile` item in `@cinatra-ai/report-artifact` is
`@cinatra-ai/report-artifact-stat-tile`). The vendor-namespace grammar is what an
external-vendor publishing phase would onboard against. Per the owner naming
ruling, examples use the `-artifact` extension-slug suffix, never a `-renderer`
kind.

## Publish-time guarantees + serving (author-facing)

The marketplace publish pipeline is owned by the publishing infrastructure; the
observable author-facing guarantees:

- **Fully-qualified dependency DAG.** Every registry-item dependency resolves to a
  sibling in the same publish batch or an already-published `@<ns>/<path>`
  identifier; cycles are rejected.
- **Per-item clean-consumer install + typecheck**, exactly as a downstream
  consumer would run it; a host import or missing dep fails here.
- **Content/provenance scan**, then **digest-pinned frozen closures** — a root
  validated once can never later resolve different dependency bytes; an item is
  never discoverable before it is fetchable.
- **Serving:** canonical **immutable digest URLs** (`sha256-…`,
  byte-reproducible forever, a published digest URL never 404s) beside
  **explicitly-mutable stable-name aliases** (append-only pointer history). The
  existing flat host-roster URLs keep working; a third-party item is served by its
  namespaced alias + digest URL, never on the flat roster (which omits the vendor
  and would collide). New components become fetchable at publication — no core
  rebuild.
- **Lifecycle:** within an identifier, evolution is compatibility-only; a breaking
  change takes a new name; unpublish only delists discovery (pinned digests keep
  resolving). Namespaces and `(namespace, slug, item)` identities are permanently
  **tombstoned** — never reassigned.

## The publish / conformance gate

`registryItems` is validated **fail-closed at publish** by the extension-repo
conformance gate (`scripts/extensions/conformance-gate.mjs`, `checkArtifactUi` →
`checkArtifactUiRegistryItems`) and **degraded-with-diagnostic at boot** — a
malformed `registryItems` never rejects the whole manifest. The gate asserts: each
item carries ONLY `{ name, entry, type, description }` (any extra field is a
presentational-boundary violation — deps are extracted from source, never
declared); `name` is a strict-lowercase `<component>` token, unique in the
manifest; `entry` is contained, resolves to a file, and ships in `files`; `type`
is in the derived enum; `description` is non-empty. Reproduce locally with `node
extension-kind-gate.mjs --package-root .` plus the conformance run.

## Boundaries (what this skill defers)

- The artifact manifest, descriptor, matcher skill, and the RENDERER block
  (vendoring host primitives, the RSC/no-ports contract) belong to
  `artifact-authoring`.
- Code-boundary rules (import bans, the artifact-renderer channel, the
  opaque-identity core rule) belong to `extension-boundary`; lifecycle to
  `extension-authoring`; conventions/lock choreography to `extension-conventions`.
- Publish-pipeline implementation details (how the digest store and registry host
  are built) are owned by the publishing infrastructure — this skill states the
  author-facing contract only.
- Release doctrine: a pushed tag equal to `v<package.json.version>` — or the
  published GitHub Release carrying it — IS the publish trigger; NEVER push such a
  tag, create/publish a GitHub Release, or publish autonomously — release-readiness
  reporting only; the release act needs explicit owner/maintainer approval.

## Steps (operational)

1. Confirm the item belongs in the shared registry: it is presentational and
   reusable, imports only public npm + other registry items, and reaches no host
   state. If it needs host data, it belongs in a renderer's props snapshot, not a
   registry item.
2. Add each item to `cinatra.artifact.ui.registryItems` as
   `{ name, entry, type, description }` — nothing else; put the source under a
   `files`-listed dir; keep `name` a unique strict-lowercase `<component>` token.
3. If the `ui` block did not already exist, set `abiVersion: 1` and the single
   canonical `sdkAbiRange` (copy the `^<SDK ABI>` value; the gate rejects any
   other); `renderers` may be omitted when only declaring `registryItems`.
4. Sync the typed `SemanticArtifactManifest` in `src/index.ts`.
5. Keep every item's SOURCE presentational-only (no `@/…`, no auth/`ctx`, no data
   fetching); let npm + registry-item deps come from the source, never the
   manifest.
6. Validate: `node extension-kind-gate.mjs --package-root .`, the conformance gate
   (`checkArtifactUiRegistryItems`), then `npm pack --dry-run` (the item source
   must ship in the tarball via `files`). Fix and re-run until green.
7. Hand back to `artifact-authoring` / `extension-authoring` for the rest of the
   lifecycle; report release-readiness only.
