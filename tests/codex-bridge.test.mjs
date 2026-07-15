// tests/codex-bridge.test.mjs — the sanctioned codex convergence bridge.
//
// Proves:
//   1. buildCodexArgs() ALWAYS carries the pinned model (-m <model>), the pinned
//      reasoning effort (-c model_reasoning_effort=<effort>), the pinned
//      read-only sandbox (-s read-only — an advisory run must not write to the
//      worktree it reviews; exec defaults to writable), and --strict-config
//      — so no convergence round can silently inherit the CLI default, and a
//      captured verdict is always attributable to a known model + effort.
//      --strict-config turns an unrecognized config key (a future CLI that
//      renames/drops the effort key) into a hard error instead of a silent
//      ignore. The pins are present even when the caller passes its own extraArgs
//      (which follow the pins, never displace them).
//   2. The guards still throw: a non-string extraArg is rejected (a non-string
//      cannot be a valid codex flag; the prompt rides STDIN — which runCodex
//      always pipes — and is never placed in argv), AND a caller cannot override
//      the pinned model or reasoning effort, or ESCALATE the pinned read-only
//      sandbox, via extraArgs (a trailing last-write-wins override would silently
//      defeat the pin while the header/result still claimed it) — every
//      short/long/attached/`=`-joined form is rejected, plus the two
//      sandbox-bypass flags; a non-pinned -c key and a redundant `-s read-only`
//      are still allowed.
//   3. runCodex threads the pinned flags to the real subprocess and, when the
//      installed CLI REJECTS the pinned model/effort (simulated by a fake bin
//      that exits non-zero), surfaces a VISIBLE failure (ok:false) with the
//      error captured — never a silent downgrade to the CLI default.
//   4. runCodex records the resolved model + effort alongside the captured
//      verdict: returned on the result object AND written as a header into the
//      capture file, so a verdict is auditable to a specific model + effort.
//
// The runCodex subprocess tests use a FAKE codex executable (a tiny shell
// script) passed via `bin`, so the bridge is exercised end-to-end without a
// network call or the real Codex CLI.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const bridge = require("../bin/lib/codex-bridge.cjs");

const {
  buildCodexArgs,
  runCodex,
  PINNED_CODEX_MODEL,
  PINNED_REASONING_EFFORT,
  REASONING_EFFORT_CONFIG_KEY,
  PINNED_SANDBOX,
} = bridge;

// --- helpers -----------------------------------------------------------------

// A scratch dir per test group, torn down at process exit.
function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-bridge-test-"));
  process.on("exit", () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ } });
  return dir;
}

// Write an executable fake `codex` script and return its path. `behavior`:
//   "assert-pins" — exit 0 ONLY if it received -m <pinned> AND
//     -c model_reasoning_effort=<pinned>; else exit 3 (proves the pins reach
//     the subprocess argv).
//   "reject" — always exit 4 with an error on stderr (simulates a CLI that does
//     NOT support the pinned model/effort — the fail-closed path).
function fakeCodex(dir, behavior) {
  const p = path.join(dir, `codex-${behavior}.sh`);
  let script;
  if (behavior === "assert-pins") {
    script = `#!/bin/sh
model=""
effort=""
while [ $# -gt 0 ]; do
  case "$1" in
    -m) model="$2"; shift 2 ;;
    -c) case "$2" in ${REASONING_EFFORT_CONFIG_KEY}=*) effort="\${2#${REASONING_EFFORT_CONFIG_KEY}=}" ;; esac; shift 2 ;;
    *) shift ;;
  esac
done
if [ "$model" = "${PINNED_CODEX_MODEL}" ] && [ "$effort" = "${PINNED_REASONING_EFFORT}" ]; then
  printf 'MERGE-SAFE: verdict from %s\\n' "$model"
  exit 0
fi
printf 'FAKE-CODEX: missing pins model=%s effort=%s\\n' "$model" "$effort" 1>&2
exit 3
`;
  } else if (behavior === "reject") {
    script = `#!/bin/sh
printf 'ERROR: unsupported model or reasoning effort for this CLI build\\n' 1>&2
exit 4
`;
  } else {
    throw new Error(`unknown fake behavior: ${behavior}`);
  }
  fs.writeFileSync(p, script, { mode: 0o755 });
  return p;
}

// --- 1: pins are ALWAYS present ----------------------------------------------

