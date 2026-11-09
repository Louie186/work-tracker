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
  var GROUPS = { lookup: ['lookup', 'logic', 'ttm', 'stack', 'models', 'lists'], overview: ['overview', 'cover'], changes: ['changes'], subs: ['subs', 'chase'], sets: ['folder'], files: ['files', 'arr', 'find'], more: ['tracker', 'checks', 'cats', 'pre'] };
  var CODES = { T1: 'Tower 1', T2: 'Tower 2', T3: 'Tower 3', T4: 'Tower 4', PD: 'Podium', XX: 'General', ZZ: 'Several buildings' };
  var P = Object.assign({ q: '', chip: '', open: '', last: {}, f: {}, recent: [], pins: ['t1models', 'sv', 'late', 'nomodel'], vm: 'list', ttm: '' }, A.readJSON(UKEY, {}));
  P.f = P.f || {}; P.recent = P.recent || [];
  P.sel = new Set(); P.panel = '';
  var L = A.readJSON(LKEY, null) || { lists: [] };
  var IX = null;

  function saveUI() { A.writeJSON(UKEY, { q: P.q, chip: P.chip, open: P.open, last: P.last, f: P.f, recent: P.recent, pins: P.pins, vm: P.vm, ttm: P.ttm }); }
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
  // a unit type name has a unit word (UNIT TYPE, 2 BR, SUITE, STUDIO…) and is not a level / area ("ROOF LEVEL (Res.1)")
  var UNIT_WORD = /\b(UNIT|TYPE|SUITE|STUDIO|\d\s*-?\s*BR|BEDROOM|PENTHOUSE|APARTMENT|DUPLEX|VILLA|TOWNHOUSE|ROOM|RM|KING|TWIN)\b/i;
  var AREA_WORD = /\b(LEVEL|ROOF|FLOOR|PODIUM|BASEMENT|LOBBY|CORRIDOR|AMENIT\w*|PARKING|PLANT|TECHNICAL|GROUND|MEZZANINE|TERRACE|CORE|STAIR\w*|FACADE|LANDSCAPE|GENERAL)\b/i;
  function typologyFromTitle(title) {
    var t = String(title || '').replace(/\s+/g, ' ');
    var m = /^(.*?\(\s*([A-Z][A-Z.]{0,11}\.?\s*\d{1,2})\s*)(\)|\s-|$)/i.exec(t);
    if (!m || /^(TYPE|OPT|OPTION|NO|NR|SHEET|PART|PHASE|STAGE|DET|DETAIL|REV|FIG|ITEM|ZONE|AREA)\b/i.test(m[2])) return '';
    var name = m[1].split('(')[0];
    if (!UNIT_WORD.test(name) || (AREA_WORD.test(name) && !/\b(UNIT|SUITE|STUDIO|\d\s*-?\s*BR)\b/i.test(name))) return '';
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
      if (AREA_WORD.test(d.title || '')) return;                                   // a level / area drawing has no unit
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
  // the summary other tools read (To Do links, Delegation checklists)
  function summary() {
    if (!IX) build(); if (!IX) return null;
    return { at: new Date().toISOString(), file: S.latest && S.latest.file, sent: IX.drawings.filter(function (d) { return d.sends; }).length,
        overdue: IX.drawings.filter(function (d) { return d.due === 'overdue'; }).length,
        models: IX.models.map(function (m) { return [m.num, m.name]; }),
        // 12+ (for the To Do links): number without revision, due state, due date, stage, times sent, number before your correction
        rows: IX.drawings.map(function (d) { return [d.key, d.num, d.title, d.rev, d.bld, d.lvl, d.type, d.typ ? d.typ.name : '', d.model ? d.model.num : '', d.model ? d.model.name : '', d.last ? d.last.label : '', bldName(d.bld),
          d.base, d.due, d.dueIso, d.stage, d.sends, d.obase,
          // 18+ (Delegation checklist): the Tower you set (else the number's), model sure?
          (function () { var row = A.rowByKey ? A.rowByKey(d.key) : null; return row && row.v && T.txt(row.v.Tower) || d.bld; })(), d.model ? (d.model.sure ? 1 : 0) : '']; }),
        lists: L.lists.map(function (l) { return [l.id, l.name, members(l).slice(0, 3000).map(function (d) { return d.key; })]; }) };
  }
  function writeSummary() {
    clearTimeout(sumT);
    sumT = setTimeout(function () {
      if (!IX) return;
      A.writeJSON(IKEY, summary());
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
  function baseN(s) {                      // number without its revision: T1, P01 … and 00 / 01 (IFC) after the sequence
    var p = U(s).replace(/-+$/, '').split('-'), last = p[p.length - 1];
    if (p.length > 5 && (/^([A-Z]\d{1,3}|P\d{2})$/.test(last) || (/^\d{2,3}$/.test(last) && /^\d{3,}$/.test(p[p.length - 2])))) p.pop();
    return p.join('');
  }
  /* the Model arrangement (Files › 🏢 Arrangement): which levels each unit type is on */
  function AR() { try { return window.MIDP_EXT && MIDP_EXT.arrUnits ? MIDP_EXT.arrUnits() : null; } catch (e) { console.error(e); return null; } }
  function arrOf(d) { var a = AR(); var u = a && d.typ ? a.byTypo[d.typ.name] : null; return u && (!d.bld || d.bld === 'ZZ' || d.bld === 'XX' || U(d.bld) === u.b) ? u : (u && !a.units.some(function (x) { return x.b === U(d.bld); }) ? u : null); }
  function arrOn(u, n) { return !!u && u.levels.some(function (c) { return /^\d+$/.test(c) && +c === n; }); }
  function arrIn(u, a, b) { return !!u && u.levels.some(function (c) { return /^\d+$/.test(c) && +c >= a && +c <= b; }); }
  function levelHit(d, n) {
    if (arrOn(arrOf(d), n)) return true;
    if (/^\d+$/.test(d.lvl) && +d.lvl === n) return true;
    return new RegExp('\\b(LEVEL|LVL|L)\\s*0*' + n + '\\b').test(U(d.title));
  }
  /* the search language — every kind of word it understands (shown in 🧩 Search logic) */
  var WORDS = {
    lvlr: function (d, t) {
      if (arrIn(arrOf(d), t.a, t.b)) return true;
      if (/^\d+$/.test(d.lvl) && +d.lvl >= t.a && +d.lvl <= t.b) return true;
      var m = /\b(?:LEVEL|LVL|L)\s*0*(\d{1,3})\b/.exec(U(d.title)); return !!m && +m[1] >= t.a && +m[1] <= t.b;
    },
    tier: function (d, t) { var u = arrOf(d); return (!!u && u.tiers.indexOf('Tier ' + t.n) > -1) || new RegExp('\\bTIER\\s*' + t.n + '\\b').test(U(d.title)); },
    tl: function (d, t) { return !!d.typ && t.re.test(U(d.typ.name)); },
    bed: function (d, t) { var s = U((d.typ ? d.typ.name : '') + ' ' + d.title); return t.n === 0 ? /\bSTUDIO\b/.test(s) : new RegExp('\\b' + t.n + '\\s*-?\\s*(BR|BED|BEDROOM)S?\\b').test(s); },
    cls: function (d, t) {
      var s = U((d.typ ? d.typ.name : '') + ' ' + d.title), u = arrOf(d), c = u ? u.cls.join(' ') : '';
      if (u && t.v === 'SV' && /SERVIC/i.test(c)) return true;
      if (u && t.v === 'HT' && /HOTEL/i.test(c)) return true;
      if (u && t.v === 'RES' && /SERVIC|HOTEL/i.test(c)) return false;
      if (t.v === 'SV') return /^SV\b|\bSERVICED\b|\bSV UNIT\b/.test(s);
      if (t.v === 'HT') return /^HT\b|\bHT[- ]|\bHOTEL\b|\bSUITE\b|\bKING\b|\bTWIN\b|\bGUEST ?ROOM\b/.test(s);
      if (t.v === 'RES') return !!d.typ && /UNIT TYPE/.test(s) && !/^SV\b|\bSV UNIT\b/.test(s);
      return true;
    },
    st: function (d, t) {
      return t.v === 'late' ? d.due === 'overdue' : t.v === 'soon' ? d.due === 'soon' : t.v === 'sent' ? d.sends > 0 : t.v === 'unsent' ? !d.sends :
        t.v === 'nomodel' ? !d.model : t.v === 'notypo' ? !d.typ : t.v === 'guess' ? !!(d.model && !d.model.sure) : true;
    }
  };
  var STOP = { YET: 1, ON: 1, IN: 1, OF: 1, THE: 1, AND: 1, WITH: 1, FOR: 1, AT: 1, ALL: 1, LIST: 1, SHOW: 1, ME: 1, WHICH: 1, WHAT: 1, ARE: 1 };
  var STATUS = { UNMODELLED: 'nomodel', UNMODELED: 'nomodel', LATE: 'late', OVERDUE: 'late', SOON: 'soon', DUE: 'soon', SENT: 'sent', SUBMITTED: 'sent', UNSENT: 'unsent', NOTSENT: 'unsent', NOMODEL: 'nomodel', NOTYPOLOGY: 'notypo', SUGGESTED: 'guess' };
  var STATUS_LABEL = { late: 'Late', soon: 'Due soon', sent: 'Sent', unsent: 'Not sent', nomodel: 'No model', notypo: 'No typology', guess: 'Suggested model' };
  var SHOW = { MODELS: 'models', MODEL: 'models', TYPOLOGIES: 'typos', TYPOLOGY: 'typos', UNITS: 'typos', DRAWINGS: 'drawings' };
  // spelling slips and short forms
  var ALIAS = { SERVCED: 'SERVICED', SERVICE: 'SERVICED', SERVICED: 'SERVICED', SV: 'SERVICED', HT: 'HOTEL', HOTELS: 'HOTEL', RESIDENTIAL: 'RESIDENTIAL', BEDS: 'BED', BEDROOMS: 'BED', BEDROOM: 'BED' };
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
      var rg = /^(?:L(?:EVEL)?S?)?0*(\d{1,3})(?:-|–|—|TO)L?0*(\d{1,3})$/.exec(w) || (/^(LEVELS?|LVL|L)$/.test(w) && /^0*\d{1,3}(-|–|—)L?0*\d{1,3}$/.test(nx) ? /^0*(\d{1,3})(?:-|–|—)L?0*(\d{1,3})$/.exec(nx) : null);
      if (rg && (/^L/.test(w) || /^(LEVELS?|LVL|L)$/.test(w))) { var ra = Math.min(+rg[1], +rg[2]), rb = Math.max(+rg[1], +rg[2]); toks.push({ k: 'lvlr', a: ra, b: rb, label: 'Levels ' + ra + '–' + rb, src: /^(LEVELS?|LVL|L)$/.test(w) ? two : parts[i] }); i += /^(LEVELS?|LVL|L)$/.test(w) ? 2 : 1; continue; }
      if ((m = /^L0*(\d{1,3})$/.exec(w)) && /^(-|–|TO)$/.test(nx) && /^L?0*\d{1,3}$/.test(U(parts[i + 2] || ''))) { var rc = +U(parts[i + 2]).replace(/^L0*/, ''), r1 = Math.min(+m[1], rc), r2 = Math.max(+m[1], rc); toks.push({ k: 'lvlr', a: r1, b: r2, label: 'Levels ' + r1 + '–' + r2, src: parts.slice(i, i + 3).join(' ') }); i += 3; continue; }
      if (w === 'TIER' && /^\d$/.test(nx)) { toks.push({ k: 'tier', n: +nx, label: 'Tier ' + nx, src: two }); i += 2; continue; }
      if ((m = /^TIER(\d)$/.exec(w))) { toks.push({ k: 'tier', n: +m[1], label: 'Tier ' + m[1], src: parts[i] }); i++; continue; }
      if (w === 'TYPE' && /^[A-Z]\d?$/.test(nx)) { toks.push({ k: 'tl', v: nx, re: new RegExp('\\bTYPE\\s*' + nx[0] + (nx[1] ? '\\s*' + nx[1] : '') + '\\s*(\\(|$)'), label: 'Type ' + nx, src: two }); i += 2; continue; }
      if (STOP[w]) { i++; continue; }
      if ((w === 'NOT' || w === 'UN') && /^MODEL(L)?ED$/.test(nx)) { toks.push({ k: 'st', v: 'nomodel', label: STATUS_LABEL.nomodel, src: two }); i += 2; continue; }
      if (/^(LEVEL|LVL)$/.test(w) && /^\d+$/.test(nx)) { toks.push({ k: 'lvl', n: +nx, label: 'Level ' + (+nx), src: two }); i += 2; continue; }
      if ((m = /^L(?:EVEL)?0*(\d+)$/.exec(w))) { toks.push({ k: 'lvl', n: +m[1], label: 'Level ' + (+m[1]), src: parts[i] }); i++; continue; }
      if (/^(GF|GR|GROUND)$/.test(w)) { toks.push({ k: 'lvlc', v: ['GF', 'GR', '00'], word: 'GROUND', label: 'Ground', src: parts[i] }); i++; continue; }
      if (/^(RF|ROOF)$/.test(w)) { toks.push({ k: 'lvlc', v: ['RF'], word: 'ROOF', label: 'Roof', src: parts[i] }); i++; continue; }
      if ((m = /^B(\d)$/.exec(w))) { toks.push({ k: 'lvlc', v: ['B' + m[1], 'B0' + m[1]], word: 'BASEMENT ' + m[1], label: 'Basement ' + m[1], src: parts[i] }); i++; continue; }
      // "Res 2" / "Res.1" / "Akala 2" = that tower; "1BR", "2 BR", "3 bed", "studio" = bedrooms
      if (/^(RES|RES\.|AKALA)$/.test(w) && /^\d$/.test(nx)) { toks.push({ k: 'bld', v: 'T' + nx, label: 'Tower ' + nx, src: two }); i += 2; continue; }
      if ((m = /^RES\.?(\d)$/.exec(w))) { toks.push({ k: 'bld', v: 'T' + m[1], label: 'Tower ' + m[1], src: parts[i] }); i++; continue; }
      if ((m = /^(\d)-?(BR|BED|BEDS|BEDROOMS?)$/.exec(w))) { toks.push({ k: 'bed', n: +m[1], label: m[1] + ' bedroom', src: parts[i] }); i++; continue; }
      if (/^\d$/.test(w) && /^(BR|BED|BEDS|BEDROOMS?)$/.test(nx)) { toks.push({ k: 'bed', n: +w, label: w + ' bedroom', src: two }); i += 2; continue; }
      if (/^STUDIOS?$/.test(w)) { toks.push({ k: 'bed', n: 0, label: 'Studio', src: parts[i] }); i++; continue; }
      var al = ALIAS[w] || w;
      if (al === 'SERVICED') { toks.push({ k: 'cls', v: 'SV', label: 'Serviced apartments', src: parts[i] }); i++; continue; }
      if (al === 'HOTEL') { toks.push({ k: 'cls', v: 'HT', label: 'Hotel', src: parts[i] }); i++; continue; }
      if (al === 'RESIDENTIAL') { toks.push({ k: 'cls', v: 'RES', label: 'Residential (not serviced)', src: parts[i] }); i++; continue; }
      if (w === 'NOT' && (nx === 'SENT' || nx === 'SUBMITTED')) { toks.push({ k: 'st', v: 'unsent', label: 'Not sent', src: two }); i += 2; continue; }
      if (w === 'NO' && (nx === 'MODEL' || nx === 'TYPOLOGY')) { var sv = nx === 'MODEL' ? 'nomodel' : 'notypo'; toks.push({ k: 'st', v: sv, label: STATUS_LABEL[sv], src: two }); i += 2; continue; }
      if (STATUS[w]) { toks.push({ k: 'st', v: STATUS[w], label: STATUS_LABEL[STATUS[w]], src: parts[i] }); i++; continue; }
      if (SHOW[w]) { toks.push({ k: 'show', v: SHOW[w], label: 'Show ' + SHOW[w].replace('typos', 'typologies'), src: parts[i] }); i++; continue; }
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
    if (WORDS[t.k]) return WORDS[t.k](d, t);
    if (t.k === 'show') return true;
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
    var structured = toks.some(function (t) { return t.k !== 'text' && t.k !== 'show'; }), inDr = new Set(dr.map(function (d) { return d.key; }));
    var viaDr = function (list) { return list.filter(function (x) { return x.drawings.some(function (d) { return inDr.has(d.key); }); }); };
    var typos = structured ? viaDr(IX.typos) : words.length ? IX.typos.filter(function (t) { return hit([t.name, Object.keys(t.blds).join(' '), Object.keys(t.models).join(' ')].join(' ').toUpperCase()); }) : [];
    var models = structured ? viaDr(IX.models) : words.length ? IX.models.filter(function (m) { return hit([m.num, m.name, m.typ, bldName(m.tower), m.loc].join(' ').toUpperCase()); }) : [];
    var bt = toks.filter(function (t) { return t.k === 'bld'; })[0];
    var tcode = function (x) { x = U(x); var mm = /(?:^|\b)(?:TOWER|TOW|RES|T)\s*\.?\s*(\d)\b/.exec(x); return mm ? 'T' + mm[1] : x; };
    var mTower = function (m) { return tcode(m.tower) || (String(m.num).split('-')[2] || ''); };
    if (structured && bt) {
      // a model belongs to a tower by its own Tower (model list) or its number (…-T1-…), not only through drawings
      var onlyB = toks.every(function (t) { return t.k === 'bld' || t.k === 'show'; });
      var own = IX.models.filter(function (m) { return mTower(m) === bt.v || U(String(m.num).split('-')[2]) === bt.v; });
      models = (onlyB ? own : models.filter(function (m) { return !m.tower || mTower(m) === bt.v || m.drawings.every(function (d) { return U(d.bld) === bt.v; }); }))
        .concat(onlyB ? models.filter(function (m) { return own.indexOf(m) < 0 && mTower(m) === bt.v; }) : []);
    }
    var show = (toks.filter(function (t) { return t.k === 'show'; })[0] || {}).v || '';
    return {
      drawings: show && show !== 'drawings' ? [] : dr, miss: [], pq: pq, show: show,
      typos: show && show !== 'typos' ? [] : typos,
      models: show && show !== 'models' ? [] : models,
      lists: words.length && !show ? L.lists.filter(function (l) { return hit(U(l.name)); }) : []
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
      '<span class="lid">▦ Typology</span><span class="ltt">' + esc(t.name) + '<small>' + esc(Object.keys(t.blds).join(', ')) + arrLine(t.name) + '</small></span><span class="ltags"><span class="lt">' + t.drawings.length + ' drawings</span>' +
      (Object.keys(t.models).length ? '<span class="lt">' + esc(Object.keys(t.models).slice(0, 2).join(', ')) + '</span>' : '') + '</span></div>';
  }
  function arrLine(name) {
    var a = AR(), u = a && a.byTypo[name]; if (!u) return '';
    return esc(' · ' + (u.levelsText ? 'L' + u.levelsText.replace(/, /g, ', L') : 'not placed') + ' · ' + u.units + ' units' + (u.tiers.length ? ' · ' + u.tiers.join(', ') : '') + (/SERVIC/i.test(u.cls.join()) ? ' · serviced' : ''));
  }
  /* the level box: "L5" / "L10-L20" / "tier 2" → the floors, their floor models and the units on them (from the arrangement) */
  function levelBox(r) {
    var a = AR(); if (!a || r.pq.mode !== 'words') return '';
    var toks = r.pq.toks, lt = toks.filter(function (t) { return t.k === 'lvl' || t.k === 'lvlr'; })[0], tt = toks.filter(function (t) { return t.k === 'tier'; })[0];
    if (!lt && !tt) return '';
    var bt = toks.filter(function (t) { return t.k === 'bld'; }).map(function (t) { return t.v; });
    var only = toks.every(function (t) { return t.k === 'lvl' || t.k === 'lvlr' || t.k === 'tier' || t.k === 'bld' || t.k === 'show'; });
    var okTypo = {}; r.typos.forEach(function (t) { okTypo[t.name] = 1; }); r.drawings.forEach(function (d) { if (d.typ) okTypo[d.typ.name] = 1; });
    var inLv = function (c) { if (!/^\d+$/.test(c)) return false; var n = +c; return !lt || (lt.k === 'lvl' ? n === lt.n : n >= lt.a && n <= lt.b); };
    var blds = {}; a.levels.forEach(function (l) { if ((!bt.length || bt.indexOf(l.b) > -1) && inLv(l.code) && (!tt || l.tier === 'Tier ' + tt.n)) (blds[l.b] = blds[l.b] || []).push(l); });
    var bs = Object.keys(blds).sort(); if (!bs.length) return '<div class="lvbox box"><b>🏢 ' + esc(lt ? lt.label : tt.label) + '</b> <span class="hint">— not in the arrangement' + (bt.length ? ' for ' + esc(bt.join(', ')) : '') + '</span></div>';
    var body = bs.map(function (b) {
      var lv = blds[b], codes = lv.map(function (l) { return l.code; }), fm = {};
      lv.forEach(function (l) { var k = l.fmName || l.fm || l.type; (fm[k] = fm[k] || { l: l, c: [] }).c.push(l.code); });
      var us = a.units.filter(function (u) { return u.b === b && (only || (u.typ && okTypo[u.typ])) && codes.some(function (c) { return u.lv[c]; }); }).map(function (u) {
        var n = 0, f = 0; codes.forEach(function (c) { if (u.lv[c]) { n += u.lv[c]; f++; } }); return { u: u, n: n, f: f };
      }).sort(function (x, y) { return x.u.name.localeCompare(y.u.name, undefined, { numeric: true }); });
      var total = us.reduce(function (s, x) { return s + x.n; }, 0);
      return '<div class="lvb"><div class="lvh"><b>' + esc(bldName(b)) + '</b><span class="hint">' + (codes.length === 1 ? 'L' + esc(codes[0]) : A.plural(codes.length, 'level') + ' (' + esc(a.compress(codes)) + ')') + ' · ' + A.plural(us.length, 'unit type') + ' · ' + A.plural(total, 'unit') + '</span></div>' +
        '<div class="lvfm">' + Object.keys(fm).map(function (k) { var x = fm[k]; return '<span class="lt" title="' + esc(x.l.fm || '') + '">' + esc((x.l.fmName || x.l.fm || x.l.type || '—') + (x.l.tier ? ' · ' + x.l.tier : '')) + (codes.length > 1 ? ' · ' + esc(a.compress(x.c)) : '') + '</span>'; }).join('') + '</div>' +
        '<div class="lvu">' + (us.map(function (x) {
          var sv = /SERVIC/i.test(x.u.cls.join()), ht = /HOTEL/i.test(x.u.cls.join());
          return '<button type="button" class="lvc' + (sv ? ' sv' : ht ? ' ht' : '') + '"' + (x.u.typ ? ' data-act="lkopen" data-ref="' + esc('ty:' + x.u.typ) + '" title="' + esc(x.u.typ) + '"' : ' title="Not in the MIDP"') + '><b>' + esc(x.u.name) + '</b> ×' + x.n + (codes.length > 1 ? ' <i>' + x.f + ' fl</i>' : '') + (x.u.typ ? '' : ' <i class="bad">no MIDP</i>') + '</button>';
        }).join('') || '<span class="hint">No units on these floors</span>') + '</div></div>';
    }).join('');
    return '<div class="lvbox box"><div class="lvh"><b>🏢 ' + esc([lt && lt.label, tt && tt.label].filter(Boolean).join(' · ')) + '</b><span class="hint">from the Model arrangement' + (only ? '' : ' · only units matching your other words') + ' · click a unit for its drawings</span></div>' + body + '</div>';
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
  function cmpKeys() { var a = AR(); if (!a) return []; var out = []; P.sel.forEach(function (ref) { if (ref.indexOf('ty:') === 0 && a.byTypo[ref.slice(3)]) out.push(a.byTypo[ref.slice(3)].key); }); return out.slice(0, 4); }
  function selBar() {
    if (!P.sel.size) return '';
    var man = L.lists.filter(function (l) { return l.kind !== 'search'; });
    return '<div class="lsel"><b>' + P.sel.size + '</b> picked <select id="lkTo"><option value="">Add to list…</option>' + man.map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join('') + '<option value="_new">+ New list…</option></select>' +
      (cmpKeys().length >= 2 ? '<button class="lbtn" type="button" data-act="lkcmp" title="Side by side: levels, tier, floor models, drawings">⚖ Compare ' + cmpKeys().length + '</button>' : '') +
      '<button class="lbtn" type="button" data-act="lkclear">Clear</button></div>';
  }

  /* ---------- 🧩 Search logic: ready-made searches ("recipes") — written in the same words you type ----------
     A new idea = one more line here (and a note in UPDATES). Nothing else changes. */
  var PACK = '1.1';
  var UPDATES = [
    { v: '1.1', d: '2026-11-04', t: 'Uses the Model arrangement (Files › 🏢 Arrangement): levels now find unit drawings too (L5 = every unit on Level 5), level ranges (L10-L20, levels 10-20, L10 to L20), tier 2, “Type A”, serviced / hotel from the stacking, “not modelled”. A level box shows the floors, floor models and units. Unit cards show levels, tier and floor models. Tick 2–4 typologies → ⚖ Compare.' },
    { v: '1.0', d: '2026-11-03', t: 'First search pack: towers, levels, types, typologies, bedrooms (1BR, studio), serviced / hotel / residential, status (late, due, sent, not sent, no model, suggested), show models / typologies / drawings, “Res 2” and spelling slips like “servced”.' }
  ];
  var RECIPES = [
    { id: 't1models', name: 'Tower 1 — models', q: 'T1 models', d: 'Every model used by Tower 1 drawings' },
    { id: 't2models', name: 'Tower 2 — models', q: 'T2 models', d: 'Every model used by Tower 2 drawings' },
    { id: 't1', name: 'Tower 1 — all drawings', q: 'T1', d: 'Drawings whose number has T1' },
    { id: 't2', name: 'Tower 2 — all drawings', q: 'T2', d: 'Drawings whose number has T2' },
    { id: 'bed1', name: '1-bedroom units', q: '1BR typologies', d: 'Unit types with “1 BR” (all towers)' },
    { id: 'bed2t2', name: '2-bedroom drawings, Tower 2', q: 'T2 2BR', d: 'Drawings of 2-bedroom units in Tower 2' },
    { id: 'bed3', name: '3-bedroom units', q: '3BR typologies', d: 'Unit types with “3 BR”' },
    { id: 'studio', name: 'Studios', q: 'studio typologies', d: 'Unit types with “STUDIO”' },
    { id: 'sv', name: 'Serviced apartments', q: 'serviced typologies', d: 'Unit types marked SV / serviced' },
    { id: 'svdr', name: 'Serviced apartment drawings', q: 'serviced', d: 'Every drawing of a serviced unit' },
    { id: 'hotel', name: 'Hotel rooms & suites', q: 'hotel typologies', d: 'Hotel units: suites, king / twin rooms, HT units' },
    { id: 'res', name: 'Residential units (not serviced)', q: 'residential typologies', d: 'UNIT TYPE … without SV' },
    { id: 'lv5', name: 'Everything on Level 5', q: 'L5', d: 'The floor, its floor model and every unit on it (needs the Model arrangement)' },
    { id: 'svt2', name: 'Serviced apartments, Tower 2', q: 'T2 serviced typologies', d: 'Serviced unit types in Tower 2 with their levels' },
    { id: 'rng', name: 'Type A units, Levels 10–20', q: 'L10-L20 Type A typologies', d: 'Unit types “Type A” on any floor from 10 to 20' },
    { id: 'tier2', name: 'Tier 2 unit types', q: 'tier 2 typologies', d: 'Unit types on Tier 2 floors' },
    { id: 'notmod', name: 'Unit types not modelled yet', q: 'units not modelled yet', d: 'Unit types with drawings that have no model' },
    { id: 'latel8', name: 'Late drawings on Level 8', q: 'late drawings on L8', d: 'Late drawings of units on Level 8 (or level 8 in the number)' },
    { id: 'late', name: 'Late drawings', q: 'late', d: 'Past a stage date and not sent since' },
    { id: 'soon', name: 'Due soon', q: 'soon', d: 'Next stage date within your “due soon” days' },
    { id: 'unsent', name: 'Never sent', q: 'not sent', d: 'No submission yet' },
    { id: 'nomodel', name: 'No model yet', q: 'no model', d: 'Drawings without an assigned or suggested model' },
    { id: 'sugg', name: 'Suggested models to confirm', q: 'suggested', d: 'A model is only suggested — confirm it' }
  ];
  var WORD_HELP = [
    ['Tower / building', 'T1 · Tower 2 · Res 2 · PD', 'Drawings of that building (from the number)'],
    ['Level', 'L3 · Level 12 · GF · RF · B1', 'That level (from the number, the title, or the units placed on it in the Model arrangement)'],
    ['Level range', 'L10-L20 · levels 10-20 · L10 to L20', 'Any floor in that range'],
    ['Tier', 'tier 2 · tier2', 'Units on that tier (Model arrangement) or “Tier 2” in the title'],
    ['Unit letter', 'Type A · Type B1', 'Typologies of that type letter (not A1 when you ask for A)'],
    ['Drawing type', 'PLN · SEC · DET · DRG', 'The type code in the number'],
    ['Bedrooms', '1BR · 2 BR · 3 bed · studio', 'Unit types with that many bedrooms'],
    ['Unit class', 'serviced · hotel · residential', 'SV units · hotel rooms / suites · UNIT TYPE without SV'],
    ['Status', 'late · soon · sent · not sent · no model / not modelled · suggested', 'Delivery and model status'],
    ['Show', 'models · typologies · drawings', 'Show only that kind of result'],
    ['Ignored words', 'yet · on · in · of · the · and · with · all', 'So you can type a sentence: “late drawings on L8”'],
    ['Anything else', '1BR-A · 10100 · ceiling', 'Searched in the number, title, typology, model, lists…'],
    ['A list of numbers', 'paste 2+ drawing numbers', 'Exactly those drawings, in that order (revision ignored)']
  ];
  function count(q) { var r = search(q, ''); return r.show === 'models' ? r.models.length + ' models' : r.show === 'typos' ? r.typos.length + ' unit types' : r.drawings.length + ' drawings'; }
  A.VIEWS.logic = function () {
    if (!IX) build();
    var saved = L.lists.filter(function (l) { return l.kind === 'search'; });
    var row = function (x, own) {
      var pin = P.pins.indexOf(x.id) > -1;
      return '<tr><td><b>' + esc(x.name) + '</b><div class="hint">' + esc(x.d || '') + '</div></td><td class="mono">' + esc(x.q) + '</td><td>' + esc(count(x.q)) + '</td>' +
        '<td class="lg-acts"><button class="btn small primary" type="button" data-act="lgrun" data-v="' + esc(x.q) + '">Run</button>' +
        (own ? '' : '<button class="btn small" type="button" data-act="lgpin" data-v="' + esc(x.id) + '" title="Show it on the Lookup start screen">' + (pin ? '📌 Pinned' : 'Pin') + '</button>') + '</td></tr>';
    };
    return '<div class="lg"><div class="box lg-box"><div class="sec-h"><h2>🧩 Ready-made searches</h2><span class="hint">Search pack ' + PACK + ' · each one is just words you could type yourself</span></div>' +
      '<table class="lg-t"><thead><tr><th>Search</th><th>Words</th><th>Now</th><th></th></tr></thead><tbody>' + RECIPES.map(function (x) { return row(x); }).join('') + '</tbody></table></div>' +
      '<div class="box lg-box"><div class="sec-h"><h2>⚡ Your own searches</h2><span class="hint">Any search → “⚡ Save as list” in Lookup</span></div>' +
      (saved.length ? '<table class="lg-t"><tbody>' + saved.map(function (l) { return row({ id: l.id, name: l.name, q: l.q, d: 'Saved ' + (l.created ? new Date(l.created).toLocaleDateString() : '') }, true); }).join('') + '</tbody></table>' : '<p class="hint">None yet.</p>') + '</div>' +
      '<div class="box lg-box"><div class="sec-h"><h2>🔤 Words the search understands</h2><span class="hint">Mix them: <span class="mono">T2 2BR serviced late</span></span></div>' +
      '<table class="lg-t"><thead><tr><th>Kind</th><th>Examples</th><th>Finds</th></tr></thead><tbody>' + WORD_HELP.map(function (w) { return '<tr><td><b>' + esc(w[0]) + '</b></td><td class="mono">' + esc(w[1]) + '</td><td>' + esc(w[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="box lg-box"><div class="sec-h"><h2>🆕 Updates</h2><span class="hint">Have an idea? Describe the search you want — it is added as a new pack version</span></div>' +
      UPDATES.slice().reverse().map(function (u) { return '<p><b>Pack ' + esc(u.v) + '</b> <span class="hint">' + esc(u.d) + '</span><br>' + esc(u.t) + '</p>'; }).join('') + '</div></div>';
  };

  /* ---------- results: list or cards, Excel, copy, print ---------- */
  function resultBar(r) {
    var n = r.drawings.length;
    if (!n && !r.models.length && !r.typos.length) return '';
    return '<div class="lres"><span class="hint">' + [n && A.plural(n, 'drawing'), r.typos.length && A.plural(r.typos.length, 'unit type'), r.models.length && A.plural(r.models.length, 'model')].filter(Boolean).join(' · ') + '</span>' +
      '<span class="grow"></span><span class="lvm"><button type="button" class="lc' + (P.vm !== 'cards' ? ' on' : '') + '" data-act="lkvm" data-v="list">≡ List</button><button type="button" class="lc' + (P.vm === 'cards' ? ' on' : '') + '" data-act="lkvm" data-v="cards">▦ Cards</button></span>' +
      '<button class="lbtn" type="button" data-act="lkxl">⬇ Excel</button><button class="lbtn" type="button" data-act="lkcopy">📋 Copy</button><button class="lbtn" type="button" data-act="lkprint">🖨 Print</button></div>';
  }
  function dCard(d) {
    var ref = 'd:' + d.key, on = P.sel.has(ref);
    return '<div class="lcard' + (on ? ' on' : '') + '" data-act="lkopen" data-ref="' + esc(ref) + '"><input type="checkbox" data-lpick="' + esc(ref) + '"' + (on ? ' checked' : '') + ' aria-label="Pick">' +
      '<b class="mono">' + esc(String(d.num).replace(/-+$/, '')) + '</b><span>' + esc(d.title) + '</span>' +
      '<span class="hint">' + esc([bldName(d.bld), d.typ ? d.typ.name : '', d.model ? d.model.name + (d.model.sure ? '' : ' ?') : 'no model'].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="ltags">' + (d.rev ? '<span class="lt rv">' + esc(d.rev) + '</span>' : '') + sentTag(d) + '</span></div>';
  }
  function resultRows(r) {
    var out = r.drawings.map(function (d) { return { Kind: 'Drawing', Number: String(d.num).replace(/-+$/, ''), Title: d.title, Tower: bldName(d.bld), Level: lvlName(d.lvl), Type: d.type, Typology: d.typ ? d.typ.name : '', Model: d.model ? d.model.name : '', 'Model number': d.model ? d.model.num : '', 'Last submission': d.last ? d.last.label : '', Due: d.due }; });
    var a = AR();
    r.typos.forEach(function (t) { var u = a && a.byTypo[t.name]; out.push({ Kind: 'Unit type', Number: '', Title: t.name, Tower: Object.keys(t.blds).join(', '), Typology: t.name, Model: Object.keys(t.models).join(', '), Drawings: t.drawings.length,
      Levels: u ? u.levelsText : '', Floors: u ? u.floors : '', Units: u ? u.units : '', Class: u ? u.cls.join(', ') : '', Tier: u ? u.tiers.join(', ') : '' }); });
    r.models.forEach(function (m) { out.push({ Kind: 'Model', Number: m.num, Title: m.name, Tower: bldName(m.tower), Typology: m.typ, Model: m.name, 'Model number': m.num, Drawings: m.drawings.length, Sent: m.sent }); });
    return out;
  }

  function ttmFound() {
    if (!IX) build();
    var exact = new Map(), byB = new Map(), out = [], seen = {};
    IX.drawings.forEach(function (d) { exact.set(N(String(d.num).replace(/-+$/, '')), d); if (!byB.has(baseN(d.num))) byB.set(baseN(d.num), d); });
    (P.ttm.match(/[A-Z0-9]{2,}(?:-[A-Z0-9]+){3,}-?/gi) || []).forEach(function (n) { var d = exact.get(N(String(n).replace(/-+$/, ''))) || byB.get(baseN(n)); if (d && !seen[d.key]) { seen[d.key] = 1; out.push(d); } });
    return out;
  }
  /* ---------- Tower & Model: paste a list → Tower · Typology · Model of each line ---------- */
  A.VIEWS.ttm = function () {
    if (!IX) build();
    var nums = (P.ttm.match(/[A-Z0-9]{2,}(?:-[A-Z0-9]+){3,}-?/gi) || []), rows = [], exact = new Map(), byB = new Map();
    IX.drawings.forEach(function (d) { exact.set(N(String(d.num).replace(/-+$/, '')), d); if (!byB.has(baseN(d.num))) byB.set(baseN(d.num), d); });
    nums.forEach(function (n, i) { rows.push({ i: i + 1, n: n, d: exact.get(N(String(n).replace(/-+$/, ''))) || byB.get(baseN(n)) || null }); });
    var found = rows.filter(function (x) { return x.d; }), need = found.filter(function (x) { return !x.d.typ || !x.d.model || !x.d.model.sure; });
    var h = '<div class="box tt-box"><div class="sec-h"><h2>🏢 Tower · Typology · Model of a list</h2><span class="hint">Paste drawing numbers (from the MIDP, an email, Excel) — the revision is ignored</span></div>' +
      '<textarea id="ttmText" rows="5" placeholder="Paste drawing numbers here" style="width:100%">' + esc(P.ttm) + '</textarea>' +
      '<div class="toolbar" style="margin:6px 0 0"><span class="hint">' + rows.length + ' numbers · <b>' + found.length + '</b> found' + (rows.length - found.length ? ' · <b style="color:var(--bad)">' + (rows.length - found.length) + ' not in this MIDP</b>' : '') + (need.length ? ' · ' + need.length + ' to check' : '') + '</span>' +
      '<span class="grow"></span>' + (need.some(function (x) { return x.d.model && !x.d.model.sure; }) ? '<button class="btn small" type="button" data-act="ttmacc">✓ Accept suggested models</button>' : '') +
      (found.length ? '<button class="btn small" type="button" data-act="ttmxl">⬇ Excel</button><button class="btn small" type="button" data-act="ttmlist">📌 Make a list</button>' : '') +
      (P.ttm ? '<button class="btn small" type="button" data-act="ttmclr">Clear</button>' : '') + '</div></div>';
    if (!rows.length) return h + '<div class="box empty"><b>Paste a list above</b>Each line gets its Tower, Typology and Model from the MIDP Checker. Missing ones are flagged — fix them once with ✎ and they are kept (and in ⬇ Export assignments).</div>';
    h += '<div class="tw"><table class="grid tt-t"><thead><tr><th>#</th><th>Number (pasted)</th><th>Title</th><th>Tower</th><th>Typology</th><th>Model</th><th></th></tr></thead><tbody>' + rows.map(function (x) {
      var d = x.d;
      if (!d) return '<tr><td>' + x.i + '</td><td class="mono">' + esc(x.n) + '</td><td colspan="5"><span class="tag c-bad">Not in this MIDP</span></td></tr>';
      return '<tr><td>' + x.i + '</td><td class="mono"><a href="#" class="num-link" data-act="detail" data-key="' + esc(d.key) + '">' + esc(x.n) + '</a></td><td>' + esc(d.title) + '</td><td>' + esc(bldName(d.bld)) + '</td>' +
        '<td>' + (d.typ ? esc(d.typ.name) + (d.typ.guess ? ' <span class="tag c-warn">guess</span>' : '') : '<span class="tag c-bad">missing</span>') + '</td>' +
        '<td>' + (d.model ? esc(d.model.name) + (d.model.sure ? '' : ' <span class="tag c-warn">suggested</span>') : '<span class="tag c-bad">missing</span>') + '</td>' +
        '<td><button class="btn small" type="button" data-act="ttmfix" data-v="' + esc(d.key) + '" title="Set Tower / Typology / Model">✎</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  };

  /* ---------- 🔍 Lookup ---------- */
  A.VIEWS.lookup = function () {
    if (!IX) build();
    var r = search(P.q, P.chip), q = P.q.trim(), active = q || P.chip || builderActive();
    var h = '<div class="lk"><div class="lk-main"><div class="lsearch"><input type="search" id="lkQ" placeholder="T1 L3 PLN · 1BR-A · 10100 · or paste drawing numbers" value="' + esc(P.q) + '" autocomplete="off" autofocus></div>' +
      builderHtml();
    if (r.pq.mode === 'words' && r.pq.toks.length)
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
        '<div><h4>📌 Pinned searches</h4>' + RECIPES.filter(function (x) { return P.pins.indexOf(x.id) > -1; }).map(function (x) { return '<button type="button" class="lc" data-act="lgrun" data-v="' + esc(x.q) + '">' + esc(x.name) + '</button>'; }).join('') +
          '<button type="button" class="lc" data-go="logic">🧩 All searches…</button></div>' +
        (saved.length ? '<div><h4>Saved searches</h4>' + saved.map(function (l) { return '<button type="button" class="lc" data-act="lsopen" data-v="' + l.id + '">⚡ ' + esc(l.name) + '</button>'; }).join('') + '</div>' : '') +
        g.slice(0, 3).map(function (x) {
          return '<div><h4>' + esc(x.title) + '</h4>' + x.items.slice(0, 14).map(function (it) { return '<button type="button" class="lc" data-act="lsopen" data-v="' + esc(it.id) + '">' + esc(it.name) + ' <i>' + it.rows.length + '</i></button>'; }).join('') + '</div>';
        }).join('') + '<p class="lhint">Type <b>T1 L3 PLN</b>, <b>T2 2BR</b>, <b>serviced</b>, <b>T1 models</b>, <b>late</b>, a typology like <b>1BR-A</b>, part of a number like <b>10100</b> — or paste a list of drawing numbers. All the words: 🧩 Search logic.</p></div>';
    } else if (!r.drawings.length && !r.typos.length && !r.models.length && !r.lists.length) h += '<div class="lempty">Nothing found — remove a chip above or use fewer words.</div>';
    else h += resultBar(r) + levelBox(r) + group('Lists', r.lists, function (l) { return '<div class="lrow" data-act="lsopen" data-v="' + l.id + '"><span class="lid">📌 List</span><span class="ltt">' + esc(l.name) + '</span><span class="ltags"><span class="lt">' + members(l).length + ' drawings</span></span></div>'; }, 5, 'l') +
      (P.vm === 'cards' ? (r.drawings.length ? '<section class="lgroup"><h3><span>Drawings <b>' + r.drawings.length + '</b></span></h3><div class="lcards">' + r.drawings.slice(0, P.all_d ? 5000 : 60).map(dCard).join('') + '</div>' + (r.drawings.length > 60 && !P.all_d ? '<button class="lbtn" type="button" data-act="lkall" data-v="d">Show all</button>' : '') + '</section>' : '')
        : group('Drawings', r.drawings, dRow, 12, 'd')) + group('Typologies', r.typos, tRow, r.show === 'typos' ? 200 : 5, 't') + group('Models', r.models, mRow, r.show === 'models' ? 200 : 5, 'm');
    return h + '</div>' + listChips() + '</div>' + panelHtml();
  };

  /* small panel for a typology or a model */
  function panelHtml() {
    if (!P.panel || !IX) return '';
    var t = P.panel.slice(0, P.panel.indexOf(':')), v = P.panel.slice(P.panel.indexOf(':') + 1), title = '', kv = '', rows = [];
    if (t === 'ty') { var ty = IX.typos.find(function (x) { return x.name === v; }); if (!ty) return ''; title = ty.name; rows = ty.drawings; kv = '<dt>Building</dt><dd>' + esc(Object.keys(ty.blds).join(', ')) + '</dd><dt>Models</dt><dd>' + esc(Object.keys(ty.models).join(', ') || '—') + '</dd>';
      var au = (AR() || { byTypo: {} }).byTypo[ty.name], late = rows.filter(function (d) { return d.due === 'overdue'; }).length;
      kv += '<dt>Sent</dt><dd>' + rows.filter(function (d) { return d.sends; }).length + ' of ' + rows.length + (late ? ' · <b style="color:var(--bad)">' + late + ' late</b>' : '') + '</dd>';
      if (au) kv += '<dt class="lpa">🏢 Stacking</dt><dd class="lpa"><b>' + esc(au.name) + '</b> · ' + esc(au.cls.join(', ') || '—') + '</dd>' +
        '<dt>Levels</dt><dd>' + esc(au.levelsText ? 'L' + au.levelsText.replace(/, /g, ', L') : 'not placed') + '</dd><dt>Floors · units</dt><dd>' + au.floors + ' floors · ' + au.units + ' units' + (au.per.length ? ' · ' + esc(au.per.join(' / ')) + ' per floor' : '') + '</dd>' +
        '<dt>Tier</dt><dd>' + esc(au.tiers.join(', ') || '—') + '</dd><dt>Floor models</dt><dd>' + (au.fms.map(function (f) { return esc(f.name || f.num) + ' <span class="hint">L' + esc(f.text) + '</span>'; }).join('<br>') || '—') + '</dd>' +
        (au.model ? '<dt>Typology model</dt><dd class="mono">' + esc(au.model) + '</dd>' : '');
      else if (AR()) kv += '<dt>🏢 Stacking</dt><dd class="hint">Not matched in the Model arrangement</dd>';
    }
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
    // the stacking view: run a search without showing it · make a list
    search: function (q) { if (!IX) build(); var r = search(q, ''); return { drawings: r.drawings, typos: r.typos.map(function (t) { return t.name; }), toks: r.pq.toks || [] }; },
    makeList: function (name, refs) { var l = newList(name, refs); P.open = l.id; saveUI(); A.go('lists'); return l; },
    summary: function () { return summary(); },               // Delegation reads it live (also when the browser storage is full)
    lookupLists: function () { return L.lists; },
    saveLists: function () { saveLists(); },
    lookFor: function (q) { P.q = q; P.chip = ''; P.f = {}; addRecent(q); saveUI(); A.go('lookup'); },
    // each typology with the buildings of its drawings (Model arrangement check)
    typos: function () {
      if (!IX) build(); if (!IX) return [];
      return IX.typos.map(function (t) {
        var b = {}; t.drawings.forEach(function (d) { b[d.bld] = (b[d.bld] || 0) + 1; });
        return { name: t.name, blds: b, n: t.drawings.length, models: Object.keys(t.models), sent: t.drawings.filter(function (d) { return d.sends; }).length, late: t.drawings.filter(function (d) { return d.due === 'overdue'; }).length, soon: t.drawings.filter(function (d) { return d.due === 'soon'; }).length, nomodel: t.drawings.filter(function (d) { return !d.model; }).length };
      });
    },
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
      document.body.setAttribute('data-grp', g);            // the section colour (readable 8-bit skins)
      document.querySelectorAll('.gtab').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-v') === g)); });
      document.querySelectorAll('#subTabs .tab').forEach(function (b) { b.hidden = b.getAttribute('data-grp') !== g; });
      var sub = document.getElementById('subTabs'); if (sub) sub.hidden = GROUPS[g].length < 2;
      var cnt = function (k) { var el = document.querySelector('[data-count="' + k + '"]'); return el ? el.textContent : ''; };
      [['gn-subs', 'chase'], ['gn-changes', 'changes'], ['gn-more', 'checks']].forEach(function (x) {
        var el = document.getElementById(x[0]); if (!el) return; var c = +cnt(x[1]) || 0; el.textContent = c ? c : ''; el.hidden = !c;
      });
      // a view that does not exist yet stays hidden (its tab appears once the module that draws it is loaded)
      document.querySelectorAll('#subTabs .tab').forEach(function (b) { if (!A.VIEWS[b.getAttribute('data-go')]) b.hidden = true; });
      if (sub) sub.hidden = Array.prototype.filter.call(sub.querySelectorAll('.tab'), function (b) { return !b.hidden; }).length < 2;
    }
  };
  function groupOf(v) { var g = 'lookup'; Object.keys(GROUPS).forEach(function (k) { if (GROUPS[k].indexOf(v) > -1) g = k; }); return g; }

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
    lgrun: function (el) { P.q = el.getAttribute('data-v'); P.chip = ''; P.f = {}; addRecent(P.q); saveUI(); A.go('lookup'); },
    lgpin: function (el) { var id = el.getAttribute('data-v'), i = P.pins.indexOf(id); if (i > -1) P.pins.splice(i, 1); else P.pins.push(id); saveUI(); rerender(); },
    lkvm: function (el) { P.vm = el.getAttribute('data-v'); saveUI(); rerender(); },
    lkxl: function () {
      var rows = resultRows(search(P.q, P.chip)); if (!rows.length) return;
      var wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(rows); ws['!autofilter'] = { ref: ws['!ref'] };
      XLSX.utils.book_append_sheet(wb, ws, 'Lookup'); XLSX.writeFile(wb, 'Lookup_' + (P.q || 'search').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40) + '_' + T.todayIso() + '.xlsx');
    },
    lkcopy: function () {
      var rows = resultRows(search(P.q, P.chip)), keys = rows.length ? Object.keys(rows[0]) : [];
      var txt = [keys.join('\t')].concat(rows.map(function (o) { return keys.map(function (k) { return o[k] == null ? '' : o[k]; }).join('\t'); })).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { A.toast('📋 Copied ' + rows.length + ' lines — paste in Excel or an email'); }, function () { A.toast('Could not copy — use ⬇ Excel'); });
    },
    lkprint: function () {
      var rows = resultRows(search(P.q, P.chip)), keys = ['Kind', 'Number', 'Title', 'Tower', 'Typology', 'Model'];
      var w = window.open('', '_blank'); if (!w) { A.toast('Allow pop-ups to print'); return; }
      w.document.write('<!doctype html><meta charset="utf-8"><title>Lookup — ' + esc(P.q) + '</title><style>body{font:12px Arial,sans-serif;margin:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee}h1{font-size:16px}</style>' +
        '<h1>Lookup: ' + esc(P.q || '(all)') + '</h1><p>' + rows.length + ' lines · ' + esc(new Date().toLocaleString()) + '</p><table><tr>' + keys.map(function (k) { return '<th>' + k + '</th>'; }).join('') + '</tr>' +
        rows.map(function (o) { return '<tr>' + keys.map(function (k) { return '<td>' + esc(o[k] == null ? '' : o[k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table><script>print()<\/script>');
      w.document.close();
    },
    ttmclr: function () { P.ttm = ''; saveUI(); rerender(); },
    ttmacc: function () {
      var n = 0; ttmFound().forEach(function (d) { if (d.model && !d.model.sure) { var m = T.findModel(S.mix, d.model.num); if (m) { A.applyModel(d.key, m, true); n++; } } });
      A.saveStore(); A.compute(); rerender(); A.toast('✓ ' + A.plural(n, 'suggested model') + ' accepted');
    },
    ttmxl: function () {
      var rows = ttmFound().map(function (d) { return { Number: String(d.num).replace(/-+$/, ''), Title: d.title, Tower: bldName(d.bld), Typology: d.typ ? d.typ.name : '', 'Typology from': d.typ ? d.typ.src : '', Model: d.model ? d.model.name : '', 'Model number': d.model ? d.model.num : '', 'Model is': d.model ? (d.model.sure ? 'Assigned' : 'Suggested') : 'Missing' }; });
      var wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(rows); ws['!autofilter'] = { ref: ws['!ref'] };
      XLSX.utils.book_append_sheet(wb, ws, 'Tower Typology Model'); XLSX.writeFile(wb, 'Tower_Typology_Model_' + T.todayIso() + '.xlsx');
    },
    ttmlist: function () { var nm = askName('List ' + T.todayIso()); if (!nm) return; var l = newList(nm, ttmFound().map(function (d) { return 'd:' + d.key; })); P.open = l.id; saveUI(); A.go('lists'); },
    ttmfix: function (el) {
      var d = IX.byKey.get(el.getAttribute('data-v')); if (!d) return;
      var r = A.rowByKey(d.key), v = r ? r.v : {};
      A.openDialog('<h2 id="dlgH">✎ Tower / Typology / Model</h2><p class="hint" style="margin-top:0"><span class="mono">' + esc(d.num) + '</span><br>' + esc(d.title) + '</p>' +
        '<datalist id="ttTy">' + IX.typos.map(function (t) { return '<option value="' + esc(t.name) + '">'; }).join('') + '</datalist><datalist id="ttMo">' + (S.store.models || []).map(function (m) { return '<option value="' + esc(m.num) + '" label="' + esc(m.name) + '">'; }).join('') + '</datalist>' +
        '<div class="row"><label class="field"><span>Tower</span><input type="text" id="ttTw" value="' + esc(v.Tower || '') + '" placeholder="' + esc(d.bld || '') + '"></label>' +
        '<label class="field" style="flex:1"><span>Typology</span><input type="text" id="ttTyp" list="ttTy" value="' + esc(v.Typology || '') + '" placeholder="' + esc(d.typ ? d.typ.name : '') + '"></label></div>' +
        '<div class="row"><label class="field" style="flex:1"><span>Model number</span><input type="text" id="ttMod" list="ttMo" value="' + esc(v['Model Number'] || '') + '" placeholder="' + esc(d.model ? d.model.num + (d.model.sure ? '' : ' (suggested)') : '') + '"></label></div>' +
        '<p class="hint">Saved in the Tracker — shows everywhere and in ⬇ Export assignments.</p>' +
        '<div class="acts"><button class="btn" type="button" data-act="dlgclose">Cancel</button><button class="btn primary" type="button" data-act="ttmsave" data-v="' + esc(d.key) + '">Save</button></div>');
    },
    ttmsave: function (el) {
      var k = el.getAttribute('data-v'), g = function (id) { return T.txt(document.getElementById(id).value); };
      var tw = g('ttTw'), ty = g('ttTyp'), mo = g('ttMod');
      if (mo) { var m = T.findModel(S.mix, mo); if (m) A.applyModel(k, m, true); else A.setVal(k, 'Model Number', mo, true); }
      if (tw) A.setVal(k, 'Tower', tw, true); if (ty) A.setVal(k, 'Typology', ty, true);
      A.saveStore(); A.compute(); A.closeDialog(); rerender(); A.toast('Saved');
    },
    lkclear: function () { P.sel.clear(); rerender(); },
    lkopen: function (el, e) {
      if (e && e.target && (e.target.tagName === 'INPUT' || e.target.closest('.lx'))) return;
      var ref = el.getAttribute('data-ref');
      addRecent(P.q);
      if (ref.indexOf('d:') === 0) A.openDetail(ref.slice(2)); else { P.panel = ref; rerender(); }
    },
    lkpclose: function () { P.panel = ''; rerender(); },
    lkcmp: function () { if (MIDP_EXT.arrCompare) MIDP_EXT.arrCompare(cmpKeys()); },
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
  var ttT = null;
  document.addEventListener('input', function (e) {
    if (e.target.id === 'ttmText') { clearTimeout(ttT); var t = e.target.value; ttT = setTimeout(function () { P.ttm = t; saveUI(); rerender(); }, 400); return; }
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
  var css2 = document.createElement('style');
  css2.textContent = '.lg{display:grid;gap:12px;min-width:0}.lg-box{padding:12px;min-width:0;overflow-x:auto}.lg-t td{word-break:break-word}.tt-box{min-width:0}.lg-t{width:100%;border-collapse:collapse}.lg-t td,.lg-t th{padding:6px 8px;border-bottom:1px solid var(--edge);text-align:left;vertical-align:top;font-size:13px}.lg-acts{white-space:nowrap}.lg-acts .btn{margin-left:4px}' +
    '.lres{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.lres .grow{flex:1}.lvm{display:inline-flex;gap:4px}' +
    '.lcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}.lcard{display:grid;gap:3px;padding:8px 10px;border:1px solid var(--edge);background:var(--panel);cursor:pointer;font-size:13px;position:relative}.lcard input{position:absolute;right:6px;top:6px}.lcard.on{outline:2px solid var(--accent)}.lcard:hover{background:var(--raise)}' +
    '.lvbox{padding:10px 12px;margin:6px 0 10px;display:grid;gap:10px;min-width:0}.lvh{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}.lvb{display:grid;gap:6px;border-left:4px solid var(--info);padding-left:10px;min-width:0}' +
    '.lvfm,.lvu{display:flex;flex-wrap:wrap;gap:5px}.lvfm .lt{white-space:normal}.lvc{font:inherit;font-size:12.5px;padding:3px 9px;border:1px solid var(--edge);background:var(--panel);color:var(--ink);cursor:pointer;border-radius:99px}' +
    '.lvc:hover{border-color:var(--info)}.lvc.sv{border-color:var(--info);background:color-mix(in srgb,var(--info) 12%,var(--panel))}.lvc.ht{border-color:var(--odd);background:color-mix(in srgb,var(--odd) 12%,var(--panel))}.lvc i{font-style:normal;color:var(--muted)}.lvc i.bad{color:var(--bad)}' +
    '.lpa{border-top:1px solid var(--edge);padding-top:6px;margin-top:4px}' +
    '.tt-box{padding:12px;margin-bottom:10px}.tt-t{width:100%}.tt-t td,.tt-t th{padding:5px 8px;font-size:13px;text-align:left;vertical-align:top}';
  document.head.appendChild(css2);
};
