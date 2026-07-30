---
name: issue-authoring
user-invocable: false
description: "Create a GitHub issue — or a whole epic with its sub-issues — through one disciplined, idempotent procedure instead of a bare `gh issue create`: dedup against the repo AND the target project (open and closed) first, ground every load-bearing claim against the live default branch, converge the issue TEXT with Codex, run the write-time leak gate fail-closed to PUBLIC, create, board, and link the result, then verify each mutation actually landed. Activates for: 'file an issue', 'open an issue for this', 'create the epic and sub-issues', 'author a GitHub issue', 'board this issue', 'link the sub-issues to the epic', 'add a blocked-by dependency'. Idempotent: a re-run finds its own prior issue and UPDATES it rather than filing a second. A duplicate found at dedup time is updated, never re-filed; a premise that does not survive grounding is corrected in the body, not filed as written; the board status edit is re-verified because a project workflow can close the issue underneath you."
argument-hint: "[--epic | --sub-issue <parent> | --dry-run]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
triggers:
  - "file an issue"
  - "open an issue for this"
  - "author a github issue"
  - "create the epic and sub-issues"
  - "board this issue"
  - "link the sub-issues to the epic"
  - "add a blocked-by dependency"
antiTriggers:
  - "issue a certificate"
  - "issue a refund"
  - "npm issue tracker link"
  - "close this pull request"
---

<objective>
Turn an intent into a tracked, boarded, correctly-linked GitHub issue through one
procedure that always runs in the same order: dedup, ground, converge, leak-gate,
create, board, link, verify. Every step exists because skipping it has a specific
failure mode — a second copy of an issue that already exists, an issue born on a
stale premise, an ambiguous body nobody can implement, a private detail published
in a public repo, a created issue nobody can find on the board, or a "created"
claim for a mutation that never landed. This skill is the pack's issue-CREATION
procedure; `/cinatra:epic-plan` drives it for the epic and every sub-issue it
creates rather than reimplementing any of it inline.
</objective>

# Workflow: issue-authoring

> Composes the pack's existing doctrine rather than restating it: `grounding`
> owns premise verification (pre-create mode), `codex-pairing` owns the
> convergence mechanics and the model/effort pins, `source-leak-discipline` owns
> the leak partition. This skill owns the ORDER, the idempotency contract, and
> the GitHub mechanics (create, board, link, verify).

## The order is the contract

Run these in order, every time. A step that finds nothing still reports what it
looked at — an unrecorded check is indistinguishable from a skipped one.

1. **Dedup** — is this already tracked?
2. **Ground** — is every claim in the body still true of the live code?
3. **Converge** — does an independent reviewer agree the body is unambiguous,
   correctly scoped, and free of stale premises?
4. **Leak gate** — is every line safe for the repo's visibility?
5. **Create** — write the issue.
6. **Board** — put it on the project, in the right column.
7. **Link** — nest sub-issues under the epic and record dependency edges.
8. **Verify** — read back every mutation from the API; never trust an exit code.

Steps 1–4 are READ-ONLY against GitHub. Under a flow with an approval gate (the
epic-plan command), nothing from step 5 onward runs until that gate passes.

## 1. Dedup — search the repo AND the project, open and closed

An issue that already exists gets UPDATED (a comment, or an edited body), never
re-filed. Search both surfaces, because a tracked item can be on the board while
its text does not match your search terms:

```sh
# the repository, open AND closed
gh issue list --repo <owner>/<repo> --state all --limit 100 \
  --search "<two or three distinctive terms>" \
  --json number,title,state,url

# the project, open AND closed — see the pagination rule below
gh project item-list <project-number> --owner <owner> --limit <limit> --format json
```

Scope the dedup to the SAME tracked surface you are filing into: the same repo
and the same project. An issue of the same shape on a different project is
usually a deliberate per-project instance, not a duplicate — do not close or fold
it.

**Idempotency.** Before creating anything, look for THIS procedure's own earlier
output (same title, or the same intent recorded in a body). If you find it,
update it and say so. A re-run must never leave two issues describing one piece
of work.

**Pagination — the trap that makes dedup lie.** `gh project item-list` defaults
to a small page; a project with hundreds of items silently returns the first
handful and the dedup search "finds nothing". The payload carries `totalCount`
alongside `items`, so the read is checkable:

```sh
gh project item-list <project-number> --owner <owner> --limit 2000 --format json \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
             console.log(`read ${d.items.length} of ${d.totalCount}`);
             process.exit(d.items.length === d.totalCount ? 0 : 1)'
```

`items.length === totalCount` is the proof the read reached the end; anything
else means re-read with a higher limit. Closed/Done items are returned too, and
they matter: they are the record of decisions already made.

## 2. Ground the premise (pre-create mode)

Invoke **`grounding`** before writing the body. Every load-bearing claim ("X
still calls Y", "feature Z is missing", "the code does W") is verified against
the FETCHED default branch, not a local tree that has drifted, and a "missing
feature" claim is cross-checked against the already-merged pull requests. A wrong
premise fixed here costs a sentence; discovered mid-implementation it costs the
issue. If a premise does not survive, correct it in the body and note the
correction — do not file the intent as written.

## 3. Converge the issue TEXT with Codex

Invoke **`codex-pairing`** in issue-body mode with the FULL proposed title and
body — never a summary of it — and the exact question: is this grounded,
unambiguous, correctly scoped to the right repo, and free of stale premises or
leak-unsafe content? Consume that skill's pins (model, reasoning effort,
read-only sandbox, STDIN-only invocation, capture-not-tail); never fork them and
never invoke `codex` directly here.

