# Neo4j graph model

The graph is intentionally small in vocabulary and explicit in semantics.

```text
(Pal)-[:BREEDS_TO {partnerId, intermediatePower, rule}]->(Pal)
(Pal)-[:SPECIAL_BREEDING {partnerId, kind, status}]->(Pal)
(Pal)-[:HAS_NOTE]->(Note)
```

The relationship points from `parentA` to `child`; `partnerId` stores `parentB`. This keeps each pair queryable as one relationship while preserving the two-parent identity. `SPECIAL_BREEDING` is not mixed into the normal formula. A missing or unresolved source row is not promoted into the graph.

## Import

1. Put `pals.csv`, `breeding_edges.csv`, and `special_edges.csv` in Neo4j's import directory.
2. Run `import.cypher` in Neo4j Browser or cypher-shell.
3. Use `queries.cypher` for target-first parent exploration.

The normal edge file contains every unordered pair, including self-pairs, generated from the source catalog's current Breeding Rank values. It is a deterministic calculation layer; it is not a claim that the game UI lists every pair individually.

## Why this shape

- `Pal` is the stable entity used by the UI, CSV, and graph.
- `breedingRank` is a property of the Pal, not a relationship rank.
- `intermediatePower` is a property of a normal breeding attempt and is kept separate from the target rank.
- exact combinations are explicit overrides, so special variants cannot be mistaken for rank-nearest results.
- image URLs and source provenance remain properties/metadata rather than hidden UI behavior.
- mutation, mission, and recommendation records are `Note` nodes so they cannot be mistaken for a parent pair.
