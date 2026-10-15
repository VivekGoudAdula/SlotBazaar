/**
 * scripts/check-links.mjs
 *
 * Verifies all markdown links across repository .md files:
 * 1. Fails if any link contains `file:///`
 * 2. Fails if any link contains drive-letter absolute paths (e.g. `c:/`, `C:\`)
 * 3. Fails if any relative link target file does not exist on disk
 * 4. Fails if any `#anchor` (same-file or cross-file) does not exist in target file
 *
 * Usage: node scripts/check-links.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Recursively find all markdown files in directory
 */
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

/**
 * Standard GitHub Flavored Markdown heading slug generation
 */
function slugifyHeading(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // link text only
    .replace(/`/g, "")                       // strip backticks
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")                // remove punctuation
    .trim()
    .replace(/\s+/g, "-");                   // spaces to hyphens
}

// Cache extracted anchors per file path
const fileAnchorCache = new Map();

/**
 * Extract all anchors (headings and <a id/name>) from target file
 */
function getFileAnchors(filePath) {
  if (fileAnchorCache.has(filePath)) {
    return fileAnchorCache.get(filePath);
  }

  const ext = path.extname(filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  if (ext !== ".md") {
    const data = { isCode: true, totalLines: lines.length, anchors: new Set() };
    fileAnchorCache.set(filePath, data);
    return data;
  }

  const anchors = new Set();
  for (const line of lines) {
    // Markdown headings (# Title)
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      anchors.add(slugifyHeading(headingMatch[1]));
    }
    // HTML anchors (<a id="..." or <a name="...">)
    const htmlMatches = line.matchAll(/<a\s+(?:[^>]*?\s+)?(?:id|name)=["']([^"']+)["']/gi);
    for (const m of htmlMatches) {
      if (m[1]) anchors.add(m[1].toLowerCase());
    }
  }

  const data = { isCode: false, totalLines: lines.length, anchors };
  fileAnchorCache.set(filePath, data);
  return data;
}

function checkLinks() {
  const mdFiles = getMarkdownFiles(REPO_ROOT);
  let totalLinks = 0;
  let totalAnchorsChecked = 0;
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

        // Ignore external URLs and mailto
        if (
          rawUrl.startsWith("http://") ||
          rawUrl.startsWith("https://") ||
          rawUrl.startsWith("mailto:")
        ) {
          continue;
        }

        // 3. Resolve target file and anchor
        let targetFilePath = null;
        let anchorName = null;

        if (rawUrl.startsWith("#")) {
          // Same-file anchor
          targetFilePath = filePath;
          anchorName = rawUrl.slice(1);
        } else {
          const [urlPath, anchorPart] = rawUrl.split("#");
          anchorName = anchorPart || null;

          // Strip query parameters if present
          const cleanPath = urlPath.split("?")[0];

          // Try relative to the containing file's directory
          const candidateRelative = path.resolve(path.dirname(filePath), cleanPath);
          // Try relative to repository root
          const candidateRoot = path.resolve(REPO_ROOT, cleanPath);

          if (fs.existsSync(candidateRelative)) {
            targetFilePath = candidateRelative;
          } else if (fs.existsSync(candidateRoot)) {
            targetFilePath = candidateRoot;
          } else {
            errors.push({
              file: relFilePath,
              line: lineIdx + 1,
              link: rawUrl,
              error: `Target file not found on disk: "${cleanPath}"`,
            });
            continue;
          }
        }

        // 4. Verify anchor exists if specified
        if (anchorName && targetFilePath) {
          totalAnchorsChecked++;
          const targetData = getFileAnchors(targetFilePath);
          const targetRel = path.relative(REPO_ROOT, targetFilePath).replace(/\\/g, "/");

          if (targetData.isCode) {
            // Code file: check if line number anchor e.g. #L189
            const lineMatch = anchorName.match(/^L(\d+)/i);
            if (lineMatch) {
              const lineNum = parseInt(lineMatch[1], 10);
              if (lineNum <= 0 || lineNum > targetData.totalLines) {
                errors.push({
                  file: relFilePath,
                  line: lineIdx + 1,
                  link: rawUrl,
                  error: `Line anchor "#${anchorName}" out of bounds for ${targetRel} (${targetData.totalLines} lines)`,
                });
              }
            }
          } else {
            // Markdown file: check heading / HTML anchor slug
            const cleanAnchor = anchorName.toLowerCase();
            if (!targetData.anchors.has(cleanAnchor)) {
              errors.push({
                file: relFilePath,
                line: lineIdx + 1,
                link: rawUrl,
                error: `Anchor "#${anchorName}" not found in target file: "${targetRel}"`,
              });
            }
          }
        }
      }
    });
  }

  console.log("==================================================");
  console.log("            MARKDOWN LINK INTEGRITY AUDIT         ");
  console.log("==================================================");
  console.log(`Files scanned          : ${mdFiles.length}`);
  console.log(`Total links checked    : ${totalLinks}`);
  console.log(`Anchors verified (#)   : ${totalAnchorsChecked}`);

  if (errors.length > 0) {
    console.error(`\n❌ Found ${errors.length} link error(s):\n`);
    for (const err of errors) {
      console.error(`[FAIL] ${err.file}:${err.line}`);
      console.error(`       Link:  ${err.link}`);
      console.error(`       Error: ${err.error}\n`);
    }
    process.exit(1);
  }

  console.log("\n✅ All links and anchors passed integrity check!");
  console.log("   (0 absolute/file URIs, 0 missing files, 0 broken anchors)");
  console.log("==================================================\n");
}

checkLinks();
