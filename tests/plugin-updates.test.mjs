// tests/plugin-updates.test.mjs — the plugin currency/update engine contract.
//
// Proves, against a SANDBOX plugin registry (never the real ~/.claude):
//   1. Discovery is runtime + GENERIC: plugins are found via the manifest
//      opt-in marker (x-cinatra-dev-tools.update) or the marketplace-source
//      owner — never via a hardcoded plugin name. Fixture plugins use made-up
//      names to prove name-independence.
//   2. The CHECK path is read-only: it never invokes a mutating command.
//   3. installed -> available is reported from cached marketplace metadata
//      and (network mode) a read-only ls-remote sha compare.
//   4. Every "not possible" case degrades to a VISIBLE record with the exact
//      manual command — never a silent skip: missing marketplace, no source
//      metadata, undeterminable version, pinned/held, editable checkout,
//      capability expansion, CLI/update failures (auth, read-only fs).
//   5. Apply is strictly per-plugin + per-marketplace scoped (never a broad
//      untargeted update), only in auto/apply mode, and never installs a NEW
//      plugin.
//   6. notify-only mode never applies anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const engine = require("../bin/lib/plugin-updates.cjs");

// --- sandbox fixture ---------------------------------------------------------

function makeSandbox(label) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `plug-upd-${label}-`));
  fs.mkdirSync(path.join(home, ".claude", "plugins"), { recursive: true });
  return home;
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

// A fake `run` that records every spawn and answers from a scripted table.
function makeRun(script = {}) {
  const calls = [];
  const run = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    const key = `${cmd} ${args.join(" ")}`;
    for (const [prefix, res] of Object.entries(script)) {
      if (key.startsWith(prefix)) return { ok: true, code: 0, stdout: "", stderr: "", timedOut: false, error: null, ...res };
    }
    return { ok: false, code: 1, stdout: "", stderr: "no script for: " + key, timedOut: false, error: null };
  };
  return { run, calls };
}

function makeDeps(home, script) {
  const { run, calls } = makeRun(script);
  return {
    deps: {
      run,
      homedir: () => home,
      existsSync: (p) => fs.existsSync(p),
      readFileSync: (p) => fs.readFileSync(p, "utf8"),
    },
    calls,
  };
}

// Build a standard registry: two family plugins (one via marker, one via the
// marketplace-source owner) + one unrelated third-party plugin.
function seedRegistry(home, { markerVersionAvailable = "1.1.0" } = {}) {
  const root = path.join(home, ".claude", "plugins");
  const markerInstall = path.join(root, "cache", "mkt-a", "alpha-pack", "1.0.0");
  const ownerInstall = path.join(root, "cache", "mkt-b", "beta-pack", "2.0.0");
  const otherInstall = path.join(root, "cache", "elsewhere", "other-plugin", "3.0.0");

  writeJson(path.join(root, "installed_plugins.json"), {
    version: 2,
    plugins: {
      "alpha-pack@mkt-a": [
        { scope: "user", installPath: markerInstall, version: "1.0.0", gitCommitSha: "a".repeat(40) },
      ],
      "beta-pack@mkt-b": [
        { scope: "user", installPath: ownerInstall, version: "2.0.0", gitCommitSha: "b".repeat(40) },
      ],
      "other-plugin@elsewhere": [
        { scope: "user", installPath: otherInstall, version: "3.0.0", gitCommitSha: "c".repeat(40) },
      ],
    },
  });
  writeJson(path.join(root, "known_marketplaces.json"), {
    "mkt-a": {
      source: { source: "git", url: "https://github.com/some-other-org/alpha-pack.git" },
      installLocation: path.join(root, "marketplaces", "mkt-a"),
    },
    "mkt-b": {
      source: { source: "git", url: "https://github.com/cinatra-ai/beta-pack.git" },
      installLocation: path.join(root, "marketplaces", "mkt-b"),
    },
    elsewhere: {
      source: { source: "github", repo: "someone/other-plugin" },
      installLocation: path.join(root, "marketplaces", "elsewhere"),
    },
  });

  // installed manifests: alpha-pack opts in via the marker; the others do not.
  writeJson(path.join(markerInstall, ".claude-plugin", "plugin.json"), {
    name: "alpha-pack",
    version: "1.0.0",
    "x-cinatra-dev-tools": { update: true },
  });
  writeJson(path.join(ownerInstall, ".claude-plugin", "plugin.json"), { name: "beta-pack", version: "2.0.0" });
  writeJson(path.join(otherInstall, ".claude-plugin", "plugin.json"), { name: "other-plugin", version: "3.0.0" });

  // cached marketplace metadata: alpha has a newer version; beta is current.
  writeJson(path.join(root, "marketplaces", "mkt-a", ".claude-plugin", "marketplace.json"), {
    name: "mkt-a",
    plugins: [{ name: "alpha-pack", version: markerVersionAvailable, source: "." }],
  });
  writeJson(path.join(root, "marketplaces", "mkt-a", ".claude-plugin", "plugin.json"), {
    name: "alpha-pack",
    version: markerVersionAvailable,
    "x-cinatra-dev-tools": { update: true },
  });
  writeJson(path.join(root, "marketplaces", "mkt-b", ".claude-plugin", "marketplace.json"), {
    name: "mkt-b",
    plugins: [{ name: "beta-pack", version: "2.0.0", source: "." }],
  });
  return { root, markerInstall, ownerInstall };
}

