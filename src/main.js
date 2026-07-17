import palData from '../data/pals.json';
import breedingData from '../data/breeding.json';
import childrenUiData from '../data/children-ui.json';
import sourceData from '../data/sources.json';
import './styles.css';

const pals = palData.pals;
const byId = new Map(pals.map((pal) => [pal.id, pal]));
const featuredNormal = breedingData.featuredNormal;
const special = breedingData.special.filter((row) => row.status === 'resolved');
const outputs = childrenUiData.outputs;

const copy = {
  ja: {
    routes: '配合ルート', saved: '保存', search: 'パル名を検索', all: 'すべて', parents: '作り方', children: 'このパルから作る', outputs: '配合先', more: 'すべて表示', special: '特殊配合', normal: '通常配合', rank: '配合値', sources: '出典', insight: '見えてくる知見', save: '配合を保存', savedState: '保存済み', savedRecipes: '保存した配合',
    choose: 'パル一覧', formula: '配合ルール', formulaText: '親2体の配合値から中間値を出し、最も近い配合値のパルへ着地します。特殊配合はこのルールを上書きします。',
    direct: '固有レシピ', nearby: '値が近い親', unresolved: '未解決の出典行',
    cards: 'パル', noResult: '該当するパルがありません。',
  },
  en: {
    routes: 'Breeding routes', saved: 'Saved', search: 'Search Pals', all: 'All', parents: 'How to make', children: 'Make from this Pal', outputs: 'Outputs', more: 'Show all', special: 'Special', normal: 'Normal', rank: 'Breeding Rank', sources: 'Sources', insight: 'What this reveals', save: 'Save recipe', savedState: 'Saved', savedRecipes: 'Saved recipes',
    choose: 'Choose a Pal', formula: 'Normal breeding rule', formulaText: 'The two parent ranks become an intermediate value, then resolve to the closest eligible Pal rank. Special combinations override this rule.',
    direct: 'Exact recipe', nearby: 'Rank-near parent', unresolved: 'Unresolved source row',
    cards: 'Pals', noResult: 'No Pals match this filter.',
  },
};

function readPreference(key, fallback, allowed) {
  const value = localStorage.getItem(key);
  return allowed.includes(value) ? value : fallback;
}

function writePreference(key, value) {
  localStorage.setItem(key, value);
}

function readSavedRecipes() {
  const value = JSON.parse(localStorage.getItem('pal-atlas-saved-recipes') ?? '[]');
  return new Map(Array.isArray(value) ? value.filter((row) => row?.id && byId.has(row.parentA) && byId.has(row.parentB) && byId.has(row.child)).map((row) => [row.id, row]) : []);
}

const savedRecipeIds = readSavedRecipes();
const outputCache = new Map();

const state = {
  lang: readPreference('pal-atlas-lang', 'ja', ['ja', 'en']),
  theme: readPreference('pal-atlas-theme', 'dark', ['dark', 'light']),
  stack: [byId.has('anubis') ? 'anubis' : pals[0].id],
  search: '',
  element: 'all',
  showAllOutputs: false,
};

const elementLabels = { neutral: ['無', 'Neutral'], fire: ['火', 'Fire'], water: ['水', 'Water'], grass: ['草', 'Grass'], electric: ['雷', 'Electric'], ground: ['地', 'Ground'], ice: ['氷', 'Ice'], dark: ['闇', 'Dark'], dragon: ['竜', 'Dragon'] };
const elText = (element) => elementLabels[element]?.[state.lang === 'ja' ? 0 : 1] ?? element;
const t = (key) => copy[state.lang][key] ?? key;
const selected = () => byId.get(state.stack.at(-1)) ?? pals[0];
let appBound = false;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function palName(pal) {
  return state.lang === 'ja' ? pal.nameJa : pal.nameEn;
}

function imageUrl(pal) {
  return pal.imageWebpUrl || pal.imageUrl;
}

