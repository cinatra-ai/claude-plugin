#!/usr/bin/env node
// check-epic-plan.mjs — the deterministic structure/approval gate behind
// `/cinatra:epic-plan`.
//
// WHY THIS EXISTS
// The epic-plan command promises a plan whose structure is MECHANICALLY
// checkable: every section opens with a plain-language paragraph, every owner
// question carries its four parts, a Conflicts section is always present, the
// project read is provably untruncated, the Codex round provably ran with code
// access, and an approval is bound to the exact plan revision it approved.
// Prose doctrine cannot enforce any of that — a model asked to "make sure the
// plan has all the sections" will sometimes decide it does. So the command
// shells out to this gate: it REFUSES to present a plan the gate rejects, and
// REFUSES to write anything to GitHub until the gate passes at the create
// stage. The rules live here, in one place, with a --selftest that proves each
// one can actually fail.
//
// THE PLAN CONTRACT (see --template for a conforming skeleton)
//   Required `##` sections: Epic summary, Sub-issues, Dependency edges,
//   Owner questions, Conflicts, Backward compatibility, Migration path,
//   Project items examined, Routing trace, Convergence record, Approval.
//
//   1. Plain-language intro — every `##` section, and every sub-issue `###`
//      entry, opens with a prose paragraph (>= 80 chars, ends a sentence)
//      before any bullet, table, code fence or subheading. A bold label
//      (`**Decision:** …`) is not a paragraph. Sub-issue entries are included
//      because that intro is what carries into the created issue body.
//   2. Sub-issues — one `### <slug>: <title>` per sub-issue, each declaring
//      `**Depends on:** none` or a list of sibling slugs. The `Dependency
//      edges` section must declare exactly the same edge set, and the graph
//      must be acyclic.
//   3. Owner questions — either the literal `None`, or `###` entries each
//      carrying all four parts: what is being decided, why a user cares, the
//      impact of each option, and the recorded decision (`PENDING` until
//      answered; PENDING blocks the create stage).
//   4. Conflicts — always present. Either `None found` plus an
//      `Items examined: <n>` count that MATCHES the project ledger, or `###`
//      entries each carrying `**Overlaps:**` and `**Ruling:**`. A PENDING
//      ruling blocks the create stage: an unresolved conflict needs an owner
//      ruling and a reconvergence round, never a silent resolution.
//   5. Backward compatibility / Migration path — always present; a "no
//      impact" / "no migration required" claim needs an explicit `Rationale:`.
//   6. Project items examined — the anti-truncation ledger. `Items read` must
//      equal `Total items reported`, the fetch limit must be strictly greater
//      than the total (a limit equal to the total cannot prove nothing was cut
//      off), and the read must cover open AND closed items, with closed items
//      read as the decisions record. This is what makes "read past the first
//      page" checkable rather than aspirational.
//   7. Routing trace — every dispatch bullet names `model:` and `effort:`, and
//      one bullet is marked `(top-level)` with the top-level model/effort pin.
//   8. Convergence record — working directory, `Sandbox: read-only`, the
//      captured verdict path, the model + effort the verdict is attributable
//      to, and the round count (1..3). With `--verdict <file>` the capture
//      itself is checked: the bridge header must record the same working
//      directory and the read-only sandbox, and the verdict must carry an
//      "Independent code evidence" section citing at least one repo-relative
//      path — evidence Codex found itself, not quoted from the prompt — and a
//      "Contradicted claims" section saying what the code REFUTED (`None.`
//      when nothing). A listed contradiction REFUSES the plan: it is corrected
//      on that evidence and reconverged, never presented as written.
//   9. Approval — the LAST section, carrying only its intro paragraph and the
//      fields `Plan revision`, `Status`, `Pre-approval writes`, each once.
//      `Plan revision: sha256:<hex>` must equal the digest of every byte of
//      the plan except the `Plan revision` and `Status` lines themselves, and
//      an `APPROVED` status must embed that same digest. Edit the plan after approval and the digest
//      moves: the recorded approval no longer matches and the create stage
//      refuses. Re-stamping alone does not rescue it — the approval line
//      carries its own copy of the revision it approved.
//
// USAGE
//   node scripts/check-epic-plan.mjs --template            # print a conforming skeleton
//   node scripts/check-epic-plan.mjs --stamp <plan.md>     # (re)compute the revision digest in place
//   node scripts/check-epic-plan.mjs --plan <plan.md> [--verdict <capture>] [--stage present|create]
//   node scripts/check-epic-plan.mjs --selftest            # prove every rule can fail
//
// Exit 0 = the plan may proceed at the requested stage, 1 = refused (findings
// printed), 2 = the check could not run (bad usage, unreadable file).

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

const STAGES = new Set(["present", "create"]);

const REQUIRED_SECTIONS = [
  "Epic summary",
  "Sub-issues",
  "Dependency edges",
  "Owner questions",
  "Conflicts",
  "Backward compatibility",
  "Migration path",
  "Project items examined",
  "Routing trace",
  "Convergence record",
  "Approval",
];

// The top-level orchestration pin. A dispatch bullet marked `(top-level)` must
// name exactly these — the command defines the routing, so the gate can hold it.
const TOP_LEVEL_MODEL = "fable";
const TOP_LEVEL_EFFORT = "max";

const MIN_INTRO_CHARS = 80;
const MIN_RATIONALE_CHARS = 40;
const MIN_DECISION_CHARS = 20;
const MAX_ROUNDS = 3;

// The ONLY fields allowed inside `## Approval`. That section sits outside the
// revision digest (it records the approval OF that revision), so anything else
// parked there would be approved without ever having been hashed.
const APPROVAL_FIELDS = new Set(["plan revision", "status", "pre-approval writes"]);

const QUESTION_PARTS = [
  ["what is being decided", /\*\*What is being decided:\*\*\s*(.+)/i],
  ["why a user cares", /\*\*Why a user cares:\*\*\s*(.+)/i],
  ["impact of each option", /\*\*Impact of each option:\*\*\s*(.+)/i],
  ["decision", /\*\*Decision:\*\*\s*(.+)/i],
];

const norm = (t) => String(t).trim().toLowerCase().replace(/\s+/g, " ");

// --- markdown structure ------------------------------------------------------

/**
 * The lines OUTSIDE fenced code blocks, as [index, line] pairs.
 *
 * A fence closes only on the same marker character at the same-or-greater
 * length (CommonMark): a \`\`\` block may quote a ~~~ fence, and a ~~~~ block may
 * quote ~~~, without either being read as the end of the block. Toggling on any
 * fence-looking line instead lets a `## heading` or a bullet inside a code
 * SAMPLE count as document structure — which shows up as the gate refusing a
 * plan that is actually conforming.
 */
