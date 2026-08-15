import { readFile } from "node:fs/promises";

const decision = JSON.parse(
  await readFile(
    new URL("../metrics/breeding-authority.json", import.meta.url),
    "utf8",
  ),
);

const fail = (message) => {
  console.error(`breeding-authority: ${message}`);
  process.exit(1);
};

if (decision.schemaVersion !== "pal-atlas.breeding-authority.v1") {
  fail(`unexpected schemaVersion ${decision.schemaVersion}`);
}

if (
  !["ACCEPT", "REJECT", "MAINTAIN", "UNKNOWN"].includes(
    decision.hypothesis?.decision,
  )
) {
  fail("hypothesis decision must be ACCEPT/REJECT/MAINTAIN/UNKNOWN");
}

if (
  !Array.isArray(decision.officialEvidence) ||
  decision.officialEvidence.length === 0
) {
  fail("at least one official evidence record is required");
}

for (const evidence of decision.officialEvidence) {
  const url = new URL(evidence.url);
  if (url.protocol !== "https:" || url.hostname !== "docs.palworldgame.com") {
    fail(
      `official evidence must use the Pocketpair Palworld docs host: ${evidence.url}`,
    );
  }
}

const formulaEvidence = decision.officialEvidence.filter(
  (evidence) => evidence.supportsFormula === true,
);
const result = decision.result ?? {};

if (result.formulaOfficiallyVerified === true && formulaEvidence.length === 0) {
  fail(
    "formula cannot be officially verified without field-level official formula evidence",
  );
}

if (
  result.currentBreedingTruthStatus === "VERIFIED" &&
  result.formulaOfficiallyVerified !== true
) {
  fail(
    "current breeding truth cannot be VERIFIED while formulaOfficiallyVerified is false",
  );
}

if (
  decision.repositoryEvidence?.observedState === "partial" &&
  result.currentBreedingTruthStatus === "VERIFIED"
) {
  fail(
    "partial repository comparison cannot authorize VERIFIED current breeding truth",
  );
}

if (
  decision.hypothesis.decision === "ACCEPT" &&
  result.currentBreedingTruthStatus !== "VERIFIED"
) {
  fail("ACCEPT requires VERIFIED current breeding truth");
}

console.log(
  `breeding-authority: decision=${decision.hypothesis.decision} currentTruth=${result.currentBreedingTruthStatus} officialFormulaEvidence=${formulaEvidence.length}`,
);
