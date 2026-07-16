import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA_DIR = `${ROOT}/data`;
const NEO4J_DIR = `${ROOT}/neo4j`;
const EN_URL = 'https://palworld.gg/breeding-calculator';
const JA_URL = 'https://palworld.gg/ja/breeding-calculator';
const fetchedAt = new Date().toISOString();

const ELEMENTS = new Map([
  ['Normal', 'neutral'], ['Neutral', 'neutral'], ['無属性', 'neutral'],
  ['Fire', 'fire'], ['火', 'fire'], ['Water', 'water'], ['水', 'water'],
  ['Leaf', 'grass'], ['Grass', 'grass'], ['草', 'grass'],
  ['Electricity', 'electric'], ['Electric', 'electric'], ['雷', 'electric'],
  ['Ground', 'ground'], ['地面', 'ground'], ['Earth', 'ground'], ['大地', 'ground'],
  ['Ice', 'ice'], ['氷', 'ice'], ['Dark', 'dark'], ['ダーク', 'dark'],
  ['Dragon', 'dragon'], ['ドラゴン', 'dragon'],
]);

const SPECIAL_SEEDS = [
  ['Faleris', 'Vanwyrm', 'Anubis', 'unique'],
  ['Grizzbolt', 'Mossanda', 'Rayhound', 'unique'],
  ['Orserk', 'Grizzbolt', 'Relaxaurus', 'unique'],
  ['Shadowbeak', 'Kitsun', 'Astegon', 'unique'],
  ['Lyleen', 'Mossanda', 'Petallia', 'unique'],
  ['Frostallion Noct', 'Frostallion', 'Helzephyr', 'elemental variant'],
  ['Bellanoir', 'Bellanoir', 'Bellanoir', 'self / unique'],
  ['Bellanoir', 'Bellanoir', 'Bellanoir Libero', 'unique override'],
  ['Bellanoir Libero', 'Bellanoir Libero', 'Bellanoir Libero', 'self / unique'],
  ['Azurobe Cryst', 'Azurobe', 'Frostplume', 'elemental variant'],
  ['Beakon Cryst', 'Beakon', 'Frostplume', 'elemental variant'],
  ['Celaray Lux', 'Celaray', 'Univolt', 'elemental variant'],
  ['Jormuntide Ignis', 'Jormuntide', 'Blazehowl', 'elemental variant'],
  ['Mossanda Lux', 'Mossanda', 'Grizzbolt', 'elemental variant'],
  ['Incineram Noct', 'Incineram', 'Maraith', 'elemental variant'],
  ['Broncherry Aqua', 'Broncherry', 'Fuack', 'elemental variant'],
  ['Bushi Noct', 'Bushi', 'Sootseer', 'elemental variant'],
  ['Caprity Noct', 'Caprity', 'Tarantriss', 'elemental variant / unique'],
  ['Chillet Ignis', 'Chillet', 'Arsox', 'elemental variant / unique'],
  ['Faleris Aqua', 'Jormuntide', 'Faleris', 'elemental variant / unique'],
  ['Fenglope Lux', 'Fenglope', 'Azurmane', 'elemental variant / unique'],
  ['Foxparks Cryst', 'Foxparks', 'Foxcicle', 'elemental variant / unique'],
  ['Finsider Ignis', 'Finsider', 'Gobfin Ignis', 'elemental variant / unique'],
  ['Gorirat Terra', 'Kikit', 'Gorirat', 'elemental variant / unique'],
  ['Hangyu Cryst', 'Hangyu', 'Swee', 'elemental variant / unique'],
  ['Jolthog Cryst', 'Jolthog', 'Pengullet', 'elemental variant / unique'],
  ['Kingpaca Cryst', 'Kingpaca', 'Reindrix', 'elemental variant / unique'],
  ['Kitsun Noct', 'Kitsun', 'Nyafia', 'elemental variant / unique'],
  ['Lyleen Noct', 'Lyleen', 'Menasting', 'elemental variant / unique'],
  ['Mammorest Cryst', 'Mammorest', 'Wumpo', 'elemental variant / unique'],
  ['Mau Cryst', 'Mau', 'Pengullet', 'elemental variant / unique'],
  ['Menasting Terra', 'Menasting', 'Knocklem', 'elemental variant / unique'],
  ['Pyrin Noct', 'Pyrin', 'Katress', 'elemental variant / unique'],
  ['Quivern Botan', 'Lullu', 'Quivern', 'elemental variant / unique'],
  ['Rayhound Cryst', 'Foxcicle', 'Rayhound', 'elemental variant / unique'],
  ['Relaxaurus Lux', 'Relaxaurus', 'Sparkit', 'elemental variant / unique'],
  ['Reptyro Cryst', 'Reptyro', 'Foxcicle', 'elemental variant / unique'],
  ['Robinquill Terra', 'Robinquill', 'Fuddler', 'elemental variant / unique'],
  ['Suzaku Aqua', 'Suzaku', 'Jormuntide', 'elemental variant / unique'],
  ['Tanzee Ignis', 'Tanzee', 'Flambelle', 'elemental variant / unique'],
  ['Turtacle Terra', 'Turtacle', 'Digtoise', 'elemental variant / unique'],
  ['Univolt Cryst', 'Univolt', 'Frostplume', 'elemental variant / unique'],
  ['Vanwyrm Cryst', 'Vanwyrm', 'Foxcicle', 'elemental variant / unique'],
  ['Warsect Terra', 'Digtoise', 'Warsect', 'elemental variant / unique'],
  ['Whalaska Ignis', 'Chillet Ignis', 'Whalaska', 'elemental variant / unique'],
  ['Wixen Noct', 'Katress', 'Wixen', 'elemental variant / gender-specific'],
  ['Woolipop Terra', 'Woolipop', 'Kikit', 'elemental variant / unique'],
];

