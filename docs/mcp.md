# MCP / provenance contract

PAL ATLASのMCPは、既存の生成済みPal catalog / breeding / reverse indexをread-onlyで公開します。EDINET DBは使用しません。

## MCP version

新規serverはMCP Python SDK v2を使います。MCP 2026-07-28を実装するstable lineを前提とし、旧revision専用の独自handshake/session実装は追加しません。

```bash
npm ci
npm run data
python -m pip install -r requirements-mcp.txt
python scripts/pal_mcp_server.py
```

serverは `127.0.0.1:8013` のStreamable HTTPです。

## Tools

- `search_pals`
- `get_pal`
- `breed`
- `get_recipes`
- `get_outputs`
- `get_sources`
- `get_conflicts`
- `get_data_health`
- `get_methodology`

## Domain parity

MCPは配合式を再計算しません。

`npm run data` が既存の取得・配合ロジックで生成した次のartifactを読むだけです。

- `data/pals.json`
- `data/breeding.json`
- `data/children.json`
- `data/sources.json`
- `data/conflicts.json`

通常配合は `breeding.json:normal` のdeterministic resultを `result_kind=normal_formula` として返します。特殊配合は `breeding.json:special` を `result_kind=special_source` として返します。両者を同じ種類の事実として扱いません。

## Source tiers

`build-provenance.mjs` がrepository-owned policyとしてsource type/tierをmaterializeします。

- Tier 1: Pocketpair publisher/developer first-party source
- Tier 2: structured independent dataset / community reference used as a primary machine-readable source
- Tier 3: cross-check or delivery utility

このtierは各外部サイトが自称する格付けではなく、PAL ATLAS側の採用・優先順位を機械可読にしたものです。Tier 3がTier 1/2をsilent overwriteするルールはありません。

## Conflict policy

現在の取得pipelineは登録済みcross-check sourceをすべてfield-level claimとしてmachine ingestしていません。この状態で「競合なし」と断定するのは誤りなので、`data/conflicts.json` は次を明示します。

- `evaluationStatus=partial`
- `nullReason=registered_cross_check_sources_are_not_all_machine_ingested_as_field_level_claims`

つまり `conflicts=[]` でも「全sourceが一致した」という意味にはしません。identity解決不能のspecial rowが発生した場合はunresolved conflictとして保持します。

## Provenance

Pal / breeding resultは該当範囲で次を返します。

- canonical ID
- data/generated timestamp
- source type / tier / URL / observed timestamp
- source hash
- source hash scope
- generated record SHA-256
- derivation method
- conflict status
- freshness seconds
- null reason

既存 `meta.sourceHash` はPalworld.gg EN/JA HTML page hashであり、breeding rank/special combinationを供給するsource module全体のhashではありません。そのためMCPはhash scopeを明示し、完全なsource-payload hashが未materializeであることを `null_reason` に残します。

## Static API

`public/api/sources.json` と `public/api/conflicts.json` も同じ生成artifactからbuildします。Pages live auditは両endpointが実際に配信されることまで確認します。

## CI

既存Pages buildの中で、実データ取得後に以下を同一runで検証します。

1. source tier/typeとconflict fail-close state
2. 通常配合formula replay
3. special identity/reference integrity
4. static API build
5. MCP `list_tools()` discovery
6. Pal static/MCP parity
7. normal/special breed parity
8. reverse index parity
9. source/conflict static/MCP parity
10. ontology SHA-256とEDINETDB boundary
