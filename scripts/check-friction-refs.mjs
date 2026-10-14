/**
 * scripts/check-friction-refs.mjs
 *
 * Scans README.md and arkiv/friction.md for:
 * 1. Every `scripts/...` path and verifies it exists on disk
 * 2. Every `arkiv/repro/...` path and verifies it exists on disk
 * 3. Every `npm run <cmd>` and verifies `<cmd>` exists in package.json
 *
 * Fails (exit code 1) if any referenced script or file does not exist.
 *
 * Usage: node scripts/check-friction-refs.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
const npmScripts = Object.keys(pkg.scripts || {});

const FILES_TO_SCAN = [
  path.join(REPO_ROOT, "README.md"),
  path.join(REPO_ROOT, "arkiv/friction.md"),
];

function main() {
  console.log("==================================================");
  console.log("       FRICTION & SCRIPT REFERENCE AUDIT          ");
  console.log("==================================================");

  let totalRefs = 0;
  const errors = [];
  const foundRefs = new Set();

  for (const filePath of FILES_TO_SCAN) {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Match scripts/... or arkiv/repro/...
      const fileMatches = line.matchAll(/(?:scripts|arkiv\/repro)\/[\w\-\.]+\.(?:ts|js|mjs|sh|py)/g);
      for (const m of fileMatches) {
        totalRefs++;
        const targetRel = m[0];
        foundRefs.add(targetRel);
        const fullTarget = path.join(REPO_ROOT, targetRel);
        if (!fs.existsSync(fullTarget)) {
          errors.push({
            sourceFile: relPath,
            line: lineNum,
            type: "FILE_MISSING",
            reference: targetRel,
          });
        }
      }

      // Match npm run <script>
      const npmMatches = line.matchAll(/npm\s+run\s+([\w\-\:]+)/g);
      for (const m of npmMatches) {
        totalRefs++;
        const scriptName = m[1];
        foundRefs.add(`npm run ${scriptName}`);
        if (!npmScripts.includes(scriptName)) {
          errors.push({
            sourceFile: relPath,
            line: lineNum,
            type: "NPM_SCRIPT_MISSING",
            reference: scriptName,
          });
        }
      }
    });
  }

  console.log(`Audited references across ${FILES_TO_SCAN.length} markdown documents.`);
  console.log(`Unique references checked: ${foundRefs.size} (Total occurrences: ${totalRefs})\n`);

  foundRefs.forEach((ref) => {
    const isError = errors.some((e) => e.reference === ref || (ref.startsWith("npm run ") && e.reference === ref.replace("npm run ", "")));
    console.log(`  ${isError ? "❌" : "✅"} ${ref}`);
  });

  if (errors.length > 0) {
    console.log("\n❌ Found missing script references:");
    errors.forEach((err) => {
      console.log(`  - [${err.sourceFile}:${err.line}] ${err.type}: ${err.reference}`);
    });
    process.exit(1);
  } else {
    console.log("\n✅ All script paths and npm scripts verified successfully!");
    console.log("==================================================");
  }
}

main();
