// tests/ensure.test.mjs — the SHARED detect -> consent -> apply engine
// (claude-plugin#16).
//
// Proves, against a FAKE tool registry (so the generic engine is tested in
// isolation from any one real tool's network/installer specifics):
//   1. checkTool() is READ-ONLY: it never calls a tool's apply(), regardless
//      of the probed state.
//   2. checkTool() reports needsAction/fixCommand/prompt only when the probe
//      is not fully "ok"; an unknown tool reports status:"unknown" (never
//      throws) and names the known tools.
//   3. applyTool() is a clean no-op (never calls apply()) when the tool is
//      already ok.
//   4. applyTool() calls the fix exactly once when action is needed, then
//      RE-PROBES (never trusts the installer's own return value) — proven by
//      an installer that CLAIMS success but leaves the probed state
//      unchanged: the engine still reports ok:false.
//   5. applyTool() reports an install exception honestly (ok:false,
//      installError set) rather than a silent skip or a false "installed".
//   6. ensureTool() dispatches apply:false -> checkTool, apply:true ->
//      applyTool, with no accidental installs on the read-only path.
//   7. `home`/`codexHome` overrides reach the SAME deps object on the check,
//      the apply call, and the post-apply re-verify (before/after) — a
//      regression guard for the bug where the read-only check and the
//      re-verify silently ignored --home/--codex-home and fell back to the
//      real machine home while --apply installed into the caller's chosen
//      sandbox, producing a false "still missing" verdict for a successful
//      sandboxed install.
//
// A second block proves the REAL "shadcn-skill" registry entry wires to the
// EXISTING doctor probe (never a parallel detection path) without invoking
// the network-dependent installer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ensure = require("../bin/lib/ensure.cjs");
const doctor = require("../bin/lib/doctor.cjs");

// --- fake registry -----------------------------------------------------------

// A minimal fake deps object: only what a probe/apply might touch. `homedir`
// is a function (so a resolveDeps() override can replace it) and reports
// whatever the caller last set it to.
function fakeDeps(home) {
  return {
    homedir: () => home,
    existsSync: () => false,
    readFileSync: () => "",
    env: () => process.env,
  };
}

// Build a fake single-tool registry. `present` starts absent; `apply` can be
// scripted to actually flip presence (a real fix), to claim success without
// flipping it (a lying installer), or to throw (a failing fix).
function makeFakeRegistry({ applyBehavior = "fixes" } = {}) {
  let present = false;
  const applyCalls = [];
  const probeCalls = [];
  const registry = {
    "fake-tool": {
      label: "Fake Tool",
      probe: (deps) => {
        const home = deps.homedir();
        probeCalls.push(home);
        return [{
          id: "fake-tool", label: "Fake Tool",
          status: present ? "ok" : "warn",
          detail: `present=${present} home=${home}`,
          fix: present ? null : "run fake-tool-install",
        }];
      },
      fixCommand: "fake-tool-install",
      apply: (deps, opts) => {
        applyCalls.push({ home: deps.homedir(), opts });
        if (applyBehavior === "throws") throw new Error("fake-tool-install exploded");
        if (applyBehavior === "lies") return { claimedInstalled: true }; // never flips `present`
        present = true; // applyBehavior === "fixes" (default): a real, honest fix
        return { claimedInstalled: true };
      },
    },
  };
  return { registry, applyCalls, probeCalls, setPresent: (v) => { present = v; } };
}

// --- 1/2: checkTool is read-only; unknown tool never throws -----------------

test("checkTool never calls apply, regardless of probe state", () => {
  const { registry, applyCalls } = makeFakeRegistry();
  const r1 = ensure.checkTool("fake-tool", { deps: fakeDeps("/h"), registry });
  assert.equal(r1.needsAction, true);
  assert.equal(r1.status, "warn");
  assert.equal(r1.fixCommand, "fake-tool-install");
  assert.match(r1.prompt, /Install\/configure it now\?.*fake-tool-install/);
  assert.equal(applyCalls.length, 0, "checkTool must never install");
});

