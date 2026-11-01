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
  F.ui = Object.assign({ deep: true, req: ['pdf', 'dwg'], sub: '', group: ['tower', 'typ'], mode: 'copy', f: '', q: '' }, F.ui || {});
  var H = { root: null, files: new Map(), dirs: new Map() };     // handles of the last scan (this session only)
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

  /* ---------- reading the folder ---------- */
  function walk(dir, path, out) {
    var it = dir.entries(), next = function () {
      return it.next().then(function (st) {
        if (st.done) return;
        var name = st.value[0], h = st.value[1];
        if (h.kind === 'file') {
          if (/^(Sort_files_|Undo_sort_).*\.bat$/i.test(name)) return next();          // our own sorting files
          return h.getFile().then(function (f) { out.push([path, name, f.size, f.lastModified]); H.files.set(path + name, h); H.dirs.set(path, dir); }).then(next, next);
        }
        if (!F.ui.deep || /^_Sorted/i.test(name)) return next();
        return walk(h, path + name + '/', out).then(next);
      });
    };
    return next();
  }
  function scan(h) {
    BUSY = true; A.render();
    var out = []; H.files = new Map(); H.dirs = new Map();
    return walk(h, '', out).then(function () { took(h.name, out); }).catch(function (e) { A.toast('Could not read the folder: ' + e.message); })
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
      if (/^_Sorted/i.test(path) || /^(Sort_files_|Undo_sort_).*\.bat$/i.test(name)) return;
      out.push([path, name, f.size, f.lastModified]);
    });
    var root = list[0] && list[0].webkitRelativePath ? list[0].webkitRelativePath.split('/')[0] : 'folder';
    H.root = null; took(root, out); A.render();
  }

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
      if (!p.num) { other.push({ other: true, key: 'o:' + f[0] + f[1], path: f[0], name: f[1], ext: p.ext, files: [f] }); return; }
      var g = groups.get(p.base);
      if (!g) { g = { key: p.base, base: p.base, nums: {}, revs: {}, exts: {}, paths: {}, files: [] }; groups.set(p.base, g); }
      g.nums[p.num] = 1; if (p.rev) g.revs[p.rev] = 1; g.exts[p.ext] = (g.exts[p.ext] || 0) + 1; g.paths[f[0] || '(top)'] = 1; g.files.push(f);
    });
    var rows = [];
    groups.forEach(function (g) {
      var r = by.get(g.base) || null, revs = Object.keys(g.revs);
      g.num = Object.keys(g.nums)[0]; g.rev = revs.join(', '); g.set = revs.map(setOf).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(', ');
      g.r = r; g.near = r ? null : nearest(g.base, by);
      g.missingExt = req.filter(function (x) { return !g.exts[x]; });
      g.dupe = revs.length > 1 || Object.keys(g.paths).length > 1 || Object.keys(g.exts).some(function (x) { return g.exts[x] > 1; });
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
    CACHE = { rows: rows, other: other, missing: missing, sb: sb };
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
      g.files.forEach(function (f) { out.push({ p: f[0], n: f[1], dst: dst.join('\\') }); });
    });
    B.other.forEach(function (o) { out.push({ p: o.path, n: o.name, dst: '_Other files' }); });
    return out;
  }
  function tree(pl) {
    var c = {}; pl.forEach(function (x) { c[x.dst] = (c[x.dst] || 0) + 1; });
    return Object.keys(c).sort().map(function (k) { return [k, c[k]]; });
  }

  /* .bat that works on the folder it sits in — no path to type */
  function bat(pl, mode) {
    var verb = mode === 'move' ? 'move' : 'copy', done = mode === 'move' ? 'MOVED ' : 'COPIED';
    var q = function (s) { return s.replace(/%/g, '%%').replace(/"/g, ''); };
    var L = ['@echo off', 'rem -- Lews Tracker - MIDP Checker - sort the drawings into folders --',
      'rem Put this file INSIDE the export folder and double-click it.',
      'rem Grouping: ' + F.ui.group.map(function (k) { return DIMS[k].label; }).join(' then ') + ' - ' + (mode === 'move' ? 'MOVE' : 'COPY (originals stay)') + ' - made ' + new Date().toLocaleString(),
      'setlocal', 'chcp 65001 >nul', 'cd /d "%~dp0"', 'set "OUT=%~dp0_Sorted"', 'if not exist "%OUT%" mkdir "%OUT%"', 'set "LOG=%OUT%\\sort-log.txt"',
      'echo ==== %date% %time% ====>>"%LOG%"', 'set /a N=0', 'set /a K=0', ''];
    pl.forEach(function (x) { L.push('call :put "' + q((x.p + x.n).replace(/\//g, '\\')) + '" "' + q(x.dst) + '"'); });
    L.push('', 'echo.', 'echo Done: %N% files ' + (mode === 'move' ? 'moved' : 'copied') + ', %K% skipped. Details: _Sorted\\sort-log.txt', 'pause', 'exit /b', '',
      ':put', 'if not exist "%~1" (echo NOT FOUND   %~1>>"%LOG%" & set /a K+=1 & exit /b)', 'if not exist "%OUT%\\%~2" mkdir "%OUT%\\%~2"',
      'if exist "%OUT%\\%~2\\%~nx1" (echo ALREADY THERE   %~2\\%~nx1>>"%LOG%" & set /a K+=1 & exit /b)',
      verb + ' "%~1" "%OUT%\\%~2\\" >nul && (set /a N+=1 & echo ' + done + '   %~1  -^>  %~2>>"%LOG%")', 'exit /b', '');
    return L.join('\r\n');
  }
  function undoBat(pl, mode) {
    var q = function (s) { return s.replace(/%/g, '%%').replace(/"/g, ''); };
    var L = ['@echo off', 'rem -- Undo the sort made on ' + new Date().toLocaleString() + ' --', 'rem Put this file in the same export folder and double-click it.',
      'setlocal', 'chcp 65001 >nul', 'cd /d "%~dp0"', 'set "OUT=%~dp0_Sorted"', ''];
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
    if (!confirm((mode === 'move' ? 'MOVE ' : 'Copy ') + pl.length + ' files into the folder “_Sorted” inside ' + F.root + '?\n\n' + (mode === 'move' ? 'The files leave their current place (an undo .bat is downloaded).' : 'The originals stay where they are.') + ' Files already in _Sorted are skipped.')) return;
    var root;
    rescan().then(function () {
      root = H.root; if (!root) throw new Error('Connect the folder first (Edge / Chrome)');
      return root.requestPermission({ mode: 'readwrite' });
    }).then(function (p) {
      if (p !== 'granted') throw new Error('Edge needs “Save changes” permission to make the folders');
      BUSY = true; A.render();
      return root.getDirectoryHandle('_Sorted', { create: true });
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
            A.toast('📁 ' + n + ' files ' + (mode === 'move' ? 'moved' : 'copied') + ' into _Sorted' + (skip ? ' · ' + skip + ' skipped (see sort-log.txt)' : ''));
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
  var KINDS = [['', 'All'], ['ok', '✅ Complete'], ['half', 'PDF / DWG missing'], ['needs', 'Needs Tower / Typology / Model'], ['nomidp', 'Not in MIDP'], ['dupe', 'Two copies / revisions'], ['other', 'Other files']];
  function tagSrc(v, src) {
    if (!v) return '<span class="tag c-bad">missing</span>';
    var c = { set: 'c-ok', number: 'c-info', title: 'c-info', suggested: 'c-warn', guess: 'c-warn' }[src] || 'c-mute';
    return esc(v) + (src && src !== 'set' ? ' <span class="tag ' + c + '" title="' + esc({ number: 'From the drawing number', title: 'From the title', suggested: 'Suggested — not confirmed yet', guess: 'Guessed from the number family — confirm it with ✎' }[src] || '') + '">' + esc(src) + '</span>' : '');
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
    all.forEach(function (g) { var s = stateOf(g); counts[s] = (counts[s] || 0) + 1; if (g.dupe) counts.dupe++; });
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
    h += '<div class="toolbar"><div class="chips">' + KINDS.map(function (k) { return k[0] === '' || counts[k[0]] ? '<button class="chip" type="button" data-act="fdf" data-v="' + k[0] + '" aria-pressed="' + (u.f === k[0]) + '">' + esc(k[1]) + '<span class="c">' + (counts[k[0]] || 0) + '</span></button>' : ''; }).join('') +
      (/^t:/.test(u.f) ? '<button class="chip" type="button" data-act="fdf" data-v="' + esc(u.f) + '" aria-pressed="true">' + esc(u.f.slice(2)) + '</button>' : '') + '</div>' +
      '<span class="grow"></span><input type="search" id="fdQ" data-fd="q" placeholder="Search number, title, folder" value="' + esc(u.q) + '"></div>';

    // the list
    var q = U(u.q), list;
    if (u.f === 'other') list = B.other;
    else if (u.f === 't:Missing') list = B.missing;
    else list = all.filter(function (g) {
      if (u.f === 'dupe') return g.dupe;
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
        return u.req.map(function (e) { return '<span class="tag ' + (g.exts[e] ? 'c-ok' : 'c-bad') + '">' + (g.exts[e] ? '✓' : '✗') + ' ' + esc(e.toUpperCase()) + '</span>'; }).join(' ') +
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
      { k: 'path', label: 'Subfolder', w: 180, text: function (g) { return Object.keys(g.paths || {}).join(', '); } }
    ];
    h += A.grid('folder', list, cols, { title: 'Folder check', key: function (g) { return g.key; }, empty: 'Nothing here.' }).html;

    // sorting
    var pl = plan(), tr = tree(pl);
    h += '<div class="box fd-sort"><h2 style="margin:0 0 6px">🗂 Sort the files into folders</h2>' +
      '<div class="toolbar"><span class="hint">Group by (in order):</span>' + Object.keys(DIMS).map(function (k) {
        var i = u.group.indexOf(k); return '<button class="chip" type="button" data-act="fdgrp" data-v="' + k + '" aria-pressed="' + (i >= 0) + '">' + (i >= 0 ? (i + 1) + '. ' : '') + esc(DIMS[k].label) + '</button>';
      }).join('') + '<span class="grow"></span><label class="hint"><input type="radio" name="fdmode" data-fd="mode" value="copy"' + (u.mode !== 'move' ? ' checked' : '') + '> Copy (originals stay)</label>' +
      '<label class="hint"><input type="radio" name="fdmode" data-fd="mode" value="move"' + (u.mode === 'move' ? ' checked' : '') + '> Move</label></div>' +
      '<p class="hint" style="margin:4px 0">Everything goes into a folder <b>_Sorted</b> inside ' + esc(F.root) + ' — e.g. <span class="mono">_Sorted\\' + esc((tr[0] || ['Tower1\\1BRA'])[0]) + '</span>. PDF and DWG of a drawing stay together. Drawings missing a Tower / Typology / Model go to <b>_ToCheck</b>, unknown numbers to <b>_Not in MIDP</b>, other files to <b>_Other files</b>. Nothing is deleted; files already there are skipped.</p>' +
      '<div class="fd-tree">' + tr.slice(0, 60).map(function (t) { return '<span class="fd-node' + (/^_/.test(t[0]) ? ' warn' : '') + '">📁 ' + esc(t[0]) + ' <b>' + t[1] + '</b></span>'; }).join('') + (tr.length > 60 ? '<span class="hint">+' + (tr.length - 60) + ' more folders</span>' : '') + '</div>' +
      '<div class="toolbar" style="margin-top:8px">' + (canPick ? '<button class="btn primary" type="button" data-act="fdsort"' + (BUSY ? ' disabled' : '') + '>🗂 Sort now (' + pl.length + ' files)</button>' : '') +
      '<button class="btn" type="button" data-act="fdbat" title="A .bat file: put it inside the export folder and double-click it">⬇ Sorting file (.bat)</button>' +
      '<button class="btn" type="button" data-act="fdundo" title="Puts everything back the way it was">⬇ Undo file (.bat)</button></div></div>';
    return h;
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
    fdbat: function () { var pl = plan(); download('Sort_files_' + F.ui.group.join('-') + '_' + T.todayIso() + '.bat', bat(pl, F.ui.mode)); A.toast('⬇ Put the .bat inside ' + F.root + ' and double-click it'); },
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
    '.fd-node{font-size:12px;border:1px solid var(--edge);padding:3px 8px;background:var(--panel)}.fd-node b{color:var(--accent);margin-left:4px}.fd-node.warn{border-style:dashed}';
  document.head.appendChild(css);
};
