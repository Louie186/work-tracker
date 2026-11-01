/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-plus.js — Lookup, Lists and the grouped tabs
   ───────────────────────────────────────────────────────────────────
   Plugs into the MIDP Checker (midp.html) through window.MIDP_PLUS.
   Reads what the checker already knows (MIDP rows, model suggestions,
   submissions, due dates) — no second copy of any file.

   🔍 Lookup   one search box, one line per answer, tick or drag to lists
   📋 Lists    My lists (drawings / typologies / models you collect),
               saved searches, and ready-made quick lists
               (per building, level, type, typology, status)
   Revision shown = the MIDP's. Submissions only add history.
   Saved per project: "tidp-checker:lists" (+ a small summary
   "tidp-checker:index" that other skills read).
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_PLUS = function (A) {
  'use strict';
  var S = A.S, T = A.T, esc = A.esc;
  var LKEY = 'tidp-checker:lists', UKEY = 'tidp-checker:lookup', IKEY = 'tidp-checker:index';
  var GROUPS = { find: ['lookup', 'lists'], track: ['overview', 'tracker', 'chase', 'cats'], review: ['changes', 'checks', 'pre'], deliver: ['subs', 'folder', 'models'], files: ['files'] };
  var CODES = { T1: 'Tower 1', T2: 'Tower 2', T3: 'Tower 3', T4: 'Tower 4', PD: 'Podium', XX: 'General', ZZ: 'Several buildings' };
  var P = Object.assign({ q: '', chip: '', open: '', last: {}, f: {}, recent: [] }, A.readJSON(UKEY, {}));
  P.f = P.f || {}; P.recent = P.recent || [];
  P.sel = new Set(); P.panel = '';
  var L = A.readJSON(LKEY, null) || { lists: [] };
  var IX = null;

  function saveUI() { A.writeJSON(UKEY, { q: P.q, chip: P.chip, open: P.open, last: P.last, f: P.f, recent: P.recent }); }
  function saveLists() {
    A.writeJSON(LKEY, L);
    if (IX) writeSummary();                                      // the To Do links read the lists from the summary
    try { if (window.parent !== window && window.parent.__trackerEmbedSaved) window.parent.__trackerEmbedSaved('midp'); } catch (e) {}
  }
  function uid() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function U(s) { return String(s == null ? '' : s).toUpperCase(); }
  function N(s) { return U(s).replace(/[^A-Z0-9]/g, ''); }

  /* ---------- names for codes ---------- */
  function bldName(c) { return CODES[U(c)] || c || '—'; }
  function lvlName(c) {
    c = U(c);
    if (c === 'ZZ') return 'Several levels'; if (c === 'XX' || !c) return 'No level';
    if (c === 'GR' || c === 'GF' || c === '00') return 'Ground'; if (c === 'RF') return 'Roof';
    var m = /^B(\d+)$/.exec(c); if (m) return 'Basement ' + (+m[1]);
    if (/^\d+$/.test(c)) return 'Level ' + (+c);
    return c;
  }
  // a short bracketed tag ending in a number marks a unit typology: "UNIT TYPE 1 BR - Type A (Res.1)"
  function typologyFromTitle(title) {
    var t = String(title || '').replace(/\s+/g, ' ');
    var m = /^(.*?\(\s*([A-Z][A-Z.]{0,11}\.?\s*\d{1,2})\s*)(\)|\s-|$)/i.exec(t);
    if (!m || /^(TYPE|OPT|OPTION|NO|NR|SHEET|PART|PHASE|STAGE|DET|DETAIL|REV|FIG|ITEM|ZONE|AREA)\b/i.test(m[2])) return '';
    return (m[1] + ')').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s*-\s*/g, ' - ').trim().toUpperCase();
  }

  /* ---------- the lookup index (rebuilt after every MIDP / model / submission change) ---------- */
  function build() {
    if (!S.built) { IX = null; return; }
    var models = new Map(), drawings = [], fam = {}, spell = {};
    (S.store.models || []).forEach(function (m) { models.set(N(m.num), { num: m.num, name: m.name || m.num, typ: m.typ || '', tower: m.tower || '', loc: m.loc || '', url: m.url || '', src: 'Model list', drawings: [], sent: 0 }); });
    S.built.rows.forEach(function (r) {
      if (r.removed || !r.num) return;
      var p = r.parts || [], bld = p[2] || '', lvl = p[3] || '', type = p[4] || r.type || '';
      if (N(r.grp) === 'MODELS') {      // models listed inside the MIDP
        var k0 = N(r.base || r.num);
        if (!models.has(k0)) models.set(k0, { num: r.base || r.num, name: r.title, typ: '', tower: bld, loc: lvl, src: 'MIDP', drawings: [], sent: 0 });
        return;
      }
      var model = null;
      if (A.isAssignable(r)) {
        var i = A.mInfo(r);
        if (i.state === 'assigned') model = { num: i.num, name: i.model ? i.model.name : i.num, sure: true };
        else if (i.state === 'suggested' && i.sugg.model) model = { num: i.sugg.model.num, name: i.sugg.model.name, sure: false };
      }
      var typ = null, v = T.txt(r.v && r.v.Typology), tag = typologyFromTitle(r.title);
      if (v) typ = { name: U(v), src: 'Set in the tracker' };
      else if (tag) typ = { name: tag, src: 'From the title' };
      else if (model && models.get(N(model.num)) && models.get(N(model.num)).typ) typ = { name: U(models.get(N(model.num)).typ), src: 'From its model' };
      var sl = S.subByKey.get(r.key) || [], last = sl[0] ? { label: A.subHead(sl[0].sub), rev: sl[0].r.rev || '', date: sl[0].sub.date } : null;
      var due = S.due.get(r.key) || {}, dueAt = due.state === 'overdue' ? due.last : due.next || due.last;
      var d = { key: r.key, num: r.num, title: r.title, rev: r.rev, bld: bld, lvl: lvl, type: type, seq: r.seq || p[6] || '', grp: r.grp, cat: r.cat, sub: r.sub,
        typ: typ, model: model, last: last, sends: sl.length, due: due.state || '',
        base: T.norm(r.base || r.num), obase: r._o ? T.norm(T.baseOf(r._o.num) || r._o.num) : '', dueIso: dueAt ? dueAt.iso : '', stage: dueAt ? dueAt.stage : '' };
      if (typ) { var nk = N(typ.name); (spell[nk] = spell[nk] || {})[typ.name] = ((spell[nk] || {})[typ.name] || 0) + 1; }
      drawings.push(d);
    });
    // one spelling per typology ("TYPE E1 (RES.1)" = "TYPE E 1(RES.1)")
    var canon = {}; Object.keys(spell).forEach(function (k) { var o = spell[k]; canon[k] = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; })[0]; });
    drawings.forEach(function (d) {
      if (d.typ) { d.typ.name = canon[N(d.typ.name)]; if (d.typ.src !== 'From its model') (fam[d.bld + ':' + String(d.seq).slice(-4)] = fam[d.bld + ':' + String(d.seq).slice(-4)] || {})[d.typ.name] = 1; }
    });
    // same number family as a known typology (…10100 / …30100 / …40100)
    drawings.forEach(function (d) {
      if (d.typ) return;
      var f = fam[d.bld + ':' + String(d.seq).slice(-4)], ks = f ? Object.keys(f) : [];
      if (ks.length === 1) d.typ = { name: ks[0], src: 'Same number family', guess: true };
    });
    var typos = {};
    drawings.forEach(function (d) {
      if (d.model) { var m = models.get(N(d.model.num)); if (!m) { m = { num: d.model.num, name: d.model.name, typ: '', tower: d.bld, src: 'MIDP', drawings: [], sent: 0 }; models.set(N(d.model.num), m); } m.drawings.push(d); if (d.sends) m.sent++; }
      if (d.typ) { var t = typos[d.typ.name] = typos[d.typ.name] || { name: d.typ.name, drawings: [], models: {}, blds: {} }; t.drawings.push(d); if (d.model) t.models[d.model.name] = 1; t.blds[bldName(d.bld)] = 1; }
    });
    IX = { drawings: drawings, byKey: new Map(drawings.map(function (d) { return [d.key, d]; })), models: Array.from(models.values()), typos: Object.keys(typos).sort().map(function (k) { return typos[k]; }) };
    IX.byModel = new Map(IX.models.map(function (m) { return [N(m.num), m]; }));
    refreshHay();
    writeSummary();
  }
  function refreshHay() {
    if (!IX) return;
    var inLists = membership();
    IX.drawings.forEach(function (d) {
      d.lists = inLists.get(d.key) || [];
      d.hay = [d.num, d.title, d.typ && d.typ.name, d.model && d.model.name, bldName(d.bld), lvlName(d.lvl), 'L' + (+d.lvl || d.lvl), d.type, d.grp, d.cat, d.sub, d.rev,
        d.lists.map(function (l) { return l.name; }).join(' ')].join(' ').toUpperCase();
    });
  }
  var sumT = null;
  function writeSummary() {
    clearTimeout(sumT);
    sumT = setTimeout(function () {
      if (!IX) return;
      A.writeJSON(IKEY, { at: new Date().toISOString(), file: S.latest && S.latest.file, sent: IX.drawings.filter(function (d) { return d.sends; }).length,
        overdue: IX.drawings.filter(function (d) { return d.due === 'overdue'; }).length,
        models: IX.models.map(function (m) { return [m.num, m.name]; }),
        // 12+ (for the To Do links): number without revision, due state, due date, stage, times sent, number before your correction
        rows: IX.drawings.map(function (d) { return [d.key, d.num, d.title, d.rev, d.bld, d.lvl, d.type, d.typ ? d.typ.name : '', d.model ? d.model.num : '', d.model ? d.model.name : '', d.last ? d.last.label : '', bldName(d.bld),
          d.base, d.due, d.dueIso, d.stage, d.sends, d.obase]; }),
        lists: L.lists.map(function (l) { return [l.id, l.name, members(l).slice(0, 3000).map(function (d) { return d.key; })]; }) });
    }, 800);
  }

  /* ---------- lists ---------- */
  // a list item: { t:'d', id:key } a drawing · { t:'ty', id:name } a typology · { t:'m', id:num } a model
  function members(list) {
    if (!IX) return [];
    if (list.kind === 'search') return search(list.q, list.chip).drawings;
    var seen = new Set(), out = [];
    var add = function (d) { if (d && !seen.has(d.key)) { seen.add(d.key); out.push(d); } };
    (list.items || []).forEach(function (it) {
      if (it.t === 'd') add(IX.byKey.get(it.id));
      else if (it.t === 'ty') IX.drawings.forEach(function (d) { if (d.typ && N(d.typ.name) === N(it.id)) add(d); });
      else if (it.t === 'm') IX.drawings.forEach(function (d) { if (d.model && N(d.model.num) === N(it.id)) add(d); });
    });
    return out;
  }
  function membership() {
    var map = new Map();
    L.lists.forEach(function (l) { if (l.kind === 'search') return; members(l).forEach(function (d) { if (!map.has(d.key)) map.set(d.key, []); map.get(d.key).push(l); }); });
    return map;
  }
  function addToList(id, refs) {
    var l = L.lists.find(function (x) { return x.id === id; }); if (!l || l.kind === 'search') return;
    var n = 0;
    refs.forEach(function (ref) {
      var t = ref.slice(0, ref.indexOf(':')), v = ref.slice(ref.indexOf(':') + 1);
      if (!l.items.some(function (x) { return x.t === t && x.id === v; })) { l.items.push({ t: t, id: v }); n++; }
    });
    saveLists(); refreshHay();
    A.toast(n ? '📌 Added ' + n + ' to "' + l.name + '"' : 'Already in "' + l.name + '"');
  }
  function newList(name, refs) {
    var l = { id: uid(), name: name, kind: 'manual', items: [], created: Date.now() };
    L.lists.push(l);
    if (refs && refs.length) addToList(l.id, refs); else saveLists();
    return l;
  }
  function refLabel(it) {
    if (it.t === 'ty') return '▦ ' + it.id;
    if (it.t === 'm') { var m = IX && IX.byModel.get(N(it.id)); return '◫ ' + (m ? m.name : it.id); }
    var d = IX && IX.byKey.get(it.id); return d ? d.num : it.id;
  }

  /* ---------- quick lists (made from the MIDP itself) ---------- */
  function quickGroups() {
    if (!IX) return [];
    var by = function (f, label) { var o = {}; IX.drawings.forEach(function (d) { var k = f(d); if (k) (o[k] = o[k] || []).push(d); }); return Object.keys(o).sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }).map(function (k) { return { id: 'auto:' + label + ':' + k, name: k, rows: o[k] }; }); };
    return [
      { title: 'Buildings', items: by(function (d) { return bldName(d.bld); }, 'b') },
      { title: 'Levels', items: by(function (d) { return d.lvl && d.lvl !== 'ZZ' && d.lvl !== 'XX' ? lvlName(d.lvl) : ''; }, 'l') },
      { title: 'Types', items: by(function (d) { return d.type; }, 't') },
      { title: 'Typologies', items: by(function (d) { return d.typ && d.typ.name; }, 'y') },
      { title: 'Status', items: [
        { id: 'auto:s:Not sent', name: 'Not sent yet', rows: IX.drawings.filter(function (d) { return !d.sends; }) },
        { id: 'auto:s:Overdue', name: 'Overdue', rows: IX.drawings.filter(function (d) { return d.due === 'overdue'; }) },
        { id: 'auto:s:Soon', name: 'Due soon', rows: IX.drawings.filter(function (d) { return d.due === 'soon'; }) },
        { id: 'auto:s:No model', name: 'No model', rows: IX.drawings.filter(function (d) { return !d.model; }) }] }
    ];
  }
  function findList(id) {
    if (!id) return null;
    if (id.indexOf('auto:') === 0) { var hit = null; quickGroups().forEach(function (g) { g.items.forEach(function (x) { if (x.id === id) hit = { id: id, name: x.name, kind: 'auto', group: g.title, rows: x.rows }; }); }); return hit; }
    var l = L.lists.find(function (x) { return x.id === id; });
    return l ? Object.assign({ rows: members(l) }, l) : null;
  }

  /* ---------- search: every word must match, best first ---------- */
  var CHIPS = [['', 'All'], ['notsent', 'Not sent'], ['overdue', 'Overdue'], ['nomodel', 'No model'], ['notypo', 'No typology']];
  function chipOk(d, chip) {
    return chip === 'notsent' ? !d.sends : chip === 'overdue' ? d.due === 'overdue' : chip === 'nomodel' ? !d.model : chip === 'notypo' ? !d.typ : true;
  }
  /* ---------- understanding what you typed ("T1 L3 PLN ceiling") ---------- */
  var DOCRE = /^[A-Z0-9]{2,}(?:-[A-Z0-9]+){3,}-?$/;
  function baseN(s) { var p = U(s).replace(/-+$/, '').split('-'); if (p.length > 5 && /^([A-Z]\d{1,3}|P\d{2})$/.test(p[p.length - 1])) p.pop(); return p.join(''); }
  function levelHit(d, n) {
    if (/^\d+$/.test(d.lvl) && +d.lvl === n) return true;
    return new RegExp('\\b(LEVEL|LVL|L)\\s*0*' + n + '\\b').test(U(d.title));
  }
  function parseQ(q) {
    var raw = String(q || '').trim();
    if (!raw) return { mode: 'none', toks: [] };
    var parts = raw.split(/[\s,;\t\n]+/).filter(Boolean);
    var docs = parts.filter(function (x) { return DOCRE.test(U(x)); });
    if (docs.length >= 2 && docs.length >= parts.length * 0.6) return { mode: 'list', nums: docs, toks: [] };
    var blds = {}, types = {};
    (IX ? IX.drawings : []).forEach(function (d) { if (d.bld) blds[U(d.bld)] = 1; if (d.type) types[U(d.type)] = 1; });
    var toks = [], i = 0;
    while (i < parts.length) {
      var w = U(parts[i]), nx = U(parts[i + 1] || ''), two = parts[i] + ' ' + (parts[i + 1] || ''), m;
      if (/^(TOWER|BLDG|BUILDING)$/.test(w) && /^\d+$/.test(nx)) { toks.push({ k: 'bld', v: 'T' + (+nx), label: 'Tower ' + (+nx), src: two }); i += 2; continue; }
      if (/^(LEVEL|LVL)$/.test(w) && /^\d+$/.test(nx)) { toks.push({ k: 'lvl', n: +nx, label: 'Level ' + (+nx), src: two }); i += 2; continue; }
      if ((m = /^L(?:EVEL)?0*(\d+)$/.exec(w))) { toks.push({ k: 'lvl', n: +m[1], label: 'Level ' + (+m[1]), src: parts[i] }); i++; continue; }
      if (/^(GF|GR|GROUND)$/.test(w)) { toks.push({ k: 'lvlc', v: ['GF', 'GR', '00'], word: 'GROUND', label: 'Ground', src: parts[i] }); i++; continue; }
      if (/^(RF|ROOF)$/.test(w)) { toks.push({ k: 'lvlc', v: ['RF'], word: 'ROOF', label: 'Roof', src: parts[i] }); i++; continue; }
      if ((m = /^B(\d)$/.exec(w))) { toks.push({ k: 'lvlc', v: ['B' + m[1], 'B0' + m[1]], word: 'BASEMENT ' + m[1], label: 'Basement ' + m[1], src: parts[i] }); i++; continue; }
      if (blds[w] && w !== 'XX' && w !== 'ZZ') { toks.push({ k: 'bld', v: w, label: bldName(w), src: parts[i] }); i++; continue; }
      if (types[w] && w.length >= 3) { toks.push({ k: 'type', v: w, label: w + ' (type)', src: parts[i] }); i++; continue; }
      toks.push({ k: 'text', v: w, label: '“' + parts[i] + '”', src: parts[i] }); i++;
    }
    return { mode: 'words', toks: toks };
  }
  function tokOk(d, t) {
    if (t.k === 'bld') return U(d.bld) === t.v;
    if (t.k === 'lvl') return levelHit(d, t.n);
    if (t.k === 'lvlc') return t.v.indexOf(U(d.lvl)) > -1 || U(d.title).indexOf(t.word) > -1;
    if (t.k === 'type') return U(d.type) === t.v;
    return d.hay.indexOf(t.v) > -1;
  }
  /* ---------- search builder: Building › Level › Type › Typology ---------- */
  var DIMS = [['bld', 'Building', function (d) { return d.bld; }, bldName], ['lvl', 'Level', function (d) { return d.lvl; }, lvlName],
    ['type', 'Type', function (d) { return d.type; }, function (x) { return x; }], ['typ', 'Typology', function (d) { return d.typ ? d.typ.name : ''; }, function (x) { return x; }]];
  function builderOk(d, f, skip) {
    return DIMS.every(function (D) { return D[0] === skip || !f[D[0]] || D[2](d) === f[D[0]]; });
  }
  function builderActive() { return DIMS.some(function (D) { return P.f[D[0]]; }); }
  function builderHtml() {
    if (!IX) return '';
    return '<div class="lbuild">' + DIMS.map(function (D) {
      var c = {};
      IX.drawings.forEach(function (d) { if (chipOk(d, P.chip) && builderOk(d, P.f, D[0])) { var v = D[2](d); if (v) c[v] = (c[v] || 0) + 1; } });
      var keys = Object.keys(c).sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); });
      return '<select data-lbuild="' + D[0] + '" aria-label="' + D[1] + '"' + (P.f[D[0]] ? ' class="on"' : '') + '><option value="">' + D[1] + ' — all</option>' +
        keys.map(function (k) { return '<option value="' + esc(k) + '"' + (P.f[D[0]] === k ? ' selected' : '') + '>' + esc(D[3](k)) + ' (' + c[k] + ')</option>'; }).join('') + '</select>';
    }).join('') + (builderActive() ? '<button class="lbtn" type="button" data-act="lkbclear">Clear</button>' : '') + '</div>';
  }

  /* ---------- search: what you typed + the builder + the status chip ---------- */
  function search(q, chip) {
    var none = { drawings: [], typos: [], models: [], lists: [], miss: [], pq: { mode: 'none', toks: [] } };
    if (!IX) return none;
    var pq = parseQ(q), base = IX.drawings.filter(function (d) { return chipOk(d, chip) && builderOk(d, P.f); });
    if (pq.mode === 'list') {          // a pasted list of drawing numbers → exactly those, in that order
      var exact = new Map(), byBase = new Map(), found = [], miss = [], seen = {};
      base.forEach(function (d) { exact.set(N(String(d.num).replace(/-+$/, '')), d); if (!byBase.has(baseN(d.num))) byBase.set(baseN(d.num), d); });
      pq.nums.forEach(function (n) { var d = exact.get(N(String(n).replace(/-+$/, ''))) || byBase.get(baseN(n)); if (d) { if (!seen[d.key]) { seen[d.key] = 1; found.push(d); } } else miss.push(n); });
      return { drawings: found, typos: [], models: [], lists: [], miss: miss, pq: pq };
    }
    var toks = pq.toks, words = toks.filter(function (t) { return t.k === 'text'; }).map(function (t) { return t.v; });
    var phrase = words.join(' ');
    var hit = function (h) { return words.every(function (w) { return h.indexOf(w) > -1; }); };
    var dr = base.filter(function (d) { return toks.every(function (t) { return tokOk(d, t); }); });
    if (phrase) dr = dr.map(function (d, i) { return { d: d, s: U(d.num).indexOf(phrase) === 0 ? 0 : d.hay.indexOf(phrase) > -1 ? 1 : 2, i: i }; })
      .sort(function (a, b) { return a.s - b.s || a.i - b.i; }).map(function (x) { return x.d; });
    if (!toks.length) return Object.assign({}, none, { drawings: chip || builderActive() ? dr : [] });
    return {
      drawings: dr, miss: [], pq: pq,
      typos: words.length ? IX.typos.filter(function (t) { return hit([t.name, Object.keys(t.blds).join(' '), Object.keys(t.models).join(' ')].join(' ').toUpperCase()); }) : [],
      models: words.length ? IX.models.filter(function (m) { return hit([m.num, m.name, m.typ, bldName(m.tower), m.loc].join(' ').toUpperCase()); }) : [],
      lists: words.length ? L.lists.filter(function (l) { return hit(U(l.name)); }) : []
    };
  }
  function addRecent(q) {
    q = String(q || '').trim(); if (q.length < 2 || q.length > 120) return;
    P.recent = [q].concat(P.recent.filter(function (x) { return x !== q; })).slice(0, 8); saveUI();
  }

  /* ---------- one-line rows ---------- */
  function modelTag(d) {
    if (!d.model) return '<span class="lt mute">no model</span>';
    return '<span class="lt' + (d.model.sure ? '' : ' guess') + '" title="' + (d.model.sure ? 'Model assigned' : 'Suggested model — accept it on Deliver › Models') + '">' + esc(d.model.name) + (d.model.sure ? '' : ' ?') + '</span>';
  }
  function sentTag(d) {
    if (d.last) return '<span class="lt ok" title="Last submission">' + esc(d.last.label.split(' · ')[0]) + (d.last.rev ? ' · ' + esc(d.last.rev) : '') + '</span>';
    return d.due === 'overdue' ? '<span class="lt bad">overdue</span>' : '<span class="lt mute">not sent</span>';
  }
  function dRow(d, opts) {
    opts = opts || {};
    var ref = 'd:' + d.key, on = P.sel.has(ref);
    return '<div class="lrow' + (on ? ' on' : '') + '" draggable="true" data-drag="' + esc(ref) + '" data-act="lkopen" data-ref="' + esc(ref) + '">' +
      (opts.noPick ? '' : '<input type="checkbox" data-lpick="' + esc(ref) + '"' + (on ? ' checked' : '') + ' aria-label="Pick">') +
      '<span class="lid mono">' + esc(String(d.num).replace(/-+$/, '')) + '</span><span class="ltt">' + esc(d.title) + (d.typ ? '<small>' + esc(d.typ.name) + (d.typ.guess ? ' ?' : '') + '</small>' : '') + '</span>' +
      '<span class="ltags">' + modelTag(d) + (d.rev ? '<span class="lt rv">' + esc(d.rev) + '</span>' : '') + sentTag(d) +
      (d.lists.length ? '<span class="lt pin" title="' + esc(d.lists.map(function (l) { return l.name; }).join(', ')) + '">📌' + d.lists.length + '</span>' : '') +
      (opts.remove ? '<button class="lx" type="button" data-act="lsrm" data-ref="' + esc(ref) + '" title="Remove from list">×</button>' : '') + '</span></div>';
  }
  function tRow(t) {
    var ref = 'ty:' + t.name, on = P.sel.has(ref);
    return '<div class="lrow' + (on ? ' on' : '') + '" draggable="true" data-drag="' + esc(ref) + '" data-act="lkopen" data-ref="' + esc(ref) + '"><input type="checkbox" data-lpick="' + esc(ref) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="lid">▦ Typology</span><span class="ltt">' + esc(t.name) + '<small>' + esc(Object.keys(t.blds).join(', ')) + '</small></span><span class="ltags"><span class="lt">' + t.drawings.length + ' drawings</span>' +
      (Object.keys(t.models).length ? '<span class="lt">' + esc(Object.keys(t.models).slice(0, 2).join(', ')) + '</span>' : '') + '</span></div>';
  }
  function mRow(m) {
    var ref = 'm:' + m.num, on = P.sel.has(ref);
    return '<div class="lrow' + (on ? ' on' : '') + '" draggable="true" data-drag="' + esc(ref) + '" data-act="lkopen" data-ref="' + esc(ref) + '"><input type="checkbox" data-lpick="' + esc(ref) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="lid">◫ Model</span><span class="ltt">' + esc(m.name) + '<small class="mono">' + esc(m.num) + '</small></span><span class="ltags"><span class="lt">' + m.drawings.length + ' drawings</span><span class="lt ok">' + m.sent + ' sent</span></span></div>';
  }
  function group(title, list, fn, cap, id) {
    if (!list.length) return '';
    var all = P['all_' + id], shown = all ? list : list.slice(0, cap);
    return '<section class="lgroup"><h3><span>' + esc(title) + ' <b>' + list.length + '</b></span>' + (list.length > cap ? '<button class="lbtn" type="button" data-act="lkall" data-v="' + id + '">' + (all ? 'Less' : 'Show all') + '</button>' : '') + '</h3>' + shown.map(fn).join('') + '</section>';
  }
  function listChips() {
    var man = L.lists.filter(function (l) { return l.kind !== 'search'; });
    return '<div class="lside"><h3>My lists</h3><p class="lhint">Drag lines here, or tick them and use “Add to list”.</p>' +
      man.map(function (l) { return '<button class="lchip" type="button" data-ldrop="' + l.id + '" data-act="lsopen" data-v="' + l.id + '"><span>📌 ' + esc(l.name) + '</span><b>' + members(l).length + '</b></button>'; }).join('') +
      '<button class="lbtn" type="button" data-act="lsnew">+ New list</button></div>';
  }
  function selBar() {
    if (!P.sel.size) return '';
    var man = L.lists.filter(function (l) { return l.kind !== 'search'; });
    return '<div class="lsel"><b>' + P.sel.size + '</b> picked <select id="lkTo"><option value="">Add to list…</option>' + man.map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join('') + '<option value="_new">+ New list…</option></select>' +
      '<button class="lbtn" type="button" data-act="lkclear">Clear</button></div>';
  }

  /* ---------- 🔍 Lookup ---------- */
  A.VIEWS.lookup = function () {
    if (!IX) build();
    var r = search(P.q, P.chip), q = P.q.trim(), active = q || P.chip || builderActive();
    var h = '<div class="lk"><div class="lk-main"><div class="lsearch"><input type="search" id="lkQ" placeholder="T1 L3 PLN · 1BR-A · 10100 · or paste drawing numbers" value="' + esc(P.q) + '" autocomplete="off" autofocus></div>' +
      builderHtml();
    if (r.pq.mode === 'words' && r.pq.toks.some(function (t) { return t.k !== 'text'; }))
      h += '<div class="lunder"><span>Understood:</span>' + r.pq.toks.map(function (t, i) { return '<span class="lu ' + t.k + '">' + esc(t.label) + '<button type="button" data-act="lktok" data-v="' + i + '" aria-label="Remove">×</button></span>'; }).join('') + '</div>';
    h += '<div class="lchips">' + CHIPS.map(function (c) { return '<button type="button" class="lc' + (P.chip === c[0] ? ' on' : '') + '" data-act="lkchip" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') +
      (active ? '<button type="button" class="lc save" data-act="lksave" title="Keep this search as a list that updates itself">⚡ Save as list</button>' : '') + '</div>' + selBar();
    if (r.pq.mode === 'list') {
      h += '<div class="lpaste"><b>Pasted list:</b> ' + r.pq.nums.length + ' numbers · <b>' + r.drawings.length + '</b> found' + (r.miss.length ? ' · <b class="bad">' + r.miss.length + ' not in this MIDP</b>' : '') +
        (r.drawings.length ? ' <button class="lbtn" type="button" data-act="lkpastelist">📌 Make a list of these</button>' : '') +
        (r.miss.length ? '<details><summary>Show the ones not found</summary><div class="mono small">' + r.miss.map(esc).join('<br>') + '</div></details>' : '') + '</div>';
    }
    if (!active) {
      var g = quickGroups(), saved = L.lists.filter(function (l) { return l.kind === 'search'; });
      h += '<div class="lstart">' +
        (P.recent.length ? '<div><h4>Recent</h4>' + P.recent.map(function (x) { return '<button type="button" class="lc" data-act="lkrecent" data-v="' + esc(x) + '">' + esc(x.length > 40 ? x.slice(0, 40) + '…' : x) + '</button>'; }).join('') + '</div>' : '') +
        (saved.length ? '<div><h4>Saved searches</h4>' + saved.map(function (l) { return '<button type="button" class="lc" data-act="lsopen" data-v="' + l.id + '">⚡ ' + esc(l.name) + '</button>'; }).join('') + '</div>' : '') +
        g.slice(0, 3).map(function (x) {
          return '<div><h4>' + esc(x.title) + '</h4>' + x.items.slice(0, 14).map(function (it) { return '<button type="button" class="lc" data-act="lsopen" data-v="' + esc(it.id) + '">' + esc(it.name) + ' <i>' + it.rows.length + '</i></button>'; }).join('') + '</div>';
        }).join('') + '<p class="lhint">Type <b>T1 L3 PLN</b>, a typology like <b>1BR-A</b>, part of a number like <b>10100</b> — or paste a list of drawing numbers. Or narrow with the four drop-downs.</p></div>';
    } else if (!r.drawings.length && !r.typos.length && !r.models.length && !r.lists.length) h += '<div class="lempty">Nothing found — remove a chip above or use fewer words.</div>';
    else h += group('Lists', r.lists, function (l) { return '<div class="lrow" data-act="lsopen" data-v="' + l.id + '"><span class="lid">📌 List</span><span class="ltt">' + esc(l.name) + '</span><span class="ltags"><span class="lt">' + members(l).length + ' drawings</span></span></div>'; }, 5, 'l') +
      group('Drawings', r.drawings, dRow, 12, 'd') + group('Typologies', r.typos, tRow, 5, 't') + group('Models', r.models, mRow, 5, 'm');
    return h + '</div>' + listChips() + '</div>' + panelHtml();
  };

  /* small panel for a typology or a model */
  function panelHtml() {
    if (!P.panel || !IX) return '';
    var t = P.panel.slice(0, P.panel.indexOf(':')), v = P.panel.slice(P.panel.indexOf(':') + 1), title = '', kv = '', rows = [];
    if (t === 'ty') { var ty = IX.typos.find(function (x) { return x.name === v; }); if (!ty) return ''; title = ty.name; rows = ty.drawings; kv = '<dt>Building</dt><dd>' + esc(Object.keys(ty.blds).join(', ')) + '</dd><dt>Models</dt><dd>' + esc(Object.keys(ty.models).join(', ') || '—') + '</dd>'; }
    else { var m = IX.byModel.get(N(v)); if (!m) return ''; title = m.name; rows = m.drawings;
      var lv = {}; rows.forEach(function (d) { if (d.lvl && d.lvl !== 'ZZ' && d.lvl !== 'XX') lv[lvlName(d.lvl)] = 1; });
      var tys = {}; rows.forEach(function (d) { if (d.typ) tys[d.typ.name] = 1; });
      kv = '<dt>Number</dt><dd class="mono">' + esc(m.num) + '</dd><dt>Building</dt><dd>' + esc(bldName(m.tower)) + '</dd><dt>Levels</dt><dd>' + esc(Object.keys(lv).join(', ') || m.loc || 'Several / not in the numbers') + '</dd>' +
        '<dt>Typologies</dt><dd>' + esc(Object.keys(tys).slice(0, 8).join(', ') || m.typ || '—') + '</dd><dt>Sent</dt><dd>' + m.sent + ' of ' + rows.length + '</dd><dt>From</dt><dd>' + esc(m.src) + '</dd>' + (m.url ? '<dt>Link</dt><dd><a href="' + esc(m.url) + '" target="_blank" rel="noopener">Open in ACC</a></dd>' : ''); }
    return '<aside class="box drawer lpanel"><div class="sec-h"><h2 style="margin:0">' + (t === 'ty' ? 'Typology' : 'Model') + '</h2><button class="btn small" type="button" data-act="lkpclose">✕</button></div>' +
      '<p style="margin:4px 0 10px;font-weight:600">' + esc(title) + '</p><dl class="kv">' + kv + '<dt>Drawings</dt><dd>' + rows.length + '</dd></dl>' +
      '<div class="lsel" style="margin:10px 0"><select id="lkPanelTo"><option value="">📌 Add to list…</option>' + L.lists.filter(function (l) { return l.kind !== 'search'; }).map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join('') + '<option value="_new">+ New list…</option></select></div>' +
      '<div class="lbox">' + rows.map(function (d) { return dRow(d, { noPick: true }); }).join('') + '</div></aside>';
  }

  /* ---------- 📋 Lists ---------- */
  A.VIEWS.lists = function () {
    if (!IX) build();
    var cur = findList(P.open) || null;
    var man = L.lists.filter(function (l) { return l.kind !== 'search'; }), saved = L.lists.filter(function (l) { return l.kind === 'search'; });
    var nav = '<div class="lnav"><h3>My lists <button class="lbtn" type="button" data-act="lsnew">+ New</button></h3>' +
      (man.map(function (l) { return '<button type="button" class="lnl' + (P.open === l.id ? ' on' : '') + '" data-ldrop="' + l.id + '" data-act="lsopen" data-v="' + l.id + '"><span>📌 ' + esc(l.name) + '</span><b>' + members(l).length + '</b></button>'; }).join('') || '<p class="lhint">None yet — make one, then drag drawings, typologies or models onto it.</p>') +
      (saved.length ? '<h3>Saved searches</h3>' + saved.map(function (l) { return '<button type="button" class="lnl' + (P.open === l.id ? ' on' : '') + '" data-act="lsopen" data-v="' + l.id + '"><span>⚡ ' + esc(l.name) + '</span><b>' + members(l).length + '</b></button>'; }).join('') : '') +
      quickGroups().map(function (g) {
        if (!g.items.length) return '';
        var open = P['qg_' + g.title];
        return '<h3 class="lq" data-act="lsq" data-v="' + esc(g.title) + '">' + (open ? '▾ ' : '▸ ') + esc(g.title) + ' <i>' + g.items.length + '</i></h3>' +
          (open ? g.items.map(function (it) { return '<button type="button" class="lnl small' + (P.open === it.id ? ' on' : '') + '" data-act="lsopen" data-v="' + esc(it.id) + '"><span>' + esc(it.name) + '</span><b>' + it.rows.length + '</b></button>'; }).join('') : '');
      }).join('') + '</div>';
    var body;
    if (!cur) body = '<div class="lempty"><b>Pick a list</b>Quick lists are made from the MIDP (per building, level, type, typology, status). Your own lists keep whatever you add — a typology or model always shows its current drawings.</div>';
    else {
      var manual = cur.kind === 'manual';
      body = '<div class="lhead"><div><h2 style="margin:0">' + (manual ? '📌 ' : cur.kind === 'search' ? '⚡ ' : '') + esc(cur.name) + '</h2><span class="lhint">' + cur.rows.length + ' drawings · ' +
        cur.rows.filter(function (d) { return d.sends; }).length + ' sent · ' + cur.rows.filter(function (d) { return d.due === 'overdue'; }).length + ' overdue' + (cur.group ? ' · quick list (' + esc(cur.group) + ')' : '') + (cur.kind === 'search' ? ' · search “' + esc(cur.q) + '”' : '') + '</span></div>' +
        '<div class="lacts"><button class="btn small" type="button" data-act="lsxl">⬇ Excel</button>' +
        (cur.kind === 'manual' ? '<label class="btn small" title="Add the drawings listed in an Excel file (Drawing number column) to this list">⬆ Import<input type="file" data-lsimp="' + cur.id + '" accept=".xlsx,.xlsm,.xls,.csv" hidden></label>' : '') +
        '<button class="btn small" type="button" data-act="lscopy">Copy</button>' +
        (cur.kind !== 'auto' && window.LTTodoLink ? LTTodoLink.html({ f: 'midp', t: 'l', k: cur.id, label: '📌 ' + cur.name, title: 'MIDP list: ' + cur.name }, { small: true }) : '') +
        (window.parent !== window && window.parent.LT && window.parent.LT.isOn && window.parent.LT.isOn('delegate') ? '<button class="btn small" type="button" data-act="lsdel">⇶ To Delegation</button>' : '') +
        (cur.kind !== 'auto' ? '<button class="btn small" type="button" data-act="lsren">Rename</button><button class="btn small" type="button" data-act="lskill">Delete</button>' : '<button class="btn small" type="button" data-act="lscopyto">📌 Copy to my list</button>') + '</div></div>';
      if (manual) {
        var groupsIn = cur.items.filter(function (x) { return x.t !== 'd'; });
        if (groupsIn.length) body += '<div class="lchipsrow">' + groupsIn.map(function (x) { return '<span class="lgc">' + esc(refLabel(x)) + ' <button type="button" data-act="lsrm" data-ref="' + esc(x.t + ':' + x.id) + '" title="Remove">×</button></span>'; }).join('') + '</div>';
        body += '<div class="ldrop" data-ldrop="' + cur.id + '">Drop drawings, typologies or models here</div>';
      }
      var direct = manual ? new Set(cur.items.filter(function (x) { return x.t === 'd'; }).map(function (x) { return x.id; })) : null;
      body += '<div class="lbox big">' + cur.rows.map(function (d) { return dRow(d, { remove: manual && direct.has(d.key) }); }).join('') + '</div>';
    }
    return '<div class="ls">' + nav + '<div class="lbody">' + selBar() + body + '</div></div>' + panelHtml();
  };

  /* ---------- extra lines in the drawing panel ---------- */
  A.MIDP_EXT_detail = null;
  window.MIDP_EXT = {
    afterCompute: function () { build(); },
    listCount: function () { return L.lists.length; },
    info: function (key) { if (!IX) build(); return IX && IX.byKey.get(key); },        // tower / typology / model of one drawing (Folder check)
    typoNames: function () { if (!IX) build(); return IX ? IX.typos.map(function (t) { return t.name; }) : []; },
    detailExtra: function (r) {
      if (!IX) build(); var d = IX && IX.byKey.get(r.key); if (!d) return '';
      var man = L.lists.filter(function (l) { return l.kind !== 'search'; });
      return '<h2 style="margin-top:16px">Lookup</h2><dl class="kv"><dt>Building</dt><dd>' + esc(bldName(d.bld)) + ' <span class="hint">(' + esc(d.bld) + ')</span></dd><dt>Level</dt><dd>' + esc(lvlName(d.lvl)) + '</dd>' +
        '<dt>Typology</dt><dd>' + (d.typ ? esc(d.typ.name) + ' <span class="hint">' + esc(d.typ.src) + '</span>' : '<span class="hint">Not known — type it in the Tracker’s Typology column</span>') + '</dd>' +
        '<dt>Lists</dt><dd>' + (d.lists.map(function (l) { return '<a href="#" data-act="lsopen" data-v="' + l.id + '">📌 ' + esc(l.name) + '</a>'; }).join(', ') || '—') + '</dd></dl>' +
        '<select id="lkDetailTo" data-key="' + esc(d.key) + '"><option value="">📌 Add to list…</option>' + man.map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join('') + '<option value="_new">+ New list…</option></select>';
    },
    afterRender: function () {
      var g = groupOf(S.view);
      P.last[g] = S.view;
      document.querySelectorAll('.gtab').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-v') === g)); });
      document.querySelectorAll('#subTabs .tab').forEach(function (b) { b.hidden = b.getAttribute('data-grp') !== g; });
      var sub = document.getElementById('subTabs'); if (sub) sub.hidden = GROUPS[g].length < 2;
      var cnt = function (k) { var el = document.querySelector('[data-count="' + k + '"]'); return el ? el.textContent : ''; };
      var gt = document.getElementById('gn-track'), gr = document.getElementById('gn-review');
      if (gt) { var c = +cnt('chase') || 0; gt.textContent = c ? c : ''; gt.hidden = !c; }
      if (gr) { var c2 = (+cnt('checks') || 0); gr.textContent = c2 ? c2 : ''; gr.hidden = !c2; }
    }
  };
  function groupOf(v) { var g = 'find'; Object.keys(GROUPS).forEach(function (k) { if (GROUPS[k].indexOf(v) > -1) g = k; }); return g; }

  /* ---------- actions ---------- */
  function rerender() { A.render(); }
  function askName(def) { var n = prompt('List name', def || ''); return n && n.trim() ? n.trim() : ''; }
  function addPicked(to, refs) {
    if (!to) return;
    if (to === '_new') { var nm = askName(); if (!nm) return rerender(); var l = newList(nm, refs); P.open = l.id; }
    else addToList(to, refs);
    P.sel.clear(); rerender();
  }
  function rowsForExport(cur) {
    return cur.rows.map(function (d) { return { 'Drawing number': d.num, 'Title': d.title, 'MIDP rev': d.rev, 'Building': bldName(d.bld), 'Level': lvlName(d.lvl), 'Type': d.type,
      'Typology': d.typ ? d.typ.name : '', 'Model': d.model ? d.model.name : '', 'Model sure?': d.model ? (d.model.sure ? 'Assigned' : 'Suggested') : '', 'Last submission': d.last ? d.last.label : '', 'Rev sent': d.last ? d.last.rev : '', 'Due': d.due }; });
  }
  Object.assign(A.ACTIONS, {
    grp: function (el) { var g = el.getAttribute('data-v'); A.go(P.last[g] && GROUPS[g].indexOf(P.last[g]) > -1 ? P.last[g] : GROUPS[g][0]); },
    lkchip: function (el) { P.chip = el.getAttribute('data-v'); saveUI(); rerender(); },
    lktok: function (el) {      // remove one understood chip from what you typed
      var pq = parseQ(P.q), i = +el.getAttribute('data-v');
      addRecent(P.q); P.q = pq.toks.filter(function (t, j) { return j !== i; }).map(function (t) { return t.src; }).join(' '); saveUI(); rerender();
    },
    lkbclear: function () { P.f = {}; saveUI(); rerender(); },
    lkrecent: function (el) { P.q = el.getAttribute('data-v'); saveUI(); rerender(); },
    lkpastelist: function () {
      var r = search(P.q, P.chip); if (!r.drawings.length) return;
      var nm = askName('Pasted list ' + new Date().toISOString().slice(0, 10)); if (!nm) return;
      var l = newList(nm, r.drawings.map(function (d) { return 'd:' + d.key; })); P.open = l.id; saveUI(); A.go('lists');
    },
    lkall: function (el) { var k = 'all_' + el.getAttribute('data-v'); P[k] = !P[k]; rerender(); },
    lkclear: function () { P.sel.clear(); rerender(); },
    lkopen: function (el, e) {
      if (e && e.target && (e.target.tagName === 'INPUT' || e.target.closest('.lx'))) return;
      var ref = el.getAttribute('data-ref');
      addRecent(P.q);
      if (ref.indexOf('d:') === 0) A.openDetail(ref.slice(2)); else { P.panel = ref; rerender(); }
    },
    lkpclose: function () { P.panel = ''; rerender(); },
    lksave: function () {
      var nm = askName((P.q || '') + (P.chip ? ' · ' + CHIPS.filter(function (c) { return c[0] === P.chip; })[0][1] : '')); if (!nm) return;
      var l = { id: uid(), name: nm, kind: 'search', q: P.q, chip: P.chip, created: Date.now() }; L.lists.push(l); saveLists();
      A.toast('⚡ Saved — it updates itself with every new MIDP'); rerender();
    },
    lsopen: function (el, e) { if (e) e.preventDefault(); P.open = el.getAttribute('data-v'); P.panel = ''; saveUI(); if (S.view !== 'lists') A.go('lists'); else rerender(); },
    lsq: function (el) { var k = 'qg_' + el.getAttribute('data-v'); P[k] = !P[k]; rerender(); },
    lsnew: function () { var nm = askName(); if (!nm) return; var l = newList(nm, Array.from(P.sel)); P.sel.clear(); P.open = l.id; saveUI(); if (S.view !== 'lists') A.go('lists'); else rerender(); },
    lsren: function () { var l = L.lists.find(function (x) { return x.id === P.open; }); if (!l) return; var nm = askName(l.name); if (nm) { l.name = nm; saveLists(); refreshHay(); rerender(); } },
    lskill: function () { var l = L.lists.find(function (x) { return x.id === P.open; }); if (l && confirm('Delete the list "' + l.name + '"? The drawings stay in the MIDP.')) { L.lists = L.lists.filter(function (x) { return x !== l; }); P.open = ''; saveLists(); refreshHay(); rerender(); } },
    lsrm: function (el, e) {
      if (e) e.stopPropagation();
      var l = L.lists.find(function (x) { return x.id === P.open; }); if (!l) return;
      var ref = el.getAttribute('data-ref'), t = ref.slice(0, ref.indexOf(':')), v = ref.slice(ref.indexOf(':') + 1);
      l.items = l.items.filter(function (x) { return !(x.t === t && x.id === v); }); saveLists(); refreshHay(); rerender();
    },
    lscopyto: function () {
      var cur = findList(P.open); if (!cur) return;
      var nm = askName(cur.name); if (!nm) return;
      var l = newList(nm, cur.rows.map(function (d) { return 'd:' + d.key; })); P.open = l.id; rerender();
    },
    lsxl: function () {
      var cur = findList(P.open); if (!cur || typeof XLSX === 'undefined') return;
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForExport(cur)), 'List');
      XLSX.writeFile(wb, (cur.name.replace(/[^A-Za-z0-9]+/g, '_') || 'List') + '_' + T.todayIso() + '.xlsx');
    },
    lscopy: function () {
      var cur = findList(P.open); if (!cur) return;
      var rows = rowsForExport(cur), head = Object.keys(rows[0] || { 'Drawing number': '' });
      var tsv = [head.join('\t')].concat(rows.map(function (r) { return head.map(function (h) { return r[h] || ''; }).join('\t'); })).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(tsv) : Promise.reject()).then(function () { A.toast('Copied ' + rows.length + ' lines — paste into Excel or an email'); }, function () { A.toast('Copy blocked — use Excel'); });
    },
    lsdel: function () {
      var cur = findList(P.open); if (!cur) return;
      var LT = window.parent.LT; if (!LT || !LT.ctx) return;
      var group = prompt('Delegation group for this task', cur.name); if (group === null) return;
      LT.ctx.sendToDelegation([{ title: cur.name, notes: 'From MIDP Checker list', subs: cur.rows.slice(0, 300).map(function (d) { return { title: d.num + ' — ' + d.title }; }) }], group.trim() || cur.name);
    }
  });

  /* ---------- typing, ticking, picking, dragging ---------- */
  var qT = null;
  var rT;
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'lkQ') return;
    clearTimeout(qT); clearTimeout(rT); var v = e.target.value;
    qT = setTimeout(function () { P.q = v; saveUI(); rerender(); }, 140);
    rT = setTimeout(function () { addRecent(v); }, 1500);       // a search you paused on → Recent
  });
  document.addEventListener('paste', function (e) {           // a list pasted from Excel/email: keep the numbers apart
    if (e.target.id !== 'lkQ') return;
    var t = (e.clipboardData || window.clipboardData).getData('text');
    if (!/[\r\n\t]/.test(t)) return;
    e.preventDefault();
    var el = e.target, v = t.replace(/[\r\n\t]+/g, ' ').trim();
    el.value = (el.value ? el.value + ' ' : '') + v; P.q = el.value; addRecent(P.q.length > 120 ? '' : P.q); saveUI(); rerender();
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'lkQ') { addRecent(e.target.value); return; }      // Enter or leaving the box
    var k = e.target.getAttribute && e.target.getAttribute('data-lbuild'); if (!k) return;
    P.f[k] = e.target.value; saveUI(); rerender();
  });
  // ⬆ Import on a list: any Excel with a "Drawing number" column (e.g. the list's own ⬇ Excel) — first column otherwise
  function listImport(id, file) {
    if (!IX || typeof XLSX === 'undefined') return;
    file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      var h = rows.slice(0, 20).findIndex(function (r) { return r.some(function (c) { return /^(drawing|document)\s*(number|no\.?)$/i.test(String(c).trim()); }); });
      var col = h >= 0 ? rows[h].findIndex(function (c) { return /^(drawing|document)\s*(number|no\.?)$/i.test(String(c).trim()); }) : 0;
      var byNum = new Map(); IX.drawings.forEach(function (d) { byNum.set(N(d.num), d); byNum.set(N(String(d.num).replace(/-+$/, '')), d); });
      var refs = [], miss = 0;
      rows.slice(h + 1).forEach(function (r) {
        var v = String(r[col] || '').trim(); if (!v) return;
        var d = byNum.get(N(v)) || IX.byKey.get(v);
        if (d) refs.push('d:' + d.key); else miss++;
      });
      var before = (L.lists.find(function (x) { return x.id === id; }) || { items: [] }).items.length;
      addToList(id, refs);
      var after = (L.lists.find(function (x) { return x.id === id; }) || { items: [] }).items.length;
      refreshHay(); rerender();
      A.toast('⬆ ' + (after - before) + ' added from ' + file.name + (miss ? ' · ' + miss + ' not in this MIDP' : '') + (refs.length - (after - before) > 0 ? ' · ' + (refs.length - (after - before)) + ' already in the list' : ''));
    }).catch(function (e) { A.toast('⚠ ' + (e.message || e)); });
  }
  document.addEventListener('change', function (e) {
    if (e.target.getAttribute && e.target.getAttribute('data-lsimp') && e.target.files && e.target.files[0]) { listImport(e.target.getAttribute('data-lsimp'), e.target.files[0]); e.target.value = ''; return; }
    var t = e.target;
    if (t.matches && t.matches('[data-lpick]')) { var r = t.getAttribute('data-lpick'); if (t.checked) P.sel.add(r); else P.sel.delete(r); rerender(); return; }
    if (t.id === 'lkTo') addPicked(t.value, Array.from(P.sel));
    else if (t.id === 'lkPanelTo') addPicked(t.value, [P.panel]);
    else if (t.id === 'lkDetailTo') addPicked(t.value, ['d:' + t.getAttribute('data-key')]);
  });
  document.addEventListener('dragstart', function (e) {
    var row = e.target.closest && e.target.closest('[data-drag]'); if (!row) return;
    var ref = row.getAttribute('data-drag'), refs = P.sel.has(ref) ? Array.from(P.sel) : [ref];
    e.dataTransfer.setData('text/x-midp', JSON.stringify(refs)); e.dataTransfer.effectAllowed = 'copy';
    document.body.classList.add('ldragging');
  });
  document.addEventListener('dragend', function () { document.body.classList.remove('ldragging'); });
  document.addEventListener('dragover', function (e) { var d = e.target.closest && e.target.closest('[data-ldrop]'); if (d && Array.prototype.indexOf.call(e.dataTransfer.types, 'text/x-midp') > -1) { e.preventDefault(); d.classList.add('over'); } });
  document.addEventListener('dragleave', function (e) { var d = e.target.closest && e.target.closest('[data-ldrop]'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', function (e) {
    var d = e.target.closest && e.target.closest('[data-ldrop]'); if (!d) return;
    var raw = e.dataTransfer.getData('text/x-midp'); if (!raw) return;
    e.preventDefault(); d.classList.remove('over'); document.body.classList.remove('ldragging');
    addToList(d.getAttribute('data-ldrop'), JSON.parse(raw)); P.sel.clear(); rerender();
  });

  /* ---------- look ---------- */
  if (window.parent !== window) document.body.classList.add('embedded');
  var css = document.createElement('style');
  css.textContent = [
    /* navigation: one quiet row of sections, the open section's views underneath */
    '.gnav{display:flex;gap:4px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 0 6px;border-bottom:1px solid var(--edge)}.gnav::-webkit-scrollbar{display:none}@media(max-width:560px){.gtab{padding-left:9px!important;padding-right:9px!important;flex:none}}',
    '.gtab{font:600 14px Inter,system-ui,sans-serif;background:none;border:0;border-bottom:3px solid transparent;color:var(--muted);padding:8px 14px 9px;cursor:pointer;margin-bottom:-1px;display:inline-flex;align-items:center;gap:6px}',
    '.gtab[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--accent)}',
    '.gtab .gn{font-size:11px;padding:0 6px;background:var(--bad);color:#fff;border-radius:99px}.gtab .dot{position:static}',
    '#subTabs{margin:8px 0 14px}#subTabs .tab{font-size:11px;padding:5px 10px}',
    'body:not(.soft) .gtab{font-family:"Silkscreen",monospace;font-weight:400;font-size:12px}body:not(.soft) .gnav{border-bottom:3px solid var(--edge)}',
    'body.embedded .seg,body.embedded #find,body.embedded [data-act="resetview"]{display:none}',
    /* lookup */
    '.lk{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:16px;align-items:start}',
    '.lsearch input{width:100%;font-size:17px;padding:12px 14px}',
    '.lchips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}',
    '.lbuild{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:6px;margin:8px 0 0}.lbuild select{width:100%;min-width:0;padding:5px 8px;font-size:12.5px}.lbuild select.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}',
    '@media(max-width:700px){.lbuild{grid-template-columns:1fr 1fr}}',
    '.lunder{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin:8px 0 0;font-size:12px;color:var(--muted)}.lu{display:inline-flex;align-items:center;gap:2px;padding:2px 4px 2px 9px;border-radius:99px;background:var(--hl);color:var(--ink);font-weight:600}.lu.text{background:none;border:1px dashed var(--muted);font-weight:400}.lu button{border:0;background:none;color:var(--bad);cursor:pointer;font-size:14px;line-height:1;padding:0 3px}',
    '.lpaste{margin:8px 0;padding:8px 12px;border:1px solid var(--line, #444);border-left:3px solid var(--accent);font-size:13px}.lpaste .bad{color:var(--bad)}.lpaste details{margin-top:6px}',
    '.lc{font-size:12px;padding:4px 11px;border:1px solid var(--edge);background:var(--panel);color:var(--muted);border-radius:99px;cursor:pointer}.lc.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}.lc i{font-style:normal;opacity:.7;margin-left:3px}.lc.save{border-style:dashed}',
    'body:not(.soft) .lc{border-radius:0;border-width:2px;font-family:"Silkscreen",monospace;font-size:10px}',
    '.lgroup{margin-bottom:14px;background:var(--panel);border:1px solid var(--edge);border-radius:14px;overflow:hidden}body:not(.soft) .lgroup{border:3px solid var(--edge);border-radius:0;box-shadow:4px 4px 0 var(--edge)}',
    '.lgroup h3{margin:0;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--edge)}.lgroup h3 b{color:var(--ink);margin-left:4px}',
    '.lrow{display:grid;grid-template-columns:auto minmax(150px,230px) minmax(0,1fr) auto;gap:10px;align-items:center;padding:6px 12px;border-bottom:1px solid var(--zebra);cursor:pointer}.lrow:last-child{border-bottom:0}.lrow:hover{background:var(--hl)}.lrow.on{background:var(--hl)}',
    '.lrow input[type=checkbox]{width:auto;min-height:0;margin:0}.lid{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ltt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ltt small{margin-left:8px;color:var(--muted);font-size:11.5px}',
    '.ltags{display:flex;gap:5px;align-items:center;justify-content:flex-end;flex-wrap:nowrap}',
    '.lt{font-size:11px;padding:1px 7px;border-radius:99px;background:var(--raise);white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}.lt.guess{opacity:.75;font-style:italic}.lt.mute{color:var(--muted)}.lt.ok{color:var(--ok)}.lt.bad{color:var(--bad)}.lt.rv{font-family:"JetBrains Mono",monospace;font-weight:700;background:var(--hd-bg);color:var(--hd-fg)}',
    'body:not(.soft) .lt{border-radius:0}',
    '.lx{border:0;background:none;color:var(--bad);font-size:16px;cursor:pointer;padding:0 4px}',
    '.lside{position:sticky;top:10px;background:var(--panel);border:1px solid var(--edge);border-radius:14px;padding:12px}body:not(.soft) .lside{border:3px solid var(--edge);border-radius:0}',
    '.lside h3,.lnav h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);display:flex;justify-content:space-between;align-items:center}',
    '.lhint{font-size:12px;color:var(--muted);margin:4px 0 8px}',
    '.lchip,.lnl{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;border:1px dashed var(--edge);background:var(--bg);color:var(--ink);border-radius:10px;padding:7px 10px;margin-bottom:6px;cursor:pointer;font:inherit;font-size:13px}.lnl{border-style:solid}.lnl.small{font-size:12px;padding:4px 10px}.lnl.on{border-color:var(--accent);background:var(--hl)}',
    '.lchip b,.lnl b{color:var(--muted);font-weight:600}.lchip.over,.lnl.over,.ldrop.over{outline:2px solid var(--accent);background:var(--hl)}body.ldragging .lchip,body.ldragging .ldrop{border-color:var(--accent)}',
    'body:not(.soft) .lchip,body:not(.soft) .lnl{border-radius:0}',
    '.lbtn{font-size:12px;border:1px solid var(--edge);background:var(--panel);color:var(--ink);border-radius:99px;padding:3px 10px;cursor:pointer}',
    '.lsel{display:flex;gap:8px;align-items:center;padding:8px 12px;margin-bottom:10px;background:var(--hl);border-radius:12px;flex-wrap:wrap}.lsel select{width:auto;min-height:0}',
    '.lstart{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.lstart h4{margin:6px 0;font-size:12px;text-transform:uppercase;color:var(--muted)}.lstart .lc{margin:0 4px 6px 0}',
    '.lempty{padding:30px 16px;text-align:center;color:var(--muted);background:var(--panel);border:1px solid var(--edge);border-radius:14px}.lempty b{display:block;color:var(--ink);font-size:15px;margin-bottom:6px}',
    '.ls{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px;align-items:start}',
    '.lnav{position:sticky;top:10px;max-height:calc(100vh - 40px);overflow:auto;background:var(--panel);border:1px solid var(--edge);border-radius:14px;padding:12px}body:not(.soft) .lnav{border:3px solid var(--edge);border-radius:0}.lnav h3{margin-top:12px}.lq{cursor:pointer}.lq i{font-style:normal;margin-left:auto;padding-left:8px}',
    '.lhead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px}.lacts{display:flex;gap:6px;flex-wrap:wrap}',
    '.lchipsrow{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.lgc{font-size:12px;padding:3px 4px 3px 10px;border-radius:99px;background:var(--hl)}.lgc button{border:0;background:none;color:var(--bad);cursor:pointer}',
    '.ldrop{border:2px dashed var(--edge);border-radius:12px;padding:10px;text-align:center;color:var(--muted);font-size:12px;margin-bottom:10px}',
    '.lbox{background:var(--panel);border:1px solid var(--edge);border-radius:12px;overflow:hidden;max-height:50vh;overflow-y:auto}.lbox.big{max-height:none}',
    '.lpanel{width:min(520px,100%)}.lpanel .lrow{grid-template-columns:minmax(120px,190px) minmax(0,1fr) auto}',
    '@media (max-width:900px){.lk,.ls{grid-template-columns:1fr}.lside{position:static}.lnav{position:static;max-height:none}.lrow{grid-template-columns:auto 1fr;row-gap:2px}.lrow .ltt{grid-column:2}.lrow .ltags{grid-column:1/-1;justify-content:flex-start;flex-wrap:wrap}.gtab{padding:7px 9px}}'
  ].join('\n');
  document.head.appendChild(css);

  // other tabs / the project switch changed the lists
  window.addEventListener('storage', function (e) { if (e.key === LKEY) { L = A.readJSON(LKEY, null) || { lists: [] }; refreshHay(); rerender(); } });
};
