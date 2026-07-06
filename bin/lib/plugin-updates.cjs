"use strict";
// ---------------------------------------------------------------------------
// plugin-updates — Cinatra-family Claude Code plugin currency + update engine.
//
// WHAT: discovers the INSTALLED first-party Cinatra-family plugins at runtime,
// reports installed -> available versions (the doctor `--online` currency
// probe, READ-ONLY), and — as a separate, explicit step — applies per-plugin
// updates via the native `claude plugin` CLI.
//
// DISCOVERY IS GENERIC BY DESIGN. This public engine never hardcodes any
// specific plugin's name, repo, or URL. A plugin is "Cinatra-family" when:
//   (a) its installed manifest (.claude-plugin/plugin.json) carries the
//       opt-in marker  "x-cinatra-dev-tools": { "update": true }   — any
//       plugin, from any source, can opt in; OR
//   (b) its marketplace source is owned by the public Cinatra GitHub org
//       (public metadata: the marketplace's github repo / git URL owner).
// Everything about WHICH plugins exist is runtime data read from the local
// plugin registry, never from this source tree.
//
// REGISTRY READING IS SHAPE-TOLERANT. The primary source is the on-disk
// registry (~/.claude/plugins/installed_plugins.json + known_marketplaces.json
// + the cached marketplace clones); when those are absent or unreadable it
// falls back to `claude plugin list --json`. No exact output shape is assumed:
// unknown fields are ignored, known fields are read defensively, and a plugin
// whose data cannot be interpreted degrades to a VISIBLE notification with the
// exact manual command — never a silent skip.
//
// SAFETY: the CHECK path is read-only (local file reads + an optional bounded
// `git ls-remote`, which mutates nothing). The APPLY path is a separate call
// that only ever runs `claude plugin marketplace update <name>` (scoped to one
// marketplace) and `claude plugin update <plugin>@<marketplace>` (scoped to
// one plugin) — never a broad, untargeted update. Auto-apply covers UPDATES to
// already-installed first-party plugins only; this engine never installs a new
// plugin (installing anything new stays a consented, ask-first action per the
// pack's consent doctrine).
//
// TESTABILITY: deps injectable (same pattern as doctor.cjs) — spawn + fs +
// homedir are faked by tests so behaviour is host-independent.
// ---------------------------------------------------------------------------

const path = require("node:path");
const doctorLib = require("./doctor.cjs");

// Public GitHub org owner(s) whose marketplaces are first-party. This is the
// PUBLIC org this repo itself lives under — public metadata, not a secret.
const FAMILY_OWNERS = ["cinatra-ai"];

// Manifest opt-in marker: any plugin whose .claude-plugin/plugin.json contains
//   "x-cinatra-dev-tools": { "update": true }
// opts in to this engine's currency/update handling.
const MARKER_KEY = "x-cinatra-dev-tools";

const APPLY_TIMEOUT_MS = 120000;
const LS_REMOTE_TIMEOUT_MS = 15000;

function defaultDeps() {
  return doctorLib.defaultDeps();
}

function pluginsRoot(deps) {
  return path.join(deps.homedir(), ".claude", "plugins");
}

function readJsonSafe(p, deps) {
  try {
    if (!deps.existsSync(p)) return null;
    return JSON.parse(deps.readFileSync(p));
  } catch {
    return null;
  }
}

// The exact manual command for one plugin — every degraded case surfaces this.
// Mirrors the apply path exactly, including the install scope. Registry-derived
// values are shell-quoted: the string is meant for copy/paste, so malformed or
// malicious local registry data must not be able to inject shell syntax.
function manualCommand(name, marketplace, scope) {
  if (name && marketplace) {
    return (
      `claude plugin marketplace update ${shQuote(marketplace)} && ` +
      `claude plugin update ${shQuote(`${name}@${marketplace}`)} --scope ${shQuote(scope || "user")}`
    );
  }
  return "claude plugin marketplace update && claude plugin update <plugin>@<marketplace> --scope user";
}

// Quote a value for safe copy/paste into a POSIX shell. Plain identifier-ish
// values pass through unquoted for readability.
function shQuote(value) {
  const v = String(value);
  return /^[A-Za-z0-9@._-]+$/.test(v) ? v : `'${v.replace(/'/g, "'\\''")}'`;
}

