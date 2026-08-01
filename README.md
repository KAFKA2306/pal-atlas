# PAL ATLAS — パル図鑑・配合検索

**公開サイト:** https://kafka2306.github.io/pal-atlas/

PAL ATLASは、Palworldのパル図鑑、Breeding Rank、通常配合、特殊配合を一つのデータ構造で扱う非公式ファンサイトです。

「どの親から目的のパルを作れるか」「この2体を配合すると何が生まれるか」を、図鑑と配合グラフの両方から確認できます。

## できること

- パル名から図鑑情報を検索
- 親パル2体から通常配合結果を計算
- 目的のパルを作る配合候補を確認
- 通常配合と特殊配合を区別して表示
- 静的JSON APIから図鑑・配合データを再利用
- Neo4j上で親子関係をグラフとして探索
- 保存した配合を同じブラウザの`localStorage`に保持

## データの考え方

通常配合は次の値を基準に、通常配合対象のパルから最も近い候補を選びます。

```text
floor((rankA + rankB + 1) / 2)
```

取得元が明示する固有の組み合わせは、通常計算とは別の「特殊配合」として保存します。出典同士が一致しない場合は一方で上書きせず、競合状態として扱います。

機械可読な証拠構造は[`ontology/project.yaml`](ontology/project.yaml)にあります。

## 公開API

- [API index](https://kafka2306.github.io/pal-atlas/api/index.json)
- [Pal catalog](https://kafka2306.github.io/pal-atlas/api/pals.json)
- [Breeding pairs](https://kafka2306.github.io/pal-atlas/api/breeding.json)
- [Sources](https://kafka2306.github.io/pal-atlas/api/sources.json)
- [Anubis detail example](https://kafka2306.github.io/pal-atlas/api/pals/anubis.json)

ローカルのNeo4j APIは次の経路を提供します。

```text
GET /api/pals?q=anubis&limit=20
GET /api/pals/:id
GET /api/pals/:id/recipes
GET /api/pals/:id/outputs
GET /api/breed?parentA=anubis&parentB=katress
GET /api/health
```

## ローカル実行

```bash
npm install
npm run data
npm run dev
```

Neo4j APIを起動する場合:

```bash
npm run api
```

`npm run data`は取得元からデータを読み込み、正規化JSONとNeo4j用CSV/Cypherを生成します。生成スナップショットは大容量のためGit管理外で、ローカル実行とGitHub Actionsの双方で再生成します。

## 主な構成

- `src/` — データ取得、正規化、配合計算
- `neo4j/` — Neo4jの構成と投入用データ
- `dist/` — GitHub Pages向け生成物
- `ontology/project.yaml` — 取得・計算・公開判定の証拠モデル
- `.github/workflows/deploy-pages.yml` — データ更新、ビルド、Pages公開

## 情報源と注意点

データ取得・照合にはPalworld.gg、Palworld Wiki、Game8、Paldeck、Pocketpair公式サイト・公式ニュース・公式ドキュメントを使用します。正確な最新仕様やゲーム内挙動は公式情報を優先してください。

本プロジェクトはPocketpairとは関係のない非公式ファンプロジェクトです。名称・画像などの権利は各権利者に帰属します。

**README最終監査:** 2026-08-01
