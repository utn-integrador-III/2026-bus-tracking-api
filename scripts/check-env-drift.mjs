import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_DIRS = [
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

const ROOT_FILES = ["index.js", "app.js", "server.js"];
const EXTS = new Set([".js", ".mjs", ".cjs", ".ts"]);
const EXCLUDE_DIRS = new Set(["node_modules", ".git"]);

function walk(dir, acc) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue;
      walk(join(dir, ent.name), acc);
    } else if (ent.isFile() && EXTS.has(extname(ent.name))) {
      acc.push(join(dir, ent.name));
    }
  }
}

function collectSourceFiles() {
  const files = [];
  for (const d of SOURCE_DIRS) {
    const abs = join(root, d);
    if (existsSync(abs)) walk(abs, files);
  }
  for (const f of ROOT_FILES) {
    const abs = join(root, f);
    if (existsSync(abs)) files.push(abs);
  }
  return files;
}

function extractUsedKeys(files) {
  const keys = new Set();
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /Deno\.env\.get\(["']([A-Z][A-Z0-9_]*)["']\)/g,
    /(?:requiredEnv|integerEnv)\(["']([A-Z][A-Z0-9_]*)["']/g,
  ];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const pattern of patterns) {
      let m;
      while ((m = pattern.exec(src)) !== null) keys.add(m[1]);
    }
  }
  return keys;
}

function extractExampleKeys() {
  const file = resolve(root, ".env.example");
  if (!existsSync(file)) return new Set();
  const src = readFileSync(file, "utf8");
  const keys = new Set();
  const re = /^#?\s*([A-Z][A-Z0-9_]+)=/gm;
  let m;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  return keys;
}

const RUNTIME_PROVIDED = new Set(["NODE_ENV", "PORT", "CI", "HUSKY"]);

const files = collectSourceFiles();
const used = extractUsedKeys(files);
const example = extractExampleKeys();

const missingInExample = [...used].filter(
  (k) => !example.has(k) && !RUNTIME_PROVIDED.has(k),
);
const unusedInCode = [...example].filter((k) => !used.has(k));

let exitCode = 0;

if (missingInExample.length > 0) {
  console.error("Vars usadas en el codigo pero AUSENTES en .env.example:");
  for (const k of missingInExample) console.error("  -", k);
  exitCode = 1;
}

if (unusedInCode.length > 0) {
  console.warn("Vars en .env.example pero NO referenciadas todavia en el codigo (puede ser intencional):");
  for (const k of unusedInCode) console.warn("  ?", k);
}

if (exitCode === 0 && missingInExample.length === 0) {
  console.log(`env drift check OK — ${used.size} variable(s) usada(s) en el codigo, todas documentadas.`);
}

process.exit(exitCode);