// --- registry reading (shape-tolerant) --------------------------------------

// Split an "name@marketplace" id defensively.
function splitId(id) {
  const s = String(id || "");
  const at = s.lastIndexOf("@");
  if (at <= 0) return { name: s || null, marketplace: null };
  return { name: s.slice(0, at), marketplace: s.slice(at + 1) || null };
}

// Normalize one installed-plugin record from any of the shapes we know about
// (registry map entry, registry array entry, CLI list item).
function normalizeEntry(id, raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  let { name, marketplace } = splitId(id || r.id);
  // shape tolerance: honor explicit name/marketplace fields when the id form
  // is absent (no exact CLI output shape is assumed).
  if (!name && typeof r.name === "string") name = r.name;
  if (!marketplace && typeof r.marketplace === "string") marketplace = r.marketplace;
  return {
    id: id || r.id || (name && marketplace ? `${name}@${marketplace}` : name),
    name,
    marketplace,
    scope: typeof r.scope === "string" ? r.scope : "user",
    version: typeof r.version === "string" ? r.version : null,
    installPath: typeof r.installPath === "string" ? r.installPath : null,
    gitCommitSha: typeof r.gitCommitSha === "string" ? r.gitCommitSha : null,
    pinned: Boolean(r.pinned || r.held || r.locked),
  };
}

// Read the installed-plugin set. Primary: the on-disk registry file. Fallback:
// `claude plugin list --json`. Returns { entries, source, error }.
function listInstalled(deps) {
  const regPath = path.join(pluginsRoot(deps), "installed_plugins.json");
  const reg = readJsonSafe(regPath, deps);
  if (reg && typeof reg === "object") {
    const bucket = reg.plugins && typeof reg.plugins === "object" ? reg.plugins : reg;
    const entries = [];
    if (Array.isArray(bucket)) {
      for (const item of bucket) entries.push(normalizeEntry(null, item));
    } else {
      for (const [id, val] of Object.entries(bucket)) {
        if (id === "version") continue;
        const list = Array.isArray(val) ? val : [val];
        for (const item of list) entries.push(normalizeEntry(id, item));
      }
    }
    const usable = entries.filter((e) => e.name);
    // a successfully-parsed registry is authoritative even when EMPTY — only a
    // missing/unparseable registry falls back to the CLI (avoids a false
    // "CLI too old" error on a machine with zero plugins installed).
    if (usable.length || (reg.plugins && typeof reg.plugins === "object")) {
      return { entries: usable, source: "registry", error: null };
    }
  }
  // Fallback: the supported CLI listing (also shape-tolerant).
  const r = deps.run("claude", ["plugin", "list", "--json"]);
  if (r.ok) {
    try {
      const parsed = JSON.parse(r.stdout);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.plugins) ? parsed.plugins : [];
      const entries = arr.map((item) => normalizeEntry(item && item.id, item)).filter((e) => e.name);
      return { entries, source: "cli", error: null };
    } catch {
      return { entries: [], source: "cli", error: "could not parse `claude plugin list --json` output" };
    }
  }
  return {
    entries: [],
    source: "none",
    error:
      "no readable plugin registry and `claude plugin list --json` failed — " +
      "the Claude CLI may be missing or too old for plugin commands",
  };
}

// Read the known-marketplaces map: { [name]: { sourceKind, sourceRef, installLocation } }.
function readMarketplaces(deps) {
  const raw = readJsonSafe(path.join(pluginsRoot(deps), "known_marketplaces.json"), deps);
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [name, val] of Object.entries(raw)) {
    const v = val && typeof val === "object" ? val : {};
    const src = v.source && typeof v.source === "object" ? v.source : {};
    out[name] = {
      sourceKind: typeof src.source === "string" ? src.source : null, // "git" | "github" | "local" | ...
      sourceRef: typeof src.url === "string" ? src.url : typeof src.repo === "string" ? src.repo : null,
      installLocation: typeof v.installLocation === "string" ? v.installLocation : null,
    };
  }
  return out;
}

