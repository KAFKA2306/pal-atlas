# PAL ATLAS — パル図鑑・配合検索

**欲しいパルが決まっているなら、探すべきはそのパルではなく「親」かもしれない。**

PAL ATLAS は、Palworldの図鑑を眺めるだけでなく、**「この2体から何が生まれるか」と「目的のパルを作るにはどの親が必要か」を両方向からたどれる**非公式ファンサイトです。

- 公開サイト: https://kafka2306.github.io/pal-atlas/
- API index: https://kafka2306.github.io/pal-atlas/api/index.json
- 配合widget: https://kafka2306.github.io/pal-atlas/embed/breed/

## Vision

攻略情報を読む作業を、**手持ちのパルと目的のパルから、次に試す配合をすぐ決められる探索体験**へ変えます。

利用者が知りたいのは一覧ではありません。

- この2体を配合すると何になるか
- 目的のパルを作れる親候補は何か
- 通常配合か特殊配合か
- 情報源同士が一致しているか
- 外部サイトから同じ計算を再利用できるか

図鑑・配合計算・逆引き・APIを一つのcanonical dataから提供します。

## Design philosophy

- **One data model, two search directions.** 親→子と子→親で別データを持たない。
- **Special recipes stay explicit.** 固有組み合わせを通常Breeding Rank計算へ混ぜない。
- **Conflict is not a result.** source同士が一致しない特殊配合は、片方を勝手に採用せずconflictとして残す。
- **Static API is canonical for public clients.** widgetや別UIが独自の配合真実を持たない。
- **Derived result stays derived.** 公式情報・第三者source・計算結果を同じ種類の事実として扱わない。
- **Tooling stays proportional.** 小規模なJS/Python構成へ不要なmonorepo orchestrationや重複type stackを足さない。

## Why / 差別化

一般的な図鑑では「パルの情報を見る」、配合表では「親から結果を見る」が中心です。PAL ATLASは、**図鑑と配合graphを同じデータへ接続し、欲しい結果から親候補へ逆算できること**を中心にします。

Neo4j、静的JSON、iframe、MCPは差別化そのものではありません。これらは、同じ親子関係をWeb・API・graph・agentから再利用するためのprojectionです。

## User journey

```text
目的を選ぶ
  ├─ 親A + 親Bから結果を知りたい
  │    → breeding calculation
  │    → normal / specialを確認
  │
  └─ 欲しいパルを作りたい
       → target recipes
       → parent candidates
       → 手持ちと比較
       → 次の配合を決める
```

## Breeding model

通常配合はBreeding Rankを基準に、通常配合対象の中から最も近い候補を選びます。

```text
floor((rankA + rankB + 1) / 2)
```

取得元が明示する固有combinationは、通常計算とは別の特殊配合として保持します。sourceが競合する場合は、一方を自動採用しません。

機械可読な証拠モデル: [`ontology/project.yaml`](ontology/project.yaml)

## What you can do

- パル名から図鑑検索
- 親2体から通常配合結果を計算
- 目的パルから親候補を逆引き
- 通常 / 特殊配合を区別
- 保存した配合をbrowser localStorageへ保持
- 静的JSON APIを再利用
- 外部siteへ配合widgetを埋め込む
- Neo4jで親子graphを探索
- MCPからcanonical static dataを読む

## Public API

- [Pal catalog](https://kafka2306.github.io/pal-atlas/api/pals.json)
- [Breeding pairs](https://kafka2306.github.io/pal-atlas/api/breeding.json)
- [Sources](https://kafka2306.github.io/pal-atlas/api/sources.json)
- [Anubis detail](https://kafka2306.github.io/pal-atlas/api/pals/anubis.json)

Local Neo4j API:

```text
GET /api/pals?q=anubis&limit=20
GET /api/pals/:id
GET /api/pals/:id/recipes
GET /api/pals/:id/outputs
GET /api/breed?parentA=anubis&parentB=katress
GET /api/health
```

## Embeddable breeding widget

```text
https://kafka2306.github.io/pal-atlas/embed/breed/
```

`parentA` / `parentB` / `target` / `lang=ja|en` 等をURL parameterで指定できます。widgetは公開`api/pals.json`と`api/breeding.json`だけを読みます。

未解決special recipeやconflictを確定結果へfallbackしません。

詳細: [docs/embed.md](docs/embed.md)

## Canonical flow

取得・provenance・validation・publishの責務は [Canonical flow](docs/architecture/canonical-flow.md) を正本とします。

```text
source data
  → normalize
  → canonical pal / breeding model
  → validate
  → static API
  → website / widget / Neo4j / MCP
```

Neo4jやwidgetを第二の正本にはしません。

## Quick start

Node.js 22 / Python 3.12 / uv:

```bash
npm run setup
npm run data
npm run dev
```

提出前の正準check:

```bash
npm run check
```

Neo4j API:

```bash
npm run api
```

MCP:

```bash
uv sync --locked
npm run data
npm run static-api
uv run python scripts/pal_mcp_server.py
```

## Quality gate

- JavaScript: `package-lock.json` + Biome + Oxlint
- Python: `uv.lock` + Ruff + Pyrefly strict
- `prek`: network-heavy generation/E2Eを避け、同じ高速静的gateを再利用
- Nx/Turborepo: genuine multi-project workspaceではないため不採用
- TypeScript/tsc/Zod: maintained app codeがJavaScriptのため不採用
- generated data / static API / MCP contractを同じcanonical datasetで検証

## Repository map

```text
src/                  collection / normalization / breeding logic
public/embed/breed/   external breeding widget
neo4j/                graph projection
ontology/project.yaml evidence / provenance model
dist/                 Pages artifact
.github/workflows/    quality / Pages automation
```

## Source boundary

Palworld.gg、Palworld Wiki、Game8、Paldeck、Pocketpair公式サイト・公式ニュース・公式docs等を照合します。最新ゲーム仕様は公式情報を優先してください。

本projectはPocketpairとは無関係の非公式fan projectです。名称・画像等の権利は各権利者に帰属します。

## Done

成功指標は図鑑件数やAPI数ではありません。

**利用者が「この親から何が生まれる」「このパルを作るには誰を親にする」を同じデータから往復でき、conflictや特殊配合を誤って確定結果として見せないこと**をDoneとします。