test("checkTool reports needsAction:false and no fix once the probe is ok", () => {
  const { registry, setPresent } = makeFakeRegistry();
  setPresent(true);
  const r = ensure.checkTool("fake-tool", { deps: fakeDeps("/h"), registry });
  assert.equal(r.needsAction, false);
  assert.equal(r.fixCommand, null);
  assert.equal(r.prompt, null);
  assert.equal(r.status, "ok");
});

test("checkTool on an unknown tool reports status:unknown and names the known tools (never throws)", () => {
  const { registry } = makeFakeRegistry();
  const r = ensure.checkTool("nope", { deps: fakeDeps("/h"), registry });
  assert.equal(r.status, "unknown");
  assert.match(r.error, /unknown ensure target: nope/);
  assert.match(r.error, /fake-tool/);
});

// --- 3/4/5: applyTool honesty ------------------------------------------------

test("applyTool is a clean no-op when already ok — never calls apply()", () => {
  const { registry, applyCalls, setPresent } = makeFakeRegistry();
  setPresent(true);
  const r = ensure.applyTool("fake-tool", { deps: fakeDeps("/h"), registry });
  assert.equal(r.ok, true);
  assert.equal(r.action, "none");
  assert.equal(applyCalls.length, 0);
  assert.deepEqual(r.after, r.before);
});

test("applyTool calls the fix exactly once and reports ok:true once the re-probe confirms it", () => {
  const { registry, applyCalls } = makeFakeRegistry({ applyBehavior: "fixes" });
  const r = ensure.applyTool("fake-tool", { deps: fakeDeps("/h"), registry });
  assert.equal(applyCalls.length, 1, "apply must run exactly once");
  assert.equal(r.ok, true);
  assert.equal(r.action, "installed");
  assert.equal(r.before.needsAction, true);
  assert.equal(r.after.needsAction, false);
});

test("applyTool never trusts the installer's own claimed success — a lying installer is reported as failed", () => {
  const { registry, applyCalls } = makeFakeRegistry({ applyBehavior: "lies" });
  const r = ensure.applyTool("fake-tool", { deps: fakeDeps("/h"), registry });
  assert.equal(applyCalls.length, 1);
  assert.equal(r.installResult.claimedInstalled, true, "the installer DID claim success");
  assert.equal(r.ok, false, "but the re-probe says it is still missing, so ok must be false");
  assert.equal(r.action, "failed");
  assert.equal(r.after.needsAction, true);
});

test("applyTool reports an install exception honestly — never a silent skip, never a false success", () => {
  const { registry } = makeFakeRegistry({ applyBehavior: "throws" });
  const r = ensure.applyTool("fake-tool", { deps: fakeDeps("/h"), registry });
  assert.equal(r.ok, false);
  assert.equal(r.action, "failed");
  assert.match(r.installError, /fake-tool-install exploded/);
  assert.equal(r.installResult, null);
});

test("applyTool on an unknown tool reports status:unknown (never throws, never installs)", () => {
  const { registry, applyCalls } = makeFakeRegistry();
  const r = ensure.applyTool("nope", { deps: fakeDeps("/h"), registry });
  assert.equal(r.ok, false);
  assert.equal(r.status, "unknown");
  assert.equal(applyCalls.length, 0);
});

// --- 6: ensureTool dispatch ---------------------------------------------------

test("ensureTool: apply:false (default) never installs; apply:true does", () => {
  const { registry, applyCalls } = makeFakeRegistry();
  const checked = ensure.ensureTool("fake-tool", { deps: fakeDeps("/h"), registry });
  assert.equal(applyCalls.length, 0);
  assert.equal(checked.needsAction, true);

  const applied = ensure.ensureTool("fake-tool", { deps: fakeDeps("/h"), apply: true, registry });
  assert.equal(applyCalls.length, 1);
  assert.equal(applied.ok, true);
});

// --- 7: home/codexHome propagation regression guard -------------------------