// Extract the owner (org/user) from a marketplace source ref:
//   "owner/repo"                      -> owner
//   "https://github.com/owner/x.git"  -> owner
//   "git@github.com:owner/x.git"      -> owner
function sourceOwner(sourceRef) {
  const s = String(sourceRef || "");
  if (!s) return null;
  let m = s.match(/^([\w.-]+)\/[\w.-]+$/);
  if (m) return m[1];
  m = s.match(/github\.com[/:]([\w.-]+)\//i);
  if (m) return m[1];
  return null;
}

function readManifest(installPath, deps) {
  if (!installPath) return null;
  return readJsonSafe(path.join(installPath, ".claude-plugin", "plugin.json"), deps);
}

function markerOf(manifest) {
  const marker = manifest && manifest[MARKER_KEY];
  return marker && typeof marker === "object" ? marker : null;
}

function isFamily(entry, marketplaces, manifest) {
  const marker = markerOf(manifest);
  if (marker && marker.update === true) return true;
  const mkt = entry.marketplace ? marketplaces[entry.marketplace] : null;
  const owner = mkt ? sourceOwner(mkt.sourceRef) : null;
  return Boolean(owner && FAMILY_OWNERS.includes(owner));
}

// --- available-version resolution (read-only) --------------------------------

// Cached marketplace metadata: marketplaces/<name>/.claude-plugin/marketplace.json.
function cachedMarketplaceEntry(entry, marketplaces, deps) {
  const mkt = entry.marketplace ? marketplaces[entry.marketplace] : null;
  if (!mkt || !mkt.installLocation) return null;
  const mf = readJsonSafe(path.join(mkt.installLocation, ".claude-plugin", "marketplace.json"), deps);
  if (!mf || !Array.isArray(mf.plugins)) return null;
  return mf.plugins.find((p) => p && p.name === entry.name) || null;
}

// Resolve the AVAILABLE (marketplace-side) plugin manifest from the cached
// marketplace clone, when the plugin entry's `source` is a local path within
// the clone. Unresolvable shapes return null (handled as "unknown").
function availableManifest(entry, marketplaces, deps) {
  const mkt = entry.marketplace ? marketplaces[entry.marketplace] : null;
  const cat = cachedMarketplaceEntry(entry, marketplaces, deps);
  if (!mkt || !mkt.installLocation || !cat) return null;
  const src = cat.source;
  if (typeof src !== "string") return null;
  const rel = src === "." ? "" : src;
  if (rel.includes("..")) return null; // never step outside the clone
  return readJsonSafe(path.join(mkt.installLocation, rel, ".claude-plugin", "plugin.json"), deps);
}

// READ-ONLY remote freshness: `git ls-remote <url> HEAD` (no clone, no write).
function remoteHeadSha(sourceRef, deps) {
  const s = String(sourceRef || "");
  if (!s) return null;
  const url = /^[\w.-]+\/[\w.-]+$/.test(s) ? `https://github.com/${s}.git` : s;
  const r = deps.run("git", ["ls-remote", url, "HEAD"], { timeout: LS_REMOTE_TIMEOUT_MS });
  if (!r.ok) return { sha: null, error: classifyNetworkError(`${r.stderr}\n${r.error || ""}`, r.timedOut) };
  const m = String(r.stdout).match(/^([0-9a-f]{40})\s/m);
  return { sha: m ? m[1] : null, error: m ? null : "unexpected ls-remote output" };
}

function classifyNetworkError(text, timedOut) {
  const t = String(text || "");
  if (timedOut) return "network timeout";
  if (/auth|denied|401|403|publickey|credential|password|terminal prompts disabled/i.test(t)) {
    return "authentication to the plugin source is missing or expired";
  }
  if (/could not resolve|unreachable|proxy|network|connect|timed? out|offline/i.test(t)) {
    return "network / proxy / host unreachable";
  }
  return "remote check failed";
}

// Detect an editable / local / dirty checkout that an update would clobber.
function isEditable(entry, marketplaces, deps) {
  const mkt = entry.marketplace ? marketplaces[entry.marketplace] : null;
  if (mkt && (mkt.sourceKind === "local" || mkt.sourceKind === "directory")) return true;
  // a .git dir inside the installed copy means someone made it a working repo
  return Boolean(entry.installPath && deps.existsSync(path.join(entry.installPath, ".git")));
}

// Capability-expansion check: an update that would CHANGE the hooks / MCP
// servers / permissions surface compared to the installed manifest is NOT
// auto-applied — it degrades to a visible notification (explicit consent
// required). Deep-compares each capability key (not just key presence), so
// new entries under an existing key are caught too. Unknown (either manifest
// unreadable) FAILS CLOSED at apply time.
const CAPABILITY_KEYS = ["hooks", "mcpServers", "permissions"];
function capabilityExpansion(installedManifest, nextManifest) {
  if (!installedManifest || !nextManifest) return { known: false, expanded: false, added: [] };
  const added = [];
  for (const key of CAPABILITY_KEYS) {
    const had = canonical(installedManifest[key]);
    const has = canonical(nextManifest[key]);
    if (had !== has) added.push(key);
  }
  return { known: true, expanded: added.length > 0, added };
}
function canonical(v) {
  if (v == null) return "null";
  try {
    return JSON.stringify(sortDeep(v));
  } catch {
    return String(v);
  }
}
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}

