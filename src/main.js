import palData from '../data/pals.json';
import breedingData from '../data/breeding.json';
import sourceData from '../data/sources.json';
import './styles.css';

const pals = palData.pals;
const byId = new Map(pals.map((pal) => [pal.id, pal]));
const byName = new Map(pals.map((pal) => [pal.nameEn, pal]));
const featuredNormal = breedingData.featuredNormal;
const special = breedingData.special.filter((row) => row.status === 'resolved');

const copy = {
  ja: {
    eyebrow: 'PAL ATLAS / BREEDING GRAPH',
    title: '親をたどると、配合の地図になる。',
    lead: 'パルを一体選ぶだけで、まず見るべき親候補と、その理由が静かに現れる。クリックを重ねるほど、配合値の距離と特殊配合の例外が読めるようになる。',
    catalog: '図鑑', graph: 'グラフ', search: 'パルを検索', all: 'すべて', parents: '親候補', children: '子候補', special: '特殊配合', normal: '通常配合', select: '選択中', rank: '配合値', source: '出典', sources: 'データ出典', insight: '見えてくる知見',
    choose: '図鑑から選ぶ', formula: '通常配合のルール', formulaText: '親2体の配合値から中間値を出し、最も近い配合値のパルへ着地します。特殊配合はこのルールを上書きします。',
    clickHint: '親候補をクリックして、次の知見へ', direct: '固有レシピ', nearby: '値が近い親', unresolved: '未解決の出典行',
    cards: 'パル標本', noResult: '該当するパルがありません。', viewNote: 'カードを押すとグラフの中心が移動します。',
  },
  en: {
    eyebrow: 'PAL ATLAS / BREEDING GRAPH',
    title: 'Trace the parents. Read the map.',
    lead: 'Choose one Pal and the useful parent signals surface first. Keep clicking: the rank distance, special overrides, and breeding logic become easier to see as a chain.',
    catalog: 'Atlas', graph: 'Graph', search: 'Search Pals', all: 'All', parents: 'Parent signals', children: 'Child signals', special: 'Special', normal: 'Normal', select: 'Selected', rank: 'Breeding Rank', source: 'Source', sources: 'Sources', insight: 'What this reveals',
    choose: 'Choose from atlas', formula: 'Normal breeding rule', formulaText: 'The two parent ranks become an intermediate value, then resolve to the closest Pal rank. Special combinations override this rule.',
    clickHint: 'Click a parent to keep learning', direct: 'Exact recipe', nearby: 'Rank-near parent', unresolved: 'Unresolved source row',
    cards: 'Pal specimens', noResult: 'No Pals match this filter.', viewNote: 'Click a card to move the graph center.',
  },
};

const state = {
  lang: localStorage.getItem('pal-atlas-lang') || 'ja',
  theme: localStorage.getItem('pal-atlas-theme') || 'dark',
  selectedId: byId.has('anubis') ? 'anubis' : pals[0].id,
  stack: [byId.has('anubis') ? 'anubis' : pals[0].id],
  search: '',
  element: 'all',
  view: 'atlas',
};

const elementLabels = { neutral: ['無', 'Neutral'], fire: ['火', 'Fire'], water: ['水', 'Water'], grass: ['草', 'Grass'], electric: ['雷', 'Electric'], ground: ['地', 'Ground'], ice: ['氷', 'Ice'], dark: ['闇', 'Dark'], dragon: ['竜', 'Dragon'] };
const elText = (element) => elementLabels[element]?.[state.lang === 'ja' ? 0 : 1] ?? element;
const t = (key) => copy[state.lang][key] ?? key;
const selected = () => byId.get(state.stack.at(-1) ?? state.selectedId) ?? pals[0];

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function palName(pal) {
  return state.lang === 'ja' ? pal.nameJa : pal.nameEn;
}

function directParentRows(pal) {
  return special.filter((row) => row.child === pal.id).map((row) => ({
    kind: 'special', parentA: byId.get(row.parentA), parentB: byId.get(row.parentB), label: row.kind,
  }));
}

