import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const PUBLIC_API = `${ROOT}/public/api`;
const palsData = JSON.parse(await readFile(`${ROOT}/data/pals.json`, 'utf8'));
const breedingData = JSON.parse(await readFile(`${ROOT}/data/breeding.json`, 'utf8'));

const writeJson = async (path, value) => {
  await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  await writeFile(path, JSON.stringify(value) + '\n');
};

const pals = palsData.pals.map(({ id, order, nameEn, nameJa, imageUrl, imageOriginalUrl, imageReferenceUrl, imageWebpUrl, imageFile, imageMime, imageDelivery, elements, rarity, rarityTier, breedingRank, combiPriority, ignoreCombi }) => ({
  id, order, nameEn, nameJa, imageUrl, imageOriginalUrl, imageReferenceUrl, imageWebpUrl, imageFile, imageMime, imageDelivery, elements, rarity, rarityTier, breedingRank, combiPriority, ignoreCombi,
}));
const palById = new Map(pals.map((pal) => [pal.id, pal]));
const specialByChild = new Map();
for (const row of breedingData.special) {
  const rows = specialByChild.get(row.child) ?? [];
  rows.push(row);
  specialByChild.set(row.child, rows);
}
await rm(PUBLIC_API, { recursive: true, force: true });
await mkdir(PUBLIC_API, { recursive: true });
await writeJson(`${PUBLIC_API}/index.json`, {
  apiVersion: 1,
  generatedAt: palsData.meta.generatedAt,
  catalogCount: pals.length,
  normalPairCount: breedingData.normalCount,
  specialCount: breedingData.special.length,
  formula: palsData.meta.formula,
  endpoints: {
    catalog: './pals.json',
    breeding: './breeding.json',
    pal: './pals/{id}.json',
  },
});
await writeJson(`${PUBLIC_API}/pals.json`, { meta: palsData.meta, pals });
await writeJson(`${PUBLIC_API}/breeding.json`, {
  meta: palsData.meta,
  normal: breedingData.normal ?? [],
  special: breedingData.special,
});

for (const pal of pals) {
  await writeJson(`${PUBLIC_API}/pals/${pal.id}.json`, {
    pal,
    recipes: {
      featuredNormal: breedingData.featuredNormal[pal.id] ?? [],
      special: specialByChild.get(pal.id) ?? [],
    },
  });
}

console.log(`Built static API: ${pals.length} pal detail files, ${breedingData.normalCount} normal pairs, ${breedingData.special.length} special pairs.`);
