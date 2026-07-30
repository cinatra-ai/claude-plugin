// tests/epic-plan.test.mjs — the plan contract behind `/cinatra:epic-plan`.
//
// The command promises a plan whose structure is MECHANICALLY checkable and an
// approval that cannot survive an edit. This suite fixture-proves the gate that
// backs those promises (scripts/check-epic-plan.mjs), both through its module
// API and through the CLI the command actually shells out to — exit codes
// included, because the command branches on them.
//
// Covered, one fixture per promise:
//   1. a plan missing a required section is REFUSED (never presented);
//   2. the no-conflict case renders "None found" AND the count of project items
//      examined, and a count that contradicts the ledger is refused;
//   3. a project fixture with an overlapping item yields an explicit conflicts
//      entry that is shown at the present stage and BLOCKS the create stage
//      until the owner rules on it;
//   4. a project read that stopped at the first page (or used a limit that
//      cannot prove it reached the end) is refused — the past-100-items case;
//   5. Codex code-access provenance: the captured verdict must carry the
//      bridge header with the read-only sandbox and the working directory the
//      plan declares, plus an "Independent code evidence" section citing paths
//      Codex found itself;
//   6. a plan carrying a claim the repository refutes is REFUSED on Codex's own
//      evidence, and passes only once corrected and reconverged;
//   7. approval binding: an edit after approval invalidates it, the create
//      stage refuses everything that is not an approved, fully-ruled plan, and
//      no GitHub mutation appears anywhere before the approval gate;
//   8. routing: every dispatch names a model and an effort, and the top-level
//      dispatch is on its pin.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkPlan, template, filledTemplate, planRevision } from "../scripts/check-epic-plan.mjs";

const GATE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "check-epic-plan.mjs");

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "epic-plan-test-"));
  process.on("exit", () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ } });
  return dir;
}

/** Write a plan and stamp it through the real CLI, returning { file, text }. */
function stampedPlan(dir, text, name = "plan.md") {
  const file = path.join(dir, name);
  fs.writeFileSync(file, text);
  const r = spawnSync(process.execPath, [GATE, "--stamp", file], { encoding: "utf8" });
  assert.equal(r.status, 0, `--stamp failed: ${r.stderr}`);
  return { file, text: fs.readFileSync(file, "utf8") };
}

const gate = (args) => spawnSync(process.execPath, [GATE, ...args], { encoding: "utf8" });

/** Replace and PROVE the replacement happened (a no-op fixture edit tests nothing). */
function mut(text, from, to) {
  const out = text.replace(from, to);
  assert.notEqual(out, text, `fixture mutation ${String(from).slice(0, 60)} matched nothing`);
  return out;
}

const approve = (text) =>
  mut(text, "- Status: PENDING", `- Status: APPROVED (revision sha256:${planRevision(text)}, approved by owner, 2026-01-01)`);

const findings = (text, opts) => checkPlan(text, opts).errors;
const reports = (text, needle, opts) => findings(text, opts).some((e) => e.includes(needle));

// --- 1. a plan missing a required section is refused --------------------------

test("every required section is enforced individually — a plan missing one is refused, not presented", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  assert.deepEqual(findings(base), [], "the filled skeleton is conforming");
  for (const [section, replacement] of [
    ["## Conflicts", "## Overlaps"],
    ["## Backward compatibility", "## Compatibility notes"],
    ["## Migration path", "## Moving over"],
    ["## Owner questions", "## Questions"],
    ["## Dependency edges", "## Order"],
    ["## Project items examined", "## Project read"],
    ["## Routing trace", "## Models"],
    ["## Convergence record", "## Review"],
  ]) {
    const broken = mut(base, section, replacement);
    assert.ok(
      reports(broken, `missing required section \`${section}\``),
      `renaming ${section} must be refused`,
    );
  }
});

test("the CLI refuses a structurally incomplete plan with exit 1 and prints the findings", () => {
  const dir = scratch();
  const { file } = stampedPlan(dir, mut(filledTemplate(), "## Conflicts", "## Overlaps"));
  const r = gate(["--plan", file]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /epic-plan gate REFUSED at stage 'present'/);
  assert.match(r.stderr, /missing required section `## Conflicts`/);
});

