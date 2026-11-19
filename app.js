/* MYSTERIA – all game content comes from XML in /data.
   DOM parsing: DOMParser. Querying: XPath (document.evaluate). Transform: XSLT (XSLTProcessor).
   Validation: structural check driven by cases.xsd (browsers have no native XSD validator). */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle = a => [...a].sort(() => Math.random() - .5);

/* XPath helpers */
const xp = (ctx, expr) => {
  const r = (ctx.ownerDocument || ctx).evaluate(expr, ctx, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null), a = [];
  for (let i = 0; i < r.snapshotLength; i++) a.push(r.snapshotItem(i));
  return a;
};
const tx = (ctx, expr) => (xp(ctx, expr)[0]?.textContent || '').trim();

const D = {}; let G = null, filter = 'all';
const fetchXML = async f => {
  const res = await fetch('data/' + f);
  if (!res.ok) throw new Error(f + ' (' + res.status + ')');
  return new DOMParser().parseFromString(await res.text(), 'application/xml');
};
const getCase = id => xp(D.cases, `//case[@id='${id}']`)[0];
const getLevel = id => xp(D.lvl, `//level[@id='${id}']`)[0];

/* XSD-driven validation: required child elements and attributes declared in the schema */
function validate(doc, xsd) {
  const XS = 'http://www.w3.org/2001/XMLSchema', rules = {}, errs = [];
  for (const el of xsd.getElementsByTagNameNS(XS, 'element')) {
    const ct = [...el.children].find(c => c.localName === 'complexType');
    const seq = ct && [...ct.children].find(c => c.localName === 'sequence');
    if (!seq) continue;
    rules[el.getAttribute('name')] = {
      kids: [...seq.children].filter(c => c.localName === 'element' && c.getAttribute('minOccurs') !== '0').map(c => c.getAttribute('name')),
      attrs: [...ct.children].filter(c => c.localName === 'attribute' && c.getAttribute('use') === 'required').map(c => c.getAttribute('name'))
    };
  }
  for (const n of doc.getElementsByTagName('*')) {
    const r = rules[n.localName]; if (!r) continue;
    r.kids.forEach(k => { if (![...n.children].some(c => c.localName === k)) errs.push(`<${n.localName}> missing <${k}>`); });
    r.attrs.forEach(a => { if (!n.hasAttribute(a)) errs.push(`<${n.localName}> missing @${a}`); });
  }
  const bad = xp(doc, "//case[not(@difficulty='easy' or @difficulty='medium' or @difficulty='hard')]");
  if (bad.length) errs.push('invalid difficulty value');
  return errs;
}

/* XSLT: transform one <case> into HTML */
function xslt(caseNode, view) {
  const d = document.implementation.createDocument('', '', null);
  d.appendChild(d.importNode(caseNode, true));
  const p = new XSLTProcessor();
  p.importStylesheet(D.xsl); p.setParameter(null, 'view', view);
  return p.transformToFragment(d, document);
}

/* Player progress stored as XML (seeded from progress.xml, saved in localStorage) */
function saveResult(caseId, score, win) {
  const r = D.prog.createElement('result');
  r.setAttribute('case', caseId); r.setAttribute('score', score); r.setAttribute('solved', win);
  D.prog.documentElement.appendChild(r);
  try { localStorage.setItem('mysteria_progress', new XMLSerializer().serializeToString(D.prog)); } catch (e) {}
}

async function init() {
  try {
    const f = ['cases.xml', 'puzzles.xml', 'levels.xml', 'case.xsl', 'cases.xsd', 'progress.xml'];
    [D.cases, D.puz, D.lvl, D.xsl, D.xsd, D.prog] = await Promise.all(f.map(fetchXML));
    try { const s = localStorage.getItem('mysteria_progress'); if (s) D.prog = new DOMParser().parseFromString(s, 'application/xml'); } catch (e) {}
    const errs = validate(D.cases, D.xsd);
    $('#xmlStatus').textContent = errs.length ? 'XSD check failed: ' + errs.join('; ') : 'cases.xml passed XSD check · content loaded from XML';
    renderHome(); renderSelect();
  } catch (e) {
    $('#xmlStatus').textContent = 'Could not load XML: ' + e.message + '. Serve this folder over HTTP (python3 -m http.server) instead of opening the file directly.';
  }
}

function go(v) {
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== v);
  window.scrollTo(0, 0);
  if (v === 'select') renderSelect();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); go(b.dataset.go); } });

