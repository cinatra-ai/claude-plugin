// tests/doctor-shadcn-skill.test.mjs — the shadcn-skill presence probe
// (doctor.probeShadcnSkill, claude-plugin#16).
//
// Proves:
//   1. It's READ-ONLY: probing never writes anything (asserted implicitly —
//      the fake deps below expose no write surface at all).
//   2. It checks the Claude leg and the Codex leg as TWO SEPARATE checks, so
//      a partial install (present for one tool, missing for the other — a
//      real "misconfigured" state) is visible on its own instead of being
//      averaged into a single verdict.
//   3. Absence is `warn`, not `fail` — the pack runs fine without the shadcn
//      skill; it is only needed for UI-relevant work (same shape as the
//      existing probeGsd "optional, co-exists without it" probe).
//   4. The Codex leg resolves $CODEX_HOME (falling back to ~/.codex) via the
//      injectable `deps.env()`, independent of the Claude leg's home.
//   5. It never throws even when the shadcn-install pinned manifest is
//      unavailable (today's real repo state — see the companion issue filed
//      against payload/shared/*) — presence is still reported, ownership
//      detail just degrades to absent rather than crashing doctor's probe
//      sweep.
//   6. "present" means a VALID skill dir, not just an existing path (codex
//      round-1 finding, claude-plugin#16): a dir with no SKILL.md is `warn`,
//      same as fully absent — otherwise `ensure --apply` would silently
//      no-op on a broken/empty install instead of asking to fix it.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const doctor = require("../bin/lib/doctor.cjs");

function fakeDeps({ home, codexHome, present = new Set() }) {
  return {
    homedir: () => home,
    env: () => (codexHome ? { CODEX_HOME: codexHome } : {}),
    existsSync: (p) => present.has(p),
    readFileSync: () => "",
  };
}

// A COMPLETE, valid install: the skill dir AND its SKILL.md both exist. Tests
// that want a leg to read `ok` must use this (not just the bare dir) — see
// finding 6 above.
function validSkillDirs(...dirs) {
  const s = new Set();
  for (const d of dirs) {
    s.add(d);
    s.add(path.join(d, "SKILL.md"));
  }
  return s;
}

test("probeShadcnSkill: both legs absent -> two separate warn checks (never averaged, never fail)", () => {
  const deps = fakeDeps({ home: "/h", codexHome: "/h/.codex", present: new Set() });
  const checks = doctor.probeShadcnSkill(deps);
  assert.equal(checks.length, 2);
  const [claudeLeg, codexLeg] = checks;
  assert.equal(claudeLeg.id, "shadcn-skill-claude");
  assert.equal(codexLeg.id, "shadcn-skill-codex");
  assert.equal(claudeLeg.status, "warn");
  assert.equal(codexLeg.status, "warn");
  assert.match(claudeLeg.detail, /not installed at \/h\/\.claude\/skills\/shadcn/);
  assert.match(codexLeg.detail, /not installed at \/h\/\.codex\/skills\/shadcn/);
  // absence is a fix candidate, never a hard fail.
  assert.notEqual(claudeLeg.status, "fail");
  assert.notEqual(codexLeg.status, "fail");
});

test("probeShadcnSkill: both legs present -> two ok checks", () => {
  const present = validSkillDirs(
    path.join("/h", ".claude", "skills", "shadcn"),
    path.join("/h", ".codex", "skills", "shadcn"),
  );
  const deps = fakeDeps({ home: "/h", codexHome: "/h/.codex", present });
  const checks = doctor.probeShadcnSkill(deps);
  assert.ok(checks.every((c) => c.status === "ok"));
  assert.ok(checks.every((c) => c.fix === null));
});

test("probeShadcnSkill: a PARTIAL install (Claude present, Codex missing) is visible per-leg, not averaged away", () => {
  const present = validSkillDirs(path.join("/h", ".claude", "skills", "shadcn"));
  const deps = fakeDeps({ home: "/h", codexHome: "/h/.codex", present });
  const checks = doctor.probeShadcnSkill(deps);
  const claudeLeg = checks.find((c) => c.id === "shadcn-skill-claude");
  const codexLeg = checks.find((c) => c.id === "shadcn-skill-codex");
  assert.equal(claudeLeg.status, "ok");
  assert.equal(codexLeg.status, "warn");
  // summarizing the pair yields the worst-status verdict (warn), the whole
  // point of keeping them separate instead of collapsing to one check.
  const summary = doctor.summarize(checks);
  assert.equal(summary.verdict, "warn");
});

