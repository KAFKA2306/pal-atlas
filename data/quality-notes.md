# Data quality notes

The supplied deep-research report identified several model boundaries that are preserved here:

- Japanese and English names are joined by the source image file, not by spelling assumptions. For example, `アグニドラ` is the Japanese label for `Jormuntide Ignis`; it is not `Aegidron`.
- `breedingRank` is a Pal property. A value such as `682.5` is an intermediate parent calculation and is not stored as a target rank.
- unique/elemental combinations are stored as `SPECIAL_BREEDING` rows and are not allowed to silently collapse into the normal rank formula.
- mutation, mission rewards, and worker recommendations are acquisition/knowledge notes, not breeding edges. They remain a follow-up layer rather than being fabricated as recipes.
- the generated catalog is the exact count returned by the current Palworld.gg English/Japanese pages at generation time; source hash and timestamp are stored in `data/pals.json`.

The dataset is therefore a graph-ready current snapshot, not a claim that every legacy Japanese guide and every current community database uses identical labels or ranks.
