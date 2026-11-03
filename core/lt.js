/* ═══════════════════════════════════════════════════════════════════
   core/lt.js — the "motherboard"
   ───────────────────────────────────────────────────────────────────
   Reads the SKILL LIST in index.html and plugs each skill in:
     tab      → its own page in the menu (an .html file shown inside the app)
     function → a tool you run from ⚡ Skills (a .js file, loaded when first used)
     addon    → extra behaviour that loads with the app (pet, sounds, alerts …)
   Also draws Settings → Theme and Settings → Skills, and the ⚡ Skills launcher.
   Nothing in here needs editing to add a skill — just add a line to the list.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LT = window.LT = window.LT || {};
  var OFF_KEY = 'lt_skills_off_v1';
  LT.SKILLS = LT.SKILLS || [];
  LT.fn = LT.fn || {};              // function skills register themselves here
  LT.VERSION = '10.0';

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  LT.esc = esc;
  LT.readJSON = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  LT.writeJSON = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { LT.toast('Could not save — browser storage is full'); return false; } };
  LT.toast = function (m) { if (typeof window.toastMsg === 'function') { try { window.toastMsg(m); return; } catch (e) {} } console.log(m); };
  // the tracker keeps its state in top-level "let" variables (not on window) — read them safely
  LT.data = function () { try { return (typeof data !== 'undefined' && data) || null; } catch (e) { return null; } };
  LT.user = function () { try { return (typeof currentUser !== 'undefined' && currentUser) ? String(currentUser) : ''; } catch (e) { return ''; } };
  LT.today = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------- the list ---------- */
  function offMap() { return LT.readJSON(OFF_KEY, {}); }
  LT.get = function (id) { for (var i = 0; i < LT.SKILLS.length; i++) if (LT.SKILLS[i].id === id) return LT.SKILLS[i]; return null; };
  LT.list = function (type) { return LT.SKILLS.filter(function (s) { return !type || s.type === type; }); };
  LT.isOn = function (id) { var s = LT.get(id); if (!s) return false; var o = offMap(); return o[id] === undefined ? s.on !== false : !o[id]; };
  LT.setOn = function (id, on) { var o = offMap(); o[id] = !on; LT.writeJSON(OFF_KEY, o); };
  // storage keys that belong to the open project (used by core/projects.js)
  LT.projectKeys = function () { var out = []; LT.SKILLS.forEach(function (s) { (s.projectKeys || []).forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); }); }); return out; };

  /* ---------- tab skills → menu + page ---------- */
  LT.injectViews = function (views, icons) {
    var main = document.querySelector('main.main');
    LT.list('tab').forEach(function (s) {
      if (!LT.isOn(s.id)) return;
      views[s.id] = [s.name, s.desc || ''];
      icons[s.id] = s.icon || '◆';
      if (main && !document.getElementById(s.id)) {
        var sec = document.createElement('section');
        sec.id = s.id; sec.className = 'view skill-view';
        sec.innerHTML = '<div class="card skill-frame-card"><iframe class="skill-frame" data-src="' + esc(s.file) + '" title="' + esc(s.name) + '" allow="clipboard-write"></iframe></div>';
        main.appendChild(sec);
      }
    });
    var more = document.getElementById('moreSkills');
    if (more) more.innerHTML = LT.list('tab').filter(function (s) { return LT.isOn(s.id); }).map(function (s) {
      return '<button class="template" onclick="show(\'' + s.id + '\');closeModal(\'moreSheet\')"><b>' + esc(s.icon + ' ' + s.name) + '</b><small>' + esc(s.short || 'Skill') + '</small></button>';
    }).join('');
  };
  LT.frame = function (id) { var s = document.getElementById(id); return s ? s.querySelector('iframe') : null; };
  LT.reloadFrames = function () { document.querySelectorAll('iframe.skill-frame').forEach(function (f) { if (f.getAttribute('src')) f.src = f.getAttribute('data-src'); }); };

  /* ---------- addon skills → written into the page while it loads ---------- */
  LT.writeAddons = function () {
    LT.list('addon').forEach(function (s) {
      if (!LT.isOn(s.id)) return;
      (s.css || []).forEach(function (h) { document.write('<link rel="stylesheet" href="' + esc(h) + '">'); });
      (s.js || []).forEach(function (src) { document.write('<script src="' + esc(src) + '"><\/script>'); });
    });
  };

  /* ---------- function skills → loaded on first run ---------- */
  var loading = {};
  function loadScript(src) {
    if (loading[src]) return loading[src];
    loading[src] = new Promise(function (res, rej) {
      var el = document.createElement('script'); el.src = src;
      el.onload = res; el.onerror = function () { delete loading[src]; rej(new Error('Could not load ' + src)); };
      document.head.appendChild(el);
    });
    return loading[src];
  }
  LT.loadScript = loadScript;
  LT.runSkill = function (id, arg) {
    var s = LT.get(id);
    if (!s) return LT.toast('Unknown skill: ' + id);
    if (!LT.isOn(id)) return LT.toast(s.name + ' is switched off (Settings → Skills)');
    if (s.type === 'tab') { if (typeof show === 'function') show(id); return; }
    return loadScript(s.file).then(function () {
      var f = LT.fn[id];
      if (!f || typeof f.run !== 'function') throw new Error(s.file + ' did not register LT.fn["' + id + '"]');
      return f.run(LT.ctx, arg);
    }).catch(function (e) { console.error(e); LT.toast('⚠ ' + s.name + ': ' + e.message); });
  };

  /* ---------- pop-up window used by skills ---------- */
  LT.modal = function (title, html, opts) {
    opts = opts || {};
    var m = document.getElementById('ltModal');
    if (!m) {
      m = document.createElement('div'); m.id = 'ltModal'; m.className = 'modal';
      m.addEventListener('click', function (e) { if (e.target === m) LT.closeModal(); });
      document.body.appendChild(m);
    }
    m.innerHTML = '<div class="modal-card lt-modal-card" style="width:min(' + (opts.width || 760) + 'px,100%)">' +
      '<div class="modal-head"><h3 style="margin:0">' + title + '</h3><button class="icon" onclick="LT.closeModal()">×</button></div>' +
      '<div class="lt-modal-body">' + html + '</div></div>';
    m.classList.add('show');
    return m.querySelector('.lt-modal-body');
  };
  LT.closeModal = function () { var m = document.getElementById('ltModal'); if (m) m.classList.remove('show'); };
  LT.download = function (name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };

  /* ---------- what a function skill can use (ctx) ---------- */
  LT.ctx = {
    esc: esc, toast: function (m) { LT.toast(m); }, modal: function (t, h, o) { return LT.modal(t, h, o); }, close: function () { LT.closeModal(); },
    download: function (n, b) { LT.download(n, b); }, readJSON: LT.readJSON, writeJSON: LT.writeJSON, today: LT.today,
    project: function () { return window.LTProjects ? LTProjects.active() : { id: 'default', name: 'Project' }; },
    team: function () { return LT.readJSON('lews_team_v1', []).map(function (m) { return typeof m === 'string' ? m : (m && m.name) || ''; }).filter(Boolean); },
    register: function () { return LT.readJSON('lews_register_state_v1', null); },            // Register (classic) data
    drawingRegister: function () {                                                           // the MIDP Checker's summary (drawings, models, typologies)
      var X = LT.readJSON('tidp-checker:index', null); if (!X || !X.rows || !X.rows.length) return Promise.resolve(null);
      var modelByNum = {};
      (X.models || []).forEach(function (m) { modelByNum[String(m[0]).toUpperCase()] = { num: m[0], name: m[1] }; });
      var drawings = X.rows.map(function (r) {
        return { key: r[0], num: r[1], title: r[2], rev: r[3], bld: r[4], bldName: r[11] || r[4], lvl: r[5], type: r[6],
          typology: { name: r[7] }, model: { num: r[8], name: r[9] }, last: r[10] };
      });
      return Promise.resolve({ state: X, index: { drawings: drawings, modelByNum: modelByNum, sent: X.sent, overdue: X.overdue } });
    },
    qaqc: function () { return LT.readJSON('lews_qaqc_state_v1', null); },
    tracker: function () { return LT.data(); },
    delegation: function () { return LT.readJSON('lt_delegate_v1', null); },
    // add tasks to the Delegation skill: [{title, group, assignees, due, notes, subs:[{title, assignees, due}]}]
    sendToDelegation: function (tasks, groupName) {
      var D = LT.readJSON('lt_delegate_v1', null) || { version: 1, seq: 0, groups: [], tasks: [] };
      D.groups = D.groups || []; D.tasks = D.tasks || []; D.seq = D.seq || 0;
      var g = null;
      if (groupName) {
        g = D.groups.filter(function (x) { return x.name.toLowerCase() === String(groupName).toLowerCase(); })[0];
        if (!g) { g = { id: 'g' + Date.now().toString(36), name: groupName, members: [] }; D.groups.push(g); }
      }
      var now = new Date().toISOString(), made = [];
      tasks.forEach(function (t) {
        D.seq++;
        var code = 'T' + String(D.seq).padStart(2, '0');
        D.tasks.push({
          id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: code,
          title: t.title || 'Untitled task', group: g ? g.id : (t.group || ''), assignees: t.assignees || '', due: t.due || '',
          status: 'Not started', notes: t.notes || '', created: now, updated: now, history: [{ at: now, text: 'Created from a skill' }],
          subs: (t.subs || []).map(function (s, i) { return { id: 's' + Math.random().toString(36).slice(2, 9), code: code + '.' + (i + 1), title: s.title, assignees: s.assignees || '', due: s.due || t.due || '', status: 'Not started', notes: s.notes || '' }; })
        });
        made.push(D.tasks[D.tasks.length - 1]);
      });
      LT.writeJSON('lt_delegate_v1', D);
      var f = LT.frame('delegate'); if (f && f.getAttribute('src')) f.src = f.getAttribute('data-src');
      LT.toast('✓ ' + tasks.length + ' task' + (tasks.length === 1 ? '' : 's') + ' sent to Delegation');
      return made;
    }
  };

  /* ---------- ⚡ Skills launcher ---------- */
  LT.openSkills = function () {
    var on = LT.SKILLS.filter(function (s) { return LT.isOn(s.id) && s.type !== 'addon'; });
    var row = function (s) {
      var act = s.type === 'tab' ? 'Open' : 'Run';
      return '<button class="lt-skill-pick" data-id="' + esc(s.id) + '"><span class="lt-sk-ic">' + esc(s.icon || '◆') + '</span>' +
        '<span class="lt-sk-tx"><b>' + esc(s.name) + '</b><small>' + esc(s.desc || '') + '</small></span><span class="pill">' + act + '</span></button>';
    };
    var body = LT.modal('⚡ Skills',
      '<input id="ltSkillQ" placeholder="Find a skill…" autocomplete="off" style="margin-bottom:10px">' +
      '<div class="small" style="margin:4px 0 6px">Tools</div><div class="lt-skill-list" data-k="function">' + on.filter(function (s) { return s.type === 'function'; }).map(row).join('') + '</div>' +
      '<div class="small" style="margin:12px 0 6px">Pages</div><div class="lt-skill-list" data-k="tab">' + on.filter(function (s) { return s.type === 'tab'; }).map(row).join('') + '</div>' +
      '<p class="small" style="margin-top:12px">Add, remove or switch skills off in <a href="#" onclick="LT.closeModal();show(\'settings\');setTimeout(function(){var c=document.getElementById(\'ltSkillsCard\');if(c)c.scrollIntoView({behavior:\'smooth\'})},150);return false">Settings → Skills</a>.</p>', { width: 620 });
    body.addEventListener('click', function (e) {
      var b = e.target.closest('.lt-skill-pick'); if (!b) return;
      LT.closeModal(); LT.runSkill(b.getAttribute('data-id'));
    });
    var q = body.querySelector('#ltSkillQ');
    q.addEventListener('input', function () {
      var v = q.value.toLowerCase();
      body.querySelectorAll('.lt-skill-pick').forEach(function (b) { b.style.display = b.textContent.toLowerCase().indexOf(v) > -1 ? '' : 'none'; });
    });
    setTimeout(function () { q.focus(); }, 60);
  };

  /* ---------- Settings → Skills (the visible list) ---------- */
  var TYPE_LABEL = { tab: 'Page', 'function': 'Tool', addon: 'Add-on' };
  LT.renderSkillsCard = function () {
    var el = document.getElementById('ltSkillsCard'); if (!el) return;
    var rows = LT.SKILLS.map(function (s) {
      var on = LT.isOn(s.id);
      return '<div class="lt-skill-row' + (on ? '' : ' off') + '">' +
        '<span class="lt-sk-ic">' + esc(s.icon || '◆') + '</span>' +
        '<div class="lt-sk-tx"><b>' + esc(s.name) + '</b> <span class="pill">' + TYPE_LABEL[s.type] + '</span> <span class="small">v' + esc(s.version || '1.0') + '</span>' +
        '<small>' + esc(s.desc || '') + '</small><code class="lt-sk-file">' + esc(s.file || (s.js || []).join(' · ')) + '</code></div>' +
        '<div class="lt-sk-act">' + (on && s.type !== 'addon' ? '<button class="btn" onclick="LT.runSkill(\'' + s.id + '\')">' + (s.type === 'tab' ? 'Open' : 'Run') + '</button>' : '') +
        '<label class="lt-switch" title="Switch on / off"><input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="LT.toggleSkill(\'' + s.id + '\',this.checked)"><span></span></label></div></div>';
    }).join('');
    el.innerHTML = '<div class="panel-actions" style="justify-content:space-between"><h3 style="margin:0">⚡ Skills <span class="small">— the upgrade pieces</span></h3><button class="btn primary" onclick="LT.openSkills()">Open launcher</button></div>' +
      '<p class="small">Each skill is its own file in the <code>skills/</code> folder, listed in the <b>SKILL LIST</b> inside <code>index.html</code>. Switch one off here without deleting it. ' +
      '<b>Page</b> = its own tab · <b>Tool</b> = runs from ⚡ Skills · <b>Add-on</b> = loads with the app.</p>' +
      '<div class="lt-skill-rows">' + rows + '</div>';
  };
  LT.toggleSkill = function (id, on) {
    var s = LT.get(id);
    LT.setOn(id, on);
    LT.renderSkillsCard();
    if (s && s.type !== 'function') {
      LT.toast((on ? 'Switched on: ' : 'Switched off: ') + s.name + ' — reloading…');
      setTimeout(function () { location.reload(); }, 900);
    } else LT.toast((on ? 'Switched on: ' : 'Switched off: ') + (s ? s.name : id));
  };

  /* ---------- Settings → Theme + keep the tracker's own classes in step ---------- */
  function syncTrackerClasses(e) {
    var b = document.body; if (!b) return;
    b.classList.toggle('light', e.mode === 'light' && (e.skin === 'gold' || e.pixel));
    b.classList.toggle('pastel', e.skin === 'pastel');
    b.classList.toggle('melliea', e.skin === 'rose');
    if (e.skin === 'rose') { if (typeof startFloatingHearts === 'function') try { startFloatingHearts(); } catch (x) {} }
    else if (typeof stopFloatingHearts === 'function') try { stopFloatingHearts(); } catch (x) {}
    var D = LT.data();
    if (D && D.settings) {
      D.settings.theme = e.skin === 'pastel' ? 'pastel' : e.mode;
      D.settings.pastel = e.skin === 'pastel';
      D.settings.mellieaTheme = e.skin === 'rose';
      D.settings.autoTheme = e.auto;
    }
    var set = function (id, v) { var x = document.getElementById(id); if (x) x.checked = v; };
    set('pastelToggle', e.skin === 'pastel'); set('mellieaToggle', e.skin === 'rose'); set('autoThemeToggle', e.auto);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { var c = getComputedStyle(b).getPropertyValue('--bg').trim(); if (c && c.charAt(0) === '#') meta.setAttribute('content', c); }
    LT.renderThemeCard();
  }
  LT.renderThemeCard = function () {
    var el = document.getElementById('ltThemeCard'); if (!el || !window.LTTheme) return;
    var t = LTTheme.raw(), e = LTTheme.get(), S = LTTheme.SKINS;
    var tiles = Object.keys(S).map(function (k) {
      var s = S[k];
      return '<button class="lt-skin' + (t.skin === k ? ' on' : '') + (s.pixel ? ' px' : '') + '" onclick="LTTheme.set({skin:\'' + k + '\'})">' +
        '<span class="lt-sw" style="background:' + s.swatch[1] + '"><i style="background:' + s.swatch[0] + '"></i></span><b>' + esc(s.name) + '</b></button>';
    }).join('');
    var fixed = S[t.skin].fixed;
    var seg = function (v, label) {
      var on = v === 'auto' ? t.auto : (!t.auto && t.mode === v);
      var click = v === 'auto' ? 'LTTheme.set({auto:true})' : 'LTTheme.set({mode:\'' + v + '\',auto:false})';
      return '<button class="btn' + (on ? ' primary' : '') + '"' + (fixed ? ' disabled' : '') + ' onclick="' + click + '">' + label + '</button>';
    };
    el.innerHTML = '<h3>🎨 Theme <span class="small">— every tab follows it</span></h3>' +
      '<div class="lt-skins">' + tiles + '</div>' +
      '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">' + seg('dark', '🌙 Dark') + seg('light', '☀ Light') + seg('auto', '🖥 Auto') +
      (fixed ? '<span class="small" style="align-self:center">' + esc(S[t.skin].name) + ' is always ' + fixed + '</span>' : '') + '</div>' +
      ((e.pixel || e.retro) && LT.isOn('sounds') ? '<label class="small" style="display:block;margin-top:12px"><input type="checkbox" style="width:auto" ' + (e.sound ? 'checked' : '') + ' onchange="LTTheme.set({sound:this.checked})"> 8-bit sounds on clicks &amp; finished tasks</label>' : '') +
      '<p class="small" style="margin-top:10px">Every tab follows this. Text size and spacing are in Appearance below.</p>';
  };

  /* ---------- hide buttons for skills that are off (data-skill="id") ---------- */
  function hideOffSkillButtons() {
    document.querySelectorAll('[data-skill]').forEach(function (el) { if (!LT.isOn(el.getAttribute('data-skill'))) el.style.display = 'none'; });
  }

  /* ---------- skill pages can talk to the app (same site only) ---------- */
  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin || !ev.data || !ev.data.lt) return;
    var d = ev.data;
    if (d.lt === 'toast') LT.toast(d.text);
    else if (d.lt === 'show' && typeof show === 'function') show(d.view);
    else if (d.lt === 'run') LT.runSkill(d.id, d.arg);
    else if (d.lt === 'saved' && typeof window.__trackerEmbedSaved === 'function') window.__trackerEmbedSaved(d.what);
  });

  /* ---------- keyboard: S opens the launcher ---------- */
  document.addEventListener('keydown', function (e) {
    var a = document.activeElement;
    if (e.ctrlKey || e.metaKey || e.altKey || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable))) return;
    if (document.querySelector('.login-screen.show') || document.querySelector('.modal.show')) return;
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); LT.openSkills(); }
  });

  // skill pages get the full height: hide the tracker's quick-add bar while one is open
  function wrapShow() {
    if (typeof window.show !== 'function' || window.show.__lt) return;
    var orig = window.show;
    window.show = function (id) {
      var r = orig.apply(this, arguments);
      var s = LT.get(id);
      document.body.classList.toggle('on-skill', !!(s && s.type === 'tab'));
      return r;
    };
    window.show.__lt = true;
  }
  LT.wrapShow = wrapShow;

  function init() {
    if (window.LTTheme) LTTheme.onChange(syncTrackerClasses);
    LT.renderSkillsCard();
    hideOffSkillButtons();
  }
  // lt.js loads at the end of <body>, so the page is already there — plug in now
  // (a remembered login starts the app before DOMContentLoaded)
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
