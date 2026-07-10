---
name: skill-extension-authoring
user-invocable: false
description: "Author a cinatra SKILL extension — a product skill bundle that ships SKILL.md content into the cinatra app for its agents to load (NOT a Claude Code plugin skill): the skills/<name>/SKILL.md payload with one directory per capability, the cinatra.capabilities map binding stable capability keys to co-located skill dirs, optional metadata.match_when agent binding, and the @<scope>/<slug>-skills naming policy. Activates for: 'author a skill extension', 'cinatra skill bundle', 'product skill bundle', 'cinatra.capabilities map', 'match_when agent binding', 'skills bundle naming', 'vendored skill bundle'. Payload is content-only (the files list ships only skills/, no src/); inner slugs are verb-noun; capabilities is enforced host-side at install, NOT by the local vendored gate — treat it as mandatory anyway; scope is first-party or the vendored allowlist, and a vendored bundle declares cinatra.vendoredFrom and keeps its upstream name."
argument-hint: "[<bundle-slug> | capabilities | match_when | naming]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
triggers:
  - "author a skill extension"
  - "cinatra skill bundle"
  - "product skill bundle"
  - "cinatra.capabilities map"
  - "match_when agent binding"
  - "skills bundle naming"
  - "vendored skill bundle"
antiTriggers:
  - "claude code plugin"
  - "claude code slash command"
  - "plugin skill for claude code"
  - "court"
  - "pdf"
---


<objective>
Author a cinatra SKILL extension: a versioned bundle of skills/<name>/SKILL.md
prompt content the cinatra PRODUCT installs and its agents load at runtime —
one directory per capability, bound by the cinatra.capabilities map, optionally
scoped to specific agents via metadata.match_when. This is a product extension
kind, not a Claude Code plugin skill; the payload is content-only (no src/),
named @<scope>/<slug>-skills, validated by the vendored gate plus the host-side
install check that the local gate does not replicate.
</objective>

# Workflow: skill-extension-authoring

> Kind specialist for the skill extension kind. `extension-authoring` routes
> here; lifecycle, boundary, and convention rules stay with their own skills.

## Purpose

Everything skill-kind-specific: the bundle shape, the capabilities contract, the
payload SKILL.md frontmatter contract, the naming/scope policy, and the honest
split between what the local vendored gate checks and what only the host
enforces. Local validation is `node extension-kind-gate.mjs --package-root .`
plus `npm pack --dry-run`.

## Not a Claude Code plugin skill

- **Two different "skills" — do not conflate them.** A cinatra skill extension is
  a PRODUCT extension: an npm package the marketplace distributes and a cinatra
  app instance installs, whose SKILL.md files become prompt capabilities for the
  app's agents. A Claude Code plugin skill is a dev-tool concern with a
  different frontmatter contract and a different loader. This skill covers only
  the former; if the request is about a Claude Code plugin, stop — wrong skill.
- **Package vs installed row.** The bundle is the shippable TYPE; a personal or
  installed skill row inside one workspace is an instance. Never model one
  user's private prompt as a package.

## Bundle shape

- **Payload**: `skills/<name>/SKILL.md`, **one directory per capability**. No
  `src/`, no sidecars, no runtime code — this kind is content-only.
- **Tarball allowlist**: `files: ["skills"]` in package.json (README, LICENSE,
  package.json ride along automatically; the gate and CI configs must not).
- **Inner slugs are verb-noun**: `generate-blog-ideas`, `review-outline` — the
  directory name states what invoking the capability does.
- **Study the public exemplars** `blog-skills` and `skill-creator-skills` before
  authoring a new bundle; both carry the full shape below.

## Manifest and the capabilities contract

- `package.json#cinatra`: `apiVersion` exactly `"cinatra.ai/v1"`,
  `kind: "skill"`, and `dependencies` as a **required array** (`[]` when none —
  never omitted, never `null`).
- **`cinatra.capabilities`** — a map `{"domain.action": "<skill-dir>"}` binding a
  **stable capability key** to a co-located `skills/<dir>` directory, e.g.
  `{"blog.generate-ideas": "generate-blog-ideas"}`.
  - Every value MUST name an existing `skills/<dir>` with a SKILL.md; every
    shipped skill dir should be reachable from some key.
  - Capability keys are consumed by the host as stable identifiers — renaming
    one is a breaking change, so choose `domain.action` keys deliberately.
  - **Enforcement is host-side at install time, NOT in the local vendored
    gate** — the gate checks only the kind and the name suffix, so a bundle
    missing `capabilities` still passes locally and then fails (or installs as
    an inert bundle) on the real surface. Treat the map as mandatory anyway.
