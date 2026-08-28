import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, "..");

const INCLUDE_DIRS = [
  "config",
  "constants",
  "controllers",
  "database",
  "middleware",
  "models",
  "realtime",
  "repositories",
  "routes",
  "services",
  "tasks",
  "utils",
  "views",
  "scripts",
  "src",
  "supabase/functions",
];

const INCLUDE_ROOT_FILES = [
  "eslint.config.mjs",
  "index.js",
  "app.js",
  "server.js",
];

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  ".husky",
  "tools",
  "docs",
  "coverage",
]);

const EXCLUDE_SUBPATHS = [];

const EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const PRESERVE_LINE_RE = [
  /^\/\/\s*@ts-(ignore|expect-error|nocheck|check)\b/,
  /^\/\/\s*eslint-(disable|enable)(-next-line|-line)?\b/,
  /^\/\/\s*prettier-ignore\b/,
  /^\/\/\s*biome-ignore\b/,
  /^\/\/\s*deno-lint-ignore\b/,
  /^\/\/\s*deno-fmt-ignore\b/,
  /^\/\/\s*tslint:(disable|enable)\b/,
  /^\/\/\s*c8\s+ignore\b/,
  /^\/\/\s*istanbul\s+ignore\b/,
  /^\/\/\/\s*</,
  /^\/\/#\s*sourceMappingURL=/,
];

const PRESERVE_BLOCK_RE = [
  /^\/\*\s*@ts-(ignore|expect-error|nocheck|check)\b/,
  /^\/\*\s*eslint-(disable|enable)(-next-line|-line)?\b/,
  /^\/\*\s*prettier-ignore\b/,
  /^\/\*\s*global\s/,
  /^\/\*\s*globals\s/,
  /^\/\*!\s*/,
];

function isPreservedComment(text) {
  if (text.startsWith("//")) return PRESERVE_LINE_RE.some((re) => re.test(text));
  if (text.startsWith("/*")) return PRESERVE_BLOCK_RE.some((re) => re.test(text));
  return false;
}

function shouldVisitDir(rel) {
  const parts = rel.split(/[/\\]/);
  for (const p of parts) if (EXCLUDE_DIRS.has(p)) return false;
  for (const sub of EXCLUDE_SUBPATHS) {
    if (rel === sub || rel.startsWith(sub + path.sep) || rel.startsWith(sub + "/")) {
      return false;
    }
  }
  return true;
}

function walk(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    const rel = path.relative(REPO, abs);
    if (ent.isDirectory()) {
      if (!shouldVisitDir(rel)) continue;
      walk(abs, acc);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name);
      if (EXTS.has(ext)) acc.push(abs);
    }
  }
}

function collectFiles() {
  const files = [];
  for (const d of INCLUDE_DIRS) {
    const abs = path.join(REPO, d);
    if (fs.existsSync(abs)) walk(abs, files);
  }
  for (const f of INCLUDE_ROOT_FILES) {
    const abs = path.join(REPO, f);
    if (fs.existsSync(abs)) files.push(abs);
  }
  return files;
}

const REGEX_PREV_OK = new Set([
  "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";",
  "+", "-", "*", "/", "%", "<", ">", "~", "^",
]);

const REGEX_PREV_KEYWORDS = new Set([
  "return", "typeof", "instanceof", "in", "of", "delete", "void",
  "throw", "new", "yield", "await", "case", "do", "else",
]);

function lastSignificantToken(src, pos) {
  let i = pos - 1;
  while (i >= 0 && /\s/.test(src[i])) i--;
  if (i < 0) return { kind: "start", value: "" };
  const ch = src[i];
  if (/[A-Za-z_$]/.test(ch)) {
    let j = i;
    while (j >= 0 && /[A-Za-z0-9_$]/.test(src[j])) j--;
    return { kind: "word", value: src.slice(j + 1, i + 1) };
  }
  return { kind: "punct", value: ch };
}

function isRegexContext(src, pos) {
  const t = lastSignificantToken(src, pos);
  if (t.kind === "start") return true;
  if (t.kind === "word") return REGEX_PREV_KEYWORDS.has(t.value);
  if (t.kind === "punct") return REGEX_PREV_OK.has(t.value);
  return false;
}

