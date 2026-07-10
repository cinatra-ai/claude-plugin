---
name: extension-conventions
user-invocable: false
description: "Apply the conventions for authoring or integrating a cinatra extension, reconciled to the current architecture (one repo per extension; five kinds — agent/connector/artifact/skill/workflow, with workflow scheduled for removal under cinatra#1030; scaffolded by `cinatra create-extension <kind>` from the published @cinatra-ai/cinatra CLI; the package.json#cinatra manifest). Activates for: 'lock-pin choreography', 'required extension lock equality', 'system extension lock equality', 'create-cinatra-extension', 'cinatra create-extension', 'package.json#cinatra', 'connector manifest shape', 'agent manifest shape', 'artifact manifest shape', 'companion merge choreography', 'seed the transitive required closure', 'extension repo conventions'. Pins ride the same core PR as the manifest; cinatra.extensions == cinatra.systemExtensions == cinatra-required-extensions.lock.json is untouchable; the rolling dev-lock auto-bump is never manually relocked; a connector without a package-root cinatra/config.json access declaration hard-fails submit and install; seed the transitive required-closure before boot or the app crashes."
argument-hint: "[connector | agent | artifact | skill | workflow]"
allowed-tools:
  - Read
  - Bash
triggers:
  - "lock-pin choreography"
  - "required extension lock equality"
  - "system extension lock equality"
  - "create-cinatra-extension"
  - "cinatra create-extension"
  - "package.json#cinatra"
  - "connector manifest shape"
  - "agent manifest shape"
  - "artifact manifest shape"
  - "companion merge choreography"
  - "seed the transitive required closure"
  - "extension repo conventions"
antiTriggers:
  - "pdf"
  - "personal repo"
  - "court"
  - "npm package for my"
---


