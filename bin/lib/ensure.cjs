"use strict";
// ---------------------------------------------------------------------------
// ensure — the SHARED detect -> consent -> apply path (claude-plugin#16).
//
// This is the one place that turns a doctor probe result into a consented
// install/config action. It does NOT reimplement any installer: it interprets
// an EXISTING doctor probe's ok/warn/fail verdict, and on request runs the
// EXISTING fix (e.g. `shadcn-install.cjs`) for that one named tool. A skill
// (`cinatra-dev-tools`, `setup`, ...) shells out to this so the LLM never
// free-decides what "needs asking" means — parity with the "skills shell out
// to dev-tools" pattern doctor.cjs and plugin-updates.cjs already follow.
//
// Consent model (the pack's shared doctrine — mirrors `setup`'s dry-run +
// confirm shape):
//   - checkTool()  — READ-ONLY. Runs the tool's doctor probe only. NEVER
//                    installs. If action is needed, returns the EXACT fix
//                    command + a ready-to-relay consent prompt.
//   - applyTool()  — runs the fix ONLY for the one named tool, then RE-PROBES
//                    (the same probe used for detection) to report the actual
//                    resulting state — never trusts the installer's own return
//                    value blindly (the pack's evidence rule: confirm a change
//                    actually landed). A tool already `ok` is a no-op.
//   - ensureTool() — the single entrypoint a skill calls: `apply:false`
//                    (default) is the ask surface; `apply:true` is the
//                    already-consented install. The caller (the skill / the
//                    human operating it) owns the actual asking — this module
//                    never assumes consent and never installs on the read-only
//                    path.
//
// The TOOLS registry is the "shared" part: adding a new ensurable tool means
// adding one entry (probe + fixCommand + apply), not a bespoke ask-then-fix
// flow per tool. `setup` and `cinatra-dev-tools` both call the SAME entrypoint
// so consent behaviour never drifts between skills.
// ---------------------------------------------------------------------------

const doctor = require("./doctor.cjs");
// Reuse the EXISTING copy/paste-safe quoting helper (never a parallel
// re-implementation) — plugin-updates.cjs's `manualCommand` already solves
// the identical problem (an operator-relayed command built from filesystem-
// derived values must round-trip through a shell safely).
const { shQuote } = require("./plugin-updates.cjs");

// One entry per ensurable tool: { label, probe(deps) -> checks[], fixCommand,
// apply(deps, opts) -> result }. `probe` reuses an EXISTING doctor probe (never
// a parallel detection path); `apply` reuses an EXISTING installer.
const TOOLS = {
  "shadcn-skill": {
    label: "shadcn skill (Claude + Codex)",
    probe: (deps) => doctor.probeShadcnSkill(deps),
    fixCommand: "node $CLAUDE_PLUGIN_ROOT/bin/dev-tools.cjs shadcn-install",
    apply: (deps, opts = {}) => {
      // Lazy require (parity with dev-tools.cjs's own lazy requires) — the
      // installer is network-dependent and only needed on the apply path.
      const shadcnInstall = require("./shadcn-install.cjs");
      const home = opts.home || deps.homedir();
      return shadcnInstall.installShadcnForBothTools({
        home,
        codexHome: opts.codexHome,
        force: Boolean(opts.force),
      });
    },
  },
};

function listTools() {
  return Object.keys(TOOLS);
}

// Build the effective deps for a probe/apply call. An explicit `deps` always
// wins (tests inject their own). Otherwise, when the caller passed a `home`
// and/or `codexHome` override (the CLI's --home/--codex-home), wrap the
// plain machine deps so BOTH legs — the read-only check AND the post-apply
// re-verify — resolve against the SAME overridden location as the install
// itself, instead of silently falling back to the real machine home. Without
// this, checking/re-verifying a sandboxed --home would read the real ~/.claude
// while --apply installed into the sandbox, producing a false "still missing"
// verdict for a install that actually succeeded.
function resolveDeps({ deps, home, codexHome } = {}) {
  if (deps) return deps;
  if (!home && !codexHome) return doctor.defaultDeps();
  const base = doctor.defaultDeps();
  return {
    ...base,
    homedir: home ? () => home : base.homedir,
    env: () => ({ ...process.env, ...(codexHome ? { CODEX_HOME: codexHome } : {}) }),
  };
}