test("a code SAMPLE is never read as structure, whichever fence markers it nests", () => {
  // A plan legitimately quotes commands and Markdown. A fenced sample that
  // quotes a DIFFERENT fence marker (or a shorter one) must not end the block:
  // if it did, the \`##\` and \`-\` lines inside the sample would count as a
  // section and a bullet, and the gate would refuse a conforming plan.
  const sample = "```text\n~~~\n## Not a real section\n- not a real dependency edge\n~~~\n```\n\n";
  const { text } = stampedPlan(scratch(), mut(filledTemplate(), "### first-slug:", `${sample}### first-slug:`));
  assert.deepEqual(findings(text), [], "the sample must be inert");

  // ... and the real structure after the sample is still parsed: break a
  // section that FOLLOWS the sample and the gate must still see it.
  const broken = mut(text, "## Conflicts", "## Something else");
  assert.ok(reports(broken, "missing required section `## Conflicts`"), "parsing must resume after the fence closes");
});

test("a section that opens with bullets instead of a plain-language paragraph is refused", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  const listFirst = mut(
    base,
    /## Epic summary\n\nIn plain terms[\s\S]*?\n\n- Target repository/,
    "## Epic summary\n\n- Target repository",
  );
  assert.ok(reports(listFirst, "`## Epic summary` does not open with a plain-language paragraph"));
});

test("a sub-issue that opens with a bold label is refused — that intro carries into the created issue body", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  const labelFirst = mut(
    base,
    /### first-slug: <sub-issue title>\n\nIn plain terms[\s\S]*?<what it does not do>\./,
    "### first-slug: <sub-issue title>\n\n**Scope:** build it.",
  );
  assert.ok(reports(labelFirst, "does not open with a plain-language paragraph"));
});

// --- 2 + 3. conflicts ---------------------------------------------------------

test("the no-conflict case renders `None found` with the count of items examined, matching the ledger", () => {
  const base = stampedPlan(scratch(), filledTemplate({ total: 643, limit: 1000 })).text;
  assert.match(base, /None found\. Items examined: 643/);
  assert.deepEqual(findings(base), []);
  assert.ok(reports(mut(base, /None found\. Items examined: \d+[^\n]*/, "None found."), "without recording how many project items were examined"));
  assert.ok(reports(mut(base, /Items examined: \d+/, "Items examined: 4"), "does not match the read"));
});

test("a project fixture with an overlapping item yields an explicit conflict that blocks approval until ruled on", () => {
  const dir = scratch();
  // The fixture project already carries an item covering the same surface, and
  // a closed item that decided the opposite of what the plan proposes.
  const withConflicts = mut(
    filledTemplate(),
    /None found\. Items examined: \d+[^\n]*\n/,
    `### The second piece overlaps an item already on the project

In plain terms, part of this epic covers ground the project already started
elsewhere, so two people could end up building the same thing twice.

- **Overlaps:** an open project item covering the same surface
- **Ruling:** PENDING

### The breakdown reopens a decision the project already closed

In plain terms, this plan proposes something a closed item already decided
against, so shipping it as written would quietly reverse that call.

- **Overlaps:** a closed item recording the opposite decision
- **Ruling:** PENDING
`,
  );
  const { file, text } = stampedPlan(dir, withConflicts);

  // Presented, not hidden: the present stage passes so the owner SEES them.
  assert.deepEqual(findings(text), [], "unresolved conflicts must still be presentable");
  assert.equal(gate(["--plan", file]).status, 0);

  // Approved with the rulings still open: the create stage refuses.
  const approved = stampedPlan(dir, approve(text), "approved.md");
  const r = gate(["--plan", approved.file, "--stage", "create"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /2 conflict ruling\(s\) still PENDING/);

  // Ruled on by the owner, re-stamped and re-approved: the create stage opens.
  const ruled = stampedPlan(
    dir,
    approve(
      stampedPlan(
        dir,
        text.replaceAll("- **Ruling:** PENDING", "- **Ruling:** the owner ruled: fold the overlap into the existing item and drop it from this epic."),
        "ruled-unstamped.md",
      ).text,
    ),
    "ruled.md",
  );
  assert.equal(gate(["--plan", ruled.file, "--stage", "create"]).status, 0);
});

test("a conflict entry with no ruling line at all is refused — conflicts are never silently resolved", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  const noRuling = mut(
    base,
    /None found\. Items examined: \d+[^\n]*\n/,
    `### Overlaps an existing item

In plain terms, this piece covers ground the project already started, which is
something the owner needs to decide about rather than the plan choosing quietly.

- **Overlaps:** an open project item covering the same surface
`,
  );
  assert.ok(reports(noRuling, "has no `**Ruling:**` line"));
});