Where the body makes a claim about code, run the round with its working directory
set to the checkout of the repo the claim is about, so Codex grounds the claim
itself instead of trusting your framing — the bridge that skill names takes it
directly:

```js
runCodex({ prompt, outputFile: "<capture path>", cwd: "<target repo checkout>" });
```

The capture header records the model, the effort, the sandbox and the working
directory, so the verdict is attributable to a specific tree. Adopt or rebut each
finding; fold adoptions into the body. Scope the rounds to the weight of the
issue: a one-line typo fix needs none, a feature or an epic gets one.

## 4. Leak gate — fail closed to PUBLIC

Invoke **`source-leak-discipline`** over the exact text you are about to write —
title, body, and any comment. Treat the target repo as public unless you have
positively established otherwise. In particular: no reference from a public issue
to a private one, no internal hostname, machine path, or secret name, no
planning/provenance token, and no bare version token (write "the current release"
rather than a `v`-prefixed number). Comments are scanned like diffs — nothing else
scans them.

## 5. Create

Write the body to a file and create from the file (a shell-quoted body mangles
Markdown). Capture the URL and the number it returns:

```sh
gh issue create --repo <owner>/<repo> \
  --title "<title>" --body-file <body.md> \
  [--assignee <login>] [--label <label>]
```

Body shape (the same shape the epic-plan command carries in):

- a plain-language opening paragraph — what this means for someone using the
  product, before any technical detail;
- the grounded context, with the default-branch commit it was grounded against;
- the acceptance criteria, each mechanically checkable;
- the recorded decisions that shaped it (the decision, not the open question);
- its dependency edges in prose, mirroring the links made in step 7.

## 6. Board it

Add the issue to the project, then set its fields. Field and option ids are
per-project — discover them, never hardcode:

```sh
gh project view <project-number> --owner <owner> --format json --jq .id      # project id
gh project field-list <project-number> --owner <owner> --format json         # field + option ids
gh project item-add <project-number> --owner <owner> --url <issue-url> --format json
gh project item-edit --id <item-id> --project-id <project-id> \
  --field-id <field-id> --single-select-option-id <option-id>
```

**The auto-close hazard.** A project can carry a workflow that closes an issue
when its status moves to a terminal column. So after every status edit, read the
issue back and confirm it is still OPEN:

```sh
gh issue view <number> --repo <owner>/<repo> --json state,url --jq .state
```

If it closed, reopen it and pick a non-terminal status. A newly created issue
that is closed seconds later by a board workflow is invisible to everyone.

## 7. Link — nest sub-issues, record dependencies

Nesting is the default: it gives one canonical structure and rolls progress up
onto the epic. The endpoints take the issue's DATABASE id, not its number:

```sh
# the numeric id of an issue
gh api repos/<owner>/<repo>/issues/<number> --jq .id

# nest a sub-issue under its epic
gh api --method POST repos/<owner>/<repo>/issues/<epic-number>/sub_issues \
  -F sub_issue_id=<sub-issue-database-id>

# record "this issue is blocked by that one"
gh api --method POST repos/<owner>/<repo>/issues/<number>/dependencies/blocked_by \
  -F issue_id=<blocking-issue-database-id>
```

Nesting and dependency edges are different things and both are required when the
plan declares them: nesting says "part of", a dependency says "cannot start
until". Where a host does not offer the endpoints, fall back to a textual "Part
of #N" plus a task list on the epic — and say in the body that the fallback was
used, so nobody reads the absence of nesting as an absence of structure.

## 8. Verify every mutation landed

Read the state back from the API rather than trusting an exit code:

```sh
gh issue view <number> --repo <owner>/<repo> --json state,title,url,projectItems
gh api repos/<owner>/<repo>/issues/<epic-number>/sub_issues --jq 'length'
gh api repos/<owner>/<repo>/issues/<number>/dependencies/blocked_by --jq 'length'
```

Report what exists now: each created issue with its URL, its board column, its
parent, and its dependency edges. A creation report that lists intentions rather
than verified state is not a report.

## Never

- Never file a second issue for work that is already tracked — update the
  existing one.
- Never create, board, or comment on anything while an approval gate upstream of
  this skill is still closed. Under `--dry-run`, print the exact mutations you
  WOULD run and stop.
- Never publish an issue body that has not been through the leak gate.
- Never close, reopen, or re-scope an issue this procedure did not create,
  without being asked to.
- Never claim "codex-converged" without a captured verdict answering the exact
  question asked.

## Model routing

Mechanical, well-specified steps (formatting a body from an approved plan,
running the create/board/link mutations) run on a small model at an explicit
effort; the judgment steps (dedup interpretation, grounding, body synthesis) run
on a capable one. Every dispatch names its model and its effort explicitly —
inheriting an ambient default leaves the record unattributable.