// Compose the EXACT fix command for what was actually probed (codex round-1,
// claude-plugin#16): a tool's `fixCommand` is a static base string, but when
// the caller overrode --home/--codex-home for THIS check, the plain base
// command would fix the real machine home instead of the sandbox that was
// just checked — not "the exact command" the issue's consent prompt promises.
// Append the SAME overrides so the advertised command reproduces the checked
// target. `--force` is deliberately NOT appended here: it is an apply-time
// safety override (whether to clobber a foreign dir), not something that
// changes what a read-only check probed, so unconditionally suggesting it
// would misrepresent a plain missing-install as needing a force-overwrite.
//
// home/codexHome are shell-quoted (codex round-2, claude-plugin#16): they are
// filesystem paths that can legally contain spaces or shell metacharacters,
// and this string is meant for operator copy/paste into a real shell — an
// unquoted value would either not reproduce the checked target or, worse,
// parse as extra shell syntax. Same helper plugin-updates.cjs already uses
// for its own copy/paste `manualCommand` — not a parallel re-implementation.
function buildFixCommand(base, { home, codexHome } = {}) {
  let cmd = base;
  if (home) cmd += ` --home ${shQuote(home)}`;
  if (codexHome) cmd += ` --codex-home ${shQuote(codexHome)}`;
  return cmd;
}

// READ-ONLY: probe the named tool and report whether it needs action. NEVER
// installs anything, regardless of the result.
function checkTool(toolId, { deps, home, codexHome, registry = TOOLS } = {}) {
  const spec = registry[toolId];
  const d = resolveDeps({ deps, home, codexHome });
  if (!spec) {
    return { tool: toolId, status: "unknown", error: `unknown ensure target: ${toolId} (known: ${Object.keys(registry).join(", ") || "none"})` };
  }
  const checks = spec.probe(d);
  const summary = doctor.summarize(checks);
  const needsAction = summary.verdict !== "ok";
  const fixCommand = needsAction ? buildFixCommand(spec.fixCommand, { home, codexHome }) : null;
  return {
    tool: toolId,
    label: spec.label,
    status: summary.verdict,
    checks,
    needsAction,
    fixCommand,
    prompt: needsAction
      ? `${spec.label} is ${summary.verdict === "fail" ? "missing" : "not fully set up"}. Install/configure it now? Exact command: ${fixCommand}`
      : null,
  };
}

// Run the named tool's fix, ONLY when checkTool() says action is needed —
// already-ok is a clean no-op. Re-probes afterward (the SAME probe) rather
// than trusting the installer's own return value, so a partial/failed install
// is reported honestly instead of a false "installed".
function applyTool(toolId, { deps, home, codexHome, registry = TOOLS, ...applyOpts } = {}) {
  const spec = registry[toolId];
  const d = resolveDeps({ deps, home, codexHome });
  if (!spec) {
    return { tool: toolId, ok: false, status: "unknown", error: `unknown ensure target: ${toolId} (known: ${Object.keys(registry).join(", ") || "none"})` };
  }
  // `before`/`after` reuse the SAME (possibly home/codexHome-overridden) deps
  // as the apply call below, so a sandboxed install is checked and re-verified
  // against the sandbox it actually targeted — never the real machine home.
  // Also forward the raw home/codexHome (not just `deps: d`) so their
  // fixCommand/prompt stay accurate for a sandbox too (same "exact command"
  // fix as checkTool's own — otherwise a failed sandboxed apply would report
  // an `after.fixCommand` that silently drops the --home/--codex-home used).
  const before = checkTool(toolId, { deps: d, home, codexHome, registry });
  if (!before.needsAction) {
    return { tool: toolId, ok: true, action: "none", label: spec.label, detail: `${spec.label} already present — no-op`, before, after: before };
  }
  let installResult = null;
  let installError = null;
  try {
    installResult = spec.apply(d, { home, codexHome, ...applyOpts });
  } catch (e) {
    installError = e.message || String(e);
  }
  const after = checkTool(toolId, { deps: d, home, codexHome, registry });
  const ok = !installError && !after.needsAction;
  return {
    tool: toolId,
    ok,
    action: ok ? "installed" : "failed",
    label: spec.label,
    detail: ok
      ? `${spec.label} installed and verified present`
      : `${spec.label} install did not complete${installError ? `: ${installError}` : " (still reported missing/misconfigured after install — see 'after')"}`,
    installResult,
    installError,
    before,
    after,
  };
}

// The single shared entrypoint. `apply:false` (default) is the READ-ONLY ask
// surface (checkTool); `apply:true` is the already-consented install
// (applyTool). Callers never get an install by accident — the flag must be
// explicit, and it is set only after a human said yes. `home`/`codexHome`
// (the CLI's --home/--codex-home) flow through to BOTH branches, so a check
// against a sandbox and a later --apply against the SAME sandbox agree.
function ensureTool(toolId, { deps, home, codexHome, apply = false, registry = TOOLS, ...applyOpts } = {}) {
  if (!apply) return checkTool(toolId, { deps, home, codexHome, registry });
  return applyTool(toolId, { deps, home, codexHome, registry, ...applyOpts });
}

module.exports = { TOOLS, listTools, checkTool, applyTool, ensureTool };