// --- the READ-ONLY check ------------------------------------------------------

// checkUpdates({ deps, network }) -> {
//   ok, source, error,
//   plugins: [ { id, name, marketplace, scope, installedVersion, installedSha,
//                availableVersion, remoteSha, state, autoEligible, reason,
//                manualCommand } ]
// }
// states: "current" | "update-available" | "unknown" | "held" | "editable"
//         | "no-source"
// Every non-"current" record carries `reason` + the exact `manualCommand` —
// a degraded case is a visible notification, never a silent skip.
function checkUpdates({ deps = defaultDeps(), network = false } = {}) {
  const listed = listInstalled(deps);
  const marketplaces = readMarketplaces(deps);
  const records = [];
  for (const entry of listed.entries) {
    const manifest = readManifest(entry.installPath, deps);
    if (!isFamily(entry, marketplaces, manifest)) continue;
    records.push(classify(entry, marketplaces, manifest, deps, { network }));
  }
  return { ok: !listed.error, source: listed.source, error: listed.error, plugins: records };
}

function classify(entry, marketplaces, manifest, deps, { network }) {
  const rec = {
    id: entry.id,
    name: entry.name,
    marketplace: entry.marketplace,
    scope: entry.scope,
    installPath: entry.installPath,
    installedVersion: entry.version,
    installedSha: entry.gitCommitSha,
    availableVersion: null,
    remoteSha: null,
    state: "unknown",
    autoEligible: false,
    reason: null,
    manualCommand: manualCommand(entry.name, entry.marketplace, entry.scope),
  };
  const marker = markerOf(manifest);

  // held / pinned — an explicit hold beats everything else.
  if (entry.pinned || (marker && (marker.hold === true || marker.pin != null))) {
    rec.state = "held";
    rec.reason = "plugin is pinned/held — not auto-updated; unpin, then update manually";
    return rec;
  }
  // editable / local / dirty checkout — never clobber someone's working copy.
  if (isEditable(entry, marketplaces, deps)) {
    rec.state = "editable";
    rec.reason = "installed copy looks like an editable/local checkout — update it from its own source instead";
    return rec;
  }
  const mkt = entry.marketplace ? marketplaces[entry.marketplace] : null;
  if (!mkt) {
    rec.state = "no-source";
    rec.reason =
      "the plugin's marketplace is not in the local registry — re-add it with " +
      "`claude plugin marketplace add <source>` before updating";
    rec.manualCommand = manualCommand(entry.name, entry.marketplace || "<marketplace>", entry.scope);
    return rec;
  }
  if (!mkt.sourceRef) {
    rec.state = "no-source";
    rec.reason = "the plugin has no usable source metadata — update it manually from where it was installed";
    return rec;
  }

  // available version from the cached marketplace metadata (no network).
  const cat = cachedMarketplaceEntry(entry, marketplaces, deps);
  rec.availableVersion = cat && typeof cat.version === "string" ? cat.version : null;

  // optional read-only remote freshness (opt-in network).
  let remoteErr = null;
  if (network) {
    const remote = remoteHeadSha(mkt.sourceRef, deps);
    if (remote) {
      rec.remoteSha = remote.sha;
      remoteErr = remote.error;
    }
  }

  const versionKnown = Boolean(rec.installedVersion && rec.availableVersion);
  const versionAhead = versionKnown && doctorLib.cmpVersion(rec.availableVersion, rec.installedVersion) > 0;
  const shaKnown = Boolean(rec.installedSha && rec.remoteSha);
  const shaDiffers = shaKnown && rec.installedSha !== rec.remoteSha;

  if (versionAhead || shaDiffers) {
    rec.state = "update-available";
    rec.reason = versionAhead
      ? `installed ${rec.installedVersion} -> available ${rec.availableVersion}`
      : "the plugin source has moved past the installed commit";
    // auto-eligibility: an UPDATE to an already-installed first-party plugin,
    // unless it would change the capability surface (hooks/MCP/permissions).
    // This cached pre-check is best-effort; the AUTHORITATIVE fail-closed
    // re-check runs in applyOne() against the just-refreshed metadata.
    const expansion = capabilityExpansion(manifest, availableManifest(entry, marketplaces, deps));
    if (expansion.known && expansion.expanded) {
      rec.autoEligible = false;
      rec.reason += ` — NOT auto-applied: the update adds ${expansion.added.join(", ")} (explicit consent required)`;
    } else {
      rec.autoEligible = true;
    }
    return rec;
  }
  if ((versionKnown && !versionAhead) || (shaKnown && !shaDiffers)) {
    rec.state = "current";
    rec.reason = null;
    return rec;
  }
  rec.state = "unknown";
  rec.reason = remoteErr
    ? `available version undeterminable (${remoteErr})`
    : "available version undeterminable (no cached marketplace metadata" +
      (network ? " and no remote answer)" : "; re-run with the online probe or refresh manually)");
  return rec;
}