function* unfenced(lines) {
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^\s*(`{3,}|~{3,})/.exec(line);
    if (m) {
      const marker = m[1][0];
      const len = m[1].length;
      if (!open) { open = { marker, len }; continue; }
      if (marker === open.marker && len >= open.len) { open = null; continue; }
      // a shorter or different fence inside an open block is content
    }
    if (open) continue;
    yield [i, line];
  }
}

/** Headings, ignoring anything inside a fenced code block. */
function headings(lines) {
  const out = [];
  for (const [i, line] of unfenced(lines)) {
    const m = /^(#{1,6})[ \t]+(.*\S)[ \t]*$/.exec(line);
    if (m) out.push({ level: m[1].length, title: m[2].trim(), line: i });
  }
  return out;
}

/** Sections as { level, title, line, body: string[] } — a body ends at the next same-or-higher heading. */
function sections(text) {
  const lines = text.split(/\r?\n/);
  const heads = headings(lines);
  return heads.map((h, idx) => {
    let end = lines.length;
    for (let j = idx + 1; j < heads.length; j++) {
      if (heads[j].level <= h.level) { end = heads[j].line; break; }
    }
    return { ...h, body: lines.slice(h.line + 1, end) };
  });
}

/** The `level`-deep headings nested under `parent`. */
function children(all, parent, level) {
  let end = Infinity;
  for (const s of all) {
    if (s.line > parent.line && s.level <= parent.level) { end = s.line; break; }
  }
  return all.filter((s) => s.level === level && s.line > parent.line && s.line < end);
}

const bodyText = (s) => (Array.isArray(s) ? s : s.body).join("\n");

/**
 * The indentation of a line in COLUMNS, tabs expanded to the next 4-column stop
 * (CommonMark). Four columns start a code block — and a mix of spaces and tabs
 * reaches four columns without ever matching a literal "    " prefix.
 */
function leadingColumns(line) {
  let col = 0;
  for (const ch of line) {
    if (ch === " ") col += 1;
    else if (ch === "\t") col += 4 - (col % 4);
    else break;
  }
  return col;
}

/** The first block after a heading, as prose — or the reason it is not a paragraph. */
function introParagraph(body) {
  let i = 0;
  while (i < body.length && body[i].trim() === "") i++;
  if (i >= body.length) return { ok: false, why: "the section is empty" };
  if (leadingColumns(body[i]) >= 4) return { ok: false, why: "it starts with an indented code block, not prose" };
  const first = body[i].trim();
  if (/^#{1,6}[ \t]/.test(first)) return { ok: false, why: "it starts with a subheading" };
  if (/^([-*+]|\d+[.)])[ \t]/.test(first)) return { ok: false, why: "it starts with a list" };
  if (first.startsWith("|")) return { ok: false, why: "it starts with a table" };
  if (first.startsWith(">")) return { ok: false, why: "it starts with a block quote" };
  if (/^(```|~~~)/.test(first)) return { ok: false, why: "it starts with a code block" };
  if (first.startsWith("**")) return { ok: false, why: "it starts with a bold label, not prose" };
  const para = [];
  for (; i < body.length; i++) {
    if (body[i].trim() === "") break;
    para.push(body[i].trim());
  }
  const text = para.join(" ");
  if (text.length < MIN_INTRO_CHARS) {
    return { ok: false, why: `the opening paragraph is ${text.length} chars — a plain-language intro needs at least ${MIN_INTRO_CHARS}` };
  }
  if (!/[.!?]["')]?$/.test(text)) return { ok: false, why: "the opening paragraph is not a finished sentence" };
  return { ok: true, text };
}

/** A line that starts a non-prose block (list, heading, table, quote, fence). */
function isStructuralLine(line) {
  return /^[ \t]*([-*+]|\d+[.)])[ \t]/.test(line)
    || /^[ \t]*#{1,6}[ \t]/.test(line)
    || /^[ \t]*[|>]/.test(line)
    || /^[ \t]*(`{3,}|~{3,})/.test(line);
}

/** Bullet lines (`- …`) of a body, code fences excluded. */
function bullets(body) {
  const out = [];
  for (const [, line] of unfenced(body)) {
    const m = /^[ \t]*[-*][ \t]+(.*\S)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** The value of a `- <label>: <value>` bullet (label may be bold-wrapped). */
function field(body, label) {
  const re = new RegExp(`^[ \\t]*[-*][ \\t]+\\**${label}\\**:[ \\t]*(.*)$`, "i");
  for (const line of body) {
    const m = re.exec(line);
    if (m) return m[1].trim();
  }
  return null;
}

// --- the plan-revision digest ------------------------------------------------

/**
 * Every byte of the plan EXCEPT the two lines an approval necessarily rewrites:
 * the Approval section's own `- Plan revision:` and `- Status:` bullets. They
 * cannot be hashed (the digest would have to contain itself); EVERYTHING else
 * is — the approval section's prose, its other fields, and anything after it.
 * Excluding the whole Approval body instead would leave a paragraph inside it
 * unhashed, which is a place to park a clause nobody approved. (The gate also
 * requires Approval to be the last section, holding only its intro and the
 * three known fields, each once — independent guards on the same hole.)
 *
 * What the digest deliberately does NOT cover, and why: the free text of the
 * `- Status:` line (who approved, when). It is written AFTER the stamp, so
 * hashing it would make recording an approval invalidate that same approval.
 * The digest answers "is this the plan that was approved", not "who really
 * approved it" — that second question is answered by the human record the
 * approval lives in, never by a file a local process can rewrite.
 */
function revisionSource(text) {
  const lines = text.split(/\r?\n/);
  const approval = sections(text).find((s) => s.level === 2 && norm(s.title) === "approval");
  const skip = new Set();
  if (approval) {
    for (let i = approval.line + 1; i <= approval.line + approval.body.length; i++) {
      if (/^[ \t]*[-*][ \t]+\**(plan revision|status)\**:/i.test(lines[i] ?? "")) skip.add(i);
    }
  }
  // Byte-for-byte, trailing whitespace included: two trailing spaces are a
  // Markdown hard break, so normalizing them away would let the rendered plan
  // change while the digest stood still. Only line endings are normalized
  // (CRLF/LF) and the trailing blank lines a text editor adds or removes.
  const kept = lines.filter((_, i) => !skip.has(i));
  while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
  return `${kept.join("\n")}\n`;
}

const planRevision = (text) => createHash("sha256").update(revisionSource(text), "utf8").digest("hex");

/** Rewrite the `- Plan revision:` line with the freshly computed digest. */
function stamp(file) {
  const text = readFileSync(file, "utf8");
  const digest = planRevision(text);
  let seen = false;
  const out = text.split(/\r?\n/).map((line) => {
    if (!seen && /^[ \t]*[-*][ \t]+Plan revision:/i.test(line)) {
      seen = true;
      return `- Plan revision: sha256:${digest}`;
    }
    return line;
  });
  if (!seen) {
    console.error("cannot stamp: the plan has no `- Plan revision:` line in its Approval section");
    process.exit(2);
  }
  writeFileSync(file, out.join("\n"));
  return digest;
}

const hasRationale = (text) => {
  const m = /Rationale:\s*(.+)/i.exec(text);
  return Boolean(m && m[1].replace(/[`*]/g, "").trim().length >= MIN_RATIONALE_CHARS);
};

function findCycle(slugs, edges) {
  const adj = new Map([...slugs.keys()].map((s) => [s, []]));
  for (const e of edges) {
    const [from, to] = e.split(" -> ");
    if (adj.has(from) && adj.has(to)) adj.get(from).push(to);
  }
  const state = new Map();
  const stack = [];
  let found = null;
  const walk = (n) => {
    if (found) return;
    state.set(n, 1);
    stack.push(n);
    for (const next of adj.get(n) ?? []) {
      if (found) return;
      if (state.get(next) === 1) { found = [...stack.slice(stack.indexOf(next)), next]; return; }
      if (!state.has(next)) walk(next);
    }
    stack.pop();
    state.set(n, 2);
  };
  for (const n of adj.keys()) if (!state.has(n) && !found) walk(n);
  return found;
}

