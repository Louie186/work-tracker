/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-find.js — 🔎 File finder (MIDP Checker › Files)
   ───────────────────────────────────────────────────────────────────
   Paste one or many drawing numbers — with or without the revision
   ("…-10100", "…-10100-T1", "…-10100-") — and see WHERE each file is in
   a folder you choose (every subfolder), with its file types and the
   revisions in the folder, plus the drawing's Tower · Typology · Model
   from the MIDP.
   READ-ONLY: the folder is opened with read permission only; this file
   never writes, moves, renames or deletes anything. "Open" shows a copy
   of the file in a new tab.
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_FIND = function (A) {
  'use strict';
  var S = A.S, T = A.T, esc = A.esc;
  var KEY = 'tidp-checker:finder';
  var UI = Object.assign({ text: '', f: '' }, A.readJSON(KEY, {}));
  var FD = { root: null, name: '', files: 0, at: 0, busy: false, need: false, ix: new Map(), handles: new Map() };
  var canPick = typeof window.showDirectoryPicker === 'function';
  function save() { A.writeJSON(KEY, { text: UI.text, f: UI.f }); }
  function U(s) { return String(s == null ? '' : s).toUpperCase(); }
  function base(num) { var n = U(num).trim().replace(/-+$/, ''); var b = T.baseOf ? T.baseOf(n) : n; return U(b || n).replace(/-+$/, ''); }
  function revOf(num) { var n = U(num).trim().replace(/-+$/, ''), b = base(n); return n.length > b.length ? n.slice(b.length + 1) : ''; }

  /* ---------- the remembered folder (read permission only) ---------- */
  var dbP = null;
  function db() { if (!dbP) dbP = new Promise(function (res, rej) { var r = indexedDB.open('lt-finder', 1); r.onupgradeneeded = function () { r.result.createObjectStore('h'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); return dbP; }
  function idb(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('h', mode), q = fn(t.objectStore('h')), out; if (q) q.onsuccess = function () { out = q.result; }; t.oncomplete = function () { res(out); }; t.onerror = function () { rej(t.error); }; }); }); }
  function pid() { try { var p = JSON.parse(localStorage.getItem('lt_projects_v1') || 'null'); return p && p.active || 'one'; } catch (e) { return 'one'; } }
  function keep(h) { return idb('readwrite', function (s) { return s.put(h, 'finder:' + pid()); }).catch(function () {}); }
  function load() { return idb('readonly', function (s) { return s.get('finder:' + pid()); }).catch(function () { return null; }); }

  /* ---------- reading the folder: names only (and size / date) ---------- */
  function walk(dir, path) {
    var it = dir.entries();
    var next = function () {
      return it.next().then(function (st) {
        if (st.done) return;
        var name = st.value[0], h = st.value[1];
        if (h.kind === 'directory') return walk(h, path + name + '/').then(next, next);
        FD.files++;
        var dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
        var m = /^([A-Z0-9]+(?:-[A-Z0-9]+){4,})/i.exec(stem.trim());
        if (!m) return next();
        var num = U(m[1]), b = base(num), rec = { path: path, name: name, ext: ext, rev: revOf(num), num: num };
        if (!FD.ix.has(b)) FD.ix.set(b, []);
        FD.ix.get(b).push(rec); FD.handles.set(path + name, h);
        if (FD.files % 400 === 0) progress();
        return next();
      });
    };
    return next();
  }
  function progress() { var el = document.getElementById('fnStatus'); if (el) el.textContent = 'Reading… ' + FD.files + ' files'; }
  function scan(h) {
    FD.busy = true; FD.need = false; FD.root = h; FD.name = h.name; FD.files = 0; FD.ix = new Map(); FD.handles = new Map(); A.render();
    return walk(h, '').then(function () { FD.at = Date.now(); FD.busy = false; A.render(); A.toast('🔎 ' + FD.files + ' files read in “' + h.name + '” — nothing was changed'); })
      .catch(function (e) { FD.busy = false; A.render(); A.toast('Could not read the folder: ' + e.message); });
  }
  function choose() {
    if (!canPick) { A.toast('Choosing a folder needs Chrome or Edge on a computer'); return; }
    window.showDirectoryPicker({ id: 'midp-finder', mode: 'read' }).then(function (h) { keep(h); return scan(h); }).catch(function (e) { if (e && e.name !== 'AbortError') A.toast(e.message); });
  }
  function reconnect() {
    load().then(function (h) {
      if (!h) return choose();
      return h.requestPermission({ mode: 'read' }).then(function (p) { if (p === 'granted') return scan(h); A.toast('The browser did not allow the folder'); });
    });
  }
  function boot() {
    if (!canPick) return;
    load().then(function (h) {
      if (!h) return;
      FD.name = h.name;
      return h.queryPermission({ mode: 'read' }).then(function (p) { if (p === 'granted') return scan(h); FD.need = true; A.render(); });
    }).catch(function () {});
  }

  /* ---------- what you pasted → where it is ---------- */
  function midpRow(b) {
    if (!S.built) return null;
    if (!S.__fnIx || S.__fnIx.built !== S.built) { var m = new Map(); S.built.rows.forEach(function (r) { if (r.num) { var k = base(r.num); if (!m.has(k)) m.set(k, r); } }); S.__fnIx = { built: S.built, m: m }; }
    return S.__fnIx.m.get(b) || null;
  }
  function ttm(r) {
    if (!r) return null;
    var row = (A.rowByKey && A.rowByKey(r.key)) || r, v = row.v || {}, i = (window.MIDP_EXT && MIDP_EXT.info && MIDP_EXT.info(r.key)) || {}, mi = A.mInfo ? A.mInfo(row) : {};
    return { tower: T.txt(v.Tower) || i.bld || '', typ: T.txt(v.Typology) || (i.typ && i.typ.name) || '', guess: !T.txt(v.Typology) && i.typ && i.typ.guess,
      model: mi.num || '', modelName: mi.model ? mi.model.name : '', sugg: mi.state === 'suggested' && mi.sugg && mi.sugg.model ? mi.sugg.model.num : '' };
  }
  function near(b) {      // "did you mean": same sequence number, or one character different
    var seq = b.split('-').pop(), out = [];
    FD.ix.forEach(function (v, k) { if (out.length < 3 && k !== b && (k.split('-').pop() === seq || lev1(k, b))) out.push(k); });
    return out;
  }
  function lev1(a, b) { if (Math.abs(a.length - b.length) > 1) return false; var i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; }
  function results() {
    var seen = {}, out = [];
    (UI.text.match(/[A-Z0-9]{2,}(?:-[A-Z0-9]+){3,}-?/gi) || []).forEach(function (n) {
      var b = base(n); if (seen[b]) { seen[b].twice = true; return; }
      var hits = FD.ix.get(b) || [], r = midpRow(b), paths = {};
      hits.forEach(function (h) { (paths[h.path] = paths[h.path] || []).push(h); });
      var x = { key: 'f' + out.length, idx: out.length + 1, pasted: n, base: b, hits: hits, paths: paths, nPaths: Object.keys(paths).length, r: r, t: ttm(r), exts: {}, revs: {} };
      hits.forEach(function (h) { x.exts[h.ext] = (x.exts[h.ext] || 0) + 1; if (h.rev) x.revs[h.rev] = 1; });
      x.near = hits.length ? [] : near(b);
      seen[b] = x; out.push(x);
    });
    return out;
  }

  /* ---------- the tab ---------- */
  A.VIEWS.find = function () {
    var h = '<div class="box fn-top"><div class="toolbar" style="margin:0;flex-wrap:wrap">' +
      (canPick ? '<button class="btn primary" type="button" data-act="fnpick">📁 ' + (FD.root || FD.need ? 'Change folder' : 'Choose folder') + '</button>' : '') +
      (FD.need ? '<button class="btn" type="button" data-act="fnre">🔓 Open “' + esc(FD.name) + '” again</button>' : '') +
      (FD.root ? '<button class="btn" type="button" data-act="fnscan" title="Read the folder again (new files)">↻ Rescan</button>' : '') +
      '<span class="hint" id="fnStatus">' + (FD.busy ? 'Reading… ' + FD.files + ' files' : FD.root ? '<b>' + esc(FD.name) + '</b> · ' + FD.files + ' files · ' + FD.ix.size + ' drawings · read ' + new Date(FD.at).toLocaleTimeString() + ' (all subfolders)' : FD.need ? 'The browser asks once per visit before reading a folder' : canPick ? 'Choose the folder to search — e.g. your exports or the project drawings folder' : 'Needs Chrome or Edge on a computer') + '</span>' +
      '<span class="grow"></span><span class="tag c-ok" title="The folder is opened with read permission only. Nothing is written, moved, renamed or deleted.">🔒 Read-only</span></div>' +
      '<textarea id="fnText" rows="4" placeholder="Paste drawing numbers — one or many, with or without the revision&#10;5013-KEO-T1-ZZ-PLN-INT-10100&#10;5013-KEO-T1-ZZ-PLN-INT-10100-T1">' + esc(UI.text) + '</textarea></div>';
    if (!UI.text.trim()) return h + '<div class="box empty"><b>🔎 Find drawings in a folder</b>Paste numbers above (from the MIDP, an email, Excel…). The revision is ignored, so “…-10100”, “…-10100-T1” and “…-10100-” all find the same files. You get the folder of each file, its types and revisions, and the drawing’s Tower · Typology · Model.</div>';
    if (!FD.root) return h + '<div class="box empty">' + (FD.busy ? 'Reading the folder…' : 'Choose the folder to search in (📁 above).') + '</div>';
    var rows = results(), f = UI.f;
    var c = { all: rows.length, yes: rows.filter(function (x) { return x.hits.length; }).length, no: rows.filter(function (x) { return !x.hits.length; }).length, many: rows.filter(function (x) { return x.nPaths > 1; }).length, nomidp: rows.filter(function (x) { return !x.r; }).length };
    var shown = rows.filter(function (x) { return f === 'yes' ? x.hits.length : f === 'no' ? !x.hits.length : f === 'many' ? x.nPaths > 1 : f === 'nomidp' ? !x.r : true; });
    h += '<div class="toolbar"><div class="chips">' + [['', 'All', c.all], ['yes', '✅ Found', c.yes], ['no', '❌ Not in the folder', c.no], ['many', '📂 In more than one folder', c.many], ['nomidp', 'Not in the MIDP', c.nomidp]].map(function (k) {
      return '<button class="chip" type="button" data-act="fnf" data-v="' + k[0] + '" aria-pressed="' + (f === k[0]) + '">' + k[1] + '<span class="c">' + k[2] + '</span></button>'; }).join('') + '</div>' +
      '<span class="grow"></span><button class="btn small" type="button" data-act="fncopy" title="Number, folder, files — paste in Excel or an email">📋 Copy results</button></div>';
    var cols = [
      { k: 'idx', label: '#', w: 44, cls: 'num', text: function (x) { return String(x.idx); }, sortKey: function (x) { return x.idx; } },
      { k: 'num', label: 'Drawing number', w: 250, stick: true, cls: 'mono', text: function (x) { return x.base; }, html: function (x) { return (x.r ? A.numLink(x.base, x.r.key) : esc(x.base)) + (x.near.length ? '<div class="hint fn-near">did you mean ' + x.near.map(esc).join(', ') + '?</div>' : ''); } },
      { k: 'st', label: 'Found', w: 96, text: function (x) { return x.hits.length ? 'Yes' : 'No'; }, html: function (x) { return x.hits.length ? '<span class="tag c-ok">✓ ' + x.hits.length + ' file' + (x.hits.length === 1 ? '' : 's') + '</span>' : '<span class="tag c-bad">✗ not found</span>'; } },
      { k: 'where', label: 'Folder (where it is)', w: 260, text: function (x) { return Object.keys(x.paths).map(function (p) { return (FD.name + '/' + p).replace(/\/$/, ''); }).join(' | '); },
        html: function (x) { return Object.keys(x.paths).map(function (p) { return '<div class="fn-p" title="' + esc(FD.name + '/' + p) + '">📁 ' + esc((FD.name + '/' + p).replace(/\/$/, '')) + '</div>'; }).join('') || '<span class="muted">—</span>'; } },
      { k: 'files', label: 'Files', w: 200, text: function (x) { return x.hits.map(function (h) { return h.name; }).join(' | '); },
        html: function (x) { return '<div class="fn-fs">' + x.hits.map(function (h) { return '<button class="fn-f" type="button" data-act="fnopen" data-v="' + esc(h.path + h.name) + '" title="Open a copy of ' + esc(h.name) + ' (read-only)">' + esc(h.ext.toUpperCase() || 'file') + (h.rev ? ' · ' + esc(h.rev) : '') + '</button>'; }).join('') + '</div>'; } },
      { k: 'tower', label: 'Tower', w: 80, text: function (x) { return x.t ? x.t.tower : ''; } },
      { k: 'typ', label: 'Typology', w: 220, text: function (x) { return x.t ? x.t.typ : ''; }, html: function (x) { return !x.t ? '' : x.t.typ ? esc(x.t.typ) + (x.t.guess ? ' <span class="tag c-warn" title="Guessed — confirm it">?</span>' : '') : '<span class="muted">—</span>'; } },
      { k: 'model', label: 'Model', w: 120, text: function (x) { return x.t ? x.t.model || x.t.sugg : ''; }, html: function (x) { return !x.t ? '' : x.t.model ? '<span class="mono" title="' + esc(x.t.modelName) + '">' + esc(x.t.model) + '</span>' : x.t.sugg ? '<span class="mono muted">' + esc(x.t.sugg) + ' ?</span>' : '<span class="muted" title="Optional">—</span>'; } },
      { k: 'rev', label: 'Rev in folder', w: 90, text: function (x) { return Object.keys(x.revs).join(', '); } },
      { k: 'title', label: 'Description', w: 300, text: function (x) { return x.r ? x.r.title : 'Not in the MIDP'; }, html: function (x) { return x.r ? esc(x.r.title) : '<span class="tag c-warn">Not in the MIDP</span>'; } }
    ];
    return h + A.grid('fnfind', shown, cols, { title: 'File finder', key: function (x) { return x.key; }, empty: 'Nothing here.' }).html;
  };

  Object.assign(A.ACTIONS, {
    fnpick: choose, fnre: reconnect,
    fnscan: function () { if (FD.root) scan(FD.root); },
    fnf: function (el) { UI.f = el.getAttribute('data-v'); save(); A.render(); },
    fnopen: function (el) {         // a copy of the file in a new tab — the folder is not touched
      var h = FD.handles.get(el.getAttribute('data-v')); if (!h) return;
      h.getFile().then(function (file) { var u = URL.createObjectURL(file); window.open(u, '_blank'); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }).catch(function (e) { A.toast('Could not open: ' + e.message); });
    },
    fncopy: function () {
      var rows = results(), t = ['Drawing number\tFound\tFolder\tFiles\tRev in folder\tDescription\tTower\tTypology\tModel'].concat(rows.map(function (x) {
        return [x.base, x.hits.length ? 'Yes' : 'No', Object.keys(x.paths).map(function (p) { return (FD.name + '/' + p).replace(/\/$/, ''); }).join(' | '), x.hits.map(function (h) { return h.name; }).join(' | '), Object.keys(x.revs).join(', '),
          x.r ? x.r.title : 'Not in the MIDP', x.t ? x.t.tower : '', x.t ? x.t.typ : '', x.t ? x.t.model || x.t.sugg : ''].join('\t');
      })).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { A.toast('📋 ' + rows.length + ' lines copied — paste in Excel or an email'); }, function () { A.toast('Copy blocked — use Export this view'); });
    }
  });
  var tT = null;
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'fnText') return;
    clearTimeout(tT); var v = e.target.value;
    tT = setTimeout(function () { UI.text = v; save(); var pos = e.target.selectionStart; A.render(); var t = document.getElementById('fnText'); if (t) { t.focus(); try { t.setSelectionRange(pos, pos); } catch (x) {} } }, 400);
  });

  var css = document.createElement('style');
  css.textContent = '.fn-top{padding:10px 12px;margin-bottom:10px;display:grid;gap:8px}.fn-top textarea{width:100%;font:12.5px/1.45 var(--mono,monospace)}' +
    '.fn-fs{display:flex;flex-wrap:wrap;gap:3px;white-space:normal}.fn-near{white-space:normal;word-break:break-all}.fn-p{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fn-f{font:inherit;font-size:11px;font-weight:700;padding:1px 7px;border:1px solid var(--edge);background:var(--panel);color:var(--ink);cursor:pointer;border-radius:99px;margin:1px 0}.fn-f:hover{border-color:var(--info)}';
  document.head.appendChild(css);
  boot();
};
