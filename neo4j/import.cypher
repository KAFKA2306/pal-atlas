// Generated 2026-07-16T15:18:18.893Z
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