/** The captured Codex verdict must PROVE code access, not merely assert it. */
function checkVerdict({ verdict, verdictPath, declaredCwd, declaredCapture, errors }) {
  const declared = declaredCwd ? declaredCwd.replace(/`/g, "").trim() : "";
  // Only when the declared checkout is readable from where the gate runs; a plan
  // checked elsewhere (or in CI) simply skips the existence cross-check.
  const checkoutRoot = declared && existsSync(declared) ? declared : null;
  const header = /^\[codex-bridge\][^\n]*$/m.exec(verdict);
  if (!header) {
    errors.push("the captured verdict carries no `[codex-bridge]` header — an unheadered capture is not attributable to a pinned model, effort or sandbox");
  } else {
    const line = header[0];
    // Both boundaries: `read-onlyish` must not satisfy it from the right, and a
    // decoy field (`decoy_sandbox=read-only` next to `sandbox=workspace-write`)
    // must not satisfy it from the left.
    if (!/(^|\s)sandbox=read-only(\s|$)/.test(line)) errors.push("the verdict header does not record `sandbox=read-only` — the convergence round must be provably advisory");
    if (!/(^|\s)model=\S/.test(line) || !/(^|\s)model_reasoning_effort=\S/.test(line)) {
      errors.push("the verdict header records no `model=` / `model_reasoning_effort=` — a capture the bridge did not write is not attributable to the pinned model and effort");
    }
    const cwdMatch = /(?:^|\s)cwd=(\S+)/.exec(line);
    if (!cwdMatch) {
      errors.push("the verdict header records no `cwd=` — without it the round cannot be shown to have run against the target repository");
    } else if (declared && cwdMatch[1] !== declared) {
      errors.push(`the verdict ran in \`${cwdMatch[1]}\` but the plan records \`${declaredCwd}\` — the convergence record does not describe this run`);
    }
  }
  const evidence = sections(verdict).find((s) => norm(s.title).startsWith("independent code evidence"));
  if (!evidence) {
    errors.push('the verdict has no "Independent code evidence" section — a round with code access must cite what it found in the repository itself');
  } else {
    const citations = (bodyText(evidence).match(/(^|[\s`(])[\w.-]+\/[\w./-]+\.\w+/gm) ?? [])
      .map((c) => c.replace(/^[\s`(]+/, ""));
    if (citations.length === 0) {
      errors.push('the "Independent code evidence" section cites no repo-relative path — quoting the prompt back is not independent evidence');
    } else if (checkoutRoot) {
      // When the declared checkout is readable from here, a citation has to be a
      // file that actually EXISTS in it. A plausible-looking path nobody can
      // open is the easiest thing for a verdict to invent.
      const real = citations.filter((c) => existsSync(join(checkoutRoot, c)));
      if (real.length === 0) {
        errors.push(`none of the paths cited as "Independent code evidence" exist in the declared checkout (${checkoutRoot}) — a citation nobody can open is not evidence`);
      }
    }
  }
  // The round exists to CHECK the plan against the code, so the verdict has to
  // say what it could NOT confirm. A section that lists contradictions is a
  // refusal: the plan is corrected on Codex's own evidence and reconverged, never
  // presented carrying a claim the code refutes.
  const contradicted = sections(verdict).find((s) => norm(s.title).startsWith("contradicted claims"));
  if (!contradicted) {
    errors.push('the verdict has no "Contradicted claims" section — a round with code access must state, on its own evidence, which of the plan\'s claims it could NOT confirm (`None.` when it confirmed them all)');
  } else {
    const listed = bullets(contradicted.body);
    const firstLine = bodyText(contradicted).split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "";
    // The clear form is the WORD "none" and nothing else: "None of the plan's
    // claims were confirmed" is the opposite of a clean bill of health, and a
    // prefix match would have read it as one.
    const clear = listed.length === 0 && /^none[.!]?$/i.test(firstLine.replace(/^[-*][ \t]+/, "").replace(/[`*]/g, "").trim());
    if (!clear) {
      errors.push(
        `Codex's own code evidence CONTRADICTS the plan (${listed.length || 1} claim(s) under "Contradicted claims") — ` +
        "correct the plan on that evidence and reconverge; a plan the code refutes is never presented",
      );
    }
  }
  if (verdictPath && declaredCapture) {
    const declared = declaredCapture.replace(/`/g, "").trim();
    const base = (p) => p.split("/").pop();
    if (base(declared) !== base(verdictPath)) {
      errors.push(`the plan records verdict capture \`${declared}\` but the checked capture is \`${verdictPath}\` — the record must point at the verdict actually produced`);
    }
  }
}

// --- the rules ---------------------------------------------------------------

/**
 * Check one plan. `stage` is "present" (the plan may be shown to the owner) or
 * "create" (GitHub writes may begin). Returns { errors, info }.
 */
export function checkPlan(text, { stage = "present", verdict = null, verdictPath = null } = {}) {
  const errors = [];
  const info = {};
  const all = sections(text);
  const h2 = all.filter((s) => s.level === 2);
  const byTitle = new Map(h2.map((s) => [norm(s.title), s]));

  // 1. every required section, exactly once
  for (const want of REQUIRED_SECTIONS) {
    const found = h2.filter((s) => norm(s.title) === norm(want));
    if (found.length === 0) errors.push(`missing required section \`## ${want}\` — the plan is refused, not presented`);
    else if (found.length > 1) errors.push(`section \`## ${want}\` appears ${found.length} times — it must appear exactly once`);
  }
  if (errors.length) return { errors, info }; // structure first; every later rule would cascade

  // 2. a plain-language intro on every `##` section
  for (const s of h2) {
    const intro = introParagraph(s.body);
    if (!intro.ok) errors.push(`\`## ${s.title}\` does not open with a plain-language paragraph — ${intro.why}`);
  }

  // 3. sub-issues + dependency edges
  const subSection = byTitle.get("sub-issues");
  const subs = children(all, subSection, 3);
  if (subs.length === 0) errors.push("`## Sub-issues` declares no `### <slug>: <title>` entries — an epic plan needs a breakdown");
  const slugs = new Map();
  const declaredEdges = new Set();
  for (const s of subs) {
    const m = /^([a-z][a-z0-9-]*):\s*(.+)$/.exec(s.title);
    if (!m) {
      errors.push(`sub-issue heading \`### ${s.title}\` must read \`### <slug>: <title>\` with a lowercase hyphenated slug`);
      continue;
    }
    const slug = m[1];
    if (slugs.has(slug)) errors.push(`two sub-issues share the slug \`${slug}\` — slugs identify dependency endpoints and must be unique`);
    slugs.set(slug, s);
    const intro = introParagraph(s.body);
    if (!intro.ok) {
      errors.push(`sub-issue \`${slug}\` does not open with a plain-language paragraph — ${intro.why} (this intro is what carries into the created issue body)`);
    }
    const depRaw = field(s.body, "Depends on");
    if (depRaw === null) {
      errors.push(`sub-issue \`${slug}\` has no \`**Depends on:**\` line — every sub-issue declares its dependency edges (or \`none\`)`);
      continue;
    }
    const value = depRaw.replace(/[`*]/g, "").trim();
    if (!/^none$/i.test(value)) {
      for (const token of value.split(/[,;]/).map((t) => t.trim()).filter(Boolean)) {
        if (!/^[a-z][a-z0-9-]*$/.test(token)) {
          errors.push(`sub-issue \`${slug}\` depends on \`${token}\`, which is not a sub-issue slug`);
          continue;
        }
        declaredEdges.add(`${token} -> ${slug}`);
      }
    }
  }
  for (const edge of declaredEdges) {
    const [from, to] = edge.split(" -> ");
    if (!slugs.has(from)) errors.push(`dependency \`${edge}\` names \`${from}\`, which is not a declared sub-issue`);
    if (!slugs.has(to)) errors.push(`dependency \`${edge}\` names \`${to}\`, which is not a declared sub-issue`);
  }

  const edgeSection = byTitle.get("dependency edges");
  const listedEdges = new Set();
  for (const b of bullets(edgeSection.body)) {
    const plain = b.replace(/\*/g, "").trim();
    // Anchored end-to-end (a trailing note in parentheses or after a dash is
    // allowed): a prefix match let `a -> b and also c` pass as the edge a -> b.
    const m = /^`?([a-z][a-z0-9-]*)`?\s*(?:->|→)\s*`?([a-z][a-z0-9-]*)`?\s*(?:[—–-]\s+\S.*|\(.*\))?$/.exec(plain);
    if (m) listedEdges.add(`${m[1]} -> ${m[2]}`);
    else if (/(->|→)/.test(plain)) {
      errors.push(`\`## Dependency edges\` bullet "${plain.slice(0, 60)}" is not a \`<slug> -> <slug>\` edge — an edge the gate cannot parse is an edge nobody can check`);
    }
  }
  const noneDeclared = /(^|\n)\s*None\b/.test(bodyText(edgeSection)) && listedEdges.size === 0;
  if (listedEdges.size === 0 && !noneDeclared) {
    errors.push("`## Dependency edges` lists no `<slug> -> <slug>` edge and does not state `None` — the edge set must be explicit");
  }
  for (const edge of listedEdges) {
    if (!declaredEdges.has(edge)) errors.push(`\`## Dependency edges\` lists \`${edge}\`, which no sub-issue declares under \`**Depends on:**\``);
  }
  for (const edge of declaredEdges) {
    if (!listedEdges.has(edge)) errors.push(`sub-issue dependency \`${edge}\` is missing from \`## Dependency edges\` — the two views must agree`);
  }
  const cycle = findCycle(slugs, declaredEdges);
  if (cycle) errors.push(`the dependency graph has a cycle (${cycle.join(" -> ")}) — a cyclic breakdown cannot be sequenced`);
  info.subIssues = slugs.size;
  info.edges = declaredEdges.size;

  // 4. owner questions — all four parts, every time
  const questionSection = byTitle.get("owner questions");
  const questions = children(all, questionSection, 3);
  let pendingDecisions = 0;
  if (questions.length === 0) {
    if (!/(^|\n)\s*None\b/.test(bodyText(questionSection))) {
      errors.push("`## Owner questions` has no `###` question and does not state `None` — say so explicitly rather than leaving the section bare");
    }
  } else {
    for (const q of questions) {
      const text2 = bodyText(q);
      for (const [label, re] of QUESTION_PARTS) {
        const m = re.exec(text2);
        if (!m) {
          errors.push(`owner question "${q.title}" is missing its **${label}** part — every question carries all four`);
          continue;
        }
        if (label === "decision") {
          const value = m[1].trim();
          if (/^pending\b/i.test(value)) pendingDecisions++;
          else if (value.replace(/[`*]/g, "").trim().length < MIN_DECISION_CHARS) {
            errors.push(`owner question "${q.title}" records a decision too short to carry into an issue body — write the decision, not a token`);
          }
        }
      }
    }
  }
  info.pendingDecisions = pendingDecisions;

  // 5. the project ledger (read first — the conflicts rule cross-checks it)
  const ledger = byTitle.get("project items examined");
  // Strict: `643garbage` is not a count. A loose parseInt turns a typo into a
  // number the anti-truncation rules then reason about as if it were real.
  const count = (label) => {
    const raw = (field(ledger.body, label) ?? "").replace(/[`*]/g, "").trim();
    return /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : NaN;
  };
  const total = count("Total items reported");
  const itemsRead = count("Items read");
  const limit = count("Fetch limit used");
  const states = field(ledger.body, "States included") ?? "";
  const closedAsDecisions = field(ledger.body, "Closed items read as decisions") ?? "";
  const project = field(ledger.body, "Project") ?? "";
  if (!project) errors.push("`## Project items examined` does not record which `- Project:` was read");
  // Zero is a real answer: a brand-new project has no items, and the plan may
  // legitimately say so. What is refused is an ABSENT or non-numeric count.
  if (!Number.isFinite(total)) errors.push("`## Project items examined` does not record a numeric `- Total items reported:` count");
  if (!Number.isFinite(itemsRead)) errors.push("`## Project items examined` does not record an `- Items read:` count");
  if (Number.isFinite(total) && Number.isFinite(itemsRead) && itemsRead !== total) {
    errors.push(`the project read is TRUNCATED: ${itemsRead} of ${total} items were read — re-read the project with a higher limit before planning`);
  }
  if (!Number.isFinite(limit)) errors.push("`## Project items examined` does not record the `- Fetch limit used:` — without it the read cannot be shown untruncated");
  else if (Number.isFinite(total) && limit <= total) {
    errors.push(`the fetch limit (${limit}) is not greater than the item count (${total}) — a limit at or below the total cannot prove the read reached the end of the project`);
  }
  if (!/open/i.test(states) || !/closed/i.test(states)) {
    errors.push("`- States included:` must cover open AND closed items — closed items are the project's decisions record, not noise");
  }
  if (!/^yes\b/i.test(closedAsDecisions)) {
    errors.push("`- Closed items read as decisions:` must be `yes` — a plan that skims closed items re-decides settled questions");
  }
  info.itemsRead = Number.isFinite(itemsRead) ? itemsRead : null;

  // 6. conflicts — always present, never silently resolved
  const conflictSection = byTitle.get("conflicts");
  const conflicts = children(all, conflictSection, 3);
  const conflictBody = bodyText(conflictSection);
  let pendingRulings = 0;
  if (conflicts.length === 0) {
    if (!/none found/i.test(conflictBody)) {
      errors.push("`## Conflicts` lists no conflict and does not state `None found` — the no-conflict case is recorded explicitly, never by omission");
    } else {
      const m = /Items examined:\s*(\d+)/i.exec(conflictBody);
      if (!m) {
        errors.push("`## Conflicts` states `None found` without recording how many project items were examined — a no-conflict claim carries its evidence");
      } else if (Number.isFinite(itemsRead) && Number.parseInt(m[1], 10) !== itemsRead) {
        errors.push(`\`## Conflicts\` says ${m[1]} items were examined but the project ledger read ${itemsRead} — the no-conflict claim does not match the read`);
      }
    }
  } else {
    for (const c of conflicts) {
      const text2 = bodyText(c);
      if (!/\*\*Overlaps:\*\*\s*\S/i.test(text2)) errors.push(`conflict "${c.title}" does not name what it **overlaps** — the collision must be explicit`);
      const ruling = /\*\*Ruling:\*\*\s*(.+)/i.exec(text2);
      if (!ruling) errors.push(`conflict "${c.title}" has no \`**Ruling:**\` line — an owner ruling is required, never a silent resolution`);
      else if (/^pending\b/i.test(ruling[1].trim())) pendingRulings++;
    }
  }
  info.pendingRulings = pendingRulings;

  // 7. backward compatibility + migration path
  const compatBody = bodyText(byTitle.get("backward compatibility"));
  if (/\bno\b[^.\n]{0,40}\b(impact|break|breaking|change)\b/i.test(compatBody) && !hasRationale(compatBody)) {
    errors.push('`## Backward compatibility` claims no impact without an explicit `Rationale:` — an unexplained "nothing breaks" is not a compatibility analysis');
  }
  const migrationBody = bodyText(byTitle.get("migration path"));
  if (/no migration\b[^.\n]{0,20}\b(required|needed)\b/i.test(migrationBody) && !hasRationale(migrationBody)) {
    errors.push("`## Migration path` says no migration is required without an explicit `Rationale:` — that claim is only valid with one");
  }

  // 8. routing trace
  const routing = byTitle.get("routing trace");
  const routingBullets = bullets(routing.body);
  if (routingBullets.length === 0) errors.push("`## Routing trace` records no dispatch — every dispatch names its model and effort");
  let topLevel = 0;
  for (const b of routingBullets) {
    const model = /model:\s*`?([A-Za-z0-9._-]+)`?/i.exec(b);
    const effort = /effort:\s*`?([A-Za-z0-9._-]+)`?/i.exec(b);
    if (!model || !effort) {
      errors.push(`routing entry "${b.slice(0, 60)}" does not name both \`model:\` and \`effort:\``);
      continue;
    }
    if (/\(top-level\)/i.test(b)) {
      topLevel++;
      if (model[1].toLowerCase() !== TOP_LEVEL_MODEL || effort[1].toLowerCase() !== TOP_LEVEL_EFFORT) {
        errors.push(`the (top-level) dispatch runs \`${model[1]}\` at effort \`${effort[1]}\` — orchestration is pinned to ${TOP_LEVEL_MODEL} at effort ${TOP_LEVEL_EFFORT}`);
      }
    }
  }
  if (topLevel === 0) errors.push("`## Routing trace` marks no `(top-level)` dispatch — the orchestration run must be in the trace");

  // 9. convergence record (+ the captured verdict, when supplied)
  const conv = byTitle.get("convergence record");
  const cwd = field(conv.body, "Working directory");
  const sandbox = field(conv.body, "Sandbox");
  const capture = field(conv.body, "Verdict capture");
  const convModel = field(conv.body, "Codex model");
  const convEffort = field(conv.body, "Reasoning effort");
  const rounds = Number.parseInt(field(conv.body, "Rounds") ?? "", 10);
  if (!cwd) errors.push("`## Convergence record` does not record the `- Working directory:` the round ran in — code-access provenance is mandatory");
  if (!sandbox || norm(sandbox) !== "read-only") errors.push("`- Sandbox:` must record `read-only` — a convergence round never runs writable");
  if (!capture) errors.push("`## Convergence record` does not record the `- Verdict capture:` path (capture, never tail-pipe)");
  if (!convModel || !convEffort) errors.push("`## Convergence record` must record the `- Codex model:` and `- Reasoning effort:` the verdict is attributable to");
  if (!Number.isFinite(rounds) || rounds < 1 || rounds > MAX_ROUNDS) {
    errors.push(`\`- Rounds:\` must be between 1 and ${MAX_ROUNDS} — an unrecorded or unbounded round count is not a convergence`);
  }
  if (verdict !== null) {
    checkVerdict({ verdict, verdictPath, declaredCwd: cwd, declaredCapture: capture, errors });
  }

  // 10. approval binding
  const approval = byTitle.get("approval");
  // The approval section is the one part of the plan its own digest cannot
  // cover, so nothing load-bearing is allowed to live in it or after it:
  // otherwise a clause added below the approval line would be approved by a
  // digest that never saw it.
  if (h2[h2.length - 1] !== approval) {
    errors.push("`## Approval` must be the LAST section — a section after it would sit outside the revision the approval binds to");
  }
  {
    const seenApprovalFields = new Set();
    let i = 0;
    while (i < approval.body.length && approval.body[i].trim() === "") i++;
    // The intro paragraph is PROSE. A bullet, heading, table, quote or fence
    // ends it even with no blank line before it — otherwise a field glued to
    // the last prose line would be read as part of the paragraph and never
    // checked against the allowlist.
    while (i < approval.body.length && approval.body[i].trim() !== "" && !isStructuralLine(approval.body[i])) i++;
    for (; i < approval.body.length; i++) {
      const line = approval.body[i];
      if (line.trim() === "") continue;
      const bullet = /^[ \t]*[-*][ \t]+\**([^:*]+)\**:/.exec(line);
      if (!bullet) {
        errors.push(`\`## Approval\` carries only its intro paragraph and the approval fields — "${line.trim().slice(0, 50)}" sits outside the approved revision`);
        break;
      }
      const label = norm(bullet[1]);
      if (seenApprovalFields.has(label)) {
        errors.push(`\`## Approval\` carries \`${bullet[1].trim()}\` twice — a repeated field makes the approval ambiguous about what it approved`);
        break;
      }
      seenApprovalFields.add(label);
      if (!APPROVAL_FIELDS.has(label)) {
        errors.push(`\`## Approval\` carries an unrecognized field \`${bullet[1].trim()}\` — only ${[...APPROVAL_FIELDS].join(", ")} live here, because this section is the one part of the plan the revision digest cannot cover`);
        break;
      }
    }
  }
  const recomputed = planRevision(text);
  const recorded = /^[ \t]*[-*][ \t]+Plan revision:\s*sha256:([0-9a-f]{64})\s*$/im.exec(bodyText(approval));
  if (!recorded) {
    errors.push("`## Approval` carries no `- Plan revision: sha256:<digest>` — run the gate with --stamp so an approval can bind to this exact revision");
  } else if (recorded[1] !== recomputed) {
    errors.push(`the recorded plan revision (sha256:${recorded[1].slice(0, 12)}…) does not match this document (sha256:${recomputed.slice(0, 12)}…) — the plan changed after it was stamped`);
  }
  const status = field(approval.body, "Status") ?? "";
  const approved = /^approved\b/i.test(status.trim());
  info.approved = approved;
  info.revision = recomputed;
  if (approved) {
    const bound = /sha256:([0-9a-f]{64})/i.exec(status);
    if (!bound) {
      errors.push("an `APPROVED` status must embed the revision it approved (`APPROVED (revision sha256:<digest>, …)`) — an approval that names no revision binds to nothing");
    } else if (bound[1].toLowerCase() !== recomputed) {
      errors.push("the approval is STALE: it approved a different plan revision than this document — the edit invalidated it; reconverge (a fresh Codex round) and ask for approval again");
    }
  }

  if (stage === "create") {
    if (!approved) errors.push("stage `create` refused: the plan is not approved — no epic, issue, board entry or comment is created before approval");
    if (pendingRulings > 0) errors.push(`stage \`create\` refused: ${pendingRulings} conflict ruling(s) still PENDING — an unresolved conflict blocks approval until the owner rules and the plan reconverges`);
    if (pendingDecisions > 0) errors.push(`stage \`create\` refused: ${pendingDecisions} owner question(s) still PENDING — recorded decisions carry into the created bodies`);
    const pre = field(approval.body, "Pre-approval writes") ?? "";
    if (!/^none\b/i.test(pre.trim())) {
      errors.push("stage `create` refused: `- Pre-approval writes:` must record `none` — the research and approval phases are read-only against GitHub");
    }
  }

  return { errors, info };
}

// --- the conforming skeleton -------------------------------------------------

export function template() {
  return `# Epic plan: <epic title>

<!-- Produced by /cinatra:epic-plan. Structure enforced by scripts/check-epic-plan.mjs. -->

## Epic summary

In plain terms, this epic gives someone using the product <the outcome>, in one
or two sentences with no jargon. Today they have to <the friction>, and after
this work they will <what changes for them>.

- Target repository: <owner/repo>
- Target project: <owner>/projects/<number>
- Default branch grounded at: <sha>

## Sub-issues

Each item below is one piece of the change, written so a reader can tell what it
means for them before any technical detail appears. The order follows the
dependency edges recorded in the next section.

### first-slug: <sub-issue title>

In plain terms, this piece changes <what someone using the product would notice>.
It matters because <why they would care> and it deliberately stops short of
<what it does not do>.

- **Depends on:** none
- Scope: <what is built>
- Done when: <the observable outcome>

### second-slug: <sub-issue title>

In plain terms, this piece changes <what someone using the product would notice>,
which only becomes possible once the first piece exists, so it is sequenced after
it.

- **Depends on:** first-slug
- Scope: <what is built>
- Done when: <the observable outcome>

## Dependency edges

This section says which pieces have to land before which others, so nobody starts
work that cannot be finished yet. Each edge reads "the left piece must land before
the right piece".

- first-slug -> second-slug

## Owner questions

These are the calls only the owner can make. Each one says what is being decided,
why someone using the product would care, what each option costs, and — once
answered — the decision that was recorded and carried into the issue bodies.

### Does the epic use native sub-issue nesting or textual links?

- **What is being decided:** whether the created sub-issues are nested under the
  epic with the native parent/sub-issue relationship, or merely reference it in
  prose.
- **Why a user cares:** nesting shows one canonical structure with progress
  rolled up onto the epic, so anyone looking at the epic can see how far the work
  has actually got; text links look similar in a list but never roll up.
- **Impact of each option:** native nesting gives progress roll-up and a single
  structure and needs the sub-issue endpoint; text links work anywhere, including
  hosts without that endpoint, but leave the structure to prose that drifts.
- **Decision:** native parent/sub-issue nesting is the default, with a textual
  "Part of" link kept only as the documented fallback where the endpoint is
  unavailable.

## Conflicts

This section is where the plan says out loud where it collides with work already
on the project or with a decision already made, so the owner rules on it rather
than the plan quietly choosing. It is present even when there is nothing to
report.

None found. Items examined: <n> (see the project ledger below).

## Backward compatibility

This section says what, if anything, stops working the way it does today for
someone already using the product. Read it as the answer to "will this break what
I am doing right now".

- Behaviour today: <what people rely on>
- Behaviour after: <what changes>
- Rationale: <why this is a compatible change, in enough detail to be checkable>

## Migration path

This section says what someone has to do to move from the current state to the
new one, and how long they can stay on the old one. If there is nothing to do,
that claim carries its reason.

- Rationale: <why nothing needs migrating, or the ordered steps that do>

## Project items examined

This section records exactly how much of the project history the plan actually
read, so a "nothing conflicts" claim can be checked rather than taken on trust.
Closed items count: they are the record of decisions already made.

- Project: <owner>/projects/<number>
- Total items reported: <n>
- Items read: <n>
- Fetch limit used: <greater than n>
- States included: open + closed
- Closed items read as decisions: yes

## Routing trace

This section records which model did which part of the work, so the plan can be
audited rather than assumed. Every dispatch names its model and its effort.

- Plan assembly and revision incorporation (top-level) — model: fable, effort: max
- Codebase research lane — model: opus, effort: high
- Project history read — model: opus, effort: medium
- Mechanical formatting and the approved mutations — model: sonnet, effort: medium

## Convergence record

This section records the independent review round: where it ran, what it could
read, and where its verdict is kept. It ran against the target repository itself,
so it could check the plan's claims against the code rather than against the
prompt.

- Working directory: <absolute path to the target repository checkout>
- Sandbox: read-only
- Codex model: <as pinned by the bridge>
- Reasoning effort: <as pinned by the bridge>
- Rounds: 1
- Verdict capture: <path to the captured verdict>

## Approval

This section is the gate. Nothing is created on GitHub until the owner approves
the exact revision recorded here; editing the plan afterwards invalidates the
approval and needs a fresh convergence round.

- Plan revision: sha256:0000000000000000000000000000000000000000000000000000000000000000
- Status: PENDING
- Pre-approval writes: none
`;
}

// --- selftest ----------------------------------------------------------------

/** Re-stamp a mutated plan through the real --stamp path (via a temp file). */
function restamp(text, file) {
  writeFileSync(file, text);
  stamp(file);
  return readFileSync(file, "utf8");
}

function conflictPlan(base, file) {
  const noneFound = /None found\. Items examined: [^\n]*\n/;
  if (!noneFound.test(base)) throw new Error("selftest fixture drift: the skeleton no longer carries a `None found` line");
  const withConflict = base.replace(
    noneFound,
    `### Overlaps an item already on the project

In plain terms, part of this epic covers ground the project has already started
somewhere else, so someone could end up paying for the same work twice.

- **Overlaps:** an existing project item covering the same surface
- **Ruling:** PENDING`,
  );
  return restamp(withConflict, file);
}

function approve(text) {
  return text.replace(
    "- Status: PENDING",
    `- Status: APPROVED (revision sha256:${planRevision(text)}, approved by <owner>, <date>)`,
  );
}

/**
 * The skeleton with its ledger placeholders replaced by a real-looking read —
 * a project whose item count is well past a single page, which is the case the
 * pagination rules exist for. The skeleton itself is deliberately NOT
 * conforming (see the selftest): handing back an unfilled template must fail.
 */
export function filledTemplate(counts = { total: 643, limit: 1000 }) {
  return template()
    .replace("- Total items reported: <n>", `- Total items reported: ${counts.total}`)
    .replace("- Items read: <n>", `- Items read: ${counts.total}`)
    .replace("- Fetch limit used: <greater than n>", `- Fetch limit used: ${counts.limit}`)
    .replace("Items examined: <n>", `Items examined: ${counts.total}`);
}

function selftest() {
  const dir = mkdtempSync(join(tmpdir(), "epic-plan-selftest-"));
  const planFile = join(dir, "plan.md");
  const done = (code) => { rmSync(dir, { recursive: true, force: true }); process.exit(code); };

  const base = restamp(filledTemplate(), planFile);
  const fail = (label, text, expect, opts = {}) => {
    const { errors } = checkPlan(text, opts);
    if (!errors.some((e) => e.includes(expect))) {
      console.error(`SELFTEST FAILED: ${label} was not reported (expected a finding containing "${expect}")`);
      console.error(`  findings: ${errors.length ? errors.join("\n            ") : "(none)"}`);
      done(1);
    }
  };
  const pass = (label, text, opts = {}) => {
    const { errors } = checkPlan(text, opts);
    if (errors.length) {
      console.error(`SELFTEST FAILED: ${label} should pass but reported:\n  - ${errors.join("\n  - ")}`);
      done(1);
    }
  };

  // Apply a fixture mutation and PROVE it changed something: a replace that
  // silently matches nothing would leave the case asserting against an
  // unmutated plan — a green selftest that tests nothing.
  const mut = (text, from, to) => {
    const out = text.replace(from, to);
    if (out === text) {
      console.error(`SELFTEST FAILED: fixture mutation ${String(from).slice(0, 70)} matched nothing — the case would assert on an unmutated document`);
      done(1);
    }
    return out;
  };

  pass("the stamped skeleton, ledger filled in, at stage present", base);
  // The bare skeleton must NOT pass: handing back the template with its ledger
  // placeholders intact is exactly the failure the ledger exists to catch.
  fail("the unfilled skeleton", restamp(template(), planFile), "does not record a numeric `- Total items reported:` count");

  // a code SAMPLE is never structure, whichever fence markers it nests
  pass(
    "a plan whose code sample quotes a different fence marker",
    restamp(
      mut(base, "### first-slug:", "```text\n~~~\n## Not a real section\n- not a real bullet\n~~~\n```\n\n### first-slug:"),
      planFile,
    ),
  );

  // sections
  fail("a missing Conflicts section", mut(base, "## Conflicts", "## Something else"), "missing required section `## Conflicts`");
  fail("a missing Migration path section", mut(base, "## Migration path", "## Notes"), "missing required section `## Migration path`");

  // plain-language intros
  fail(
    "a section opening with a list",
    mut(base, /## Backward compatibility\n\nThis section says[\s\S]*?- Behaviour today/, "## Backward compatibility\n\n- Behaviour today"),
    "does not open with a plain-language paragraph",
  );
  fail(
    "a sub-issue opening with a bold label",
    mut(base, /### second-slug: <sub-issue title>\n\nIn plain terms[\s\S]*?after\nit\./, "### second-slug: <sub-issue title>\n\n**Scope:** build the thing."),
    "does not open with a plain-language paragraph",
  );

  // dependency graph
  fail("an edge no sub-issue declares", mut(base, "- first-slug -> second-slug\n", "- second-slug -> first-slug\n"), "which no sub-issue declares");
  fail(
    "a dependency cycle",
    mut(mut(base, "- **Depends on:** none", "- **Depends on:** second-slug"), "- first-slug -> second-slug\n", "- first-slug -> second-slug\n- second-slug -> first-slug\n"),
    "has a cycle",
  );

  // owner questions
  fail(
    "an owner question missing the user-impact part",
    mut(base, /- \*\*Why a user cares:\*\*[\s\S]*?\n- \*\*Impact/, "\n- **Impact"),
    "is missing its **why a user cares** part",
  );

  // conflicts + the ledger cross-check
  const withLedger = restamp(filledTemplate({ total: 128, limit: 500 }), planFile);
  fail("a `None found` claim with no items-examined count", mut(base, /None found\. Items examined: \d+ \(see the project ledger below\)\./, "None found."), "without recording how many project items were examined");
  fail("a no-conflict claim contradicting the ledger", restamp(mut(withLedger, /Items examined: \d+/, "Items examined: 12"), planFile), "does not match the read");
  pass("a no-conflict claim matching the ledger", withLedger);

  // the anti-truncation ledger
  fail(
    "a truncated project read (the default page size cut it off)",
    restamp(mut(mut(filledTemplate(), "- Items read: 643", "- Items read: 100"), "- Fetch limit used: 1000", "- Fetch limit used: 100"), planFile),
    "TRUNCATED",
  );
  fail(
    "a fetch limit that cannot prove the read reached the end",
    restamp(filledTemplate({ total: 120, limit: 120 }), planFile),
    "cannot prove the read reached the end",
  );
  fail("a read that skipped closed items", mut(base, "- States included: open + closed", "- States included: open"), "must cover open AND closed items");
  fail("a read that ignored closed decisions", mut(base, "- Closed items read as decisions: yes", "- Closed items read as decisions: no"), "must be `yes`");

  // compatibility / migration
  fail(
    "an unexplained no-migration claim",
    mut(base, "- Rationale: <why nothing needs migrating, or the ordered steps that do>", "No migration required."),
    "without an explicit `Rationale:`",
  );

  // routing
  fail("a dispatch with no effort", mut(base, "- Codebase research lane — model: opus, effort: high", "- Codebase research lane — model: opus"), "does not name both");
  fail(
    "a top-level dispatch off the pin",
    mut(base, "(top-level) — model: fable, effort: max", "(top-level) — model: sonnet, effort: low"),
    "orchestration is pinned to",
  );
  fail("a trace with no top-level dispatch", mut(base, " (top-level)", ""), "marks no `(top-level)` dispatch");

  // convergence provenance
  fail("a writable convergence sandbox", mut(base, "- Sandbox: read-only", "- Sandbox: workspace-write"), "must record `read-only`");
  fail("an unbounded round count", mut(base, "- Rounds: 1", "- Rounds: 7"), "must be between 1 and");

  const verdict = `[codex-bridge] codex exec model=<pinned> model_reasoning_effort=max sandbox=read-only cwd=/checkout/target-repo

## Independent code evidence

I grepped the checkout myself: scripts/check-epic-plan.mjs computes the approval
digest over everything above the Approval heading, and commands/epic-plan.md runs
the gate before presenting.

## Contradicted claims

None.

## Verdict

The plan matches the code.
`;
  const planWithRun = restamp(
    mut(
      mut(base, "- Working directory: <absolute path to the target repository checkout>", "- Working directory: /checkout/target-repo"),
      "- Verdict capture: <path to the captured verdict>",
      "- Verdict capture: /captures/verdict.txt",
    ),
    planFile,
  );
  pass("a verdict with header provenance and independent evidence", planWithRun, { verdict, verdictPath: "/captures/verdict.txt" });
  fail("a verdict with no independent-code-evidence section", planWithRun, "Independent code evidence", { verdict: mut(verdict, "## Independent code evidence", "## Notes"), verdictPath: "/captures/verdict.txt" });
  fail("a verdict whose evidence cites no repository path", planWithRun, "cites no repo-relative path", { verdict: mut(verdict, /I grepped[\s\S]*?gate before presenting\./, "The plan looks fine to me."), verdictPath: "/captures/verdict.txt" });
  fail("a verdict that ran somewhere else", planWithRun, "does not describe this run", { verdict: mut(verdict, "cwd=/checkout/target-repo", "cwd=/somewhere/else"), verdictPath: "/captures/verdict.txt" });
  fail("a capture with no bridge header", planWithRun, "no `[codex-bridge]` header", { verdict: verdict.split("\n").slice(1).join("\n"), verdictPath: "/captures/verdict.txt" });
  fail("a capture the record does not point at", planWithRun, "the record must point at the verdict actually produced", { verdict, verdictPath: "/captures/other-verdict.txt" });
  fail(
    "a verdict that never says what it could not confirm",
    planWithRun,
    "Contradicted claims",
    { verdict: mut(verdict, "## Contradicted claims\n\nNone.\n\n", ""), verdictPath: "/captures/verdict.txt" },
  );
  fail(
    "a plan claim the round's own code evidence refutes",
    planWithRun,
    "CONTRADICTS the plan",
    {
      verdict: mut(
        verdict,
        "## Contradicted claims\n\nNone.",
        "## Contradicted claims\n\n- The plan says nothing in the pack enforces the structure; scripts/check-epic-plan.mjs does.",
      ),
      verdictPath: "/captures/verdict.txt",
    },
  );

  // an indented block is code, not a plain-language intro
  fail(
    "a section whose intro is an indented code block",
    mut(base, /## Migration path\n\nThis section says[\s\S]*?carries its reason\./, "## Migration path\n\n    migrate --all # this line is code, and code is not a plain-language intro at all"),
    "indented code block",
  );

  // the ledger takes numbers, and zero is a number
  fail("a ledger count with trailing garbage", mut(base, "- Total items reported: 643", "- Total items reported: 643items"), "does not record a numeric");
  pass("a brand-new project with no items at all", restamp(filledTemplate({ total: 0, limit: 1 }), planFile));

  // an edge bullet the gate cannot parse end to end
  fail(
    "a dependency edge with trailing text",
    mut(base, "- first-slug -> second-slug\n", "- first-slug -> second-slug and also third-slug\n"),
    "is not a `<slug> -> <slug>` edge",
  );

  // verdict provenance: the header values must END where they claim to
  fail("a near-miss sandbox value", planWithRun, "sandbox=read-only", { verdict: mut(verdict, "sandbox=read-only ", "sandbox=read-onlyish "), verdictPath: "/captures/verdict.txt" });
  fail(
    "a header with no model or effort",
    planWithRun,
    "reasoning_effort=",
    { verdict: mut(verdict, "model=<pinned> model_reasoning_effort=max ", ""), verdictPath: "/captures/verdict.txt" },
  );
  fail(
    "a contradiction dressed up as a clean bill of health",
    planWithRun,
    "CONTRADICTS the plan",
    { verdict: mut(verdict, "## Contradicted claims\n\nNone.", "## Contradicted claims\n\nNone of the plan's claims were confirmed; several are false."), verdictPath: "/captures/verdict.txt" },
  );

  // approval binding
  fail(
    "a section appended after the approval",
    restamp(`${base}\n## Scope override\n\nThis extra section sits below the approval, which is exactly where an unapproved\nclause would hide if the digest stopped at the approval heading.\n\n- Anything: at all\n`, planFile),
    "must be the LAST section",
  );
  fail(
    "a hard break added to an approved plan (trailing whitespace is content)",
    mut(approve(base), "- Sandbox: read-only", "- Sandbox: read-only  "),
    "the approval is STALE",
  );
  fail(
    "a sentence added to the approval's own intro after approval",
    mut(approve(base), "approval and needs a fresh convergence round.", "approval and needs a fresh convergence round. Also create an unplanned sixth sub-issue."),
    "the approval is STALE",
  );
  fail(
    "a repeated approval field",
    mut(base, "- Pre-approval writes: none\n", "- Pre-approval writes: none\n- Status: also create an unplanned sixth sub-issue\n"),
    "twice",
  );
  fail(
    "an extra field glued to the approval intro with no blank line",
    mut(base, "approval and needs a fresh convergence round.\n", "approval and needs a fresh convergence round.\n- Scope override: also create a sixth sub-issue\n"),
    "unrecognized field",
  );
  fail(
    "an extra field parked in the approval section",
    mut(base, "- Pre-approval writes: none\n", "- Pre-approval writes: none\n- Scope override: also create a sixth sub-issue\n"),
    "unrecognized field",
  );
  fail(
    "a decoy token in the verdict header",
    planWithRun,
    "sandbox=read-only",
    { verdict: mut(verdict, "sandbox=read-only ", "sandbox=workspace-write decoy_sandbox=read-only "), verdictPath: "/captures/verdict.txt" },
  );
  fail(
    "an intro indented to four COLUMNS by a space and a tab",
    mut(base, /## Migration path\n\nThis section says[\s\S]*?carries its reason\./, "## Migration path\n\n \tmigrate --all # a space and a tab reach column four, so this is code too."),
    "indented code block",
  );
  fail(
    "prose smuggled into the approval section",
    mut(base, "- Pre-approval writes: none\n", "- Pre-approval writes: none\n\nAlso, the epic may quietly grow a sixth sub-issue after this line.\n"),
    "sits outside the approved revision",
  );
  fail("a plan with no revision line at all", mut(base, /- Plan revision: sha256:[0-9a-f]{64}\n/, ""), "run the gate with --stamp");
  fail("an unstamped plan (the placeholder digest)", filledTemplate(), "does not match this document");
  fail("a plan edited after stamping", mut(base, "Target repository: <owner/repo>", "Target repository: <another repo>"), "changed after it was stamped");
  fail("an unapproved plan at stage create", base, "the plan is not approved", { stage: "create" });

  const approved = approve(base);
  pass("an approved plan at stage create", approved, { stage: "create" });
  fail("an approval carried across an edit", mut(approved, "- Rounds: 1", "- Rounds: 2"), "the approval is STALE");
  fail(
    "an approved plan whose pre-approval writes are unrecorded",
    mut(approved, "- Pre-approval writes: none", "- Pre-approval writes: two comments"),
    "must record `none`",
    { stage: "create" },
  );

  const conflicted = conflictPlan(base, planFile);
  pass("a PENDING conflict ruling at stage present (it must be shown, not hidden)", conflicted);
  fail("an approved plan with a PENDING conflict ruling at stage create", approve(conflicted), "conflict ruling(s) still PENDING", { stage: "create" });

  const pendingDecision = restamp(mut(base, /- \*\*Decision:\*\* native parent\/sub-issue nesting[\s\S]*?unavailable\./, "- **Decision:** PENDING"), planFile);
  fail("an approved plan with a PENDING owner decision at stage create", approve(pendingDecision), "owner question(s) still PENDING", { stage: "create" });

  console.log(
    "SELFTEST OK — the gate refuses a missing section, a list-first, label-first or indented-code intro, an inconsistent,\n" +
    "unparseable or cyclic dependency graph, an incomplete owner question, an unevidenced or contradicted no-conflict\n" +
    "claim, a non-numeric ledger count, a truncated or open-only project read, an unexplained no-migration claim, an\n" +
    "unrouted or off-pin dispatch, a convergence round that is writable, unattributable, unevidenced, misattributed or\n" +
    "hiding a refuted claim, an unstamped plan, an approval carried across an edit, a section or prose smuggled past the\n" +
    "approval, and a create stage with unresolved rulings, unresolved decisions or unrecorded pre-approval writes; and it\n" +
    "accepts a genuinely empty project and a code sample that quotes another fence marker.",
  );
  done(0);
}

// --- cli ---------------------------------------------------------------------

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--selftest")) selftest();
  if (args.includes("--template")) {
    process.stdout.write(template());
    process.exit(0);
  }
  const valueOf = (flag) => {
    const i = args.indexOf(flag);
    return i === -1 ? null : args[i + 1] ?? null;
  };
  const stampFile = valueOf("--stamp");
  if (stampFile) {
    const digest = stamp(stampFile);
    console.log(`stamped ${stampFile} with plan revision sha256:${digest}`);
    process.exit(0);
  }
  const planFile = valueOf("--plan");
  if (!planFile) {
    console.error("usage: check-epic-plan.mjs --plan <plan.md> [--verdict <capture>] [--stage present|create] | --template | --stamp <plan.md> | --selftest");
    process.exit(2);
  }
  const stage = valueOf("--stage") ?? "present";
  if (!STAGES.has(stage)) {
    console.error(`unknown --stage '${stage}' (expected: ${[...STAGES].join(" | ")})`);
    process.exit(2);
  }
  let text;
  try {
    text = readFileSync(planFile, "utf8");
  } catch (err) {
    console.error(`cannot read plan '${planFile}': ${err.message}`);
    process.exit(2);
  }
  const verdictFile = valueOf("--verdict");
  let verdict = null;
  if (verdictFile) {
    try {
      verdict = readFileSync(verdictFile, "utf8");
    } catch (err) {
      console.error(`cannot read verdict capture '${verdictFile}': ${err.message}`);
      process.exit(2);
    }
  }
  const { errors, info } = checkPlan(text, { stage, verdict, verdictPath: verdictFile });
  if (errors.length) {
    console.error(`\nepic-plan gate REFUSED at stage '${stage}' (${errors.length} finding${errors.length === 1 ? "" : "s"}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `epic-plan gate OK at stage '${stage}' — ${info.subIssues} sub-issue(s), ${info.edges} dependency edge(s), ` +
    `${info.itemsRead ?? "?"} project item(s) read, revision sha256:${info.revision.slice(0, 12)}…` +
    (info.approved ? " (approved)" : " (not yet approved)"),
  );
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith("check-epic-plan.mjs")) main(process.argv);

export { planRevision, template as planTemplate, REQUIRED_SECTIONS };