// --- the EXPLICIT apply step --------------------------------------------------

// applyUpdates(check, { deps, mode }) — mode "auto" applies every auto-eligible
// update; mode "notify-only" applies nothing. Per-marketplace refresh + strictly
// per-plugin update commands; every failure is a visible notification with the
// exact manual command. Returns { mode, applied, results, notifications }.
function applyUpdates(check, { deps = defaultDeps(), mode = "auto" } = {}) {
  const results = [];
  const notifications = [];
  if (check.error) notifications.push({ reason: check.error, manualCommand: manualCommand() });
  for (const rec of check.plugins) {
    if (rec.state === "current") {
      results.push({ id: rec.id, action: "none", detail: "already current" });
      continue;
    }
    if (rec.state !== "update-available" || !rec.autoEligible || mode !== "auto") {
      // EVERY not-applied case is a visible notification + the manual command.
      const why =
        rec.state === "update-available" && mode !== "auto"
          ? `update available (${rec.reason}) — notify-only mode, not applied`
          : rec.reason || `state=${rec.state}`;
      results.push({ id: rec.id, action: "notify", detail: why, manualCommand: rec.manualCommand });
      notifications.push({ id: rec.id, reason: why, manualCommand: rec.manualCommand });
      continue;
    }
    results.push(applyOne(rec, deps, notifications));
  }
  return {
    mode,
    applied: results.filter((r) => r.action === "updated").length,
    results,
    notifications,
  };
}

