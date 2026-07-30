---
name: epic-plan
description: "Plan a new epic against a real codebase and a real project board, then — only after explicit approval — create it. Researches the target repository's live default branch and reads the target project's items in full (open AND closed, closed ones treated as the record of decisions already made), synthesises an epic plus a sub-issue breakdown with explicit dependency edges, runs a mandatory Codex convergence round whose working directory IS the target repository (so it checks the plan against the code, not against the prompt), refuses to present a plan that fails the structural gate, presents it and STOPS. No epic, issue, board entry or comment is created before approval; the approval binds to the exact plan revision, so any later edit invalidates it. After approval the epic and every sub-issue are created through the issue-authoring skill and linked with their dependency relationships preserved. $ARGUMENTS is the target project AND the target repository, plus an optional --dry-run."
argument-hint: "<project: <owner>/<number> or project URL> <repo: <owner>/<repo> or --here> [freeform intent] [--dry-run]"
disable-model-invocation: true
---

# /cinatra:epic-plan

Plan an epic for the project and repository named in `$ARGUMENTS`, present it for
approval, and create it only once approved. This command is an orchestrator — the
procedures live in the skills it drives (`grounding`, `codex-pairing`,
`source-leak-discipline`, `issue-authoring`) and the structural rules live in the
gate it shells out to (`scripts/check-epic-plan.mjs`). Run every phase in order;
never skip a phase because it "looks fine".

## 0. Resolve the arguments — both are required

1. Parse `$ARGUMENTS` for **the target project** (`<owner>/<number>`, a bare
   number plus an owner, or a project URL) and **the target repository**
   (`<owner>/<repo>`, or `--here` to contract explicitly on the current
   checkout), plus any freeform intent and the optional `--dry-run`.
2. A project identifier alone CANNOT establish which codebase the epic concerns,
   and the research phase and the Codex round both need a checkout. If the
   repository argument is missing, ASK — do not infer it from the project's
   title, its items, or the directory you happen to be in.
3. Resolve the repository to a real checkout of its live default branch (clone or
   fetch — never plan against a tree that has drifted). Record the commit you
   grounded on; it goes in the plan and in every created issue body.
4. Under `--dry-run`, everything through the approval gate runs normally and the
   creation phase prints the exact mutations it WOULD run instead of running
   them. A dry run makes zero GitHub writes.

## 1. Research phase (read-only)

1. Invoke the **`grounding`** skill for the codebase read: fetch origin, read the
   fetched default branch, and verify every claim the intent rests on before it
   becomes a plan. A claim read off a stale local tree is history, not state.
2. Read the target project's items **in full — open AND closed**. Closed items
   are the decisions record: they say what has already been settled and must not
   be silently re-decided. The read is only sound if it reached the end of the
   project, so record the numbers:

   ```sh
   gh project item-list <number> --owner <owner> --limit <limit> --format json
   ```

   The payload carries `totalCount` next to `items`; `items.length` must equal
   it. The default page size is small, so a large project silently returns a
   fraction and every "nothing conflicts" conclusion drawn from it is false. Use
   a limit strictly greater than `totalCount` and re-read if the two disagree.
3. Delegate the heavy reads as research lanes (see the routing table). Each lane
   returns findings and the paths/items it actually read — a finding without its
   source cannot be checked.
4. Nothing in this phase writes to GitHub. No comment, no draft item, no label.

## 2. Plan synthesis — structure is enforced, not encouraged

1. Start from the gate's own skeleton so the required structure is present by
   construction, and keep the plan in a scratch location outside the repository's
   tracked tree:

   ```sh
   node "$CLAUDE_PLUGIN_ROOT/scripts/check-epic-plan.mjs" --template > <scratch>/epic-plan.md
   ```

2. Fill it in. The gate enforces all of the following, so write for it:
   - **Every section opens with a plain-language paragraph** written from the
     user's perspective — what this means for someone using the product, prose
     before any bullet or table, no jargon. Sub-issue entries too: that intro is
     what carries into the created issue body.
   - **The breakdown** is one `### <slug>: <title>` per sub-issue, each declaring
     `**Depends on:**` (a list of sibling slugs, or `none`), and a
     `## Dependency edges` section listing exactly the same edges. The graph must
     be acyclic.
   - **Every owner question** carries four parts: what is being decided, why a
     user cares, the impact of each option, and — once answered — the recorded
     decision. `PENDING` is allowed while it is unanswered.
   - **`## Conflicts` is always present.** Where a planned sub-issue overlaps
     existing project scope or contradicts a decision already made, state the
     conflict explicitly for the owner to rule on — never resolve it silently.
     With none to report it reads `None found` plus the number of project items
     examined, which must match the ledger.
   - **`## Backward compatibility` and `## Migration path` are always present.**
     "No migration required" is valid only with an explicit `Rationale:`.
   - **`## Project items examined`** records the project, the total, the number
     read, the fetch limit used, that open AND closed items were included, and
     that closed items were read as decisions.
   - **`## Routing trace`** names the model and effort of every dispatch.
3. Stamp the plan so an approval can bind to this exact revision:

   ```sh
   node "$CLAUDE_PLUGIN_ROOT/scripts/check-epic-plan.mjs" --stamp <scratch>/epic-plan.md
   ```

   Re-stamp after every edit. The digest covers every byte of the plan except
   the `- Plan revision:` and `- Status:` lines it necessarily rewrites, so any
   other change — anywhere, including inside the approval section — moves it.

