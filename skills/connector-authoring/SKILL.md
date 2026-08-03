---
name: connector-authoring
user-invocable: false
description: "Author a production-shape cinatra CONNECTOR extension: scope declaration, UI surface, server entry, host ports, outbound-call and stored-record identity rules, extraction cutovers, manifest, migrations decision. Activates for: 'author a connector', 'new cinatra connector', 'connector access scope', 'cinatra/config.json', 'connector setup page', 'schema-config vs bundled-react', 'requestedHostPorts', 'connector register(ctx)', 'connector migrations', 'connector outbound url', 'extract a capability from a connector'. Load-bearing rules: a user-supplied URL is allowlisted (exact scheme + hostname) BEFORE any fetch and every redirect Location is gated before it is followed, with the final response.url asserted as a backstop — fetch-then-check is server-side request forgery; one canonical key derives a record's id, its dedupe comparison AND its delete filter (a pathname-derived id beside a full-URL dedupe yields lookalike rows sharing an id); a live-surface acceptance criterion stays PARTIAL until the running host renders it; at extraction one capability id has one owning package (exclude the pre-extraction releases in the consuming version range, holding the cutover release until the range can express it) and every changed fallback is declared to the cutover; package-root cinatra/config.json is MANDATORY — absence hard-fails BOTH marketplace submit and install (cinatra#955); scope tokens are lowercase user|project|team|organization|workspace|admin with exactly ONE of default XOR only; cinatra.visibility is DELETED for connectors — its presence is a validation error even though older vendored gate copies still accept it; register(ctx) is registration-only with TYPE-ONLY SDK imports (values arrive via ctx, host services resolved lazily); requestedHostPorts is least-privilege from the 14-port vocabulary and changing the list resets the grant to pending; the CLI connector template lags the fleet — write cinatra/config.json yourself immediately after scaffolding and study plane/twenty as the archetypes."
argument-hint: "[<vendor>/<slug>-connector | scope | ui | ports | migrations]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
triggers:
  - "author a connector"
  - "new cinatra connector"
  - "connector access scope"
  - "cinatra/config.json"
  - "connector setup page"
  - "schema-config vs bundled-react"
  - "requestedhostports"
  - "connector register(ctx)"
  - "connector migrations"
  - "connector outbound url"
  - "extract a capability from a connector"
antiTriggers:
  - "claude code plugin"
  - "chat assistant skill"
  - "kafka connect"
  - "jdbc connector"
  - "usb connector"
---


<objective>
Author a cinatra connector that matches the CURRENT fleet shape, not the stale
template: declare access scope in the mandatory package-root cinatra/config.json,
choose a UI surface deliberately (schema-config unless bespoke UX is required),
implement a registration-only register(ctx) with type-only SDK imports and lazily
resolved host services, request least-privilege host ports, allowlist every
outbound URL before the fetch and re-check it after, derive each stored record's
identity from ONE canonical key, keep migrations only when host-run DB state is
genuinely needed, and verify with the kind gate plus a packlist dry-run before any
release-readiness report.
</objective>

# Workflow: connector-authoring

## Purpose

The CONNECTOR specialist. `extension-authoring` routes here when the kind is
connector; this skill owns the connector-specific contracts — scope declaration,
UI surface, server-side entry, host ports, manifest fields, and the migrations
decision — grounded in the live core validators (`cinatra-ai/cinatra`,
`packages/sdk-extensions/src/access-config.ts` and `src/manifest.ts`) and the
current public fleet archetypes.

## Scope doctrine (declare it first — the file is mandatory)

Connectors are scope-bound: every connector declares who may use its connections.

