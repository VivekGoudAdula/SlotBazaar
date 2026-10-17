#!/usr/bin/env node
/**
 * scripts/secret-scan.mjs
 *
 * Scans the repo for accidental private-key leakage.
 *
 * What it does:
 *   1. Reads PRIVATE_KEY from .env (never prints it).
 *   2. Searches these paths for the exact key value:
 *        dist/, src/, scripts/, arkiv/, README.md, WALLETS.md,
 *        any *.log files under the repo root.
 *   3. Separately, runs a generic regex for 0x + 64 hex chars in the same
 *      paths and reports file:line of each hit plus whether it equals the key.
 *   4. Searches git history with `git log --all -S <key>` — reports only
 *      commit hashes (never the key value).
 *   5. Exits with code 1 if any exact-key match is found outside .env.
 *
 * Usage:
 *   node scripts/secret-scan.mjs
 *   npm run scan:secrets
 *
 * Output: only counts, paths, line numbers, and verdicts — never the key.
 */

import fs   from "node:fs";
import path  from "node:path";
import {
  execSync,
  spawnSync,
} from "node:child_process";

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOAD PRIVATE_KEY FROM .env (in memory, never printed)
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, "..");

function loadPrivateKey() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    console.log("⚠  No .env file found — skipping exact-key scan.");
    return null;
  }
  const raw = fs.readFileSync(envPath, "utf8");
  const match = raw.match(/^PRIVATE_KEY\s*=\s*(.+)$/m);
  if (!match) {
    console.log("⚠  PRIVATE_KEY not set in .env — skipping exact-key scan.");
    return null;
  }
  const val = match[1].trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  if (!val || val.length < 10) {
    console.log("⚠  PRIVATE_KEY in .env is empty — skipping exact-key scan.");
    return null;
  }
  return val; // never logged
}

const REAL_KEY = loadPrivateKey();

// ─────────────────────────────────────────────────────────────────────────────
// 2. FILE COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively collect files under a directory, excluding node_modules / .git.
 */
function collectFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

const SCAN_DIRS = ["dist", "src", "scripts", "arkiv"].map((d) =>
  path.join(ROOT, d)
);
const SCAN_FILES_EXTRA = ["README.md", "WALLETS.md"].map((f) =>
  path.join(ROOT, f)
);

// Collect all .log files under root (excluding node_modules / .git)
const LOG_FILES = collectFiles(ROOT).filter((f) => f.endsWith(".log"));