const sources = [
  { id: 'palworld-gg', title: 'Palworld.gg Paldeck / Breeding Calculator', url: EN_URL, role: '297-entry catalog, Breeding Rank, image URL baseline' },
  { id: 'palworld-wiki', title: 'Palworld Wiki — Breeding', url: 'https://palworld.wiki.gg/wiki/Breeding', role: 'normal formula and special-combination rule cross-check' },
  { id: 'game8', title: 'Game8 — Breeding Combos Calculator', url: 'https://game8.co/games/Palworld/archives/440530', role: 'breeding workflow and special-combination cross-check' },
  { id: 'paldeck', title: 'Paldeck', url: 'https://www.paldeck.cc/breeding', role: 'independent database cross-check' },
  { id: 'official-news', title: 'Pocketpair official news', url: 'https://news.palworldgame.com/', role: 'official release and news context' },
  { id: 'official-docs', title: 'Pocketpair official server docs', url: 'https://docs.palworldgame.com/', role: 'official documentation entry point' },
  { id: 'user-report', title: 'User-provided deep research report', url: 'file:///mnt/d/temp/deep-research-report.md', role: 'classification notes; mixed-version and mixed-model warnings' },
];

function decode(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&#39;', "'");
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parsePage(html) {
  const pattern = /<div class="pal"><div class="container ([^"]+)">.*?<div class="elements">(.*?)<\/div><div class="image">.*?<img[^>]+alt="([^"]+)"[^>]+src="([^"]+)".*?<div class="name">\s*[^<]+.*?comb-rank">\(([^)]+)\)/gs;
  return [...html.matchAll(pattern)].map((match, index) => {
    const block = match[0];
    const elements = [...match[2].matchAll(/alt="([^"]+) element"/g)]
      .map((entry) => entry[1].trim())
      .map((entry) => ELEMENTS.get(entry) ?? slug(entry));
    const imagePath = decode(match[4]);
    return {
      order: index + 1,
      name: match[3].trim(),
      imageFile: imagePath.split('/').pop(),
      imageUrl: `https://palworld.gg${imagePath}`,
      elements,
      rarity: Number(block.match(/<div class="(?:common|rare|epic) rarity"><div class="lv">(\d+)<\/div>/)?.[1] ?? 0),
      rarityTier: match[1],
      breedingRank: Number(match[5]),
    };
  });
}