- **`cinatra/config.json` at the package root is MANDATORY.** Absence hard-fails
  the connector at BOTH marketplace submit and install (connector-scoping closing
  wave, cinatra#955). Write it immediately after scaffolding, before any code.
- **Exact contract** — `formatVersion` exactly 1; unknown keys hard-fail at every
  level; exactly ONE of `default` XOR `only` (both or neither is a hard error):

  ```json
  { "formatVersion": 1, "access": { "scope": { "default": "workspace" } } }
  { "formatVersion": 1, "access": { "scope": { "only": "admin" } } }
  ```

  A present, valid file with no `access.scope` resolves `default:"admin"`.
- **Token vocabulary (lowercase, the only legal values):** `user | project |
  team | organization | workspace | admin`. UI labels such as "Personal: Only me"
  or "Workspace: Admins only" are display names, NOT tokens — emitting a label
  where a token belongs is a validation error.
- **`default` vs `only`:** `default` is a pre-selected recommendation the
  connecting user may change; `only` is an exclusive, server-enforced ceiling —
  the runtime clamps any wider grant to it.
- **Protected slugs** `openai`, `anthropic`, `gemini` MUST declare `only:"admin"`.
- **`cinatra.visibility` is DELETED for connectors.** Its presence in the
  manifest with ANY value is a validation error — scope lives in
  `cinatra/config.json` only. Older vendored `extension-kind-gate.mjs` copies
  still accept `visibility`; on any conflict the current core rule wins
  (authoritative validator: `packages/sdk-extensions/src/access-config.ts`).

## UI surfaces — declare deliberately

UI is not gate-mandatory, but the authoring rule is: every vendor connector
declares a surface on purpose. Choose `schema-config` unless bespoke UX is
genuinely required.

- **`schema-config` (the default choice).** Declarative `cinatra.configSchema`
  rendered host-side as a generic form; hot-installable; ships NO React. Field
  kinds: `text, secret, nango-connect, repeatable-list, status-probe,
  copyable-credential, named-action, select, record-list, banner, advisory,
  dynamic-select-options, boolean, number, free-list`. Every field carries a
  `key` and `label`; action-backed kinds (`named-action`, `status-probe`)
  reference host-dispatched actions by `actionId` — pure data, never functions.
  Declaring `uiSurface:"schema-config"` without a `configSchema` fails the gate.
- **`bundled-react` (derived, never hand-declared).** The manifest generator
  derives it from file presence of `src/setup-page.tsx` / `src/settings-page.tsx`
  plus the package exports `./setup-page` / `./settings-page`. Mounted at the
  host route `/connectors/<vendor>/<slug>/setup` with a grant-typed ctx built
  from `requestedHostPorts`. Setup-page contract: default-export an ASYNC server
  component receiving `{ packageId, slug, searchParams, ctx }` — ctx is
  render-time only. Base-image-bound: NOT hot-installable; a runtime install
  without the page in the base image renders a "requires rebuild" state.

## Server side — register(ctx) and the serverEntry graph

- **Entry chain:** manifest `serverEntry: "./register"` → package export
  `./register` → `src/register.ts` exporting `register(ctx)` (optional
  `bootstrap` / `destroy`).
- **Registration-only:** no I/O, no network, no DB at register time; probe-safe.
- **SDK imports are TYPE-ONLY across the serverEntry graph** — values arrive via
  ctx. A value import of a host peer reachable from `./register` fails the
  boundary gates.
- **Resolve host services LAZILY at call time** via
  `ctx.capabilities.resolveProviders(...)` inside the handler that needs them —
  never at module top level, never cached at register time.
- **Register providers** via `ctx.capabilities.registerProvider(capabilityId,
  { packageName, impl })`.
- **Deps-slot pattern** (`src/deps.ts`): anchor host-bound deps on `globalThis`
  under a namespaced + versioned `Symbol.for(...)` slot so separately compiled
  bundles (settings page, server actions) resolve the same host-bound instances.
- **"use server" actions** live in `src/actions.ts`; they cannot close over the
  render-time ctx — route shared state through the deps slot.
- **Optional MCP surface:** `src/mcp/module.ts` exported as `./mcp-module`,
  exporting exactly one register/create factory.
- **Optional `devSetup` manifest hook** (dev-only imperative provisioning):
  returns a status object, never throws, and is NOT part of the frozen register
  ABI.

## Host ports — least privilege

- **The 14-port vocabulary:** `db, settings, secrets, nango, authSession, mcp,
  objects, jobs, notifications, ui, logger, runtime, capabilities, telemetry`
  (`packages/sdk-extensions/src/host-context.ts`).
- Request ONLY the ports your handlers actually call. `logger` and `runtime` are
  ambient — never declare them. `db` is reserved — never request it.
- Ungranted port access fails loud at runtime, naming
  `cinatra.requestedHostPorts` as the fix.
- **Changing the port list resets the install's grant to pending** — treat a
  port-list edit as a re-approval event, not a free change.

## Outbound calls and stored records

A connector is typically the only code in the system that dereferences a
user-supplied URL and turns a remote response into stored rows. Each half has one
specific failure mode.

- **Validate BEFORE the fetch, and never let a redirect escape the allowlist.**
  Parse the target and allowlist scheme + the parsed `URL.hostname` by EXACT match
  (never a suffix test) before any request leaves the process. Fetching first and
  validating the input afterwards is server-side request forgery with extra steps
  — the request has already reached the attacker's host. Redirects need the same
  guard BEFORE they are followed: take manual redirect handling and re-run the
  allowlist on each `Location`, because following is the default. Assert the final
  `response.url` as well, as the backstop that catches a hop you failed to gate —
  it detects an escape, it does not prevent one.
- **One canonical key derives the id, the dedupe comparison, AND the delete
  filter.** Choose the key once and derive all three from it. An id built from a
  URL's `pathname` sitting next to a dedupe that compares the full normalized URL
  admits two records with the same path and different query strings as distinct
  rows carrying an IDENTICAL id — and every later operation keyed on that id then
  addresses both of them. The rows look correct in the UI; only the identity is
  broken, which is why this survives review.

## Extraction from an existing connector

Splitting a capability out of a shipped connector into its own repo is a cutover,
not a copy. Two things settle in the SAME change as the split.

- **One name, one owner.** A capability id has exactly one owning package. At
  cutover, the consuming dependency edge's `versionConstraint` must EXCLUDE every
  release of the source connector that still registers the extracted capability,
  so no resolvable install can put two providers behind one id. If the range
  cannot express that exclusion yet, record the intent AND hold the cutover
  release until it can — a recorded intent is not a substitute for the constraint.
- **Declare every behavioral change to the consumer.** An extracted
  implementation that alters a fallback — an absent-`userId` path that resolved a
  shared record now resolving per-user or throwing, a default that moved, an error
  that became a silent empty — is a contract change even when the signature is
  identical. State it on the cutover: a consumer reading the extraction as
  byte-equivalent will not test the branch you changed.

## Acceptance evidence (never over-claim a live surface)

- A criterion phrased as a LIVE-surface fact ("the host renders the settings
  section", "the setup page lists the stored records") is satisfied only by the
  RUNNING host rendering it. Unit tests over the module that supplies the data
  prove the data, never the render.
- Mark such a criterion PARTIAL, name the half that is proven, and defer the live
  half to the slice that owns the surface. A box checked on unit-level proof is a
  false record — the surface stays unverified and nothing is left to catch it.

## Manifest fields (package.json#cinatra)

- Package name MUST match `@<vendor>/<slug>-connector` — any vendor scope.
- `displayName`, `serverEntry`, `requestedHostPorts`, `sdkAbiRange` (the fleet
  declares a caret major range; verify the host's current ABI in
  `packages/sdk-extensions/src/register.ts` rather than hardcoding a number),
  `vendor { key, name }` (required at marketplace submit, where uniqueness is
  enforced), `dependencies` edges (`{ packageName, kind, edgeType,
  versionConstraint, requirement }` — exact-pin the constraint for release).
- The npm `files` packlist MUST include `"cinatra"` or the scope file never ships.

## Migrations — ask, never guess

- Shape when needed: `cinatra/migrations/*.mjs` (node-pg-migrate), table prefix
  `ext_<scope>_<slug>__`, idempotent, up-only; declare `migrationsDir` in the
  manifest.
- Keep migrations ONLY if the connector genuinely needs host-run DB state. Ask
  the user; most current fleet connectors ship none.

## Archetypes and the scaffold gap

- **Study `cinatra-ai/plane-connector` and `cinatra-ai/twenty-connector`** (both
  public) as the current fleet shape — scope file, deps slot, mcp-module,
  devSetup, docs hub.
- **The CLI template lags the fleet:** `cinatra create-extension connector`
  scaffolds migrations by default and does NOT scaffold `cinatra/config.json`.
  Write the scope file yourself immediately after scaffolding, and delete the
  migrations directory unless host-run DB state is confirmed.

## Boundaries (what this skill defers)

- Companion/host integration and lock choreography → `extension-conventions`.
- Import and dependency rules (host-peer value-import bans, optional
  peer-dependency shape, allowed first-party deps) → `extension-boundary`.
- Kind routing and the overall scaffold-author-verify lifecycle →
  `extension-authoring`, driven by `/cinatra:extension-new` and
  `/cinatra:extension-verify`.

## Steps (operational)

1. Scaffold: `cinatra create-extension connector <name> --scope <vendor>`
   (fallback: `npx @cinatra-ai/cinatra@latest create-extension connector <name>`).
2. Immediately write `cinatra/config.json`: pick a lowercase token, choose
   `default` (recommendation) XOR `only` (ceiling); protected slugs `openai`,
   `anthropic`, `gemini` get `only:"admin"`. Confirm the scope intent with the
   user.
3. Decide migrations: delete the scaffolded `cinatra/migrations/` and drop
   `migrationsDir` unless host-run DB state is confirmed needed.
4. Fill the manifest: name `@<vendor>/<slug>-connector`, `displayName`,
   `serverEntry`, `sdkAbiRange`, `vendor {key,name}`, dependency edges; ensure
   the `files` packlist includes `"cinatra"`; ensure NO `cinatra.visibility`.
5. Declare the UI surface: `schema-config` + `configSchema` by default, or the
   bundled-react files + `./setup-page` / `./settings-page` exports when bespoke
   UX is required.
6. Implement `src/register.ts` registration-only with type-only SDK imports,
   the deps slot, lazy `resolveProviders`, `registerProvider`, plus optional
   `src/actions.ts`, `./mcp-module`, and `devSetup`.
7. Trim `requestedHostPorts` to least privilege; remember a port-list change
   resets the grant to pending.
8. For any outbound call: allowlist scheme + host before the fetch, gate each
   redirect `Location` before following it, and assert the final `response.url`;
   for any stored record: derive the id, the dedupe comparison, and the delete
   filter from ONE canonical key. When extracting from an existing connector,
   exclude the pre-extraction releases in the consuming version range (holding the
   cutover release if the range cannot yet express it) and declare every changed
   fallback to the cutover.
9. Verify: `node extension-kind-gate.mjs --package-root .` plus
   `npm pack --dry-run`; cross-check the result against the plane/twenty
   archetypes. Any live-surface acceptance criterion stays PARTIAL until the host
   renders it — unit proof of the data is never proof of the render.
10. Report release-readiness ONLY: a pushed tag equal to
    `v<package.json.version>` — or, on newer workflow generations, the published
    GitHub Release carrying it — IS the publish trigger (marketplace submit) —
    never push such a tag, create or publish a GitHub Release, or publish
    autonomously; the release act needs explicit owner/maintainer approval.
