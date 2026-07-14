"use strict";
// ---------------------------------------------------------------------------
// codex-bridge — the one sanctioned way to invoke codex for convergence.
//
// Codex MUST be driven via STDIN (`codex exec --skip-git-repo-check < prompt`);
// passing the prompt as an argv hangs. The verdict is CAPTURED to a file, never
// tail-piped (capture-not-tail integrity). Read-only / advisory. The
// dev-codex-pairing skill shells out to this helper so the discipline can't
// drift to a hanging argv invocation.
//
// W0 ships the command BUILDER + a guard that rejects argv-prompt misuse
// (pure + testable). The skill calls runCodex() at runtime.
// ---------------------------------------------------------------------------

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

// The convergence run is pinned to an explicit model and reasoning effort so a
// captured verdict is always attributable to a KNOWN model + effort — never the
// CLI's ambient default (which can change under us and leaves a verdict
// unattributable). The model tracks the latest Codex (currently GPT-5.6 "sol");
// the id below was resolved from the installed CLI, not guessed.
//
// The effort is the maximum reasoning tier this model actually runs at. The
// installed CLI's model catalog (`codex debug models`) reports this model's
// supported reasoning levels, in ascending order, as low, medium, high, xhigh,
// max, ultra — so xhigh is NOT the ceiling. `max` is described as "maximum
// reasoning depth for the hardest problems"; `ultra` is that same maximum
// reasoning PLUS automatic task delegation (a multi-agent mode). Delegation
// would change this bridge's contract — read-only, advisory, a single captured
// verdict, bounded rounds — so we pin `max`: the highest reasoning effort that
// leaves the pairing mechanics unchanged. (Do NOT read the enum printed in a
// truly-invalid value's error text as the ceiling: that message is a static
// list that omits max/ultra, yet the model runs both — verified live, the pinned
// invocation executes at `reasoning effort: max`. The authoritative source is
// the per-model catalog, cross-checked against a real run.)
//
// These flags are ALWAYS applied, and always under `--strict-config`, so BOTH
// failure shapes surface visibly (a non-zero exit → ok:false) instead of a
// silent downgrade to the ambient default: an unsupported reasoning-effort VALUE
// is rejected by the model (a non-zero exit), and an unrecognized config KEY
// (e.g. a future CLI that renames or drops `model_reasoning_effort`) errors out
// too — WITHOUT --strict-config the CLI silently ignores an unknown `-c` key,
// which would leave the recorded header/result claiming a value the run never
// actually applied.
const PINNED_CODEX_MODEL = "gpt-5.6-sol";
const PINNED_REASONING_EFFORT = "max";
const REASONING_EFFORT_CONFIG_KEY = "model_reasoning_effort";

// The convergence run is also pinned to the `read-only` sandbox: it is
// **advisory** — codex reads the source and returns a verdict; it must NOT be
// able to WRITE to the worktree it is reviewing. `codex exec` defaults to
// `workspace-write` when `-s` is omitted, so the sandbox is pinned explicitly
// (the bare STDIN invocation this bridge replaced silently ran writable).
const PINNED_SANDBOX = "read-only";

// A caller must NOT re-specify the pinned model or reasoning effort — or escalate
// the pinned sandbox — through extraArgs. The CLI applies a later `-m`/`-c <key>=`
// /`-s` on a last-write-wins basis, so a trailing override would silently defeat
// the pin while the recorded header + result still claim the pinned values — a
// misattributed verdict (or, for the sandbox, a silently-writable "read-only"
// run), the exact failure these pins exist to prevent. So reject any extraArg
// that targets the model, a pinned config key, or the sandbox, in every
// short/long/attached/`=`-joined form the CLI accepts. A redundant `-s read-only`
// (restating the pin) is harmless and allowed; any other sandbox value — and the
// value-less sandbox-escalating flags below — is an escalation and is rejected.
const MODEL_FLAGS = new Set(["-m", "--model"]);
const CONFIG_FLAGS = new Set(["-c", "--config"]);
const PINNED_CONFIG_KEYS = new Set(["model", REASONING_EFFORT_CONFIG_KEY, "sandbox_mode"]);
const SANDBOX_FLAGS = new Set(["-s", "--sandbox"]);
// Value-less flags that escalate away from the pinned read-only sandbox or drop
// the safety envelope — each incompatible with an advisory, read-only run:
//   --dangerously-bypass-approvals-and-sandbox / --yolo : no sandbox at all
//     (`--yolo` is the CLI's accepted alias for the long form).
//   --full-auto : the CLI's deprecated alias for `--sandbox workspace-write`
//     (writable) — it does not go through `-s`, so it needs its own entry.
//   --dangerously-bypass-hook-trust : runs untrusted lifecycle hooks — not a
//     sandbox-mode change, but untrusted hook commands defeat an advisory run.
const SANDBOX_ESCALATING_FLAGS = new Set([
  "--dangerously-bypass-approvals-and-sandbox",
  "--yolo",
  "--full-auto",
  "--dangerously-bypass-hook-trust",
]);

