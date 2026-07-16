import { readFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const readJson = async (name) => JSON.parse(await readFile(`${ROOT}/data/${name}`, 'utf8'));
const palData = await readJson('pals.json');
const breedingData = await readJson('breeding.json');
const sourceData = await readJson('sources.json');
const pals = palData.pals;
const byId = new Map(pals.map((pal) => [pal.id, pal]));
const eligible = pals
  .filter((pal) => !pal.ignoreCombi)
  .sort((a, b) => a.breedingRank - b.breedingRank || a.sourceIndex - b.sourceIndex || a.order - b.order);

if (pals.length < 250) throw new Error(`catalog too small: ${pals.length}`);
if (new Set(pals.map((pal) => pal.id)).size !== pals.length) throw new Error('duplicate Pal ids');
if (pals.some((pal) => !pal.nameEn || !pal.nameJa || !Number.isFinite(pal.breedingRank))) throw new Error('incomplete Pal fields');
if (pals.some((pal) => !pal.imageUrl || !pal.imageOriginalUrl || !pal.imageReferenceUrl || !pal.imageWebpUrl || pal.imageDelivery !== 'webp-proxy')) throw new Error('incomplete image URLs');
if (sourceData.sources.some((source) => source.url.startsWith('file:') || source.role?.includes('/mnt/'))) throw new Error('local path leaked into sources');
if (breedingData.normalCount !== breedingData.normal.length) throw new Error('normal pair count mismatch');
if (breedingData.meta.normalPairCount !== breedingData.normal.length || breedingData.meta.specialCount !== breedingData.special.length) throw new Error('breeding metadata mismatch');

const pairIds = new Set();
for (const row of breedingData.normal ?? []) {
  if (pairIds.has(row.id)) throw new Error(`duplicate normal pair: ${row.id}`);
  pairIds.add(row.id);
  const a = byId.get(row.parentA);
  const b = byId.get(row.parentB);
  const child = byId.get(row.child);
  if (!a || !b || !child) throw new Error(`unresolved normal row: ${row.id}`);
  const intermediate = Math.floor((a.breedingRank + b.breedingRank + 1) / 2);
  if (row.intermediatePower !== intermediate) throw new Error(`formula mismatch: ${row.id}`);
  const expected = eligible.reduce((best, candidate) => {
    const distance = Math.abs(candidate.breedingRank - intermediate);
    const bestDistance = Math.abs(best.breedingRank - intermediate);
    return distance < bestDistance || (distance === bestDistance && (candidate.sourceIndex < best.sourceIndex || (candidate.sourceIndex === best.sourceIndex && candidate.order < best.order))) ? candidate : best;
  }, eligible[0]);
  if (row.child !== expected.id) throw new Error(`nearest-rank mismatch: ${row.id} -> ${row.child}, expected ${expected.id}`);
  if (child.ignoreCombi) throw new Error(`ignored Pal selected as normal child: ${child.id}`);
}

for (const row of breedingData.special) {
  if (row.status !== 'resolved' || !byId.has(row.parentA) || !byId.has(row.parentB) || !byId.has(row.child)) throw new Error(`unresolved special row: ${row.id}`);
}
if (new Set(breedingData.special.map((row) => row.id)).size !== breedingData.special.length) throw new Error('duplicate special pair ids');

console.log(JSON.stringify({
  catalog: pals.length,
  eligibleChildren: eligible.length,
  normalPairs: breedingData.normalCount,
  specialPairs: breedingData.special.length,
  resolvedSpecialPairs: breedingData.special.filter((row) => row.status === 'resolved').length,
  formula: 'ok',
  nearestRank: 'ok',
  images: pals.length,
  sources: sourceData.sources.length,
}));