function normalParentRows(pal) {
  return (featuredNormal[pal.id] ?? []).map((row) => ({
    kind: 'normal', parentA: byId.get(row.parentA), parentB: byId.get(row.parentB), intermediatePower: row.intermediatePower, label: t('nearby'),
  }));
}

function parentRows(pal) {
  const direct = directParentRows(pal);
  const normal = normalParentRows(pal).filter((row) => !direct.some((item) => item.parentA?.id === row.parentA?.id && item.parentB?.id === row.parentB?.id));
  return [...direct, ...normal].slice(0, 6);
}

function candidateRows(pal) {
  const direct = directParentRows(pal).flatMap((row) => [row.parentA, row.parentB]).filter(Boolean);
  const rankNear = [...pals].sort((a, b) => Math.abs(a.breedingRank - pal.breedingRank) - Math.abs(b.breedingRank - pal.breedingRank)).filter((item) => item.id !== pal.id);
  return [...new Map([...direct, ...rankNear].map((item) => [item.id, item])).values()].slice(0, 5);
}

function card(pal, compact = false) {
  return `<button class="pal-card ${compact ? 'compact' : ''} ${pal.id === state.selectedId ? 'is-selected' : ''}" data-select="${pal.id}" ${compact ? 'data-drill="true"' : ''} aria-label="${esc(palName(pal))}">
    <span class="card-orbit"></span><img src="${pal.imageUrl}" alt="${esc(palName(pal))}" loading="lazy" />
    <span class="card-copy"><strong>${esc(palName(pal))}</strong><small>${esc(pal.nameEn === pal.nameJa ? pal.nameEn : state.lang === 'ja' ? pal.nameEn : pal.nameJa)}</small></span>
    <span class="card-rank">${pal.breedingRank}</span>
  </button>`;
}

function graphNode(pal, x, y, role) {
  if (!pal) return '';
  return `<g class="graph-node ${role}" data-select="${pal.id}" ${role === 'parent' ? 'data-drill="true"' : ''} tabindex="0" role="button" aria-label="${esc(palName(pal))}">
    <circle cx="${x}" cy="${y}" r="40" class="node-halo"></circle><image href="${pal.imageUrl}" x="${x - 27}" y="${y - 27}" width="54" height="54" preserveAspectRatio="xMidYMid meet"></image>
    <text x="${x}" y="${y + 61}" text-anchor="middle">${esc(palName(pal))}</text><text x="${x}" y="${y + 78}" text-anchor="middle" class="node-rank">${pal.breedingRank}</text>
  </g>`;
}

function graphView(pal) {
  const rows = parentRows(pal).slice(0, 4);
  const first = rows[0] ?? {};
  const second = rows[1] ?? {};
  const parents = [first.parentA, first.parentB, second.parentA, second.parentB].filter(Boolean).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 4);
  const points = [[130, 95], [130, 255], [350, 70], [350, 280]];
  const lines = parents.map((parent, index) => `<line x1="${points[index][0]}" y1="${points[index][1]}" x2="600" y2="175" class="graph-line ${rows[index < 2 ? 0 : 1]?.kind === 'special' ? 'special-line' : ''}"></line>`).join('');
  return `<div class="graph-panel"><div class="graph-head"><div><span class="micro-label">${t('graph')}</span><h3>${esc(palName(pal))} <span>/ ${pal.breedingRank}</span></h3></div><span class="graph-hint">${t('clickHint')}</span></div>
    <svg class="breeding-graph" viewBox="0 0 760 350" aria-label="${esc(palName(pal))} breeding graph"><defs><filter id="glow"><feGaussianBlur stdDeviation="5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${lines}${parents.map((parent, index) => graphNode(parent, points[index][0], points[index][1], 'parent')).join('')}${graphNode(pal, 600, 175, 'target')}<text x="130" y="28" class="lane-label">${t('parents')}</text><text x="600" y="285" class="lane-label" text-anchor="middle">${t('select')}</text></svg></div>`;
}

