---
name: artifact-authoring
user-invocable: false
description: "Author a cinatra ARTIFACT extension — a semantic content-TYPE definition that is DECLARATIVE BY DEFAULT and MAY ship its own port-less detail/preview renderer via the versioned cinatra.artifact.ui block (epic cinatra#1620 S1/S2): the strict package.json#cinatra key allowlist {kind, apiVersion, artifact, dependencies, roles, displayName, vendor}, the full cinatra.artifact descriptor (accepts, satisfies, templates, skills facets, agentDependencies, matcherConfidenceThreshold, ui), the typed SemanticArtifactManifest mirror in src/index.ts, the paired matcher skill, and the RSC renderer contract (no host ports, serializable host-supplied snapshot, a contained files-resolvable entry with exports recommended, generated sdkAbiRange, propsApiVersion). Activates for: 'author an artifact extension', 'new artifact type', 'cinatra.artifact descriptor', 'artifact manifest allowlist', 'artifact matcher skill', 'matcher confidence threshold', 'semantic artifact manifest', 'cinatra.artifact.ui block', 'artifact detail renderer', 'artifact preview renderer', 'ship a renderer from an artifact extension'. Naming is @cinatra-ai/<slug>-artifact (first-party locked); the slug names the CONTENT, never the producer; accepts requires at least one of file.mimeTypes / connectorRef.resolvedMimeTypes / dashboard true; skills facets take skills-catalog ids of the form '@<pkg>:<skill-dir>', never a path or .md ref; a v1 renderer requests NO host ports and composes VENDORED @cinatra-ai shadcn primitives by relative import (never an ad-hoc UI lib or a host-internal import); reuse an existing artifact type before inventing a new one."
argument-hint: "[<content-slug> | descriptor | matcher | templates | renderer]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
triggers:
  - "author an artifact extension"
  - "new artifact type"
  - "cinatra.artifact descriptor"
  - "artifact manifest allowlist"
  - "artifact matcher skill"
  - "matcher confidence threshold"
  - "semantic artifact manifest"
  - "cinatra.artifact.ui block"
  - "artifact detail renderer"
  - "artifact preview renderer"
antiTriggers:
  - "claude code plugin"
  - "chat assistant skill"
  - "court"
---


<objective>
Author a cinatra artifact extension: a semantic TYPE definition for one kind of
content the platform can recognize, template, and route. It is DECLARATIVE BY
DEFAULT — no register(ctx) server entry — and MAY additionally ship its own
detail/preview VIEW through the versioned cinatra.artifact.ui block (core owns
dispatch, the shell, and the never-blank floor; the extension owns its type's
view). Fill the strict package.json#cinatra manifest (the host-read source of
truth), mirror it as a typed SemanticArtifactManifest in src/index.ts, pair it
with a matcher skill whose confidence bands agree with matcherConfidenceThreshold,
and — when the type should render as itself — add a port-less RSC renderer.
Reuse an existing artifact type before inventing a new one.
</objective>

# Workflow: artifact-authoring

> Kind specialist for the artifact extension kind. `extension-authoring` routes
> here; lifecycle, boundary, and convention rules stay with their own skills.

## Purpose

Everything artifact-specific: what an artifact extension is, the strict manifest
allowlist, the full `cinatra.artifact` descriptor contract, the typed mirror, the
paired matcher skill, and the optional `cinatra.artifact.ui` renderer. The
validator for the manifest + descriptor is the vendored gate: `node
extension-kind-gate.mjs --package-root .` plus `npm pack --dry-run`; the `ui`
block is additionally validated fail-closed by the extension-repo conformance
gate (`scripts/extensions/conformance-gate.mjs`, `checkArtifactUi`).

## What an artifact extension IS (and is not)

- **A semantic TYPE definition, declarative by default.** It declares a content
  TYPE — "a blog post", "an ICP document" — that the host can classify, template,
  and bind agents to. There is **no `register(ctx)` server entry** and it requests
  no host ports; most artifact extensions never write a line of runtime code. The
  source tree is the typed manifest mirror plus (optionally) renderer components.
