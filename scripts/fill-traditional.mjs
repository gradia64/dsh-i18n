// fill-traditional.mjs — For zh-hk / zh-tw, replace keys that are still the
// English placeholder (written by migrate-locales.mjs) with the zh-src value
// converted through chars.json, i.e. the same result the runtime
// Simplified→Traditional fallback would produce.
//
// Usage: node scripts/fill-traditional.mjs [--dry-run]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

const findChars = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findChars(p); if (r) return r; }
    else if (e.name === "chars.json") return p;
  }
  return null;
};
const charsPath = findChars(root);
if (!charsPath) throw new Error("chars.json not found");
const chars = JSON.parse(fs.readFileSync(charsPath, "utf8"));
const sample = Object.entries(chars)[0];
if (!sample || typeof sample[1] !== "string") {
  throw new Error(`unexpected chars.json format: ${JSON.stringify(sample)}`);
}
console.log(`using ${path.relative(root, charsPath)} (${Object.keys(chars).length} chars)`);
const convert = (s) => [...s].map((c) => chars[c] ?? c).join("");

const load = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const dicts = (data) => new Map(data.entries.map((e) => [e.ns, e.dict]));
const enDir = path.join(root, "src", "en");
const files = fs.readdirSync(enDir).filter((f) => f.endsWith(".json")).sort();

for (const dir of ["zh-hk", "zh-tw"]) {
  let n = 0;
  for (const file of files) {
    const tPath = path.join(root, "src", dir, file);
    const zPath = path.join(root, "src", "zh-src", file);
    if (!fs.existsSync(tPath) || !fs.existsSync(zPath)) { console.warn(`skip ${dir}/${file}`); continue; }
    const en = dicts(load(path.join(enDir, file)));
    const zh = dicts(load(zPath));
    const target = load(tPath);
    let changed = false;
    for (const entry of target.entries) {
      const enDict = en.get(entry.ns) ?? {};
      const zhDict = zh.get(entry.ns) ?? {};
      for (const [key, value] of Object.entries(entry.dict)) {
        const zhValue = zhDict[key];
        if (value === enDict[key] && typeof zhValue === "string" && zhValue !== value) {
          entry.dict[key] = convert(zhValue);
          changed = true;
          n++;
        }
      }
    }
    if (changed && !DRY) fs.writeFileSync(tPath, JSON.stringify(target, null, 2) + "\n");
  }
  console.log(`${dir}: ${n} keys ${DRY ? "would be" : ""} filled from zh-src`);
}