test("buildCodexArgs always carries the pinned model and reasoning-effort flags", () => {
  const args = buildCodexArgs();
  assert.deepEqual(args, [
    "exec",
    "--strict-config",
    "--skip-git-repo-check",
    "-s", PINNED_SANDBOX,
    "-m", PINNED_CODEX_MODEL,
    "-c", `${REASONING_EFFORT_CONFIG_KEY}=${PINNED_REASONING_EFFORT}`,
  ]);
  // The sandbox is pinned read-only: an advisory convergence must not let codex
  // write to the worktree it reviews (exec defaults to writable when -s is omitted).
  assert.equal(PINNED_SANDBOX, "read-only");
  // The pinned literals are the ones grounded from the installed CLI. The effort
  // is the model's MAXIMUM reasoning tier, not merely a high one: the CLI's model
  // catalog lists this model's levels as low/medium/high/xhigh/max/ultra, so
  // xhigh is NOT the ceiling. `max` is the highest pure reasoning tier; `ultra`
  // adds automatic task delegation (a multi-agent mode) that would break the
  // bridge's read-only, single-verdict, bounded-round contract — so the pin is
  // `max`, not `xhigh` and not `ultra`. (Runtime acceptance of `max`/`ultra` is a
  // live-CLI property; this suite covers the arg wiring, so it asserts the pinned
  // literal rather than firing a network run.)
  assert.equal(PINNED_CODEX_MODEL, "gpt-5.6-sol");
  assert.equal(PINNED_REASONING_EFFORT, "max");
  assert.notEqual(PINNED_REASONING_EFFORT, "xhigh"); // guard against a silent regression back to the non-max tier
  assert.equal(REASONING_EFFORT_CONFIG_KEY, "model_reasoning_effort");
});

test("buildCodexArgs always includes --strict-config so an unrecognized pinned key hard-fails (never silently ignored)", () => {
  // Without --strict-config the CLI silently IGNORES an unknown `-c` key: a
  // future CLI that renamed/dropped model_reasoning_effort would then run at the
  // ambient default while the recorded header/result still claimed the pinned
  // value — a misattributed verdict. --strict-config turns that into a hard
  // error (`unknown configuration field ... in -c/--config override`), the
  // fail-closed guarantee. It rides on every invocation, with or without extraArgs.
  assert.ok(buildCodexArgs().includes("--strict-config"), "--strict-config always present");
  assert.ok(
    buildCodexArgs({ extraArgs: ["--cd", "/somewhere"] }).includes("--strict-config"),
    "--strict-config present even with extraArgs",
  );
});

test("benign extraArgs are appended AFTER the pins (extraArgs follow, never displace, the pins)", () => {
  const args = buildCodexArgs({ extraArgs: ["--cd", "/somewhere", "-c", "sandbox_permissions=[]"] });
  const mi = args.indexOf("-m");
  assert.ok(mi >= 0 && args[mi + 1] === PINNED_CODEX_MODEL, "model pin present");
  const ci = args.indexOf("-c");
  assert.ok(ci >= 0 && args[ci + 1] === `${REASONING_EFFORT_CONFIG_KEY}=${PINNED_REASONING_EFFORT}`, "effort pin present");
  // a NON-pinned -c config (sandbox_permissions) is allowed, appended after the pins.
  assert.deepEqual(args.slice(-4), ["--cd", "/somewhere", "-c", "sandbox_permissions=[]"]);
});

// --- 2: argv-prompt-smuggling guard still throws -----------------------------

test("buildCodexArgs rejects a non-string extra arg (prompt must ride STDIN, never argv)", () => {
  assert.throws(() => buildCodexArgs({ extraArgs: [123] }), /codex args must be strings/);
  assert.throws(() => buildCodexArgs({ extraArgs: [{ prompt: "smuggled" }] }), /codex args must be strings/);
});

// --- 2b: a caller cannot override the pinned model/effort via extraArgs -------
// (codex last-write-wins would silently defeat the pin while the header/result
// still claimed the pinned values — a misattributed verdict.)

test("buildCodexArgs rejects a model override in extraArgs, in every form", () => {
  for (const extra of [
    ["-m", "gpt-4"],
    ["--model", "gpt-4"],
    ["--model=gpt-4"],
    ["-m=gpt-4"],
    ["-mgpt-4"],
  ]) {
    assert.throws(() => buildCodexArgs({ extraArgs: extra }), /model is pinned/, `should reject ${JSON.stringify(extra)}`);
  }
});

test("buildCodexArgs rejects a reasoning-effort (or model) override via -c/--config in extraArgs, in every form", () => {
  for (const extra of [
    ["-c", "model_reasoning_effort=low"],
    ["--config", "model_reasoning_effort=minimal"],
    ["--config=model_reasoning_effort=low"],
    ["-c=model_reasoning_effort=low"],
    ["-cmodel_reasoning_effort=low"],
    ["-c", "model=gpt-4"], // -c model= is also a model override
  ]) {
    assert.throws(() => buildCodexArgs({ extraArgs: extra }), /is pinned/, `should reject ${JSON.stringify(extra)}`);
  }
});

// --- 2c: a caller cannot ESCALATE the pinned read-only sandbox via extraArgs ---
// (an advisory convergence must not become writable; codex last-write-wins would
// silently defeat the read-only pin while the run still reads as "read-only".)