// --- 4. the project read must paginate past the first page --------------------

test("a project read that stopped at the first page is refused (the past-100-items case)", () => {
  const truncated = mut(
    mut(filledTemplate({ total: 643, limit: 1000 }), "- Items read: 643", "- Items read: 100"),
    "- Fetch limit used: 1000",
    "- Fetch limit used: 100",
  );
  const { text } = stampedPlan(scratch(), truncated);
  assert.ok(reports(text, "the project read is TRUNCATED: 100 of 643 items were read"));
});

test("a fetch limit equal to the item count cannot prove the read reached the end", () => {
  const { text } = stampedPlan(scratch(), filledTemplate({ total: 120, limit: 120 }));
  assert.ok(reports(text, "cannot prove the read reached the end of the project"));
});

test("a read confined to open items is refused — closed items are the decisions record", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  assert.ok(reports(mut(base, "- States included: open + closed", "- States included: open"), "must cover open AND closed items"));
  assert.ok(reports(mut(base, "- Closed items read as decisions: yes", "- Closed items read as decisions: no"), "must be `yes`"));
});

// --- 5. Codex code-access provenance -----------------------------------------

const VERDICT = `[codex-bridge] codex exec model=<pinned> model_reasoning_effort=max sandbox=read-only cwd=/checkout/target-repo

## Independent code evidence

Grepping the checkout myself: bin/lib/codex-bridge.cjs pins the read-only sandbox
and records the working directory, and scripts/check-epic-plan.mjs computes the
approval digest over everything above the Approval heading.

## Contradicted claims

None.

## Verdict

The plan's claims match the code.
`;

function planWithRun(dir) {
  const text = mut(
    mut(filledTemplate(), "- Working directory: <absolute path to the target repository checkout>", "- Working directory: /checkout/target-repo"),
    "- Verdict capture: <path to the captured verdict>",
    "- Verdict capture: /captures/verdict.txt",
  );
  return stampedPlan(dir, text, "plan-with-run.md");
}

test("a verdict proves code access: bridge header, read-only sandbox, the declared tree, and independent citations", () => {
  const { text } = planWithRun(scratch());
  assert.deepEqual(findings(text, { verdict: VERDICT, verdictPath: "/captures/verdict.txt" }), []);
});

test("a verdict without an \"Independent code evidence\" section is refused", () => {
  const { text } = planWithRun(scratch());
  assert.ok(reports(text, "Independent code evidence", { verdict: mut(VERDICT, "## Independent code evidence", "## Notes"), verdictPath: "/captures/verdict.txt" }));
});

test("evidence that cites no repository path is refused — quoting the prompt back is not independent evidence", () => {
  const { text } = planWithRun(scratch());
  const noCitations = mut(VERDICT, /Grepping the checkout[\s\S]*?Approval heading\./, "The plan looks fine to me.");
  assert.ok(reports(text, "cites no repo-relative path", { verdict: noCitations, verdictPath: "/captures/verdict.txt" }));
});

test("a verdict produced in a different tree, or with a writable sandbox, is refused", () => {
  const { text } = planWithRun(scratch());
  assert.ok(reports(text, "does not describe this run", { verdict: mut(VERDICT, "cwd=/checkout/target-repo", "cwd=/somewhere/else"), verdictPath: "/captures/verdict.txt" }));
  assert.ok(reports(text, "sandbox=read-only", { verdict: mut(VERDICT, "sandbox=read-only", "sandbox=workspace-write"), verdictPath: "/captures/verdict.txt" }));
});

