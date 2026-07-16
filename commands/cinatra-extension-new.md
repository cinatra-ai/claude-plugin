---
name: cinatra-extension-new
description: "Guided scaffold of a new cinatra extension: parse the intent, refuse the scheduled-for-removal workflow kind by default, drive the extension-authoring skill to collect inputs (asking the user for anything missing) and run the cinatra create-extension CLI non-interactively, reconcile a connector scaffold with the mandatory cinatra/config.json access declaration, run the validation pair, then hand payload authoring to the kind's specialist skill — release-readiness only: no repo creation, no tag, no publish. $ARGUMENTS is the rough intent: optionally a kind (agent | connector | artifact | skill), a name, and a freeform description of what the extension should do."
argument-hint: "[kind] [name] [freeform intent — what the extension should do]"
disable-model-invocation: true
---

# /cinatra-extension-new

Scaffold a new cinatra extension from the intent in `$ARGUMENTS`. This command is a thin
orchestrator — input collection and the scaffold procedure live in the `extension-authoring`
skill; per-kind payload doctrine lives in the kind specialists. Drive it end to end:

1. Parse `$ARGUMENTS` for an explicit kind (`agent | connector | artifact | skill |
   workflow`), an explicit name, and any freeform intent. Do not guess silently — anything
   ambiguous becomes a question for the user, owned by step 3.
2. **Workflow refusal.** If the resolved kind is `workflow`, refuse by default: the workflow
   kind is scheduled for removal (converged open epic cinatra#1030 — project agents plus a
   typed project template replace BPMN workflows). Tell the user, suggest `agent` as the
   usual re-shape, and proceed with `workflow` only on an explicit user override after
   re-checking the current state of cinatra#1030.
3. Invoke the **`extension-authoring`** skill (scaffold stage) with the parsed inputs. That
   skill owns input collection — it ASKS the user for anything missing instead of silently
   defaulting:
   - kind, name, description, display name (always);
   - npm scope ONLY for `connector` (any vendor scope) and `skill` (first-party or the
     vendored allowlist) — `agent` and `artifact` are locked first-party, never ask;
   - artifact extras: whether the type should **ship its own renderer** (the opt-in
     `cinatra.artifact.ui` block, epic cinatra#1620) — default NO (declarative-only, the
     common case); if YES, which slots (`detail` and/or `preview`) and, for `preview`, the
     MIME representations it renders. A renderer is a port-less RSC component that renders
     from a host-supplied snapshot and composes VENDORED `@cinatra-ai` primitives — it adds
     a React toolchain delta and an `sdk-ui` optional peer. Also ask whether the extension
     should **contribute its own registry items** (declaring
     `cinatra.artifact.ui.registryItems`, cinatra#1623 S5) — default NO; these are
     presentational-only shadcn components published to the shared registry (a separate
     capability from a renderer, independent of it) and route payload authoring to the
     `registry-authoring` skill;
   - connector extras: the access-scope token (`user | project | team | organization |
     workspace | admin`) plus whether it is a changeable `default` or a server-enforced
     `only`; the UI surface choice (`schema-config` declared as data vs `bundled-react`
     derived from page files vs none); and stateful-vs-stateless — keep or delete the
     scaffolded `cinatra/migrations/` directory and `migrationsDir` manifest key.
4. The skill drives the scaffold non-interactively via the published `@cinatra-ai/cinatra`
   CLI (fallback: `npx @cinatra-ai/cinatra@latest create-extension …`):
   `cinatra create-extension <kind> <name> --scope <scope> --display-name "<dn>"
   --description "<desc>" --dir <parent> --yes` (add `--force` only for a deliberate
   re-scaffold into a non-empty directory). For an artifact whose author opted into a
   renderer: the opt-in ui scaffolder template (`--with-ui`) — which emits the
   `cinatra.artifact.ui` block, an RSC renderer stub per chosen slot under
   `src/renderers/`, the renderer entry in `files` (and an `exports` subpath), the React
   toolchain delta, the `sdk-ui` optional peer, and the GENERATED `sdkAbiRange` — lands
   with the first renderer wave (S4) and is first-party-locked until an external-vendor
   publishing phase exists. Until it lands, hand back to `artifact-authoring` to add the
   `ui` block and renderer by hand; do not pass a `--with-ui` flag that the installed CLI
   does not yet support. Exit code 2 means a usage or validation error (bad kind, missing
   name, slug or scope rejection) — fix the inputs and re-run; never fall back to the CLI's
   interactive prompts.
5. **Connector reconciliation — first-class, never skipped.** For kind `connector`, write
   `cinatra/config.json`: the file is MANDATORY (an absent file hard-fails at both submit
   and install, cinatra#955). It must declare `formatVersion` exactly 1 and exactly ONE of
   `access.scope.default` XOR `access.scope.only` carrying the lowercase token collected in
   step 3; unknown keys hard-fail. Ensure package.json carries NO `cinatra.visibility` key —
   for connectors its presence with any value is a validation error, even where an older
   vendored gate copy still accepts it. Validate this file explicitly before moving on.
6. Run the validation pair in the new package root: `node extension-kind-gate.mjs
   --package-root .` then `npm pack --dry-run`. Both must pass before hand-off.
7. Hand payload authoring to the kind specialist — **`connector-authoring`**,
   **`agent-authoring`**, **`artifact-authoring`**, or **`skill-extension-authoring`** —
   with the collected intent. For an artifact that contributes its own registry items,
   `artifact-authoring` routes on to **`registry-authoring`** for the
   `cinatra.artifact.ui.registryItems` payload. Conventions and lock/companion
   choreography questions defer to **`extension-conventions`**.
8. Report: the scaffolded path and package name; what was validated (the connector config
   check, the kind gate, the pack dry-run) with each result; and the explicit NOT-done
   list — no repository was created, no tag was pushed, nothing was published. A pushed
   tag equal to `v<package.json.version>` — or, on newer workflow generations, the
   published GitHub Release carrying it — IS the publish trigger (marketplace submit);
   NEVER push such a tag, create or publish a GitHub Release, or publish autonomously —
   this command
   ends at release-readiness; the release act needs explicit owner/maintainer approval.