// --- discovery ----------------------------------------------------------------

test("discovery is generic: marker opt-in + family source owner; unrelated plugins excluded", () => {
  const home = makeSandbox("disc");
  seedRegistry(home);
  const { deps } = makeDeps(home);
  const check = engine.checkUpdates({ deps, network: false });
  const ids = check.plugins.map((p) => p.id).sort();
  assert.deepEqual(ids, ["alpha-pack@mkt-a", "beta-pack@mkt-b"]);
  assert.equal(check.source, "registry");
});

test("no hardcoded plugin names: the engine source names no specific installable plugin", () => {
  const src = fs.readFileSync(new URL("../bin/lib/plugin-updates.cjs", import.meta.url), "utf8");
  // the only identity baked in is the PUBLIC org owner + the generic marker key
  for (const name of ["alpha-pack", "beta-pack", "cinatra-foundation"]) {
    assert.ok(!src.includes(name), `engine source must not name a plugin: ${name}`);
  }
});

test("registry fallback: unreadable registry falls back to `claude plugin list --json`", () => {
  const home = makeSandbox("fallback");
  const root = path.join(home, ".claude", "plugins");
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "installed_plugins.json"), "{not json");
  const install = path.join(root, "cache", "m", "gamma-pack", "1.0.0");
  writeJson(path.join(install, ".claude-plugin", "plugin.json"), {
    name: "gamma-pack",
    "x-cinatra-dev-tools": { update: true },
  });
  const { deps, calls } = makeDeps(home, {
    "claude plugin list --json": {
      ok: true,
      stdout: JSON.stringify([{ id: "gamma-pack@m", version: "1.0.0", scope: "user", installPath: install }]),
    },
  });
  const check = engine.checkUpdates({ deps, network: false });
  assert.equal(check.source, "cli");
  assert.deepEqual(check.plugins.map((p) => p.id), ["gamma-pack@m"]);
  assert.ok(calls.some((c) => c.cmd === "claude" && c.args.join(" ") === "plugin list --json"));
});

test("CLI missing + no registry degrades to a visible error, never a throw", () => {
  const home = makeSandbox("nocli");
  const { deps } = makeDeps(home, {
    "claude plugin list --json": { ok: false, code: null, error: "spawn claude ENOENT" },
  });
  const check = engine.checkUpdates({ deps, network: false });
  assert.equal(check.ok, false);
  assert.match(check.error, /missing or too old/);
});

// --- check states ---------------------------------------------------------------

test("check (offline): reports installed -> available from cached metadata; check path never mutates", () => {
  const home = makeSandbox("check");
  seedRegistry(home);
  const { deps, calls } = makeDeps(home);
  const check = engine.checkUpdates({ deps, network: false });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  const beta = check.plugins.find((p) => p.name === "beta-pack");
  assert.equal(alpha.state, "update-available");
  assert.equal(alpha.installedVersion, "1.0.0");
  assert.equal(alpha.availableVersion, "1.1.0");
  assert.equal(alpha.autoEligible, true);
  assert.equal(beta.state, "current");
  // offline check spawns nothing at all
  assert.equal(calls.length, 0);
});