test("the CLI checks the capture alongside the plan and refuses on the verdict's own failings", () => {
  const dir = scratch();
  const { file } = planWithRun(dir);
  const good = path.join(dir, "verdict.txt");
  fs.writeFileSync(good, VERDICT);
  assert.equal(gate(["--plan", file, "--verdict", good]).status, 0);

  const bad = path.join(dir, "verdict-bad.txt");
  fs.writeFileSync(bad, mut(VERDICT, "## Independent code evidence", "## Notes"));
  const r = gate(["--plan", file, "--verdict", bad]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Independent code evidence/);
});

test("a plan claim the code refutes is REFUSED on Codex's own evidence, and passes once corrected", () => {
  const dir = scratch();
  const { file, text } = planWithRun(dir);

  // The round ran inside the target checkout and found the plan's claim false:
  // it cites the file that refutes it, by path, under "Contradicted claims".
  const refuting = mut(
    VERDICT,
    "## Contradicted claims\n\nNone.",
    `## Contradicted claims

- The plan states the pack has no mechanical structure check. It does:
  scripts/check-epic-plan.mjs is that check, and commands/epic-plan.md shells
  out to it before presenting.`,
  );
  assert.ok(
    reports(text, "CONTRADICTS the plan", { verdict: refuting, verdictPath: "/captures/verdict.txt" }),
    "a plan the code refutes must be refused, not presented",
  );

  // Through the CLI the command actually calls: exit 1, finding printed. Each
  // round keeps its capture in its own directory under the name the plan
  // records, so the only finding under test is the contradiction itself.
  const round = (name, capture) => {
    const roundDir = path.join(dir, name);
    fs.mkdirSync(roundDir, { recursive: true });
    const p = path.join(roundDir, "verdict.txt");
    fs.writeFileSync(p, capture);
    return p;
  };
  const r = gate(["--plan", file, "--verdict", round("round-1", refuting)]);
  assert.equal(r.status, 1);
  assert.equal(r.stderr.match(/^  - /gm).length, 1, `the contradiction must be the only finding: ${r.stderr}`);
  assert.match(r.stderr, /CONTRADICTS the plan/);

  // Corrected on that evidence and reconverged: the fresh verdict reports none.
  assert.equal(gate(["--plan", file, "--verdict", round("round-2", VERDICT)]).status, 0);
});

test("a verdict that never says what it could not confirm is refused — silence is not confirmation", () => {
  const { text } = planWithRun(scratch());
  const silent = mut(VERDICT, "## Contradicted claims\n\nNone.\n\n", "");
  assert.ok(reports(text, "Contradicted claims", { verdict: silent, verdictPath: "/captures/verdict.txt" }));
});

test("a cited path that does not exist in the declared checkout is not evidence", () => {
  const dir = scratch();
  // A real checkout: the declared working directory exists and holds a real file.
  const checkout = path.join(dir, "checkout");
  fs.mkdirSync(path.join(checkout, "src"), { recursive: true });
  fs.writeFileSync(path.join(checkout, "src", "real-file.mjs"), "export const real = true;\n");

  const plan = stampedPlan(
    dir,
    mut(
      mut(filledTemplate(), "- Working directory: <absolute path to the target repository checkout>", `- Working directory: ${checkout}`),
      "- Verdict capture: <path to the captured verdict>",
      "- Verdict capture: /captures/verdict.txt",
    ),
    "plan-real-checkout.md",
  ).text;

  const withCitation = (cited) => VERDICT
    .replace("cwd=/checkout/target-repo", `cwd=${checkout}`)
    .replace(/Grepping the checkout[\s\S]*?Approval heading\./, `I grepped the checkout myself: ${cited} is where it happens.`);

  assert.deepEqual(
    findings(plan, { verdict: withCitation("src/real-file.mjs"), verdictPath: "/captures/verdict.txt" }),
    [],
    "a citation that resolves in the declared checkout is evidence",
  );
  assert.ok(
    reports(plan, "exist in the declared checkout", { verdict: withCitation("src/invented-file.mjs"), verdictPath: "/captures/verdict.txt" }),
    "a plausible-looking path nobody can open is not evidence",
  );
});

