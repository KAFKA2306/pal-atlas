# 配合検索ウィジェット

PAL ATLAS の公開 `api/pals.json` と `api/breeding.json` だけを読む静的 iframe です。別の配合表は持ちません。

```html
<iframe
  src="https://kafka2306.github.io/pal-atlas/embed/breed/?lang=ja&partner=example-site&campaign=breeding-guide"
  title="PAL ATLAS 配合検索"
  width="100%"
  height="560"
  loading="lazy"
></iframe>
```

`parentA`, `parentB`, `target` には PAL ATLAS の Pal ID を指定できます。`partner` と `campaign` は英数字、`.`、`_`、`-` のみ、64文字以下です。不正な値は attribution に採用しません。

親2体検索では resolved な特殊配合を通常配合より優先します。同じ親ペアに未解決の特殊配合が存在する場合は通常配合へフォールバックせず、確定結果を表示しません。目的パル検索でも未解決の特殊配合は候補へ含めません。

## 計測契約

ウィジェット自身は cookie、localStorage、個人識別子、外部analytics endpointを使いません。親ページへ `postMessage` で次だけを送ります。

- `embed_loaded`
- `breed_searched`
- `pal_atlas_opened`
- 検証済み `partner` / `campaign`
- 検索mode、判定status、PAL ATLASを開いた場合のPal ID

親ページ側で計測する場合も個人識別情報と結合しないでください。公開実績は実際に観測したイベントだけを `metrics/embed-kpi.json` へ追記します。

## 非保証

PAL ATLAS は非公式ファンプロジェクトです。未解決・競合状態を確定配合として表示しません。公式情報・出典状態はPAL ATLAS本体と公開APIを確認してください。