test("check (network): read-only ls-remote sha compare flags a moved source; ls-remote is the only spawn", () => {
  const home = makeSandbox("net");
  seedRegistry(home, { markerVersionAvailable: "1.0.0" }); // cached version equal
  const { deps, calls } = makeDeps(home, {
    "git ls-remote": { ok: true, stdout: `${"f".repeat(40)}\tHEAD\n` },
  });
  const check = engine.checkUpdates({ deps, network: true });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  assert.equal(alpha.state, "update-available");
  assert.match(alpha.reason, /moved past the installed commit/);
  for (const c of calls) {
    assert.equal(c.cmd, "git");
    assert.equal(c.args[0], "ls-remote");
  }
});

test("degrade: undeterminable available version is a visible reason + manual command", () => {
  const home = makeSandbox("undet");
  const { root, markerInstall } = seedRegistry(home);
  fs.rmSync(path.join(root, "marketplaces", "mkt-a"), { recursive: true, force: true });
  const { deps } = makeDeps(home, {
    "git ls-remote": { ok: false, stderr: "fatal: could not resolve host github.com" },
  });
  const check = engine.checkUpdates({ deps, network: true });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  assert.equal(alpha.state, "unknown");
  assert.match(alpha.reason, /undeterminable/);
  assert.match(alpha.reason, /network|unreachable/);
  assert.equal(alpha.manualCommand, "claude plugin marketplace update mkt-a && claude plugin update alpha-pack@mkt-a --scope user");
  assert.ok(markerInstall); // fixture sanity
});

test("degrade: auth failure on the remote check is named as an auth problem", () => {
  const home = makeSandbox("auth");
  seedRegistry(home, { markerVersionAvailable: null });
  const { deps } = makeDeps(home, {
    "git ls-remote": { ok: false, stderr: "fatal: could not read Username: terminal prompts disabled" },
  });
  const check = engine.checkUpdates({ deps, network: true });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  assert.equal(alpha.state, "unknown");
  assert.match(alpha.reason, /authentication .* missing or expired/);
});

test("degrade: pinned/held plugin is reported held and never auto-applied", () => {
  const home = makeSandbox("held");
  const { markerInstall } = seedRegistry(home);
  writeJson(path.join(markerInstall, ".claude-plugin", "plugin.json"), {
    name: "alpha-pack",
    "x-cinatra-dev-tools": { update: true, hold: true },
  });
  const { deps, calls } = makeDeps(home);
  const check = engine.checkUpdates({ deps, network: false });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  assert.equal(alpha.state, "held");
  const applied = engine.applyUpdates(check, { deps: makeDeps(home).deps, mode: "auto" });
  const rec = applied.results.find((r) => r.id === "alpha-pack@mkt-a");
  assert.equal(rec.action, "notify");
  assert.ok(rec.manualCommand);
  assert.equal(calls.length, 0);
});

test("degrade: editable/local checkout (a .git dir inside the installed copy) is never clobbered", () => {
  const home = makeSandbox("edit");
  const { markerInstall } = seedRegistry(home);
  fs.mkdirSync(path.join(markerInstall, ".git"), { recursive: true });
  const { deps } = makeDeps(home);
  const check = engine.checkUpdates({ deps, network: false });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  assert.equal(alpha.state, "editable");
  assert.match(alpha.reason, /editable\/local checkout/);
});

test("degrade: marketplace missing from the registry -> visible re-add instruction", () => {
  const home = makeSandbox("nomkt");
  const { root } = seedRegistry(home);
  const known = JSON.parse(fs.readFileSync(path.join(root, "known_marketplaces.json"), "utf8"));
  delete known["mkt-a"];
  writeJson(path.join(root, "known_marketplaces.json"), known);
  const { deps } = makeDeps(home);
  const check = engine.checkUpdates({ deps, network: false });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  assert.equal(alpha.state, "no-source");
  assert.match(alpha.reason, /marketplace add/);
});

test("degrade: capability expansion (update adds hooks/MCP/permissions) is not auto-eligible", () => {
  const home = makeSandbox("cap");
  const { root } = seedRegistry(home);
  writeJson(path.join(root, "marketplaces", "mkt-a", ".claude-plugin", "plugin.json"), {
    name: "alpha-pack",
    version: "1.1.0",
    "x-cinatra-dev-tools": { update: true },
    hooks: { PostToolUse: [{}] },
    mcpServers: { extra: {} },
  });
  const { deps } = makeDeps(home);
  const check = engine.checkUpdates({ deps, network: false });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  assert.equal(alpha.state, "update-available");
  assert.equal(alpha.autoEligible, false);
  assert.match(alpha.reason, /adds hooks, mcpServers/);
  assert.match(alpha.reason, /explicit consent/);
});