const ALL_FILES = [
  ...SCAN_DIRS.flatMap((d) => collectFiles(d)),
  ...SCAN_FILES_EXTRA.filter((f) => fs.existsSync(f)),
  ...LOG_FILES,
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. SCAN HELPER
// ─────────────────────────────────────────────────────────────────────────────

/** Generic 0x + 64-hex regex — matches potential private keys */
const HEX64_RE = /0x[0-9a-fA-F]{64}/g;
/** Matches live Arkiv API keys */
const ARK_LIVE_RE = /ark_live_[a-zA-Z0-9_-]+/g;
/** Matches VITE key patterns in client/source code */
const VITE_KEY_RE = /VITE_.*KEY/g;

/**
 * Scans a single file for:
 *   - exact REAL_KEY match (if available)
 *   - any 0x+64hex token
 *   - ark_live_ API key tokens
 *   - VITE_.*KEY variable patterns
 *
 * Returns findings array: { file, line, isExactKey }.
 */
function scanFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return []; // binary / unreadable
  }

  const findings = [];
  const lines = content.split("\n");
  const isSelf = filePath.endsWith("secret-scan.mjs");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;

    // Exact-key check (fast path using includes)
    if (REAL_KEY && line.includes(REAL_KEY)) {
      findings.push({
        file: path.relative(ROOT, filePath),
        line: i + 1,
        isExactKey: true,
        snippet: "[LINE REDACTED — contains exact private key]",
      });
      continue; // don't also regex-match the same line
    }

    if (!isSelf) {
      // Arkiv live API key scan
      ARK_LIVE_RE.lastIndex = 0;
      while ((m = ARK_LIVE_RE.exec(line)) !== null) {
        findings.push({
          file: path.relative(ROOT, filePath),
          line: i + 1,
          isExactKey: true,
          snippet: `[REDACTED — contains ark_live_ key: ${m[0].slice(0, 12)}…]`,
        });
      }

      // VITE_.*KEY scan
      VITE_KEY_RE.lastIndex = 0;
      while ((m = VITE_KEY_RE.exec(line)) !== null) {
        findings.push({
          file: path.relative(ROOT, filePath),
          line: i + 1,
          isExactKey: true,
          snippet: `[REDACTED — contains VITE_.*KEY: ${m[0]}]`,
        });
      }
    }

    // Generic regex scan
    HEX64_RE.lastIndex = 0;
    while ((m = HEX64_RE.exec(line)) !== null) {
      const token = m[0];
      const isExact = REAL_KEY
        ? token.toLowerCase() === REAL_KEY.toLowerCase()
        : false;
      findings.push({
        file: path.relative(ROOT, filePath),
        line: i + 1,
        isExactKey: isExact,
        snippet: isExact
          ? "[REDACTED — equals private key]"
          : `${token.slice(0, 10)}…${token.slice(-6)} (64-hex token; not the key)`,
      });
    }
  }

  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RUN SCAN
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n╔══════════════════════════════════════════════════╗");
console.log("║  SlotBazaar — Secret Scan                       ║");
console.log("╚══════════════════════════════════════════════════╝\n");
console.log(`Scanning ${ALL_FILES.length} files across dist/, src/, scripts/, arkiv/, logs, WALLETS.md, README.md\n`);

let totalHits = 0;
let exactKeyHits = 0;
const allFindings = [];

for (const f of ALL_FILES) {
  const hits = scanFile(f);
  for (const h of hits) {
    allFindings.push(h);
    totalHits++;
    if (h.isExactKey) exactKeyHits++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. REPORT GENERIC HITS
// ─────────────────────────────────────────────────────────────────────────────

if (allFindings.length === 0) {
  console.log("✅  No 64-hex tokens or key matches found in any scanned file.\n");
} else {
  console.log(`Found ${totalHits} 64-hex token(s) across scanned files:\n`);
  for (const h of allFindings) {
    const verdict = h.isExactKey ? "🚨 EXACT KEY MATCH" : "ℹ  64-hex token";
    console.log(`  ${verdict}  ${h.file}:${h.line}`);
    console.log(`           ${h.snippet}`);
  }
  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GIT HISTORY SCAN (commit hashes only)
// ─────────────────────────────────────────────────────────────────────────────

console.log("── Git history scan ──────────────────────────────────");
if (!REAL_KEY) {
  console.log("  Skipped (no PRIVATE_KEY loaded).\n");
} else {
  try {
    const result = spawnSync(
      "git",
      ["log", "--all", "--oneline", `-S${REAL_KEY}`, "--format=%H"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
    );
    const output = (result.stdout || "").trim();
    if (!output) {
      console.log("  ✅  No commits found in git history containing the private key.\n");
    } else {
      const commits = output.split("\n").filter(Boolean);
      console.log(`  🚨  Key found in ${commits.length} git commit(s):`);
      for (const c of commits) {
        console.log(`       ${c} (commit hash)`);
      }
      console.log();
      exactKeyHits += commits.length;
    }
  } catch (e) {
    console.log(`  ⚠  git scan failed: ${e.message}\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SUMMARY + EXIT CODE
// ─────────────────────────────────────────────────────────────────────────────

console.log("── Summary ───────────────────────────────────────────");
console.log(`  Files scanned      : ${ALL_FILES.length}`);
console.log(`  64-hex tokens found: ${totalHits}`);
console.log(`  Exact key matches  : ${exactKeyHits}`);
console.log();

if (exactKeyHits > 0) {
  console.log("🚨  FAIL — private key leaked. Rotate immediately.\n");
  process.exit(1);
} else {
  console.log("✅  PASS — no private key found outside .env.\n");
  process.exit(0);
}
