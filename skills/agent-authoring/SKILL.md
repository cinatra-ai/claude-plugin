---
name: agent-authoring
user-invocable: false
description: "Author a cinatra agent extension correctly: the three-file package (cinatra/oas.json OpenAgentSpec Flow at agentspec_version 26.1.0, skills/<slug>/SKILL.md system prompt, package.json#cinatra manifest), first-party kind-at-end naming, the metadata.cinatra.type decision table, declarative HITL, orchestrator composition via FlowNode plus inline subflow, the 8 cross-cutting OAS rules, and the llm-bridge / object-envelope runtime contracts. Activates for: 'author a cinatra agent', 'agent extension oas.json', 'openagentspec flow', 'metadata.cinatra.type', 'startnode required or hidden', 'hitlscreens', 'requiresapproval riskclass', 'llm-bridge apinode', 'agent orchestrator subflow', 'agent artifact parity'. Every StartNode input is listed in required OR hidden (a JSON-Schema default does NOT clear the obligation); every llm-bridge ApiNode declares data.cinatra_llm or the run fails with 424; internal composition is FlowNode + inline subflow, never an A2A wrapper; every SKILL return branch emits an object envelope, never a bare array; bump BOTH oas.json packageVersion and package.json version before re-release."
argument-hint: "[path-to-agent-extension-repo]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
triggers:
  - "author a cinatra agent"
  - "agent extension oas.json"
  - "openagentspec flow"
  - "metadata.cinatra.type"
  - "startnode required or hidden"
  - "hitlscreens"
  - "requiresapproval riskclass"
  - "llm-bridge apinode"
  - "agent orchestrator subflow"
  - "agent artifact parity"
antiTriggers:
  - "claude code plugin"
  - "chat assistant skill"
  - "langchain agent"
  - "connector manifest shape"
  - "pdf"
---