test("a convergence record that claims a writable sandbox or an unbounded round count is refused", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  assert.ok(reports(mut(base, "- Sandbox: read-only", "- Sandbox: workspace-write"), "must record `read-only`"));
  assert.ok(reports(mut(base, "- Rounds: 1", "- Rounds: 9"), "must be between 1 and 3"));
});

// --- 6. approval binding ------------------------------------------------------

test("an edit after approval invalidates it — re-approval (and a fresh convergence round) is required", () => {
  const dir = scratch();
  const { text } = stampedPlan(dir, filledTemplate());
  const approved = approve(text);
  assert.deepEqual(findings(approved, { stage: "create" }), [], "the approved plan may create");

  const edited = mut(approved, "- Rounds: 1", "- Rounds: 2");
  assert.ok(reports(edited, "the approval is STALE"), "the recorded approval no longer describes this plan");
  assert.ok(reports(edited, "the plan changed after it was stamped"));

  // Re-stamping alone does NOT rescue it: the approval line carries its own copy
  // of the revision it approved, so only a fresh approval clears the finding.
  const restamped = stampedPlan(dir, edited, "edited.md");
  assert.ok(reports(restamped.text, "the approval is STALE"));
  assert.deepEqual(findings(approve(mut(restamped.text, /- Status: APPROVED[^\n]*/, "- Status: PENDING")), { stage: "create" }), []);
});

test("the create stage refuses an unapproved plan, an unresolved owner question, and unrecorded pre-approval writes", () => {
  const dir = scratch();
  const { file, text } = stampedPlan(dir, filledTemplate());

  const r = gate(["--plan", file, "--stage", "create"]);
  assert.equal(r.status, 1, "no GitHub write is permitted before approval");
  assert.match(r.stderr, /the plan is not approved/);

  const pending = stampedPlan(dir, mut(text, /- \*\*Decision:\*\* native parent\/sub-issue nesting[\s\S]*?unavailable\./, "- **Decision:** PENDING"), "pending.md");
  assert.ok(reports(approve(pending.text), "owner question(s) still PENDING", { stage: "create" }));

  assert.ok(reports(mut(approve(text), "- Pre-approval writes: none", "- Pre-approval writes: one comment"), "must record `none`", { stage: "create" }));
});

test("an intro that is really an indented code block is refused, however it is indented", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  const codeIntro = (indent) =>
    mut(base, /## Migration path\n\nThis section says[\s\S]*?carries its reason\./, `## Migration path\n\n${indent}migrate --all # this is a command, not a plain-language introduction at all.`);
  assert.ok(reports(codeIntro("    "), "indented code block"), "four spaces");
  assert.ok(reports(codeIntro("\t"), "indented code block"), "a tab");
  assert.ok(reports(codeIntro(" \t"), "indented code block"), "a space and a tab still reach column four");
});

