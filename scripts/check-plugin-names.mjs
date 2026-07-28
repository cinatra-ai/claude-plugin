#!/usr/bin/env node
// check-plugin-names.mjs — the plugin naming gate for this pack.
//
// WHY THIS EXISTS
// The plugin is named `cinatra`, so Claude Code already namespaces everything
// this pack ships: a command reads `/cinatra:<command>` and a skill resolves as
// its bare name. Repeating the prefix inside an entry's own name would render
// as `/cinatra:cinatra-doctor`. And because a Cinatra install can carry more
// than one pack under that one `cinatra` namespace, a name used twice is
// ambiguous at the `/cinatra:` prompt — so names must also be unique.
//
// WHAT IT CHECKS, derived from the authoritative frontmatter (never a hardcoded
// list) — every `commands/*.md` `name:` and every `skills/<dir>/SKILL.md`
// `name:`:
//   1. no `cinatra-` prefix on a command or skill name;
//   2. the frontmatter `name:` equals the file/directory basename, so the
//      on-disk layout and the advertised name cannot drift apart (this also
//      makes the layout a faithful stand-in for the advertised names when
//      another pack reads this one's surface remotely);
//   3. no name is used twice WITHIN a kind (two commands, or two skills, named
//      the same). A command and a skill sharing one name is the sanctioned thin
//      WRAPPER pattern — `/setup` fronting the picker-hidden `setup` skill — so
//      it is reported as a wrapper pair, not a failure. The pair contributes a
//      single name to this pack's normalized union.
//
// Fail-closed: an entry whose frontmatter cannot be parsed is an ERROR, not a
// skip, and an empty surface exits non-zero rather than passing vacuously.
//
// USAGE
//   node scripts/check-plugin-names.mjs             # check this pack
//   node scripts/check-plugin-names.mjs --list      # + print the final name sets
//   node scripts/check-plugin-names.mjs --selftest  # prove the gate fails a synthetic violation
//
// Exit 0 = pass, 1 = a naming violation, 2 = the check could not run.

import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREFIX = "cinatra-";

const args = new Set(process.argv.slice(2));

/** Strip YAML quoting / a trailing unquoted comment from a scalar value. */
function unquote(raw) {
  const v = raw.trim();
  const q = v[0];
  if (q === '"' || q === "'") {
    const close = v.indexOf(q, 1);
    return close === -1 ? v.slice(1) : v.slice(1, close);
  }
  return v.replace(/\s+#.*$/, "").trim();
}

/**
 * Read the top-level `name:` out of a markdown file's YAML frontmatter.
 * Delimiter-strict: the FIRST line must be exactly `---` and the block must be
 * terminated by a line that is exactly `---` (or `...`). Anything else — a
 * `----` rule, an unterminated block, an indented `name:` nested under another
 * key — yields null, which callers treat as an error.
 */
function frontmatterName(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "---" || t === "...") { end = i; break; }
  }
  if (end === -1) return null;
  for (let i = 1; i < end; i++) {
    const m = /^name:[ \t]*(.*)$/.exec(lines[i]);
    if (m) {
      const v = unquote(m[1]);
      return v === "" ? null : v;
    }
  }
  return null;
}

const normalize = (n) => String(n).trim().toLowerCase();

function readSurface(root) {
  const entries = [];
  const cmdDir = join(root, "commands");
  if (existsSync(cmdDir)) {
    for (const f of readdirSync(cmdDir).sort()) {
      if (!f.endsWith(".md")) continue;
      entries.push({ kind: "command", basename: basename(f, ".md"), name: frontmatterName(join(cmdDir, f)), file: `commands/${f}` });
    }
  }
  const skillDir = join(root, "skills");
  if (existsSync(skillDir)) {
    for (const d of readdirSync(skillDir).sort()) {
      if (!statSync(join(skillDir, d)).isDirectory()) continue;
      const file = join(skillDir, d, "SKILL.md");
      if (!existsSync(file)) continue;
      entries.push({ kind: "skill", basename: d, name: frontmatterName(file), file: `skills/${d}/SKILL.md` });
    }
  }
  return entries;
}

/**
 * The three rules. Returns { union, wrappers } — `union` is the normalized
 * name -> first-declaring-file map (a wrapper pair contributes one entry).
 */
function check(entries, sink) {
  const perKind = { command: new Map(), skill: new Map() };
  const union = new Map();
  const wrappers = [];
  for (const e of entries) {
    if (!e.name) {
      sink.push(`${e.file} has no parseable top-level \`name:\` in its YAML frontmatter — the advertised name is unverifiable`);
      continue;
    }
    if (normalize(e.name).startsWith(PREFIX)) {
      sink.push(`${e.file} is named \`${e.name}\` — drop the redundant \`${PREFIX}\` prefix (the plugin name already supplies it; this would read /cinatra:${e.name})`);
    }
    if (e.name !== e.basename) {
      sink.push(`${e.file} advertises \`name: ${e.name}\` but its ${e.kind === "command" ? "filename" : "directory"} is \`${e.basename}\` — they must match`);
    }
    const key = normalize(e.name);
    const kindMap = perKind[e.kind];
    if (kindMap.has(key)) {
      sink.push(`two ${e.kind}s are named \`${e.name}\` (${kindMap.get(key)} and ${e.file}) — \`/cinatra:${e.name}\` would be ambiguous`);
    } else {
      kindMap.set(key, e.file);
    }
    if (union.has(key)) wrappers.push(`${e.name} (${union.get(key)} + ${e.file})`);
    else union.set(key, e.file);
  }
  return { union, wrappers };
}