function findCommentRanges(src) {
  const ranges = [];
  let i = 0;
  const n = src.length;
  const tplStack = [];

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    if (tplStack.length && tplStack[tplStack.length - 1].braceDepth === 0) {
      const st = tplStack[tplStack.length - 1];
      while (i < n) {
        const cc = src[i];
        if (cc === "\\") { i += 2; continue; }
        if (cc === "$" && src[i + 1] === "{") {
          st.braceDepth = 1;
          i += 2;
          break;
        }
        if (cc === "`") {
          tplStack.pop();
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if (c === "`") {
      tplStack.push({ braceDepth: 0 });
      i++;
      continue;
    }

    if (tplStack.length) {
      const st = tplStack[tplStack.length - 1];
      if (c === "{") { st.braceDepth++; i++; continue; }
      if (c === "}") {
        st.braceDepth--;
        i++;
        if (st.braceDepth === 0) continue;
        continue;
      }
    }

    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      while (i < n) {
        const cc = src[i];
        if (cc === "\\") { i += 2; continue; }
        if (cc === quote) { i++; break; }
        if (cc === "\n") { i++; break; }
        i++;
      }
      continue;
    }

    if (c === "/" && c2 === "/") {
      const start = i;
      i += 2;
      while (i < n && src[i] !== "\n") i++;
      ranges.push({ start, end: i, kind: "line" });
      continue;
    }

    if (c === "/" && c2 === "*") {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      const end = Math.min(n, i + 2);
      i = end;
      ranges.push({ start, end, kind: "block" });
      continue;
    }

    if (c === "/" && isRegexContext(src, i)) {
      i++;
      let inClass = false;
      while (i < n) {
        const cc = src[i];
        if (cc === "\\") { i += 2; continue; }
        if (cc === "[") { inClass = true; i++; continue; }
        if (cc === "]") { inClass = false; i++; continue; }
        if (cc === "/" && !inClass) { i++; break; }
        if (cc === "\n") break;
        i++;
      }
      while (i < n && /[a-z]/i.test(src[i])) i++;
      continue;
    }

    i++;
  }

  return ranges;
}

function stripFile(abs) {
  const original = fs.readFileSync(abs, "utf8");
  const ranges = findCommentRanges(original);
  const filtered = ranges.filter((r) => {
    const text = original.slice(r.start, r.end);
    return !isPreservedComment(text);
  });
  if (filtered.length === 0) return { changed: false, removed: 0 };

  let out = original;
  for (let i = filtered.length - 1; i >= 0; i--) {
    const { start, end, kind } = filtered[i];
    let s = start;
    let e = end;

    if (kind === "line") {
      while (s > 0 && (out[s - 1] === " " || out[s - 1] === "\t")) s--;
      const lineStart = out.lastIndexOf("\n", s - 1) + 1;
      const beforeOnLine = out.slice(lineStart, s);
      if (beforeOnLine.length === 0 || /^[\s]*$/.test(beforeOnLine)) {
        s = lineStart;
        if (out[e] === "\n") e++;
        else if (out[e] === "\r" && out[e + 1] === "\n") e += 2;
      }
    } else {
      const lineStart = out.lastIndexOf("\n", s - 1) + 1;
      const beforeOnLine = out.slice(lineStart, s);
      let afterEnd = e;
      while (afterEnd < out.length && (out[afterEnd] === " " || out[afterEnd] === "\t")) afterEnd++;
      const eolNext = afterEnd === out.length || out[afterEnd] === "\n" || out[afterEnd] === "\r";
      const wholeLine = /^[\s]*$/.test(beforeOnLine) && eolNext;
      if (wholeLine) {
        s = lineStart;
        e = afterEnd;
        if (out[e] === "\n") e++;
        else if (out[e] === "\r" && out[e + 1] === "\n") e += 2;
      } else {
        while (s > 0 && (out[s - 1] === " " || out[s - 1] === "\t")) s--;
      }
    }

    out = out.slice(0, s) + out.slice(e);
  }

  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/^[ \t]+$/gm, "");

  if (out === original) return { changed: false, removed: 0 };
  fs.writeFileSync(abs, out, "utf8");
  return { changed: true, removed: filtered.length };
}

const dryRun = process.argv.includes("--dry-run");
const files = collectFiles();
let totalFiles = 0;
let totalChanged = 0;
let totalRemoved = 0;
const failures = [];

for (const f of files) {
  totalFiles++;
  try {
    if (dryRun) {
      const content = fs.readFileSync(f, "utf8");
      const ranges = findCommentRanges(content);
      const removable = ranges.filter((r) => !isPreservedComment(content.slice(r.start, r.end)));
      if (removable.length > 0) {
        totalChanged++;
        totalRemoved += removable.length;
        console.log(`${removable.length.toString().padStart(4)}  ${path.relative(REPO, f)}`);
      }
    } else {
      const r = stripFile(f);
      if (r.changed) {
        totalChanged++;
        totalRemoved += r.removed;
      }
    }
  } catch (err) {
    failures.push({ file: path.relative(REPO, f), err: String(err) });
  }
}

console.log("");
console.log(`Files scanned: ${totalFiles}`);
console.log(`Files changed: ${totalChanged}`);
console.log(`Comments removed: ${totalRemoved}`);
if (dryRun && totalChanged > 0) {
  console.log("");
  console.log("Hay comentarios prohibidos. Corre `npm run strip:apply` para eliminarlos.");
  process.exit(1);
}
if (failures.length) {
  console.log(`\nFailures (${failures.length}):`);
  for (const f of failures) console.log(`  ${f.file}: ${f.err}`);
  process.exit(1);
}