- The skill kind has no strict manifest-key allowlist (unlike artifact and
  workflow), but keep the block to the fields above — unknown keys are drift,
  not features.

## Payload SKILL.md contract

- Frontmatter **`name` is required** for every payload SKILL.md; the host
  rejects a capability whose skill lacks it.
- **`description` leads with trigger conditions** — the first clause states WHEN
  an agent should load the skill, not what the document contains.
- **`metadata.match_when`** (optional) — a list of matchers such as
  `[{agent_id: "@cinatra-ai/wordpress-agent"}]` binding the skill to specific
  agents by package name. **Omit it and the skill is generally available** to
  any agent on the instance; include it to scope narrowly. Prefer omission
  unless the content is only correct in one agent's hands.
- One SKILL.md per capability — never fold two capabilities into one file with
  branching prose; split the directory instead.

## Naming, scope, and license

- **Name**: `@<scope>/<slug>-skills` — the plural `-skills` suffix is enforced
  by the gate's name check; the singular `-skill` form is a validation error.
- **Scope policy**: first-party (`@cinatra-ai`) or the vendored allowlist
  carried by the scaffolder (`cinatra-ai/cinatra-cli` authoring tables). A
  **vendored bundle declares `cinatra.vendoredFrom`** and keeps its upstream
  package name — that declaration is what exempts it from the `-skills` name
  rule and the first-party license rule.
- **License**: exactly `Apache-2.0` for a non-vendored `@cinatra-ai/*` bundle;
  a vendored bundle keeps its upstream SPDX license string.

## Validation (and its honest limits)

- Run `node extension-kind-gate.mjs --package-root .` — for this kind it
  verifies the kind, the `-skills` name (or `vendoredFrom`), and all common
  rules (manifest shape, README contract, license policy). It does **not**
  validate `capabilities`, `match_when`, or payload frontmatter.
- Run `npm pack --dry-run` and confirm the tarball ships `skills/` plus
  README/LICENSE/package.json and nothing else.
- Close the gap the gate leaves by hand: every `capabilities` value resolves to
  a dir, every payload SKILL.md has `name` + trigger-led `description`, every
  `match_when` agent_id is a real agent package name.

## Boundaries (what this skill defers)

- Lifecycle — scaffold, validate loop, PR, CI, release-readiness — belongs to
  `extension-authoring`; repo conventions and lock/companion choreography to
  `extension-conventions`; code-boundary rules to `extension-boundary` (largely
  moot for a content-only payload, but the common gate rules still run).
- Release doctrine (restated because authors hit it): a pushed tag equal to
  `v<package.json.version>` — or, on newer workflow generations, the published
  GitHub Release carrying it — IS the publish trigger (marketplace submit);
  NEVER push such a tag, create or publish a GitHub Release, or publish
  autonomously — release-readiness reporting only; the release act needs
  explicit owner/maintainer approval.

## Steps (operational)

1. Confirm the target is a cinatra PRODUCT skill bundle, not a Claude Code
   plugin skill; stop and reroute if it is the latter.
2. Scaffold: `cinatra create-extension skill <name> --scope <scope> --yes`
   (fallback `npx @cinatra-ai/cinatra@latest create-extension skill <name>
   --scope <scope> --yes`); scope is first-party or the vendored allowlist —
   this kind and connector are the only two with a scope choice.
3. Name the bundle `@<scope>/<slug>-skills`; for a vendored import, declare
   `cinatra.vendoredFrom` and keep the upstream name and license.
4. Lay out `skills/<verb-noun>/SKILL.md`, one directory per capability, and
   bind each in `cinatra.capabilities` as `{"domain.action": "<skill-dir>"}`.
5. Write each payload frontmatter: required `name`, trigger-led `description`,
   and `metadata.match_when` only when the skill must bind to specific agents.
6. Validate: `node extension-kind-gate.mjs --package-root .` then
   `npm pack --dry-run`; then hand-check the capabilities map, frontmatter, and
   match_when targets the gate does not cover.
7. Hand back to `extension-authoring` for the rest of the lifecycle.
