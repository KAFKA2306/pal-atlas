import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname } from "node:path";

const executable = (name) => (process.platform === "win32" ? `${name}.cmd` : name);

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" });
  } catch {
    return "";
  }
}

function addLines(target, output) {
  for (const line of output.split(/\r?\n/)) {
    const path = line.trim();
    if (path) target.add(path);
  }
}

const changed = new Set();
const baseBranch = process.env.GITHUB_BASE_REF || "main";
addLines(changed, git(["diff", "--name-only", "--diff-filter=ACMR", `origin/${baseBranch}...HEAD`]));
addLines(changed, git(["diff", "--name-only", "--cached", "--diff-filter=ACMR"]));
addLines(changed, git(["diff", "--name-only", "--diff-filter=ACMR"]));
addLines(changed, git(["ls-files", "--others", "--exclude-standard"]));

const supported = new Set([".js", ".jsx", ".mjs", ".cjs"]);
const ignoredPrefixes = ["data/", "dist/", "node_modules/", "public/api/"];
const files = [...changed]
  .filter((path) => supported.has(extname(path)))
  .filter((path) => !ignoredPrefixes.some((prefix) => path.startsWith(prefix)))
  .filter((path) => existsSync(path))
  .sort();

if (files.length === 0) {
  console.log("No changed JavaScript files require Biome/Oxlint checks.");
  process.exit(0);
}

console.log(`Checking ${files.length} changed JavaScript file(s): ${files.join(", ")}`);
execFileSync(executable("npx"), ["biome", "check", "--config-path=biome.json", ...files], {
  stdio: "inherit",
});
execFileSync(executable("npx"), ["oxlint", "--deny-warnings", ...files], {
  stdio: "inherit",
});