// --- apply ----------------------------------------------------------------------

test("apply (auto): per-marketplace refresh + strictly per-plugin scoped update; never untargeted", () => {
  const home = makeSandbox("apply");
  seedRegistry(home);
  const { deps: checkDeps } = makeDeps(home);
  const check = engine.checkUpdates({ deps: checkDeps, network: false });

  const { deps, calls } = makeDeps(home, {
    "claude plugin marketplace update mkt-a": { ok: true },
    "claude plugin update alpha-pack@mkt-a": { ok: true, stdout: "updated" },
    "claude plugin list --json": { ok: true, stdout: "[]" },
  });
  const applied = engine.applyUpdates(check, { deps, mode: "auto" });
  assert.equal(applied.applied, 1);
  const argvs = calls.filter((c) => c.cmd === "claude").map((c) => c.args.join(" "));
  assert.ok(argvs.includes("plugin marketplace update mkt-a"), "marketplace refresh must be scoped by name");
  assert.ok(argvs.includes("plugin update alpha-pack@mkt-a --scope user"), "update must target one plugin@marketplace");
  assert.ok(!argvs.includes("plugin marketplace update"), "no untargeted marketplace update");
  assert.ok(!argvs.some((a) => /^plugin update( --scope \w+)?$/.test(a)), "no untargeted plugin update");
  // it never runs `plugin install` — updates only, never a NEW install
  assert.ok(!argvs.some((a) => a.startsWith("plugin install")), "must never install a new plugin");
});

test("apply (notify-only): reports the available update + manual command, applies nothing", () => {
  const home = makeSandbox("notify");
  seedRegistry(home);
  const { deps: checkDeps } = makeDeps(home);
  const check = engine.checkUpdates({ deps: checkDeps, network: false });
  const { deps, calls } = makeDeps(home);
  const applied = engine.applyUpdates(check, { deps, mode: "notify-only" });
  assert.equal(applied.applied, 0);
  const rec = applied.results.find((r) => r.id === "alpha-pack@mkt-a");
  assert.equal(rec.action, "notify");
  assert.match(rec.detail, /notify-only mode, not applied/);
  assert.equal(rec.manualCommand, "claude plugin marketplace update mkt-a && claude plugin update alpha-pack@mkt-a --scope user");
  assert.equal(calls.length, 0, "notify-only must spawn nothing");
});

test("apply degrade: marketplace refresh auth failure -> visible notify + manual command", () => {
  const home = makeSandbox("applyauth");
  seedRegistry(home);
  const check = engine.checkUpdates({ deps: makeDeps(home).deps, network: false });
  const { deps } = makeDeps(home, {
    "claude plugin marketplace update mkt-a": { ok: false, stderr: "Permission denied (publickey)" },
  });
  const applied = engine.applyUpdates(check, { deps, mode: "auto" });
  const rec = applied.results.find((r) => r.id === "alpha-pack@mkt-a");
  assert.equal(rec.action, "notify");
  assert.match(rec.detail, /authentication .* missing or expired/);
  assert.ok(rec.manualCommand);
});

test("apply degrade: read-only filesystem / permission failure is named", () => {
  const home = makeSandbox("rofs");
  seedRegistry(home);
  const check = engine.checkUpdates({ deps: makeDeps(home).deps, network: false });
  const { deps } = makeDeps(home, {
    "claude plugin marketplace update mkt-a": { ok: true },
    "claude plugin update alpha-pack@mkt-a": { ok: false, stderr: "EROFS: read-only file system" },
  });
  const applied = engine.applyUpdates(check, { deps, mode: "auto" });
  const rec = applied.results.find((r) => r.id === "alpha-pack@mkt-a");
  assert.equal(rec.action, "notify");
  assert.match(rec.detail, /read-only or permission/);
});

test("apply degrade: too-old CLI (unknown command) is named with the manual fallback", () => {
  const home = makeSandbox("oldcli");
  seedRegistry(home);
  const check = engine.checkUpdates({ deps: makeDeps(home).deps, network: false });
  const { deps } = makeDeps(home, {
    "claude plugin marketplace update mkt-a": { ok: true },
    "claude plugin update alpha-pack@mkt-a": { ok: false, stderr: "error: unknown command 'update'" },
  });
  const applied = engine.applyUpdates(check, { deps, mode: "auto" });
  const rec = applied.results.find((r) => r.id === "alpha-pack@mkt-a");
  assert.match(rec.detail, /missing or too old/);
  assert.ok(rec.manualCommand);
});

