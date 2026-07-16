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
    lead: 'パルを選ぶと、実際の親ペアと配合値を表示します。親をクリックして配合をたどれます。',
    catalog: '図鑑', graph: '配合グラフ', atlasLink: '図鑑へ', graphLink: '配合グラフへ', search: 'パルを検索', all: 'すべて', parents: '親候補', children: '関連パル', special: '特殊配合', normal: '通常配合', rank: '配合値', sources: '出典', insight: '見えてくる知見',
    choose: 'パルを選ぶ', formula: '通常配合のルール', formulaText: '親2体の配合値から中間値を出し、最も近い配合値のパルへ着地します。特殊配合はこのルールを上書きします。',
    direct: '固有レシピ', nearby: '値が近い親', unresolved: '未解決の出典行',
    cards: 'パル', noResult: '該当するパルがありません。',
  },
  en: {
    eyebrow: 'PAL ATLAS / BREEDING GRAPH',
    title: 'Trace the parents. Read the map.',
    lead: 'Choose a Pal to see its actual parent pairs and breeding rank. Click a parent to follow the graph.',
    catalog: 'Atlas', graph: 'Breeding graph', atlasLink: 'Atlas', graphLink: 'Breeding graph', search: 'Search Pals', all: 'All', parents: 'Parent signals', children: 'Related Pals', special: 'Special', normal: 'Normal', rank: 'Breeding Rank', sources: 'Sources', insight: 'What this reveals',
    choose: 'Choose a Pal', formula: 'Normal breeding rule', formulaText: 'The two parent ranks become an intermediate value, then resolve to the closest eligible Pal rank. Special combinations override this rule.',
    direct: 'Exact recipe', nearby: 'Rank-near parent', unresolved: 'Unresolved source row',
    cards: 'Pals', noResult: 'No Pals match this filter.',
  },
};

function readPreference(key, fallback, allowed) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private storage can be unavailable */ }
}

const state = {
  lang: readPreference('pal-atlas-lang', 'ja', ['ja', 'en']),
  theme: readPreference('pal-atlas-theme', 'dark', ['dark', 'light']),
  selectedId: byId.has('anubis') ? 'anubis' : pals[0].id,
  stack: [byId.has('anubis') ? 'anubis' : pals[0].id],
  search: '',
  element: 'all',
};

const elementLabels = { neutral: ['無', 'Neutral'], fire: ['火', 'Fire'], water: ['水', 'Water'], grass: ['草', 'Grass'], electric: ['雷', 'Electric'], ground: ['地', 'Ground'], ice: ['氷', 'Ice'], dark: ['闇', 'Dark'], dragon: ['竜', 'Dragon'] };
const elText = (element) => elementLabels[element]?.[state.lang === 'ja' ? 0 : 1] ?? element;
const t = (key) => copy[state.lang][key] ?? key;
const selected = () => byId.get(state.stack.at(-1) ?? state.selectedId) ?? pals[0];
let appBound = false;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function palName(pal) {
  return state.lang === 'ja' ? pal.nameJa : pal.nameEn;
}

