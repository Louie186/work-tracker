/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-folder.js — 📁 Folder check (MIDP Checker, Deliver)
   ───────────────────────────────────────────────────────────────────
   Reads the export folder (names only — files are never opened or sent
   anywhere) and makes your checklist:
   • every drawing in the folder and its subfolders, PDF + DWG paired
     (the file types you need can be changed; other files are listed too)
   • matched to the MIDP by the number WITHOUT its revision; the revision
     read from the file is shown as it is (00 = IFC, T0/T1 = Tender…)
   • Tower / Typology / Model from the MIDP Checker — missing ones are
     flagged, and your fix is saved in the Tracker (shows everywhere)
   • against a submission list: Ready · Missing · Extra
   • sort the files into folders (Tower1/1BRA…): straight from Edge, or a
     .bat that works on the folder it sits in. Copy by default, nothing
     is deleted, with a log and an undo file.
   Folder access: Edge / Chrome remember the folder (File System Access).
   Other browsers pick the folder each time (read only).
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_FOLDER = function (A) {
  'use strict';
  var S = A.S, T = A.T, esc = A.esc;
  var KEY = 'tidp-checker:folder';
  var F = Object.assign({ root: '', at: 0, files: [], prev: [], ui: {} }, A.readJSON(KEY, {}));
  F.ui = Object.assign({ deep: true, req: ['pdf', 'dwg'], sub: '', group: ['tower', 'typ'], mode: 'copy', f: '', q: '', view: 'list', lf: '', tpath: '', tname: '', tskip: '' }, F.ui || {});
  var H = { root: null, target: null, files: new Map(), dirs: new Map() };     // handles of the last scan (this session only)
  var sel = new Set(), CACHE = null, BUSY = false;
  var canPick = typeof window.showDirectoryPicker === 'function';

  function save() { A.writeJSON(KEY, F); CACHE = null; try { if (window.parent !== window && window.parent.__trackerEmbedSaved) window.parent.__trackerEmbedSaved('midp'); } catch (e) {} }
  function U(s) { return String(s == null ? '' : s).toUpperCase().trim(); }
  function pid() { try { return window.parent.LTProjects.active().id; } catch (e) { return 'default'; } }

  /* ---------- remembered folder (IndexedDB keeps the handle) ---------- */
  function idb(mode, fn) {
    return new Promise(function (res, rej) {
      var o = indexedDB.open('lt-folders', 1);
      o.onupgradeneeded = function () { o.result.createObjectStore('h'); };
      o.onsuccess = function () { var tx = o.result.transaction('h', mode), r = fn(tx.objectStore('h')); tx.oncomplete = function () { res(r && r.result); }; tx.onerror = function () { rej(tx.error); }; };
      o.onerror = function () { rej(o.error); };
    });
  }
  function keepHandle(h) { return idb('readwrite', function (s) { return s.put(h, 'midp:' + pid()); }).catch(function () {}); }
  function loadHandle() { return idb('readonly', function (s) { return s.get('midp:' + pid()); }).catch(function () { return null; }); }
  function keepTarget(h) { return idb('readwrite', function (s) { return h ? s.put(h, 'midp-target:' + pid()) : s.delete('midp-target:' + pid()); }).catch(function () {}); }
  function loadTarget() { return H.target ? Promise.resolve(H.target) : idb('readonly', function (s) { return s.get('midp-target:' + pid()); }).then(function (h) { H.target = h || null; return H.target; }).catch(function () { return null; }); }

  /* ---------- reading the folder ---------- */
  function walk(dir, path, out) {
    var it = dir.entries(), next = function () {
      return it.next().then(function (st) {
        if (st.done) return;
        var name = st.value[0], h = st.value[1];
        if (h.kind === 'file') {
          if (/^(Sort_files_|Undo_sort_).*\.bat$/i.test(name) || /^sort-log\.txt$/i.test(name)) return next();          // our own sorting files
          return h.getFile().then(function (f) { out.push([path, name, f.size, f.lastModified]); H.files.set(path + name, h); H.dirs.set(path, dir); }).then(next, next);
        }
        if (!F.ui.deep) return next();
        return walk(h, path + name + '/', out).then(next);
      });
    };
    return next();
  }
  function scan(h) {
    BUSY = true; A.render();
    var out = []; H.files = new Map(); H.dirs = new Map();
    return walk(h, '', out).then(function () {
      // the chosen target folder (outside the export folder) is read too, shown as "@name/…"
      if (!F.ui.tname || F.ui.tskip) return;
      return loadTarget().then(function (t) {
        if (!t) return;
        return t.queryPermission({ mode: 'read' }).then(function (p) { return p === 'granted' ? p : t.requestPermission({ mode: 'read' }); })
          .then(function (p) { if (p === 'granted') return walk(t, '@' + t.name + '/', out); }).catch(function () {});
      });
    }).then(function () { took(h.name, out); }).catch(function (e) { A.toast('Could not read the folder: ' + e.message); })
      .then(function () { BUSY = false; A.render(); });
  }
  function took(rootName, out) {
    var before = new Set(F.files.map(function (f) { return f[0] + f[1]; })), now = new Set(out.map(function (f) { return f[0] + f[1]; }));
    F.newN = out.filter(function (f) { return !before.has(f[0] + f[1]); }).length;
    F.goneN = F.files.filter(function (f) { return !now.has(f[0] + f[1]); }).length;
    if (!F.files.length) F.newN = 0;
    F.root = rootName; F.at = Date.now(); F.files = out; save();
    A.toast('📁 ' + out.length + ' files read' + (F.newN ? ' · ' + F.newN + ' new' : '') + (F.goneN ? ' · ' + F.goneN + ' gone' : ''));
  }
  function connect() {
    if (!canPick) { document.getElementById('fdPick').click(); return; }
    window.showDirectoryPicker({ id: 'midp-exports', mode: 'read' }).then(function (h) { H.root = h; keepHandle(h); return scan(h); })
      .catch(function (e) { if (e.name !== 'AbortError') A.toast('Folder not opened: ' + e.message); });
  }
  function rescan() {
    var go = function (h) {
      return h.queryPermission({ mode: 'read' }).then(function (p) { return p === 'granted' ? p : h.requestPermission({ mode: 'read' }); })
        .then(function (p) { if (p !== 'granted') throw new Error('Permission not given'); H.root = h; return scan(h); });
    };
    if (H.root) return go(H.root);
    return loadHandle().then(function (h) { if (!h) { connect(); return; } return go(h); }).catch(function (e) { A.toast('⚠ ' + e.message); });
  }
  function fromInput(list) {
    var out = [];
    Array.prototype.forEach.call(list, function (f) {
      var rel = f.webkitRelativePath || f.name, parts = rel.split('/'); parts.shift();
      var name = parts.pop(), path = parts.length ? parts.join('/') + '/' : '';
      if (!F.ui.deep && path) return;
      if (/^(Sort_files_|Undo_sort_).*\.bat$/i.test(name) || /^sort-log\.txt$/i.test(name)) return;
      out.push([path, name, f.size, f.lastModified]);
    });
    var root = list[0] && list[0].webkitRelativePath ? list[0].webkitRelativePath.split('/')[0] : 'folder';
    H.root = null; took(root, out); A.render();
  }

  /* export folder, or a sorted place (_Sorted, a target inside the export folder, or the target folder "@name/") */
  function isSorted(path) { return /^_Sorted(\/|$)/i.test(path) || /^@/.test(path) || !!(F.ui.tskip && path.indexOf(F.ui.tskip) === 0); }

  /* ---------- names → drawings ---------- */
  var REV = /^(\d{1,3}|[A-Z]\d{1,3}|[A-Z]{2}\d{1,3})$/;
  function parseName(n) {
    var dot = n.lastIndexOf('.'), ext = dot > 0 ? n.slice(dot + 1).toLowerCase() : '', stem = dot > 0 ? n.slice(0, dot) : n;
    var m = /^([A-Z0-9]+(?:-[A-Z0-9]+){4,})/i.exec(stem.trim());
    if (!m) return { ext: ext, num: '' };
    var num = U(m[1]), parts = num.split('-'), rev = '', base = num;
    if (parts.length >= 6 && REV.test(parts[parts.length - 1]) && parts[parts.length - 1].length <= 3) { rev = parts.pop(); base = parts.join('-'); }
    return { ext: ext, num: num, base: base, rev: rev };
  }
  function setOf(rev) {
    if (!rev) return '';
    if (/^\d+$/.test(rev)) return 'IFC';
    if (/^T\d/.test(rev)) return 'Tender';
    if (/^P\d/.test(rev)) return 'Preliminary';
    if (/^C\d/.test(rev)) return 'Construction';
    if (/^D\d/.test(rev)) return 'Design';
    return rev;
  }
  function midpIndex() {
    var by = new Map();
    (S.built ? S.built.rows : []).forEach(function (r) {
      if (!r.num) return;
      var b = U(r.base || r.num).replace(/-$/, '');
      if (!by.has(b)) by.set(b, r);
      if (r._o) { var ob = U(T.baseOf(r._o.num) || r._o.num); if (!by.has(ob)) by.set(ob, r); }   // your typo corrections
    });
    return by;
  }
  function nearest(base, by) {                                  // a file-name typo: the MIDP number one part away
    var p = base.split('-'), best = null, score = 9;
    by.forEach(function (r, b) {
      var q = b.split('-'); if (q.length !== p.length) return;
      var d = 0; for (var i = 0; i < p.length && d < 2; i++) if (p[i] !== q[i]) d++;
      if (d === 1) { var s = p[p.length - 1] === q[q.length - 1] ? 0 : 1; if (s < score) { score = s; best = r; } }
    });
    return best;
  }
  function towerShort(code, v) {
    var t = U(v || code);
    var m = /(\d+)/.exec(t);
    if (/^T\d|TOWER|RES/.test(t) && m) return 'Tower' + m[1];
    if (/^PD|PODIUM/.test(t)) return 'Podium';
    if (!t || t === 'XX' || t === 'ZZ') return 'General';
    return t.replace(/[^A-Z0-9]/g, '');
  }
  function unitish(title) { return /\bTYPE\b|SUITE|STUDIO|\b\d\s*BR\b|\bROOM\b|APARTMENT|UNIT/i.test(title || ''); }

  function build() {
    if (CACHE) return CACHE;
    var by = midpIndex(), req = F.ui.req, groups = new Map(), other = [];
    F.files.forEach(function (f) {
      var p = parseName(f[1]);
      var srt = isSorted(f[0]);
      if (!p.num) { other.push({ other: true, key: 'o:' + f[0] + f[1], path: f[0], name: f[1], ext: p.ext, files: [f], sorted: srt }); return; }
      var g = groups.get(p.base);
      if (!g) { g = { key: p.base, base: p.base, nums: {}, revs: {}, exts: {}, extE: {}, extS: {}, paths: {}, files: [], nExp: 0, nSrt: 0 }; groups.set(p.base, g); }
      g.nums[p.num] = 1; if (p.rev) g.revs[p.rev] = 1; g.exts[p.ext] = (g.exts[p.ext] || 0) + 1; g.paths[f[0] || '(top)'] = 1; g.files.push(f);
      if (srt) { g.nSrt++; g.extS[p.ext] = (g.extS[p.ext] || 0) + 1; } else { g.nExp++; g.extE[p.ext] = (g.extE[p.ext] || 0) + 1; }
    });
    var rows = [];
    groups.forEach(function (g) {
      var r = by.get(g.base) || null, revs = Object.keys(g.revs);
      g.num = Object.keys(g.nums)[0]; g.rev = revs.join(', '); g.set = revs.map(setOf).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(', ');
      g.r = r; g.near = r ? null : nearest(g.base, by);
      g.missingExt = req.filter(function (x) { return !g.exts[x]; });
      // doubled = the same file type twice in the SAME place (or two revisions); export + sorted copy is shown as "Export + sorted"
      g.dupe = revs.length > 1 || Object.keys(g.extE).some(function (x) { return g.extE[x] > 1; }) || Object.keys(g.extS).some(function (x) { return g.extS[x] > 1; });
      g.place = g.nExp && g.nSrt ? 'both' : g.nSrt ? 'sorted' : 'unsorted';
      if (r) {
        var i = (MIDP_EXT.info && MIDP_EXT.info(r.key)) || {}, mi = A.mInfo(r);
        g.title = r.title;
        g.tower = r.v.Tower || i.bld || ''; g.towerSrc = r.v.Tower ? 'set' : i.bld ? 'number' : '';
        g.typ = r.v.Typology || (i.typ && i.typ.name) || ''; g.typSrc = r.v.Typology ? 'set' : i.typ ? (i.typ.guess ? 'guess' : 'title') : '';
        g.needTyp = unitish(r.title) || !!g.typ;
        g.model = mi.num || ''; g.modelName = mi.model ? mi.model.name : ''; g.modelSrc = mi.num ? 'set' : mi.state === 'suggested' ? 'suggested' : '';
        g.sugg = mi.state === 'suggested' ? mi.sugg.model : null;
        g.needs = [!g.tower && 'Tower', (g.needTyp && !g.typ || g.typSrc === 'guess') && 'Typology', !g.model && 'Model'].filter(Boolean);   // a guessed typology must be confirmed
        g.lvl = (r.parts || [])[3] || ''; g.type = (r.parts || [])[4] || ''; g.cat = r.cat || '';
      }
      rows.push(g);
    });
    // against the submission list
    var sb = F.ui.sub && A.subsByDate().filter(function (x) { return x.id === F.ui.sub; })[0], expected = new Map(), missing = [];
    if (sb && sb._m) sb._m.forEach(function (m) {
      if (m.item) expected.set(U(m.item.base || m.item.num).replace(/-$/, ''), m.item);
      else if (m.num) expected.set(U(T.baseOf(m.num) || m.num), { num: m.num, title: m.title, nomidp: true });   // in the list, not in the MIDP
    });
    rows.forEach(function (g) {
      g.target = !sb ? '' : expected.has(g.base) || (g.r && expected.has(U(g.r.base || g.r.num))) ? (g.missingExt.length ? 'Part' : 'Ready') : 'Extra';
    });
    if (sb) {
      var inFolder = new Set(rows.map(function (g) { return g.r ? U(g.r.base || g.r.num).replace(/-$/, '') : g.base; }));
      expected.forEach(function (item, b) {
        if (inFolder.has(b) || rows.some(function (g) { return g.base === b; })) return;
        missing.push({ key: 'm:' + b, base: b, num: item.num, r: item.nomidp ? null : item, title: item.title + (item.nomidp ? ' (in the list, not in the MIDP)' : ''), target: 'Missing', files: [], exts: {}, missingExt: req.slice(), needs: [], absent: true });
      });
    }
    rows.sort(function (a, b) { return a.base < b.base ? -1 : 1; });
    var list = [];
    if (sb && sb._m) {
      var byBase = new Map(); rows.forEach(function (g) { byBase.set(g.base, g); if (g.r) byBase.set(U(g.r.base || g.r.num).replace(/-$/, ''), g); });
      var seen = {};
      sb._m.forEach(function (m, i) {
        var b = m.item ? U(m.item.base || m.item.num).replace(/-$/, '') : (parseName(m.num + '.x').base || U(m.num));
        seen[b] = (seen[b] || 0) + 1;
        list.push({ key: 'l:' + i, idx: i + 1, num: m.num, rev: m.rev, match: m.match, r: m.item, title: m.item ? m.item.title : m.title, base: b, g: byBase.get(b) || null });
      });
      list.forEach(function (x) { x.listTwice = seen[x.base] > 1; });
    }
    CACHE = { rows: rows, other: other, missing: missing, sb: sb, list: list };
    return CACHE;
  }
  function stateOf(g) {
    if (g.absent) return 'missing';
    if (!g.r) return 'nomidp';
    if (g.missingExt.length) return 'half';
    if (g.needs.length) return 'needs';
    return 'ok';
  }

  /* ---------- sorting plan ---------- */
  var DIMS = {
    tower: { label: 'Tower', of: function (g) { return g.r ? towerShort(g.tower, g.r.v.Tower) : ''; } },
    typ: { label: 'Typology', of: function (g) { return !g.r ? '' : g.typSrc === 'guess' ? '_ToCheck' : g.typ ? T.drawingUnitKey(g.typ) || U(g.typ).replace(/[^A-Z0-9]/g, '') : g.needTyp ? '_ToCheck' : 'Common'; } },
    model: { label: 'Model', of: function (g) { return !g.r ? '' : g.model ? g.model.split('-').pop() || g.model : '_NoModel'; } },
    type: { label: 'Drawing type', of: function (g) { return g.r ? g.type || 'Other' : ''; } },
    lvl: { label: 'Level', of: function (g) { return !g.r ? '' : g.lvl && !/^(ZZ|XX)$/.test(g.lvl) ? 'L' + g.lvl : 'AllLevels'; } },
    cat: { label: 'Category', of: function (g) { return g.r ? (g.cat || 'NoCategory').replace(/[^A-Za-z0-9 &-]/g, '').slice(0, 30).trim() : ''; } },
    set: { label: 'Set (IFC / Tender)', of: function (g) { return g.set || 'NoRevision'; } }
  };
  function clean(s) { return String(s || '').replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').replace(/[. ]+$/, '').trim() || '_'; }
  function plan() {
    var B = build(), out = [];
    B.rows.forEach(function (g) {
      var dst = !g.r ? ['_Not in MIDP'] : F.ui.group.map(function (k) { return clean(DIMS[k].of(g)); });
      if (g.r && g.needs.length && F.ui.group.some(function (k) { return k === 'tower' || k === 'typ' || k === 'model'; }) && dst.some(function (x) { return /^_/.test(x); })) dst = ['_ToCheck'];
      g.files.forEach(function (f) { if (!isSorted(f[0])) out.push({ p: f[0], n: f[1], dst: dst.join('\\') }); });
    });
    B.other.forEach(function (o) { if (!o.sorted) out.push({ p: o.path, n: o.name, dst: '_Other files' }); });
    return out;
  }
  function tree(pl) {
    var c = {}; pl.forEach(function (x) { c[x.dst] = (c[x.dst] || 0) + 1; });
    return Object.keys(c).sort().map(function (k) { return [k, c[k]]; });
  }

  /* where the .bat puts the files: the path you typed, or _Sorted next to the .bat */
  function batOut() {
    var t = String(F.ui.tpath || '').trim().replace(/^"+|"+$/g, '').replace(/[\\\/]+$/, '').replace(/\//g, '\\');
    return t ? t.replace(/%/g, '%%') : '%~dp0_Sorted';
  }
  function pathOk(t) { t = String(t || '').trim().replace(/^"+|"+$/g, ''); return !t || (/^([A-Za-z]:\\|\\\\[^\\]+\\)/.test(t) && !/[<>|?*]/.test(t.slice(2))); }
  /* .bat that works on the folder it sits in — no path to type */
  function bat(pl, mode) {
    var verb = mode === 'move' ? 'move' : 'copy', done = mode === 'move' ? 'MOVED ' : 'COPIED';
    var q = function (s) { return s.replace(/%/g, '%%').replace(/"/g, ''); };
    var L = ['@echo off', 'rem -- Lews Tracker - MIDP Checker - sort the drawings into folders --',
      'rem Put this file INSIDE the export folder and double-click it.',
      'rem Grouping: ' + F.ui.group.map(function (k) { return DIMS[k].label; }).join(' then ') + ' - ' + (mode === 'move' ? 'MOVE' : 'COPY (originals stay)') + ' - made ' + new Date().toLocaleString(),
      'setlocal', 'chcp 65001 >nul', 'cd /d "%~dp0"', 'set "OUT=' + batOut() + '"', 'if not exist "%OUT%" mkdir "%OUT%"',
      'if not exist "%OUT%" (echo Cannot open or make the target folder: %OUT% & pause & exit /b)', 'set "LOG=%OUT%\\sort-log.txt"',
      'echo ==== %date% %time% ====>>"%LOG%"', 'set /a N=0', 'set /a K=0', ''];
    pl.forEach(function (x) { L.push('call :put "' + q((x.p + x.n).replace(/\//g, '\\')) + '" "' + q(x.dst) + '"'); });
    L.push('', 'echo.', 'echo Done: %N% files ' + (mode === 'move' ? 'moved' : 'copied') + ', %K% skipped. Details: %LOG%', 'pause', 'exit /b', '',
      ':put', 'if not exist "%~1" (echo NOT FOUND   %~1>>"%LOG%" & set /a K+=1 & exit /b)', 'if not exist "%OUT%\\%~2" mkdir "%OUT%\\%~2"',
      'if exist "%OUT%\\%~2\\%~nx1" (echo ALREADY THERE   %~2\\%~nx1>>"%LOG%" & set /a K+=1 & exit /b)',
      verb + ' "%~1" "%OUT%\\%~2\\" >nul && (set /a N+=1 & echo ' + done + '   %~1  -^>  %~2>>"%LOG%")', 'exit /b', '');
    return L.join('\r\n');
  }
  function undoBat(pl, mode) {
    var q = function (s) { return s.replace(/%/g, '%%').replace(/"/g, ''); };
    var L = ['@echo off', 'rem -- Undo the sort made on ' + new Date().toLocaleString() + ' --', 'rem Put this file in the same export folder and double-click it.',
      'setlocal', 'chcp 65001 >nul', 'cd /d "%~dp0"', 'set "OUT=' + batOut() + '"', ''];
    pl.forEach(function (x) {
      var src = q((x.p + x.n).replace(/\//g, '\\')), dst = '%OUT%\\' + q(x.dst) + '\\' + q(x.n);
      L.push(mode === 'move' ? 'if exist "' + dst + '" if not exist "' + src + '" move "' + dst + '" "' + src + '" >nul' : 'if exist "' + dst + '" if exist "' + src + '" del "' + dst + '"');
    });
    tree(pl).map(function (t) { return t[0]; }).sort().reverse().forEach(function (d) {
      var parts = d.split('\\'); for (var i = parts.length; i > 0; i--) L.push('rd "%OUT%\\' + q(parts.slice(0, i).join('\\')) + '" 2>nul');
    });
    L.push('echo Undo finished.', 'pause', '');
    return L.join('\r\n');
  }
  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  /* Edge / Chrome: sort straight from here */
  function sortNow() {
    var pl = plan(), mode = F.ui.mode;
    if (!pl.length) return;
    var where = F.ui.tname ? 'the target folder “' + F.ui.tname + '”' : 'the folder “_Sorted” inside ' + F.root;
    if (!confirm((mode === 'move' ? 'MOVE ' : 'Copy ') + pl.length + ' files into ' + where + '?\n\n' + (mode === 'move' ? 'The files leave their current place (an undo .bat is downloaded).' : 'The originals stay where they are.') + ' Files already there are skipped.')) return;
    var root, tgt;
    rescan().then(function () {
      root = H.root; if (!root) throw new Error('Connect the folder first (Edge / Chrome)');
      return F.ui.tname ? loadTarget() : null;
    }).then(function (t) {
      if (F.ui.tname && !t) throw new Error('Choose the target folder again');
      tgt = t;
      return (tgt || root).requestPermission({ mode: 'readwrite' }).then(function (p) {
        if (p === 'granted' && mode === 'move' && tgt) return root.requestPermission({ mode: 'readwrite' });      // moving also removes from the export folder
        return p;
      });
    }).then(function (p) {
      if (p !== 'granted') throw new Error('Edge needs “Save changes” permission to make the folders');
      BUSY = true; A.render();
      return tgt || root.getDirectoryHandle('_Sorted', { create: true });
    }).then(function (out) {
      var n = 0, skip = 0, log = [], i = 0;
      var dirFor = function (path) { return path.split('\\').reduce(function (pr, seg) { return pr.then(function (d) { return d.getDirectoryHandle(seg, { create: true }); }); }, Promise.resolve(out)); };
      var step = function () {
        if (i >= pl.length) return Promise.resolve();
        var x = pl[i++], src = H.files.get(x.p + x.n);
        if (!src) { skip++; log.push('NOT FOUND   ' + x.p + x.n); return step(); }
        return dirFor(x.dst).then(function (d) {
          return d.getFileHandle(x.n).then(function () { skip++; log.push('ALREADY THERE   ' + x.dst + '\\' + x.n); }, function () {
            return src.getFile().then(function (file) {
              return d.getFileHandle(x.n, { create: true }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(file).then(function () { return w.close(); }); });
            }).then(function () {
              n++; log.push((mode === 'move' ? 'MOVED    ' : 'COPIED   ') + x.p + x.n + '  ->  ' + x.dst);
              if (mode === 'move') { var dir = H.dirs.get(x.p); if (dir) return dir.removeEntry(x.n); }
            });
          });
        }).then(step, function (e) { skip++; log.push('FAILED   ' + x.p + x.n + ' (' + e.message + ')'); return step(); });
      };
      return step().then(function () {
        return out.getFileHandle('sort-log.txt', { create: true }).then(function (fh) { return fh.createWritable({ keepExistingData: true }); })
          .then(function (w) { return w.seek(0).then(function () { return w.write('==== ' + new Date().toLocaleString() + ' ====\r\n' + log.join('\r\n') + '\r\n'); }).then(function () { return w.close(); }); }).catch(function () {})
          .then(function () {
            if (mode === 'move') download('Undo_sort_' + T.todayIso() + '.bat', undoBat(pl, mode));
            A.toast('📁 ' + n + ' files ' + (mode === 'move' ? 'moved' : 'copied') + ' into ' + (F.ui.tname || '_Sorted') + (skip ? ' · ' + skip + ' skipped (see sort-log.txt)' : ''));
          });
      });
    }).catch(function (e) { A.toast('⚠ ' + e.message); }).then(function () { BUSY = false; if (mode === 'move') rescan(); else A.render(); });
  }

  /* ---------- fixing Tower / Typology / Model (saved in the Tracker) ---------- */
  function fixDialog(keys) {
    var B = build(), gs = B.rows.filter(function (g) { return keys.indexOf(g.key) >= 0 && g.r; });
    if (!gs.length) { A.toast('Only drawings found in the MIDP can be fixed'); return; }
    var one = gs.length === 1 ? gs[0] : null;
    var towers = {}, typs = {}, models = {};
    S.built.rows.forEach(function (r) { if (r.v.Tower) towers[r.v.Tower] = 1; if (r.v.Typology) typs[r.v.Typology] = 1; });
    ['T1', 'T2', 'PD'].forEach(function (t) { towers[t] = 1; });
    (MIDP_EXT.typoNames ? MIDP_EXT.typoNames() : []).forEach(function (t) { typs[t] = 1; });
    (S.store.models || []).forEach(function (m) { models[m.num] = m.name; });
    var dl = function (id, o, lab) { return '<datalist id="' + id + '">' + Object.keys(o).sort().map(function (k) { return '<option value="' + esc(k) + '"' + (lab && o[k] ? ' label="' + esc(o[k]) + '"' : '') + '>'; }).join('') + '</datalist>'; };
    A.openDialog('<h2>✎ Tower / Typology / Model</h2><p class="hint" style="margin-top:0">' + (one ? '<span class="mono">' + esc(one.r.num) + '</span><br>' + esc(one.title) : gs.length + ' drawings — empty boxes stay as they are') + '</p>' +
      dl('fdTw', towers) + dl('fdTy', typs) + dl('fdMo', models, true) +
      '<div class="row"><label class="field"><span>Tower</span><input type="text" id="fdTower" list="fdTw" value="' + esc(one ? one.r.v.Tower || '' : '') + '" placeholder="' + esc(one ? one.tower : '') + '"></label>' +
      '<label class="field" style="flex:1"><span>Typology</span><input type="text" id="fdTyp" list="fdTy" value="' + esc(one ? one.r.v.Typology || '' : '') + '" placeholder="' + esc(one ? one.typ : '') + '"></label></div>' +
      '<div class="row"><label class="field" style="flex:1"><span>Model number</span><input type="text" id="fdModel" list="fdMo" value="' + esc(one ? one.model : '') + '" placeholder="' + esc(one && one.sugg ? one.sugg.num + ' (suggested)' : '') + '"></label></div>' +
      '<p class="hint">Saved in the Tracker (Tower, Typology, Model number) — it shows in Lookup, Models and the Excel export, and goes in the history.</p>' +
      '<div class="acts"><button class="btn" type="button" data-act="dlgclose">Cancel</button><button class="btn primary" type="button" data-act="fdfixsave" data-v="' + esc(keys.join('|')) + '">Save</button></div>');
  }
  function fixSave(keys) {
    var tw = T.txt(document.getElementById('fdTower').value), ty = T.txt(document.getElementById('fdTyp').value), mo = T.txt(document.getElementById('fdModel').value);
    var B = build(), n = 0;
    B.rows.forEach(function (g) {
      if (keys.indexOf(g.key) < 0 || !g.r) return;
      var k = g.r.key;
      if (mo) { var m = T.findModel(S.mix, mo); if (m) A.applyModel(k, m, true); else A.setVal(k, 'Model Number', mo, true); }
      if (tw) A.setVal(k, 'Tower', tw, true);
      if (ty) A.setVal(k, 'Typology', ty, true);
      n++;
    });
    A.saveStore(); A.compute(); CACHE = null; A.closeDialog(); A.render();
    A.toast('Saved for ' + A.plural(n, 'drawing') + ' — shows in the Tracker too');
  }
  function acceptSugg(keys) {
    var B = build(), n = 0;
    B.rows.forEach(function (g) { if (keys.indexOf(g.key) >= 0 && g.r && g.sugg) { A.applyModel(g.r.key, g.sugg, true); n++; } });
    if (!n) { A.toast('No suggested models in the ticked rows'); return; }
    A.saveStore(); A.compute(); CACHE = null; A.render(); A.toast('Accepted ' + A.plural(n, 'suggested model'));
  }

  /* ---------- the view ---------- */
  var KINDS = [['', 'All'], ['ok', '✅ Complete'], ['half', 'PDF / DWG missing'], ['needs', 'Needs Tower / Typology / Model'], ['nomidp', 'Not in MIDP'], ['dupe', 'Doubled'],
    ['unsorted', 'Not sorted yet'], ['sorted', 'Only in sorted'], ['both', 'Export + sorted'], ['other', 'Other files']];
  function cntTag(g, e) {
    var n = g ? (g.exts || {})[e] || 0 : 0, ne = g ? (g.extE || {})[e] || 0 : 0, ns = g ? (g.extS || {})[e] || 0 : 0, dbl = ne > 1 || ns > 1;
    return '<span class="tag ' + (!n ? 'c-bad' : dbl ? 'c-warn' : 'c-ok') + '" title="' + (n ? 'Export folder: ' + ne + ' · sorted: ' + ns + (dbl ? ' — doubled' : '') : 'Not in the folder') + '">' + (n ? '✓' : '✗') + ' ' + esc(e.toUpperCase()) + (n > 1 ? ' ×' + n : '') + (dbl ? ' ⚠' : '') + '</span>';
  }
  function whereTag(g) {
    if (!g || (!g.nExp && !g.nSrt)) return '<span class="tag c-bad">not in the folder</span>';
    return (g.nExp ? '<span class="tag c-mute" title="Still in the export folder, not sorted yet">Export ' + g.nExp + '</span> ' : '') + (g.nSrt ? '<span class="tag c-info" title="In _Sorted / the target folder">Sorted ' + g.nSrt + '</span>' : '');
  }
  /* 📋 the submission list as the checklist: every drawing of the list, where it is, how many files */
  function listView(B, u) {
    var L = B.list, q = U(u.q), req = u.req, f = u.lf || '';
    var st = function (x) { var g = x.g; return !g ? 'missing' : req.some(function (e) { return !g.exts[e]; }) ? 'part' : 'in'; };
    var c = { '': L.length, in: 0, part: 0, missing: 0, dupe: 0, unsorted: 0, sorted: 0 };
    L.forEach(function (x) { c[st(x)]++; if (x.listTwice || (x.g && x.g.dupe)) c.dupe++; if (x.g && x.g.nExp) c.unsorted++; if (x.g && x.g.nSrt) c.sorted++; });
    var F2 = [['', 'All in the list'], ['in', '✅ In the folder'], ['part', 'A file missing'], ['missing', '❌ Not in the folder'], ['dupe', 'Doubled'], ['unsorted', 'Still in export folder'], ['sorted', 'In sorted']];
    var h = '<div class="toolbar"><div class="chips">' + F2.map(function (k) { return '<button class="chip" type="button" data-act="fdlf" data-v="' + k[0] + '" aria-pressed="' + (f === k[0]) + '">' + esc(k[1]) + '<span class="c">' + (c[k[0]] || 0) + '</span></button>'; }).join('') + '</div>' +
      '<span class="grow"></span><input type="search" id="fdQ" data-fd="q" placeholder="Search number, title, folder" value="' + esc(u.q) + '"></div>';
    var rows = L.filter(function (x) {
      if (f === 'dupe') return x.listTwice || (x.g && x.g.dupe);
      if (f === 'unsorted') return x.g && x.g.nExp;
      if (f === 'sorted') return x.g && x.g.nSrt;
      return !f || st(x) === f;
    });
    if (q) rows = rows.filter(function (x) { return U([x.num, x.title, x.g ? Object.keys(x.g.paths).join(' ') : ''].join(' ')).indexOf(q) >= 0; });
    var MT = { exact: ['Match', 'c-ok'], rev: ['Match · other rev', 'c-ok'], title: ['Title only', 'c-warn'], none: ['Not in MIDP', 'c-bad'] };
    var cols = [
      { k: 'idx', label: '#', w: 46, cls: 'num', text: function (x) { return String(x.idx); }, sortKey: function (x) { return x.idx; } },
      { k: 'num', label: 'Number (in the list)', w: 250, stick: true, cls: 'mono', text: function (x) { return x.num; }, html: function (x) { return (x.r ? A.numLink(x.num, x.r.key) : esc(x.num)) + (x.listTwice ? ' <span class="tag c-warn" title="This drawing is in the submission list more than once">twice in list</span>' : ''); } },
      { k: 'midp', label: 'MIDP', w: 130, text: function (x) { return (MT[x.match] || MT.none)[0]; }, html: function (x) { var m = MT[x.match] || MT.none; return A.tag(m[0], m[1], false, x.r ? x.r.num : ''); } },
      { k: 'title', label: 'Title', w: 300, text: function (x) { return x.title || ''; } },
      { k: 'in', label: 'In folder', w: 110, text: function (x) { return { in: 'Yes', part: 'File missing', missing: 'No' }[st(x)]; }, html: function (x) { var s2 = st(x); return A.tag({ in: '✓ Yes', part: 'File missing', missing: '✗ No' }[s2], { in: 'c-ok', part: 'c-warn', missing: 'c-bad' }[s2]); } }
    ].concat(req.map(function (e) {
      return { k: 'x' + e, label: e.toUpperCase(), w: 76, text: function (x) { return String(x.g ? x.g.exts[e] || 0 : 0); }, html: function (x) { return cntTag(x.g, e); }, sortKey: function (x) { return x.g ? x.g.exts[e] || 0 : 0; } };
    })).concat([
      { k: 'where', label: 'Where', w: 150, text: function (x) { return x.g ? (x.g.nExp ? 'Export ' + x.g.nExp + ' ' : '') + (x.g.nSrt ? 'Sorted ' + x.g.nSrt : '') : ''; }, html: function (x) { return whereTag(x.g); } },
      { k: 'rev', label: 'Rev in folder', w: 90, text: function (x) { return x.g ? x.g.rev : ''; } },
      { k: 'path', label: 'Subfolder', w: 240, text: function (x) { return x.g ? Object.keys(x.g.paths).join(', ') : ''; } }
    ]);
    return h + A.grid('folderlist', rows, cols, { title: 'Submission checklist', key: function (x) { return x.key; }, empty: 'Nothing here.' }).html;
  }
  function tagSrc(v, src) {
    if (!v) return '<span class="tag c-bad">missing</span>';
    var c = { set: 'c-ok', number: 'c-info', title: 'c-info', suggested: 'c-warn', guess: 'c-warn' }[src] || 'c-mute';
    return esc(v) + (src && src !== 'set' ? ' <span class="tag ' + c + '" title="' + esc({ number: 'From the drawing number', title: 'From the title', suggested: 'Suggested — not confirmed yet', guess: 'Guessed from the number family — confirm it with ✎' }[src] || '') + '">' + esc(src) + '</span>' : '');
  }
  /* 🌳 the folders as they are on disk: click a folder, see what is inside */
  function treeView(B, u) {
    var nodes = {}, req = u.req;
    var node = function (path) { if (!nodes[path]) nodes[path] = { path: path, files: [], all: 0 }; return nodes[path]; };
    node('');
    F.files.forEach(function (f) {
      node(f[0]).files.push(f);
      var parts = f[0] ? f[0].replace(/\/$/, '').split('/') : [];
      node('').all++;
      for (var i = 1; i <= parts.length; i++) { node(parts.slice(0, i).join('/') + '/').all++; }
    });
    var paths = Object.keys(nodes).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); });
    var cur = nodes[u.tf || ''] ? u.tf || '' : '';
    var byBase = new Map(); B.rows.forEach(function (g) { byBase.set(g.base, g); });
    var left = '<div class="fd-tl">' + paths.map(function (p) {
      var depth = p ? p.split('/').length - 1 : 0, name = p ? p.replace(/\/$/, '').split('/').pop() : (F.root || 'Export folder');
      var n = nodes[p], here = n.files.length;
      return '<button type="button" class="fd-ti' + (p === cur ? ' on' : '') + (/^_|^@/.test(name) ? ' srt' : '') + '" data-act="fdtf" data-v="' + esc(p) + '" style="padding-left:' + (6 + depth * 14) + 'px" title="' + esc(p || F.root) + '">' +
        (depth ? '└ ' : '') + '📁 ' + esc(name) + ' <span class="c" title="' + here + ' directly in this folder, ' + n.all + ' with its subfolders">' + n.all + '</span></button>';
    }).join('') + '</div>';
    // inside the chosen folder: one line per drawing (PDF + DWG together), then other files
    var groups = {}, others = [];
    nodes[cur].files.forEach(function (f) {
      var p = parseName(f[1]);
      if (!p.num) { others.push(f); return; }
      var g = groups[p.base] || (groups[p.base] = { base: p.base, num: p.num, revs: {}, exts: {} });
      if (p.rev) g.revs[p.rev] = 1; g.exts[p.ext] = (g.exts[p.ext] || 0) + 1;
    });
    var listed = new Set((B.list || []).map(function (x) { return x.base; }));
    var body = Object.keys(groups).sort().map(function (k) {
      var g = groups[k], m = byBase.get(k), r = m && m.r;
      var types = req.map(function (e) { var n = g.exts[e] || 0; return '<span class="tag ' + (!n ? 'c-bad' : n > 1 ? 'c-warn' : 'c-ok') + '">' + (n ? '✓' : '✗') + ' ' + esc(e.toUpperCase()) + (n > 1 ? ' ×' + n : '') + '</span>'; }).join(' ') +
        Object.keys(g.exts).filter(function (e) { return req.indexOf(e) < 0; }).map(function (e) { return ' <span class="tag c-mute">' + esc(e) + '</span>'; }).join('');
      return '<tr><td class="mono">' + (r ? A.numLink(g.num, r.key) : esc(g.num)) + '</td><td>' + esc(Object.keys(g.revs).join(', ') || '—') + '</td><td>' + types + '</td>' +
        '<td>' + (r ? esc(r.title) : '<span class="tag c-bad">Not in MIDP</span>') + '</td>' +
        '<td>' + (m && m.r ? esc([m.tower, m.typ ? T.drawingUnitKey(m.typ) : '', m.model ? m.model.split('-').pop() : ''].filter(Boolean).join(' · ')) || '<span class="tag c-bad">missing</span>' : '') + '</td>' +
        (B.sb ? '<td>' + (listed.has(k) ? A.tag('In the list', 'c-ok') : A.tag('Not in the list', 'c-mute')) + '</td>' : '') + '</tr>';
    }).join('');
    var nd = Object.keys(groups).length;
    var right = '<div class="fd-tr"><h3 style="margin:0 0 6px">📁 ' + esc(cur || F.root || 'Export folder') + '</h3><p class="hint" style="margin:0 0 8px">' +
      A.plural(nd, 'drawing') + ' · ' + A.plural(nodes[cur].files.length, 'file') + ' directly in this folder' + (nodes[cur].all > nodes[cur].files.length ? ' · ' + nodes[cur].all + ' with its subfolders' : '') + '</p>' +
      (nd ? '<div class="fd-ttw"><table class="fd-tt"><thead><tr><th>Drawing</th><th>Rev</th><th>Files</th><th>MIDP title</th><th>Tower · Typology · Model</th>' + (B.sb ? '<th>Submission list</th>' : '') + '</tr></thead><tbody>' + body + '</tbody></table></div>' : '') +
      (others.length ? '<p class="hint" style="margin:8px 0 2px">Other files</p>' + others.map(function (f) { return '<div class="mono hint">' + esc(f[1]) + '</div>'; }).join('') : '') +
      (!nd && !others.length ? '<div class="box empty">No files directly in this folder — open a subfolder on the left.</div>' : '') + '</div>';
    return '<div class="fd-tree2">' + left + right + '</div>';
  }

  /* 🗂 the sorting box (same in both views) */
  function sortHtml(u) {
    var h = '';
    var pl = plan(), tr = tree(pl);
    h += '<div class="box fd-sort"><h2 style="margin:0 0 6px">🗂 Sort the files into folders</h2>' +
      '<div class="toolbar"><span class="hint">Group by (in order):</span>' + Object.keys(DIMS).map(function (k) {
        var i = u.group.indexOf(k); return '<button class="chip" type="button" data-act="fdgrp" data-v="' + k + '" aria-pressed="' + (i >= 0) + '">' + (i >= 0 ? (i + 1) + '. ' : '') + esc(DIMS[k].label) + '</button>';
      }).join('') + '<span class="grow"></span><label class="hint"><input type="radio" name="fdmode" data-fd="mode" value="copy"' + (u.mode !== 'move' ? ' checked' : '') + '> Copy (originals stay)</label>' +
      '<label class="hint"><input type="radio" name="fdmode" data-fd="mode" value="move"' + (u.mode === 'move' ? ' checked' : '') + '> Move</label></div>' +
      '<div class="fd-tgt"><b>Target folder</b>' +
        (canPick ? '<span class="fd-tg"><span class="hint">Sort now →</span> ' + (u.tname ? '<span class="tag c-ok">📂 ' + esc(u.tname) + '</span> <button class="btn small" type="button" data-act="fdtclear" title="Back to _Sorted inside the export folder">✕</button>' : '<span class="hint">_Sorted inside ' + esc(F.root) + '</span>') +
          ' <button class="btn small" type="button" data-act="fdtarget">📂 Choose…</button></span>' : '') +
        '<label class="fd-tg"><span class="hint">.bat file →</span> <input type="text" data-fd="tpath" value="' + esc(u.tpath) + '" placeholder="e.g. D:\\Submissions\\IFC 2026-11  (empty = _Sorted next to the .bat)"' + (pathOk(u.tpath) ? '' : ' style="border-color:var(--bad)"') + '></label>' +
        '<span class="hint">Tip: copy the path from the File Explorer address bar. The folder is made if it does not exist.</span></div>' +
      '<p class="hint" style="margin:4px 0">Only files still in the export folder are sorted (files already in _Sorted / the target are left alone). Example: <span class="mono">' + esc(u.tname || u.tpath || '_Sorted') + '\\' + esc((tr[0] || ['Tower1\\1BRA'])[0]) + '</span>. PDF and DWG of a drawing stay together. Drawings missing a Tower / Typology / Model go to <b>_ToCheck</b>, unknown numbers to <b>_Not in MIDP</b>, other files to <b>_Other files</b>. Nothing is deleted; files already there are skipped.</p>' +
      '<div class="fd-tree">' + tr.slice(0, 60).map(function (t) { return '<span class="fd-node' + (/^_/.test(t[0]) ? ' warn' : '') + '">📁 ' + esc(t[0]) + ' <b>' + t[1] + '</b></span>'; }).join('') + (tr.length > 60 ? '<span class="hint">+' + (tr.length - 60) + ' more folders</span>' : '') + '</div>' +
      '<div class="toolbar" style="margin-top:8px">' + (canPick ? '<button class="btn primary" type="button" data-act="fdsort"' + (BUSY ? ' disabled' : '') + '>🗂 Sort now (' + pl.length + ' files)</button>' : '') +
      '<button class="btn" type="button" data-act="fdbat" title="A .bat file: put it inside the export folder and double-click it">⬇ Sorting file (.bat)</button>' +
      '<button class="btn" type="button" data-act="fdundo" title="Puts everything back the way it was">⬇ Undo file (.bat)</button></div></div>';
    return h;
  }
  A.VIEWS.folder = function () {
    var u = F.ui, B = F.files.length ? build() : null;
    var h = '<div class="fd-top box"><div class="toolbar" style="margin:0">' +
      '<button class="btn primary" type="button" data-act="fdconnect">📁 ' + (F.root ? 'Change folder' : 'Connect the export folder') + '</button>' +
      (F.root ? '<button class="btn" type="button" data-act="fdrescan"' + (BUSY ? ' disabled' : '') + '>↻ Rescan</button><span class="hint"><b>' + esc(F.root) + '</b> · ' + F.files.length + ' files · read ' + esc(new Date(F.at).toLocaleString()) +
        (F.newN ? ' · <b style="color:var(--ok)">' + F.newN + ' new</b>' : '') + (F.goneN ? ' · ' + F.goneN + ' gone' : '') + '</span>' : '<span class="hint">Only the file names are read — nothing is opened or uploaded.' + (canPick ? ' Edge remembers the folder: next time just ↻ Rescan.' : '') + '</span>') +
      '<span class="grow"></span><label class="hint"><input type="checkbox" data-fd="deep"' + (u.deep ? ' checked' : '') + '> Include subfolders</label>' +
      '<input type="file" id="fdPick" webkitdirectory multiple hidden></div>';
    if (BUSY) h += '<div class="hint" style="margin-top:6px">Reading…</div>';
    h += '</div>';
    if (!B) return h + '<div class="box empty"><b>No folder read yet</b>Connect the folder where the drawings are exported (e.g. C:\\BIM works\\EXPORTS\\IFC Prints). Load the submission list first in Files, to check what is ready, missing or extra.</div>';

    var all = B.rows, exts = {};
    F.files.forEach(function (f) { var e = parseName(f[1]).ext; if (e) exts[e] = (exts[e] || 0) + 1; });
    var counts = { '': all.length + B.other.length, other: B.other.length, dupe: 0 };
    all.forEach(function (g) { var s = stateOf(g); counts[s] = (counts[s] || 0) + 1; if (g.dupe) counts.dupe++; counts[g.place] = (counts[g.place] || 0) + 1; });
    // required file types + submission list
    h += '<div class="toolbar"><span class="hint">Each drawing needs:</span>' + Object.keys(exts).sort().map(function (e) {
      return '<label class="chip" style="cursor:pointer"><input type="checkbox" data-fdreq="' + esc(e) + '"' + (u.req.indexOf(e) >= 0 ? ' checked' : '') + ' style="margin-right:4px">.' + esc(e) + '<span class="c">' + exts[e] + '</span></label>';
    }).join('') + '<span class="grow"></span><label class="hint">Check against <select data-fd="sub"><option value="">— no submission list —</option>' +
      A.subsByDate().map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === u.sub ? ' selected' : '') + '>' + esc(A.subHead(x)) + ' (' + (x.items || []).length + ')</option>'; }).join('') + '</select></label></div>';
    if (B.sb) {
      var t = { Ready: 0, Part: 0, Extra: 0 }; all.forEach(function (g) { if (g.target) t[g.target]++; });
      h += '<div class="kpis fd-k"><button class="kpi" type="button" data-act="fdf" data-v="t:Ready"><span class="v" style="color:var(--ok)">' + t.Ready + '</span><span class="l">Ready</span></button>' +
        '<button class="kpi" type="button" data-act="fdf" data-v="t:Part"><span class="v" style="color:var(--warn)">' + t.Part + '</span><span class="l">In folder, a file missing</span></button>' +
        '<button class="kpi" type="button" data-act="fdf" data-v="t:Missing"><span class="v" style="color:var(--bad)">' + B.missing.length + '</span><span class="l">Missing (expected)</span></button>' +
        '<button class="kpi" type="button" data-act="fdf" data-v="t:Extra"><span class="v">' + t.Extra + '</span><span class="l">Extra (not in the list)</span></button></div>';
    }
    var view = u.view === 'list' && !B.sb ? 'folder' : u.view || 'folder';
    h += '<div class="toolbar"><div class="chips">' + (B.sb ? '<button class="chip" type="button" data-act="fdview" data-v="list" aria-pressed="' + (view === 'list') + '">📋 By submission list</button>' : '') +
      '<button class="chip" type="button" data-act="fdview" data-v="folder" aria-pressed="' + (view === 'folder') + '">📁 By drawing</button>' +
      '<button class="chip" type="button" data-act="fdview" data-v="tree" aria-pressed="' + (view === 'tree') + '">🌳 Folder tree</button></div></div>';
    if (view === 'list') return h + listView(B, u) + sortHtml(u);
    if (view === 'tree') return h + treeView(B, u) + sortHtml(u);
    h += '<div class="toolbar"><div class="chips">' + KINDS.map(function (k) { return k[0] === '' || counts[k[0]] ? '<button class="chip" type="button" data-act="fdf" data-v="' + k[0] + '" aria-pressed="' + (u.f === k[0]) + '">' + esc(k[1]) + '<span class="c">' + (counts[k[0]] || 0) + '</span></button>' : ''; }).join('') +
      (/^t:/.test(u.f) ? '<button class="chip" type="button" data-act="fdf" data-v="' + esc(u.f) + '" aria-pressed="true">' + esc(u.f.slice(2)) + '</button>' : '') + '</div>' +
      '<span class="grow"></span><input type="search" id="fdQ" data-fd="q" placeholder="Search number, title, folder" value="' + esc(u.q) + '"></div>';

    // the list
    var q = U(u.q), list;
    if (u.f === 'other') list = B.other;
    else if (u.f === 't:Missing') list = B.missing;
    else list = all.filter(function (g) {
      if (u.f === 'dupe') return g.dupe;
      if (u.f === 'unsorted' || u.f === 'sorted' || u.f === 'both') return g.place === u.f;
      if (/^t:/.test(u.f)) return g.target === u.f.slice(2);
      return !u.f || stateOf(g) === u.f;
    });
    if (q) list = list.filter(function (g) { return U([g.num, g.name, g.title, g.path, Object.keys(g.paths || {}).join(' '), g.tower, g.typ, g.model].join(' ')).indexOf(q) >= 0; });
    var shown = new Set(list.map(function (g) { return g.key; }));
    sel.forEach(function (k) { if (!shown.has(k)) sel.delete(k); });
    if (sel.size) h += '<div class="banner info picked"><span><b>' + sel.size + ' ticked.</b></span><span class="toolbar" style="margin:0">' +
      '<button class="btn small primary" type="button" data-act="fdfix">✎ Set Tower / Typology / Model</button><button class="btn small" type="button" data-act="fdsugg">✓ Accept suggested models</button>' +
      '<button class="btn small" type="button" data-act="fdclear">Clear ticks</button></span></div>';
    var allOn = list.length && list.every(function (g) { return sel.has(g.key); });
    var cols = u.f === 'other' ? [
      { k: 'name', label: 'File', w: 340, cls: 'mono', text: function (o) { return o.name; } },
      { k: 'ext', label: 'Type', w: 70, text: function (o) { return o.ext; } },
      { k: 'path', label: 'Subfolder', w: 260, text: function (o) { return o.path || '(top)'; } }
    ] : [
      { k: 'pick', label: '', w: 34, stick: true, nosort: true, nofilter: true, head: '<input type="checkbox" data-act="fdall"' + (allOn ? ' checked' : '') + ' aria-label="Tick all">', text: function () { return ''; },
        html: function (g) { return g.absent ? '' : '<input type="checkbox" data-fdsel="' + esc(g.key) + '"' + (sel.has(g.key) ? ' checked' : '') + ' aria-label="Tick">'; } },
      { k: 'num', label: 'Drawing (as read)', w: 250, stick: true, cls: 'mono', text: function (g) { return g.num; }, html: function (g) { return g.r ? A.numLink(g.num, g.r.key) : esc(g.num); } },
      { k: 'rev', label: 'Rev', w: 64, text: function (g) { return g.absent ? '' : g.rev || '—'; } },
      { k: 'set', label: 'Set', w: 80, text: function (g) { return g.set || ''; } },
      { k: 'files', label: 'Files', w: 130, text: function (g) { return Object.keys(g.exts).join(' '); }, html: function (g) {
        return u.req.map(function (e) { return cntTag(g, e); }).join(' ') +
          Object.keys(g.exts).filter(function (e) { return u.req.indexOf(e) < 0; }).map(function (e) { return ' <span class="tag c-mute">' + esc(e) + '</span>'; }).join(''); } },
      { k: 'midp', label: 'MIDP', w: 300, text: function (g) { return g.r ? g.title : 'Not in MIDP'; }, html: function (g) {
        if (g.absent) return '<span class="tag c-bad">Not in the folder</span> ' + esc(g.title || '');
        if (g.r) return esc(g.title);
        return '<span class="tag c-bad">Not in MIDP</span>' + (g.near ? ' <span class="hint">did you mean</span> <span class="mono">' + esc(g.near.num) + '</span>?' : ''); } },
      { k: 'tower', label: 'Tower', w: 90, text: function (g) { return g.tower || ''; }, html: function (g) { return g.r && !g.absent ? tagSrc(g.tower, g.towerSrc) : ''; } },
      { k: 'typ', label: 'Typology', w: 230, text: function (g) { return g.typ || ''; }, html: function (g) { return !g.r || g.absent ? '' : g.needTyp || g.typ ? tagSrc(g.typ, g.typSrc) : '<span class="muted">— common</span>'; } },
      { k: 'model', label: 'Model', w: 220, text: function (g) { return g.model || (g.sugg ? g.sugg.num : ''); }, html: function (g) {
        if (!g.r || g.absent) return '';
        if (g.model) return '<span class="mono">' + esc(g.model) + '</span>';
        return g.sugg ? '<span class="mono">' + esc(g.sugg.num) + '</span> <button class="btn small" type="button" data-act="fdsugg1" data-v="' + esc(g.key) + '" title="Accept the suggested model">✓</button>' : '<span class="tag c-bad">missing</span>'; } },
      { k: 'fix', label: '', w: 44, nosort: true, nofilter: true, text: function () { return ''; }, html: function (g) { return g.r && !g.absent ? '<button class="btn small" type="button" data-act="fdfix1" data-v="' + esc(g.key) + '" title="Set Tower / Typology / Model">✎</button>' : ''; } },
      { k: 'tgt', label: 'Submission', w: 100, text: function (g) { return g.target || ''; }, html: function (g) { return g.target ? A.tag(g.target === 'Part' ? 'File missing' : g.target, { Ready: 'c-ok', Part: 'c-warn', Missing: 'c-bad', Extra: 'c-mute' }[g.target]) : ''; } },
      { k: 'where', label: 'Where', w: 150, text: function (g) { return g.absent ? '' : (g.nExp ? 'Export ' + g.nExp + ' ' : '') + (g.nSrt ? 'Sorted ' + g.nSrt : ''); }, html: function (g) { return g.absent ? '' : whereTag(g); } },
      { k: 'path', label: 'Subfolder', w: 180, text: function (g) { return Object.keys(g.paths || {}).join(', '); } }
    ];
    h += A.grid('folder', list, cols, { title: 'Folder check', key: function (g) { return g.key; }, empty: 'Nothing here.' }).html;

    return h + sortHtml(u);
  };

  /* ---------- buttons ---------- */
  Object.assign(A.ACTIONS, {
    fdconnect: connect,
    fdrescan: function () { rescan(); },
    fdf: function (el) { var v = el.getAttribute('data-v'); F.ui.f = F.ui.f === v && v ? '' : v; save(); A.render(); },
    fdall: function (el) { document.querySelectorAll('[data-fdsel]').forEach(function (b) { if (el.checked) sel.add(b.getAttribute('data-fdsel')); else sel.delete(b.getAttribute('data-fdsel')); }); A.render(); },
    fdclear: function () { sel.clear(); A.render(); },
    fdfix: function () { fixDialog(Array.from(sel)); },
    fdfix1: function (el) { fixDialog([el.getAttribute('data-v')]); },
    fdfixsave: function (el) { fixSave(el.getAttribute('data-v').split('|')); },
    fdsugg: function () { acceptSugg(Array.from(sel)); },
    fdsugg1: function (el) { acceptSugg([el.getAttribute('data-v')]); },
    fdgrp: function (el) {
      var k = el.getAttribute('data-v'), g = F.ui.group, i = g.indexOf(k);
      if (i >= 0) g.splice(i, 1); else g.push(k);
      if (!g.length) g.push('tower');
      save(); A.render();
    },
    fdsort: sortNow,
    fdtf: function (el) { F.ui.tf = el.getAttribute('data-v'); save(); A.render(); },
    fdview: function (el) { F.ui.view = el.getAttribute('data-v'); save(); A.render(); },
    fdlf: function (el) { var v = el.getAttribute('data-v'); F.ui.lf = F.ui.lf === v && v ? '' : v; save(); A.render(); },
    fdtarget: function () {
      window.showDirectoryPicker({ id: 'midp-sorted', mode: 'readwrite' }).then(function (h) {
        var inside = H.root && H.root.resolve ? H.root.resolve(h) : Promise.resolve(null);
        return inside.then(function (rel) {
          if (rel && !rel.length) { A.toast('That is the export folder itself — pick another folder (or make a new one inside it)'); return; }
          H.target = h; keepTarget(h);
          F.ui.tname = h.name; F.ui.tskip = rel && rel.length ? rel.join('/') + '/' : ''; save(); A.render();
          A.toast('📂 Sorted files will go to “' + h.name + '”' + (F.ui.tskip ? ' (inside the export folder — it is left out when reading)' : ''));
        });
      }).catch(function (e) { if (e.name !== 'AbortError') A.toast('Folder not chosen: ' + e.message); });
    },
    fdtclear: function () { H.target = null; keepTarget(null); F.ui.tname = ''; F.ui.tskip = ''; save(); A.render(); },
    fdbat: function () {
      if (!pathOk(F.ui.tpath)) { A.toast('The target path should look like D:\\Submissions\\IFC or \\\\server\\share\\folder'); return; }
      var pl = plan(); download('Sort_files_' + F.ui.group.join('-') + '_' + T.todayIso() + '.bat', bat(pl, F.ui.mode)); A.toast('⬇ Put the .bat inside ' + F.root + ' and double-click it' + (F.ui.tpath ? ' — files go to ' + F.ui.tpath : '')); },
    fdundo: function () { download('Undo_sort_' + T.todayIso() + '.bat', undoBat(plan(), F.ui.mode)); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'fdPick') { if (el.files && el.files.length) fromInput(el.files); el.value = ''; return; }
    if (el.matches && el.matches('[data-fdsel]')) { var k = el.getAttribute('data-fdsel'); if (el.checked) sel.add(k); else sel.delete(k); A.render(); return; }
    if (el.matches && el.matches('[data-fdreq]')) {
      var x = el.getAttribute('data-fdreq'), r = F.ui.req.filter(function (y) { return y !== x; }); if (el.checked) r.push(x); F.ui.req = r; save(); A.render(); return;
    }
    var f = el.getAttribute && el.getAttribute('data-fd');
    if (!f || f === 'q') return;
    F.ui[f] = el.type === 'checkbox' ? el.checked : el.value; save();
    if (f === 'deep' && F.root) { if (H.root || canPick) rescan(); else A.toast('Pick the folder again to apply this'); }
    A.render();
  });
  var qT = null;
  document.addEventListener('input', function (e) { if (e.target.id === 'fdQ') { clearTimeout(qT); var v = e.target.value; qT = setTimeout(function () { F.ui.q = v; save(); A.render(); }, 200); } });

  // refresh after each compute (new MIDP, model list, your edits)
  var ext = window.MIDP_EXT || (window.MIDP_EXT = {}), prevAfter = ext.afterCompute;
  ext.afterCompute = function () { if (prevAfter) prevAfter(); CACHE = null; };
  window.MIDP_FOLDER_COUNT = function () { return F.files.length ? build().rows.length : '–'; };

  var css = document.createElement('style');
  css.textContent = '.fd-top{padding:10px 12px;margin-bottom:10px}.fd-k{margin:8px 0}.fd-k .kpi{cursor:pointer;text-align:left}' +
    '.fd-sort{margin-top:14px;padding:12px}.fd-tree{display:flex;flex-wrap:wrap;gap:6px;max-height:220px;overflow:auto}' +
    '.fd-node{font-size:12px;border:1px solid var(--edge);padding:3px 8px;background:var(--panel)}.fd-node b{color:var(--accent);margin-left:4px}.fd-node.warn{border-style:dashed}' +
    '.fd-tgt{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:6px 0;padding:8px;border:1px dashed var(--edge)}.fd-tg{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}.fd-tg input{min-width:260px;max-width:100%}' +
    '.fd-tree2{display:grid;grid-template-columns:minmax(200px,280px) 1fr;gap:12px;align-items:start}.fd-tl{border:1px solid var(--edge);background:var(--panel);max-height:70vh;overflow:auto;padding:4px 0}' +
    '.fd-ti{display:flex;align-items:center;gap:4px;width:100%;text-align:left;border:0;background:none;color:var(--ink);font:inherit;font-size:13px;padding:5px 8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.fd-ti:hover{background:var(--raise)}.fd-ti.on{background:var(--raise);font-weight:700;box-shadow:inset 3px 0 0 var(--accent)}.fd-ti.srt{color:var(--info)}.fd-ti .c{margin-left:auto;color:var(--muted);font-size:11px}' +
    '.fd-tr{min-width:0}.fd-ttw{overflow-x:auto;border:1px solid var(--edge)}.fd-tt{width:100%;border-collapse:collapse}.fd-tt td,.fd-tt th{padding:5px 8px;font-size:13px;text-align:left;vertical-align:top;border-bottom:1px solid var(--edge)}.fd-tt th{background:var(--raise);white-space:nowrap}.fd-tt td:first-child{white-space:nowrap}' +
    '@media (max-width:760px){.fd-tree2{grid-template-columns:1fr}.fd-tl{max-height:40vh}}';
  document.head.appendChild(css);
};
