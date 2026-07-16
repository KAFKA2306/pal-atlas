# PAL ATLAS

Palworld 1.0 のパル図鑑、Breeding Rank、特殊配合、通常配合計算を一つのグラフとして扱う独立サイトです。

## Published site

- GitHub Pages: [https://kafka2306.github.io/pal-atlas/](https://kafka2306.github.io/pal-atlas/)
- Repository: [github.com/KAFKA2306/pal-atlas](https://github.com/KAFKA2306/pal-atlas)

## Local

```bash
npm install
npm run data
npm run dev
```

`npm run data` は `palworld.gg` の英語/日本語 Paldeck を取得し、297 件の正規化データと Neo4j 用 CSV/Cypher を生成します。画像は元サイトの URL を参照します。サイト運営者の許諾・規約に従って利用してください。

## Data model

- `Pal` — canonical name, Japanese name, elements, rarity, Breeding Rank, source image URL
- `BREEDS_TO` — normal rank calculation result for every unordered parent pair, including self-pairs
- `SPECIAL_BREEDING` — exact parent-pair overrides such as Faleris or elemental variants
- `ACQUISITION_NOTE` — mutation, mission reward, or worker recommendation; not a breeding recipe

通常配合は `floor((rankA + rankB + 1) / 2)` を中間値として、最も近い Pal に解決します。特殊配合はこの解決を上書きします。データの意味が混ざらないよう、`targetBreedingRank` と `intermediatePower` は別フィールドです。

## Sources

- [Palworld.gg Paldeck / breeding calculator](https://palworld.gg/breeding-calculator) — current catalog, Breeding Rank, image URL baseline
- [Palworld Wiki — Breeding](https://palworld.wiki.gg/wiki/Breeding) — normal calculation and special-combination rule reference
- [Game8 — Breeding Combos Calculator](https://game8.co/games/Palworld/archives/440530) — breeding workflow and special-combination cross-check
- [Paldeck](https://www.paldeck.cc/breeding) — independent database cross-check
- [Pocketpair official news](https://news.palworldgame.com/) — official release/news context
- [Pocketpair official server docs](https://docs.palworldgame.com/) — official documentation entry point
- User-provided [deep research report](file:///mnt/d/temp/deep-research-report.md) — review notes and classification decisions; not bundled into the public build

## GitHub Pages

`.github/workflows/deploy-pages.yml` builds the committed data snapshot and deploys `dist/` to [GitHub Pages](https://kafka2306.github.io/pal-atlas/). Set Pages source to **GitHub Actions** in repository settings if it is not enabled yet. Run `npm run data` intentionally when refreshing the external snapshot; this keeps a Pages deploy reproducible even if a source page changes or is unavailable.

## Notice

This is an independent fan project and is not affiliated with Pocketpair. Palworld and its imagery belong to their respective rights holders. The repository stores source links rather than republishing the image files by default.