function applyOne(rec, deps, notifications) {
  // 1. refresh THIS marketplace's metadata (scoped — never the update-all form).
  const mktRes = deps.run("claude", ["plugin", "marketplace", "update", rec.marketplace], { timeout: APPLY_TIMEOUT_MS });
  if (!mktRes.ok) {
    const mktText = `${mktRes.stderr}\n${mktRes.error || ""}`;
    const why = /dirty|uncommitted|local changes|would be overwritten/i.test(mktText)
      ? "marketplace refresh failed: the local marketplace/plugin checkout has local changes — clean or stash them, then update"
      : `marketplace refresh failed: ${classifyNetworkError(mktText, mktRes.timedOut)}`;
    notifications.push({ id: rec.id, reason: why, manualCommand: rec.manualCommand });
    return { id: rec.id, action: "notify", detail: why, manualCommand: rec.manualCommand };
  }
  // 2. AUTHORITATIVE consent gate against the JUST-REFRESHED metadata: an
  //    update whose capability surface (hooks/MCP/permissions) would change —
  //    or CANNOT BE VERIFIED — is never auto-applied (fail closed).
  const installedManifest = readManifest(rec.installPath, deps);
  const nextManifest = availableManifest(
    { name: rec.name, marketplace: rec.marketplace },
    readMarketplaces(deps),
    deps
  );
  const expansion = capabilityExpansion(installedManifest, nextManifest);
  if (!expansion.known || expansion.expanded) {
    const why = expansion.known
      ? `not auto-applied: the update changes ${expansion.added.join(", ")} — explicit consent required`
      : "not auto-applied: cannot verify the update does not expand hooks/MCP/permissions — apply manually after review";
    notifications.push({ id: rec.id, reason: why, manualCommand: rec.manualCommand });
    return { id: rec.id, action: "notify", detail: why, manualCommand: rec.manualCommand };
  }
  // 3. per-plugin update, scoped to exactly this plugin@marketplace + scope.
  const upRes = deps.run(
    "claude",
    ["plugin", "update", `${rec.name}@${rec.marketplace}`, "--scope", rec.scope || "user"],
    { timeout: APPLY_TIMEOUT_MS }
  );
  if (!upRes.ok) {
    const text = `${upRes.stderr}\n${upRes.error || ""}`;
    let why;
    if (/EROFS|EACCES|EPERM|read-only|permission/i.test(text)) {
      why = "update failed: filesystem is read-only or permission was denied";
    } else if (/dirty|uncommitted|local changes|would be overwritten/i.test(text)) {
      why = "update failed: the installed copy has local changes — clean or reinstall it, then update";
    } else if (/conflict|incompatible|requires/i.test(text)) {
      why = "update failed: dependency/version conflict — resolve manually";
    } else if (/ENOENT|not found|unknown command/i.test(text)) {
      why = "update failed: the Claude CLI is missing or too old for `claude plugin update`";
    } else {
      why = `update failed: ${classifyNetworkError(text, upRes.timedOut)}`;
    }
    notifications.push({ id: rec.id, reason: why, manualCommand: rec.manualCommand });
    return { id: rec.id, action: "notify", detail: why, manualCommand: rec.manualCommand };
  }
  // 4. verify against the registry (best-effort; a restart may still be needed).
  const after = listInstalled(deps).entries.find((e) => e.id === rec.id);
  const verified = Boolean(
    after &&
      ((after.version && rec.installedVersion && after.version !== rec.installedVersion) ||
        (after.gitCommitSha && rec.installedSha && after.gitCommitSha !== rec.installedSha))
  );
  return {
    id: rec.id,
    action: "updated",
    detail: verified
      ? `updated ${rec.installedVersion || "?"} -> ${after.version || after.gitCommitSha} (restart Claude Code to load it)`
      : "update command succeeded (could not verify from the registry — restart Claude Code, then re-check)",
    verified,
  };
}

// Resolve the update-mode knob: .cinatra-dev/config.json -> currency.plugin
// ("auto" | "notify-only"). Default is "auto" — updates to already-installed
// first-party plugins are applied when possible; anything not possible
// degrades to a visible notification with the exact manual command.
function resolveUpdateMode(cwd, deps = defaultDeps()) {
  try {
    const p = path.join(cwd || process.cwd(), ".cinatra-dev", "config.json");
    const cfg = readJsonSafe(p, deps);
    const v = cfg && cfg.currency && cfg.currency.plugin;
    if (v === "auto" || v === "notify-only") return v;
  } catch {
    /* fall through to the default */
  }
  return "auto";
}

module.exports = {
  FAMILY_OWNERS,
  MARKER_KEY,
  defaultDeps,
  manualCommand,
  shQuote,
  splitId,
  listInstalled,
  readMarketplaces,
  sourceOwner,
  readManifest,
  isFamily,
  cachedMarketplaceEntry,
  availableManifest,
  remoteHeadSha,
  isEditable,
  capabilityExpansion,
  checkUpdates,
  applyUpdates,
  resolveUpdateMode,
};