test("nothing rides in below the approval — it is the last section, and carries fields only", () => {
  const dir = scratch();
  const { text } = stampedPlan(dir, filledTemplate());

  // A section appended AFTER the approval would otherwise be approved by a
  // digest that never covered it.
  const appended = stampedPlan(
    dir,
    `${text}\n## Scope override\n\nThis clause sits below the approval, which is exactly where an unapproved change\nwould hide if the digest stopped at the approval heading.\n\n- Also: ship a sixth sub-issue.\n`,
    "appended.md",
  );
  assert.ok(reports(appended.text, "must be the LAST section"));
  assert.equal(gate(["--plan", appended.file, "--stage", "create"]).status, 1);

  // Nor inside the approval section, which the digest cannot cover — neither as
  // prose nor dressed up as one more field.
  const smuggled = mut(text, "- Pre-approval writes: none\n", "- Pre-approval writes: none\n\nAlso, the epic quietly grows a sixth sub-issue.\n");
  assert.ok(reports(smuggled, "sits outside the approved revision"));
  const extraField = mut(text, "- Pre-approval writes: none\n", "- Pre-approval writes: none\n- Scope override: also create a sixth sub-issue\n");
  assert.ok(reports(extraField, "unrecognized field"));

  // ... including a field or a heading GLUED to the intro with no blank line,
  // which would otherwise be read as the last line of the paragraph.
  // The approval's OWN prose is hashed too, so a sentence parked there after the
  // approval invalidates it exactly like any other edit.
  const approved = approve(text);
  assert.deepEqual(findings(approved, { stage: "create" }), []);
  const paddedIntro = mut(approved, "approval and needs a fresh convergence round.", "approval and needs a fresh convergence round. Also create an unplanned sixth sub-issue.");
  assert.ok(reports(paddedIntro, "the approval is STALE"));

  // Trailing whitespace is content: two trailing spaces are a Markdown hard
  // break, so the digest covers them.
  assert.ok(reports(mut(approved, "- Sandbox: read-only", "- Sandbox: read-only  "), "the approval is STALE"));

  // A repeated field is ambiguous about what was approved.
  const twice = mut(text, "- Pre-approval writes: none\n", "- Pre-approval writes: none\n- Status: also create an unplanned sixth sub-issue\n");
  assert.ok(reports(twice, "twice"));

  const glued = (line) => mut(text, "approval and needs a fresh convergence round.\n", `approval and needs a fresh convergence round.\n${line}\n`);
  assert.ok(reports(glued("- Scope override: also create a sixth sub-issue"), "unrecognized field"));
  assert.ok(reports(glued("### Scope override"), "sits outside the approved revision"));
});

test("a ledger count must be a number, and an empty project is a real answer", () => {
  const dir = scratch();
  assert.ok(reports(stampedPlan(dir, mut(filledTemplate(), "- Items read: 643", "- Items read: 643items")).text, "does not record an `- Items read:` count"));
  // A brand-new project has nothing on it yet; that is a finding-free read.
  assert.deepEqual(findings(stampedPlan(dir, filledTemplate({ total: 0, limit: 1 }), "empty.md").text), []);
});

test("a forged verdict header does not pass for a real one", () => {
  const { text } = planWithRun(scratch());
  const v = (from, to) => ({ verdict: mut(VERDICT, from, to), verdictPath: "/captures/verdict.txt" });
  assert.ok(reports(text, "sandbox=read-only", v("sandbox=read-only ", "sandbox=read-onlyish ")), "the value has to end where it claims to");
  assert.ok(
    reports(text, "sandbox=read-only", v("sandbox=read-only ", "sandbox=workspace-write decoy_sandbox=read-only ")),
    "a decoy field must not satisfy the check from the left",
  );
  assert.ok(reports(text, "reasoning_effort=", v("model=<pinned> model_reasoning_effort=max ", "")), "a header without the pins is not attributable");
  assert.ok(
    reports(text, "CONTRADICTS the plan", v("## Contradicted claims\n\nNone.", "## Contradicted claims\n\nNone of the plan's claims were confirmed; several are false.")),
    "\"None of the claims were confirmed\" is the opposite of a clean bill of health",
  );
});

test("an approval that names no revision binds to nothing and is refused", () => {
  const { text } = stampedPlan(scratch(), filledTemplate());
  const vague = mut(text, "- Status: PENDING", "- Status: APPROVED (looks good)");
  assert.ok(reports(vague, "an `APPROVED` status must embed the revision it approved"));
});

// --- 7. routing ---------------------------------------------------------------

test("a dependency edge the gate cannot parse end to end is refused", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  const trailing = mut(base, "- first-slug -> second-slug\n", "- first-slug -> second-slug and also third-slug\n");
  assert.ok(reports(trailing, "is not a `<slug> -> <slug>` edge"));
  // An annotated edge is still an edge.
  assert.deepEqual(findings(stampedPlan(scratch(), mut(filledTemplate(), "- first-slug -> second-slug\n", "- first-slug -> second-slug (the second cannot start until the first lands)\n"), "annotated.md").text), []);
});

