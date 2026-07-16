// Target Pal and its direct parents
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
