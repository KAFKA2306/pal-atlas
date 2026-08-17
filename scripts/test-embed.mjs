import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { updateSearchState } from "../public/embed/breed/url-state.js";
import {
  findTargetRecipes,
  normalizeAttribution,
  resolvePair,
  samePair,
} from "../public/embed/breed/widget.js";

const breeding = {
  special: [
    { parentA: "a", parentB: "b", child: "special-child", status: "resolved" },
    {
      parentA: "x",
      parentB: "y",
      child: "uncertain-child",
      status: "unresolved",
    },
  ],
  normal: [
    { parentA: "a", parentB: "b", child: "normal-child" },
    { parentA: "c", parentB: "d", child: "normal-child" },
    { parentA: "e", parentB: "f", child: "target" },
  ],
};

assert.equal(samePair({ parentA: "a", parentB: "b" }, "b", "a"), true);
assert.deepEqual(resolvePair(breeding, "b", "a"), {
  status: "MATCH",
  kind: "special",
  child: "special-child",
});
assert.deepEqual(resolvePair(breeding, "x", "y"), {
  status: "REVIEW_REQUIRED",
  reason: "unresolved_special_recipe",
});
assert.deepEqual(resolvePair(breeding, "d", "c"), {
  status: "MATCH",
  kind: "normal",
  child: "normal-child",
});
assert.deepEqual(resolvePair(breeding, "missing", "pair"), {
  status: "UNKNOWN",
});
assert.equal(findTargetRecipes(breeding, "uncertain-child").length, 0);
assert.equal(findTargetRecipes(breeding, "target")[0].kind, "normal");
assert.equal(normalizeAttribution("partner-01.example"), "partner-01.example");
assert.equal(normalizeAttribution("bad value"), null);
assert.equal(normalizeAttribution("x".repeat(65)), null);

const pairState = new URLSearchParams(
  updateSearchState("?lang=en&partner=guide&campaign=launch&target=old", {
    parentA: "a",
    parentB: "b",
    target: "",
  }),
);
assert.equal(pairState.get("lang"), "en");
assert.equal(pairState.get("partner"), "guide");
assert.equal(pairState.get("campaign"), "launch");
assert.equal(pairState.get("parentA"), "a");
assert.equal(pairState.get("parentB"), "b");
assert.equal(pairState.has("target"), false);

const targetState = new URLSearchParams(
  updateSearchState("?lang=ja&parentA=a&parentB=b", {
    parentA: "",
    parentB: "",
    target: "target",
  }),
);
assert.equal(targetState.get("lang"), "ja");
assert.equal(targetState.has("parentA"), false);
assert.equal(targetState.has("parentB"), false);
assert.equal(targetState.get("target"), "target");

const html = await readFile(
  new URL("../public/embed/breed/index.html", import.meta.url),
  "utf8",
);
const js = await readFile(
  new URL("../public/embed/breed/widget.js", import.meta.url),
  "utf8",
);
const urlStateJs = await readFile(
  new URL("../public/embed/breed/url-state.js", import.meta.url),
  "utf8",
);
const docs = await readFile(
  new URL("../docs/embed.md", import.meta.url),
  "utf8",
);
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const metrics = JSON.parse(
  await readFile(new URL("../metrics/embed-kpi.json", import.meta.url), "utf8"),
);

assert.match(html, /id="widget"/);
assert.match(html, /\.\/widget\.js/);
assert.match(html, /\.\/url-state\.js/);
for (const event of ["embed_loaded", "breed_searched", "pal_atlas_opened"])
  assert.match(js, new RegExp(event));
assert.match(urlStateJs, /history\.replaceState/);
assert.match(js, /非公式ファンプロジェクト/);
assert.match(js, /\.\.\/\.\.\/api\/pals\.json/);
assert.match(js, /\.\.\/\.\.\/api\/breeding\.json/);
assert.match(
  docs,
  /https:\/\/kafka2306\.github\.io\/pal-atlas\/embed\/breed\//,
);
assert.match(docs, /partner=example-site&campaign=breeding-guide/);
assert.match(
  readme,
  /https:\/\/kafka2306\.github\.io\/pal-atlas\/embed\/breed\//,
);
assert.match(readme, /docs\/embed\.md/);

assert.equal(metrics.schemaVersion, 1);
assert.equal(metrics.windowDays, 45);
assert.equal(metrics.targets.partnerProposals, 10);
assert.equal(metrics.targets.trialEmbeds, 3);
assert.equal(metrics.targets.embedLoaded, 500);
assert.equal(metrics.targets.palAtlasOpened, 100);
assert.equal(metrics.targets.openRateMinimum, 0.1);
assert.deepEqual(metrics.observations, []);
assert.match(metrics.note, /Only append observed, evidenced events/);

console.log("embed contract tests passed");
