#!/usr/bin/env node
// scripts/check-artifact-ui-contradictions.mjs
//
// CORPUS CONTRADICTION GATE for the artifact-UI boundary in the AUTHORING PACK
// (cinatra#1627, epic cinatra#1620 "artifact extensions own their UI", S10 AC5).
//
// Epic #1620 flipped the artifact extension boundary: an artifact extension is
// DECLARATIVE BY DEFAULT but MAY ship its own `detail`/`preview` view through
// the versioned `cinatra.artifact.ui` block (S1/S2 landed). This pack's skills
// and commands used to teach the SUPERSEDED boundary in absolutes — "metadata-
// only … no runtime code", the pdf/html anti-triggers, connector as the sole
// "code-bearing kind", and an unpinned `shadcn@latest` CLI. They were rewritten
// in this wave; this gate keeps them rewritten. cinatra#1623 (S5) extended the
// epic: the design registry became EXTENSIBLE by extensions (`registryItems`),
// so the "host-only / not extensible / no extension can contribute an item"
// absolutes are retired too and enumerated here beside the boundary claims.
//
// FAIL-CLOSED: if any retired claim is reintroduced in the pack's Markdown
// corpus (skills/**/SKILL.md, commands/*.md, README.md, …), the gate reds and
// names the file, line, and fix. The contradiction cannot reopen without a
// reviewer either fixing the wording or adding an explicit, dated allowlist
// entry.
//
// Design notes:
//   - Scans by LOGICAL LINE: consecutive plain-prose physical lines are merged
//     (whitespace normalized) so a wrapped claim is still caught, while
//     structural lines (list items, table rows, headings, blockquotes,
//     code-fence content) are NEVER merged — no adjacent-bullet false positives.
//   - Each ARTIFACT-scoped pattern needs an `artifact` anchor within a short
//     window (a bare "no runtime code" is legitimate for the agent/skill kinds,
//     which ship none); the distinctive retired phrases are matched literally.
//   - `--selftest` (also run first on every invocation) pins the known retired
//     claims (incl. wrapped) + the rewritten/legitimate sentences, so a later
//     regex weakening reds CI instead of passing silently.
//   - The dated allowlist covers verified false positives; a live entry that
//     stops matching (stale) FAILS the gate, so it can never pre-suppress a
//     byte-identical reintroduction.
//
// Usage:
//   node scripts/check-artifact-ui-contradictions.mjs [--allowlist <path>] [--now <ISO-date>] [--selftest]

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const DEFAULT_ALLOWLIST_PATH = ".github/artifact-ui-contradiction-allowlist.json";

