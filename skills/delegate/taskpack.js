/* ═══════════════════════════════════════════════════════════════════
   skills/delegate/taskpack.js — share tasks with people who don't use the website
   ───────────────────────────────────────────────────────────────────
   build(pack)          → one self-contained .html "Task Pack" (works offline,
                          no login). Its app + data are scrambled inside, so
                          opening it in Notepad shows nothing readable.
   parseReply(text)     → { meta, rows, message, name } from the reply the
                          person sends back (file or pasted code). rows use
                          the same shape as the Excel reader, so Delegation's
                          import treats both the same way.
   simpleExcel(ExcelJS, plan) → a plain Excel table (no formulas, no grouping,
                          no drop-downs) for people who prefer to copy by hand.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var MARK = 'LTUPDATE1:';

  /* ---------- the app that runs inside the Task Pack (kept free of comments: it is embedded) ---------- */
  function runtime(P) {
    var KEY = 'ltpack:' + (P.projectId || '') + ':' + (P.person || P.label || P.id);
    var BASE = {};
    P.tasks.forEach(function (t) { BASE[t.code] = t; t.subs.forEach(function (x) { BASE[x.code] = x; }); });
    var ST = [['Not started', 'To do'], ['In progress', 'Doing'], ['Completed', 'Done']];
    var TODAY = (function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    var S;
    try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
    S = S || { items: {}, newItems: {}, newTasks: [], msg: '', name: P.person || '', filter: 'all', q: '', help: true };
    S.items = S.items || {}; S.newItems = S.newItems || {}; S.newTasks = S.newTasks || [];
    var same = function (a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); };
    Object.keys(S.newItems).forEach(function (c) {
      var t = BASE[c]; if (!t || !t.subs) { delete S.newItems[c]; return; }
      S.newItems[c] = S.newItems[c].filter(function (n) { return !t.subs.some(function (x) { return same(x.title, n.title); }); });
    });
    S.newTasks = S.newTasks.filter(function (nt) { return !P.tasks.some(function (t) { return same(t.title, nt.title); }); });
    var saveOk = true;
    function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); saveOk = true; } catch (e) { saveOk = false; } }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function lid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
    function fmt(d) { if (!d) return ''; var x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
    function pend(code, base) {
      var o = S.items[code] || {}, bs = base.status || 'Not started', bn = base.notes || '';
      return { status: o.status != null && o.sFrom === bs && o.status !== bs ? o.status : null, notes: o.notes != null && o.nFrom === bn && o.notes !== bn ? o.notes : null };
    }
    function cur(code, base) { var p = pend(code, base); return { status: p.status || base.status || 'Not started', notes: p.notes != null ? p.notes : (base.notes || '') }; }
    function setItem(code, field, v) {
      var base = BASE[code]; if (!base) return;
      var o = S.items[code] = S.items[code] || {}, p = pend(code, base);
      if (field === 'status') { if (p.status == null) o.sFrom = base.status || 'Not started'; o.status = v; }
      else { if (p.notes == null) o.nFrom = base.notes || ''; o.notes = v; }
    }
    function lines() {
      var out = [];
      P.tasks.forEach(function (t) {
        if (!t.subs.length) out.push({ t: t, code: t.code, base: t, due: t.due });
        t.subs.forEach(function (s) { out.push({ t: t, code: s.code, base: s, due: s.due || t.due }); });
        (S.newItems[t.code] || []).forEach(function (n) { out.push({ t: t, n: n, due: n.due || t.due }); });
      });
      S.newTasks.forEach(function (nt) { (nt.items.length ? nt.items : [nt]).forEach(function (n) { out.push({ nt: nt, n: n, due: n.due || nt.due }); }); });
      return out;
    }
    function stOf(l) { return l.n ? l.n.status : cur(l.code, l.base).status; }
    function late(l) { var s = stOf(l); return l.due && l.due < TODAY && s !== 'Completed'; }

    var css = document.createElement('style');
    css.textContent = [
      ':root{--ink:#1f2430;--muted:#5f6675;--line:#e1e4ea;--bg:#f4f5f9;--card:#fff;--acc:#5b3e7e;--acc2:#3d2b56;--ok:#2e7d4f;--ip:#b7791f;--bad:#c0392b;--soft:#f3f0f8}',
      '*{box-sizing:border-box}body{margin:0;font:15px/1.4 "Segoe UI",Calibri,system-ui,sans-serif;color:var(--ink);background:var(--bg)}',
      '.top{background:linear-gradient(135deg,var(--acc2),var(--acc));color:#fff;padding:10px 16px}.top .row1{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;max-width:980px;margin:0 auto}.top h1{margin:0;font-size:17px;letter-spacing:.02em}.top .sub{opacity:.85;font-size:13px}',
      '.top .prog{max-width:980px;margin:6px auto 0;display:flex;align-items:center;gap:8px;font-size:13px}.bar{flex:1;height:7px;background:rgba(255,255,255,.25);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:#9be37b}',
      '.wrap{max-width:980px;margin:0 auto;padding:10px 12px 90px}',
      '.help{background:#fffbea;border:1px solid #f0d98c;border-radius:10px;padding:7px 12px;margin-bottom:10px;font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.help span{flex:1}',
      '.bar2{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.bar2 input{flex:1 1 160px;padding:6px 10px}',
      'input,textarea{font:inherit;color:inherit;border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:#fff;width:100%}textarea{min-height:34px;resize:vertical}',
      'button{font:inherit;cursor:pointer;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);padding:5px 12px;font-weight:600;font-size:14px}button:hover{border-color:var(--acc)}',
      'button.main{background:var(--acc);border-color:var(--acc);color:#fff}button.chip.on{background:var(--soft);border-color:var(--acc);color:var(--acc)}',
      '.card{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden}',
      '.ch{padding:7px 12px;background:var(--soft);display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;font-size:14px}.ch b{font-size:15px}.code{font:600 12px Consolas,monospace;color:var(--muted)}.grp,.cnt{font-size:12px;color:var(--muted)}.due{margin-left:auto;font-size:12.5px;color:var(--muted)}.due.late{color:var(--bad);font-weight:700}',
      '.lew{padding:4px 12px;font-size:13px;color:var(--muted);border-bottom:1px solid var(--line)}',
      '.it{padding:5px 12px;border-top:1px solid var(--line);display:grid;grid-template-columns:auto 1fr auto;gap:2px 10px;align-items:center;min-height:38px}.it:first-of-type{border-top:0}',
      '.it .nm{min-width:0}.it .nm span{font-weight:600}.it .nm small{color:var(--muted);font-size:12px;margin-left:6px;white-space:nowrap}.it .nm small.late{color:var(--bad);font-weight:700}.it .nm em{display:block;font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.it.done .nm span{text-decoration:line-through;opacity:.55}',
      '.sts{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}.sts button{border:0;border-radius:0;padding:3px 9px;font-size:12.5px;background:#fff;color:var(--muted)}.sts button+button{border-left:1px solid var(--line)}',
      '.sts button.on.s0{background:#e9ebf0;color:var(--ink)}.sts button.on.s1{background:#fdf1d8;color:#8a5a0c}.sts button.on.s2{background:#dff3e6;color:var(--ok)}',
      '.tools{display:flex;gap:2px}.ib{border:0;background:none;padding:3px 6px;font-size:15px;color:var(--muted)}.ib.has{color:var(--acc)}.ib.x{color:var(--bad);font-size:17px}',
      '.it textarea{grid-column:1/-1;font-size:13.5px;margin:2px 0 4px}.new{background:#fbfaff}.tag{font-size:10.5px;font-weight:700;color:var(--acc);border:1px solid var(--acc);border-radius:99px;padding:0 5px;margin-left:5px;vertical-align:1px}',
      '.add{padding:5px 12px;border-top:1px dashed var(--line);display:flex;gap:6px}.add input{flex:1;padding:4px 9px;font-size:14px;border-style:dashed}.add button{padding:3px 10px;font-size:13px}',
      '.panel{padding:10px 12px;display:grid;gap:7px}.lbl{font-size:12.5px;color:var(--muted)}',
      '.foot{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);padding:7px 12px;box-shadow:0 -2px 10px rgba(0,0,0,.06)}.foot .in{max-width:980px;margin:0 auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.foot .hint{font-size:12.5px;color:var(--muted);flex:1 1 200px}',
      '.saved{color:var(--ok)}.saved.no{color:var(--bad)}',
      '.modal{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:16px;z-index:9}.modal .box{background:#fff;border-radius:14px;padding:16px;max-width:560px;width:100%}.modal textarea{min-height:160px;font:12px Consolas,monospace}',
      '@media(max-width:600px){.it{grid-template-columns:1fr auto}.it .sts{grid-column:1/-1;order:3;justify-self:start}.due{margin-left:0;width:100%}}',
      '@media print{.foot,.help,.bar2,.add,.tools,.panelbtn,.panelcard{display:none!important}.it textarea{display:none}.wrap{padding-bottom:0}.card{break-inside:avoid}.sts button:not(.on){display:none}}'
    ].join('\n');
    document.head.appendChild(css);
    document.title = 'Tasks — ' + (P.label || P.person || '');

    var OPEN = {};
    function itemHtml(l) {
      var key = l.n ? 'n:' + l.n.lid : 'c:' + l.code, st = stOf(l), notes = l.n ? l.n.notes : cur(l.code, l.base).notes;
      var title = l.n ? l.n.title : (l.base === l.t ? 'Status of this task' : l.base.title), lt = late(l);
      return '<div class="it' + (st === 'Completed' ? ' done' : '') + (l.n ? ' new' : '') + '">' +
        '<div class="sts">' + ST.map(function (s, i) { return '<button class="s' + i + (s[0] === st ? ' on' : '') + '" data-st="' + key + '" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
        '<div class="nm"><span>' + esc(title) + '</span>' + (l.n ? '<span class="tag">NEW</span>' : '') + (!l.n && l.base && l.base.info ? '<small class="inf">' + esc(l.base.info) + '</small>' : '') +
        '<small class="' + (lt ? 'late' : '') + '">' + (l.due ? (lt ? 'overdue ' : '') + esc(fmt(l.due)) : '') + '</small>' +
        (notes && !OPEN[key] ? '<em>✎ ' + esc(notes) + '</em>' : '') + '</div>' +
        '<div class="tools"><button class="ib' + (notes ? ' has' : '') + '" data-noteopen="' + key + '" title="' + (notes ? 'Edit note' : 'Add a note') + '">✎</button>' +
        (l.n ? '<button class="ib x" data-del="' + key + '" title="Remove">×</button>' : '') + '</div>' +
        (OPEN[key] ? '<textarea data-note="' + key + '" placeholder="Your note…">' + esc(notes) + '</textarea>' : '') + '</div>';
    }
    function match(l) {
      var q = (S.q || '').toLowerCase(), st = stOf(l);
      if (S.filter === 'open' && st === 'Completed') return false;
      if (S.filter === 'done' && st !== 'Completed') return false;
      if (q) { var h = [(l.t || l.nt).title, l.n ? l.n.title : l.base.title, l.code || ''].join(' ').toLowerCase(); if (h.indexOf(q) < 0) return false; }
      return true;
    }
    function render() {
      var all = lines(), done = all.filter(function (l) { return stOf(l) === 'Completed'; }).length, lateN = all.filter(late).length;
      var pct = all.length ? Math.round(done / all.length * 100) : 0;
      var h = '<div class="top"><div class="row1"><h1>TASKS FOR ' + esc((P.label || '').toUpperCase()) + '</h1><span class="sub">' + esc(P.project) + ' · from ' + esc(P.by || '—') + ' · ' + esc(fmt(P.at)) + '</span></div>' +
        '<div class="prog"><span>' + done + ' of ' + all.length + ' done' + (lateN ? ' · <b>' + lateN + ' overdue</b>' : '') + '</span><div class="bar"><i style="width:' + pct + '%"></i></div><span>' + pct + '%</span></div></div><div class="wrap">';
      if (S.help) h += '<div class="help"><span>👋 Click <b>To do / Doing / Done</b> on each line · <b>✎</b> adds a note · then <b>📤 Save reply</b> and send the file to ' + esc(P.by || 'me') + '.</span><button data-help="0">Got it</button></div>';
      h += '<div class="bar2"><input id="q" placeholder="Search…" value="' + esc(S.q) + '">' + [['all', 'All'], ['open', 'To do'], ['done', 'Done']].map(function (f) { return '<button class="chip' + (S.filter === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
        '<button class="chip panelbtn' + (S.panel === 'task' ? ' on' : '') + '" data-panel="task">+ New task</button><button class="chip panelbtn' + (S.panel === 'msg' ? ' on' : '') + '" data-panel="msg">💬 Message' + (S.msg ? ' ✓' : '') + '</button></div>';
      if (S.panel === 'task') h += '<div class="card panelcard"><div class="panel"><input id="ntT" placeholder="Task name — something extra you are working on"><textarea id="ntI" placeholder="Items — one per line (optional)"></textarea>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="lbl">Target date</span><input id="ntD" type="date" style="width:auto"><button class="main" data-newtask="1">Add task</button></div></div></div>';
      if (S.panel === 'msg') h += '<div class="card panelcard"><div class="panel"><input id="nm" placeholder="Your name" value="' + esc(S.name) + '"><textarea id="msg" placeholder="Anything to tell ' + esc(P.by || 'me') + '? (goes with your reply)">' + esc(S.msg) + '</textarea></div></div>';
      P.tasks.forEach(function (t) {
        var mine = all.filter(function (l) { return l.t === t; }), ls = mine.filter(match);
        if (!ls.length && (S.q || S.filter !== 'all')) return;
        var dn = mine.filter(function (l) { return stOf(l) === 'Completed'; }).length;
        var tlate = t.due && t.due < TODAY && dn < mine.length;
        h += '<div class="card"><div class="ch"><span class="code">' + esc(t.code) + '</span><b>' + esc(t.title) + '</b>' + (t.group ? '<span class="grp">' + esc(t.group) + '</span>' : '') +
          '<span class="cnt">' + dn + '/' + mine.length + '</span><span class="due' + (tlate ? ' late' : '') + '">' + (t.due ? (tlate ? 'overdue ' : 'due ') + esc(fmt(t.due)) : '') + '</span></div>' +
          (t.notes ? '<div class="lew">📝 ' + esc(t.notes) + '</div>' : '') + ls.map(itemHtml).join('') +
          '<div class="add"><input data-addin="' + esc(t.code) + '" placeholder="+ add an item…"><button data-add="' + esc(t.code) + '">Add</button></div></div>';
      });
      S.newTasks.forEach(function (nt) {
        var ls = all.filter(function (l) { return l.nt === nt && match(l); });
        h += '<div class="card"><div class="ch"><span class="tag">NEW TASK</span><b>' + esc(nt.title) + '</b><button class="ib x" data-delt="' + nt.lid + '" title="Remove this new task">×</button>' +
          '<span class="due">' + (nt.due ? 'due ' + esc(fmt(nt.due)) : '') + '</span></div>' + ls.map(itemHtml).join('') +
          '<div class="add"><input data-addin="t:' + nt.lid + '" placeholder="+ add an item…"><button data-add="t:' + nt.lid + '">Add</button></div></div>';
      });
      h += '</div><div class="foot"><div class="in"><span class="hint"><span class="saved' + (saveOk ? '' : ' no') + '">' + (saveOk ? '✓ Kept on this computer' : '⚠ Not kept — save a reply now') + '</span> · press <b>Save reply</b> and send the file back</span>' +
        '<button class="main" data-act="reply">📤 Save reply</button><button data-act="copy">📋 Copy</button><button data-act="print">🖨</button><button data-act="csv" title="Download as Excel (CSV)">⬇ Excel</button></div></div>';
      document.getElementById('app').innerHTML = h;
    }
    function find(key) {
      if (key.indexOf('n:') === 0) {
        var id = key.slice(2), hit = null;
        Object.keys(S.newItems).forEach(function (c) { S.newItems[c].forEach(function (n) { if (n.lid === id) hit = n; }); });
        S.newTasks.forEach(function (nt) { if (nt.lid === id) hit = nt; nt.items.forEach(function (n) { if (n.lid === id) hit = n; }); });
        return hit;
      }
      var code = key.slice(2); return S.items[code] = S.items[code] || {};
    }
    function reply() {
      var items = [], rows = [];
      P.tasks.forEach(function (t) {
        var tp = pend(t.code, t);
        rows.push({ id: t.code, title: t.title, status: t.subs.length ? '' : (tp.status || ''), notes: tp.notes, derived: !!t.subs.length });
        t.subs.forEach(function (s) { var sp = pend(s.code, s); rows.push({ id: s.code, title: s.title, status: sp.status || '', notes: sp.notes }); });
        (S.newItems[t.code] || []).forEach(function (n) { rows.push({ id: '', title: n.title, status: n.status, notes: n.notes, due: n.due || '' }); });
      });
      S.newTasks.forEach(function (nt) {
        rows.push({ id: 'NEW', title: nt.title, status: nt.items.length ? '' : nt.status, notes: nt.notes || '', due: nt.due || '' });
        nt.items.forEach(function (n) { rows.push({ id: '', title: n.title, status: n.status, notes: n.notes, due: n.due || nt.due || '' }); });
      });
      var body = JSON.stringify({ kind: 'lt-taskpack-reply', v: 1, pack: P.id, projectId: P.projectId, project: P.project, person: P.person || '', label: P.label, name: S.name, message: S.msg, at: new Date().toISOString(), rows: rows });
      var b64 = btoa(unescape(encodeURIComponent(body))).replace(/(.{76})/g, '$1\n');
      return "Lew's Tracker — task update\nFrom: " + (S.name || P.label) + '   Tasks for: ' + P.label + '   Project: ' + P.project + '\nSent: ' + new Date().toLocaleString() + '\n\n(Please do not change the lines below.)\n' + P.MARK + '\n' + b64 + '\n';
    }
    function download(name, text, type) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }
    function fileName(s) { return String(s || 'Tasks').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_'); }
    function csv() {
      var rows = [['ID', 'Task', 'Item', 'Due date', 'Status', 'Notes']];
      lines().forEach(function (l) {
        var st = stOf(l), notes = l.n ? l.n.notes : cur(l.code, l.base).notes, task = (l.t || l.nt).title;
        var item = l.n ? (l.nt && l.n === l.nt ? '' : l.n.title) : (l.base === l.t ? '' : l.base.title);
        rows.push([l.code || 'NEW', task, item, l.due || '', st, notes || '']);
      });
      return '\ufeff' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    }
    function showCopy(text) {
      var m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = '<div class="box"><b>Copy this and paste it into an email or Teams message</b><textarea readonly>' + esc(text) + '</textarea><div style="text-align:right;margin-top:8px"><button class="main" data-close="1">Close</button></div></div>';
      document.body.appendChild(m); var ta = m.querySelector('textarea'); ta.focus(); ta.select();
      m.addEventListener('click', function (e) { if (e.target === m || e.target.getAttribute('data-close')) m.remove(); });
    }
    document.addEventListener('click', function (e) {
      var el = e.target.closest('button'); if (!el) return;
      var a = function (k) { return el.getAttribute(k); };
      if (a('data-st')) { var k = a('data-st'); if (k.indexOf('c:') === 0) setItem(k.slice(2), 'status', a('data-v')); else { var o = find(k); if (o) o.status = a('data-v'); } save(); render(); }
      else if (a('data-noteopen')) { var k0 = a('data-noteopen'); OPEN[k0] = !OPEN[k0]; render(); var ta = document.querySelector('[data-note="' + k0 + '"]'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
      else if (a('data-panel')) { S.panel = S.panel === a('data-panel') ? '' : a('data-panel'); save(); render(); var fi = document.getElementById(S.panel === 'task' ? 'ntT' : 'msg'); if (fi) fi.focus(); }
      else if (a('data-f')) { S.filter = a('data-f'); save(); render(); }
      else if (a('data-help')) { S.help = false; save(); render(); }
      else if (a('data-add')) {
        var k = a('data-add'), inp = document.querySelector('[data-addin="' + k + '"]'), v = inp.value.trim(); if (!v) { inp.focus(); return; }
        var n = { lid: lid(), title: v, status: 'Not started', notes: '' };
        if (k.indexOf('t:') === 0) { S.newTasks.forEach(function (nt) { if (nt.lid === k.slice(2)) nt.items.push(n); }); }
        else (S.newItems[k] = S.newItems[k] || []).push(n);
        save(); render(); var again = document.querySelector('[data-addin="' + k + '"]'); if (again) again.focus();
      }
      else if (a('data-del')) {
        var id = a('data-del').slice(2);
        Object.keys(S.newItems).forEach(function (c) { S.newItems[c] = S.newItems[c].filter(function (n) { return n.lid !== id; }); });
        S.newTasks.forEach(function (nt) { nt.items = nt.items.filter(function (n) { return n.lid !== id; }); });
        save(); render();
      }
      else if (a('data-delt')) { if (confirm('Remove this new task?')) { S.newTasks = S.newTasks.filter(function (nt) { return nt.lid !== a('data-delt'); }); save(); render(); } }
      else if (a('data-newtask')) {
        var t = document.getElementById('ntT').value.trim(); if (!t) { document.getElementById('ntT').focus(); return; }
        var its = document.getElementById('ntI').value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
        S.newTasks.push({ lid: lid(), title: t, due: document.getElementById('ntD').value, status: 'Not started', notes: '', items: its.map(function (x) { return { lid: lid(), title: x, status: 'Not started', notes: '' }; }) });
        S.panel = ''; save(); render();
      }
      else if ((a('data-act') === 'reply' || a('data-act') === 'copy') && !S.name && !P.person) {   // group file: whose reply is this?
        var nmv = prompt('Your name (so ' + (P.by || 'they') + ' knows who this is from):', ''); if (nmv && nmv.trim()) { S.name = nmv.trim(); save(); el.click(); }
      }
      else if (a('data-act') === 'reply') download('Reply_' + fileName(S.name || P.label) + '_' + TODAY + '.txt', reply(), 'text/plain');
      else if (a('data-act') === 'copy') { var txt = reply(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { alert('Copied. Now paste it into an email or Teams message to ' + (P.by || 'me') + '.'); }, function () { showCopy(txt); }); }
      else if (a('data-act') === 'print') window.print();
      else if (a('data-act') === 'csv') download(fileName(P.label) + '_Tasks_' + TODAY + '.csv', csv(), 'text/csv');
    });
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t.getAttribute('data-note')) { var nk = t.getAttribute('data-note'); if (nk.indexOf('c:') === 0) setItem(nk.slice(2), 'notes', t.value); else { var o = find(nk); if (o) o.notes = t.value; } save(); }
      else if (t.id === 'msg') { S.msg = t.value; save(); }
      else if (t.id === 'nm') { S.name = t.value; save(); }
      else if (t.id === 'q') { S.q = t.value; save(); clearTimeout(window.__qt); window.__qt = setTimeout(function () { render(); var q = document.getElementById('q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('data-addin')) { var b = document.querySelector('[data-add="' + e.target.getAttribute('data-addin') + '"]'); if (b) b.click(); } });
    render();
  }

  /* ---------- scramble: the app + data are XOR-ed with a random key and base64-ed ---------- */
  function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); }
  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); }
  function scramble(text, key) { var u = utf8(text); for (var i = 0; i < u.length; i++) u[i] ^= key.charCodeAt(i % key.length); return b64(u); }
  function randKey() { var s = ''; for (var i = 0; i < 24; i++) s += String.fromCharCode(33 + Math.floor(Math.random() * 90)); return s.replace(/["\\]/g, 'x'); }
  function htmlEsc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* pack = { id, projectId, project, by, at (ISO), label, person, tasks:[{code, group, title, due, status, notes, subs:[{code, title, due, status, notes}]}] } */
  function build(pack) {
    var data = Object.assign({}, pack, { MARK: MARK });
    var src = runtime.toString();
    src = src.slice(src.indexOf('{') + 1, src.lastIndexOf('}'));
    var key = randKey(), blob = scramble(src + '\u0000' + JSON.stringify(data), key);
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Tasks — ' + htmlEsc(pack.label) + '</title></head><body>' +
      '<div id="app" style="font:16px system-ui;padding:24px">Opening your tasks…</div>' +
      '<noscript><p style="font:16px system-ui;padding:24px">Please open this file in Chrome or Edge.</p></noscript>' +
      '<script>(function(k,d){try{var b=atob(d),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i)^k.charCodeAt(i%k.length);' +
      'var s=new TextDecoder().decode(u),j=s.indexOf("\\u0000");new Function("P",s.slice(0,j))(JSON.parse(s.slice(j+1)));}' +
      'catch(e){document.getElementById("app").textContent="This file could not open. Please use Chrome or Edge, or ask for a new file.";}})(' +
      JSON.stringify(key) + ',"' + blob + '");</script></body></html>';
  }

  /* ---------- the reply that comes back (a .txt file or the pasted text) ---------- */
  function parseReply(text) {
    var i = String(text || '').indexOf(MARK);
    if (i < 0) throw new Error('This is not a Task Pack reply (no update code found).');
    var code = text.slice(i + MARK.length).replace(/[^A-Za-z0-9+/=]/g, '');
    var json;
    try {
      var bin = atob(code), u = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
      json = JSON.parse(new TextDecoder().decode(u));
    } catch (e) { throw new Error('The update code is damaged — ask them to send the reply file instead of copying it.'); }
    if (!json || json.kind !== 'lt-taskpack-reply' || !Array.isArray(json.rows)) throw new Error('This is not a Task Pack reply.');
    var clean = function (v) { return String(v == null ? '' : v).slice(0, 4000); };
    var rows = json.rows.slice(0, 5000).map(function (r) {
      return { id: clean(r.id), title: clean(r.title), group: '', assignees: '', due: /^\d{4}-\d{2}-\d{2}$/.test(r.due || '') ? r.due : '',
        status: clean(r.status), derived: !!r.derived, notes: r.notes == null ? null : clean(r.notes) };
    });
    return { meta: { exportId: json.pack, projectId: json.projectId, project: json.project, person: json.person, label: json.label, name: clean(json.name), message: clean(json.message), at: json.at }, rows: rows };
  }

  /* ---------- plain Excel: a table to copy by hand (can still be read back: ID / Status / Notes) ---------- */
  function simpleExcel(ExcelJS, plan) {
    var wb = new ExcelJS.Workbook();
    wb.creator = "Lew's Tracker"; wb.views = [{ x: 0, y: 0, width: 28800, height: 15000, firstSheet: 0, activeTab: 0 }];
    var ws = wb.addWorksheet('Tasks', { views: [{ state: 'frozen', ySplit: 3, xSplit: 0 }] });
    var cols = [['ID', 9], ['Task', 40], ['Item', 40], ['Assigned to', 18], ['Due date', 13], ['Status', 14], ['Notes', 44], ['Tower · Typology · Model', 42]];
    var thin = { style: 'thin', color: { argb: 'FFBFC5D2' } }, box = { top: thin, left: thin, bottom: thin, right: thin };
    var clean = function (v) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, ' ').slice(0, 32000); };
    var date = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
    ws.getCell('A1').value = clean('Tasks for ' + plan.scope + '  —  ' + plan.project + '  —  from ' + (plan.issuedBy || '') + ', ' + new Date(plan.issuedAt || Date.now()).toDateString().slice(4));
    ws.getCell('A1').font = { bold: true, size: 13 };
    cols.forEach(function (c, i) { var h = ws.getCell(3, i + 1); h.value = c[0]; h.font = { bold: true }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E9EF' } }; h.border = box; ws.getColumn(i + 1).width = c[1]; });
    var r = 4;
    var put = function (vals, bold) {
      vals.forEach(function (v, i) { var c = ws.getCell(r, i + 1); if (v !== '' && v != null) c.value = v; c.border = box; c.alignment = { vertical: 'top', wrapText: i === 1 || i === 2 || i === 6 }; if (bold && i < 3) c.font = { bold: true }; if (i === 4) c.numFmt = 'dd mmm yyyy'; });
      r++;
    };
    (plan.tasks || []).forEach(function (t) {
      put([clean(t.code), clean(t.title), '', clean(t.assignees), date(t.due), t.subs.length ? '' : clean(t.status), clean(t.notes)], true);
      t.subs.forEach(function (s) { put([clean(s.code), '', clean(s.title), clean(s.assignees), date(s.due || t.due), clean(s.status), clean(s.notes), clean(s.info)], false); });
    });
    return wb;
  }

  var api = { build: build, parseReply: parseReply, simpleExcel: simpleExcel, MARK: MARK };
  root.LTTaskPack = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