- **It MAY ship its own view.** Through the versioned `cinatra.artifact.ui` block
  (epic cinatra#1620 S1/S2) an artifact extension ships a `detail` and/or
  `preview` **renderer** — an RSC component that owns how *this* type looks. This
  is opt-in: omit the block and the host renders the type generically. Shipping a
  renderer is the ONE executable surface an artifact extension carries, and it
  stays inside the boundary because a **v1 renderer requests NO host ports** — it
  renders only from a host-supplied, already-access-checked, serializable snapshot.
- **TYPE, not instance.** The package defines the type; one concrete document is
  an instance created inside the app. Never model a single document as a package.
- **The slug names the CONTENT, never the producer.** `blog-post-artifact` (the
  content is a blog post), not `blog-writer-artifact` (a producer). If the slug
  reads as an actor or a tool, rename it.
- **Naming is first-party locked**: `@cinatra-ai/<slug>-artifact` — the gate's
  name check accepts no other scope, and the scaffolder offers no scope choice
  for this kind (unlike connector and skill). A multi-type **per-connector
  artifacts pack** uses the plural `@cinatra-ai/<platform>-artifacts` suffix (the
  name validator accepts both `-artifact` and `-artifacts`); see [Per-connector
  artifacts packs](#per-connector-artifacts-packs-objecttypes-claims-mutability-atomicity).
- **Reuse before inventing.** Search existing artifact types first; a new type is
  only justified when no existing `accepts`/`satisfies` surface fits. Study the
  public exemplars `blog-post-artifact` and `marketing-icp-artifact` before
  writing a new descriptor.
- **Never ship an agent payload from an artifact repo** — `cinatra.oas` in the
  manifest is a hard validation error, and an `cinatra/oas.json` sidecar belongs
  in an agent repo.

## Manifest: the strict key allowlist

- **`package.json#cinatra` may carry ONLY** `{kind, apiVersion, artifact,
  dependencies, roles, displayName, vendor}`. Any other key — including
  `cinatra.oas` and a top-level `cinatra.sdkAbiRange` — is rejected by the gate.
  Artifact (with workflow) is one of the two kinds with a strict allowlist; do not
  copy open-manifest habits from agent or skill repos. **The renderer `ui` block
  is NOT a top-level key — it nests inside the `artifact` descriptor as
  `cinatra.artifact.ui`.**
- `kind: "artifact"`; `apiVersion` exactly `"cinatra.ai/v1"`.
- `dependencies` is a **required array** — spell "none" as `[]`, never omit it and
  never write `null`.
- `roles` is optional (`string[]`), e.g. `["artifact-blog-post-body"]` — declare
  one only when the host binds a role surface to this content type.
- `displayName` (optional) and `vendor` (optional `{key, name}`) are cross-kind
  PRESENTATION metadata the installed-card byline reads; a first-party artifact
  declares `vendor` so its byline reads "… by Cinatra" instead of dropping the
  clause.
- Package skeleton around the manifest: `files` (the tarball allowlist — must
  include any renderer entry dir), `main`/`types` pointing at `./src/index.ts`,
  and OPTIONAL peers on `@cinatra-ai/sdk-extensions` (and `@cinatra-ai/sdk-ui`
  when you ship a renderer) marked optional in `peerDependenciesMeta`.

## The cinatra.artifact descriptor (full contract)

- **`accepts` (required)** — at least ONE of the three forms, no extra keys:
  - `file: { mimeTypes: [...] }` — non-empty string array of MIME types;
  - `connectorRef: { resolvedMimeTypes: [...] }` — non-empty string array;
  - `dashboard: true` — the literal `true`, nothing else.
  Declare a **text MIME** (e.g. `text/markdown`) if instances should be
  chat-authorable — a type with only binary MIME types cannot be written in chat.
- **`satisfies`** (optional) — `string[]` of contracts this type fulfills.
- **`templates`** (optional) — array of `{id, form, mimeType, path, default}`
  with strict keys: `form` is one of `file | connectorRef | dashboard`; `path`
  points at the template file the package ships (keep it inside a `files`-listed
  dir); `default` is an optional boolean.
- **`skills`** (optional) — facets ONLY from `{authoring, matchers, validators,
  enrichers}`; each facet is an array of **skills-CATALOG ids** of the form
  `"@<pkg>:<skill-dir>"` (e.g.
  `"@cinatra-ai/blog-post-artifact:blog-post-matcher"`). NEVER a filesystem path
  and NEVER a `.md` ref — the gate rejects ids ending in `.md` or shaped like a
  path (`./`, `../`, `/`).
- **`agentDependencies`** (optional) — `string[]` of agent package names this
  type expects to collaborate with.
- **`matcherConfidenceThreshold`** (optional) — a number between 0 and 1
  (exemplars use `0.7`); a matcher verdict below it does not bind.
- **`ui`** (optional) — the versioned renderer block; see the next section.
- **`objectTypes`** (optional) — a **claims** block: an array of typed-row claims
  a per-connector artifacts pack owns. Each entry carries a self-contained JSON
  Schema and a `dispositions` payload (including the `mutability` class). See
  [Per-connector artifacts packs](#per-connector-artifacts-packs-objecttypes-claims-mutability-atomicity)
  — a single-type matcher-classified extension does not need it.
- **No unexpected descriptor keys** — the descriptor validator is strict at every
  level, same as the top-level allowlist.

## Per-connector artifacts packs (objectTypes claims, mutability, atomicity)

> **Single source of truth.** The full architecture — the two categories, the
> atomicity rule, the mutability classes, and the naming grammar — lives in the
> `cinatra-ai/docs` pages `references/platform/artifacts.md` (section 7) and
> `guides/developer/semantic-artifact-extensions.md` (epic cinatra#1448). Do not
> restate the model here; this is the authoring checklist, and it marks what a
> manifest may carry **today** versus what is still landing.

**Two categories — pick one.** A **per-connector artifacts pack**
(`@cinatra-ai/<platform>-artifacts`) claims the typed rows a connector's platform
owns — one pack per platform, each row type declared as a
`cinatra.artifact.objectTypes[]` claim. A **connector-independent artifact
extension** (the matcher-classified single-type shape the rest of this skill
covers) is for an authored deliverable that belongs to no connector. Coverage is
always optional — a connector needs no pack; reuse before inventing.

**Plural naming.** A multi-type pack uses the plural `-artifacts` suffix; the name
validator accepts both `-artifact` and `-artifacts` and the pnpm workspace glob
includes the plural. **Do not rely on filesystem auto-discovery of a plural-named
directory yet** — the boot/rescan scanner's plural widening has not landed, so
treat end-to-end discovery of a plural directory as pending even though the name
validates.

**Claim each type — self-contained schema.** Each `objectTypes[]` claim **ships
its own JSON Schema** rather than a required dependency on the connector, so
installing a pack never force-installs its connector and an unbacked pack is
valid. Pin the claimant JSON Schema to the registering connector's Zod definition
with a cross-repo schema-drift test. Exactly one package is the runtime registrar
for a type — the claim is activation evidence, not a second registrar.

**Mutability disposition — authorable today.** Each claim's `dispositions.mutability`
names how its rows change (`packages/objects/src/claims.ts`):

- `draftable` — Cinatra-authored, editable while a draft then locked (publishing
  rides a ledger; no direct draft→published edge);
- `record` — create-only and immutable;
- `external` — a connector-owned pointer to third-party content; it **must** set
  `pinnable:false` (pin the snapshot record, not the live pointer) and its rows
  are written by connector sync only.

A class may only *narrow* the type's baseline `mutableBy`, never widen it. Type
ids carry pure entity semantics with **no `-ref` suffix** — delivery form lives in
`representation.form`. The `external` reference machinery (`linked→stale→dangling`
plus snapshot-as-new-artifact) is a shipped substrate leaf
(`packages/objects/src/connector-ref.ts`); the `draftable` publish ledger is **not
yet shipped**, so you can classify a type but its publish transition is not yet
driven end-to-end.

**Claim-only mode — do not author it yet.** A multi-type pack is meant to register
**claim-only**: no generic `<package>:artifact` catch-all type, no package-wide
matcher/authoring inheritance, each claim surfaced under its exact `objectTypeId`
(contrast the classic **descriptor-only** and **hybrid** modes, which mint the
umbrella). The registration substrate exists, but **the manifest `mode` field that
selects it is not yet in the schema — never add a `mode` key to a manifest** (the
strict parse rejects it). Until the field lands an authored pack resolves to
descriptor-only/hybrid.

**Atomicity.** Never compose artifacts: no artifact-ID references inside artifact
content, and no bundle types. Embed a multi-part deliverable's parts as plain data
in one aggregate draft, and carry cross-artifact relationships as correlation-key
string fields (`runId`, `campaignId`) that are **soft provenance only** — no FK,
cascade, pin, retention, or lifecycle authority; a missing target never changes a
read/pin/delete/GC outcome. An export is always a new, independent artifact.

**Enrollment.** A pack enrolls into the **dev-lock only**; production-lock
enrollment is a separate, explicitly approved change, never part of a pack's own
merge. Per-claim activation follows the staged activation gates and batches into
projection epochs.

## The cinatra.artifact.ui renderer block (optional)

Ship a renderer only when the type should render as *itself* instead of via the
host's generic renderer. The block is a **v1, versioned** sub-schema; its
canonical shape is `packages/sdk-extensions/src/artifact-contract.ts` in
cinatra-ai/cinatra.

```jsonc
"ui": {
  "abiVersion": 1,
  "sdkAbiRange": "^2.4.0",          // the single canonical ^<SDK ABI> value (copy it; S4 scaffolder emits it)
  "renderers": {
    "detail":  { "entry": "./src/renderers/detail.tsx",  "propsApiVersion": 1 },
    "preview": { "entry": "./src/renderers/preview.tsx", "propsApiVersion": 1, "representations": ["application/pdf"] }
  }
}
```

- **`abiVersion`** — the `ui`-block ABI (distinct from the SDK ABI). Exactly `1`.
- **`sdkAbiRange`** — **GENERATED (never hand-PICKED).** There is exactly ONE
  correct value: the caret range `^<the canonical SDK ABI>` derived from
  `SDK_EXTENSIONS_ABI_VERSION` in `packages/sdk-extensions/src/register.ts` (e.g.
  ABI `2.4.0` → `"^2.4.0"`). The opt-in scaffolder ui template emits it for you and
  lands with the first renderer wave (S4); until then, copy that single
  gate-derived value by hand — never invent or guess a version. The conformance
  gate rejects any other value.
- **`renderers`** — a **non-empty partial map** over the closed v1 slot enum
  `{detail, preview}`. `detail` is the detail view; `preview` is the neutral
  inline-preview capability reused by in-core preview sites. Slots
  `listRow`/`card`/`inline` are **reserved** and rejected in v1; the HITL
  field-renderer and chat renderable-view systems are separate channels.
- Each renderer is `{ entry, propsApiVersion, representations? }` and **nothing
  else** — the schema is `.strict()`. **A v1 renderer requests NO host ports:** any
  extra key (a `ports`/`requestedHostPorts` request or any other field) is
  rejected (a read-only renderer port needs an ABI-major process).
  - **`entry`** — a package-relative, path-contained subpath (`"./…"`, no `".."`,
    no absolute path or URL) that resolves to a real file and ships inside the
    published `files` allowlist (or the tarball omits it). The conformance gate
    checks containment + file resolution + `files` inclusion; an `exports` subpath
    mapping is recommended for a stable import but is not itself required.
  - **`propsApiVersion`** — the props-contract version the renderer expects
    (integer ≥ 1; the current props ABI is `1`). The host refuses to mount a
    renderer whose expected version the supplied snapshot does not satisfy.
  - **`representations`** — optional non-empty array of MIME patterns this slot
    renders (e.g. `["application/pdf"]`).

### The renderer contract (RSC, no ports, serializable props, vendored primitives)

- **RSC module with a default export.** It receives ONE argument: a versioned,
  normalized, **serializable** props snapshot assembled host-side AFTER the host
  has access-checked the row (canonical shape:
  `src/lib/artifacts/artifact-renderer-props.ts` — row metadata, resolved
  representation, host-authorized preview/download URLs, resolved effective
  identity, and sanctioned actions as navigational **hrefs**). The versioned props
  TYPE is re-exported for extensions by the SDK **as of the first renderer wave
  (S4)** — until S4 lands it is not yet published; author against the snapshot
  shape above, and use the import the scaffolder's S4 renderer stub emits rather
  than hand-guessing a subpath.
- **No host context crosses.** DB handles, the request, and server-action closures
  over `ctx` never cross the boundary; the renderer may run as a client component,
  so the RSC→client serialization boundary must hold. Actions are host-authorized
  links, never closures.
- **Use shadcn PROPERLY — vendored, relative, provenance-gated.** Compose the
  renderer from your package's **vendored** copies of the `@cinatra-ai` shadcn
  primitives, imported by **relative path** into your own tree
  (`scripts/extensions/vendor-extension-primitives.mjs` in cinatra-ai/cinatra
  vendors them; the pinned CLI is `pnpm dlx shadcn@4.8.2`, never `@latest`).
  **Never** pull an ad-hoc UI library, and **never** import a host internal (`@/…`)
  or another extension. Declaring your OWN registry items (`registryItems`) —
  publishing your own presentational components to the shared registry — is a
  separate capability with its own `registry-authoring` skill.
- **Failure isolation + "requires rebuild".** Renderers are build-known, wired
  through a generated literal-import map — until your extension is in the base
  image build its renderer is not wired, so the type renders **generically** with a
  **"requires rebuild"** indicator (never blank, never an error). A pre-render
  failure degrades to the generic renderer + a sanitized diagnostic; a render-time
  throw hits the route-segment error boundary and a repeatedly-throwing renderer is
  quarantined. **The floor is never blank.**
- **Boot vs publish.** A malformed `ui` block NEVER rejects the whole manifest or
  drops your type registration / `objectTypes` claims: boot degrades-with-diagnostic
  and drops only the renderer; the publish/conformance gate rejects the same block
  fail-closed.

## The typed mirror (src/index.ts)

- `src/index.ts` exports a typed `SemanticArtifactManifest` that **MIRRORS the
  manifest** (including the `ui` block when present). It exists for type-checked
  authoring and tooling only.
- **The `package.json#cinatra` block is what the host reads.** The mirror is the
  copy; keep the two in sync on every descriptor edit — drift between them is a
  bug even though only the manifest side takes effect.

## The paired matcher skill

- Ship `skills/<base>-matcher/SKILL.md` (frontmatter `name` + `description`
  only) and register it in the descriptor as
  `skills.matchers: ["@cinatra-ai/<slug>-artifact:<base>-matcher"]`.
- Write it as a **strict classifier prompt**: what the content IS (concrete
  structural signals), what it is NOT (`matches: false` cases naming the
  neighboring types it must not swallow), and a **rubric of confidence bands**
  (e.g. 0.85-0.95 all signals present; below 0.50 clearly not a match).
- **Output contract** — JSON only, no markdown wrapper:
  `{"matches": <bool>, "confidence": <number 0..1>, "rationale": "<short>"}`.
- Make the bands agree with `matcherConfidenceThreshold`: the band you consider
  a real match must sit at or above the threshold.

## Boundaries (what this skill defers)

- Lifecycle — scaffold, validate loop, PR, CI, release-readiness — belongs to
  `extension-authoring`; conventions, lock/companion choreography to
  `extension-conventions`; code-boundary rules (import bans, serverEntry, SDK
  peers, the artifact-renderer channel, the opaque-identity core rule) to
  `extension-boundary`. A renderer-shipping artifact hits the SDK-peer and
  vendored-primitives rules; a declarative-only artifact ships no renderer, so most
  boundary rules are moot, but the common gate rules still run.
- Declaring your OWN `registryItems` (publishing shadcn registry components) —
  the extensible design-registry authoring contract — belongs to the
  `registry-authoring` skill.
- Release doctrine (restated because authors hit it): a pushed tag equal to
  `v<package.json.version>` — or, on newer workflow generations, the published
  GitHub Release carrying it — IS the publish trigger (marketplace submit);
  NEVER push such a tag, create or publish a GitHub Release, or publish
  autonomously — release-readiness reporting only; the release act needs
  explicit owner/maintainer approval.

## Steps (operational)

1. Reuse check: search existing artifact types for an `accepts`/`satisfies` fit;
   only proceed if none fits. Read `blog-post-artifact` and
   `marketing-icp-artifact` as the reference shapes.
2. Scaffold: `cinatra create-extension artifact <name> --yes` (fallback
   `npx @cinatra-ai/cinatra@latest create-extension artifact <name> --yes`).
   The template ships a descriptor stub (markdown MIME, a `<base>-matcher`
   entry, threshold 0.7) — edit it, do not hand-roll the tree. The opt-in `ui`
   scaffolder template (renderer stub, `ui` block, exports/`files`, sdkAbiRange)
   lands with the first renderer wave (S4); until then, add the `ui` block and
   renderer by hand per the contract above.
3. Name the CONTENT: confirm `@cinatra-ai/<slug>-artifact` where `<slug>` names
   the content type, not the producer.
4. Fill the descriptor against the full contract above; keep the `cinatra` block
   to the seven allowlisted keys; nest any `ui` block inside `artifact`.
5. If shipping a renderer: add the `cinatra.artifact.ui` block, write the
   `detail`/`preview` RSC component(s) from the host snapshot (no ports), compose
   VENDORED `@cinatra-ai` primitives by relative import, list the renderer dir in
   `files`, and set `sdkAbiRange` to the single canonical `^<SDK ABI>` value
   derived from `SDK_EXTENSIONS_ABI_VERSION` (copy it; the S4 scaffolder ui
   template emits it, and the conformance gate rejects any other value).
6. Sync the typed `SemanticArtifactManifest` in `src/index.ts` to the manifest.
7. Write the matcher skill: IS/IS-NOT rubric, confidence bands aligned with the
   threshold, exact JSON output contract; register its catalog id in
   `skills.matchers`.
8. Validate: `node extension-kind-gate.mjs --package-root .`, then the conformance
   gate for a `ui` block, then `npm pack --dry-run` (tarball = `src/`, `skills/`,
   README, LICENSE, package.json, and any renderer/template files in `files`). Fix
   and re-run until green.
9. Hand back to `extension-authoring` for the rest of the lifecycle.