const caseCard = c => {
  const d = c.getAttribute('difficulty');
  const el = document.createElement('article');
  el.className = 'card click'; el.tabIndex = 0;
  el.innerHTML = `<span class="badge ${d}">${d}</span><h3>${esc(tx(c, 'title'))}</h3><p>${esc(tx(c, 'tagline'))}</p><button>Open case file</button>`;
  const open = () => startCase(c.getAttribute('id'));
  el.onclick = open; el.onkeydown = e => { if (e.key === 'Enter') open(); };
  return el;
};

function renderHome() {
  $('#featured').replaceChildren(...xp(D.cases, '//case').map(caseCard));
  $('#levels').replaceChildren(...xp(D.lvl, '//level').map(l => {
    const el = document.createElement('div'); el.className = 'card click';
    el.innerHTML = `<h3>${esc(tx(l, 'name'))}</h3><p>${esc(tx(l, 'blurb'))}</p><p class="small">Base score ${l.getAttribute('base')} · hint −${l.getAttribute('hintPenalty')} · mistake −${l.getAttribute('wrongPenalty')}</p>`;
    el.onclick = () => { filter = l.getAttribute('id'); go('select'); };
    return el;
  }));
}

function renderSelect() {
  const ids = ['all', ...xp(D.lvl, '//level/@id').map(a => a.value)];
  $('#filters').replaceChildren(...ids.map(i => {
    const b = document.createElement('button'); b.textContent = i; b.className = i === filter ? 'on' : '';
    b.onclick = () => { filter = i; renderSelect(); }; return b;
  }));
  const list = xp(D.cases, filter === 'all' ? '//case' : `//case[@difficulty='${filter}']`);
  if (list.length) $('#cases').replaceChildren(...list.map(caseCard));
  else $('#cases').innerHTML = '<p>No cases at this difficulty yet. Choose another level.</p>';
  const h = xp(D.prog, '//result');
  $('#history').innerHTML = h.length ? h.map(r => `<p>${esc(tx(getCase(r.getAttribute('case')), 'title'))}: ${r.getAttribute('solved') === 'true' ? 'Solved' : 'Unsolved'}, score ${r.getAttribute('score')}</p>`).join('') : '<p class="small">No closed cases yet.</p>';
}

/* ---------- Investigation ---------- */
const TABS = [['brief', 'Briefing'], ['suspects', 'Suspects'], ['scene', 'Scene'], ['puzzles', 'Puzzles'], ['notebook', 'Notebook'], ['accuse', 'Accuse']];

function startCase(id) {
  G = { id, c: getCase(id), found: new Set(), solved: new Set(), hints: 0, wrong: 0, notes: '', result: null, tab: 'brief' };
  go('game'); $('#gTitle').textContent = tx(G.c, 'title');
  $('#tabs').replaceChildren(...TABS.map(([k, n]) => {
    const b = document.createElement('button'); b.textContent = n; b.dataset.k = k;
    b.onclick = () => { G.tab = k; render(); }; return b;
  }));
  render();
}

function score() {
  const l = getLevel(G.c.getAttribute('difficulty'));
  return Math.max(0, +l.getAttribute('base') - G.hints * l.getAttribute('hintPenalty') - G.wrong * l.getAttribute('wrongPenalty') + G.solved.size * 50);
}
function side() {
  const total = xp(G.c, 'clues/clue').length + xp(D.puz, `//puzzle[@case='${G.id}']`).length;
  const pct = Math.round((G.found.size + G.solved.size) / total * 100);
  $('#bar').style.width = pct + '%'; $('#pct').textContent = `Case progress: ${pct}%`;
  $('#scoreLine').textContent = `Score ${score()} · Hints used ${G.hints} · Mistakes ${G.wrong}`;
  document.querySelectorAll('#tabs button').forEach(b => b.className = b.dataset.k === G.tab ? 'on' : '');
}
const clueHTML = id => { const k = xp(G.c, `clues/clue[@id='${id}']`)[0]; return `<div class="clue"><h4>${esc(tx(k, 'title'))}</h4><p>${esc(tx(k, 'text'))}</p></div>`; };
const hintCost = () => getLevel(G.c.getAttribute('difficulty')).getAttribute('hintPenalty');

function render() {
  const p = $('#panel'); p.style.animation = 'none'; p.offsetHeight; p.style.animation = '';
  ({ brief, suspects, scene, puzzles, notebook, accuse })[G.tab](p); side();
}

