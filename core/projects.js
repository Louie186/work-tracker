/* ═══════════════════════════════════════════════════════════════════
   core/projects.js — work on several projects, one at a time
   ───────────────────────────────────────────────────────────────────
   • The open project's data sits where each skill already keeps it.
   • Which data belongs to a project: every skill's "projectKeys" in the
     SKILL LIST (Register, TIDP, Delegation …).  Your personal tracker
     (To Do, Notes, Finance, Calendar) is shared by all projects.
   • Switching: the open project is parked in IndexedDB (no 5 MB limit),
     the other one is put back, then the page reloads.  Nothing is deleted.
   • QA/QC already has its own project list — it simply jumps to the
     QA/QC project with the same name.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'lt_projects_v1', DBN = 'lt_projects_db', ST = 'snapshots';
  var esc = LT.esc;

  function now() { return new Date().toISOString(); }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function read() { return LT.readJSON(KEY, null); }
  function write(st) { LT.writeJSON(KEY, st); try { localStorage.setItem('lt_projects_updated', now()); } catch (e) {} }

  /* first run: the data you already have becomes project no. 1 */
  function ensure() {
    var st = read();
    if (st && st.list && st.list.length && st.active) return st;
    var reg = LT.readJSON('lews_register_state_v1', null);
    var p = { id: uid(), name: (reg && reg.proj && reg.proj.name) || 'My first project', code: (reg && reg.proj && reg.proj.no) || '', created: now() };
    st = { active: p.id, list: [p] };
    write(st);
    return st;
  }

  /* ---------- IndexedDB (parked projects) ---------- */
  function db() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(ST, mode), s = t.objectStore(ST), out;
        var r = fn(s); if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { res(out); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
      });
    });
  }
  function idbGet(id) { return tx('readonly', function (s) { return s.get(id); }); }
  function idbPut(id, v) { return tx('readwrite', function (s) { return s.put(v, id); }); }
  function idbDel(id) { return tx('readwrite', function (s) { return s.delete(id); }); }

  function captureOpen() {
    var o = {};
    LT.projectKeys().forEach(function (k) { var v = localStorage.getItem(k); if (v !== null) o[k] = v; });
    return o;
  }
  function byId(id, st) { st = st || ensure(); for (var i = 0; i < st.list.length; i++) if (st.list[i].id === id) return st.list[i]; return null; }

  /* ---------- actions ---------- */
  function switchTo(id) {
    var st = ensure();
    if (id === st.active) return Promise.resolve();
    if (!byId(id)) return Promise.reject(new Error('Project not found'));
    // remember which QA/QC project this project was using, so we can come back to it
    var q = LT.readJSON('lews_qaqc_state_v1', null), cur = byId(st.active, st);
    if (q && q.activeId && cur) { cur.qaqc = q.activeId; write(st); }
    // 1. park the open project (and make sure it really saved before touching anything)
    var parked = { at: now(), keys: captureOpen() };
    if (window.LTStore && LTStore.writeExtra) LTStore.writeExtra(String((cur && cur.name) || 'Project').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60) + ' (' + st.active + ')', Object.assign({ app: "Lew's Tracker", project: (cur && cur.name) || '' }, parked));
    return idbPut(st.active, parked).then(function () {
      return idbGet(st.active);
    }).then(function (check) {
      if (!check || !check.keys) throw new Error('Could not park the open project — nothing changed');
      return idbGet(id).then(function (snap) { return snap && snap.keys ? snap : (window.LTStore && LTStore.readExtra ? LTStore.readExtra(id) : null); });
    }).then(function (snap) {
      // 2. bring the other project back
      LT.projectKeys().forEach(function (k) { localStorage.removeItem(k); });
      var keys = (snap && snap.keys) || {};
      Object.keys(keys).forEach(function (k) { localStorage.setItem(k, keys[k]); });
      st.active = id; write(st);
      linkQaqc(byId(id));
      LT.toast('📁 Opening ' + byId(id).name + '…');
      (window.LTStore && LTStore.flushNow ? LTStore.flushNow() : Promise.resolve()).then(function () { setTimeout(function () { location.reload(); }, 300); });
    }).catch(function (e) { alert('Project switch stopped: ' + e.message); });
  }
  // QA/QC keeps its own projects — open the one with the same name if it exists
  function linkQaqc(p) {
    var q = LT.readJSON('lews_qaqc_state_v1', null);
    if (!q || !q.projects || !p) return;
    var hit = (p.qaqc && q.projects.filter(function (x) { return x.id === p.qaqc; })[0]) ||
      q.projects.filter(function (x) { return (x.name || '').toLowerCase() === p.name.toLowerCase() || (p.code && x.code === p.code); })[0];
    if (hit && q.activeId !== hit.id) { q.activeId = hit.id; LT.writeJSON('lews_qaqc_state_v1', q); }
  }
  function create(name, code) {
    var st = ensure();
    var p = { id: uid(), name: name, code: code || '', created: now() };
    st.list.push(p); write(st);
    return switchTo(p.id);
  }
  function rename(id, name, code) {
    var st = ensure();
    st.list.forEach(function (p) { if (p.id === id) { p.name = name; p.code = code || ''; } });
    write(st); render();
  }
  function remove(id) {
    var st = ensure(), p = byId(id);
    if (!p) return;
    if (id === st.active) return alert('Open another project first, then delete this one.');
    if (!confirm('Delete project "' + p.name + '"?\n\nIts Register, TIDP and Delegation data will be removed from this browser. Export it first if you want a copy.')) return;
    idbDel(id).then(function () {
      st.list = st.list.filter(function (x) { return x.id !== id; }); write(st); render();
      LT.toast('Project deleted');
    });
  }
  function exportOne(id) {
    var st = ensure(), p = byId(id);
    var get = id === st.active ? Promise.resolve({ keys: captureOpen() }) : idbGet(id);
    get.then(function (snap) {
      var out = { type: 'lews-tracker-project', version: 1, exported: now(), project: { name: p.name, code: p.code }, keys: (snap && snap.keys) || {} };
      LT.download(p.name.replace(/[^A-Za-z0-9]+/g, '_') + '_project_' + LT.today() + '.json', new Blob([JSON.stringify(out)], { type: 'application/json' }));
    });
  }
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (d.type !== 'lews-tracker-project' || !d.keys) throw new Error('This is not a project file (export one from Projects → Export)');
        var st = ensure(), nm = d.project && d.project.name || 'Imported project';
        if (st.list.some(function (x) { return x.name.toLowerCase() === nm.toLowerCase(); })) nm += ' (imported ' + LT.today() + ')';
        var p = { id: uid(), name: nm, code: d.project && d.project.code || '', created: now() };
        var known = LT.projectKeys(), keys = {};
        Object.keys(d.keys).forEach(function (k) { if (known.indexOf(k) > -1) keys[k] = d.keys[k]; });
        idbPut(p.id, { at: now(), keys: keys }).then(function () {
          st.list.push(p); write(st); render();
          LT.toast('Imported "' + p.name + '" — open it from the list');
        });
      } catch (e) { alert(e.message); }
    };
    r.readAsText(file);
  }

  /* ---------- for cloud sync (core/sync.js) ---------- */
  function dumpParked() {
    var st = ensure(), out = {};
    return Promise.all(st.list.filter(function (p) { return p.id !== st.active; }).map(function (p) {
      return idbGet(p.id).then(function (s) { if (s) out[p.id] = s; });
    })).then(function () { return { state: st, parked: out }; });
  }
  function restoreParked(d) {
    if (!d || !d.state) return Promise.resolve();
    write(d.state);
    return Promise.all(Object.keys(d.parked || {}).map(function (id) { return idbPut(id, d.parked[id]); }));
  }

  /* ---------- screens ---------- */
  function listHtml() {
    var st = ensure();
    return st.list.map(function (p) {
      var on = p.id === st.active;
      return '<div class="lt-proj-row' + (on ? ' on' : '') + '">' +
        '<div class="lt-sk-tx"><b>' + esc(p.name) + '</b>' + (p.code ? ' <span class="small">' + esc(p.code) + '</span>' : '') + (on ? ' <span class="pill">Open</span>' : '') + '</div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap">' +
        (on ? '' : '<button class="btn primary" onclick="LTProjects.switchTo(\'' + p.id + '\')">Open</button>') +
        '<button class="btn" onclick="LTProjects.askRename(\'' + p.id + '\')">Rename</button>' +
        '<button class="btn" onclick="LTProjects.exportOne(\'' + p.id + '\')">⬇ Export</button>' +
        (on ? '' : '<button class="btn danger" onclick="LTProjects.remove(\'' + p.id + '\')">Delete</button>') +
        '</div></div>';
    }).join('');
  }
  var help = '<p class="small">Each project keeps its own <b>Register, TIDP and Delegation</b> data. QA/QC opens its project with the same name. ' +
    'Your To Do list, Notes and Finance are shared by all projects.</p>';
  function actionsHtml() {
    return '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn primary" onclick="LTProjects.askNew()">+ New project</button>' +
      '<label class="btn" style="cursor:pointer">⬆ Import project<input type="file" accept=".json" hidden onchange="if(this.files[0])LTProjects.importFile(this.files[0]);this.value=\'\'"></label></div>';
  }
  function render() {
    var st = ensure(), p = byId(st.active);
    var chip = document.getElementById('ltProjChip');
    if (chip) chip.innerHTML = '📁 <span>' + esc(p.name) + '</span> ▾';
    var card = document.getElementById('ltProjectsCard');
    if (card) card.innerHTML = '<h3>📁 Projects</h3>' + help + '<div class="lt-proj-list">' + listHtml() + '</div>' + actionsHtml();
    var m = document.getElementById('ltModal');
    if (m && m.classList.contains('show') && m.querySelector('.lt-proj-list')) m.querySelector('.lt-proj-list').innerHTML = listHtml();
  }
  function open() { LT.modal('📁 Projects', help + '<div class="lt-proj-list">' + listHtml() + '</div>' + actionsHtml(), { width: 640 }); }
  function askNew() {
    var name = prompt('New project name (e.g. "Marina Tower")'); if (!name || !name.trim()) return;
    var code = prompt('Project number / code (optional)', '') || '';
    create(name.trim(), code.trim());
  }
  function askRename(id) {
    var p = byId(id); if (!p) return;
    var name = prompt('Project name', p.name); if (!name || !name.trim()) return;
    var code = prompt('Project number / code (optional)', p.code || '');
    rename(id, name.trim(), (code || '').trim());
  }

  window.LTProjects = {
    active: function () { var st = ensure(); return byId(st.active); }, list: function () { return ensure().list.slice(); },
    switchTo: switchTo, create: create, rename: rename, remove: remove, exportOne: exportOne, importFile: importFile,
    open: open, askNew: askNew, askRename: askRename, render: render, dumpParked: dumpParked, restoreParked: restoreParked
  };
  ensure();
  if (document.body) render(); else document.addEventListener('DOMContentLoaded', render);
})();