test("checkTool honors a home/codexHome override (regression: was silently ignored on the read-only path)", () => {
  const { registry, probeCalls } = makeFakeRegistry();
  const r = ensure.checkTool("fake-tool", { home: "/sandbox-a", registry });
  assert.match(r.checks[0].detail, /home=\/sandbox-a/);
  assert.deepEqual(probeCalls, ["/sandbox-a"]);
});

test("checkTool falls back to the real machine deps when no home/codexHome/deps is given", () => {
  const { registry } = makeFakeRegistry();
  const real = doctor.defaultDeps();
  const r = ensure.checkTool("fake-tool", { registry });
  assert.match(r.checks[0].detail, new RegExp(`home=${real.homedir()}`));
});

test("applyTool's apply() call and its before/after re-probes all see the SAME overridden home", () => {
  const { registry, applyCalls, probeCalls } = makeFakeRegistry();
  const r = ensure.applyTool("fake-tool", { home: "/sandbox-b", codexHome: "/sandbox-b/.codex", registry });
  assert.equal(applyCalls.length, 1);
  assert.equal(applyCalls[0].home, "/sandbox-b", "apply() must receive the overridden home");
  assert.equal(applyCalls[0].opts.home, "/sandbox-b", "apply() must also receive it explicitly in opts");
  assert.equal(applyCalls[0].opts.codexHome, "/sandbox-b/.codex");
  // two checkTool calls happen inside applyTool: before-probe, after-probe.
  assert.deepEqual(probeCalls, ["/sandbox-b", "/sandbox-b"]);
  assert.equal(r.before.checks[0].detail.includes("/sandbox-b"), true);
  assert.equal(r.after.checks[0].detail.includes("/sandbox-b"), true);
  assert.equal(r.ok, true);
});

test("an explicit deps object always wins over home/codexHome", () => {
  const { registry, probeCalls } = makeFakeRegistry();
  ensure.checkTool("fake-tool", { deps: fakeDeps("/explicit"), home: "/ignored", registry });
  assert.deepEqual(probeCalls, ["/explicit"]);
});

// --- real "shadcn-skill" registry entry: wiring, not reimplementation -------

test("the real shadcn-skill tool delegates its probe to doctor.probeShadcnSkill (no parallel detection path)", () => {
  // The registry entry wraps the call (`(deps) => doctor.probeShadcnSkill(deps)`)
  // rather than holding a direct function reference, so assert behavioral
  // delegation: for the SAME deps, the registered probe returns EXACTLY what
  // doctor.probeShadcnSkill returns (same checks, not a re-implementation).
  const deps = { homedir: () => "/nowhere", existsSync: () => false, readFileSync: () => "", env: () => ({}) };
  assert.deepEqual(ensure.TOOLS["shadcn-skill"].probe(deps), doctor.probeShadcnSkill(deps));
});

test("listTools() reports the real registry's known tools", () => {
  assert.deepEqual(ensure.listTools(), Object.keys(ensure.TOOLS));
  assert.ok(ensure.listTools().includes("shadcn-skill"));
});

test("checkTool('shadcn-skill') against a deps with nothing installed reports needsAction + the shadcn-install fix command", () => {
  const deps = { homedir: () => "/nowhere", existsSync: () => false, readFileSync: () => "", env: () => ({}) };
  const r = ensure.checkTool("shadcn-skill", { deps });
  assert.equal(r.needsAction, true);
  assert.match(r.fixCommand, /shadcn-install/);
  assert.match(r.prompt, /Install\/configure it now\?/);
  // two separate legs (Claude + Codex) — never averaged into one check.
  assert.equal(r.checks.length, 2);
  assert.ok(r.checks.every((c) => c.status === "warn"));
});