function brief(p) {
  p.innerHTML = `<h2>${esc(tx(G.c, 'title'))}</h2><div class="story">${esc(tx(G.c, 'story'))}</div>
    <p class="small">Tip: search every location, then solve the puzzles to unlock deeper evidence.</p>
    <button id="begin">Examine suspects</button>`;
  $('#begin').onclick = () => { G.tab = 'suspects'; render(); };
}

function suspects(p) {
  p.innerHTML = '<h2>Suspects</h2><div id="slot"></div>';
  $('#slot').appendChild(xslt(G.c, 'suspects'));   // XSLT output
}

function scene(p) {
  p.innerHTML = '<h2>Investigation scene</h2><div class="locs" id="locs"></div><div class="row"><button id="lead"></button></div><p class="hint" id="leadTxt"></p>';
  $('#locs').replaceChildren(...xp(G.c, 'locations/location').map(l => {
    const lid = l.getAttribute('id'), el = document.createElement('div'); el.className = 'card';
    const clues = xp(G.c, `clues/clue[@location='${lid}']`);
    const show = () => clues.map(k => clueHTML(k.getAttribute('id'))).join('') || '<p>Nothing here.</p>';
    el.innerHTML = `<h3>${esc(tx(l, 'name'))}</h3><p>${esc(tx(l, 'desc'))}</p><button>Search</button><div class="res"></div>`;
    const res = el.querySelector('.res');
    if (clues.every(k => G.found.has(k.getAttribute('id')))) res.innerHTML = show();
    el.querySelector('button').onclick = () => {
      res.innerHTML = '<p class="small">Searching…</p>';
      setTimeout(() => { clues.forEach(k => G.found.add(k.getAttribute('id'))); res.innerHTML = show(); side(); }, 600);
    };
    return el;
  }));
  $('#lead').textContent = `Ask for a lead (−${hintCost()})`;
  $('#lead').onclick = () => {
    const next = xp(G.c, 'locations/location').find(l => xp(G.c, `clues/clue[@location='${l.getAttribute('id')}']`).some(k => !G.found.has(k.getAttribute('id'))));
    G.hints++; $('#leadTxt').textContent = next ? `Try searching: ${tx(next, 'name')}.` : 'Every location is searched. Solve the puzzles for the remaining clues.'; side();
  };
}

function puzzles(p) {
  p.innerHTML = '<h2>Puzzles</h2>';
  xp(D.puz, `//puzzle[@case='${G.id}']`).forEach(q => p.appendChild(puzEl(q)));
}

function puzEl(q) {
  const id = q.getAttribute('id'), type = q.getAttribute('type'), reward = q.getAttribute('reward');
  const el = document.createElement('div'); el.className = 'puz' + (G.solved.has(id) ? ' done' : '');
  let tl = [];
  const draw = () => {
    let body = '';
    if (type === 'riddle' || type === 'password') body = '<input class="in" placeholder="Your answer">';
    else if (type === 'choice') body = xp(q, 'option').map((o, i) => `<label><input type="radio" name="r${id}" value="${i}"> ${esc(o.textContent)}</label><br>`).join('');
    else if (type === 'match') {
      const opts = shuffle(xp(q, 'pair/@right').map(a => a.value));
      body = xp(q, 'pair').map((pr, i) => `<div class="row"><span>${esc(pr.getAttribute('left'))}</span><select data-i="${i}"><option value="">Choose…</option>${opts.map(o => `<option>${esc(o)}</option>`).join('')}</select></div>`).join('');
    } else if (type === 'timeline') {
      if (!tl.length) tl = shuffle(xp(q, 'event').map(e => ({ o: +e.getAttribute('order'), t: e.textContent })));
      body = '<ol class="tl">' + tl.map((e, i) => `<li>${esc(e.t)} <button data-m="${i},-1">▲</button><button data-m="${i},1">▼</button></li>`).join('') + '</ol>';
    }
    el.innerHTML = `<h3>${esc(tx(q, 'title'))}</h3><p>${esc(tx(q, 'question'))}</p>${body}
      <div class="row"><button class="chk">Check answer</button><button class="hnt">Hint (−${hintCost()})</button></div>
      <p class="hint"></p><p class="fb"></p>`;
    el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      const [i, d] = b.dataset.m.split(',').map(Number), j = i + d;
      if (tl[j]) { [tl[i], tl[j]] = [tl[j], tl[i]]; draw(); }
    });
    const fb = el.querySelector('.fb');
    el.querySelector('.hnt').onclick = () => { G.hints++; el.querySelector('.hint').textContent = 'Hint: ' + tx(q, 'hint'); side(); };
    el.querySelector('.chk').onclick = () => {
      let ok = false;
      if (type === 'riddle' || type === 'password') { const v = el.querySelector('.in').value.trim().toLowerCase(); ok = xp(q, 'answer').some(a => a.textContent.trim().toLowerCase() === v); }
      else if (type === 'choice') { const r = el.querySelector('input:checked'); ok = !!r && xp(q, 'option')[+r.value].getAttribute('correct') === 'true'; }
      else if (type === 'match') { const pr = xp(q, 'pair'); ok = [...el.querySelectorAll('select')].every(s => s.value === pr[+s.dataset.i].getAttribute('right')); }
      else ok = tl.every((e, i) => i === 0 || tl[i - 1].o < e.o);
      if (ok) { G.solved.add(id); G.found.add(reward); done(); }
      else { G.wrong++; fb.className = 'fb bad'; fb.textContent = 'Not right. Check your notebook and try again.'; side(); }
    };
  };
  const done = () => {
    el.className = 'puz done';
    el.innerHTML = `<h3>${esc(tx(q, 'title'))}: solved</h3><p class="fb ok">${esc(tx(q, 'success'))}</p>${clueHTML(reward)}`; side();
  };
  G.solved.has(id) ? done() : draw();
  return el;
}

