import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA_DIR = `${ROOT}/data`;

const tierById = {
  'official-news': { sourceType: 'publisher_official', sourceTier: 1 },
  'official-game': { sourceType: 'publisher_official', sourceTier: 1 },
  'official-docs': { sourceType: 'publisher_official', sourceTier: 1 },
  'palworld-gg': { sourceType: 'third_party_primary_dataset', sourceTier: 2 },
  'palworld-wiki': { sourceType: 'community_reference', sourceTier: 2 },
  'palworld-wiki-images': { sourceType: 'community_reference', sourceTier: 2 },
  game8: { sourceType: 'third_party_cross_check', sourceTier: 3 },
  paldeck: { sourceType: 'third_party_cross_check', sourceTier: 3 },
  'webp-proxy': { sourceType: 'delivery_utility', sourceTier: 3 },
};

const sourceData = JSON.parse(await readFile(`${DATA_DIR}/sources.json`, 'utf8'));
const palsData = JSON.parse(await readFile(`${DATA_DIR}/pals.json`, 'utf8'));
const breedingData = JSON.parse(await readFile(`${DATA_DIR}/breeding.json`, 'utf8'));

const sources = sourceData.sources.map((source) => ({
  ...source,
  ...(tierById[source.id] ?? { sourceType: 'unclassified', sourceTier: null }),
  observedAt: sourceData.generatedAt,
}));

const registryPayload = {
  schemaVersion: 'pal-atlas.sources.v1',
  generatedAt: sourceData.generatedAt,
  tierPolicy: {
    1: 'Pocketpair publisher/developer first-party source',
    2: 'structured independent dataset or community reference used as a primary machine-readable source',
    3: 'cross-check or delivery utility; never silently overrides tier 1 or tier 2 claims',
  },
  sources,
};
registryPayload.registryHash = createHash('sha256')
  .update(JSON.stringify(registryPayload))
  .digest('hex');
await writeFile(`${DATA_DIR}/sources.json`, `${JSON.stringify(registryPayload, null, 2)}\n`);

const unresolvedSpecial = (breedingData.special ?? [])
  .filter((row) => row.status !== 'resolved')
  .map((row) => ({
    id: row.id,
    conflictType: 'identity_resolution_failure',
    conflictStatus: 'unresolved',
    parentA: row.parentA,
    parentB: row.parentB,
    child: row.child,
    sourceOwner: row.sourceOwner,
    nullReason: 'source_combo_contains_identity_not_resolved_to_current_catalog',
  }));

const conflictPayload = {
  schemaVersion: 'pal-atlas.conflicts.v1',
  generatedAt: sourceData.generatedAt,
  dataAsOf: palsData.meta?.generatedAt ?? sourceData.generatedAt,
  evaluationStatus: 'partial',
  nullReason: 'registered_cross_check_sources_are_not_all_machine_ingested_as_field_level_claims',
  policy: 'Never infer agreement from the absence of machine-comparable secondary claims; preserve unresolved identities and explicit disagreements as conflicts.',
  conflicts: unresolvedSpecial,
};
conflictPayload.artifactHash = createHash('sha256')
  .update(JSON.stringify(conflictPayload))
  .digest('hex');
await writeFile(`${DATA_DIR}/conflicts.json`, `${JSON.stringify(conflictPayload, null, 2)}\n`);

console.log(
  `Built provenance registry: ${sources.length} sources, ${unresolvedSpecial.length} unresolved identity conflicts, source comparison status=${conflictPayload.evaluationStatus}.`,
);