function imageMarkup(pal, alt = '') {
  const primary = imageUrl(pal);
  const original = pal.imageOriginalUrl || pal.imageUrl;
  const fallback = primary !== original ? ` data-fallback="${esc(original)}"` : '';
  return `<img src="${esc(primary)}"${fallback} alt="${esc(alt)}" loading="lazy" />`;
}

function directParentRows(pal) {
  return special.filter((row) => row.child === pal.id).map((row) => ({
    id: row.id, kind: 'special', parentA: byId.get(row.parentA), parentB: byId.get(row.parentB), child: pal.id, label: row.kind,
  }));
}

function normalParentRows(pal) {
  return (featuredNormal[pal.id] ?? []).map((row) => ({
    id: row.id, kind: 'normal', parentA: byId.get(row.parentA), parentB: byId.get(row.parentB), child: pal.id, intermediatePower: row.intermediatePower, delta: Math.abs(row.intermediatePower - pal.breedingRank), label: t('nearby'),
  }));
}

function parentRows(pal) {
  const direct = directParentRows(pal);
  const normal = normalParentRows(pal).filter((row) => !direct.some((item) => item.parentA?.id === row.parentA?.id && item.parentB?.id === row.parentB?.id));
  return [...direct, ...normal].slice(0, 6);
}

function recipeRecord(row) {
  const id = (value) => typeof value === 'string' ? value : value?.id;
  return { id: row.id, parentA: id(row.parentA ?? row.parent), parentB: id(row.parentB ?? row.otherParent), child: id(row.child ?? row.childPal), kind: row.kind, intermediatePower: row.intermediatePower ?? null };
}

function recipeSaveButton(row) {
  const record = recipeRecord(row);
  const saved = savedRecipeIds.has(record.id);
  return `<button class="recipe-save ${saved ? 'is-saved' : ''}" data-save-recipe="${esc(JSON.stringify(record))}" aria-label="${saved ? t('savedState') : t('save')}">${saved ? '♥' : '♡'}</button>`;
}

function outputRows(pal) {
  return (outputCache.get(pal.id) ?? outputs[pal.id]?.rows ?? []).map((row) => ({
    ...row,
    childPal: byId.get(row.child),
    otherParent: byId.get(row.otherParent),
  })).filter((row) => row.childPal && row.otherParent);
}

function outputCount(pal) {
  return outputs[pal.id]?.total ?? 0;
}

function savedRecipeRows() {
  return [...savedRecipeIds.values()];
}

function savedSection(rows) {
  if (!rows.length) return '';
  return `<section class="saved-section" id="saved-view"><div class="section-head"><div><span class="micro-label">05 / ${t('saved')}</span><h2>${t('savedRecipes')}</h2></div><span class="result-count">${rows.length}</span></div><div class="saved-list">${rows.map((row) => {
    const parentA = byId.get(row.parentA); const parentB = byId.get(row.parentB); const child = byId.get(row.child);
    if (!parentA || !parentB || !child) return '';
    return `<div class="saved-item"><button class="saved-open" data-select="${child.id}" data-drill="true" aria-label="${esc(palName(child))}"><span><b>${esc(palName(parentA))} + ${esc(palName(parentB))}</b><small>${row.kind === 'special' ? t('direct') : `${t('nearby')} / ${row.intermediatePower}`}</small></span><strong>→ ${esc(palName(child))}</strong></button>${recipeSaveButton(row)}</div>`;
  }).join('')}</div></section>`;
}

