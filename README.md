# PAL ATLAS — パル図鑑・配合検索

**欲しいパルが決まっているなら、探すべきはそのパルではなく「親」かもしれない。**

PAL ATLASは、Palworldのパル図鑑を眺めるだけでなく、**「どの親から目的のパルを作れるか」**と**「この2体を配合すると何が生まれるか」**を両方向からたどれるようにした非公式ファンサイトです。

Breeding Rank、通常配合、特殊配合を一つのデータ構造で扱い、図鑑と配合グラフの両方から親子関係を探索できます。

**公開サイト:** https://kafka2306.github.io/pal-atlas/

## できること

- パル名から図鑑情報を検索
- 親パル2体から通常配合結果を計算
- 目的のパルを作る配合候補を確認
- 通常配合と特殊配合を区別して表示
- 静的JSON APIから図鑑・配合データを再利用
- 外部サイトへiframeで配合検索ウィジェットを埋め込み
- Neo4j上で親子関係をグラフとして探索
- 保存した配合を同じブラウザの`localStorage`に保持

## 正準フロー

取得・provenance・検証・公開の責務と、主要KPI・非目標は [`docs/architecture/canonical-flow.md`](docs/architecture/canonical-flow.md) に固定しています。Neo4jや埋め込みwidgetを別の正準データ源にはしません。

## 外部サイト向け配合ウィジェット

公開ウィジェット: https://kafka2306.github.io/pal-atlas/embed/breed/

`parentA` / `parentB` / `target`、`lang=ja|en`、検証済み形式の`partner` / `campaign`をURL parameterで指定できます。ウィジェットは正準の公開`api/pals.json`と`api/breeding.json`だけを読み、未解決の特殊配合や競合を確定結果へフォールバックしません。

コピー&ペースト用iframe、計測イベント、attribution境界は [`docs/embed.md`](docs/embed.md) を参照してください。

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

Node.js 22、Python 3.12、uvを前提にします。依存関係とcommit hookは1コマンドで揃えます。

```bash
npm run setup
npm run data
npm run dev
```

変更を提出する前の正準チェックは次の1コマンドです。

```bash
npm run check
```

`npm run check`は、変更されたJavaScriptにBiome/Oxlint、Python全体にRuff/Pyrefly strict、既存repository ratchet、embed contract、生成データと静的APIを使うMCP contractを順に実行します。

Neo4j APIを起動する場合:

```bash
npm run api
```

Python MCPを起動する場合:

```bash
uv sync --locked
npm run data
npm run static-api
uv run python scripts/pal_mcp_server.py
```

`npm run data`は取得元からデータを読み込み、正規化JSONとNeo4j用CSV/Cypherを生成します。生成スナップショットは大容量のためGit管理外で、ローカル実行とGitHub Actionsの双方で再生成します。

## 品質ゲート

- JavaScript: `package-lock.json`を正準lockとし、Biomeでformat/import整理、Oxlintでlintします。既存全体のformat差分を一括生成せず、`main`との差分・staged・working tree・untrackedの変更ファイルだけを厳格化します。
- Python: `uv.lock`を正準lockとし、`scripts/`と`tests/`全体をRuff format/lintとPyrefly strictで検証します。baselineや広域ignoreは使いません。
- `prek`: commit時はネットワーク取得やE2Eを走らせず、同じ静的品質ゲートだけを再利用します。
- Nx/Turborepoは、独立build/test単位を持つmonorepoではないため導入しません。
- TypeScript/`tsc`/Zodは、このrepositoryがJavaScript実装であるため導入しません。

## 主な構成

- `src/` — データ取得、正規化、配合計算
- `public/embed/breed/` — 外部埋め込み用の配合検索ウィジェット
- `neo4j/` — Neo4jの構成と投入用データ
- `dist/` — GitHub Pages向け生成物
- `ontology/project.yaml` — 取得・計算・公開判定の証拠モデル
- `.github/workflows/deploy-pages.yml` — データ更新、ビルド、Pages公開
- `.github/workflows/quality.yml` — lock drift、formatter/linter、型、MCP contractのPR品質ゲート

## 情報源と注意点

データ取得・照合にはPalworld.gg、Palworld Wiki、Game8、Paldeck、Pocketpair公式サイト・公式ニュース・公式ドキュメントを使用します。正確な最新仕様やゲーム内挙動は公式情報を優先してください。

本プロジェクトはPocketpairとは関係のない非公式ファンプロジェクトです。名称・画像などの権利は各権利者に帰属します。

**README最終監査:** 2026-08-15