test("checkTool('shadcn-skill') against a deps with both legs present reports needsAction:false", () => {
  // "present" means a valid skill dir (SKILL.md included), not just the bare
  // dir — see doctor-shadcn-skill.test.mjs finding 6.
  const present = new Set([
    "/home/.claude/skills/shadcn", "/home/.claude/skills/shadcn/SKILL.md",
    "/home/.codex/skills/shadcn", "/home/.codex/skills/shadcn/SKILL.md",
  ]);
  const deps = {
    homedir: () => "/home",
    existsSync: (p) => present.has(p),
    readFileSync: () => "",
    env: () => ({ CODEX_HOME: "/home/.codex" }),
  };
  const r = ensure.checkTool("shadcn-skill", { deps });
  assert.equal(r.needsAction, false);
  assert.equal(r.status, "ok");
});

// --- codex round-1 finding: fixCommand must reflect --home/--codex-home ----
// Paths are shell-quoted (codex round-2 finding: an unquoted filesystem path
// meant for operator copy/paste is not "the exact command" if it contains a
// space or shell metacharacter — see the adversarial test below). A plain
// identifier-ish path like "/sandbox-c" still contains "/", so shQuote wraps
// it in single quotes just like any other path — every assertion below
// expects the quoted form, not the bare path.

test("checkTool's fixCommand/prompt include --home/--codex-home when the check was overridden with them (codex round-1: the plain base command would fix the real machine home, not the sandbox that was just checked)", () => {
  const r = ensure.checkTool("shadcn-skill", { home: "/sandbox-c", codexHome: "/sandbox-c/.codex" });
  assert.equal(r.needsAction, true);
  assert.equal(
    r.fixCommand,
    "node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs shadcn-install --home '/sandbox-c' --codex-home '/sandbox-c/.codex'",
  );
  assert.match(r.prompt, /--home '\/sandbox-c' --codex-home '\/sandbox-c\/\.codex'/);
});

test("checkTool's fixCommand is the plain base command (no flags) when no home/codexHome override is given — the common real-machine case", () => {
  const r = ensure.checkTool("shadcn-skill", { deps: { homedir: () => "/nowhere", existsSync: () => false, readFileSync: () => "", env: () => ({}) } });
  assert.equal(r.fixCommand, "node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs shadcn-install");
});

test("checkTool's fixCommand never appends --force (an apply-time safety override, not something a read-only check probed)", () => {
  const r = ensure.checkTool("shadcn-skill", { home: "/sandbox-d" });
  assert.doesNotMatch(r.fixCommand, /--force/);
});

test("applyTool's failed-apply 'after' also reports a fixCommand reflecting the sandbox it actually targeted", () => {
  const { registry } = makeFakeRegistry({ applyBehavior: "throws" });
  const r = ensure.applyTool("fake-tool", { home: "/sandbox-e", registry });
  assert.equal(r.ok, false);
  assert.match(r.after.fixCommand, /--home '\/sandbox-e'/);
});

// --- codex round-2 finding: home/codexHome must be shell-quoted -------------

test("checkTool's fixCommand shell-quotes a home containing a space or shell metacharacters (codex round-2: an unquoted path either fails to reproduce the checked target, or worse, parses as extra shell syntax when copy-pasted)", () => {
  const evil = "/Users/ordnas/My Code/$(rm -rf ~)";
  const r = ensure.checkTool("shadcn-skill", { home: evil });
  assert.equal(r.needsAction, true);
  // the raw adversarial value must never appear un-quoted in the command.
  assert.ok(!r.fixCommand.includes(`--home ${evil}`), "must not interpolate the raw path unquoted");
  assert.equal(r.fixCommand, `node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs shadcn-install --home '${evil.replace(/'/g, "'\\''")}'`);
  // round-tripping the quoted --home argument through a REAL shell must yield
  // back the exact literal path (the whole point of quoting: safe copy/paste)
  // rather than executing the embedded "$(rm -rf ~)" or splitting on the space.
  const quotedHome = r.fixCommand.split("--home ")[1].split(" --codex-home")[0];
  const cp = require("node:child_process");
  const homeArg = cp.execFileSync("/bin/sh", ["-c", `set -- ${quotedHome}; printf %s "$1"`], { encoding: "utf8" });
  assert.equal(homeArg, evil);
});