function outputCard(pal, row) {
  const pair = `${palName(row.otherParent)} + ${palName(pal)}`;
  const label = row.kind === 'special'
    ? `${pair} / ${t('direct')}`
    : `${pair} / ${t('nearby')} Δ${row.delta}`;
  return `<div class="output-card"><button class="output-open" data-select="${row.childPal.id}" data-drill="true" aria-label="${esc(palName(row.childPal))}">
    ${imageMarkup(row.childPal, palName(row.childPal))}<span><strong>${esc(palName(row.childPal))}</strong><small>${esc(label)}</small></span><b>${row.childPal.breedingRank}</b>
  </button>${recipeSaveButton(row)}</div>`;
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

function card(pal) {
  return `<button class="pal-card ${pal.id === selected().id ? 'is-selected' : ''}" data-select="${pal.id}" aria-label="${esc(palName(pal))}">
    ${imageMarkup(pal, palName(pal))}
    <span class="card-copy"><strong>${esc(palName(pal))}</strong><small>${esc(pal.nameEn === pal.nameJa ? pal.nameEn : state.lang === 'ja' ? pal.nameEn : pal.nameJa)}</small></span>
    <span class="card-rank">${pal.breedingRank}</span>
  </button>`;
}

function recipePal(pal, role) {
  if (!pal) return `<span class="recipe-pal missing">—</span>`;
  const tag = role === 'target' ? 'span' : 'button';
  const action = role === 'target' ? '' : ` data-select="${pal.id}" data-drill="true" aria-label="${esc(palName(pal))}"`;
  return `<${tag} class="recipe-pal ${role}"${action}>${imageMarkup(pal)}<span><b>${esc(palName(pal))}</b><small>${t('rank')} ${pal.breedingRank}</small></span></${tag}>`;
}

function recipeView(pal) {
  const rows = parentRows(pal).slice(0, 4);
  return `<section class="recipe-panel" id="recipe-view"><div class="section-head"><div><span class="micro-label">02 / ${t('routes')}</span><h2>${t('parents')}</h2></div><span class="result-count">${rows.length}</span></div>
    <div class="recipe-list breeding-recipes" aria-label="${esc(palName(pal))} breeding recipes">${rows.length ? rows.map((row) => `<div class="recipe-row ${row.kind}"><div class="recipe-parents">${recipePal(row.parentA, 'parent-a')}<span class="recipe-plus">＋</span>${recipePal(row.parentB, 'parent-b')}</div><div class="recipe-rule"><b>${row.kind === 'special' ? t('direct') : t('normal')}</b><small>${row.kind === 'special' ? esc(row.label) : `${t('nearby')} Δ${row.delta} / ${row.intermediatePower}`}</small>${recipeSaveButton(row)}</div><span class="recipe-arrow" aria-hidden="true">→</span>${recipePal(pal, 'target')}</div>`).join('') : `<p class="muted">${t('unresolved')}</p>`}</div></section>`;
}

function outputView(pal) {
  const rows = outputRows(pal);
  const visible = state.showAllOutputs ? rows : rows.slice(0, 12);
  const more = !state.showAllOutputs && outputCount(pal) > visible.length ? `<button class="more-button" data-more-outputs="true">${t('more')} / ${outputCount(pal)}</button>` : '';
  return `<section class="output-panel" id="outputs-view"><div class="section-head"><div><span class="micro-label">03 / ${t('children')}</span><h2>${t('outputs')}</h2></div><span class="result-count">${visible.length} / ${outputCount(pal)}</span></div><div class="output-grid">${visible.length ? visible.map((row) => outputCard(pal, row)).join('') : `<p class="muted">${t('unresolved')}</p>`}</div>${more}</section>`;
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
  const savedRows = savedRecipeRows();
  const sourceStep = savedRows.length ? '06' : '05';
  document.querySelector('#app').innerHTML = `<main class="shell">
    <header class="topbar" id="top"><a class="brand" href="#top"><span class="brand-glyph">✳</span><span>PAL ATLAS</span></a><label class="search-box topbar-search"><span>⌕</span><input data-search type="search" value="${esc(state.search)}" placeholder="${t('search')}" /></label><nav><button class="text-button saved-link" data-saved-link="true">♡ ${t('saved')} ${savedRows.length}</button><button class="icon-button" data-lang-toggle="true">${state.lang === 'ja' ? 'EN' : '日'}</button><button class="icon-button" data-theme-toggle="true">${state.theme === 'dark' ? '☼' : '☾'}</button></nav></header>
    <section class="workspace" id="atlas-view">
      <div class="main-column"><div class="section-head"><div><span class="micro-label">01 / ${t('choose')}</span><h2>${t('cards')}</h2></div><span class="result-count">${filtered.length} / ${pals.length}</span></div>
        <div class="controls"><select data-element aria-label="${t('all')}"><option value="all">${t('all')} elements</option>${allElements.map((element) => `<option value="${element}" ${state.element === element ? 'selected' : ''}>${elText(element)}</option>`).join('')}</select></div>
        <div class="atlas-grid">${catalogMarkup(filtered)}</div>
      </div>
      <aside class="detail-column"><div class="detail-card"><div class="trail"><button data-back ${state.stack.length > 1 ? '' : 'disabled'}>←</button><span>${state.stack.map((id) => esc(palName(byId.get(id)))).join(' <i>→</i> ')}</span></div><div class="selected-portrait">${imageMarkup(pal, palName(pal))}</div><div class="selected-title"><span class="micro-label">#${String(pal.order).padStart(3, '0')} / ${pal.rarityTier}</span><h2>${esc(palName(pal))}</h2><p>${pal.nameEn === pal.nameJa ? '' : esc(state.lang === 'ja' ? pal.nameEn : pal.nameJa)}</p></div><div class="tag-row">${pal.elements.map((element) => `<span class="tag element-${element}">${elText(element)}</span>`).join('')}<span class="tag rank-tag">${t('rank')} ${pal.breedingRank}</span></div><div class="divider"></div><div class="detail-label">${t('insight')}</div>${insight(pal)}</div>
        ${recipeView(pal)}${outputView(pal)}<div class="formula-card"><span class="micro-label">04 / ${t('formula')}</span><p>${t('formulaText')}</p><code>⌊ (A + B + 1) / 2 ⌋ → nearest</code></div>
      </aside>
    </section>
    ${savedSection(savedRows)}
    <section class="source-section"><div><span class="micro-label">${sourceStep} / ${t('sources')}</span><h2>${state.lang === 'ja' ? '出典' : 'Sources'}</h2></div><div class="source-list">${sourceData.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer"><span>${esc(source.title)}</span><small>${esc(source.role)}</small><b>↗</b></a>`).join('')}</div></section>
  </main>`;
  bind();
}

function bind() {
  const app = document.querySelector('#app');
  if (!app || appBound) return;
  appBound = true;
  app.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-select], [data-back], [data-save-recipe], [data-saved-link], [data-more-outputs], [data-lang-toggle], [data-theme-toggle]');
    if (!target || !app.contains(target)) return;
    if (target.dataset.saveRecipe) {
      event.preventDefault();
      const recipe = JSON.parse(target.dataset.saveRecipe);
      if (!recipe.id || !byId.has(recipe.parentA) || !byId.has(recipe.parentB) || !byId.has(recipe.child)) return;
      if (savedRecipeIds.has(recipe.id)) savedRecipeIds.delete(recipe.id); else savedRecipeIds.set(recipe.id, recipe);
      writePreference('pal-atlas-saved-recipes', JSON.stringify([...savedRecipeIds.values()]));
      const scrollY = window.scrollY;
      render();
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
      return;
    }
    if (target.dataset.savedLink !== undefined) {
      document.querySelector('#saved-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (target.dataset.moreOutputs !== undefined) {
      const detail = await (await fetch(`./api/pals/${selected().id}.json`)).json();
      outputCache.set(selected().id, detail.recipes.outputs);
      state.showAllOutputs = true;
      render();
      return;
    }
    if (target.dataset.select) {
      const id = target.dataset.select;
      if (!byId.has(id)) return;
      state.stack = target.dataset.drill === 'true' ? [...state.stack, id] : [id];
      state.showAllOutputs = false;
      render();
      if (matchMedia('(max-width: 680px)').matches) requestAnimationFrame(() => document.querySelector('.detail-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    if (target.dataset.back !== undefined) {
      if (state.stack.length > 1) {
        state.stack = state.stack.slice(0, -1);
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
  app.addEventListener('error', (event) => {
    const image = event.target;
    const fallback = image instanceof HTMLImageElement ? image.dataset.fallback : '';
    if (!fallback || image.src === fallback) return;
    image.removeAttribute('data-fallback');
    image.src = fallback;
  }, true);
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
}

render();
