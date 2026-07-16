---
name: cinatra-extension-verify
description: "Conformance and boundary audit of an existing cinatra extension repo: run the extension-authoring validate stage, audit a connector's cinatra/config.json as a first-class step (never assumed covered by the vendored gate), drive the full extension-boundary sweep and the kind specialist's checklist, then finish with a release-readiness report (version-vs-tag parity, files packlist, dependency edges) while performing NO release act. $ARGUMENTS is an optional path to the extension package root — defaults to the current directory."
argument-hint: "[path to extension repo — defaults to current directory]"
disable-model-invocation: true
---

# /cinatra-extension-verify

Audit the extension repo at the path in `$ARGUMENTS` (default: the current directory) for
conformance and boundary discipline. This command is a thin orchestrator — the validation
procedure lives in `extension-authoring`, the IoC sweep in `extension-boundary`, and
per-kind doctrine in the kind specialists. Run every stage; do not stop at the first red:

1. Resolve the target package root from `$ARGUMENTS` (or use the current directory). It
   must contain a package.json with a `cinatra` block; read `cinatra.kind`
   (`agent | connector | artifact | skill | workflow`) to select the specialist. If it is
   not an extension package, stop and say so.
2. Invoke the **`extension-authoring`** skill (validate stage) at the package root:
   `node extension-kind-gate.mjs --package-root .` then `npm pack --dry-run`. Record each
   result; a red here does NOT skip the later stages — the deliverable is a complete audit.
3. **Connector config audit — first-class, never assumed covered by the vendored gate**
   (vendored `extension-kind-gate.mjs` copies drift, and older copies predate these rules).
   For kind `connector`, verify directly:
   - `cinatra/config.json` is PRESENT — an absent file hard-fails at both submit and
     install (cinatra#955);
   - `formatVersion` is exactly 1; unknown keys at any level are hard errors;
   - exactly ONE of `access.scope.default` XOR `access.scope.only` (a valid file with no
     `access.scope` resolves `default:"admin"` — flag it and recommend declaring
     explicitly);
   - the scope value is a lowercase token from `user | project | team | organization |
     workspace | admin` — UI labels such as "Personal: Only me" are display names, never
     valid tokens;
   - protected slugs `openai`, `anthropic`, `gemini` declare `only:"admin"`;
   - package.json carries NO `cinatra.visibility` key — for connectors its presence with
     any value is a validation error, even where an older vendored gate still accepts it.
4. **Artifact `cinatra.artifact.ui` audit — first-class when present** (epic cinatra#1620
   S1/S2). For kind `artifact`, if the descriptor declares `cinatra.artifact.ui`, verify
   the renderer block directly (the vendored kind gate may predate it; the extension-repo
   conformance gate `scripts/extensions/conformance-gate.mjs` `checkArtifactUi` is the
   authority):
   - `ui` nests inside `cinatra.artifact` (NOT a top-level `cinatra` key); shape is
     `{ abiVersion, sdkAbiRange, renderers?, registryItems? }` with no extra keys — since
     cinatra#1623 (S5) both `renderers` and `registryItems` are OPTIONAL, but at least one
     of the two must be non-empty;
   - `abiVersion` is exactly `1`; `sdkAbiRange` is the GENERATED value (never hand-written)
     — flag any hand-edited range;
   - `renderers`, when present, is a non-empty map over the closed v1 slot enum
     `{detail, preview}` (reserved `listRow`/`card`/`inline` are rejected in v1);
   - each renderer is `{ entry, propsApiVersion, representations? }` and NOTHING else — a
     `ports`/`requestedHostPorts` request or any extra key means a v1 renderer is illegally
     asking for host access (v1 renderers request NO host ports);
   - each `entry` is a package-relative, path-contained subpath that resolves to a real
     file INSIDE the `files` packlist (else the tarball omits it);
   - `propsApiVersion` is an integer ≥ 1;
   - the renderer source composes VENDORED `@cinatra-ai` primitives by relative import and
     imports no host internal (`@/…`) and no ad-hoc UI library.

   If the `ui` block declares `registryItems` (cinatra#1623 S5), audit those too
   (`checkArtifactUiRegistryItems` is the authority) — note `renderers` is now OPTIONAL, so
   a `ui` block may carry `registryItems` alone, but at least one of the two must be
   non-empty:
   - each item carries ONLY `{ name, entry, type, description }` — any extra field
     (e.g. a declared `dependencies`/`registryDependencies`) is a presentational-boundary
     violation (npm + registry deps are extracted from the item SOURCE by the publish
     pipeline, never declared);
   - `name` is a strict-lowercase `<component>` token (`[a-z0-9]`, hyphen-joined), unique
     within the manifest;
   - `entry` is a package-relative, path-contained subpath resolving to a real file inside
     the `files` packlist;
   - `type` is one of `{ registry:ui, registry:lib }`; `description` is non-empty;
   - the item SOURCE is presentational-only — imports only public npm + other registry
     items, never a host internal (`@/…`), an auth context, or a data-fetch. Route deeper
     registry-identity/serving questions to the `registry-authoring` skill.
   A declarative-only artifact (no `ui` block) skips this stage — that is a valid shape.
5. Invoke the **`extension-boundary`** skill (full sweep) for the IoC audit: host-import
   bans, type-only SDK imports over the serverEntry graph, optional-peer discipline, the
   artifact-renderer channel, and the README and license contracts. That skill owns the
   rules — do not restate or shortcut them here.
6. Run the kind specialist's checklist against the payload — **`connector-authoring`**,
   **`agent-authoring`**, **`artifact-authoring`**, or **`skill-extension-authoring`**.
   For kind `workflow`, still audit what exists but flag that the kind is scheduled for
   removal (cinatra#1030). Conventions and lock/companion choreography questions defer to
   **`extension-conventions`**.
7. Release-readiness checks (report-only):
   - version vs tag parity: the package.json `version` is strict semver and no tag equal
     to `v<package.json.version>` already exists — pushing such a tag (or, on newer
     workflow generations, publishing the GitHub Release that carries it) IS the publish
     trigger (marketplace submit);
   - files packlist: the `npm pack --dry-run` file list ships the full payload (including
     the `cinatra/` directory for connectors) and leaks no CI, gate, or internal files;
   - dependency edges: every `cinatra.dependencies[]` entry is well-formed, its `kind`
     matches the target's actual kind, and version constraints are exact-pinned.
8. Report a per-stage pass/fail summary with every finding and its fix direction, then
   state explicitly that NO release act was performed. NEVER push a tag matching
   `v<package.json.version>`, create or publish a GitHub Release, or publish
   autonomously — this
   command reports release-readiness only; the release act needs explicit owner/maintainer
   approval.