function imageUrl(pal) {
  return pal.imageUrl;
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

function filteredPals() {
  const query = state.search.trim().toLowerCase();
  return pals.filter((item) => `${item.nameEn} ${item.nameJa}`.toLowerCase().includes(query) && (state.element === 'all' || item.elements.includes(state.element)))
    .sort((a, b) => a.breedingRank - b.breedingRank || a.order - b.order);
}

function catalogMarkup(items) {
  return items.length ? items.map((item) => card(item)).join('') : `<div class="empty">${t('noResult')}</div>`;
}

function updateCatalog() {
  const items = filteredPals();
  const grid = document.querySelector('.atlas-grid');
  if (grid) grid.innerHTML = catalogMarkup(items);
  const resultCount = document.querySelector('.result-count');
  if (resultCount) resultCount.textContent = `${items.length} / ${pals.length}`;
}

function applyTheme() {
  document.documentElement.dataset.colorTheme = state.theme;
}

function card(pal, compact = false) {
  return `<button class="pal-card ${compact ? 'compact' : ''} ${pal.id === selected().id ? 'is-selected' : ''}" data-select="${pal.id}" ${compact ? 'data-drill="true"' : ''} aria-label="${esc(palName(pal))}">
    <img src="${imageUrl(pal)}" alt="${esc(palName(pal))}" loading="lazy" />
    <span class="card-copy"><strong>${esc(palName(pal))}</strong><small>${esc(pal.nameEn === pal.nameJa ? pal.nameEn : state.lang === 'ja' ? pal.nameEn : pal.nameJa)}</small></span>
    <span class="card-rank">${pal.breedingRank}</span>
  </button>`;
}

function recipePal(pal, role) {
  if (!pal) return `<span class="recipe-pal missing">—</span>`;
  const tag = role === 'target' ? 'span' : 'button';
  const action = role === 'target' ? '' : ` data-select="${pal.id}" data-drill="true" aria-label="${esc(palName(pal))}"`;
  return `<${tag} class="recipe-pal ${role}"${action}><img src="${imageUrl(pal)}" alt="" loading="lazy" /><span><b>${esc(palName(pal))}</b><small>${t('rank')} ${pal.breedingRank}</small></span></${tag}>`;
}

function graphView(pal) {
  const rows = parentRows(pal).slice(0, 4);
  return `<div class="graph-panel"><div class="graph-head"><div><span class="micro-label">${t('graph')}</span><h3>${esc(palName(pal))} <span>/ ${pal.breedingRank}</span></h3></div></div>
    <div class="recipe-list breeding-graph" aria-label="${esc(palName(pal))} breeding recipes">${rows.length ? rows.map((row) => `<div class="recipe-row ${row.kind}">
      ${recipePal(row.parentA, 'parent-a')}<span class="recipe-plus">＋</span>${recipePal(row.parentB, 'parent-b')}
      <div class="recipe-rule"><b>${row.kind === 'special' ? t('direct') : t('normal')}</b><small>${row.kind === 'special' ? esc(row.label) : `${t('nearby')} / ${row.intermediatePower}`}</small></div>
      <span class="recipe-arrow" aria-hidden="true">→</span>${recipePal(pal, 'target')}
    </div>`).join('') : `<p class="muted">${t('unresolved')}</p>`}</div></div>`;
}

function insight(pal) {
  const direct = directParentRows(pal);
  const rows = normalParentRows(pal);
  if (direct.length) return `<div class="insight"><span class="signal-mark">✦</span><div><b>${t('direct')}</b><p>${state.lang === 'ja' ? 'この親の組み合わせは配合値の近さではなく、固有レシピが結果を決めます。' : 'This parent pair is an exact recipe; it wins over rank-nearest calculation.'}</p></div></div>`;
  const delta = rows[0] ? Math.abs(rows[0].intermediatePower - pal.breedingRank) : 0;
  return `<div class="insight"><span class="signal-mark">↗</span><div><b>${t('nearby')} <em>Δ ${delta}</em></b><p>${state.lang === 'ja' ? `表示中の親候補は、子の配合値 ${pal.breedingRank} に近い中間値を作る組み合わせです。` : `The shown parents land close to the child rank ${pal.breedingRank}; the delta is a practical first signal.`}</p></div></div>`;
}

function render() {
  applyTheme();
  const pal = selected();
  const filtered = filteredPals();
  const allElements = [...new Set(pals.flatMap((item) => item.elements))].sort();
  const uniqueSpecial = special.length;
  document.querySelector('#app').innerHTML = `<main class="shell">
    <header class="topbar"><a class="brand" href="#top"><span class="brand-glyph">✳</span><span>PAL ATLAS</span><small>BREEDING GRAPH</small></a><nav><a class="text-button" href="#atlas-view">${t('atlasLink')}</a><a class="text-button" href="#graph-view">${t('graphLink')}</a><button class="icon-button" data-lang-toggle="true">${state.lang === 'ja' ? 'EN' : '日'}</button><button class="icon-button" data-theme-toggle="true">${state.theme === 'dark' ? '☼' : '☾'}</button></nav></header>
    <section class="hero" id="top"><div class="hero-copy"><span class="eyebrow">${t('eyebrow')}</span><h1>${t('title')}</h1><p>${t('lead')}</p></div></section>
    <section class="metric-row"><div><b>${palData.meta.catalogCount}</b><span>${t('catalog')}</span></div><div><b>${palData.meta.normalPairCount.toLocaleString()}</b><span>${t('normal')} edges</span></div><div><b>${uniqueSpecial}</b><span>${t('special')} edges</span></div></section>
    <section class="workspace" id="atlas-view">
      <div class="main-column"><div class="section-head"><div><span class="micro-label">01 / ${t('choose')}</span><h2>${t('cards')}</h2></div><span class="result-count">${filtered.length} / ${pals.length}</span></div>
        <div class="controls"><label class="search-box"><span>⌕</span><input data-search type="search" value="${esc(state.search)}" placeholder="${t('search')}" /></label><select data-element aria-label="${t('all')}"><option value="all">${t('all')} elements</option>${allElements.map((element) => `<option value="${element}" ${state.element === element ? 'selected' : ''}>${elText(element)}</option>`).join('')}</select></div>
        <div class="atlas-grid">${catalogMarkup(filtered)}</div>
      </div>
      <aside class="detail-column"><div class="detail-card"><div class="trail"><button data-back ${state.stack.length > 1 ? '' : 'disabled'}>←</button><span>${state.stack.map((id) => esc(palName(byId.get(id)))).join(' <i>→</i> ')}</span></div><div class="selected-portrait"><img src="${imageUrl(pal)}" alt="${esc(palName(pal))}" /></div><div class="selected-title"><span class="micro-label">#${String(pal.order).padStart(3, '0')} / ${pal.rarityTier}</span><h2>${esc(palName(pal))}</h2><p>${pal.nameEn === pal.nameJa ? '' : esc(state.lang === 'ja' ? pal.nameEn : pal.nameJa)}</p></div><div class="tag-row">${pal.elements.map((element) => `<span class="tag element-${element}">${elText(element)}</span>`).join('')}<span class="tag rank-tag">${t('rank')} ${pal.breedingRank}</span></div>
        <div class="divider"></div><div class="detail-label">${t('insight')}</div>${insight(pal)}<div class="detail-label">${t('parents')}</div><div class="parent-list">${parentRows(pal).slice(0, 4).map((row) => `<div class="parent-row ${row.kind}"><span class="pair-images">${row.parentA ? `<button data-select="${row.parentA.id}" data-drill="true" aria-label="${esc(palName(row.parentA))}"><img src="${imageUrl(row.parentA)}" alt="" /></button>` : ''}${row.parentB ? `<button data-select="${row.parentB.id}" data-drill="true" aria-label="${esc(palName(row.parentB))}"><img src="${imageUrl(row.parentB)}" alt="" /></button>` : ''}</span><span><b>${row.parentA ? esc(palName(row.parentA)) : '—'} + ${row.parentB ? esc(palName(row.parentB)) : '—'}</b><small>${row.kind === 'special' ? t('direct') : `${t('nearby')} / ${row.intermediatePower}`}</small></span><span class="arrow">→</span></div>`).join('') || `<p class="muted">${t('unresolved')}</p>`}</div></div>
        <div class="formula-card"><span class="micro-label">03 / ${t('formula')}</span><p>${t('formulaText')}</p><code>⌊ (A + B + 1) / 2 ⌋ → nearest</code></div>
      </aside>
    </section>
    <section class="graph-section" id="graph-view">${graphView(pal)}<div class="candidate-panel"><div class="section-head"><div><span class="micro-label">04 / ${t('children')}</span><h2>${state.lang === 'ja' ? '関連パル' : 'Related Pals'}</h2></div></div><div class="candidate-grid">${candidateRows(pal).map((item) => card(item, true)).join('')}</div></div></section>
    <section class="source-section"><div><span class="micro-label">05 / ${t('sources')}</span><h2>${state.lang === 'ja' ? '出典を分けて保持する' : 'Keep provenance visible'}</h2></div><div class="source-list">${sourceData.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer"><span>${esc(source.title)}</span><small>${esc(source.role)}</small><b>↗</b></a>`).join('')}</div></section>
    <footer><span>PAL ATLAS / independent fan project</span></footer>
  </main>`;
  bind();
}

function bind() {
  const app = document.querySelector('#app');
  if (!app || appBound) return;
  appBound = true;
  app.addEventListener('click', (event) => {
    const target = event.target.closest('[data-select], [data-back], [data-lang-toggle], [data-theme-toggle]');
    if (!target || !app.contains(target)) return;
    if (target.dataset.select) {
      const id = target.dataset.select;
      if (!byId.has(id)) return;
      state.selectedId = id;
      state.stack = target.dataset.drill === 'true' ? [...state.stack, id] : [id];
      render();
      requestAnimationFrame(() => document.querySelector('#graph-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    if (target.dataset.back !== undefined) {
      if (state.stack.length > 1) {
        state.stack = state.stack.slice(0, -1);
        state.selectedId = state.stack.at(-1);
        render();
      }
      return;
    }
    if (target.dataset.langToggle !== undefined) {
      state.lang = state.lang === 'ja' ? 'en' : 'ja';
      writePreference('pal-atlas-lang', state.lang);
      render();
      return;
    }
    if (target.dataset.themeToggle !== undefined) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      writePreference('pal-atlas-theme', state.theme);
      applyTheme();
      target.textContent = state.theme === 'dark' ? '☼' : '☾';
    }
  });
  app.addEventListener('input', (event) => {
    if (event.target.matches('[data-search]')) {
      state.search = event.target.value;
      updateCatalog();
    }
  });
  app.addEventListener('change', (event) => {
    if (event.target.matches('[data-element]')) {
      state.element = event.target.value;
      updateCatalog();
    }
  });
  app.addEventListener('keydown', (event) => {
    const target = event.target.closest('.graph-node');
    if (target && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      target.click();
    }
  });
}

render();