function insight(pal) {
  const direct = directParentRows(pal);
  const rows = normalParentRows(pal);
  if (direct.length) return `<div class="insight"><span class="signal-mark">✦</span><div><b>${t('direct')}</b><p>${state.lang === 'ja' ? 'この親の組み合わせは配合値の近さではなく、固有レシピが結果を決めます。' : 'This parent pair is an exact recipe; it wins over rank-nearest calculation.'}</p></div></div>`;
  const delta = rows[0] ? Math.abs(rows[0].intermediatePower - pal.breedingRank) : 0;
  return `<div class="insight"><span class="signal-mark">↗</span><div><b>${t('nearby')} <em>Δ ${delta}</em></b><p>${state.lang === 'ja' ? `表示中の親候補は、子の配合値 ${pal.breedingRank} に近い中間値を作る組み合わせです。` : `The shown parents land close to the child rank ${pal.breedingRank}; the delta is a practical first signal.`}</p></div></div>`;
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  const pal = selected();
  const filtered = pals.filter((item) => `${item.nameEn} ${item.nameJa}`.toLowerCase().includes(state.search.toLowerCase()) && (state.element === 'all' || item.elements.includes(state.element)));
  const allElements = [...new Set(pals.flatMap((item) => item.elements))].sort();
  const uniqueSpecial = special.length;
  document.querySelector('#app').innerHTML = `<main class="shell">
    <header class="topbar"><a class="brand" href="#top"><span class="brand-glyph">✳</span><span>PAL ATLAS</span><small>v1.0 / GRAPH VIEW</small></a><nav><button class="text-button ${state.view === 'atlas' ? 'active' : ''}" data-view="atlas">${t('catalog')}</button><button class="text-button ${state.view === 'graph' ? 'active' : ''}" data-view="graph">${t('graph')}</button><button class="icon-button" data-lang="${state.lang === 'ja' ? 'en' : 'ja'}">${state.lang === 'ja' ? 'EN' : '日'}</button><button class="icon-button" data-theme="toggle">${state.theme === 'dark' ? '☼' : '☾'}</button></nav></header>
    <section class="hero" id="top"><div class="hero-copy"><span class="eyebrow">${t('eyebrow')}</span><h1>${t('title')}</h1><p>${t('lead')}</p></div><div class="hero-stamp"><span>CATALOG</span><strong>${String(palData.meta.catalogCount).padStart(3, '0')}</strong><small>${state.lang === 'ja' ? 'パル indexed' : 'Pals indexed'}</small></div></section>
    <section class="metric-row"><div><b>${palData.meta.catalogCount}</b><span>${t('catalog')}</span></div><div><b>${palData.meta.normalPairCount.toLocaleString()}</b><span>${t('normal')} edges</span></div><div><b>${uniqueSpecial}</b><span>${t('special')} edges</span></div></section>
    <section class="workspace ${state.view === 'graph' ? 'graph-only' : ''}">
      <div class="main-column"><div class="section-head"><div><span class="micro-label">01 / ${t('choose')}</span><h2>${t('cards')}</h2></div><span class="result-count">${filtered.length} / ${pals.length}</span></div>
        <div class="controls"><label class="search-box"><span>⌕</span><input data-search type="search" value="${esc(state.search)}" placeholder="${t('search')}" /></label><select data-element aria-label="${t('all')}"><option value="all">${t('all')} elements</option>${allElements.map((element) => `<option value="${element}" ${state.element === element ? 'selected' : ''}>${elText(element)}</option>`).join('')}</select><span class="control-note">${t('viewNote')}</span></div>
        <div class="atlas-grid">${filtered.length ? filtered.map((item) => card(item)).join('') : `<div class="empty">${t('noResult')}</div>`}</div>
      </div>
      <aside class="detail-column"><div class="detail-card"><div class="detail-kicker"><span>02 / ${t('select')}</span><span class="status-dot"></span></div><div class="trail"><button data-back ${state.stack.length > 1 ? '' : 'disabled'}>←</button><span>${state.stack.map((id) => esc(palName(byId.get(id)))).join(' <i>→</i> ')}</span></div><div class="selected-portrait"><div class="portrait-ring"></div><img src="${pal.imageUrl}" alt="${esc(palName(pal))}" /></div><div class="selected-title"><span class="micro-label">#${String(pal.order).padStart(3, '0')} / ${pal.rarityTier}</span><h2>${esc(palName(pal))}</h2><p>${pal.nameEn === pal.nameJa ? '' : esc(state.lang === 'ja' ? pal.nameEn : pal.nameJa)}</p></div><div class="tag-row">${pal.elements.map((element) => `<span class="tag element-${element}">${elText(element)}</span>`).join('')}<span class="tag rank-tag">${t('rank')} ${pal.breedingRank}</span></div>
        <div class="divider"></div><div class="detail-label">${t('insight')}</div>${insight(pal)}<div class="detail-label">${t('parents')}</div><div class="parent-list">${parentRows(pal).slice(0, 4).map((row) => `<button class="parent-row" data-select="${row.parentA?.id}" data-drill="true" ${row.kind === 'special' ? 'data-special="true"' : ''}><span class="pair-images">${row.parentA ? `<img src="${row.parentA.imageUrl}" alt="" />` : ''}${row.parentB ? `<img src="${row.parentB.imageUrl}" alt="" />` : ''}</span><span><b>${row.parentA ? esc(palName(row.parentA)) : '—'} + ${row.parentB ? esc(palName(row.parentB)) : '—'}</b><small>${row.kind === 'special' ? t('direct') : `${t('nearby')} / ${row.intermediatePower}`}</small></span><span class="arrow">→</span></button>`).join('') || `<p class="muted">${t('unresolved')}</p>`}</div></div>
        <div class="formula-card"><span class="micro-label">03 / ${t('formula')}</span><p>${t('formulaText')}</p><code>⌊ (A + B + 1) / 2 ⌋ → nearest</code></div>
      </aside>
    </section>
    <section class="graph-section">${graphView(pal)}<div class="candidate-panel"><div class="section-head"><div><span class="micro-label">04 / ${t('children')}</span><h2>${state.lang === 'ja' ? '次に見る候補' : 'Keep exploring'}</h2></div></div><p class="candidate-lead">${state.lang === 'ja' ? '選択中の値に近いパルをクリックすると、別の親候補の見え方に切り替わります。' : 'Click a nearby Pal to change the center and reveal a new parent signal.'}</p><div class="candidate-grid">${candidateRows(pal).map((item) => card(item, true)).join('')}</div></div></section>
    <section class="source-section"><div><span class="micro-label">05 / ${t('sources')}</span><h2>${state.lang === 'ja' ? '出典を分けて保持する' : 'Keep provenance visible'}</h2></div><div class="source-list">${sourceData.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer"><span>${esc(source.title)}</span><small>${esc(source.role)}</small><b>↗</b></a>`).join('')}</div></section>
    <footer><span>PAL ATLAS / independent fan project</span><span>${state.lang === 'ja' ? 'データは生成時点の出典ハッシュを保持' : 'Generated data keeps a source hash'}</span></footer>
  </main>`;
  bind();
}

function bind() {
  document.querySelectorAll('[data-select]').forEach((element) => element.addEventListener('click', () => { const id = element.dataset.select; state.selectedId = id; state.stack = element.dataset.drill === 'true' ? [...state.stack, id] : [id]; state.view = 'graph'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  document.querySelector('[data-back]')?.addEventListener('click', () => { if (state.stack.length > 1) { state.stack = state.stack.slice(0, -1); state.selectedId = state.stack.at(-1); render(); } });
  document.querySelectorAll('[data-view]').forEach((element) => element.addEventListener('click', () => { state.view = element.dataset.view; render(); }));
  document.querySelector('[data-lang]')?.addEventListener('click', () => { state.lang = state.lang === 'ja' ? 'en' : 'ja'; localStorage.setItem('pal-atlas-lang', state.lang); render(); });
  document.querySelector('[data-theme]')?.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('pal-atlas-theme', state.theme); render(); });
  document.querySelector('[data-search]')?.addEventListener('input', (event) => { state.search = event.target.value; render(); requestAnimationFrame(() => { const input = document.querySelector('[data-search]'); input?.focus(); input?.setSelectionRange(state.search.length, state.search.length); }); });
  document.querySelector('[data-element]')?.addEventListener('change', (event) => { state.element = event.target.value; render(); });
}

render();