function notebook(p) {
  p.innerHTML = '<h2>Investigation notebook</h2><div id="nb"></div><h3>Your notes</h3><textarea id="notes" rows="5" style="width:100%;background:#111;color:inherit;border:1px solid #444;padding:.6rem"></textarea>';
  $('#nb').innerHTML = G.found.size ? [...G.found].map(clueHTML).join('') : '<p>No clues yet. Search a location or solve a puzzle.</p>';
  $('#notes').value = G.notes; $('#notes').oninput = e => G.notes = e.target.value;
}

function accuse(p) {
  if (G.result) { p.innerHTML = G.result; $('#slot')?.appendChild(xslt(G.c, 'solution')); return; }
  p.innerHTML = `<h2>Final accusation</h2>
    <p>Who did it?</p><select id="cul">${xp(G.c, 'suspects/suspect').map(s => `<option value="${s.getAttribute('id')}">${esc(tx(s, 'name'))}</option>`).join('')}</select>
    <p>Why?</p><select id="mot">${xp(G.c, 'motives/motive').map(m => `<option value="${m.getAttribute('id')}">${esc(m.textContent)}</option>`).join('')}</select>
    <p>Which evidence proves it?</p><div id="ev"></div><br><button id="go" class="cta">Accuse</button>`;
  $('#ev').innerHTML = G.found.size ? [...G.found].map(id => `<label><input type="checkbox" value="${id}"> ${esc(tx(G.c, `clues/clue[@id='${id}']/title`))}</label><br>`).join('') : '<p class="small">Collect clues first.</p>';
  $('#go').onclick = () => {
    const key = xp(G.c, 'solution/evidence/@ref').map(a => a.value), picked = [...document.querySelectorAll('#ev input:checked')].map(i => i.value);
    const good = picked.filter(x => key.includes(x)).length, bad = picked.length - good;
    const cOK = $('#cul').value === tx(G.c, 'solution/@culprit'), mOK = $('#mot').value === tx(G.c, 'solution/@motive');
    const win = cOK && mOK && good >= 2;
    const final = win ? score() + good * 100 - bad * 50 : Math.floor(score() / 4);
    saveResult(G.id, Math.max(0, final), win);
    G.result = `<h2>Case closed</h2><div class="result ${win ? 'win' : 'lose'}"><h3>${win ? 'Correct. You solved it.' : 'Not quite. The real story is below.'}</h3>
      <p>Culprit: ${cOK ? 'correct' : 'wrong'} · Motive: ${mOK ? 'correct' : 'wrong'} · Key evidence: ${good} of ${key.length}${bad ? `, ${bad} irrelevant` : ''}</p>
      <p><b>Final score: ${Math.max(0, final)}</b></p></div><div id="slot" class="result"></div>
      <p><button data-go="select">Choose another case</button></p>`;
    accuse(p);
  };
}

init();
