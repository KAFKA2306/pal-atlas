# Neo4j graph model

The graph is intentionally small in vocabulary and explicit in semantics.

```text
(Pal)-[:PARENT_A]->(BreedingPair)<-[:PARENT_B]-(Pal)
(BreedingPair)-[:PRODUCES]->(Pal)
```

`BreedingPair` is the single relationship/event node for two parents and one child. This keeps both parents explicit, makes special-vs-normal semantics queryable, and avoids hiding the second parent in a relationship property. A missing or unresolved source row is not promoted into the graph.

## Import

1. Run `npm run data` once to generate the ignored import files.
2. Start the one graph DB with `docker compose -f neo4j/compose.yml up -d`.
3. Run `docker compose -f neo4j/compose.yml exec pal-atlas-neo4j cypher-shell -u neo4j -p pal-atlas-dev -f /var/lib/neo4j/import/import.cypher`.
4. Use `queries.cypher` for target-first parent exploration.

The normal edge file contains every unordered pair, including self-pairs, generated from the source catalog's current Breeding Rank values. Only eligible children are selected. Source `combos` are imported as special events; unresolved source rows are kept out of the graph.

## Why this shape

- `Pal` is the stable entity used by the UI, export, and graph.
- `BreedingPair` is the only pair-level node; normal and special rows do not become separate databases.
- `breedingRank` is a property of the Pal, not a relationship rank.
- `intermediatePower` is a property of a normal breeding attempt and is kept separate from the target rank.
- exact combinations are explicit overrides, so special variants cannot be mistaken for rank-nearest results.
- image URLs and source provenance remain properties/metadata rather than hidden UI behavior.