function selftest() {
  const cases = [
    { label: "prefixed name", entries: [{ kind: "skill", basename: "cinatra-doctor", name: "cinatra-doctor", file: "skills/cinatra-doctor/SKILL.md" }], expect: "drop the redundant" },
    { label: "name/basename drift", entries: [{ kind: "command", basename: "doctor", name: "diagnose", file: "commands/doctor.md" }], expect: "must match" },
    { label: "two commands sharing a name", entries: [
      { kind: "command", basename: "doctor", name: "doctor", file: "commands/doctor.md" },
      { kind: "command", basename: "check", name: "doctor", file: "commands/check.md" },
    ], expect: "two commands are named" },
    { label: "unparseable name", entries: [{ kind: "skill", basename: "setup", name: null, file: "skills/setup/SKILL.md" }], expect: "no parseable top-level" },
  ];
  for (const c of cases) {
    const sink = [];
    check(c.entries, sink);
    if (!sink.some((m) => m.includes(c.expect))) {
      console.error(`SELFTEST FAILED: ${c.label} was not reported`);
      process.exit(1);
    }
  }
  const clean = [];
  const { union, wrappers } = check([
    { kind: "command", basename: "setup", name: "setup", file: "commands/setup.md" },
    { kind: "skill", basename: "setup", name: "setup", file: "skills/setup/SKILL.md" },
    { kind: "skill", basename: "grounding", name: "grounding", file: "skills/grounding/SKILL.md" },
  ], clean);
  if (clean.length !== 0) {
    console.error(`SELFTEST FAILED: a clean surface was reported as violating (${clean.join("; ")})`);
    process.exit(1);
  }
  if (wrappers.length !== 1 || union.size !== 2) {
    console.error(`SELFTEST FAILED: a command/skill wrapper pair must collapse to ONE union name (got ${union.size} names, ${wrappers.length} pairs)`);
    process.exit(1);
  }

  // Frontmatter parser: delimiter-strict, quote-aware, comment-aware.
  const dir = mkdtempSync(join(tmpdir(), "plugin-names-selftest-"));
  const parse = (body) => {
    const f = join(dir, "SKILL.md");
    writeFileSync(f, body);
    return frontmatterName(f);
  };
  const parserCases = [
    ["plain", "---\nname: doctor\n---\nbody\n", "doctor"],
    ["trailing comment", "---\nname: doctor # the machine check\n---\n", "doctor"],
    ["double quoted", '---\nname: "doctor"\n---\n', "doctor"],
    ["single quoted", "---\nname: 'doctor'\n---\n", "doctor"],
    ["quoted hash kept", '---\nname: "doc # tor"\n---\n', "doc # tor"],
    ["crlf", "---\r\nname: doctor\r\n---\r\n", "doctor"],
    ["dot terminator", "---\nname: doctor\n...\n", "doctor"],
    ["four-dash opener rejected", "----\nname: doctor\n----\n", null],
    ["unterminated rejected", "---\nname: doctor\n", null],
    ["no frontmatter rejected", "# doctor\n", null],
    ["indented key ignored", "---\nmeta:\n  name: doctor\n---\n", null],
    ["empty value rejected", "---\nname:\n---\n", null],
  ];
  for (const [label, body, want] of parserCases) {
    const got = parse(body);
    if (got !== want) {
      rmSync(dir, { recursive: true, force: true });
      console.error(`SELFTEST FAILED: frontmatter parser "${label}" -> ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
      process.exit(1);
    }
  }

  // Vacuity: an empty pack must NOT pass.
  const emptyRoot = join(dir, "empty-pack");
  mkdirSync(join(emptyRoot, "commands"), { recursive: true });
  mkdirSync(join(emptyRoot, "skills"), { recursive: true });
  const emptySurface = readSurface(emptyRoot);
  rmSync(dir, { recursive: true, force: true });
  if (emptySurface.length !== 0) {
    console.error("SELFTEST FAILED: an empty pack produced entries");
    process.exit(1);
  }

  console.log("SELFTEST OK — the gate fails a prefixed name, a basename drift, a same-kind duplicate and an unparseable name; the frontmatter parser is delimiter/quote/comment-strict; a wrapper pair collapses to one union name; an empty surface yields no entries (and exits 2 below)");
  process.exit(0);
}

if (args.has("--selftest")) selftest();

const entries = readSurface(ROOT);
if (entries.length === 0) {
  console.error("no commands/*.md or skills/<dir>/SKILL.md entries found — refusing to pass vacuously");
  process.exit(2);
}

const errors = [];
const { union, wrappers } = check(entries, errors);

if (args.has("--list")) {
  const of = (kind) => entries.filter((e) => e.kind === kind).map((e) => e.name || `(unparseable: ${e.file})`).sort();
  console.log(`commands (${of("command").length}):\n  ${of("command").join("\n  ")}`);
  console.log(`skills (${of("skill").length}):\n  ${of("skill").join("\n  ")}`);
  console.log(`normalized union (${union.size}):\n  ${[...union.keys()].sort().join("\n  ")}`);
}

if (wrappers.length) console.log(`note: ${wrappers.length} command/skill wrapper pair(s): ${wrappers.join(", ")}`);

if (errors.length) {
  console.error(`\nplugin-naming gate FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`plugin-naming gate OK — ${entries.length} entries, ${union.size} distinct names, none prefixed`);