test("every dispatch names a model and an effort, and the top-level dispatch is on its pin", () => {
  const base = stampedPlan(scratch(), filledTemplate()).text;
  assert.ok(reports(mut(base, "- Project history read — model: opus, effort: medium", "- Project history read — model: opus"), "does not name both"));
  assert.ok(reports(mut(base, "(top-level) — model: fable, effort: max", "(top-level) — model: sonnet, effort: low"), "orchestration is pinned to fable at effort max"));
  assert.ok(reports(mut(base, " (top-level)", ""), "marks no `(top-level)` dispatch"));
});

// --- the CLI contract itself --------------------------------------------------

test("--template prints a skeleton that is conforming once its ledger is filled in, and refused while it is not", () => {
  const r = gate(["--template"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, template());

  const dir = scratch();
  const bare = stampedPlan(dir, r.stdout, "bare.md");
  assert.equal(gate(["--plan", bare.file]).status, 1, "an unfilled skeleton must not pass as a plan");

  const filled = stampedPlan(dir, filledTemplate(), "filled.md");
  const ok = gate(["--plan", filled.file]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /epic-plan gate OK at stage 'present' — 2 sub-issue\(s\), 1 dependency edge\(s\)/);
  assert.match(ok.stdout, /\(not yet approved\)/);
});

test("bad usage exits 2 (cannot run), which is not a refusal", () => {
  assert.equal(gate([]).status, 2);
  assert.equal(gate(["--plan", "/no/such/plan.md"]).status, 2);
  assert.equal(gate(["--plan", GATE, "--stage", "publish"]).status, 2);
});

test("the selftest that proves the gate can fail is itself green", () => {
  const r = gate(["--selftest"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /SELFTEST OK/);
});

// --- the shipped surface: the command and the skill it drives -----------------
//
// A command that names a skill which does not exist, or a gate flag the gate
// does not implement, fails only at the moment someone runs it. These checks
// resolve the references at test time instead.

const PACK = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(PACK, rel), "utf8");

/** The YAML frontmatter block of a command/skill file, as raw text. */
function frontmatter(rel) {
  const lines = read(rel).split(/\r?\n/);
  assert.equal(lines[0].trim(), "---", `${rel} must open with a frontmatter delimiter`);
  const end = lines.findIndex((l, i) => i > 0 && (l.trim() === "---" || l.trim() === "..."));
  assert.ok(end > 0, `${rel} has an unterminated frontmatter block`);
  return lines.slice(1, end).join("\n");
}

test("the epic-plan command declares the surface the picker and the naming gate expect", () => {
  const fm = frontmatter("commands/epic-plan.md");
  assert.match(fm, /^name: epic-plan$/m, "the advertised name must equal the filename basename");
  assert.match(fm, /^disable-model-invocation: true$/m, "commands in this pack are manual-only");
  assert.match(fm, /^argument-hint: /m, "the command takes arguments, so it advertises them");
  const body = read("commands/epic-plan.md");
  assert.match(body, /^# \/cinatra:epic-plan$/m);
  // Both arguments are load-bearing: a project alone cannot establish a codebase.
  assert.match(fm, /argument-hint: "<project:/);
  assert.match(body, /If the\n   repository argument is missing, ASK/);
});

test("the issue-authoring skill stays out of the `/` picker, as every skill in this pack does", () => {
  const fm = frontmatter("skills/issue-authoring/SKILL.md");
  assert.match(fm, /^name: issue-authoring$/m);
  assert.match(fm, /^user-invocable: false$/m);
  assert.match(fm, /^triggers:$/m);
});

test("every skill the new command and skill name in bold backticks actually ships in this pack", () => {
  const referenced = new Set();
  for (const rel of ["commands/epic-plan.md", "skills/issue-authoring/SKILL.md"]) {
    for (const m of read(rel).matchAll(/\*\*`([a-z][a-z0-9-]*)`\*\*/g)) referenced.add(m[1]);
  }
  assert.ok(referenced.size >= 4, `expected the orchestrator to drive several skills, saw ${[...referenced]}`);
  for (const name of referenced) {
    const skill = path.join(PACK, "skills", name, "SKILL.md");
    assert.ok(fs.existsSync(skill), `\`${name}\` is driven but skills/${name}/SKILL.md does not exist`);
    assert.match(fs.readFileSync(skill, "utf8"), new RegExp(`^name: ${name}$`, "m"));
  }
  // The command must drive the issue-creation skill rather than reimplement it.
  assert.ok(referenced.has("issue-authoring"), "the command must create issues through the reusable skill");
  assert.ok(referenced.has("codex-pairing") && referenced.has("grounding"), "convergence and grounding are consumed, not forked");
});

test("every gate flag the command tells the reader to run is a flag the gate implements", () => {
  const body = read("commands/epic-plan.md");
  const used = new Set();
  for (const m of body.matchAll(/check-epic-plan\.mjs"?[^\n`]*((?:\s+(?:--[a-z-]+|\\\n\s+)[^\n`]*)+)/g)) {
    for (const f of m[1].matchAll(/--[a-z-]+/g)) used.add(f[0]);
  }
  assert.ok(used.size > 0, "the command must actually invoke the gate");
  const implemented = new Set(["--template", "--stamp", "--plan", "--verdict", "--stage", "--selftest"]);
  for (const flag of used) assert.ok(implemented.has(flag), `the command uses ${flag}, which the gate does not implement`);
  for (const required of ["--template", "--stamp", "--plan", "--stage"]) {
    assert.ok(used.has(required), `the command never uses ${required}`);
  }
});

test("no GitHub mutation appears before the approval gate — the dry run has nothing to suppress", () => {
  const body = read("commands/epic-plan.md");
  const creationPhase = body.indexOf("## 5. Creation phase");
  assert.ok(creationPhase > 0, "the command must have a creation phase to draw the line at");
  const beforeApproval = body.slice(0, creationPhase);

  // Every shape of GitHub write, checked against the read-only half of the flow.
  const MUTATIONS = [
    /gh issue create/,
    /gh issue comment/,
    /gh issue edit/,
    /gh project item-add/,
    /gh project item-edit/,
    /--method\s+(POST|PATCH|PUT|DELETE)/,
  ];
  for (const re of MUTATIONS) {
    assert.ok(!re.test(beforeApproval), `${re} appears before the creation phase — the research and approval phases are read-only`);
  }
  assert.match(body, /--dry-run/, "the command advertises the dry run");
  assert.match(body, /A dry run makes zero GitHub writes\./);
  assert.match(body, /prints the exact mutations it WOULD run/);

  // The same line in the skill the command drives: dedup/ground/converge/leak
  // gate are read-only; every mutation lives at or after the create step.
  const skill = read("skills/issue-authoring/SKILL.md");
  const dedupStep = skill.indexOf("## 1. Dedup");
  const createStep = skill.indexOf("## 5. Create");
  assert.ok(dedupStep > 0 && createStep > dedupStep, "the skill runs dedup before it creates");
  const readOnlyHalf = skill.slice(dedupStep, createStep);
  for (const re of MUTATIONS) {
    assert.ok(!re.test(readOnlyHalf), `${re} appears in the skill's read-only steps`);
  }
  assert.match(skill, /Steps 1[–-]4 are READ-ONLY against GitHub\./);
  // and the writes really are documented, after the gate — not merely absent.
  const writeHalf = skill.slice(createStep);
  assert.match(writeHalf, /gh issue create/);
  assert.match(writeHalf, /gh project item-add/);
  assert.match(writeHalf, /--method POST/);
});

test("the command runs the gate at BOTH stages — refuse to present, and refuse to create", () => {
  const body = read("commands/epic-plan.md");
  assert.match(body, /--stage present/, "the present stage gates what the owner is shown");
  assert.match(body, /--stage create/, "the create stage gates the first GitHub write");
  assert.ok(body.indexOf("--stage present") < body.indexOf("--stage create"), "presentation precedes creation");
});
