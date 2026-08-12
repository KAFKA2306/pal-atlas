# PAL ATLAS canonical flow

PAL ATLASの正準経路は次の1本です。

```text
external sources
  -> scripts/fetch-palworld-data.mjs
  -> normalized data + provenance
  -> scripts/verify-data.mjs
  -> scripts/build-static-api.mjs
  -> Vite build
  -> GitHub Pages UI / static JSON API / embed widget
```

## Source of truth

- 取得・正規化: `scripts/fetch-palworld-data.mjs`
- provenance: `scripts/build-provenance.mjs` と `ontology/project.yaml`
- 整合性検証: `scripts/verify-data.mjs`
- 公開JSON生成: `scripts/build-static-api.mjs`
- user entrypoint: `index.html` -> Vite application
- external distribution surface: `public/embed/breed/`
- production workflow: `.github/workflows/deploy-pages.yml`

Neo4jは探索用projectionであり、公開JSON/APIとは別の正準データ源にしません。外部配合widgetも独自の配合表を持たず、公開JSONを読みます。

## Repository KPIs

主要KPIは次の3つに限定します。

1. **検証済みデータ率** — 公開対象のうちschema・provenance検証を通過した割合。
2. **データ鮮度** — 正準取得から公開成果物までの更新時刻。
3. **主要検索成功率** — パル検索・親2体からの配合・目的パルへの配合候補という主要利用経路が正常に完了する割合。

repo数、workflow数、生成ファイル数は主要KPIにしません。

## Non-goals

- 同一データを別schema・別importerで並行管理しない。
- repository researchや一般的なUI研究をproduction pipelineへ混ぜない。
- Neo4j、static API、embed widgetのために独立した手入力データを増やさない。
- source conflictや未知値をsilent dropまたは推測値で埋めない。

## CI invariant

`npm run verify:ratchet` はこの正準経路の入口・検証・公開surfaceが存在すること、不要なweekly research workflowが再追加されていないことを検査します。