test("apply gate fails CLOSED: unverifiable capability surface after refresh is never auto-applied", () => {
  const home = makeSandbox("capunknown");
  const { root } = seedRegistry(home);
  // the marketplace clone has catalog metadata (so the update is detected) but
  // the plugin manifest itself is unreadable -> capability change unverifiable
  fs.rmSync(path.join(root, "marketplaces", "mkt-a", ".claude-plugin", "plugin.json"), { force: true });
  const check = engine.checkUpdates({ deps: makeDeps(home).deps, network: false });
  const alpha = check.plugins.find((p) => p.name === "alpha-pack");
  assert.equal(alpha.state, "update-available");
  const { deps, calls } = makeDeps(home, {
    "claude plugin marketplace update mkt-a": { ok: true },
  });
  const applied = engine.applyUpdates(check, { deps, mode: "auto" });
  const rec = applied.results.find((r) => r.id === "alpha-pack@mkt-a");
  assert.equal(rec.action, "notify");
  assert.match(rec.detail, /cannot verify .* hooks\/MCP\/permissions/);
  // the refresh ran, but the plugin update itself was never spawned
  const argvs = calls.filter((c) => c.cmd === "claude").map((c) => c.args.join(" "));
  assert.ok(argvs.includes("plugin marketplace update mkt-a"));
  assert.ok(!argvs.some((a) => a.startsWith("plugin update")), "fail-closed: no update spawn");
});

test("empty-but-valid registry is authoritative: no CLI fallback, no false error", () => {
  const home = makeSandbox("empty");
  writeJson(path.join(home, ".claude", "plugins", "installed_plugins.json"), { version: 2, plugins: {} });
  const { deps, calls } = makeDeps(home);
  const check = engine.checkUpdates({ deps, network: false });
  assert.equal(check.ok, true);
  assert.equal(check.source, "registry");
  assert.deepEqual(check.plugins, []);
  assert.equal(calls.length, 0);
});

// --- mode knob -------------------------------------------------------------------

test("mode knob: default auto; .cinatra-dev/config.json currency.plugin=notify-only respected; junk ignored", () => {
  const home = makeSandbox("knob");
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "plug-upd-proj-"));
  const { deps } = makeDeps(home);
  assert.equal(engine.resolveUpdateMode(proj, deps), "auto");
  writeJson(path.join(proj, ".cinatra-dev", "config.json"), { currency: { plugin: "notify-only" } });
  assert.equal(engine.resolveUpdateMode(proj, deps), "notify-only");
  writeJson(path.join(proj, ".cinatra-dev", "config.json"), { currency: { plugin: "yolo" } });
  assert.equal(engine.resolveUpdateMode(proj, deps), "auto");
});

// --- doctor wiring -----------------------------------------------------------------

test("doctor plugin currency: offline default is unknown + exact commands; online is read-only checked", () => {
  const doctor = require("../bin/lib/doctor.cjs");
  const off = doctor.pluginCurrencyStatus("auto", { online: false });
  assert.equal(off.status, "unknown");
  assert.match(off.command, /doctor --online/);
  assert.match(off.command, /plugin-update/);

  const home = makeSandbox("doconline");
  seedRegistry(home);
  const { deps, calls } = makeDeps(home, {
    // alpha is update-available by VERSION; beta's remote sha matches -> current
    "git ls-remote https://github.com/some-other-org/alpha-pack.git": { ok: true, stdout: `${"a".repeat(40)}\tHEAD\n` },
    "git ls-remote https://github.com/cinatra-ai/beta-pack.git": { ok: true, stdout: `${"b".repeat(40)}\tHEAD\n` },
  });
  const on = doctor.pluginCurrencyStatus("auto", { online: true, deps });
  assert.equal(on.status, "checked");
  assert.equal(on.plugins.length, 2);
  assert.match(on.detail, /1 update\(s\) available/);
  // read-only: nothing but ls-remote was spawned
  for (const c of calls) assert.equal(`${c.cmd} ${c.args[0]}`, "git ls-remote");
});