<objective>
Apply cinatra extension conventions reconciled to current architecture: one repo per
extension across the five kinds (agent/connector/artifact/skill/workflow — workflow
is scheduled for removal, cinatra#1030), scaffolded by `cinatra create-extension
<kind> [name]` from the published @cinatra-ai/cinatra CLI, with the kind-specific
package.json#cinatra manifest. Keep pins on the same core PR as the manifest; keep
cinatra.extensions == cinatra.systemExtensions == cinatra-required-extensions.lock.json
equal; let the rolling dev-lock auto-bump roll (never manually relock); seed the
transitive required-closure before booting on the real surface.
</objective>

# Workflow: extension-conventions

> Engine body for the `extension-conventions` skill. The heavy doctrine lives
> in the body; the thin skill launcher stays stable across content updates.

> Evidence rule (what counts as proof): drive the real surface (never a stub),
> only trust a CONCLUDED check, bind a verdict to the exact commit SHA, capture
> output rather than a piped exit code, and confirm a change actually landed.

## Purpose

The conventions for AUTHORING and integrating a Cinatra extension, reconciled to
the CURRENT architecture. This skill states the final conventions a developer
applies. Reconcile against the live architecture at authoring time, since the
architecture drifts — the rules below are the durable distillation.

## Current architecture (the model every convention is grounded in)

- **One repo per extension.** Each connector / agent / artifact / skill / workflow
  is its OWN repo, published under the `@cinatra-ai/<slug>-<kind>` npm identity
  (skill bundles use the plural `-skills` suffix); a vendor-scoped extension uses
  `@<vendor>/<slug>-<kind>`. There is no in-tree monorepo source tree for
  extensions anymore — that model is gone.
- **Scaffolded, not hand-built.** `cinatra create-extension <kind> [name]` from the
  published `@cinatra-ai/cinatra` CLI (fallback: `npx @cinatra-ai/cinatra@latest
  create-extension <kind> [name]`) writes a ready-to-author repo for one of the
  **five kinds**, pre-wired with the `package.json#cinatra` manifest, a
  kind-appropriate payload stub, the org hygiene CI gates, a license, and a
  marketplace release workflow. Non-interactive runs never prompt: a missing kind
  or name exits with the usage error code (2). A scope choice exists ONLY for
  connector (any vendor scope) and skill (first-party or the vendored allowlist);
  agent / artifact / workflow are locked first-party. Start from the scaffolder,
  not a hand-rolled tree.
- **Marketplace ↔ registry boundary (boundary level only).** The marketplace is the
  vendor-facing storefront where vendors register and publish; the registry is the
  machine-facing npm-protocol endpoint app instances install from. Publishing
  crosses that boundary with source-mirror CI. Keep this at the boundary level —
  never embed marketplace vendor-stack internals in a skill.
- **Release doctrine.** A pushed tag equal to `v<package.json.version>` — or, on
  newer workflow generations, the published GitHub Release carrying it — IS the
  publish trigger (marketplace submit); NEVER push such a tag, create or publish a
  GitHub Release, or publish autonomously — release-readiness reporting only; the
  release act needs explicit owner/maintainer approval.

## Manifest shape per kind (`package.json#cinatra`)

The manifest always carries `apiVersion: "cinatra.ai/v1"` + `kind` + `dependencies`
(a required array — `[]` when none), plus kind-specific fields. Re-verify the exact
field set against the live SDK packages + the CLI scaffolder at authoring time.

- **connector** — `displayName`, `serverEntry: "./register"` (the `register(ctx)`
  entry the host calls at boot), `requestedHostPorts` (the least-privilege host-port
  names the connector asks the host for), `sdkAbiRange`, `vendor: { key, name }`,
  and a UI surface: `uiSurface: "schema-config"` with a declarative `configSchema`
  (the host renders the form), or `bundled-react` DERIVED from the presence of the
  setup/settings page files (`src/setup-page.tsx` / `src/settings-page.tsx`) —
  never declared by hand. A connector also MUST ship the package-root
  `cinatra/config.json` access declaration:
  `{"formatVersion": 1, "access": {"scope": {"default" | "only": <token>}}}` with
  lowercase tokens `user | project | team | organization | workspace | admin` and
  exactly ONE of `default` XOR `only`. Absence HARD-FAILS both submit and install
  (cinatra#955); a present, valid file with no `access.scope` resolves
  `default: "admin"`; protected slugs `openai` / `anthropic` / `gemini` must
  declare `only: "admin"`. The manifest `cinatra.visibility` axis is DELETED — its
  presence with any value is a validation error (older vendored gate copies still
  accept it; the current core rule wins).
- **agent** — the real manifest is the MINIMAL cinatra block
  `{ apiVersion, kind, dependencies }` plus conventions layered on top:
  `dependencies` edges to connectors carry `kind: "connector"`, `consumes` lists
  the primitives the agent calls, `produces` names the artifact packages it emits,
  and `agentDependencies` is a map of agent package → version range. Payload =
  `cinatra/oas.json` (an OpenAgentSpec Flow) + `skills/<slug>/SKILL.md` (the
  agent's system prompt); `files: ["cinatra", "skills"]`. An agent is a full
  extension repo now — not a single virtual-agent config file.
- **artifact** — `roles` + `artifact: { accepts: { file: { mimeTypes } }, skills:
  { matchers }, matcherConfidenceThreshold }`, under a STRICT cinatra key allowlist
  (`kind`, `apiVersion`, `artifact`, `dependencies`, `roles` — no `cinatra.oas`).
  The content-type slug names the CONTENT (not the producer); pair a matcher skill
  with an author skill; do not ship an agent payload from an artifact repo; reuse
  an existing artifact rather than abstracting prematurely.
- **skill** — `capabilities` (a `{ "domain.action": "skill-slug" }` map). Theme the
  bundle by its consumer, use a verb-noun inner slug, and respect the
  workspace-visible vs system-visible distinction. Author it as a DEV process that
  produces a product-skill extension — it is not itself a runtime skill.
- **workflow** — SCHEDULED FOR REMOVAL: the open epic cinatra#1030 replaces the
  kind with project agents plus a typed project template. Do not start new
  workflow extensions; re-check the epic state before acting on any explicit user
  override.
- ALL FIVE kinds carry a self-contained vendored **extension-kind-gate.mjs** run by
  repo CI (`node extension-kind-gate.mjs --package-root .`, paired with
  `npm pack --dry-run`) — keep it green. The vendored copies drift across the
  fleet; on any conflict, the rules on current core origin/main win.

## Companion-merge + lock-pin choreography (the coupling invariant)

The app repo pins the extension set in root lockfiles (a dev-extension lock + a
required-extension lock); the dev flow clones the pinned extension repos back into
the app, and the live SDK packages register them.

- **Destination-first companion merges.** When a change spans an extension repo and
  the app, land the destination side in the order the coupling requires; the pins
  ride the SAME core PR as the baseline/manifest change — a manifest change and its
  pin are one merge, never split across PRs.
- **`cinatra.extensions == cinatra.systemExtensions ==
  cinatra-required-extensions.lock.json` equality is untouchable.** These three
  must stay equal; a drift between them is a coupling break (there is NO
  `requiredExtensions` key — the equality is over these exact names). Pinned-empty
  coupling gates exist to catch exactly this — keep them satisfied.
- **The rolling dev-lock auto-bump absorbs tip drift — never manually relock.** Let
  the dev/required lock roll forward on its own; a hand-edited relock fights the
  auto-bump and lands a phantom pin.
- **Seed the transitive required-closure BEFORE boot verification.** A required
  extension that pulls in further required extensions must have its FULL transitive
  closure seeded, or the app boot crashes on a missing closure member. Seed the
  closure first, then verify boot on the real surface (see the evidence recipe
  above for what a real boot proof requires).
- **A core capability deletion is a lockstep cutover with REQUIRED release
  riders.** When the app removes or relocates a capability that PUBLISHED
  extension versions depend on (e.g. a host-owned store moves into its owning
  connector), the
  currently-published extension versions break on the new core. Two obligations
  follow. At MERGE time it is one choreography: the extension-side surfaces,
  the core deletion, and the lock bump land together (the pins-ride-the-same-PR
  rule above), never split so that core briefly ships without the replacement.
  At RELEASE time the affected extension releases are REQUIRED riders of the
  next core release — enumerate them up front by diffing the deletion against
  what the published extension versions consume, and ship them in the same
  release wave; a rider discovered after the core ships is a broken install for
  every user of the published extension.

## Routing (the extension-dev pack)

- Commands: `/cinatra-extension-new` scaffolds a new extension;
  `/cinatra-extension-verify` validates an existing one.
- `extension-authoring` owns the core authoring lifecycle; the kind specialists are
  `connector-authoring`, `agent-authoring`, `artifact-authoring`, and
  `skill-extension-authoring`; the extension ↔ core boundary doctrine lives in
  `extension-boundary` — defer to them rather than restating their rules here.
- This skill remains the home of the cross-kind conventions plus the lock/companion
  choreography above.

## Worktree-evaporates, branch-survives

A workflow worktree may be auto-cleaned when an agent finishes, but the committed
BRANCH ref survives — recover work from the branch in the parent clone, do not
assume it was lost. And a green repo GATE is not the same as architecturally
correct: a passing gate can still miss a coupling/architecture defect, so pair the
gate with a real-surface boot verification.

## Steps (operational)

1. Identify the extension KIND (for workflow: stop — cinatra#1030 removes the kind;
   re-check the epic before any override) and start from
   `cinatra create-extension <kind> [name]` (fallback
   `npx @cinatra-ai/cinatra@latest create-extension`) — never hand-roll the tree.
2. Fill `package.json#cinatra` with the kind-specific fields above, re-verified
   against the live SDK + scaffolder; a connector additionally ships the mandatory
   package-root `cinatra/config.json` access declaration.
3. Validate locally: `node extension-kind-gate.mjs --package-root .` plus
   `npm pack --dry-run`; on any gate-vs-core conflict, current core origin/main
   wins.
4. For a change spanning the extension and the app: keep the pin on the SAME core
   PR as the manifest; keep `cinatra.extensions == cinatra.systemExtensions ==
   cinatra-required-extensions.lock.json` equal; let the dev-lock auto-bump roll;
   seed the transitive required-closure.
5. Verify the integrated result by booting on the REAL surface (the evidence recipe)
   — a green gate alone is not proof of correct coupling.
6. Report release-readiness only — never push a `v<package.json.version>` tag,
   create or publish a GitHub Release, or publish autonomously (either act can fire
   the marketplace submit, depending on the repo's workflow generation); the release
   act needs explicit owner/maintainer approval.