const PATTERNS = [
  [
    "artifact_metadata_only",
    /\bartifact\b[^\n]{0,40}\bmetadata[- ]only\b/i,
    'artifact extension described as "metadata-only"',
    'Artifact extensions are DECLARATIVE BY DEFAULT and may ship a `cinatra.artifact.ui` renderer (epic #1620). Reword to "declarative by default".',
  ],
  [
    "metadata_only_artifact",
    /\bmetadata[- ]only\b[^\n]{0,30}\bartifact\b/i,
    '"metadata-only" applied to an artifact extension (reverse order)',
    'Superseded — reword to "declarative-by-default artifact extension that may ship a `cinatra.artifact.ui` renderer".',
  ],
  [
    "metadata_only_descriptor",
    /\bmetadata[- ]only[ \t]+(descriptors?|content[- ]?types?)\b/i,
    'artifact described as a "metadata-only descriptor / content-type"',
    'Superseded — reword to "declarative-by-default content-TYPE definition that may ship a `cinatra.artifact.ui` renderer".',
  ],
  [
    "artifact_no_runtime_code",
    /\bartifact\b[^\n]{0,60}\bno runtime code\b/i,
    'artifact extension described as having "no runtime code"',
    "An artifact extension may ship a port-less RSC renderer; drop the absolute for artifacts (v1 renderers request no host ports).",
  ],
  [
    "no_runtime_code_artifact",
    /\bno runtime code\b[^\n]{0,40}\bartifact\b/i,
    '"no runtime code" asserted of an artifact extension',
    "An artifact extension may ship a port-less RSC renderer; drop the absolute for artifacts.",
  ],
  [
    "artifact_cannot_contain_executable",
    /\bartifact\b[^\n]{0,50}\b(cannot|must not|may not|never)\b[^\n]{0,25}\b(contain|carry|ship|include|have)\b[^\n]{0,25}\bexecutable\b/i,
    "artifact extension said to be unable to contain/carry executable code",
    "An artifact extension may ship a port-less executable RSC renderer via `cinatra.artifact.ui`; drop the absolute.",
  ],
  [
    "must_not_carry_executable_host_code",
    /must not carry executable host code/i,
    '"MUST NOT carry executable host code" (superseded artifact boundary)',
    "Superseded — artifacts may ship a port-less `cinatra.artifact.ui` detail/preview renderer.",
  ],
  [
    "connector_sole_code_bearing_kind",
    /\bcode[- ]bearing kind\b/i,
    'connector framed as the "code-bearing kind"',
    "Connector is not the sole code-bearing kind — an artifact extension ships a port-less RSC renderer. Reword to the still-true claim (connector is the one kind with a privileged `register(ctx)` server entry).",
  ],
  [
    "unpinned_shadcn_latest",
    /shadcn@latest/i,
    "unpinned `shadcn@latest` CLI",
    "Pin the shadcn CLI (`shadcn@4.8.2`) — the pinned version is a supply-chain contract shared with the `@cinatra-ai` design registry; `@latest` can drift from the committed registry.",
  ],
  // cinatra#1623 (epic #1620 S5): the design registry became EXTENSIBLE by
  // extensions (`cinatra.artifact.ui.registryItems`, published under a vendor
  // `@<namespace>/<slug>-<component>` identity to an append-only host). The
  // retired absolutes said the opposite — the registry was host-only / not
  // extensible / no extension could contribute an item. Each pattern needs a
  // `registr` anchor so a bare "no extension can …" elsewhere never trips it.
  [
    "registry_not_extensible",
    /\bregistr(?:y|ies)\b[^\n]{0,15}\b(?:is|are|isn['’]?t|aren['’]?t|remains?|stays?|becomes?|was|were)\b[^\n]{0,15}\b(?:not extensible|closed to extension|host[- ]only|host[- ]authored only|not open to extension)\b/i,
    "the shadcn design registry described as not-extensible / host-only",
    "Superseded by cinatra#1623 (S5): extensions declare their own `cinatra.artifact.ui.registryItems`, served from the append-only registry host. Reword to the extensible-registry reality.",
  ],
  [
    "only_host_authors_registry",
    /\bonly (?:the )?(?:host|cinatra|core)\b[^\n]{0,25}\b(?:authors?|publish(?:es)?|contributes?|populates?|owns?)\b[^\n]{0,25}\bregistr/i,
    'registry items framed as authored "only by the host"',
    "Superseded by cinatra#1623 (S5): an extension contributes registry items under its vendor namespace. Drop the \"only the host\" absolute.",
  ],
  [
    "extension_cannot_contribute_registry",
    /(?:\bno\b[^\n]{0,15}\bextensions?\b[^\n]{0,15}\b(?:can|could|may)\b|\bextensions?\b[^\n]{0,20}\b(?:cannot|can['’]?t|may not|could not|is unable to|are unable to|never)\b)[^\n]{0,25}\b(?:contribute|publish|declare|add|author|ship|extend)\b[^\n]{0,30}\bregistr/i,
    "an extension said to be unable to contribute registry items",
    "Superseded by cinatra#1623 (S5): an extension declares presentational `registryItems` published under its vendor namespace. Drop the absolute.",
  ],
];

const KNOWN_PATTERN_IDS = new Set(PATTERNS.map(([id]) => id));

const SELFTEST_MUST_MATCH = [
  "Author a cinatra ARTIFACT extension — a metadata-only content-TYPE definition",
  "artifact extensions are metadata-only descriptors",
  '`kind:"artifact"` extensions are **metadata-only**',
  "this is a metadata-only artifact extension",
  "There is no runtime code and the artifact ships only a typed mirror",
  "artifact packages cannot contain executable components",
  "They MUST NOT carry executable host code paths beyond the descriptor",
  "connector is the only code-bearing kind",
  "pnpm dlx shadcn@latest add button",
  // wrapped across a soft line break:
  "an artifact extension is a\nmetadata-only descriptor",
  "an artifact extension has\nno runtime code today.",
  // wrapped inside a single list item (indented + lazy continuation):
  "- An artifact extension is a\n  metadata-only descriptor.",
  "- An artifact extension is a\nmetadata-only descriptor.",
  // wrapped across consecutive blockquote lines:
  "> An artifact extension is a\n> metadata-only descriptor",
  // cinatra#1623 (S5): the retired registry-extensibility absolutes.
  "the design registry is not extensible",
  "the `@cinatra-ai` registry is host-only",
  "registry items are host-authored only",
  "only the host authors registry items",
  "no extension can contribute a registry item",
  "an artifact extension cannot publish registry items",
];
const SELFTEST_MUST_NOT_MATCH = [
  "An artifact extension is declarative by default and may ship a cinatra.artifact.ui renderer.",
  "an agent ships no runtime code surface",
  "no `src/`, no sidecars, no runtime code — this kind is content-only.",
  "a declarative-only artifact ships no renderer, so most boundary rules are moot",
  "pnpm dlx shadcn@4.8.2 add button",
  "the one executable surface an artifact extension carries is a port-less renderer",
  // adjacent list bullets must NOT merge into a false positive:
  "- an artifact type bullet\n- a metadata-only unrelated bullet",
  // cinatra#1623 (S5): the NEW extensible-registry reality + legitimate
  // registry sentences must stay clean.
  "an extension declares its own registryItems, served from the append-only registry host.",
  "an extension can contribute a registry item under its vendor namespace.",
  "if no usable public key is configured, no extension can reach the signed-trust state.",
  "the 14 host-authored generic primitives are built from registry.json.",
  "Consumption is dev/build-time only — the app never fetches the registry at runtime.",
];

// --- logical-line reflow ---------------------------------------------------
// Group each block's wrapped lines into ONE logical line: a list item and its
// continuation lines (indented or lazy), consecutive blockquote lines, and
// consecutive prose lines all merge (whitespace normalized) — so a claim
// wrapped across a soft break is caught. A NEW block start (blank line, another
// list bullet, heading, table row, code fence) closes the current logical line,
// so two adjacent-but-unrelated bullets never collide into a false positive.
function toLogicalLines(content) {
  const lines = content.split("\n");
  const logical = [];
  let cur = null; // { parts: [], startLine, kind: 'prose' | 'list' | 'quote' }
  let inFence = false;
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const flush = () => {
    if (cur) {
      logical.push({ text: cur.parts.join(" ").replace(/\s+/g, " ").trim(), startLine: cur.startLine });
      cur = null;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      logical.push({ text: line.trim(), startLine: lineNo });
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      logical.push({ text: norm(line), startLine: lineNo });
      continue;
    }
    if (/^\s*$/.test(line)) {
      flush(); // blank line ends the current block
      continue;
    }
    if (/^\s*#/.test(line) || /^\s*\|/.test(line)) {
      flush();
      logical.push({ text: norm(line), startLine: lineNo });
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s/.test(line)) {
      flush();
      cur = { parts: [norm(line)], startLine: lineNo, kind: "list" };
      continue;
    }
    if (/^\s*>/.test(line)) {
      const stripped = norm(line.replace(/^\s*>\s?/, ""));
      if (cur && cur.kind === "quote") cur.parts.push(stripped);
      else {
        flush();
        cur = { parts: [stripped], startLine: lineNo, kind: "quote" };
      }
      continue;
    }
    if (cur) cur.parts.push(norm(line));
    else cur = { parts: [norm(line)], startLine: lineNo, kind: "prose" };
  }
  flush();
  return logical;
}

function scanText(content) {
  const found = [];
  for (const { text, startLine } of toLogicalLines(content)) {
    for (const [id, regex, description, fix] of PATTERNS) {
      if (new RegExp(regex.source, regex.flags).test(text)) {
        found.push({ line: startLine, id, description, fix, lineText: text });
      }
    }
  }
  return found;
}

function runSelfTest() {
  const failures = [];
  for (const s of SELFTEST_MUST_MATCH) {
    if (scanText(s).length === 0) failures.push(`MUST match but did NOT: ${JSON.stringify(s)}`);
  }
  for (const s of SELFTEST_MUST_NOT_MATCH) {
    if (scanText(s).length > 0) failures.push(`MUST NOT match but DID: ${JSON.stringify(s)}`);
  }
  if (failures.length > 0) {
    console.error(`[artifact-ui-contradiction-gate] SELF-TEST FAILED — the patterns no longer behave as pinned:`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error(`A retired claim must stay caught and a rewritten claim must stay clean. Fix the patterns.`);
    process.exitCode = 1;
    return false;
  }
  console.log(
    `[artifact-ui-contradiction-gate] SELF-TEST OK — ${SELFTEST_MUST_MATCH.length} retired claims caught ` +
      `(incl. wrapped), ${SELFTEST_MUST_NOT_MATCH.length} rewritten/legitimate sentences pass clean.`
  );
  return true;
}

function parseArgs(argv) {
  const out = { allowlist: DEFAULT_ALLOWLIST_PATH, now: new Date(), selftestOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--allowlist") out.allowlist = argv[++i];
    if (argv[i] === "--now") out.now = new Date(argv[++i]);
    if (argv[i] === "--selftest") out.selftestOnly = true;
  }
  return out;
}

function loadAllowlist(path, now) {
  let raw;
  try {
    raw = readFileSync(join(REPO_ROOT, path), "utf8");
  } catch {
    return { live: [], expired: [] };
  }
  const parsed = JSON.parse(raw);
  const entries = parsed?.entries;
  if (!Array.isArray(entries)) throw new Error(`${path} must be a JSON object with an "entries" array`);
  const live = [];
  const expired = [];
  for (const entry of entries) {
    for (const key of ["file", "pattern", "snippet", "owner", "reviewBy", "note"]) {
      if (!entry[key]) {
        throw new Error(`${path}: allowlist entry missing "${key}": ${JSON.stringify(entry)}`);
      }
    }
    if (!KNOWN_PATTERN_IDS.has(entry.pattern)) {
      throw new Error(
        `${path}: entry for ${entry.file} names unknown pattern "${entry.pattern}" ` +
          `(known: ${[...KNOWN_PATTERN_IDS].join(", ")}) — a stale id can never suppress the right thing.`
      );
    }
    const reviewBy = new Date(entry.reviewBy);
    if (Number.isNaN(reviewBy.getTime())) {
      throw new Error(`${path}: entry for ${entry.file} has an unparseable reviewBy "${entry.reviewBy}"`);
    }
    (reviewBy < now ? expired : live).push(entry);
  }
  return { live, expired };
}

function listMarkdownFiles() {
  const out = execFileSync("git", ["ls-files", "--", "*.md"], { cwd: REPO_ROOT, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function main() {
  const { allowlist: allowlistPath, now, selftestOnly } = parseArgs(process.argv.slice(2));

  if (!runSelfTest()) return;
  if (selftestOnly) return;

  const { live, expired } = loadAllowlist(allowlistPath, now);
  const allowed = new Set(live.map((e) => `${e.file} ${e.pattern} ${e.snippet}`));
  const usedAllowlistKeys = new Set();

  const violations = [];
  for (const file of listMarkdownFiles()) {
    const content = readFileSync(join(REPO_ROOT, file), "utf8");
    for (const m of scanText(content)) {
      const key = `${file} ${m.id} ${m.lineText}`;
      if (allowed.has(key)) usedAllowlistKeys.add(key);
      else violations.push({ file, ...m, snippet: m.lineText.slice(0, 140) });
    }
  }

  const staleLive = live.filter((e) => !usedAllowlistKeys.has(`${e.file} ${e.pattern} ${e.snippet}`));

  if (violations.length === 0 && staleLive.length === 0) {
    console.log(
      `[artifact-ui-contradiction-gate] OK — 0 superseded-boundary claims across the pack's Markdown corpus ` +
        `(allowlist: ${live.length} live entries).`
    );
    if (expired.length > 0) {
      console.log(
        `[artifact-ui-contradiction-gate] NOTE — ${expired.length} allowlist entry(ies) past reviewBy ` +
          `and no longer matching anything (safe to delete or renew): ` +
          expired.map((e) => `${e.file}:${e.pattern} (reviewBy ${e.reviewBy})`).join(", ")
      );
    }
    return;
  }

  if (violations.length > 0) {
    console.error(`[artifact-ui-contradiction-gate] FAIL — ${violations.length} superseded-boundary claim(s):\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.id}] ${v.description} — "${v.snippet}"`);
      console.error(`      fix: ${v.fix}\n`);
    }
  }
  if (staleLive.length > 0) {
    console.error(
      `[artifact-ui-contradiction-gate] FAIL — ${staleLive.length} live allowlist entry(ies) matched nothing ` +
        `this run (STALE — remove them; a stale entry can later suppress a byte-identical reintroduction):`
    );
    for (const e of staleLive) console.error(`  ${e.file} [${e.pattern}] "${e.snippet}"`);
    console.error("");
  }
  console.error(
    `The artifact-UI boundary was flipped by epic #1620: an artifact extension is DECLARATIVE BY DEFAULT ` +
      `and MAY ship a port-less \`cinatra.artifact.ui\` renderer. Rewrite the claim to the new boundary ` +
      `(see skills/artifact-authoring/SKILL.md and skills/extension-boundary/SKILL.md).\n` +
      `A genuine false positive (real non-artifact content this pattern misfires on) goes in ` +
      `${allowlistPath} with an owner, a reviewBy date, and the exact logical line as the snippet.`
  );
  process.exitCode = 1;
}

main();
