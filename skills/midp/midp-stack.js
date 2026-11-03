/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-stack.js — 🏙 Stacking view (MIDP Checker, Phase 3)
   ───────────────────────────────────────────────────────────────────
   Each building drawn floor by floor from the Model arrangement
   (Files › 🏢 Arrangement): one box per unit, South façade → North.
   • Colour by: typology · delivery (sent / due / late) · model
     (assigned or missing) · a search (lit up).
   • Click a unit: where else it is, its drawings and status.
   • Click a floor number: that floor (floor model, units, drawings).
     Shift-click another floor (or pick From / To) = a range of floors.
   • A range → 🔍 its drawings · 📌 a list (then To Do / Delegation /
     Excel from the list) · ⇶ straight to Delegation (inside the tracker).
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_STACK = function (A) {
  'use strict';
  var S = A.S, esc = A.esc;
  var UKEY = 'tidp-checker:stackui';
  var UI = Object.assign({ b: '', mode: 'typ', q: '', fm: true }, A.readJSON(UKEY, {}));
  UI.sel = null; UI.unit = '';
  function saveUI() { A.writeJSON(UKEY, { b: UI.b, mode: UI.mode, q: UI.q, fm: UI.fm }); }
  function ext() { return window.MIDP_EXT || {}; }
  function lvlNum(c) { var m = /^(\d+)$/.exec(c); if (m) return +m[1]; if (c === 'GF') return 0; m = /^B(\d+)$/.exec(c); if (m) return -(+m[1]); if (c === 'RF') return 999; return null; }
  function bName(b) { return b === 'PD' ? 'Podium' : /^T\d+$/.test(b) ? 'Tower ' + b.slice(1) : b; }
  // short box labels: "KING SUITE A" → "KING A", "HT STUDIO B" → "HT ST B" (full name on hover)
  function short(n) {
    return String(n).toUpperCase().replace(/ADA KING S\.?\s*RM/, 'ADA').replace(/TWINS?\.?\s*RM/, 'TWIN').replace(/\bSUITE\b\s*/g, '').replace(/\bSTUDIO\b/g, 'ST')
      .replace(/PRESIDENTIAL/, 'PRES').replace(/EXECUTIVE/, 'EXEC').replace(/SUPERIOR/, 'SUP').replace(/LUXURY/, 'LUX').replace(/\s+/g, ' ').trim() || n;
  }
  function N(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  /* ---------- colours ---------- */
  function dark() { return document.body.getAttribute('data-mode') !== 'light'; }
  function hue(i) { return Math.round((i * 137.508 + 200) % 360); }
  function typColour(i) { return dark() ? 'hsl(' + hue(i) + ' 45% 32%)' : 'hsl(' + hue(i) + ' 70% 82%)'; }
  var STATE = {
    late: ['Late', 'var(--bad)'], soon: ['Due soon', 'var(--warn)'], sent: ['All sent', 'var(--ok)'], part: ['Partly sent', 'var(--info)'], none: ['Not sent yet', 'var(--muted)'],
    mok: ['Modelled', 'var(--ok)'], mpart: ['Partly modelled', 'var(--warn)'], mnone: ['No model', 'var(--bad)'],
    hit: ['Matches the search', 'var(--accent, var(--info))'], nomidp: ['Not in the MIDP', 'transparent']
  };
  function tint(c) { return 'color-mix(in srgb,' + c + ' ' + (dark() ? 45 : 35) + '%, var(--panel))'; }

  /* ---------- data ---------- */
  function data() {
    var D = ext().arrangement ? ext().arrangement() : null, a = ext().arrUnits ? ext().arrUnits() : null;
    if (!D || !a) return null;
    var st = {}; (ext().typos ? ext().typos() : []).forEach(function (t) { st[t.name] = t; });
    var blds = {}; D.levels.forEach(function (l) { blds[l.b] = 1; }); D.place.forEach(function (p) { blds[p.b] = 1; });
    return { D: D, a: a, st: st, blds: Object.keys(blds).sort() };
  }
  function unitOf(X, b, name) { return X.a.byKey[b + ':' + N(name)] || null; }
  function delivery(t) {
    if (!t) return 'nomidp';
    if (t.late) return 'late'; if (t.soon) return 'soon'; if (t.n && t.sent >= t.n) return 'sent'; if (t.sent) return 'part'; return 'none';
  }
  function modelState(t) { if (!t) return 'nomidp'; return !t.nomodel ? 'mok' : t.nomodel >= t.n ? 'mnone' : 'mpart'; }
  var FIND = null;
  function findSet() {
    if (!UI.q.trim() || !ext().search) return null;
    if (FIND && FIND.q === UI.q) return FIND;
    var r = ext().search(UI.q), lt = r.toks.filter(function (t) { return t.k === 'lvl' || t.k === 'lvlr'; })[0], tt = r.toks.filter(function (t) { return t.k === 'tier'; })[0];
    var only = r.toks.length && r.toks.every(function (t) { return t.k === 'lvl' || t.k === 'lvlr' || t.k === 'tier' || t.k === 'bld' || t.k === 'show'; });
    var ty = {}; r.typos.forEach(function (n) { ty[n] = 1; }); r.drawings.forEach(function (d) { if (d.typ) ty[d.typ.name] = 1; });
    FIND = { q: UI.q, ty: ty, only: only, n: r.drawings.length, lvl: function (c, l) {
      var n = lvlNum(c);
      if (lt && (n == null || (lt.k === 'lvl' ? n !== lt.n : n < lt.a || n > lt.b))) return false;
      if (tt && (!l || l.tier !== 'Tier ' + tt.n)) return false;
      return true;
    } };
    return FIND;
  }

  /* ---------- drawing a building ---------- */
  function cellOf(X, b, l, x, colours) {
    var u = unitOf(X, b, x.name), t = u && u.typ ? X.st[u.typ] : null, bg = '', cls = 'sk-u', tag = '';
    if (UI.mode === 'typ') bg = colours[N(x.name)] || 'var(--raise)';
    else if (UI.mode === 'del') { var k = delivery(t); bg = k === 'nomidp' ? '' : tint(STATE[k][1]); tag = k; }
    else if (UI.mode === 'mod') { var m = modelState(t); bg = m === 'nomidp' ? '' : tint(STATE[m][1]); tag = m; }
    else if (UI.mode === 'find') {
      var f = findSet(), on = f && u && (f.only ? true : !!(u.typ && f.ty[u.typ])) && f.lvl(l.code, l);
      if (!f) { /* nothing typed yet */ } else if (on) { bg = tint(STATE.hit[1]); cls += ' hit'; } else cls += ' dim';
    }
    if (!u || !u.typ) cls += ' nomidp';
    if (u && /SERVIC/i.test(u.cls.join())) cls += ' sv';
    if (u && /HOTEL/i.test(u.cls.join())) cls += ' ht';
    if (UI.unit && UI.unit === b + ':' + N(x.name)) cls += ' pick';
    return '<button type="button" class="' + cls + '" data-act="skunit" data-v="' + esc(b + ':' + N(x.name)) + '"' + (bg ? ' style="background:' + bg + '"' : '') +
      ' title="' + esc(x.name + ' · L' + l.code + (x.pos ? ' · ' + x.pos : '') + (u && u.typ ? ' · ' + u.typ : ' · not in the MIDP') + (tag && STATE[tag] ? ' · ' + STATE[tag][0] : '')) + '">' + esc(short(x.name)) + '</button>';
  }
  function building(X, b) {
    var lv = X.D.levels.filter(function (l) { return l.b === b; }).slice().sort(function (p, q) { return (lvlNum(q.code) == null ? -1e4 : lvlNum(q.code)) - (lvlNum(p.code) == null ? -1e4 : lvlNum(p.code)); });
    var names = {}; X.a.units.forEach(function (u) { if (u.b === b) names[N(u.name)] = u.name; });
    var keys = Object.keys(names).sort(function (p, q) { return names[p].localeCompare(names[q], undefined, { numeric: true }); }), colours = {};
    keys.forEach(function (k, i) { colours[k] = typColour(i); });
    var sel = UI.sel && UI.sel.b === b ? UI.sel : null, tier = null, h = '';
    lv.forEach(function (l) {
      if (l.tier && l.tier !== tier && !/TECHNICAL/i.test(l.type)) { tier = l.tier; h += '<div class="sk-tier">' + esc(l.tier) + '</div>'; }
      var units = ext().arrLayout ? ext().arrLayout(b, l.code) : [], n = lvlNum(l.code);
      var on = sel && n != null && n >= sel.a && n <= sel.z;
      var south = units.filter(function (x) { return !/^N/.test(x.pos); }), north = units.filter(function (x) { return /^N/.test(x.pos); });
      h += '<div class="sk-row' + (on ? ' sel' : '') + (units.length ? '' : ' empty') + '">' +
        '<button type="button" class="sk-l" data-act="skfloor" data-b="' + esc(b) + '" data-v="' + esc(l.code) + '" title="Click: this floor · Shift-click: a range of floors">L' + esc(l.code) + '</button>' +
        '<div class="sk-units">' + (units.length ? south.map(function (x) { return cellOf(X, b, l, x, colours); }).join('') + (north.length && south.length ? '<i class="sk-gap"></i>' : '') + north.map(function (x) { return cellOf(X, b, l, x, colours); }).join('')
          : '<span class="sk-band">' + esc(l.name && !/^Level \d+$/.test(l.name) ? l.name : l.type || '') + '</span>') + '</div>' +
        (UI.fm ? '<span class="sk-fm" title="' + esc(l.fm || '') + '">' + esc(l.fmName || l.fm || '') + '</span>' : '') + '</div>';
    });
    var legend = UI.mode === 'typ' ? keys.map(function (k) { var u = X.a.byKey[b + ':' + k]; return '<button type="button" class="sk-k' + (UI.unit === b + ':' + k ? ' pick' : '') + '" data-act="skunit" data-v="' + esc(b + ':' + k) + '"><i style="background:' + colours[k] + '"></i>' + esc(names[k]) + (u && u.typ ? '' : ' <em>no MIDP</em>') + '</button>'; }).join('')
      : (UI.mode === 'del' ? ['late', 'soon', 'part', 'sent', 'none'] : UI.mode === 'mod' ? ['mnone', 'mpart', 'mok'] : ['hit']).map(function (k) { return '<span class="sk-k"><i style="background:' + tint(STATE[k][1]) + '"></i>' + STATE[k][0] + '</span>'; }).join('') +
        '<span class="sk-k"><i class="sk-hatch"></i>Not in the MIDP</span>';
    return '<div class="box sk-b"><div class="sk-head"><b>' + esc(bName(b)) + '</b><span class="hint">South façade ← → North façade · ' + lv.length + ' levels</span></div>' +
      '<div class="sk-grid">' + h + '</div><div class="sk-legend">' + legend + '<span class="sk-k"><i class="sk-svm"></i>Serviced</span><span class="sk-k"><i class="sk-htm"></i>Hotel</span></div></div>';
  }

  /* ---------- the side panel: a unit, a floor or a range ---------- */
  function floorsIn(X, b, a, z) { return X.D.levels.filter(function (l) { var n = lvlNum(l.code); return l.b === b && n != null && n >= a && n <= z; }); }
  function rangeQ(sel) { return sel.b + ' ' + (sel.a === sel.z ? 'L' + sel.a : 'L' + sel.a + '-L' + sel.z); }
  function panel(X) {
    if (UI.unit) {
      var u = X.a.byKey[UI.unit]; if (!u) return '';
      var t = u.typ ? X.st[u.typ] : null, d = delivery(t);
      return '<aside class="box sk-p"><div class="sec-h"><h2 style="margin:0">' + esc(u.b) + ' · ' + esc(u.name) + '</h2><button class="btn small" type="button" data-act="skclose">✕</button></div>' +
        '<dl class="kv"><dt>MIDP typology</dt><dd>' + (u.typ ? esc(u.typ) : '<span class="tag c-bad">not in the MIDP</span>') + '</dd><dt>Class</dt><dd>' + esc(u.cls.join(', ') || '—') + '</dd>' +
        '<dt>Levels</dt><dd>' + esc(u.levelsText ? 'L' + u.levelsText.replace(/, /g, ', L') : '—') + '</dd><dt>Floors · units</dt><dd>' + u.floors + ' · ' + u.units + '</dd><dt>Tier</dt><dd>' + esc(u.tiers.join(', ') || '—') + '</dd>' +
        '<dt>Floor models</dt><dd>' + (u.fms.map(function (f) { return esc(f.name || f.num) + ' <span class="hint">L' + esc(f.text) + '</span>'; }).join('<br>') || '—') + '</dd>' +
        (t ? '<dt>Drawings</dt><dd>' + t.n + ' · ' + t.sent + ' sent' + (t.late ? ' · <b style="color:var(--bad)">' + t.late + ' late</b>' : '') + (t.soon ? ' · ' + t.soon + ' due soon' : '') + '</dd><dt>Model</dt><dd>' + (t.nomodel ? t.nomodel + ' of ' + t.n + ' without a model' : 'All modelled') + '</dd>' : '') + '</dl>' +
        '<p class="hint">Outlined in the stacking: every floor it is on.</p>' +
        (u.typ ? '<div class="toolbar"><button class="btn small primary" type="button" data-act="sklook" data-v="' + esc(u.typ) + '">🔍 Its drawings</button></div>' : '') + '</aside>';
    }
    var sel = UI.sel; if (!sel) return '';
    var fl = floorsIn(X, sel.b, sel.a, sel.z), codes = fl.map(function (l) { return l.code; }), cnt = {};
    codes.forEach(function (c) { (ext().arrLayout ? ext().arrLayout(sel.b, c) : []).forEach(function (x) { var k = N(x.name); (cnt[k] = cnt[k] || { name: x.name, n: 0, f: {} }).n++; cnt[k].f[c] = 1; }); });
    var us = Object.keys(cnt).map(function (k) { return cnt[k]; }).sort(function (p, q) { return p.name.localeCompare(q.name, undefined, { numeric: true }); });
    var dr = ext().search ? ext().search(rangeQ(sel)).drawings : [], late = dr.filter(function (d) { return d.due === 'overdue'; }).length, sent = dr.filter(function (d) { return d.sends; }).length;
    var one = sel.a === sel.z ? fl[0] : null, inTracker = false;
    try { inTracker = window.parent !== window && window.parent.LT && window.parent.LT.isOn && window.parent.LT.isOn('delegate'); } catch (e) {}
    return '<aside class="box sk-p"><div class="sec-h"><h2 style="margin:0">' + esc(bName(sel.b)) + ' · ' + (one ? 'L' + esc(one.code) : 'L' + sel.a + '–L' + sel.z) + '</h2><button class="btn small" type="button" data-act="skclose">✕</button></div>' +
      '<dl class="kv">' + (one ? '<dt>Floor</dt><dd>' + esc(one.name || '') + ' · ' + esc(one.type || '') + '</dd><dt>Tier</dt><dd>' + esc(one.tier || '—') + '</dd><dt>Floor model</dt><dd>' + esc(one.fmName || '—') + (one.fm ? '<br><span class="mono hint">' + esc(one.fm) + '</span>' : '') + '</dd>' + (one.h !== '' && one.h != null ? '<dt>Floor to floor</dt><dd>' + esc(one.h) + ' m</dd>' : '')
        : '<dt>Floors</dt><dd>' + fl.length + '</dd>') +
      '<dt>Units</dt><dd>' + us.reduce(function (s, x) { return s + x.n; }, 0) + ' · ' + A.plural(us.length, 'unit type') + '</dd><dt>Drawings</dt><dd>' + dr.length + ' · ' + sent + ' sent' + (late ? ' · <b style="color:var(--bad)">' + late + ' late</b>' : '') + '</dd></dl>' +
      '<div class="sk-pu">' + us.map(function (x) { var u = unitOf(X, sel.b, x.name); return '<button type="button" class="lvc" data-act="skunit" data-v="' + esc(sel.b + ':' + N(x.name)) + '"><b>' + esc(x.name) + '</b> ×' + x.n + (one ? '' : ' <i>' + Object.keys(x.f).length + ' fl</i>') + (u && u.typ ? '' : ' <i class="bad">no MIDP</i>') + '</button>'; }).join('') + '</div>' +
      '<div class="toolbar sk-acts"><button class="btn small primary" type="button" data-act="sklook" data-v="' + esc(rangeQ(sel)) + '">🔍 Drawings</button>' +
      '<button class="btn small" type="button" data-act="sklist"' + (dr.length ? '' : ' disabled') + ' title="A list of these drawings — then To Do, Delegation or Excel from the list">📌 Make a list</button>' +
      (inTracker ? '<button class="btn small" type="button" data-act="skdeleg"' + (dr.length ? '' : ' disabled') + '>⇶ To Delegation</button>' : '') + '</div>' +
      '<p class="hint">Shift-click another floor number to make a range' + (one ? '' : ' · or pick From / To above') + '.</p></aside>';
  }

  /* ---------- the view ---------- */
  A.VIEWS.stack = function () {
    var X = data();
    if (!X) return '<div class="box empty"><b>🏙 Stacking view</b>Load the Model arrangement first (Files › 🏢 Arrangement — the architect’s stacking file or the standard form). Each tower is then drawn floor by floor here.<div class="toolbar" style="justify-content:center;margin-top:10px"><button class="btn primary" type="button" data-go="arr">🏢 Go to Arrangement</button></div></div>';
    if (!UI.b || (UI.b !== '*' && X.blds.indexOf(UI.b) < 0)) UI.b = X.blds[0];
    var shown = UI.b === '*' ? X.blds : [UI.b];
    var modes = [['typ', 'Typology'], ['del', 'Delivery'], ['mod', 'Model'], ['find', 'Search']];
    var nums = X.D.levels.filter(function (l) { return shown.indexOf(l.b) > -1; }).map(function (l) { return lvlNum(l.code); }).filter(function (n) { return n != null && n !== 999; });
    var opts = function (v) { var o = {}; nums.forEach(function (n) { o[n] = 1; }); return Object.keys(o).map(Number).sort(function (a, b) { return a - b; }).map(function (n) { return '<option value="' + n + '"' + (v === n ? ' selected' : '') + '>L' + (n < 10 ? '0' + n : n) + '</option>'; }).join(''); };
    var h = '<div class="box sk-bar"><div class="toolbar" style="margin:0;flex-wrap:wrap">' +
      X.blds.concat(X.blds.length > 1 ? ['*'] : []).map(function (b) { return '<button class="btn small' + (UI.b === b ? ' primary' : '') + '" type="button" data-act="skb" data-v="' + b + '">' + (b === '*' ? 'All side by side' : esc(bName(b))) + '</button>'; }).join('') +
      '<span class="grow"></span><span class="hint">Colour by</span>' + modes.map(function (m) { return '<button class="btn small' + (UI.mode === m[0] ? ' primary' : '') + '" type="button" data-act="skmode" data-v="' + m[0] + '">' + m[1] + '</button>'; }).join('') +
      '<label class="hint sk-chk"><input type="checkbox" id="skFm"' + (UI.fm ? ' checked' : '') + '> Floor models</label></div>' +
      (UI.mode === 'find' ? '<div class="toolbar" style="margin:8px 0 0"><input type="search" id="skQ" placeholder="serviced · 2BR · Type A · late · L10-L20 · tier 2 · no model…" value="' + esc(UI.q) + '" style="flex:1;min-width:200px">' +
        (findSet() ? '<span class="hint">' + A.plural(findSet().n, 'drawing') + ' match — their units are lit up</span>' : '') + '</div>' : '') +
      (UI.b !== '*' ? '<div class="toolbar" style="margin:8px 0 0"><span class="hint">Floors</span><select id="skFrom"><option value="">From…</option>' + opts(UI.sel && UI.sel.b === UI.b ? UI.sel.a : null) + '</select><select id="skTo"><option value="">To…</option>' + opts(UI.sel && UI.sel.b === UI.b ? UI.sel.z : null) + '</select>' +
        (UI.sel ? '<button class="btn small" type="button" data-act="skclose">Clear</button>' : '') + '<span class="hint">or click a floor number (Shift-click for a range)</span></div>' : '') + '</div>';
    h += '<div class="sk-wrap' + (UI.b === '*' ? ' all' : '') + '"><div class="sk-towers">' + shown.map(function (b) { return building(X, b); }).join('') + '</div>' + panel(X) + '</div>';
    return h;
  };

  /* ---------- clicks ---------- */
  Object.assign(A.ACTIONS, {
    skb: function (el) { UI.b = el.getAttribute('data-v'); UI.sel = null; UI.unit = ''; saveUI(); A.render(); },
    skmode: function (el) { UI.mode = el.getAttribute('data-v'); saveUI(); A.render(); if (UI.mode === 'find') setTimeout(function () { var q = document.getElementById('skQ'); if (q) q.focus(); }, 0); },
    skunit: function (el) { var v = el.getAttribute('data-v'); UI.unit = UI.unit === v ? '' : v; A.render(); },
    skfloor: function (el, e) {
      var b = el.getAttribute('data-b'), n = lvlNum(el.getAttribute('data-v')); if (n == null) return;
      UI.unit = '';
      if (e && e.shiftKey && UI.sel && UI.sel.b === b) { var a0 = UI.sel.anchor != null ? UI.sel.anchor : UI.sel.a; UI.sel = { b: b, a: Math.min(a0, n), z: Math.max(a0, n), anchor: a0 }; }
      else UI.sel = UI.sel && UI.sel.b === b && UI.sel.a === n && UI.sel.z === n ? null : { b: b, a: n, z: n, anchor: n };
      A.render();
    },
    skclose: function () { UI.sel = null; UI.unit = ''; A.render(); },
    sklook: function (el) { if (ext().lookFor) ext().lookFor(el.getAttribute('data-v')); },
    sklist: function () {
      if (!UI.sel || !ext().search) return; var q = rangeQ(UI.sel), dr = ext().search(q).drawings; if (!dr.length) return;
      ext().makeList(bName(UI.sel.b) + ' ' + (UI.sel.a === UI.sel.z ? 'L' + UI.sel.a : 'L' + UI.sel.a + '–L' + UI.sel.z), dr.map(function (d) { return 'd:' + d.key; }));
      A.toast('📌 List made — ' + A.plural(dr.length, 'drawing') + '. Use its buttons for To Do, Delegation or Excel.');
    },
    skdeleg: function () {
      if (!UI.sel) return; var LT = window.parent.LT; if (!LT || !LT.ctx) return;
      var name = bName(UI.sel.b) + ' ' + (UI.sel.a === UI.sel.z ? 'L' + UI.sel.a : 'L' + UI.sel.a + '–L' + UI.sel.z), dr = ext().search(rangeQ(UI.sel)).drawings;
      var group = prompt('Delegation group for this task', name); if (group === null) return;
      LT.ctx.sendToDelegation([{ title: name + ' — drawings', notes: 'From the MIDP Checker stacking view', subs: dr.slice(0, 300).map(function (d) { return { title: d.num + ' — ' + d.title }; }) }], group.trim() || name);
    }
  });
  var qT = null;
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'skQ') return;
    clearTimeout(qT); var v = e.target.value;
    qT = setTimeout(function () { UI.q = v; FIND = null; saveUI(); var pos = e.target.selectionStart; A.render(); var q = document.getElementById('skQ'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {} } }, 300);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'skFm') { UI.fm = el.checked; saveUI(); A.render(); }
    if (el.id === 'skFrom' || el.id === 'skTo') {
      var f = document.getElementById('skFrom').value, t = document.getElementById('skTo').value;
      if (f === '' && t === '') return;
      var a = f === '' ? +t : +f, z = t === '' ? +f : +t;
      UI.unit = ''; UI.sel = { b: UI.b, a: Math.min(a, z), z: Math.max(a, z), anchor: Math.min(a, z) }; A.render();
    }
  });
  var e0 = window.MIDP_EXT || (window.MIDP_EXT = {}), prev = e0.afterCompute;
  e0.afterCompute = function () { if (prev) prev(); FIND = null; };

  var css = document.createElement('style');
  css.textContent = '.sk-bar{padding:10px 12px;margin-bottom:10px}.sk-chk{display:inline-flex;gap:4px;align-items:center}' +
    '.sk-wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px;align-items:start}.sk-wrap.all .sk-towers{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:12px}' +
    '.sk-towers{min-width:0;display:grid;gap:12px}.sk-b{padding:10px 12px;min-width:0;overflow-x:auto}.sk-head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px}' +
    '.sk-grid{display:grid;gap:2px;min-width:420px}.sk-tier{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:6px 0 2px 52px}' +
    '.sk-row{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:6px;align-items:stretch}.sk-row.sel .sk-l{background:var(--info);color:var(--panel)}.sk-row.sel .sk-units{outline:2px solid var(--info);outline-offset:1px}' +
    '.sk-l{font:600 11.5px var(--mono,monospace);border:1px solid var(--edge);background:var(--panel);color:var(--ink);cursor:pointer;padding:2px 0}.sk-l:hover{border-color:var(--info)}' +
    '.sk-units{display:flex;gap:2px;min-width:0}.sk-gap{flex:0 0 8px}.sk-band{flex:1;font-size:11px;color:var(--muted);background:repeating-linear-gradient(45deg,transparent 0 6px,color-mix(in srgb,var(--muted) 18%,transparent) 6px 8px);padding:3px 8px;text-transform:uppercase;letter-spacing:.05em}' +
    '.sk-u{flex:1 1 0;min-width:0;font:600 10.5px/1.15 var(--ui,inherit);padding:4px 2px;border:1px solid color-mix(in srgb,var(--edge) 80%,transparent);background:var(--raise);color:var(--ink);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;position:relative}' +
    '.sk-u:hover{outline:2px solid var(--ink);z-index:1}.sk-u.pick{outline:2px solid var(--ink);outline-offset:-1px;z-index:1;box-shadow:inset 0 0 0 2px var(--panel)}.sk-u.dim{opacity:.28}.sk-u.hit{font-weight:800}' +
    '.sk-u.nomidp,.sk-hatch{background-image:repeating-linear-gradient(135deg,transparent 0 4px,color-mix(in srgb,var(--bad) 35%,transparent) 4px 6px)!important}' +
    '.sk-u.sv::after,.sk-svm::after{content:"";position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:var(--info)}.sk-u.ht::after,.sk-htm::after{content:"";position:absolute;top:2px;right:2px;width:6px;height:6px;background:var(--odd)}' +
    '.sk-fm{font-size:11px;color:var(--muted);white-space:nowrap;align-self:center;max-width:170px;overflow:hidden;text-overflow:ellipsis}' +
    '.sk-legend{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:10px;font-size:12px}.sk-k{display:inline-flex;align-items:center;gap:5px;border:0;background:none;color:var(--ink);font:inherit;cursor:pointer;padding:1px 2px}.sk-k.pick{outline:2px solid var(--ink)}' +
    '.sk-k i{display:inline-block;width:14px;height:14px;border:1px solid var(--edge);position:relative}.sk-k em{font-style:normal;color:var(--bad);font-size:11px}' +
    '.sk-p{position:sticky;top:8px;padding:12px;max-height:calc(100vh - 24px);overflow:auto}.sk-pu{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.sk-acts{flex-wrap:wrap}' +
    '@media(max-width:900px){.sk-wrap{grid-template-columns:1fr}.sk-p{position:static;max-height:none;order:-1}.sk-fm{display:none}.sk-row{grid-template-columns:40px minmax(0,1fr)}.sk-wrap.all .sk-towers{grid-template-columns:1fr}}';
  document.head.appendChild(css);
};