test("probeShadcnSkill: a dir that EXISTS but has no SKILL.md is warn, not ok (codex round-1 regression: an empty/partial install must never silently look complete)", () => {
  // The dir itself is present (so a naive existsSync(dest) check would say
  // "ok"), but SKILL.md — the same completeness bar shadcn-install's own
  // verifyBundle() uses — is missing, e.g. an interrupted/half-written
  // install. This must stay a fix candidate, exactly like fully absent, so
  // `ensure --apply` does not silently no-op on a broken install.
  const dir = path.join("/h", ".claude", "skills", "shadcn");
  const present = new Set([dir]); // dir exists; dir/SKILL.md does NOT
  const deps = fakeDeps({ home: "/h", codexHome: "/h/.codex", present });
  const checks = doctor.probeShadcnSkill(deps);
  const claudeLeg = checks.find((c) => c.id === "shadcn-skill-claude");
  assert.equal(claudeLeg.status, "warn");
  assert.match(claudeLeg.detail, /incomplete/i);
  assert.match(claudeLeg.detail, /SKILL\.md/);
  assert.notEqual(claudeLeg.fix, null, "an incomplete leg must still carry a fix — never a silent skip");
});

test("probeShadcnSkill: the Codex leg resolves via CODEX_HOME independent of the Claude home", () => {
  const present = validSkillDirs(path.join("/somewhere-else", "skills", "shadcn"));
  const deps = fakeDeps({ home: "/h", codexHome: "/somewhere-else", present });
  const checks = doctor.probeShadcnSkill(deps);
  const codexLeg = checks.find((c) => c.id === "shadcn-skill-codex");
  assert.equal(codexLeg.status, "ok");
  assert.match(codexLeg.detail, /somewhere-else/);
});

test("probeShadcnSkill: defaults to ~/.codex when CODEX_HOME is unset", () => {
  const deps = fakeDeps({ home: "/h", present: new Set() }); // env() -> {}
  const checks = doctor.probeShadcnSkill(deps);
  const codexLeg = checks.find((c) => c.id === "shadcn-skill-codex");
  assert.match(codexLeg.detail, /\.codex[\\/]skills[\\/]shadcn/);
});

test("probeShadcnSkill never throws even when the shadcn-install manifest is unavailable (today's real repo state)", () => {
  // No mock of shadcn-install.cjs here — this exercises the REAL module, whose
  // loadManifest() throws ENOENT in this checkout (payload/shared/ is not
  // committed — see the companion issue). describeShadcnLeg must swallow that
  // and still report plain presence rather than crashing doctor's probe sweep.
  const present = validSkillDirs(path.join("/h", ".claude", "skills", "shadcn"));
  const deps = fakeDeps({ home: "/h", codexHome: "/h/.codex", present });
  assert.doesNotThrow(() => {
    const checks = doctor.probeShadcnSkill(deps);
    const claudeLeg = checks.find((c) => c.id === "shadcn-skill-claude");
    assert.equal(claudeLeg.status, "ok");
  });
});

test("runToolchain() includes both shadcn-skill legs in the full probe sweep", () => {
  const deps = fakeDeps({ home: "/h", codexHome: "/h/.codex", present: new Set() });
  // runToolchain shells out to gh/codex/node/pnpm/docker/git too; give it a
  // deps.run that fails closed (ENOENT-shaped) rather than touching this host.
  deps.run = () => ({ ok: false, code: null, stdout: "", stderr: "", timedOut: false, error: "ENOENT" });
  const checks = doctor.runToolchain(deps);
  assert.ok(checks.some((c) => c.id === "shadcn-skill-claude"));
  assert.ok(checks.some((c) => c.id === "shadcn-skill-codex"));
});
