const ATTRIBUTION_RE = /^[A-Za-z0-9._-]{1,64}$/;
export function normalizeAttribution(value) { return ATTRIBUTION_RE.test(value ?? '') ? value : null; }
export function samePair(row, parentA, parentB) { return (row.parentA === parentA && row.parentB === parentB) || (row.parentA === parentB && row.parentB === parentA); }
export function resolvePair(breeding, parentA, parentB) {
  if (!parentA || !parentB) return { status: 'INVALID' };
  const matchingSpecial = (breeding.special ?? []).filter((row) => samePair(row, parentA, parentB));
  if (matchingSpecial.length) {
    const resolved = matchingSpecial.filter((row) => row.status === 'resolved' && row.child);
    const children = [...new Set(resolved.map((row) => row.child))];
    if (children.length === 1 && resolved.length === matchingSpecial.length) return { status: 'MATCH', kind: 'special', child: children[0] };
    return { status: 'REVIEW_REQUIRED', reason: 'unresolved_special_recipe' };
  }
  const matchingNormal = (breeding.normal ?? []).filter((row) => samePair(row, parentA, parentB) && row.child);
  const children = [...new Set(matchingNormal.map((row) => row.child))];
  if (children.length === 1) return { status: 'MATCH', kind: 'normal', child: children[0] };
  if (children.length > 1) return { status: 'REVIEW_REQUIRED', reason: 'conflicting_normal_recipe' };
  return { status: 'UNKNOWN' };
}
export function findTargetRecipes(breeding, target) {
  if (!target) return [];
  const rows = [];
  for (const row of breeding.special ?? []) if (row.child === target && row.status === 'resolved') rows.push({ ...row, kind: 'special' });
  for (const row of breeding.normal ?? []) if (row.child === target) rows.push({ ...row, kind: 'normal' });
  return rows;
}
function esc(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function parentMessage(event, attribution, extra = {}) { if (typeof window !== 'undefined' && window.parent) window.parent.postMessage({ type: 'pal-atlas-embed-v1', event, ...attribution, ...extra }, '*'); }
async function boot() {
  const root = document.querySelector('#widget'); if (!root) return;
  const params = new URLSearchParams(window.location.search); const lang = params.get('lang') === 'en' ? 'en' : 'ja';
  const attribution = { partner: normalizeAttribution(params.get('partner')), campaign: normalizeAttribution(params.get('campaign')) };
  const copy = lang === 'ja' ? { title:'PAL ATLAS 配合検索',pair:'親2体から検索',target:'目的のパルから検索',search:'検索',normal:'通常配合',special:'特殊配合',review:'出典競合または未解決のため確定表示しません。',unknown:'確認できる配合結果がありません。',detail:'PAL ATLASを開く',unofficial:'非公式ファンプロジェクトです。公式情報・出典はPAL ATLAS本体から確認できます。',choose:'選択してください',recipes:'配合候補' } : { title:'PAL ATLAS Breeding Search',pair:'Search by two parents',target:'Search by target Pal',search:'Search',normal:'Normal breeding',special:'Special breeding',review:'Source conflict or unresolved evidence; no definitive result is shown.',unknown:'No confirmed breeding result was found.',detail:'Open PAL ATLAS',unofficial:'Unofficial fan project. Check sources and evidence in PAL ATLAS.',choose:'Choose a Pal',recipes:'Breeding options' };
  const [palsPayload, breeding] = await Promise.all([fetch('../../api/pals.json').then(r=>{if(!r.ok)throw new Error(`pals ${r.status}`);return r.json();}),fetch('../../api/breeding.json').then(r=>{if(!r.ok)throw new Error(`breeding ${r.status}`);return r.json();})]);
  const pals=palsPayload.pals??[]; const byId=new Map(pals.map(p=>[p.id,p])); const name=p=>lang==='ja'?p.nameJa:p.nameEn; const options=[`<option value="">${esc(copy.choose)}</option>`,...pals.map(p=>`<option value="${esc(p.id)}">${esc(name(p))}</option>`)].join('');
  root.innerHTML=`<main><header><span>PAL ATLAS</span><h1>${esc(copy.title)}</h1></header><section><h2>${esc(copy.pair)}</h2><div class="controls"><select id="parent-a">${options}</select><span>＋</span><select id="parent-b">${options}</select><button id="pair-search">${esc(copy.search)}</button></div><div id="pair-result" class="result" aria-live="polite"></div></section><section><h2>${esc(copy.target)}</h2><div class="controls"><select id="target">${options}</select><button id="target-search">${esc(copy.search)}</button></div><div id="target-result" class="result" aria-live="polite"></div></section><footer>${esc(copy.unofficial)}</footer></main>`;
  const setIfKnown=(selector,value)=>{if(value&&byId.has(value))root.querySelector(selector).value=value;}; setIfKnown('#parent-a',params.get('parentA'));setIfKnown('#parent-b',params.get('parentB'));setIfKnown('#target',params.get('target'));
  const detailLink=pal=>`<a target="_blank" rel="noopener noreferrer" href="../../" data-open-pal="${esc(pal.id)}">${esc(copy.detail)}</a>`;
  const renderPair=()=>{const a=root.querySelector('#parent-a').value,b=root.querySelector('#parent-b').value,result=resolvePair(breeding,a,b);parentMessage('breed_searched',attribution,{mode:'parents',status:result.status});const box=root.querySelector('#pair-result');if(result.status==='MATCH'){const child=byId.get(result.child);box.innerHTML=child?`<strong>${esc(name(child))}</strong><span class="badge">${esc(result.kind==='special'?copy.special:copy.normal)}</span>${detailLink(child)}`:esc(copy.unknown);}else if(result.status==='REVIEW_REQUIRED')box.textContent=copy.review;else box.textContent=copy.unknown;};
  const renderTarget=()=>{const target=root.querySelector('#target').value,targetPal=byId.get(target),rows=findTargetRecipes(breeding,target).slice(0,12);parentMessage('breed_searched',attribution,{mode:'target',status:rows.length?'MATCH':'UNKNOWN'});const box=root.querySelector('#target-result');if(!targetPal||!rows.length){box.textContent=copy.unknown;return;}box.innerHTML=`<strong>${esc(name(targetPal))}</strong><small>${esc(copy.recipes)}: ${rows.length}</small><ul>${rows.map(row=>{const a=byId.get(row.parentA),b=byId.get(row.parentB);return a&&b?`<li>${esc(name(a))} ＋ ${esc(name(b))} <span class="badge">${esc(row.kind==='special'?copy.special:copy.normal)}</span></li>`:'';}).join('')}</ul>${detailLink(targetPal)}`;};
  root.querySelector('#pair-search').addEventListener('click',renderPair);root.querySelector('#target-search').addEventListener('click',renderTarget);root.addEventListener('click',event=>{const link=event.target.closest('[data-open-pal]');if(link)parentMessage('pal_atlas_opened',attribution,{pal:link.dataset.openPal});});parentMessage('embed_loaded',attribution);if(root.querySelector('#parent-a').value&&root.querySelector('#parent-b').value)renderPair();else if(root.querySelector('#target').value)renderTarget();
}
if(typeof document!=='undefined')boot().catch(error=>{const root=document.querySelector('#widget');if(root)root.textContent=`PAL ATLAS widget unavailable: ${error.message}`;});
