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

  var css = document.createElement('style');
  css.textContent = '.hm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-bottom:14px}' +
    '.hm-card{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"ic t" "v v" "s s";gap:2px 8px;text-align:left;cursor:pointer;padding:14px;border-left:5px solid var(--c)}' +
    '.hm-card:hover{background:var(--raise)}.hm-ic{grid-area:ic;font-size:18px}.hm-t{grid-area:t;align-self:center;font-weight:700}.hm-v{grid-area:v;font-size:30px;font-weight:800;color:var(--c);line-height:1.1;margin-top:4px}.hm-v small{font-size:14px;font-weight:600}' +
    '.hm-s{grid-area:s;color:var(--muted);font-size:12.5px;line-height:1.4}.hm-box{padding:12px}.hm-next{display:grid;gap:4px}' +
    '.hm-row{display:grid;grid-template-columns:120px 1fr auto 90px;gap:10px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--edge)}' +
    '@media(max-width:560px){.hm-row{grid-template-columns:1fr auto}.hm-row span:nth-child(2){grid-column:1/-1}}';
  document.head.appendChild(css);
};
