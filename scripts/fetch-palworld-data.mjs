import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA_DIR = `${ROOT}/data`;
const NEO4J_DIR = `${ROOT}/neo4j`;
const EN_URL = 'https://palworld.gg/breeding-calculator';
const JA_URL = 'https://palworld.gg/ja/breeding-calculator';
const WIKI_API = 'https://palworld.wiki.gg/api.php';
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

const sources = [
  { id: 'palworld-gg', title: 'Palworld.gg Paldeck / Breeding Calculator', url: EN_URL, role: '297-entry catalog and Breeding Rank' },
  { id: 'palworld-wiki', title: 'Palworld Wiki — Breeding', url: 'https://palworld.wiki.gg/wiki/Breeding', role: 'normal formula and special-combination rule cross-check' },
  { id: 'palworld-wiki-images', title: 'Palworld Wiki — Pal icon files', url: 'https://palworld.wiki.gg/wiki/Template:Icon', role: '297 verified external icon URLs' },
  { id: 'webp-proxy', title: 'wsrv.nl image optimizer', url: 'https://images.weserv.nl/', role: 'external WebP delivery URL generated from each source image' },
  { id: 'game8', title: 'Game8 — Breeding Combos Calculator', url: 'https://game8.co/games/Palworld/archives/440530', role: 'breeding workflow and special-combination cross-check' },
  { id: 'paldeck', title: 'Paldeck', url: 'https://www.paldeck.cc/breeding', role: 'independent database cross-check' },
  { id: 'official-news', title: 'Pocketpair official news', url: 'https://news.palworldgame.com/', role: 'official release and news context' },
  { id: 'official-game', title: 'Pocketpair official Palworld site', url: 'https://www.pocketpair.jp/en/games-en/palworld-en/', role: 'official game and version context' },
  { id: 'official-docs', title: 'Pocketpair official server docs', url: 'https://docs.palworldgame.com/', role: 'official documentation entry point' },
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

async function loadSourcePals(html) {
  const assets = [...new Set([...html.matchAll(/\/_nuxt\/[^"']+\.js/g)].map((match) => new URL(match[0], EN_URL).href))];
  const scripts = await Promise.all(assets.map(async (url) => ({ url, text: await (await fetch(url)).text() })));
  const route = scripts.find(({ text }) => text.includes('../data/pals/en.json'));
  const dataAsset = route?.text.match(/\.\.\/data\/pals\/en\.json.*?import\("([^"]+\.js)"\)/s)?.[1];
  if (!route || !dataAsset) throw new Error('Palworld.gg source data module was not found');
  const sourceResponse = await fetch(new URL(dataAsset, route.url));
  if (!sourceResponse.ok) throw new Error(`Palworld.gg source data fetch failed: ${sourceResponse.status}`);
  const tempPath = `${tmpdir()}/pal-atlas-source-${process.pid}-${Date.now()}.mjs`;
  await writeFile(tempPath, await sourceResponse.text());
  try {
    const sourceModule = await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);
    return Object.values(sourceModule).filter((pal) => pal?.name && Number.isFinite(pal.combiRank));
  } finally {
    await rm(tempPath, { force: true });
  }
}

async function loadWikiIconUrls(pals) {
  const result = new Map();
  for (let index = 0; index < pals.length; index += 20) {
    const titles = pals.slice(index, index + 20).map((pal) => `File:${pal.name} icon.png`).join('|');
    const url = `${WIKI_API}?action=query&format=json&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|mime`;
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(url, { headers: { 'User-Agent': 'pal-atlas-data-builder/0.1' } });
      if (response.status !== 429 || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    if (!response.ok) throw new Error(`Palworld Wiki image API failed: ${response.status}`);
    const payload = await response.json();
    for (const page of Object.values(payload.query?.pages ?? {})) {
      const image = page.imageinfo?.[0];
      if (!image?.url) continue;
      const name = page.title.replace(/^File:/, '').replace(/ icon\.png$/i, '');
      result.set(name, { url: image.url, mime: image.mime });
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const missing = pals.filter((pal) => !result.has(pal.name));
  if (missing.length) throw new Error(`Palworld Wiki icon data missing for ${missing.length} pals: ${missing.map((pal) => pal.name).join(', ')}`);
  return result;
}

function csv(rows, columns) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [columns.join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\n') + '\n';
}

function webpUrl(sourceUrl) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(sourceUrl)}&output=webp&w=512&h=512&fit=contain`;
}

const [enResponse, jaResponse] = await Promise.all([fetch(EN_URL), fetch(JA_URL)]);
if (!enResponse.ok || !jaResponse.ok) throw new Error(`Source fetch failed: ${enResponse.status}/${jaResponse.status}`);
const [enHtml, jaHtml] = await Promise.all([enResponse.text(), jaResponse.text()]);
const english = parsePage(enHtml);
const japanese = parsePage(jaHtml);
const sourcePals = await loadSourcePals(enHtml);
if (english.length < 250 || japanese.length < 250) throw new Error(`Unexpected catalog size: ${english.length}/${japanese.length}`);
if (sourcePals.length < 250) throw new Error(`Unexpected source data size: ${sourcePals.length}`);
const wikiIcons = await loadWikiIconUrls(english);

const jaByImage = new Map(japanese.map((pal) => [pal.imageFile, pal]));
const sourceBySlug = new Map(sourcePals.map((pal) => [pal.slug.trim(), pal]));
const pals = english.map((pal) => {
  const ja = jaByImage.get(pal.imageFile);
  const source = sourceBySlug.get(slug(pal.name));
  if (!source) throw new Error(`Source data missing for ${pal.name}`);
  return {
    id: slug(pal.name),
    order: pal.order,
    nameEn: pal.name,
    nameJa: ja?.name ?? pal.name,
    imageFile: pal.imageFile,
    imageUrl: pal.imageUrl,
    imageOriginalUrl: pal.imageUrl,
    imageReferenceUrl: wikiIcons.get(pal.name).url,
    imageWebpUrl: webpUrl(wikiIcons.get(pal.name).url),
    imageMime: wikiIcons.get(pal.name).mime,
    imageDelivery: 'webp-proxy',
    elements: pal.elements,
    rarity: pal.rarity,
    rarityTier: pal.rarityTier,
    breedingRank: source.combiRank,
    combiPriority: source.combiPriority,
    sourceIndex: source.index,
    ignoreCombi: source.ignoreCombi,
    sourceId: source.id,
  };
});
const sourceById = new Map(sourcePals.map((pal) => [pal.id, pal]));
const currentBySlug = new Map(pals.map((pal) => [pal.id, pal]));
const resolveSourceId = (id) => currentBySlug.get(sourceById.get(id)?.slug.trim());
const comboRows = sourcePals.flatMap((owner) => (owner.combos ?? []).map((combo) => ({ owner, combo })));
const comboChildren = new Map();
for (const { combo } of comboRows) {
  const pairKey = [combo.a, combo.b].sort().join('::');
  const children = comboChildren.get(pairKey) ?? new Set();
  children.add(combo.child);
  comboChildren.set(pairKey, children);
}
const seenSpecial = new Set();
const special = comboRows.flatMap(({ owner, combo }) => {
  const key = `${combo.a}::${combo.b}::${combo.child}`;
  if (seenSpecial.has(key)) return [];
  seenSpecial.add(key);
  const child = resolveSourceId(combo.child);
  const parentA = resolveSourceId(combo.a);
  const parentB = resolveSourceId(combo.b);
  const sourceChild = sourceById.get(combo.child);
  const sourceParentA = sourceById.get(combo.a);
  const sourceParentB = sourceById.get(combo.b);
  return [{
    id: `special::${key}`,
    child: child?.id ?? slug(sourceChild?.name ?? combo.child), childName: child?.nameEn ?? sourceChild?.name ?? combo.child,
    parentA: parentA?.id ?? slug(sourceParentA?.name ?? combo.a), parentAName: parentA?.nameEn ?? sourceParentA?.name ?? combo.a,
    parentB: parentB?.id ?? slug(sourceParentB?.name ?? combo.b), parentBName: parentB?.nameEn ?? sourceParentB?.name ?? combo.b,
    kind: comboChildren.get([combo.a, combo.b].sort().join('::'))?.size > 1 ? 'gender-specific / source combo' : 'source combo',
    status: child && parentA && parentB ? 'resolved' : 'unresolved',
    sourceOwner: owner.name,
  }];
});

const rankSorted = pals.filter((pal) => !pal.ignoreCombi).sort((a, b) => a.breedingRank - b.breedingRank || a.sourceIndex - b.sourceIndex || a.order - b.order);
const normal = [];
const normalByChild = new Map(pals.map((pal) => [pal.id, []]));
for (let i = 0; i < pals.length; i += 1) {
  for (let j = i; j < pals.length; j += 1) {
    const a = pals[i]; const b = pals[j];
    const intermediatePower = Math.floor((a.breedingRank + b.breedingRank + 1) / 2);
    const child = rankSorted.reduce((best, candidate) => {
      const distance = Math.abs(candidate.breedingRank - intermediatePower);
      const bestDistance = Math.abs(best.breedingRank - intermediatePower);
      return distance < bestDistance || (distance === bestDistance && candidate.sourceIndex < best.sourceIndex) ? candidate : best;
    }, rankSorted[0]);
    const row = { id: `${a.id}::${b.id}`, parentA: a.id, parentB: b.id, child: child.id, intermediatePower, rule: 'nearest-breeding-rank' };
    normal.push(row);
    normalByChild.get(child.id).push(row);
  }
}

const palsById = new Map(pals.map((pal) => [pal.id, pal]));
const childrenByParent = new Map(pals.map((pal) => [pal.id, new Map()]));
const addChildOutput = (parentId, row) => {
  const outputs = childrenByParent.get(parentId);
  if (!outputs) return;
  const key = `${parentId}::${row.child}`;
  const existing = outputs.get(key);
  if (!existing || row.kind === 'special' || (existing.kind !== 'special' && row.delta < existing.delta)) outputs.set(key, row);
};
for (const row of special) {
  for (const [parent, other] of [[row.parentA, row.parentB], [row.parentB, row.parentA]]) {
    addChildOutput(parent, { id: row.id, parent, otherParent: other, child: row.child, kind: 'special', specialKind: row.kind });
  }
}
for (const row of normal) {
  const child = palsById.get(row.child);
  for (const [parent, other] of [[row.parentA, row.parentB], [row.parentB, row.parentA]]) {
    addChildOutput(parent, { id: row.id, parent, otherParent: other, child: row.child, kind: 'normal', intermediatePower: row.intermediatePower, delta: Math.abs(row.intermediatePower - child.breedingRank), rule: row.rule });
  }
}
const children = Object.fromEntries([...childrenByParent].map(([parent, rows]) => [parent, [...rows.values()].sort((a, b) => (a.kind === 'special' ? -1 : 1) - (b.kind === 'special' ? -1 : 1) || (a.delta ?? 0) - (b.delta ?? 0) || a.child.localeCompare(b.child) || a.id.localeCompare(b.id))]));
const childrenUi = Object.fromEntries(Object.entries(children).map(([parent, rows]) => [parent, { total: rows.length, rows: rows.slice(0, 12) }]));
const featuredNormal = Object.fromEntries([...normalByChild.entries()].map(([child, rows]) => [child, rows
  .sort((a, b) => Math.abs(a.intermediatePower - palsById.get(child).breedingRank) - Math.abs(b.intermediatePower - palsById.get(child).breedingRank) || a.parentA.localeCompare(b.parentA))
  .slice(0, 4)]));

const meta = {
  generatedAt: fetchedAt,
  sourceHash: createHash('sha256').update(enHtml + jaHtml).digest('hex'),
  sourceVersion: 'Palworld.gg current Paldeck pages',
  catalogCount: pals.length,
  normalPairCount: normal.length,
  specialCount: special.length,
  formula: 'floor((parentA.breedingRank + parentB.breedingRank + 1) / 2), then nearest eligible rank; source combos override',
  eligibleChildCount: rankSorted.length,
};

await mkdir(DATA_DIR, { recursive: true });
await mkdir(NEO4J_DIR, { recursive: true });
await writeFile(`${DATA_DIR}/pals.json`, JSON.stringify({ meta, pals }, null, 2) + '\n');
await writeFile(`${DATA_DIR}/breeding.json`, JSON.stringify({ meta, normal, special, featuredNormal, normalCount: normal.length }, null, 2) + '\n');
await writeFile(`${DATA_DIR}/children.json`, JSON.stringify({ generatedAt: fetchedAt, outputs: children }, null, 2) + '\n');
await writeFile(`${DATA_DIR}/children-ui.json`, JSON.stringify({ generatedAt: fetchedAt, outputs: childrenUi }, null, 2) + '\n');
await writeFile(`${DATA_DIR}/sources.json`, JSON.stringify({ generatedAt: fetchedAt, sources }, null, 2) + '\n');

const normalRows = normal.map((row) => ({ ...row, parentAName: palsById.get(row.parentA).nameEn, parentBName: palsById.get(row.parentB).nameEn, childName: palsById.get(row.child).nameEn }));
await writeFile(`${NEO4J_DIR}/pals.csv`, csv(pals.map((pal) => ({ ...pal, elements: pal.elements.join('|') })), ['id', 'order', 'nameEn', 'nameJa', 'imageFile', 'imageUrl', 'imageOriginalUrl', 'imageReferenceUrl', 'imageWebpUrl', 'imageMime', 'imageDelivery', 'elements', 'rarity', 'rarityTier', 'breedingRank', 'combiPriority', 'sourceIndex', 'ignoreCombi', 'sourceId']));
await writeFile(`${NEO4J_DIR}/breeding_edges.csv`, csv(normalRows, ['id', 'parentA', 'parentAName', 'parentB', 'parentBName', 'child', 'childName', 'intermediatePower', 'rule']));
await writeFile(`${NEO4J_DIR}/special_edges.csv`, csv(special, ['id', 'child', 'childName', 'parentA', 'parentAName', 'parentB', 'parentBName', 'kind', 'status', 'sourceOwner']));
await writeFile(`${NEO4J_DIR}/import.cypher`, `CREATE CONSTRAINT pal_id IF NOT EXISTS FOR (p:Pal) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT breeding_pair_id IF NOT EXISTS FOR (b:BreedingPair) REQUIRE b.id IS UNIQUE;

LOAD CSV WITH HEADERS FROM 'file:///pals.csv' AS row
MERGE (p:Pal {id: row.id})
SET p.order = toInteger(row.order), p.nameEn = row.nameEn, p.nameJa = row.nameJa,
    p.imageFile = row.imageFile, p.imageUrl = row.imageUrl, p.imageOriginalUrl = row.imageOriginalUrl, p.imageReferenceUrl = row.imageReferenceUrl, p.imageWebpUrl = row.imageWebpUrl, p.imageMime = row.imageMime, p.imageDelivery = row.imageDelivery, p.elements = split(row.elements, '|'),
    p.rarity = toInteger(row.rarity), p.rarityTier = row.rarityTier, p.breedingRank = toInteger(row.breedingRank),
    p.combiPriority = toInteger(row.combiPriority), p.sourceIndex = toInteger(row.sourceIndex), p.ignoreCombi = row.ignoreCombi = 'true', p.sourceId = row.sourceId;

LOAD CSV WITH HEADERS FROM 'file:///breeding_edges.csv' AS row
MATCH (a:Pal {id: row.parentA}), (b:Pal {id: row.parentB}), (c:Pal {id: row.child})
MERGE (pair:BreedingPair {id: row.id})
SET pair.kind = 'normal', pair.intermediatePower = toInteger(row.intermediatePower), pair.rule = row.rule
MERGE (a)-[:PARENT_A]->(pair)
MERGE (b)-[:PARENT_B]->(pair)
MERGE (pair)-[:PRODUCES]->(c);

LOAD CSV WITH HEADERS FROM 'file:///special_edges.csv' AS row
MATCH (a:Pal {id: row.parentA}), (b:Pal {id: row.parentB}), (c:Pal {id: row.child})
MERGE (pair:BreedingPair {id: row.id})
SET pair.kind = 'special', pair.specialKind = row.kind, pair.status = row.status, pair.sourceOwner = row.sourceOwner
MERGE (a)-[:PARENT_A]->(pair)
MERGE (b)-[:PARENT_B]->(pair)
MERGE (pair)-[:PRODUCES]->(c);
`);
await writeFile(`${NEO4J_DIR}/queries.cypher`, `MATCH (a:Pal)-[:PARENT_A|PARENT_B]->(pair:BreedingPair)-[:PRODUCES]->(c:Pal)
MATCH (b:Pal)-[:PARENT_A|PARENT_B]->(pair)
WHERE c.id = 'anubis' AND a.id <> b.id
RETURN a.nameEn AS parentA, b.nameEn AS parentB, pair.kind, pair.intermediatePower, pair.specialKind
ORDER BY pair.kind DESC, pair.intermediatePower;

MATCH (a:Pal)-[:PARENT_A|PARENT_B]->(pair:BreedingPair)-[:PRODUCES]->(c:Pal)
MATCH (b:Pal)-[:PARENT_A|PARENT_B]->(pair)
WHERE a.id < b.id
RETURN c.nameEn AS child, a.nameEn AS parentA, b.nameEn AS parentB, pair.kind, pair.intermediatePower
ORDER BY child, abs(c.breedingRank - pair.intermediatePower);
`);

console.log(`Generated ${pals.length} pals, ${normal.length} normal pairs, ${special.length} special rows (${special.filter((row) => row.status === 'resolved').length} resolved).`);
