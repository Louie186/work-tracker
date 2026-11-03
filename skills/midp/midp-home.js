/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-home.js — 📊 Overview (MIDP Checker)
   ───────────────────────────────────────────────────────────────────
   One clean page: a card per goal, each opening its tab.
     Changes · Due & late · Next submissions · Drawing sets ·
     Tower / Typology / Model · Issues
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_HOME = function (A) {
  'use strict';
  var S = A.S, T = A.T, esc = A.esc;
  function nice(iso) { return A.fmtDay(iso, true); }

  function nextStages() {                       // upcoming stage dates in the MIDP, with how many drawings are due then
    var by = {};
    S.due.forEach(function (d) {
      if (!d || !d.next || d.nextSent === undefined) return;
      var k = d.next.iso + '|' + d.next.stage;
      by[k] = (by[k] || 0) + 1;
    });
    return Object.keys(by).sort().map(function (k) { var p = k.split('|'); return { iso: p[0], stage: p[1], n: by[k] }; });
  }
  function card(o) {
    return '<button class="box hm-card" type="button" data-go="' + o.go + '"' + (o.set ? ' data-set="' + esc(o.set) + '"' : '') + ' style="--c:' + o.c + '">' +
      '<span class="hm-ic">' + o.icon + '</span><span class="hm-t">' + esc(o.title) + '</span>' +
      '<span class="hm-v">' + o.v + '</span><span class="hm-s">' + o.s + '</span></button>';
  }

  A.VIEWS.overview = function () {
    var rows = S.built.rows, late = 0, soon = 0;
    S.due.forEach(function (d) { if (d.state === 'overdue') late++; else if (d.state === 'soon') soon++; });
    var c = S.cmp, nCh = c ? c.added.length + c.removed.length + c.revised.length + c.edited.length : null;
    var assignable = rows.filter(function (r) { return A.isAssignable(r); }), withModel = assignable.filter(function (r) { return A.mInfo(r).state === 'assigned'; }).length;
    var sets = window.MIDP_SETS_INFO ? MIDP_SETS_INFO() : [];
    var nx = nextStages(), issues = window.MIDP_ISSUES_COUNT ? MIDP_ISSUES_COUNT() : S.checks.length;
    var h = '<div class="hm-grid">' +
      card({ go: 'changes', icon: '🔄', c: 'var(--info)', title: 'Changes', v: c ? nCh : '—',
        s: c ? c.added.length + ' added · ' + c.removed.length + ' removed · ' + c.revised.length + ' revised · ' + c.edited.length + ' edited' : 'Load a newer MIDP — the last one is remembered' }) +
      card({ go: 'chase', icon: '⏰', c: late ? 'var(--bad)' : 'var(--ok)', title: 'Due & late', v: late + ' <small>late</small>', s: soon + ' due in the next ' + A.SET.soonDays + ' days' }) +
      card({ go: 'subs', icon: '📅', c: 'var(--accent)', title: 'Next submission', v: nx[0] ? esc(nice(nx[0].iso)) : '—',
        s: nx[0] ? esc(nx[0].stage) + ' · ' + A.plural(nx[0].n, 'drawing') : 'No future dates in this MIDP' }) +
      card({ go: 'folder', icon: '📦', c: 'var(--accent)', title: 'Drawing sets', v: sets.length || '—',
        s: sets.length ? sets.slice(0, 2).map(function (x) { return esc(x.name) + ': ' + x.ready + ' / ' + x.total + ' in folder'; }).join('<br>') : 'Make a set to check a folder against your lists' }) +
      card({ go: 'models', icon: '🏢', c: 'var(--ok)', title: 'Tower · Typology · Model', v: (assignable.length ? Math.round(withModel / assignable.length * 100) : 0) + '%',
        s: withModel + ' of ' + assignable.length + ' drawings have a model' }) +
      card({ go: 'checks', set: 'checks.kind=', icon: '⚠', c: 'var(--odd)', title: 'Issues', v: issues, s: 'typos, naming, dates to review' }) +
      '</div>';
    // the next few submission dates
    if (nx.length) h += '<div class="box hm-box"><div class="sec-h"><h2>Coming up</h2><span class="hint">From the stage dates in the MIDP</span></div><div class="hm-next">' +
      nx.slice(0, 6).map(function (x) {
        var d = T.daysBetween(S.today, x.iso);
        return '<div class="hm-row"><span class="mono">' + esc(nice(x.iso)) + '</span><span>' + esc(x.stage) + '</span><b>' + A.plural(x.n, 'drawing') + '</b><span class="hint">' + (d === 0 ? 'today' : 'in ' + d + ' days') + '</span></div>';
      }).join('') + '</div></div>';
    return h;
  };

  /* ---------- MIDP versions: a small record of every MIDP you load (number without revision → revision) ---------- */
  var VKEY = 'tidp-checker:versions', VERS = A.readJSON(VKEY, []);
  function U(x) { return String(x == null ? '' : x).toUpperCase().trim(); }
  function idOf(num) { return U(T.baseOf(num) || num).replace(/-$/, ''); }
  function snapshot() {
    if (!S.latest) return;
    var sig = S.latest.file + '|' + S.latest.items.length, last = VERS[VERS.length - 1];
    if (last && last.sig === sig) return;
    if (VERS.some(function (v) { return v.sig === sig; })) return;            // an older file loaded again: keep the record as it is
    var map = S.latest.items.filter(function (it) { return it.num; }).map(function (it) { return idOf(it.num) + '~' + (it.rev || ''); }).join(';');
    VERS.push({ sig: sig, file: S.latest.file, at: Date.now(), n: S.latest.items.length, map: map });
    if (VERS.length > 8) VERS = VERS.slice(-8);
    if (!A.writeJSON(VKEY, VERS)) { VERS = VERS.slice(-3); A.writeJSON(VKEY, VERS); }
  }
  var MAPS = {};
  function verMap(v) { if (!MAPS[v.sig]) { var m = {}; v.map.split(';').forEach(function (x) { var p = x.split('~'); if (p[0]) m[p[0]] = p[1] || ''; }); MAPS[v.sig] = m; } return MAPS[v.sig]; }

  /* ---------- 📍 the journey of one drawing: MIDP versions · submissions · stage dates · drawing sets ---------- */
  function journey(r) {
    var id = idOf(r.num), ev = [];
    var prevIn = false, prevRev = null;
    VERS.forEach(function (v, i) {
      var m = verMap(v), here = Object.prototype.hasOwnProperty.call(m, id), rev = here ? m[id] : null;
      var day = T.todayIso(new Date(v.at));
      if (here && !prevIn) ev.push({ d: day, ic: '➕', t: (i === 0 ? 'In ' : 'Added in ') + v.file + (rev ? ' (' + rev + ')' : '') });
      else if (here && prevIn && rev !== prevRev) ev.push({ d: day, ic: '🔁', t: 'Revised ' + (prevRev || '—') + ' → ' + (rev || '—') + ' in ' + v.file });
      else if (!here && prevIn) ev.push({ d: day, ic: '➖', t: 'Removed in ' + v.file });
      prevIn = here; prevRev = rev;
    });
    (S.subByKey.get(r.key) || []).forEach(function (x) { ev.push({ d: x.sub.date, ic: '📤', t: 'Sent in ' + A.subHead(x.sub) + (x.r.rev ? ' · rev ' + x.r.rev : '') }); });
    var it = A.itemsNow().filter(function (i) { return i.key === r.key; })[0], st = A.stagesNow(), today = S.today, due = S.due.get(r.key) || {};
    (it && it.dates || []).forEach(function (d, k) {
      if (!d || !d.iso || d.bad) return;
      var past = d.iso < today, name = st[k] ? st[k].name : 'Stage ' + (k + 1);
      ev.push({ d: d.iso, ic: past ? '🏁' : '📅', t: name + (past ? ' (stage date passed)' : ' — due'), future: !past, next: due.next && due.next.iso === d.iso });
    });
    var sets = window.MIDP_SETS_FOR ? MIDP_SETS_FOR(r.num) : [];
    ev.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    var h = '<h2 style="margin-top:16px">📍 Journey</h2>';
    if (!ev.length && !sets.length) return h + '<p class="hint">No history yet — it builds up as you load MIDPs and add submissions.</p>';
    h += '<div class="jr">' + ev.map(function (e) {
      return '<div class="jr-i' + (e.future ? ' fut' : '') + (e.next ? ' nx' : '') + '"><span class="mono">' + esc(A.fmtDay(e.d, true)) + '</span><span>' + e.ic + ' ' + esc(e.t) + (e.next ? ' <b>← next</b>' : '') + '</span></div>';
    }).join('') + '</div>';
    if (sets.length) h += '<p style="margin:8px 0 0"><b>📦 In drawing sets:</b> ' + sets.map(function (x) { return esc(x.name) + ' ' + (x.inFolder ? '<span class="tag c-ok">in folder</span>' : '<span class="tag c-bad">not in folder</span>') + (x.sent ? ' <span class="tag c-info">submitted</span>' : ''); }).join(' · ') + '</p>';
    return h;
  }
  var ext = window.MIDP_EXT || (window.MIDP_EXT = {}), prevDetail = ext.detailExtra, prevAfter = ext.afterCompute;
  ext.detailExtra = function (r) { return (prevDetail ? prevDetail(r) : '') + (r && r.num ? journey(r) : ''); };
  ext.afterCompute = function () { if (prevAfter) prevAfter(); try { snapshot(); } catch (e) { console.error(e); } };

  /* ---------- 🔄 Changes: which two MIDPs are compared, and the versions you loaded ---------- */
  var vChanges = A.VIEWS.changes;
  A.VIEWS.changes = function () {
    var h = '<div class="box hm-box"><div class="sec-h"><h2>🔄 ' + (S.prev ? 'Comparing <span class="mono">' + esc(S.prev.file) + '</span> → <span class="mono">' + esc(S.latest.file) + '</span>' : 'Changes') + '</h2>' +
      '<span class="hint">Load a newer MIDP in Files — the one you had becomes the “previous” by itself</span></div>' +
      (VERS.length ? '<div class="jr-v">' + VERS.slice().reverse().map(function (v) {
        return '<span class="tag ' + (S.latest && v.file === S.latest.file ? 'c-ok' : S.prev && v.file === S.prev.file ? 'c-info' : 'c-mute') + '">' + esc(v.file) + ' · ' + v.n + ' lines · ' + esc(A.fmtDay(T.todayIso(new Date(v.at)), true)) + '</span>';
      }).join(' ') + '</div>' : '') + '</div>';
    return h + vChanges.apply(this, arguments);
  };

  var css = document.createElement('style');
  css.textContent = '.hm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-bottom:14px}' +
    '.hm-card{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"ic t" "v v" "s s";gap:2px 8px;text-align:left;cursor:pointer;padding:14px;border-left:5px solid var(--c)}' +
    '.hm-card:hover{background:var(--raise)}.hm-ic{grid-area:ic;font-size:18px}.hm-t{grid-area:t;align-self:center;font-weight:700}.hm-v{grid-area:v;font-size:30px;font-weight:800;color:var(--c);line-height:1.1;margin-top:4px}.hm-v small{font-size:14px;font-weight:600}' +
    '.hm-s{grid-area:s;color:var(--muted);font-size:12.5px;line-height:1.4}.hm-box{padding:12px}.hm-next{display:grid;gap:4px}' +
    '.hm-row{display:grid;grid-template-columns:120px 1fr auto 90px;gap:10px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--edge)}' +
    '@media(max-width:560px){.hm-row{grid-template-columns:1fr auto}.hm-row span:nth-child(2){grid-column:1/-1}}' +
    '.jr{display:grid;gap:2px;border-left:3px solid var(--edge);padding-left:10px}.jr-i{display:grid;grid-template-columns:110px 1fr;gap:8px;font-size:13px;padding:3px 0}.jr-i.fut{color:var(--muted)}.jr-i.nx{color:var(--ink);font-weight:600}.jr-v{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.jr-v .tag{white-space:normal;word-break:break-all}.hm-box h2{min-width:0;word-break:break-all}.hm-box .sec-h{flex-wrap:wrap}';
  document.head.appendChild(css);
};
