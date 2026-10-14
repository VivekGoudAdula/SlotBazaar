/**
 * scripts/check-links.mjs
 *
 * Verifies all markdown links across repository .md files:
 * 1. Fails if any link contains `file:///`
 * 2. Fails if any link contains drive-letter absolute paths (e.g. `c:/`, `C:\`)
 * 3. Fails if any relative link target file does not exist on disk
 *
 * Usage: node scripts/check-links.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

function getMarkdownFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    if (dirent.name === "node_modules" || dirent.name === ".git" || dirent.name === "dist") {
      continue;
    }
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(getMarkdownFiles(fullPath));
    } else if (dirent.isFile() && dirent.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkLinks() {
  const mdFiles = getMarkdownFiles(REPO_ROOT);
  let totalLinks = 0;
  const errors = [];

  // Match markdown links [text](url)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

  for (const filePath of mdFiles) {
    const relFilePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, lineIdx) => {
      let match;
      while ((match = linkRegex.exec(line)) !== null) {
        totalLinks++;
        const rawUrl = match[2].trim();

        // 1. Check for file:///
        if (rawUrl.includes("file:///")) {
          errors.push({
            file: relFilePath,
            line: lineIdx + 1,
            link: rawUrl,
            error: "Absolute file URI (file:///) detected. Must be relative repo path.",
          });
          continue;
        }

        // 2. Check for drive-letter paths (e.g. C:/ or c:\)
        if (/^[a-zA-Z]:[/\\]/.test(rawUrl)) {
          errors.push({
            file: relFilePath,
            line: lineIdx + 1,
            link: rawUrl,
            error: "Drive-letter absolute path detected. Must be relative repo path.",
          });
          continue;
        }

        // Ignore external URLs, mailto, and same-file anchors
        if (
          rawUrl.startsWith("http://") ||
          rawUrl.startsWith("https://") ||
          rawUrl.startsWith("mailto:") ||
          rawUrl.startsWith("#")
        ) {
          continue;
        }

        // 3. Check relative link target
        // Strip anchor and query if present
        const urlWithoutAnchor = rawUrl.split("#")[0].split("?")[0];
        if (!urlWithoutAnchor) {
          // was just an anchor like `#section`
          continue;
        }

        // Try relative to the containing file's directory
        const candidateRelative = path.resolve(path.dirname(filePath), urlWithoutAnchor);
        // Try relative to repository root
        const candidateRoot = path.resolve(REPO_ROOT, urlWithoutAnchor);

        if (!fs.existsSync(candidateRelative) && !fs.existsSync(candidateRoot)) {
          errors.push({
            file: relFilePath,
            line: lineIdx + 1,
            link: rawUrl,
            error: `Target file not found on disk: "${urlWithoutAnchor}"`,
          });
        }
      }
    });
  }

  console.log("==================================================");
  console.log("            MARKDOWN LINK INTEGRITY AUDIT         ");
  console.log("==================================================");
  console.log(`Files scanned: ${mdFiles.length}`);
  console.log(`Total links checked: ${totalLinks}`);

  if (errors.length > 0) {
    console.error(`\n❌ Found ${errors.length} link error(s):\n`);
    for (const err of errors) {
      console.error(`[FAIL] ${err.file}:${err.line}`);
      console.error(`       Link:  ${err.link}`);
      console.error(`       Error: ${err.error}\n`);
    }
    process.exit(1);
  }

  console.log("\n✅ All links passed integrity check! (0 absolute/file URIs, 0 missing targets)");
  console.log("==================================================\n");
}

checkLinks();
