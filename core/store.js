/* ═══════════════════════════════════════════════════════════════════
   core/store.js — where the FEATURE data lives (LTStore)
   ───────────────────────────────────────────────────────────────────
   The features (MIDP Checker, Delegation, QA/QC, Register…) used to keep
   everything in the browser's localStorage — max ~5 MB, and when it is
   full, saving fails. Now their data lives in ONE of:
     • 📁 a folder you choose (Chrome / Edge on a PC) — one file per
       feature: "MIDP Checker.json", "Delegation.json", "QA-QC.json"…
       Put it in OneDrive / SharePoint and every PC shares the same data.
     • 🗄 the browser's big storage (IndexedDB, hundreds of MB) — phones,
       Safari, or until you choose a folder.
   localStorage keeps only small device things (look, login, the mode).

   How the features still "just work": every page's localStorage is
   patched (store-frame.js in each feature page) so the feature keys are
   read from / written to LTStore's memory. Changes are written to the
   folder (or IndexedDB) a moment later. Feature pages open only after
   the data is loaded, so nothing ever starts empty by mistake.

   First run: the feature data that is in localStorage is copied over,
   checked, and only then removed from localStorage.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.LTStore) return;
  var DEVICE_LS = window.localStorage, P0 = Storage.prototype;
  var nGet = P0.getItem, nSet = P0.setItem, nDel = P0.removeItem;
  var MODE_KEY = 'lt_store_mode', DB = 'lt-store', VER = 1;

  // ---------- which keys are feature data, and which file they go to ----------
  var PREFIX = ['tidp-checker:', 'lews_register_', 'lews_qaqc_', 'lt_delegate_v1', 'lews_team_'];
  // the project list travels with the data; the "bring work back" undo copy can be big
  var EXACT = { lt_projects_v1: 1, lt_projects_updated: 1, lt_offline_undo: 1 };
  // the stored copy wins over a value written before loading finished (e.g. a default project list made on start)
  var STORED_WINS = { lt_projects_v1: 1, lt_projects_updated: 1 };
  function projectKeys() { try { return window.LT && LT.projectKeys ? LT.projectKeys() : []; } catch (e) { return []; } }
  function owns(k) {
    k = String(k);
    if (EXACT[k]) return true;
    for (var i = 0; i < PREFIX.length; i++) if (k.indexOf(PREFIX[i]) === 0) return true;
    return projectKeys().indexOf(k) > -1;
  }
  function fileOf(k) {
    if (k.indexOf('tidp-checker:') === 0) return 'MIDP Checker';
    if (k.indexOf('lt_delegate') === 0 || k.indexOf('lews_team_') === 0) return 'Delegation';
    if (k.indexOf('lews_qaqc_') === 0) return 'QA-QC';
    if (k.indexOf('lews_register_') === 0) return 'Register classic';
    if (k.indexOf('lt_projects') === 0) return 'Projects';
    return 'Other features';
  }

  // ---------- state ----------
  var MEM = new Map(), PENDING = new Map(), PENDEL = new Set(), DIRTY = new Set();
  var S = { ready: false, mode: nGet.call(DEVICE_LS, MODE_KEY) || '', state: 'loading', dir: null, folderName: '', savedAt: 0, error: '', waiting: [] };
  var timer = null, chain = Promise.resolve(), readyCbs = [];

  // ---------- IndexedDB (browser mode + the remembered folder) ----------
  var dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      var r = indexedDB.open(DB, VER);
      r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains('files')) d.createObjectStore('files'); if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbP;
  }
  function idb(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out, q = fn(s);
        if (q) q.onsuccess = function () { out = q.result; };
        t.oncomplete = function () { res(out); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
      });
    });
  }
  function idbAll() {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var out = {}, t = d.transaction('files', 'readonly'), c = t.objectStore('files').openCursor();
        c.onsuccess = function () { var cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
        t.oncomplete = function () { res(out); }; t.onerror = function () { rej(t.error); };
      });
    });
  }

  // ---------- one feature file ----------
  function packFile(name) {
    var keys = {}, raw = {};
    MEM.forEach(function (v, k) {
      if (fileOf(k) !== name) return;
      try { keys[k] = JSON.parse(v); } catch (e) { raw[k] = v; }
    });
    return { app: "Lew's Tracker", file: name, savedAt: new Date().toISOString(), note: 'Feature data — do not edit by hand. Keep this folder; choose it again on another PC.', keys: keys, raw: raw };
  }
  function unpack(obj, into) {
    if (!obj) return 0; var n = 0;
    Object.keys(obj.keys || {}).forEach(function (k) { into.set(k, JSON.stringify(obj.keys[k])); n++; });
    Object.keys(obj.raw || {}).forEach(function (k) { into.set(k, String(obj.raw[k])); n++; });
    return n;
  }
  function allFileNames() { var o = {}; MEM.forEach(function (v, k) { o[fileOf(k)] = 1; }); return Object.keys(o); }

  // ---------- the folder ----------
  function folderRead(dir) {
    var out = {}, list = [];
    return (async function () {
      for await (var entry of dir.values()) {
        if (entry.kind === 'file' && /\.json$/i.test(entry.name) && entry.name !== 'lews-tracker-data.json') list.push(entry);
      }
      for (var i = 0; i < list.length; i++) {
        try {
          var txt = await (await list[i].getFile()).text(), obj = JSON.parse(txt);
          if (obj && obj.app === "Lew's Tracker" && obj.keys) out[obj.file || list[i].name.replace(/\.json$/i, '')] = obj;
        } catch (e) { console.warn('LTStore: could not read', list[i].name, e); }
      }
      return out;
    })();
  }
  function folderWrite(dir, name, obj) {
    return dir.getFileHandle(name + '.json', { create: true }).then(function (fh) {
      return fh.createWritable().then(function (w) { return w.write(JSON.stringify(obj)).then(function () { return w.close(); }); });
    });
  }
  function folderRemove(dir, name) { return dir.removeEntry(name + '.json').catch(function () {}); }

  // ---------- saving (a moment after each change) ----------
  function touch(k) { DIRTY.add(fileOf(k)); clearTimeout(timer); timer = setTimeout(flush, 700); }
  function flush() {
    clearTimeout(timer);
    if (!S.ready || !DIRTY.size) return chain;
    var names = Array.from(DIRTY); DIRTY.clear();
    chain = chain.then(function () {
      return Promise.all(names.map(function (n) {
        var obj = packFile(n), empty = !Object.keys(obj.keys).length && !Object.keys(obj.raw).length;
        if (S.mode === 'folder') {
          if (!S.dir) return Promise.reject(new Error('No folder'));
          return empty ? folderRemove(S.dir, n) : folderWrite(S.dir, n, obj);
        }
        return idb('files', 'readwrite', function (s) { return empty ? s.delete(n) : s.put(obj, n); });
      })).then(function () { S.savedAt = Date.now(); S.error = ''; status(); })
        .catch(function (e) { names.forEach(function (n) { DIRTY.add(n); }); S.error = (e && e.message) || String(e); status(); console.error('LTStore save failed', e); setTimeout(flush, 5000); });
    });
    return chain;
  }

  // ---------- reading / writing keys (used by the patched localStorage) ----------
  function get(k) {
    if (!S.ready) { if (PENDEL.has(k)) return null; if (PENDING.has(k)) return PENDING.get(k); return nGet.call(DEVICE_LS, k); }
    if (MEM.has(k)) return MEM.get(k);
    var legacy = nGet.call(DEVICE_LS, k);           // something written the old way: adopt it
    if (legacy !== null) { MEM.set(k, legacy); touch(k); try { nDel.call(DEVICE_LS, k); } catch (e) {} }
    return legacy;
  }
  function set(k, v, from) {
    v = String(v);
    if (!S.ready) { PENDING.set(k, v); PENDEL.delete(k); return; }
    if (MEM.get(k) === v) return;
    var old = MEM.has(k) ? MEM.get(k) : null;
    MEM.set(k, v); touch(k); tell(k, old, v, from);
  }
  function del(k, from) {
    if (!S.ready) { PENDING.delete(k); PENDEL.add(k); return; }
    if (!MEM.has(k)) { try { nDel.call(DEVICE_LS, k); } catch (e) {} return; }
    var old = MEM.get(k); MEM.delete(k); touch(k); tell(k, old, null, from);
  }
  // other open pages hear about the change (like the browser's "storage" event)
  function windows() { var out = [window]; try { document.querySelectorAll('iframe').forEach(function (f) { try { if (f.contentWindow && f.contentWindow.location.origin === location.origin) out.push(f.contentWindow); } catch (e) {} }); } catch (e) {} return out; }
  function tell(k, oldV, newV, from) {
    windows().forEach(function (w) {
      if (w === from) return;
      try { w.dispatchEvent(new w.StorageEvent('storage', { key: k, oldValue: oldV, newValue: newV, url: location.href })); } catch (e) {}
    });
  }

  // ---------- patch a page's localStorage (this page, and each feature page via store-frame.js) ----------
  function patch(win) {
    try {
      var ls = win.localStorage, Pr = win.Storage.prototype;
      if (Pr.__lt) return true;
      var g = Pr.getItem, s = Pr.setItem, r = Pr.removeItem;
      Pr.getItem = function (k) { return this === ls && owns(k) ? get(String(k)) : g.call(this, k); };
      Pr.setItem = function (k, v) { if (this === ls && owns(k)) return set(String(k), v, win); return s.call(this, k, v); };
      Pr.removeItem = function (k) { if (this === ls && owns(k)) return del(String(k), win); return r.call(this, k); };
      Pr.__lt = true;
      return true;
    } catch (e) { console.warn('LTStore: could not patch', e); return false; }
  }

  // ---------- loading ----------
  function legacyKeys() { var out = []; for (var i = 0; i < DEVICE_LS.length; i++) { var k = DEVICE_LS.key(i); if (k && owns(k)) out.push(k); } return out; }
  function load(files) {
    MEM.clear();
    Object.keys(files || {}).forEach(function (n) { unpack(files[n], MEM); });
    // feature data still in localStorage (first run, or an older page): bring it over
    var moved = [];
    legacyKeys().forEach(function (k) { if (!MEM.has(k) || !S.mode) { MEM.set(k, nGet.call(DEVICE_LS, k)); DIRTY.add(fileOf(k)); } moved.push(k); });
    var redo = false;
    PENDING.forEach(function (v, k) {
      if (MEM.has(k) && STORED_WINS[k]) { if (MEM.get(k) !== v) redo = true; return; }
      MEM.set(k, v); DIRTY.add(fileOf(k));
    }); PENDING.clear();
    if (redo && !sessionStorage.getItem('lt_store_redo')) { try { sessionStorage.setItem('lt_store_redo', '1'); } catch (e) {} S.ready = true; return flush().then(function () { location.reload(); }); }
    PENDEL.forEach(function (k) { if (MEM.delete(k)) DIRTY.add(fileOf(k)); }); PENDEL.clear();
    S.ready = true; S.state = 'ready';
    if (!S.mode) { S.mode = 'browser'; }
    return flush().then(function () { return verify(); }).then(function (ok) {
      if (ok) { moved.forEach(function (k) { try { nDel.call(DEVICE_LS, k); } catch (e) {} }); try { nSet.call(DEVICE_LS, MODE_KEY, S.mode); } catch (e) {} }
      status(); fireReady();
    });
  }
  // what was written can be read back (before anything is removed from localStorage)
  function verify() {
    var names = allFileNames();
    if (!names.length) return Promise.resolve(true);
    var p = S.mode === 'folder' && S.dir ? folderRead(S.dir) : idbAll();
    return p.then(function (files) {
      var back = new Map(); Object.keys(files).forEach(function (n) { unpack(files[n], back); });
      var bad = 0; MEM.forEach(function (v, k) { if (!back.has(k)) bad++; });
      if (bad) { S.error = bad + ' item(s) could not be read back — browser copy kept'; status(); }
      return !bad;
    }).catch(function (e) { S.error = 'Check failed: ' + e.message; status(); return false; });
  }
  function start() {
    if (S.mode === 'folder') {
      // (window.__ltTestDir: automated tests hand over their test folder here — not used in normal use)
      return (window.__ltTestDir ? window.__ltTestDir() : idb('meta', 'readonly', function (s) { return s.get('dir'); })).then(function (dir) {
        if (!dir) { S.state = 'nofolder'; status(); return; }
        S.dir = dir; S.folderName = dir.name;
        return dir.queryPermission({ mode: 'readwrite' }).then(function (p) {
          if (p === 'granted') return folderRead(dir).then(load);
          S.state = 'needperm'; status();
        });
      }).catch(function (e) { S.state = 'nofolder'; S.error = e.message; status(); });
    }
    return idbAll().then(load).catch(function (e) {
      // no IndexedDB (very old browser / private mode): stay on localStorage
      console.warn('LTStore: IndexedDB not available — staying on browser localStorage', e);
      S.mode = 'local'; S.state = 'ready'; S.ready = true; unpatchAll(); fireReady();
    });
  }
  function unpatchAll() { owns = function () { return false; }; }    // everything goes to the real localStorage
  function fireReady() {
    var w = S.waiting.splice(0); w.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    readyCbs.splice(0).forEach(function (fn) { try { fn(); } catch (e) {} });
    try { window.dispatchEvent(new Event('lt-store-ready')); } catch (e) {}
    try { if (typeof renderAll === 'function' && typeof data !== 'undefined' && data) renderAll(); } catch (e) {}
  }

  // ---------- the folder: choose / reconnect / leave ----------
  function chooseFolder() {
    if (!('showDirectoryPicker' in window)) { alert('Folders work in Chrome or Edge on a computer. Your data stays in this browser’s big storage.'); return Promise.resolve(false); }
    var dir;
    return window.showDirectoryPicker({ mode: 'readwrite', id: 'lt-data' }).then(function (d) {
      dir = d; return d.requestPermission({ mode: 'readwrite' });
    }).then(function (p) {
      if (p !== 'granted') throw new Error('Permission was not given');
      return folderRead(dir);
    }).then(function (files) {
      var there = 0, at = ''; Object.keys(files).forEach(function (n) { there += Object.keys(files[n].keys || {}).length + Object.keys(files[n].raw || {}).length; if (files[n].savedAt > at) at = files[n].savedAt; });
      var useFolder = false;
      if (there && S.ready && MEM.size) {
        useFolder = confirm('This folder already has Lew’s Tracker data (' + there + ' items, saved ' + (at ? new Date(at).toLocaleString() : '?') + ').\n\nOK = open the FOLDER’S data (replaces what this browser has).\nCancel = keep THIS BROWSER’S data and write it into the folder.');
      } else if (there) useFolder = true;
      S.dir = dir; S.folderName = dir.name; S.mode = 'folder';
      if (useFolder) { MEM.clear(); Object.keys(files).forEach(function (n) { unpack(files[n], MEM); }); }
      else allFileNames().forEach(function (n) { DIRTY.add(n); });
      S.ready = true; S.state = 'ready';
      return flush().then(verify).then(function (ok) {
        if (!ok) throw new Error(S.error || 'The folder could not be checked');
        return idb('meta', 'readwrite', function (s) { return s.put(dir, 'dir'); });
      }).then(function () {
        try { nSet.call(DEVICE_LS, MODE_KEY, 'folder'); } catch (e) {}
        // the browser keeps nothing: clear the IndexedDB copy, and the old localStorage copy
        legacyKeys().forEach(function (k) { try { nDel.call(DEVICE_LS, k); } catch (e) {} });
        return idb('files', 'readwrite', function (s) { return s.clear(); });
      }).then(function () {
        // the main tracker (To Do, notes, attachments) uses the same folder
        try { if (typeof saveFolderHandle === 'function') { window.trackerDirHandle = dir; try { trackerDirHandle = dir; } catch (e) {} saveFolderHandle(dir).then(function () { if (typeof saveToSelectedFolder === 'function') saveToSelectedFolder(false); }); } } catch (e) {}
        status(); fireReady(); if (window.LT && LT.reloadFrames) LT.reloadFrames();
        if (window.LT && LT.toast) LT.toast('📁 Data folder: ' + dir.name + ' ✓');
        return true;
      });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return false;
      S.error = (e && e.message) || String(e); status(); alert('The data folder was not set: ' + S.error); return false;
    });
  }
  function reconnect() {          // once per visit the browser asks you to allow the folder
    if (!S.dir) return chooseFolder();
    return S.dir.requestPermission({ mode: 'readwrite' }).then(function (p) {
      if (p !== 'granted') { S.error = 'Permission was not given'; status(); return false; }
      return folderRead(S.dir).then(load).then(function () { return true; });
    }).catch(function (e) { S.error = e.message; S.state = 'nofolder'; status(); return false; });
  }
  function useBrowser() {
    if (!S.ready) return Promise.resolve(false);
    S.mode = 'browser';
    allFileNames().forEach(function (n) { DIRTY.add(n); });
    return flush().then(verify).then(function (ok) {
      if (!ok) throw new Error(S.error);
      try { nSet.call(DEVICE_LS, MODE_KEY, 'browser'); } catch (e) {}
      return idb('meta', 'readwrite', function (s) { return s.delete('dir'); });
    }).then(function () { S.dir = null; S.folderName = ''; status(); if (window.LT && LT.toast) LT.toast('🗄 Data kept in this browser'); return true; })
      .catch(function (e) { alert('Could not move the data: ' + e.message); return false; });
  }
  function reloadFromFolder() {
    if (S.mode !== 'folder' || !S.dir) return Promise.resolve(false);
    return folderRead(S.dir).then(function (files) { MEM.clear(); Object.keys(files).forEach(function (n) { unpack(files[n], MEM); }); status(); if (window.LT && LT.reloadFrames) LT.reloadFrames(); if (window.LT && LT.toast) LT.toast('↻ Loaded from the folder'); return true; });
  }

  // ---------- a feature page waits until the data is there ----------
  function openFrame(fr) {
    if (S.ready) { fr.src = fr.getAttribute('data-src'); return; }
    var card = fr.closest('.skill-frame-card') || fr.parentNode, gate = card.querySelector('.lt-gate');
    if (!gate) { gate = document.createElement('div'); gate.className = 'lt-gate'; card.insertBefore(gate, fr); }
    fr.style.display = 'none';
    drawGate(gate);
    S.waiting.push(function () { gate.remove(); fr.style.display = ''; if (!fr.getAttribute('src')) fr.src = fr.getAttribute('data-src'); });
  }
  function drawGate(gate) {
    var h;
    if (S.state === 'needperm') h = '<b>📁 Your data is in the folder “' + esc(S.folderName) + '”</b><p>The browser asks once per visit before a site may use a folder.</p><button class="btn primary" type="button" data-ltstore="reconnect">Open my data folder</button>';
    else if (S.state === 'nofolder') h = '<b>📁 The data folder can’t be found</b><p>' + esc(S.error || 'It may have been moved, renamed or be on a drive that is not connected.') + '</p><button class="btn primary" type="button" data-ltstore="choose">Choose the folder</button> <button class="btn" type="button" data-ltstore="browser">Use this browser instead</button>';
    else h = '<b>Loading your data…</b>';
    gate.innerHTML = '<div class="lt-gate-in">' + h + '</div>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- status (Settings) ----------
  function usage() { var n = 0; MEM.forEach(function (v, k) { n += k.length + v.length; }); return n; }
  function status() {
    document.querySelectorAll('.lt-gate').forEach(drawGate);
    var el = document.getElementById('ltStoreStatus'); if (!el) return;
    var mb = (usage() / 1048576).toFixed(2), when = S.savedAt ? ' · saved ' + new Date(S.savedAt).toLocaleTimeString() : '';
    var where = S.mode === 'folder' ? '📁 Folder “' + esc(S.folderName) + '”' : S.mode === 'local' ? '⚠ Browser localStorage (5 MB limit) — this browser has no bigger storage' : '🗄 This browser’s big storage (IndexedDB)';
    el.innerHTML = '<b>' + where + '</b> · ' + mb + ' MB of feature data' + when +
      (S.state === 'needperm' ? ' · <b style="color:var(--warn,#b26a00)">waiting for your OK — open a feature or click “Open my data folder”</b>' : '') +
      (S.state === 'nofolder' ? ' · <b style="color:var(--danger,#c62828)">folder not found</b>' : '') +
      (S.error ? ' · <b style="color:var(--danger,#c62828)">⚠ ' + esc(S.error) + '</b>' : '');
    var b = document.getElementById('ltStoreBtns');
    if (b) b.innerHTML = (S.mode === 'folder'
      ? (S.state === 'needperm' ? '<button class="btn primary" type="button" data-ltstore="reconnect">📁 Open my data folder</button>' : '') +
        '<button class="btn" type="button" data-ltstore="choose">Change folder</button><button class="btn" type="button" data-ltstore="reload">↻ Load from folder</button><button class="btn" type="button" data-ltstore="save">💾 Save now</button><button class="btn" type="button" data-ltstore="browser">Use this browser instead</button>'
      : '<button class="btn primary" type="button" data-ltstore="choose">📁 Choose a data folder</button><button class="btn" type="button" data-ltstore="save">💾 Save now</button>');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ltstore]'); if (!b) return;
    var a = b.getAttribute('data-ltstore');
    if (a === 'choose') chooseFolder(); else if (a === 'reconnect') reconnect(); else if (a === 'browser') useBrowser();
    else if (a === 'reload') reloadFromFolder(); else if (a === 'save') { allFileNames().forEach(function (n) { DIRTY.add(n); }); flush().then(function () { if (window.LT && LT.toast) LT.toast(S.error ? '⚠ ' + S.error : '💾 Saved'); }); }
  });
  // a change not yet written when the page closes: write it now, and warn
  window.addEventListener('pagehide', function () { flush(); });
  window.addEventListener('beforeunload', function () { if (DIRTY.size && S.ready) flush(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && DIRTY.size) flush(); });

  // first visit with nothing chosen: offer the folder once
  function offer() {
    if (S.mode === 'folder' || nGet.call(DEVICE_LS, 'lt_store_offered') || !('showDirectoryPicker' in window)) return;
    try { nSet.call(DEVICE_LS, 'lt_store_offered', '1'); } catch (e) {}
    var bar = document.createElement('div'); bar.className = 'lt-store-offer';
    bar.innerHTML = '<span>📁 <b>Keep your feature data in a folder?</b> (MIDP Checker, Delegation, QA/QC…) — no browser size limit, and another PC can open the same folder (e.g. on OneDrive).</span><button class="btn primary" type="button" data-ltstore="choose">Choose a folder</button><button class="btn" type="button" data-x>Not now</button>';
    bar.addEventListener('click', function (e) { if (e.target.closest('[data-x],[data-ltstore]')) setTimeout(function () { bar.remove(); }, 50); });
    document.body.appendChild(bar);
  }

  var css = document.createElement('style');
  css.textContent = '.lt-gate{display:grid;place-items:center;min-height:50vh;padding:20px}.lt-gate-in{max-width:520px;text-align:center;display:grid;gap:10px;justify-items:center}.lt-gate-in p{margin:0;color:var(--muted)}' +
    '.lt-store-offer{position:fixed;left:12px;right:12px;bottom:12px;z-index:80;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 14px;border-radius:14px;background:var(--panel,var(--card,#fff));color:var(--ink,#111);box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid var(--line,var(--edge,#ddd));font-size:13.5px}.lt-store-offer span{flex:1;min-width:220px}';
  (document.head || document.documentElement).appendChild(css);

  window.LTStore = {
    owns: owns, patch: patch, openFrame: openFrame, isReady: function () { return S.ready; }, onReady: function (fn) { if (S.ready) fn(); else readyCbs.push(fn); },
    chooseFolder: chooseFolder, reconnect: reconnect, useBrowser: useBrowser, reloadFromFolder: reloadFromFolder, flushNow: function () { allFileNames().forEach(function (n) { DIRTY.add(n); }); return flush(); },
    info: function () { return { mode: S.mode, state: S.state, folder: S.folderName, ready: S.ready, mb: usage() / 1048576, savedAt: S.savedAt, error: S.error, keys: MEM.size }; },
    keys: function (prefix) { var out = []; MEM.forEach(function (v, k) { if (!prefix || k.indexOf(prefix) === 0) out.push(k); }); return out; },
    // other files in the folder (parked projects): folder mode only
    writeExtra: function (name, obj) { if (S.mode !== 'folder' || !S.dir) return Promise.resolve(false); return S.dir.getDirectoryHandle('Projects', { create: true }).then(function (d) { return folderWrite(d, name, obj); }).then(function () { return true; }).catch(function (e) { console.warn(e); return false; }); },
    // find the file of a parked project by its id: "<project name> (<id>).json"
    readExtra: function (id) {
      if (S.mode !== 'folder' || !S.dir) return Promise.resolve(null);
      return S.dir.getDirectoryHandle('Projects').then(async function (d) {
        for await (var e of d.values()) if (e.kind === 'file' && (e.name === id + '.json' || e.name.indexOf('(' + id + ').json') > -1)) return JSON.parse(await (await e.getFile()).text());
        return null;
      }).catch(function () { return null; });
    },
    status: status, _mem: MEM
  };
  patch(window);
  function boot() { start().then(function () { status(); setTimeout(offer, 4000); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
