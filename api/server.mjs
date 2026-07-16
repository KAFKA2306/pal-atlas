import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 8787);
const neo4jUrl = process.env.NEO4J_HTTP_URL ?? 'http://127.0.0.1:7474';
const neo4jUser = process.env.NEO4J_USER ?? 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD ?? 'pal-atlas-dev';

async function query(statement, parameters = {}) {
  const response = await fetch(`${neo4jUrl}/db/neo4j/tx/commit`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${neo4jUser}:${neo4jPassword}`).toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ statements: [{ statement, parameters }] }),
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length) throw new Error(body.errors?.[0]?.message ?? `Neo4j HTTP ${response.status}`);
  const result = body.results[0];
  return result.data.map(({ row }) => Object.fromEntries(result.columns.map((column, index) => [column, row[index]])));
}

function json(response, status, body) {
  response.writeHead(status, { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function limit(url) {
  return Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50) || 50, 1), 200);
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === 'OPTIONS') return json(response, 204, {});
  if (!url.pathname.startsWith('/api/')) return json(response, 404, { error: 'not_found' });

  if (url.pathname === '/api/health') {
    await query('RETURN 1 AS ok');
    return json(response, 200, { ok: true, database: 'neo4j' });
  }

  if (url.pathname === '/api/pals') {
    const q = url.searchParams.get('q') ?? '';
    const element = url.searchParams.get('element') ?? '';
    const rows = await query(`
      MATCH (p:Pal)
      WHERE ($q = '' OR toLower(p.nameEn) CONTAINS toLower($q) OR toLower(p.nameJa) CONTAINS toLower($q))
        AND ($element = '' OR $element IN p.elements)
      RETURN p.id AS id, p.nameEn AS nameEn, p.nameJa AS nameJa, p.elements AS elements, p.breedingRank AS breedingRank, p.imageUrl AS imageUrl
      ORDER BY p.breedingRank, p.sourceIndex, p.order
      LIMIT $limit`, { q, element, limit: limit(url) });
    return json(response, 200, rows);
  }

  const recipeMatch = url.pathname.match(/^\/api\/pals\/([^/]+)\/recipes$/);
  if (recipeMatch) {
    const rows = await query(`
      MATCH (pair:BreedingPair)-[:PRODUCES]->(child:Pal {id: $id})
      MATCH (a:Pal)-[:PARENT_A]->(pair)
      MATCH (b:Pal)-[:PARENT_B]->(pair)
      RETURN pair.id AS pairId, pair.kind AS kind, pair.specialKind AS specialKind, pair.intermediatePower AS intermediatePower, pair.rule AS rule,
        a.id AS parentA, a.nameEn AS parentAEn, a.nameJa AS parentAJa, a.breedingRank AS parentARank,
        b.id AS parentB, b.nameEn AS parentBEn, b.nameJa AS parentBJa, b.breedingRank AS parentBRank,
        child.id AS child, child.nameEn AS childEn, child.nameJa AS childJa, child.breedingRank AS childRank
      ORDER BY CASE pair.kind WHEN 'special' THEN 0 ELSE 1 END, pair.intermediatePower, pair.id
      LIMIT $limit`, { id: recipeMatch[1], limit: limit(url) });
    return json(response, 200, rows);
  }

  const palMatch = url.pathname.match(/^\/api\/pals\/([^/]+)$/);
  if (palMatch) {
    const rows = await query(`
      MATCH (p:Pal {id: $id})
      RETURN p.id AS id, p.nameEn AS nameEn, p.nameJa AS nameJa, p.elements AS elements, p.rarity AS rarity, p.rarityTier AS rarityTier, p.breedingRank AS breedingRank, p.imageUrl AS imageUrl, p.ignoreCombi AS ignoreCombi`, { id: palMatch[1] });
    return rows[0] ? json(response, 200, rows[0]) : json(response, 404, { error: 'pal_not_found' });
  }

  const breedMatch = url.pathname === '/api/breed' ? url.searchParams : null;
  if (breedMatch?.get('parentA') && breedMatch.get('parentB')) {
    const rows = await query(`
      MATCH (a:Pal {id: $a})-[:PARENT_A]->(pair:BreedingPair)-[:PRODUCES]->(child:Pal)
      MATCH (b:Pal {id: $b})-[:PARENT_B]->(pair)
      RETURN pair.id AS pairId, pair.kind AS kind, pair.specialKind AS specialKind, pair.intermediatePower AS intermediatePower, child.id AS child, child.nameEn AS childEn, child.nameJa AS childJa, child.breedingRank AS childRank
      UNION
      MATCH (a:Pal {id: $a})-[:PARENT_B]->(pair:BreedingPair)-[:PRODUCES]->(child:Pal)
      MATCH (b:Pal {id: $b})-[:PARENT_A]->(pair)
      RETURN pair.id AS pairId, pair.kind AS kind, pair.specialKind AS specialKind, pair.intermediatePower AS intermediatePower, child.id AS child, child.nameEn AS childEn, child.nameJa AS childJa, child.breedingRank AS childRank`, { a: breedMatch.get('parentA'), b: breedMatch.get('parentB') });
    return json(response, 200, rows);
  }

  return json(response, 404, { error: 'not_found' });
}

createServer((request, response) => route(request, response).catch((error) => json(response, 502, { error: 'graph_unavailable', message: error.message }))).listen(port, '127.0.0.1', () => {
  console.log(`PAL ATLAS API listening on http://127.0.0.1:${port}`);
});