function csv(rows, columns) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [columns.join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\n') + '\n';
}

const [enResponse, jaResponse] = await Promise.all([fetch(EN_URL), fetch(JA_URL)]);
if (!enResponse.ok || !jaResponse.ok) throw new Error(`Source fetch failed: ${enResponse.status}/${jaResponse.status}`);
const [enHtml, jaHtml] = await Promise.all([enResponse.text(), jaResponse.text()]);
const english = parsePage(enHtml);
const japanese = parsePage(jaHtml);
if (english.length < 250 || japanese.length < 250) throw new Error(`Unexpected catalog size: ${english.length}/${japanese.length}`);

const jaByImage = new Map(japanese.map((pal) => [pal.imageFile, pal]));
const pals = english.map((pal) => {
  const ja = jaByImage.get(pal.imageFile);
  return {
    id: slug(pal.name),
    order: pal.order,
    nameEn: pal.name,
    nameJa: ja?.name ?? pal.name,
    imageFile: pal.imageFile,
    imageUrl: pal.imageUrl,
    elements: pal.elements,
    rarity: pal.rarity,
    rarityTier: pal.rarityTier,
    breedingRank: pal.breedingRank,
  };
});
const byName = new Map(pals.map((pal) => [pal.nameEn, pal]));
const aliases = new Map([['Bellanoir Libra', 'Bellanoir Libero']]);
const resolveName = (name) => byName.get(aliases.get(name) ?? name);

const special = SPECIAL_SEEDS.map(([childName, parentAName, parentBName, kind]) => {
  const child = resolveName(childName);
  const parentA = resolveName(parentAName);
  const parentB = resolveName(parentBName);
  return {
    id: `${slug(childName)}::${slug(parentAName)}::${slug(parentBName)}`,
    child: child?.id ?? slug(childName), childName,
    parentA: parentA?.id ?? slug(parentAName), parentAName,
    parentB: parentB?.id ?? slug(parentBName), parentBName,
    kind, status: child && parentA && parentB ? 'resolved' : 'unresolved',
  };
});

const rankSorted = [...pals].sort((a, b) => a.breedingRank - b.breedingRank || a.order - b.order);
const normal = [];
const normalByChild = new Map(pals.map((pal) => [pal.id, []]));
for (let i = 0; i < pals.length; i += 1) {
  for (let j = i; j < pals.length; j += 1) {
    const a = pals[i]; const b = pals[j];
    const intermediatePower = Math.floor((a.breedingRank + b.breedingRank + 1) / 2);
    const child = rankSorted.reduce((best, candidate) => {
      const distance = Math.abs(candidate.breedingRank - intermediatePower);
      const bestDistance = Math.abs(best.breedingRank - intermediatePower);
      return distance < bestDistance || (distance === bestDistance && candidate.order < best.order) ? candidate : best;
    }, rankSorted[0]);
    const row = { id: `${a.id}::${b.id}`, parentA: a.id, parentB: b.id, child: child.id, intermediatePower, rule: 'nearest-breeding-rank' };
    normal.push(row);
    normalByChild.get(child.id).push(row);
  }
}

const palsById = new Map(pals.map((pal) => [pal.id, pal]));
const featuredNormal = Object.fromEntries([...normalByChild.entries()].map(([child, rows]) => [child, rows
  .sort((a, b) => Math.abs(a.intermediatePower - palsById.get(child).breedingRank) - Math.abs(b.intermediatePower - palsById.get(child).breedingRank) || a.parentA.localeCompare(b.parentA))
  .slice(0, 8)]));

const meta = {
  generatedAt: fetchedAt,
  sourceHash: createHash('sha256').update(enHtml + jaHtml).digest('hex'),
  sourceVersion: 'Palworld.gg current Paldeck pages',
  catalogCount: pals.length,
  normalPairCount: normal.length,
  specialCount: special.length,
  formula: 'floor((parentA.breedingRank + parentB.breedingRank + 1) / 2), then nearest rank; special combinations override',
};