<objective>
Author a cinatra AGENT extension: a three-file package — cinatra/oas.json
(an OpenAgentSpec Flow, agentspec_version 26.1.0), skills/<slug>/SKILL.md
(the agent's system prompt), and the package.json#cinatra manifest. Classify
metadata.cinatra.type, declare every human touchpoint declaratively (never in
prose), compose orchestrators with FlowNode + inline subflow, satisfy the 8
cross-cutting OAS rules and runtime contracts, validate after every change.
</objective>

# Workflow: agent-authoring

## Purpose

The AGENT kind specialist: what goes INSIDE an agent extension repo — the OAS
flow, the system-prompt SKILL.md, and the agent-specific manifest conventions.
Assumes the repo exists (scaffolded via `extension-authoring`) and repo-wide
conventions are handled elsewhere.

## Package anatomy — exactly three files carry the agent

- **`cinatra/oas.json`** — the OpenAgentSpec **Flow**: `agentspec_version:
  "26.1.0"`, `component_type: "Flow"`, `inputs[]`/`outputs[]`, `start_node`,
  `nodes`, control/data flow connections, and `$referenced_components`;
  `executionProvider` is `"wayflow"` only.
- **`skills/<slug>/SKILL.md`** — the agent's system prompt. Frontmatter is
  `name` + `description` ONLY; discovered by `agent_id`, no `match_when`.
- **`package.json`** — minimal `cinatra` block plus agent conventions:

  ```json
  "cinatra": {
    "apiVersion": "cinatra.ai/v1",
    "kind": "agent",
    "dependencies": [{
      "packageName": "@cinatra-ai/apollo-connector", "edgeType": "runtime",
      "versionConstraint": { "kind": "semver-range", "range": "^0.1.3" },
      "requirement": "required", "kind": "connector" }],
    "consumes": [{ "primitive": "apollo_people_search", "requirement": "required" }],
    "produces": [{ "extension": "@cinatra-ai/blog-idea-artifact" }],
    "agentDependencies": { "@cinatra-ai/context-selection-agent": "^0.1.0" }
  }
  ```

- **Conventions, not gate law**: the agent manifest has no key allowlist in
  the gate, so `consumes` (primitives used, with `requirement`), `produces`
  (artifact extensions emitted), and `agentDependencies` (child agent package
  to range map) are convention — carry them anyway; connector dependencies in
  `dependencies` name their `kind`.
- `files: ["cinatra", "skills"]` is the tarball allowlist. `src/` is optional
  and usually ABSENT — an agent ships no runtime code surface.

## Naming — scaffolder-enforced, not gate-enforced

- **First-party only**: `@cinatra-ai/<domain>-<capability>-agent`. Domain then
  capability, kind suffix at the END; the type-prefix form
  (`@cinatra-ai/agent-<x>`) is wrong.
- **Reserved workspace slugs exist** — the scaffolder validates against the
  reserved list (`packages/agents/src/reserved-workspace-slugs.ts` in
  `cinatra-ai/cinatra`). Check before committing to a name.
- **Topology tokens are rejected in the base name**: `pipeline`,
  `orchestrator`, `handler`, `child`, `stage-N` — name the capability, not
  the internal shape.
- The local kind gate has NO agent name check — the scaffolder and the
  marketplace naming gate own naming; a green gate does not prove the name.

## metadata.cinatra.type — the decision table

| type | choose when |
| --- | --- |
| `node` | a single reusable step, no flow of its own |
| `flow` | a runnable flow; ANY mid-run HITL gate forces `flow` |
| `leaf` | a terminal agent; leaves NEVER carry `dependencies` or `agentDependencies` |
| `orchestrator` | composes multiple sub-agents; MUST carry the `agentDependencies` map |

- Mid-run human approval anywhere in the graph means `flow` at minimum;
  multiple sub-agents means `orchestrator` plus one `agentDependencies` entry
  per child.

## Declarative HITL — never prose

- **Every StartNode input is listed in `metadata.cinatra.required` OR
  `hidden`.** No third state. An omitted input is silently dropped or stalls
  the setup loop. A JSON-Schema `default` does NOT clear the obligation.
- **Mid-run gates are AgentNode metadata**: `requiresApproval: true` +
  `riskClass` + a `renderer` id. `riskClass` is an OPEN string classifier —
  core validates it as a string, not a closed enum; follow the fleet's
  conventional values (`read_only`, `write_safe`, `write`, `approval`, or a
  domain-specific class) and keep it honest about the side effect it gates.
- **Every renderer id appears in the flow-level
  `metadata.cinatra.hitlScreens`** — a flat renderer-id array, nothing nested.
- Prose like "ask the user before deleting" in the system prompt is NOT a
  gate. A human touchpoint is declared in the OAS or it does not exist.

## Orchestrator composition — FlowNode + inline subflow

- Compose sub-agents with a **FlowNode carrying an inline subflow Flow** —
  NEVER an A2A wrapper for internal composition (the runtime rejects typed
  outputs on A2A-wrapped AgentNodes).
- A FlowNode's `flow` component ref resolves to a **Flow**, never an Agent.
- The FlowNode's `metadata.cinatra.packageName` matches the child agent's
  package name EXACTLY, and the child appears in `agentDependencies`.

## The 8 cross-cutting OAS rules

1. Exactly one StartNode and one EndNode per flow.
2. Every component ref resolves to a component actually present in the spec.
3. `AgentNode.agent` points at an Agent component (and `FlowNode.flow` at a
   Flow).
4. Data-flow port titles match EXACTLY on both ends of every data-flow edge.
5. A2A-start-optional flow inputs carry an empty-string `default: ""`.
6. `metadata.cinatra.hitlScreens` is a flat renderer-id array.
7. No legacy global refs (e.g. `shared-llm-config`).
8. An InputMessageNode has exactly one output, of type string.

## Runtime contracts — the failures happen at run time, not validate time

- **Every llm-bridge ApiNode declares `data.cinatra_llm`.** An ApiNode posting
  to `{{CINATRA_BASE_URL}}/api/llm-bridge` without it fails the run with a 424.
- **Deterministic parse-and-dispatch steps go on the passthrough endpoint**
  (`/api/agents/passthrough`), not the llm-bridge — no model call for pure
  data plumbing.
- **Every SKILL return branch emits an OBJECT ENVELOPE** — `{"<field>":
  [...]}` — never a bare array. The runtime indexes results by field name; a
  bare array crashes downstream with a cannot-index-array error. Audit EVERY
  branch of the output contract, including error branches.

## Design for unattended dispatch

- Structured (object/array) REQUIRED StartNode inputs BLOCK unattended
  dispatch — give them defaults, or mark them `hidden` and derive in-flow.
- Avoid JSON-Schema `format` on string StartNode inputs — structured-output
  extraction on some providers rejects unknown formats.

## Artifact parity — produces means a binding

- An agent declaring `cinatra.produces` MUST ship the matching EndNode
  artifact binding (`outputs[].cinatra.artifact`) or an `artifact_materialize`
  passthrough node.
- The newest vendored gate enforces this as a RATCHET (warn by default,
  blocking under enforcement) — treat the warning as a defect.

## Versioning and release-readiness

- Before any re-release, bump BOTH the `packageVersion` in `cinatra/oas.json`
  AND the `version` in `package.json` — publish refuses a same-version
  overwrite; a half-bumped pair ships a mismatched spec.
- SKILL.md-only wording fixes mount live WITHOUT a bump; OAS or manifest
  changes always need the dual bump plus a release.
- A pushed tag equal to `v<package.json.version>` — or, on newer workflow
  generations, the published GitHub Release carrying it — IS the publish
  trigger (marketplace submit). NEVER push such a tag, create or publish a
  GitHub Release, or publish autonomously — report release-readiness only; the
  release act needs explicit owner/maintainer approval.

## Validate after every change

- Run `node extension-kind-gate.mjs --package-root .` in the repo root. For
  agents it parses `cinatra/oas.json` (if present) and scans LLM-visible
  strings (`system`, `user`, `description` keys anywhere in the tree) for
  retired CRM primitives and legacy typeHints — a hit is a hard fail.
- Then `npm pack --dry-run`: tarball = `cinatra/` + `skills/`, nothing stray.
- Vendored gate copies drift; on any conflict, current `cinatra-ai/cinatra` +
  `cinatra-ai/cinatra-cli` origin/main win over the local copy.

## Boundaries (what this skill defers)

- Scaffold, authoring lifecycle, submit/review mechanics —
  `extension-authoring` (agents are locked first-party at scaffold time).
- Public/private boundary rules for package content — `extension-boundary`.
- Repo-wide conventions (README contract, dependency shape, lock/companion
  choreography) — `extension-conventions`.
- Connector internals an agent depends on — `connector-authoring`.

## Steps (operational)

1. Scaffold via `extension-authoring` if the repo does not exist; verify the
   name passes the scaffolder's reserved-slug and topology-token validation.
2. Fill `package.json#cinatra`: minimal block, connector `dependencies` edges
   with `kind`, `consumes`/`produces`/`agentDependencies` as they apply;
   `files: ["cinatra", "skills"]`.
3. Classify the agent with the `metadata.cinatra.type` decision table; an
   orchestrator gets `agentDependencies`, a leaf gets neither dependencies key.
4. Write `cinatra/oas.json`: every StartNode input in `required` or `hidden`;
   mid-run gates via `requiresApproval` + `riskClass` + `renderer`, every
   renderer in `hitlScreens`; children via FlowNode + inline subflow; all 8
   cross-cutting rules; `data.cinatra_llm` on every llm-bridge ApiNode;
   deterministic steps on the passthrough endpoint.
5. Write `skills/<slug>/SKILL.md` (frontmatter `name` + `description` only)
   with an object-envelope output contract on EVERY return branch.
6. If `produces` is declared, bind the artifact on the EndNode (or add a
   materialize passthrough node).
7. Run `node extension-kind-gate.mjs --package-root .` plus
   `npm pack --dry-run`; never advance on a red gate.
8. Before re-release: dual version bump (oas.json `packageVersion` +
   package.json `version`), re-validate, then report release-readiness — the
   release act that publishes (the version tag push or the published GitHub
   Release) requires explicit approval.