## 3. Codex convergence with code access — mandatory, never skipped

1. Invoke the **`codex-pairing`** skill. Consume its pins (model, maximum
   reasoning effort, read-only sandbox, STDIN-only invocation, capture-not-tail);
   never fork them and never call `codex` directly.
2. One deliberate extension: run the round with its **working directory set to
   the target repository checkout**, so Codex greps the code and forms its own
   ground truth rather than critiquing the prompt. The bridge takes it directly
   and records it:

   ```js
   runCodex({ prompt, outputFile: "<scratch>/verdict.txt", cwd: "<target repo checkout>" });
   ```

   The capture header then carries `sandbox=read-only` and `cwd=<checkout>` — the
   provenance the gate checks.
3. Ask for a verdict in two named sections:
   - **"Independent code evidence"** — repo-relative paths and symbols Codex
     found ITSELF. Evidence quoted back from the prompt does not count, and the
     gate rejects a verdict whose evidence section cites no path.
   - **"Contradicted claims"** — every claim in the plan the code refutes, or
     `None.` when the code confirmed them all. This is the point of giving the
     round code access: a plan can assert something about the repository that is
     simply not true, and the round is what catches it. The gate REFUSES a plan
     whose verdict lists a contradiction, so a false claim is corrected on
     Codex's own evidence and reconverged — never presented as written.
4. Fold in adoptions, rebut the rest honestly, re-stamp, and re-run the round if
   the plan changed materially (at most three rounds). Record the working
   directory, sandbox, model, effort, round count and capture path in
   `## Convergence record`.

## 4. Approval gate — present, then STOP

1. Run the gate at the present stage, with the capture:

   ```sh
   node "$CLAUDE_PLUGIN_ROOT/scripts/check-epic-plan.mjs" \
     --plan <scratch>/epic-plan.md --verdict <scratch>/verdict.txt --stage present
   ```

   A non-zero exit means the plan is **refused**: fix the findings and re-stamp.
   Do NOT present a plan that fails this gate — presenting an incomplete plan is
   how a missing conflicts section becomes an approved conflicts section.
2. Present the plan and stop. Say plainly what is being asked for, list any
   `PENDING` owner questions and any unresolved conflict rulings, and state that
   nothing has been created.
3. **Unresolved conflicts block approval.** They require an owner ruling and a
   reconvergence round (step 3 again) before the plan can be approved — a ruling
   is not a rubber stamp on the plan that raised it.
4. On approval, record it in `## Approval` with the digest it approved:

   ```text
   - Status: APPROVED (revision sha256:<digest>, approved by <who>, <date>)
   ```

   Any later edit moves the digest and the approval goes stale — the gate says
   so, and the fix is a fresh convergence round plus fresh approval, never a
   re-stamp. `## Approval` stays the LAST section and carries only its intro
   paragraph and `- field: value` lines: it is the one part of the plan its own
   digest cannot cover, so nothing else is allowed to live there or after it.

## 5. Creation phase — only after approval

1. Re-run the gate at the create stage. A non-zero exit means no write happens:

   ```sh
   node "$CLAUDE_PLUGIN_ROOT/scripts/check-epic-plan.mjs" \
     --plan <scratch>/epic-plan.md --stage create
   ```

   It refuses an unapproved or stale-approved plan, any `PENDING` conflict
   ruling, any `PENDING` owner decision, and an approval section that does not
   record `Pre-approval writes: none`.
2. Create the epic, then each sub-issue, through the **`issue-authoring`** skill —
   per-issue dedup, grounding, Codex convergence, the leak gate, creation, and
   boarding. Do not reimplement any of that here.
3. Carry the plan's content into the bodies: the plain-language section intros,
   the owner-question explanations, and the **recorded decisions** (never the
   text of an unresolved question). They are part of the deliverable, not
   scaffolding for the plan document.
4. Link the structure, do not merely create it: nest every sub-issue under the
   epic and record each `## Dependency edges` edge as a blocked-by relationship
   (both endpoints take the issue's database id, not its number). Where the host
   lacks those endpoints, use the documented textual fallback and say so in the
   bodies.
5. Board every created issue on the target project and re-read each issue
   afterwards — a project workflow can close an issue when its status moves to a
   terminal column.
6. Report what exists now: each issue with its URL, its board column, its parent,
   and its dependency edges, read back from the API; the plan revision that was
   approved; and the explicit NOT-done list. This command creates issues; it does
   not implement them, does not open pull requests, and never releases anything.

## Model routing (explicit on every dispatch)

| Task | Model / effort |
|---|---|
| Top-level orchestration, plan assembly, revision incorporation | Fable, effort max |
| Delegated codebase / project research lanes | Opus, explicit effort per dispatch |
| Mechanical formatting and the approved GitHub mutations | Sonnet, explicit effort per dispatch |
| Independent convergence | `codex-pairing` (model and effort as that skill pins them) |

Every dispatch names its model and effort explicitly — the initial run and each
revision round produce a routing trace the gate checks, and the `(top-level)`
entry must be the orchestration pin. A dispatch that inherits an ambient default
leaves the record unattributable.

## Never

- Never present a plan the gate refuses, and never create anything the gate
  refuses at the create stage.
- Never write to GitHub before approval — the research and convergence phases are
  read-only, and `--dry-run` proves it by printing the mutations instead.
- Never silently resolve a conflict with existing project scope or with a
  decision already made; state it and let the owner rule.
- Never carry an approval across an edit.
- Never plan against a stale tree, and never let Codex converge against one.