await mkdir(DATA_DIR, { recursive: true });
await mkdir(NEO4J_DIR, { recursive: true });
await writeFile(`${DATA_DIR}/pals.json`, JSON.stringify({ meta, pals }, null, 2) + '\n');
await writeFile(`${DATA_DIR}/breeding.json`, JSON.stringify({ meta, special, featuredNormal, normalCount: normal.length }, null, 2) + '\n');
await writeFile(`${DATA_DIR}/sources.json`, JSON.stringify({ generatedAt: fetchedAt, sources }, null, 2) + '\n');

const normalRows = normal.map((row) => ({ ...row, parentAName: palsById.get(row.parentA).nameEn, parentBName: palsById.get(row.parentB).nameEn, childName: palsById.get(row.child).nameEn }));
await writeFile(`${NEO4J_DIR}/pals.csv`, csv(pals.map((pal) => ({ ...pal, elements: pal.elements.join('|') })), ['id', 'order', 'nameEn', 'nameJa', 'imageFile', 'imageUrl', 'elements', 'rarity', 'rarityTier', 'breedingRank']));
await writeFile(`${NEO4J_DIR}/breeding_edges.csv`, csv(normalRows, ['id', 'parentA', 'parentAName', 'parentB', 'parentBName', 'child', 'childName', 'intermediatePower', 'rule']));
await writeFile(`${NEO4J_DIR}/special_edges.csv`, csv(special, ['id', 'child', 'childName', 'parentA', 'parentAName', 'parentB', 'parentBName', 'kind', 'status']));
await writeFile(`${NEO4J_DIR}/import.cypher`, `// Generated ${fetchedAt}
CREATE CONSTRAINT pal_id IF NOT EXISTS FOR (p:Pal) REQUIRE p.id IS UNIQUE;

LOAD CSV WITH HEADERS FROM 'file:///pals.csv' AS row
MERGE (p:Pal {id: row.id})
SET p.order = toInteger(row.order), p.nameEn = row.nameEn, p.nameJa = row.nameJa,
    p.imageFile = row.imageFile, p.imageUrl = row.imageUrl, p.elements = split(row.elements, '|'),
    p.rarity = toInteger(row.rarity), p.rarityTier = row.rarityTier, p.breedingRank = toInteger(row.breedingRank);

LOAD CSV WITH HEADERS FROM 'file:///breeding_edges.csv' AS row
MATCH (a:Pal {id: row.parentA}), (b:Pal {id: row.parentB}), (c:Pal {id: row.child})
MERGE (a)-[r:BREEDS_TO {id: row.id}]->(c)
SET r.parentRole = 'A', r.intermediatePower = toInteger(row.intermediatePower), r.rule = row.rule, r.partnerId = b.id;

LOAD CSV WITH HEADERS FROM 'file:///special_edges.csv' AS row
MATCH (a:Pal {id: row.parentA}), (b:Pal {id: row.parentB}), (c:Pal {id: row.child})
MERGE (a)-[r:SPECIAL_BREEDING {id: row.id}]->(c)
SET r.parentRole = 'A', r.kind = row.kind, r.status = row.status, r.partnerId = b.id;
`);
await writeFile(`${NEO4J_DIR}/queries.cypher`, `// Target Pal and its direct parents
MATCH (a:Pal)-[r:SPECIAL_BREEDING|BREEDS_TO]->(c:Pal)
MATCH (b:Pal {id: r.partnerId})
WHERE c.id = 'anubis'
RETURN a.nameEn AS parentA, b.nameEn AS parentB, type(r) AS relation, r.intermediatePower
ORDER BY relation, r.intermediatePower;

// Parent candidates for every target, ranked by closeness to the target rank
MATCH (a:Pal)-[r:BREEDS_TO]->(c:Pal)
MATCH (b:Pal {id: r.partnerId})
RETURN c.nameEn AS child, a.nameEn AS parentA, b.nameEn AS parentB, r.intermediatePower
ORDER BY child, abs(c.breedingRank - r.intermediatePower);
`);

console.log(`Generated ${pals.length} pals, ${normal.length} normal pairs, ${special.length} special rows (${special.filter((row) => row.status === 'resolved').length} resolved).`);
