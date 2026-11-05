/* ═══ core/offline.js — "⬇ Offline copy" of a feature ══════════════
   Makes ONE .html file of a feature page (Delegation, QA/QC, MIDP
   Checker) that works with no website and no internet:
     • the page, its scripts, styles and Excel libraries are put inside
     • files the page fetches (the .xlsm checklist template) are put inside
     • your current data for that feature comes along as a starting point
   In the offline copy a small bar offers "⬇ Save work for website".
   That file is read back here with "⬆ Bring offline work back"
   (Settings → Data & backup → Offline copies).
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var FEAT = {
    delegate: { name: 'Delegation', page: 'skills/delegate/delegate.html', file: 'Delegation',
      libs: ['lib/exceljs.min.js', 'lib/jszip.min.js'], files: ['skills/delegate/templates/checklist-template.xlsm'],
      keys: ['lt_delegate_v1', 'lt_delegate_ui_v1', 'lews_team_v1', 'lews_myname'] },
    qaqc: { name: 'QA/QC', page: 'skills/qaqc/qaqc.html', file: 'QAQC',
      keys: ['lews_qaqc_state_v1', 'lews_qaqc_colw_v1', 'lews_team_v1'] },
    tidp: { name: 'MIDP Checker', page: 'skills/midp/midp.html', file: 'MIDP_Checker', prefix: 'tidp-checker:', skip: ['tidp-checker:index'],
      keys: [], note: 'Drop the latest TIDP in Files once — your tracker entries, lists and corrections are already in.' }
  };
  var THEME = 'lt_theme_v1';

  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function toast(m) { if (window.LT && LT.toast) LT.toast(m); else alert(m); }
  function keysOf(f) {
    var out = f.keys.slice();
    if (f.prefix) for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(f.prefix) === 0 && (f.skip || []).indexOf(k) < 0) out.push(k); }
    if (f.prefix && window.LTStore && LTStore.keys) LTStore.keys(f.prefix).forEach(function (k) { if (out.indexOf(k) < 0 && (f.skip || []).indexOf(k) < 0) out.push(k); });   // data in the folder / big storage
    return out;
  }
  function snapshot(id, f) {
    var o = {};
    keysOf(f).concat([THEME]).forEach(function (k) { var v = localStorage.getItem(k); if (v !== null) o[k] = v; });
    // the To Do tasks linked to this feature come along (read only), and an empty tray for new ones
    o.lt_todo_snap = JSON.stringify(window.LTLinks ? LTLinks.snapshotFor(id) : []);
    o.lt_todo_inbox = '[]';
    return o;
  }
  function proj() { return window.LTProjects ? LTProjects.active() : { id: 'default', name: 'Project' }; }
  function text(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('Could not read ' + url); return r.text(); }); }
  function b64(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('Could not read ' + url); return r.arrayBuffer(); }).then(function (buf) {
      var s = '', a = new Uint8Array(buf);
      for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
      return btoa(s);
    });
  }
  function scriptTag(code) { return '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>'; }
  function json(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }

  /* What runs first in the offline copy: puts the data in (asking before it replaces
     offline work), serves the packed files to fetch(), and shows the small bar. */
  function shim(id, f, seed, files, made) {
    var p = proj(), info = { id: id, name: f.name, file: f.file, made: made, keys: keysOf(f).concat(['lt_todo_inbox']), prefix: f.prefix || '', note: f.note || '', project: p.id, projectName: p.name };
    return scriptTag('(' + function (INFO, SEED, FILES) {
      var MARK = 'lt_offline_made:' + INFO.id;
      try {
        var had = localStorage.getItem(MARK);
        if (had !== INFO.made) {
          var mine = Object.keys(SEED).some(function (k) {
            var v = localStorage.getItem(k);
            if (k === 'lt_theme_v1' || k === 'lt_todo_snap' || (k === 'lt_todo_inbox' && (!v || v === '[]'))) return false;
            return v !== null && v !== SEED[k];
          });
          var take = !had || !mine || confirm('This offline copy of ' + INFO.name + ' was made on ' + INFO.made + ' with the data from the website.\n\nThis computer already has offline work for ' + INFO.name + ' (from a copy made ' + had + ').\n\nOK = use the data in this new copy (the older offline work is replaced)\nCancel = keep the offline work on this computer');
          if (take) Object.keys(SEED).forEach(function (k) { if (k !== 'lt_theme_v1' || localStorage.getItem(k) === null) localStorage.setItem(k, SEED[k]); });
          localStorage.setItem(MARK, INFO.made);
        }
        localStorage.setItem('lt_todo_snap', SEED.lt_todo_snap || '[]');      // always the newest To Do picture
      } catch (e) { /* storage blocked: the page still opens, empty */ }
      // "➕ My To Do" in the offline copy: shows the linked tasks, keeps new ones until "Save work for website"
      function rd(k) { try { return JSON.parse(localStorage.getItem(k) || '[]') || []; } catch (e) { return []; } }
      function same(a, b) {
        if (a.f !== b.f || a.t !== b.t) return false;
        if (a.f === 'qaqc') return a.qp === b.qp && a.k === b.k;
        return a.k === b.k || (a.f === 'midp' && a.t === 'd' && ((b.ok && a.k === b.ok) || (a.ok && (a.ok === b.k || a.ok === b.ok))));
      }
      function all() { return rd('lt_todo_snap').concat(rd('lt_todo_inbox').map(function (q) { return { id: q.id, title: q.title, status: 'queued', due: q.due, links: q.links }; })); }
      window.LT_OFFLINE_TODO = {
        tasksFor: function (l) { return all().filter(function (t) { return (t.links || []).some(function (x) { return same(x, l); }); }); },
        addFromFeature: function (l) {
          var link = JSON.parse(JSON.stringify(l)); if (link.f !== 'qaqc') link.p = INFO.project;
          var q = { id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: l.title || l.label || 'Linked task', due: l.due || '', links: [link],
            tags: [l.f === 'midp' ? 'MIDP' : l.f === 'qaqc' ? 'QAQC' : 'Team'], at: new Date().toISOString() };
          var a = rd('lt_todo_inbox'); a.push(q);
          try { localStorage.setItem('lt_todo_inbox', JSON.stringify(a)); } catch (e) { alert('Could not save: ' + e.message); return null; }
          return { id: q.id, title: q.title, status: 'queued', due: q.due };
        },
        openTask: function (id) {
          var t = all().filter(function (x) { return String(x.id) === String(id); })[0];
          if (!t) return;
          alert('📝 ' + t.title + (t.due ? '\nDue ' + t.due : '') + '\n\nYour To Do list is on the website. ' + (t.status === 'queued'
            ? 'This new task waits in this offline copy — press “⬇ Save work for website”, then “⬆ Bring offline work back” on the website adds it to your To Do.'
            : 'Status when this copy was made: ' + t.status + '.'));
        }
      };
      // the packed files (e.g. the checklist template) for fetch()
      var of = window.fetch;
      window.fetch = function (u, o) {
        var s = String(u && u.url || u), hit = Object.keys(FILES).filter(function (k) { return s === k || s.slice(-k.length) === k || k.slice(-s.length) === s; })[0];
        if (hit) { var b = atob(FILES[hit]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return Promise.resolve(new Response(a.buffer, { status: 200 })); }
        return of ? of.apply(this, arguments) : Promise.reject(new Error('Offline'));
      };
      window.LT_OFFLINE = INFO;
      function save() {
        var keys = {};
        try {
          INFO.keys.forEach(function (k) { var v = localStorage.getItem(k); if (v !== null) keys[k] = v; });
          if (INFO.prefix) for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(INFO.prefix) === 0) keys[k] = localStorage.getItem(k); }
        } catch (e) { alert('Could not read the saved work: ' + e.message); return; }
        var d = new Date(), t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var blob = new Blob([JSON.stringify({ lt_offline_work: 1, feature: INFO.id, name: INFO.name, made: INFO.made, saved: new Date().toISOString(), project: INFO.project, projectName: INFO.projectName, keys: keys })], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = INFO.file + '_offline_work_' + t + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.json';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }
      function bar() {
        var b = document.createElement('div'); b.id = 'ltOffBar';
        b.innerHTML = '<span title="Made ' + INFO.made + '. Your work is saved in this browser on this computer.">📴 Offline copy</span><button type="button">⬇ Save work for website</button><button type="button" aria-label="Hide" title="Hide">✕</button>';
        b.children[1].onclick = save; b.children[2].onclick = function () { b.remove(); };
        var st = document.createElement('style');
        st.textContent = '#ltOffBar{position:fixed;right:10px;bottom:10px;z-index:99999;display:flex;gap:6px;align-items:center;padding:5px 6px 5px 10px;border-radius:999px;background:rgba(20,22,20,.92);color:#f3efe6;font:12px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)}' +
          '#ltOffBar button{font:inherit;border:0;border-radius:999px;padding:4px 10px;background:#d8b76d;color:#1b1b1b;cursor:pointer}#ltOffBar button:last-child{background:transparent;color:#bbb;padding:4px 6px}';
        document.head.appendChild(st); document.body.appendChild(b);
        if (INFO.note && !localStorage.getItem(MARK + ':noted')) { try { localStorage.setItem(MARK + ':noted', '1'); } catch (e) {} setTimeout(function () { alert('Offline copy of ' + INFO.name + '\n\n' + INFO.note); }, 600); }
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bar); else bar();
    }.toString() + ')(' + json(info) + ',' + json(seed) + ',' + json(files) + ');');
  }

  /* Build the file */
  function make(id) {
    var f = FEAT[id];
    if (!f) return Promise.reject(new Error('No offline copy for ' + id));
    var base = new URL(f.page, location.href), made = today();
    toast('Making the offline copy of ' + f.name + '…');
    var files = {};
    return Promise.all([
      text(base.href),
      Promise.all((f.libs || []).map(function (l) { return text(new URL(l, location.href).href); })),
      Promise.all((f.files || []).map(function (p) { return b64(new URL(p, location.href).href).then(function (d) { files[p.split('/').slice(-2).join('/')] = d; }); }))
    ]).then(function (r) {
      var html = r[0], libs = r[1], jobs = [];
      // every local <script src> and stylesheet goes inside the page
      html.replace(/<script([^>]*?)\ssrc="([^"]+)"([^>]*)><\/script>/g, function (m, a, src) {
        if (/^(https?:)?\/\//.test(src)) return m;
        jobs.push(text(new URL(src, base).href).then(function (code) { return [m, scriptTag(code)]; }));
        return m;
      });
      html.replace(/<link([^>]*?)rel="stylesheet"([^>]*?)href="([^"]+)"([^>]*)>/g, function (m, a, b, href) {
        if (/^(https?:)?\/\//.test(href)) return m;
        jobs.push(text(new URL(href, base).href).then(function (code) { return [m, '<style>\n' + code + '\n</style>']; }));
        return m;
      });
      return Promise.all(jobs).then(function (pairs) {
        pairs.forEach(function (p) { html = html.split(p[0]).join(p[1]); });
        var head = shim(id, f, snapshot(id, f), files, made) + libs.map(scriptTag).join('\n');
        html = html.replace(/<head([^>]*)>/i, function (m) { return m + '\n<!-- ' + f.name + ' — offline copy made ' + made + ' with Lew’s Tracker -->\n' + head; });
        html = html.replace(/<title>([^<]*)<\/title>/i, function (m, t) { return '<title>' + t + ' (offline)</title>'; });
        var blob = new Blob([html], { type: 'text/html' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f.file + '_offline_' + made + '_' + (function () { var d = new Date(); return String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); })() + '.html';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        toast('⬇ ' + f.name + ' offline copy ready (' + (blob.size / 1e6).toFixed(1) + ' MB)');
        return blob;
      });
    }).catch(function (e) { console.error(e); toast('⚠ Offline copy: ' + e.message); throw e; });
  }

  /* Bring the work done in an offline copy back into the website */
  function bringBack(file) {
    return file.text().then(function (t) {
      var o = JSON.parse(t);
      if (!o || !o.lt_offline_work || !o.keys || !FEAT[o.feature]) throw new Error('This is not a "Save work for website" file');
      var f = FEAT[o.feature], inbox = [];
      try { inbox = JSON.parse(o.keys.lt_todo_inbox || '[]') || []; } catch (e) { inbox = []; }
      Object.keys(o.keys).forEach(function (k) { if (k.indexOf('lt_todo_') === 0) delete o.keys[k]; });   // To Do items are added, not stored as data
      var n = Object.keys(o.keys).length, p = proj();
      var when = o.saved ? new Date(o.saved).toLocaleString() : '?';
      if (o.project && o.project !== p.id && !confirm('This work was made from the project "' + (o.projectName || 'another project') + '", but "' + p.name + '" is open now.\n\nOK = bring it into "' + p.name + '" anyway\nCancel = stop (open the right project first)')) return false;
      if (!confirm('Bring back ' + f.name + ' work saved offline on ' + when + '?\n\nIt replaces the ' + f.name + ' data of the project open now (' + n + ' saved parts).' +
        (inbox.length ? '\n' + inbox.length + ' new task' + (inbox.length > 1 ? 's' : '') + ' for your To Do (made offline) will be added, with their links.' : '') +
        '\nThe current website data is kept for one undo (Settings → Offline copies → Undo).')) return false;
      var undo = { feature: o.feature, at: new Date().toISOString(), keys: {} };
      keysOf(f).forEach(function (k) { undo.keys[k] = localStorage.getItem(k); });
      Object.keys(o.keys).forEach(function (k) { if (!(k in undo.keys)) undo.keys[k] = localStorage.getItem(k); });
      try { localStorage.setItem('lt_offline_undo', JSON.stringify(undo)); } catch (e) { if (!confirm('No room to keep an undo copy. Bring the work back anyway?')) return false; }
      if (f.prefix) keysOf(f).forEach(function (k) { if (!(k in o.keys) && k.indexOf(f.prefix) === 0) localStorage.removeItem(k); });
      Object.keys(o.keys).forEach(function (k) { if (k !== THEME) localStorage.setItem(k, o.keys[k]); });
      reloadFeature(o.feature);
      // To Do: add the tasks made offline, then check every link to this feature still points somewhere
      var res = window.LTLinks ? LTLinks.fromOffline(o.feature, inbox) : { added: 0, links: 0, gone: 0 };
      toast('⬆ ' + f.name + ' work brought back' + (res.added ? ' · ' + res.added + ' To Do task' + (res.added > 1 ? 's' : '') + ' added' : '') +
        (res.links ? ' · ' + (res.links - res.gone) + '/' + res.links + ' To Do links OK' : '') + (res.gone ? ' — ' + res.gone + ' point to something no longer there (shown in red on the task)' : ''));
      paint();
      return true;
    }).catch(function (e) { toast('⚠ ' + e.message); });
  }
  function undoBack() {
    var u; try { u = JSON.parse(localStorage.getItem('lt_offline_undo') || 'null'); } catch (e) { u = null; }
    if (!u || !confirm('Put back the ' + (FEAT[u.feature] || {}).name + ' data from before the offline work was brought back?')) return;
    Object.keys(u.keys).forEach(function (k) { if (u.keys[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, u.keys[k]); });
    localStorage.removeItem('lt_offline_undo');
    reloadFeature(u.feature); toast('Undone'); paint();
  }
  function reloadFeature(id) {
    document.querySelectorAll('iframe').forEach(function (fr) { try { if (fr.src.indexOf(FEAT[id].page) >= 0) fr.contentWindow.location.reload(); } catch (e) {} });
  }

  /* Settings → Data & backup → Offline copies */
  function paint() {
    var box = document.getElementById('ltOfflineBtns'); if (!box) return;
    var on = function (id) { return !(window.LT && LT.isOn) || LT.isOn(id); };
    var hasUndo = !!localStorage.getItem('lt_offline_undo');
    box.innerHTML = Object.keys(FEAT).filter(on).map(function (id) { return '<button class="btn" type="button" data-offmake="' + id + '">⬇ ' + FEAT[id].name + '</button>'; }).join('') +
      '<label class="btn">⬆ Bring offline work back<input type="file" accept=".json" hidden data-offback></label>' +
      (hasUndo ? '<button class="btn" type="button" data-offundo>↶ Undo bring back</button>' : '');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-offmake]');
    if (b) { b.disabled = true; make(b.getAttribute('data-offmake')).then(function () { b.disabled = false; }, function () { b.disabled = false; }); }
    if (e.target.closest && e.target.closest('[data-offundo]')) undoBack();
  });
  document.addEventListener('change', function (e) { if (e.target.matches && e.target.matches('[data-offback]') && e.target.files[0]) { bringBack(e.target.files[0]); e.target.value = ''; } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();

  window.LTOffline = { make: make, bringBack: bringBack, FEAT: FEAT, paint: paint };
})();