test("buildCodexArgs rejects a sandbox escalation via -s/--sandbox in extraArgs, in every form", () => {
  for (const extra of [
    ["-s", "workspace-write"],
    ["--sandbox", "danger-full-access"],
    ["--sandbox=workspace-write"],
    ["-s=danger-full-access"],
    ["-sworkspace-write"],
    ["-c", "sandbox_mode=\"workspace-write\""], // sandbox_mode config is a pinned key
  ]) {
    // -s/--sandbox forms throw "the sandbox is pinned '…'"; the sandbox_mode
    // config form throws "'sandbox_mode' is pinned …" — both carry "is pinned".
    assert.throws(() => buildCodexArgs({ extraArgs: extra }), /is pinned/, `should reject ${JSON.stringify(extra)}`);
  }
});

test("buildCodexArgs rejects every sandbox-escalating flag (incl. the --yolo and --full-auto aliases the CLI accepts)", () => {
  for (const flag of [
    "--dangerously-bypass-approvals-and-sandbox",
    "--yolo",                          // accepted alias for the bypass flag
    "--full-auto",                     // deprecated alias for --sandbox workspace-write
    "--dangerously-bypass-hook-trust",
  ]) {
    assert.throws(() => buildCodexArgs({ extraArgs: [flag] }), /must not escalate or bypass it/, `should reject ${flag}`);
  }
});

test("buildCodexArgs allows a NON-pinned -c config key in extraArgs (only the pinned keys are guarded)", () => {
  assert.doesNotThrow(() => buildCodexArgs({ extraArgs: ["-c", "sandbox_permissions=[]"] }));
  assert.doesNotThrow(() => buildCodexArgs({ extraArgs: ["--config=shell_environment_policy.inherit=all"] }));
  // A redundant `-s read-only` merely RESTATES the pin — harmless, allowed.
  assert.doesNotThrow(() => buildCodexArgs({ extraArgs: ["-s", "read-only", "-C", "/tmp"] }));
  assert.doesNotThrow(() => buildCodexArgs({ extraArgs: ["--sandbox=read-only"] }));
});

// --- 3: a rejected model/effort is a VISIBLE failure, never a silent fallback -

test("runCodex surfaces a rejected model/effort as ok:false with the error captured (no silent downgrade)", () => {
  const dir = scratch();
  const bin = fakeCodex(dir, "reject");
  const outputFile = path.join(dir, "verdict-reject.txt");
  const r = runCodex({ prompt: "is this MERGE-SAFE?", outputFile, bin });
  assert.equal(r.ok, false, "a CLI that rejects the pinned model/effort must fail visibly");
  assert.notEqual(r.code, 0);
  const captured = fs.readFileSync(outputFile, "utf8");
  assert.match(captured, /unsupported model or reasoning effort/, "the failure is captured, not swallowed");
});

// --- 3b + 1 (e2e): the pins actually reach the subprocess argv ---------------

test("runCodex threads the pinned model + effort to the codex subprocess (fake bin exits 0 only when both pins are present)", () => {
  const dir = scratch();
  const bin = fakeCodex(dir, "assert-pins");
  const outputFile = path.join(dir, "verdict-ok.txt");
  const r = runCodex({ prompt: "is this MERGE-SAFE?", outputFile, bin });
  assert.equal(r.ok, true, "the fake bin only exits 0 when it saw both pins — so ok:true proves they were passed");
  assert.equal(r.code, 0);
});

// --- 4: resolved model + effort recorded with the captured verdict ----------

test("runCodex records the resolved model + effort on the result object", () => {
  const dir = scratch();
  const bin = fakeCodex(dir, "assert-pins");
  const outputFile = path.join(dir, "verdict-meta.txt");
  const r = runCodex({ prompt: "converge", outputFile, bin });
  assert.equal(r.model, PINNED_CODEX_MODEL);
  assert.equal(r.reasoningEffort, PINNED_REASONING_EFFORT);
  assert.equal(r.outputFile, outputFile);
});

test("runCodex writes a header recording the resolved model + effort into the capture file (verdict is attributable)", () => {
  const dir = scratch();
  const bin = fakeCodex(dir, "assert-pins");
  const outputFile = path.join(dir, "verdict-header.txt");
  runCodex({ prompt: "converge", outputFile, bin });
  const captured = fs.readFileSync(outputFile, "utf8");
  assert.match(captured, new RegExp(`model=${PINNED_CODEX_MODEL}`));
  assert.match(captured, new RegExp(`${REASONING_EFFORT_CONFIG_KEY}=${PINNED_REASONING_EFFORT}`));
  // the raw codex stdout still follows the header intact (capture-not-tail).
  assert.match(captured, /MERGE-SAFE: verdict from/);
});

// --- guards on required inputs (unchanged behavior) --------------------------

test("runCodex requires a non-empty prompt and an outputFile", () => {
  assert.throws(() => runCodex({ outputFile: "/tmp/x" }), /non-empty prompt/);
  assert.throws(() => runCodex({ prompt: "" , outputFile: "/tmp/x" }), /non-empty prompt/);
  assert.throws(() => runCodex({ prompt: "hi" }), /outputFile is required/);
});
