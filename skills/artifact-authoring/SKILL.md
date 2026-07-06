---
name: artifact-authoring
description: "Author a cinatra ARTIFACT extension — a metadata-only content-TYPE definition with no runtime code: the strict package.json#cinatra key allowlist {kind, apiVersion, artifact, dependencies, roles}, the full cinatra.artifact descriptor (accepts, satisfies, templates, skills facets, agentDependencies, matcherConfidenceThreshold), the typed SemanticArtifactManifest mirror in src/index.ts, and the paired matcher skill. Activates for: 'author an artifact extension', 'new artifact type', 'cinatra.artifact descriptor', 'artifact manifest allowlist', 'artifact matcher skill', 'matcher confidence threshold', 'semantic artifact manifest'. Naming is @cinatra-ai/<slug>-artifact (first-party locked); the slug names the CONTENT, never the producer; accepts requires at least one of file.mimeTypes / connectorRef.resolvedMimeTypes / dashboard true; skills facets take skills-catalog ids of the form '@<pkg>:<skill-dir>', never a path or .md ref; reuse an existing artifact type before inventing a new one."
argument-hint: "[<content-slug> | descriptor | matcher | templates]"
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
antiTriggers:
  - "claude code plugin"
  - "render an html artifact"
  - "chat assistant skill"
  - "court"
  - "pdf"
---


<objective>
Author a cinatra artifact extension: a metadata-only TYPE definition for one kind of
content the platform can recognize, template, and route — with no runtime code.
Fill the strict package.json#cinatra manifest (the host-read source of truth),
mirror it as a typed SemanticArtifactManifest in src/index.ts, and pair it with a
matcher skill whose confidence bands agree with matcherConfidenceThreshold.
Reuse an existing artifact type before inventing a new one.
</objective>

# Workflow: artifact-authoring

> Kind specialist for the artifact extension kind. `extension-authoring` routes
> here; lifecycle, boundary, and convention rules stay with their own skills.

## Purpose

Everything artifact-specific: what an artifact extension is, the strict manifest
allowlist, the full `cinatra.artifact` descriptor contract, the typed mirror, and
the paired matcher skill. The validator for all of it is the vendored gate:
`node extension-kind-gate.mjs --package-root .` plus `npm pack --dry-run`.

## What an artifact extension IS (and is not)

- **A metadata-only TYPE definition.** It declares a content TYPE — "a blog post",
  "an ICP document" — that the host can classify, template, and bind agents to.
  There is **no runtime code**: no `serverEntry`, no `register(ctx)`, nothing
  executed. The only source file is a typed mirror of the manifest.
- **TYPE, not instance.** The package defines the type; one concrete document is
  an instance created inside the app. Never model a single document as a package.
- **The slug names the CONTENT, never the producer.** `blog-post-artifact` (the
  content is a blog post), not `blog-writer-artifact` (a producer). If the slug
  reads as an actor or a tool, rename it.
- **Naming is first-party locked**: `@cinatra-ai/<slug>-artifact` — the gate's
  name check accepts no other scope, and the scaffolder offers no scope choice
  for this kind (unlike connector and skill).
- **Reuse before inventing.** Search existing artifact types first; a new type is
  only justified when no existing `accepts`/`satisfies` surface fits. Study the
  public exemplars `blog-post-artifact` and `marketing-icp-artifact` before
  writing a new descriptor.
- **Never ship an agent payload from an artifact repo** — `cinatra.oas` in the
  manifest is a hard validation error, and an `cinatra/oas.json` sidecar belongs
  in an agent repo.

## Manifest: the strict key allowlist

- **`package.json#cinatra` may carry ONLY** `{kind, apiVersion, artifact,
  dependencies, roles}`. Any other key — including `cinatra.oas` — is rejected by
  the gate. Artifact (with workflow) is one of the two kinds with a strict
  allowlist; do not copy open-manifest habits from agent or skill repos.
- `kind: "artifact"`; `apiVersion` exactly `"cinatra.ai/v1"`.
- `dependencies` is a **required array** — spell "none" as `[]`, never omit it and
  never write `null`.
- `roles` is optional (`string[]`), e.g. `["artifact-blog-post-body"]` — declare
  one only when the host binds a role surface to this content type.
- Package skeleton around the manifest: `files: ["src", "skills"]` (the tarball
  allowlist), `main`/`types` pointing at `./src/index.ts`, and at most an
  OPTIONAL peer on `@cinatra-ai/sdk-extensions` (`"*"`, marked optional in
  `peerDependenciesMeta`) for the mirror's types.

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
- **No unexpected descriptor keys** — the descriptor validator is strict at every
  level, same as the top-level allowlist.

## The typed mirror (src/index.ts)

- `src/index.ts` exports a typed `SemanticArtifactManifest` that **MIRRORS the
  manifest**. It exists for type-checked authoring and tooling only.
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
  peers) to `extension-boundary` — mostly moot here since an artifact ships no
  runtime code, but the common gate rules still run.
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
   entry, threshold 0.7) — edit it, do not hand-roll the tree.
3. Name the CONTENT: confirm `@cinatra-ai/<slug>-artifact` where `<slug>` names
   the content type, not the producer.
4. Fill the descriptor against the full contract above; keep the `cinatra` block
   to the five allowlisted keys.
5. Sync the typed `SemanticArtifactManifest` in `src/index.ts` to the manifest.
6. Write the matcher skill: IS/IS-NOT rubric, confidence bands aligned with the
   threshold, exact JSON output contract; register its catalog id in
   `skills.matchers`.
7. Validate: `node extension-kind-gate.mjs --package-root .` then
   `npm pack --dry-run` (tarball = `src/`, `skills/`, README, LICENSE,
   package.json). Fix and re-run until green.
8. Hand back to `extension-authoring` for the rest of the lifecycle.