function assertNoPinnedOverride(extraArgs) {
  for (let i = 0; i < extraArgs.length; i++) {
    const a = extraArgs[i];
    // Model override: `-m x` / `--model x` / `--model=x` / `-mx`.
    if (MODEL_FLAGS.has(a) || a.startsWith("--model=") || /^-m.+/.test(a)) {
      throw new Error("codex-bridge: the model is pinned — extraArgs must not set -m/--model");
    }
    // Config override: extract the `key=value` payload whether it is the next
    // token (`-c key=v`), `=`-joined (`--config=key=v`, `-c=key=v`), or attached
    // (`-ckey=v`), then reject only when the key is one we pin.
    let payload = null;
    if (CONFIG_FLAGS.has(a)) payload = extraArgs[i + 1];
    else if (a.startsWith("--config=")) payload = a.slice("--config=".length);
    else if (a.startsWith("-c=")) payload = a.slice("-c=".length);
    else if (/^-c.+/.test(a)) payload = a.slice(2);
    if (payload != null) {
      const key = String(payload).split("=", 1)[0].trim();
      if (PINNED_CONFIG_KEYS.has(key)) {
        throw new Error(`codex-bridge: '${key}' is pinned — extraArgs must not override it via -c/--config`);
      }
    }
    // Sandbox escalation via a value-less flag (bypass / --yolo / --full-auto /
    // bypass-hook-trust): reject unconditionally.
    if (SANDBOX_ESCALATING_FLAGS.has(a)) {
      throw new Error("codex-bridge: the sandbox is pinned read-only — extraArgs must not escalate or bypass it");
    }
    // Sandbox override: `-s x` / `--sandbox x` / `--sandbox=x` / `-s=x` / `-sx`.
    // A redundant `read-only` is allowed; any other value is an escalation.
    let sandbox = null;
    if (SANDBOX_FLAGS.has(a)) sandbox = extraArgs[i + 1];
    else if (a.startsWith("--sandbox=")) sandbox = a.slice("--sandbox=".length);
    else if (a.startsWith("-s=")) sandbox = a.slice("-s=".length);
    else if (/^-s.+/.test(a)) sandbox = a.slice(2);
    if (sandbox != null && String(sandbox).trim() !== PINNED_SANDBOX) {
      throw new Error(`codex-bridge: the sandbox is pinned '${PINNED_SANDBOX}' — extraArgs must not set -s/--sandbox to '${sandbox}'`);
    }
  }
}

// Build the argv for a codex exec convergence run. The prompt is supplied on
// STDIN by the caller — it is NEVER placed in this argv. Throws if a caller
// tries to smuggle a prompt as an argument, or to override the pinned model /
// reasoning effort via extraArgs.
function buildCodexArgs({ extraArgs = [] } = {}) {
  for (const a of extraArgs) {
    if (typeof a !== "string") throw new Error("codex args must be strings");
  }
  assertNoPinnedOverride(extraArgs);
  // The prompt is read from stdin; --skip-git-repo-check lets it run in a
  // scratch dir that is not a git repo. --strict-config makes an unrecognized
  // pinned config key a HARD error (so a renamed/dropped key cannot be silently
  // ignored — the fail-closed guarantee this pin exists to give). `-s read-only`
  // pins the advisory sandbox (codex must not write to the worktree it reviews;
  // exec defaults to writable). The pinned sandbox + model + reasoning effort are
  // emitted unconditionally (not folded into caller-supplied extraArgs) so no
  // invocation path can bypass a pin.
  return [
    "exec",
    "--strict-config",
    "--skip-git-repo-check",
    "-s", PINNED_SANDBOX,
    "-m", PINNED_CODEX_MODEL,
    "-c", `${REASONING_EFFORT_CONFIG_KEY}=${PINNED_REASONING_EFFORT}`,
    ...extraArgs,
  ];
}

// Default subprocess timeout: a stuck `codex` run must never hang the flow
// indefinitely. 15 minutes is generous for a convergence pass; callers can
// override via `timeoutMs`.
const DEFAULT_CODEX_TIMEOUT_MS = 15 * 60 * 1000;

// Run codex with the prompt on STDIN and capture stdout/stderr to a file.
// Returns { ok, code, outputFile, timedOut }. Read-only/advisory; failures are
// surfaced, not thrown, so the caller can decide. A timeout kills the process
// (SIGKILL) and is reported as timedOut:true (ok:false) so the caller never
// mistakes a hung run for a clean verdict.
function runCodex({ prompt, outputFile, extraArgs = [], bin = "codex", timeoutMs = DEFAULT_CODEX_TIMEOUT_MS } = {}) {
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new Error("runCodex: a non-empty prompt string is required (passed on STDIN)");
  }
  if (!outputFile) throw new Error("runCodex: outputFile is required (capture-not-tail)");
  const args = buildCodexArgs({ extraArgs });
  const res = spawnSync(bin, args, {
    input: prompt,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });
  const timedOut = res.error && res.error.code === "ETIMEDOUT";
  // Record the pinned model + effort alongside the captured verdict so the
  // verdict is attributable to a specific model and effort. A header is
  // prepended to the captured file (the raw stdout/stderr follows intact) and
  // the pinned values are also returned to the caller. Under --strict-config an
  // ok:true run is proof the pins were applied (an unrecognized key/value would
  // have hard-failed), so these values are the ones the run actually ran with.
  const header = `[codex-bridge] codex exec model=${PINNED_CODEX_MODEL} ${REASONING_EFFORT_CONFIG_KEY}=${PINNED_REASONING_EFFORT}\n\n`;
  let combined = `${header}${res.stdout || ""}${res.stderr || ""}`;
  if (timedOut) {
    combined += `\n[codex-bridge] TIMEOUT after ${timeoutMs}ms — process killed (SIGKILL). Verdict is NOT trustworthy.\n`;
  }
  fs.writeFileSync(outputFile, combined);
  return {
    ok: res.status === 0 && !timedOut,
    code: res.status,
    outputFile,
    timedOut: Boolean(timedOut),
    model: PINNED_CODEX_MODEL,
    reasoningEffort: PINNED_REASONING_EFFORT,
  };
}

module.exports = {
  buildCodexArgs,
  runCodex,
  PINNED_CODEX_MODEL,
  PINNED_REASONING_EFFORT,
  REASONING_EFFORT_CONFIG_KEY,
  PINNED_SANDBOX,
};
