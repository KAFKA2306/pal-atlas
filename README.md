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

`npm run data` は `palworld.gg` の英語/日本語 Paldeck と Palworld Wiki のアイコンAPIを取得し、正規化データと Neo4j 用 CSV/Cypher を生成します。生成スナップショットと CSV/Cypher は大容量のため Git 管理外です。画面は安定した元画像URLを使い、静的APIとNeo4jには `wsrv.nl` のWebP代替URLも残します。各サイトの許諾・規約に従って利用してください。

Neo4j は `neo4j/compose.yml` の `pal-atlas-neo4j` 一つだけを正本として保持します。Pages の JSON はそのグラフを表示するための生成物で、別の永続データベースではありません。

## Data model

- `Pal` — パル本体、配合値、通常配合対象外フラグ、画像URL
- `BreedingPair` — `PARENT_A` + `PARENT_B` → `PRODUCES` を表す配合イベント

通常配合は `floor((rankA + rankB + 1) / 2)` から、通常配合対象のパルだけを最近傍選択します。取得元の `combos` は特殊配合として自動取り込みします。

## API

Neo4jを参照する最小APIです。`npm run api` で起動します。

- `GET /api/pals?q=anubis&limit=20`
- `GET /api/pals/:id`
- `GET /api/pals/:id/recipes`
- `GET /api/breed?parentA=anubis&parentB=katress`
- `GET /api/health`

Pages上の静的API（Neo4jを常駐公開しない軽量経路）:

- [API index](https://kafka2306.github.io/pal-atlas/api/index.json)
- [Pal catalog](https://kafka2306.github.io/pal-atlas/api/pals.json)
- [Breeding pairs](https://kafka2306.github.io/pal-atlas/api/breeding.json)
- [Anubis detail](https://kafka2306.github.io/pal-atlas/api/pals/anubis.json)

## Sources

- [Palworld.gg Paldeck / breeding calculator](https://palworld.gg/breeding-calculator) — current catalog, Breeding Rank, image URL baseline
- [Palworld Wiki — Breeding](https://palworld.wiki.gg/wiki/Breeding) — normal calculation and special-combination rule reference
- [Game8 — Breeding Combos Calculator](https://game8.co/games/Palworld/archives/440530) — breeding workflow and special-combination cross-check
- [Paldeck](https://www.paldeck.cc/breeding) — independent database cross-check
- [Pocketpair official news](https://news.palworldgame.com/) — official release/news context
- [Pocketpair official server docs](https://docs.palworldgame.com/) — official documentation entry point

## GitHub Pages

`.github/workflows/deploy-pages.yml` refreshes the generated data, builds `dist/`, and deploys it to [GitHub Pages](https://kafka2306.github.io/pal-atlas/). Set Pages source to **GitHub Actions** in repository settings if it is not enabled yet. The generated snapshot is intentionally not committed; the workflow and local build both regenerate it from the recorded sources.

## Notice

This is an independent fan project and is not affiliated with Pocketpair. Palworld and its imagery belong to their respective rights holders. The repository stores source links rather than republishing the image files by default.
