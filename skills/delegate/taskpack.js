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
      ':root{--ink:#14232b;--muted:#5d6f78;--line:#dde5e9;--bg:#eef3f5;--card:#fff;--acc:#0e7c86;--acc2:#0b3c49;--ok:#1f9d55;--okbg:#e3f5ea;--ip:#b7791f;--ipbg:#fdf3dc;--bad:#c0392b;--soft:#f5f9fa;--field:#fff}',
      '@media(prefers-color-scheme:dark){:root{--ink:#e4edf0;--muted:#93a6ae;--line:#2a3a42;--bg:#0f1a1f;--card:#16242b;--acc:#2bb3bd;--acc2:#0a2a33;--ok:#4cc77f;--okbg:#173527;--ip:#e0a93f;--ipbg:#3a2e14;--bad:#ff7a6b;--soft:#1b2c34;--field:#0f1a1f}}',
      '*{box-sizing:border-box}body{margin:0;font:15px/1.4 "Segoe UI",Calibri,system-ui,sans-serif;color:var(--ink);background:var(--bg)}',
      '.top{background:var(--acc2);color:#fff;padding:12px 16px 10px;position:sticky;top:0;z-index:5;box-shadow:0 2px 10px rgba(0,0,0,.15)}.top .in{max-width:900px;margin:0 auto}',
      '.top .r1{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.top h1{margin:0;font-size:18px;font-weight:700}.top .sub{opacity:.8;font-size:12.5px;width:100%}',
      '.top .prog{display:flex;align-items:center;gap:10px;font-size:13px;margin-top:8px}.bar{flex:1;height:8px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:#5fd38d;transition:width .3s}',
      '.top .pct{font-weight:700;font-size:15px}.top .late{background:#ff7a6b;color:#2b0b07;border-radius:99px;padding:0 8px;font-weight:700;font-size:12px}',
      '.wrap{max-width:900px;margin:0 auto;padding:12px 12px 96px}',
      '.help{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);border-radius:10px;padding:8px 12px;margin-bottom:10px;font-size:13.5px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.help span{flex:1 1 240px}',
      '.tb{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.tb input{flex:1 1 170px}.tb select{width:auto}',
      'input,textarea,select{font:inherit;color:inherit;border:1px solid var(--line);border-radius:9px;padding:7px 10px;background:var(--field);width:100%}textarea{min-height:36px;resize:vertical}',
      'button{font:inherit;cursor:pointer;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:6px 13px;font-weight:600;font-size:13.5px}button:hover{border-color:var(--acc)}',
      'button.main{background:var(--acc);border-color:var(--acc);color:#fff}button.chip.on{background:var(--acc);border-color:var(--acc);color:#fff}',
      '.top button{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.25);color:#fff}.top button.main{background:#5fd38d;border-color:#5fd38d;color:#0b3c49}',
      '.card{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)}',
      '.ch{padding:10px 12px;display:grid;grid-template-columns:auto 1fr auto;gap:2px 10px;align-items:center;cursor:pointer;user-select:none}.ch:hover{background:var(--soft)}',
      '.fold{font-size:12px;color:var(--muted);width:14px}.ch .tt{min-width:0}.ch b{font-size:15.5px}.code{font:700 11.5px Consolas,monospace;color:var(--acc);margin-right:6px}',
      '.ch .m2{display:flex;gap:10px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin-top:2px}.ch .m2 .late{color:var(--bad);font-weight:700}',
      '.ch .rt{display:flex;align-items:center;gap:8px}.mini{width:70px;height:6px;background:var(--line);border-radius:99px;overflow:hidden}.mini i{display:block;height:100%;background:var(--ok)}.cnt{font-size:12.5px;font-weight:700;color:var(--muted);white-space:nowrap}',
      '.card.alldone .ch b{color:var(--ok)}.allbtn{padding:3px 10px;font-size:12px}',
      '.lew{padding:6px 12px 6px 36px;font-size:13px;color:var(--muted);background:var(--soft);border-top:1px solid var(--line)}',
      '.it{padding:8px 12px;border-top:1px solid var(--line);display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;align-items:start}',
      '.ck{width:26px;height:26px;border-radius:8px;border:2px solid #9fb3bc;background:var(--field);padding:0;font-size:16px;line-height:1;color:#fff;margin-top:1px}.ck:hover{border-color:var(--ok)}',
      '.it.done .ck{background:var(--ok);border-color:var(--ok)}.it.doing .ck{border-color:var(--ip);background:var(--ipbg)}',
      '.it .nm{min-width:0}.it .ttl{font-weight:600}.it.done .ttl{text-decoration:line-through;color:var(--muted);font-weight:500}',
      '.meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:3px;font-size:12px}.meta span{border-radius:99px;padding:1px 8px;background:var(--soft);color:var(--muted);white-space:nowrap}',
      '.meta .who{background:#e0f2f3;color:#0b5c63;font-weight:700}.meta .who.inh{font-weight:500;opacity:.8}.meta .late{background:#fde4e1;color:var(--bad);font-weight:700}.meta .doing{background:var(--ipbg);color:var(--ip);font-weight:700}',
      '@media(prefers-color-scheme:dark){.meta .who{background:#123c42;color:#8fe0e6}.meta .late{background:#3d1a16}}',
      '.it em{display:block;font-size:12.5px;color:var(--muted);margin-top:3px;font-style:normal}',
      '.tools{display:flex;gap:4px;align-items:center}.dg{padding:3px 9px;font-size:12px;color:var(--muted)}.dg.on{background:var(--ipbg);border-color:var(--ip);color:var(--ip)}',
      '.ib{border:0;background:none;padding:3px 6px;font-size:15px;color:var(--muted)}.ib.has{color:var(--acc)}.ib.x{color:var(--bad);font-size:17px}',
      '.it textarea{grid-column:2/-1;font-size:13.5px}.new{background:var(--soft)}.tag{font-size:10.5px;font-weight:700;color:var(--acc);border:1px solid var(--acc);border-radius:99px;padding:0 6px;margin-left:6px;vertical-align:1px}',
      '.add{padding:7px 12px 9px 50px;border-top:1px dashed var(--line);display:flex;gap:6px}.add input{flex:1;padding:5px 10px;font-size:13.5px;border-style:dashed}.add button{padding:3px 11px;font-size:13px}',
      '.panel{padding:12px;display:grid;gap:8px}.lbl{font-size:12.5px;color:var(--muted)}',
      '.foot{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:8px 12px;box-shadow:0 -2px 12px rgba(0,0,0,.08)}.foot .in{max-width:900px;margin:0 auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.foot .hint{font-size:12.5px;color:var(--muted);flex:1 1 200px}',
      '.saved{color:var(--ok)}.saved.no{color:var(--bad)}.empty{padding:20px;text-align:center;color:var(--muted)}',
      '.modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:9}.modal .box{background:var(--card);border-radius:14px;padding:16px;max-width:560px;width:100%}.modal textarea{min-height:160px;font:12px Consolas,monospace}',
      '@media(max-width:600px){.it{grid-template-columns:auto 1fr}.it .tools{grid-column:2;justify-content:flex-start}.ch{grid-template-columns:auto 1fr}.ch .rt{grid-column:2}.add{padding-left:12px}.top h1{font-size:16px}}',
      '@media print{.top{position:static;background:#fff;color:#000;box-shadow:none}.top button,.foot,.help,.tb,.add,.tools,.panelcard,.allbtn{display:none!important}.it textarea{display:none}.wrap{padding-bottom:0}.card{break-inside:avoid;box-shadow:none}.ck{border-color:#555}}'
    ].join('\n');
    document.head.appendChild(css);
    document.title = 'Tasks — ' + (P.label || P.person || '');

    var OPEN = {};
    S.fold = S.fold || {};
    function names(s) { return String(s || '').split(/[,;&\/]+| and /i).map(function (x) { return x.trim(); }).filter(Boolean); }
    function whoOf(l) {
      if (l.n) return { v: '', inh: false };
      if (l.base !== l.t && l.base.assignees) return { v: l.base.assignees, inh: false };
      return { v: l.t.assignees || '', inh: l.base !== l.t };
    }
    var PEOPLE = (function () { var o = {}; P.tasks.forEach(function (t) { names(t.assignees).forEach(function (n) { o[n] = 1; }); t.subs.forEach(function (s) { names(s.assignees).forEach(function (n) { o[n] = 1; }); }); }); return Object.keys(o).sort(); })();
    function itemHtml(l) {
      var key = l.n ? 'n:' + l.n.lid : 'c:' + l.code, st = stOf(l), notes = l.n ? l.n.notes : cur(l.code, l.base).notes;
      var title = l.n ? l.n.title : (l.base === l.t ? 'Whole task — tick when finished' : l.base.title), lt = late(l), w = whoOf(l), done = st === 'Completed', doing = st === 'In progress';
      return '<div class="it' + (done ? ' done' : '') + (doing ? ' doing' : '') + (l.n ? ' new' : '') + '">' +
        '<button class="ck" data-ck="' + key + '" title="' + (done ? 'Untick' : 'Tick when done') + '" aria-label="Done">' + (done ? '✓' : '') + '</button>' +
        '<div class="nm"><span class="ttl">' + esc(title) + '</span>' + (l.n ? '<span class="tag">NEW</span>' : '') +
        '<div class="meta">' + (w.v ? '<span class="who' + (w.inh ? ' inh' : '') + '">👤 ' + esc(w.v) + '</span>' : '') +
        (doing ? '<span class="doing">◐ Doing</span>' : '') +
        (l.due ? '<span class="' + (lt ? 'late' : '') + '">📅 ' + (lt ? 'overdue · ' : '') + esc(fmt(l.due)) + '</span>' : '') +
        (!l.n && l.base && l.base.info ? '<span>' + esc(l.base.info) + '</span>' : '') + '</div>' +
        (notes && !OPEN[key] ? '<em>✎ ' + esc(notes) + '</em>' : '') + '</div>' +
        '<div class="tools">' + (done ? '' : '<button class="dg' + (doing ? ' on' : '') + '" data-st="' + key + '" data-v="' + (doing ? 'Not started' : 'In progress') + '" title="Mark as working on it">◐ Doing</button>') +
        '<button class="ib' + (notes ? ' has' : '') + '" data-noteopen="' + key + '" title="' + (notes ? 'Edit note' : 'Add a note') + '">✎</button>' +
        (l.n ? '<button class="ib x" data-del="' + key + '" title="Remove">×</button>' : '') + '</div>' +
        (OPEN[key] ? '<textarea data-note="' + key + '" placeholder="Your note…">' + esc(notes) + '</textarea>' : '') + '</div>';
    }
    function match(l) {
      var q = (S.q || '').toLowerCase(), st = stOf(l);
      if (S.filter === 'open' && st === 'Completed') return false;
      if (S.filter === 'done' && st !== 'Completed') return false;
      if (S.who && !l.n) { var w = whoOf(l).v; if (!names(w).some(function (n) { return n.toLowerCase() === S.who.toLowerCase(); })) return false; }
      if (q) { var h = [(l.t || l.nt).title, l.n ? l.n.title : l.base.title, l.code || '', l.n ? '' : whoOf(l).v, l.base && l.base.info || ''].join(' ').toLowerCase(); if (h.indexOf(q) < 0) return false; }
      return true;
    }
    function cardHead(key, code, title, sub, dn, n, tlate, extra) {
      var pct = n ? Math.round(dn / n * 100) : 0;
      return '<div class="ch" data-fold="' + esc(key) + '"><span class="fold">' + (S.fold[key] ? '▸' : '▾') + '</span><div class="tt">' + (code ? '<span class="code">' + esc(code) + '</span>' : '') + '<b>' + esc(title) + '</b>' +
        '<div class="m2">' + sub + '</div></div><div class="rt">' + extra + '<span class="cnt">' + dn + '/' + n + '</span><span class="mini"><i style="width:' + pct + '%"></i></span></div></div>';
    }
    function render() {
      var all = lines(), done = all.filter(function (l) { return stOf(l) === 'Completed'; }).length, lateN = all.filter(late).length;
      var pct = all.length ? Math.round(done / all.length * 100) : 0;
      var h = '<div class="top"><div class="in"><div class="r1"><h1>✅ ' + esc(P.label || 'Tasks') + '</h1><span style="flex:1"></span><button class="main" data-act="reply" title="Save your progress as a small file and send it back">📤 Send reply</button></div>' +
        '<div class="sub">' + esc(P.project) + ' · from ' + esc(P.by || '—') + ' · ' + esc(fmt(P.at)) + '</div>' +
        '<div class="prog"><span class="pct">' + pct + '%</span><div class="bar"><i style="width:' + pct + '%"></i></div><span>' + done + ' of ' + all.length + ' done</span>' + (lateN ? '<span class="late">' + lateN + ' overdue</span>' : '') + '</div></div></div><div class="wrap">';
      if (S.help) h += '<div class="help"><span>👋 <b>Tick ☐</b> each item when it is done · <b>◐ Doing</b> = working on it · <b>✎</b> = add a note · when finished press <b>📤 Send reply</b> and send the file to ' + esc(P.by || 'me') + '.</span><button data-help="0">Got it</button></div>';
      h += '<div class="tb"><input id="q" placeholder="🔍 Search items, names, towers…" value="' + esc(S.q) + '">' + [['all', 'All'], ['open', 'To do'], ['done', 'Done']].map(function (f) { return '<button class="chip' + (S.filter === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
        (PEOPLE.length > 1 ? '<select id="who" title="Show one person’s items"><option value="">👥 Everyone</option>' + PEOPLE.map(function (n) { return '<option' + (S.who === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' : '') +
        '<button class="chip panelbtn' + (S.panel === 'task' ? ' on' : '') + '" data-panel="task">+ New task</button><button class="chip panelbtn' + (S.panel === 'msg' ? ' on' : '') + '" data-panel="msg">💬 Message' + (S.msg ? ' ✓' : '') + '</button></div>';
      if (S.panel === 'task') h += '<div class="card panelcard"><div class="panel"><input id="ntT" placeholder="Task name — something extra you are working on"><textarea id="ntI" placeholder="Items — one per line (optional)"></textarea>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="lbl">Target date</span><input id="ntD" type="date" style="width:auto"><button class="main" data-newtask="1">Add task</button></div></div></div>';
      if (S.panel === 'msg') h += '<div class="card panelcard"><div class="panel"><input id="nm" placeholder="Your name" value="' + esc(S.name) + '"><textarea id="msg" placeholder="Anything to tell ' + esc(P.by || 'me') + '? (goes with your reply)">' + esc(S.msg) + '</textarea></div></div>';
      var shown = 0;
      P.tasks.forEach(function (t) {
        var mine = all.filter(function (l) { return l.t === t; }), ls = mine.filter(match);
        if (!ls.length && (S.q || S.filter !== 'all' || S.who)) return;
        shown++;
        var dn = mine.filter(function (l) { return stOf(l) === 'Completed'; }).length, tlate = t.due && t.due < TODAY && dn < mine.length, fk = 'c:' + t.code;
        var sub = (t.assignees ? '<span>👤 ' + esc(t.assignees) + '</span>' : '') + (t.group ? '<span>👥 ' + esc(t.group) + '</span>' : '') + (t.due ? '<span class="' + (tlate ? 'late' : '') + '">📅 ' + (tlate ? 'overdue · ' : 'due ') + esc(fmt(t.due)) + '</span>' : '');
        var open = ls.filter(function (l) { return stOf(l) !== 'Completed' && !l.n; }).length;
        h += '<div class="card' + (dn === mine.length && mine.length ? ' alldone' : '') + '">' + cardHead(fk, t.code, t.title, sub, dn, mine.length, tlate, open > 1 && !S.fold[fk] ? '<button class="allbtn" data-all="' + esc(t.code) + '" title="Tick every item shown in this task">✓ All</button>' : '') +
          (S.fold[fk] ? '' : (t.notes ? '<div class="lew">📝 ' + esc(t.notes) + '</div>' : '') + ls.map(itemHtml).join('') +
          '<div class="add"><input data-addin="' + esc(t.code) + '" placeholder="+ add an item…"><button data-add="' + esc(t.code) + '">Add</button></div>') + '</div>';
      });
      S.newTasks.forEach(function (nt) {
        var ls = all.filter(function (l) { return l.nt === nt && match(l); }), dn = ls.filter(function (l) { return stOf(l) === 'Completed'; }).length, fk = 't:' + nt.lid;
        shown++;
        h += '<div class="card">' + cardHead(fk, '', nt.title, '<span class="tag" style="margin:0">NEW TASK</span>' + (nt.due ? '<span>📅 due ' + esc(fmt(nt.due)) + '</span>' : ''), dn, ls.length, false, '<button class="ib x" data-delt="' + nt.lid + '" title="Remove this new task">×</button>') +
          (S.fold[fk] ? '' : ls.map(itemHtml).join('') + '<div class="add"><input data-addin="t:' + nt.lid + '" placeholder="+ add an item…"><button data-add="t:' + nt.lid + '">Add</button></div>') + '</div>';
      });
      if (!shown) h += '<div class="card empty">Nothing here — change the search or filter.</div>';
      h += '</div><div class="foot"><div class="in"><span class="hint"><span class="saved' + (saveOk ? '' : ' no') + '">' + (saveOk ? '✓ Saved on this computer' : '⚠ Not saved — send a reply now') + '</span> · your ticks stay when you close the file</span>' +
        '<button class="main" data-act="reply">📤 Send reply</button><button data-act="copy" title="Copy the reply to paste in an email or Teams">📋 Copy</button><button data-act="print" title="Print">🖨</button><button data-act="csv" title="Download as Excel (CSV)">⬇ Excel</button></div></div>';
      document.getElementById('app').innerHTML = h;
    }
    function setSt(k, v) { if (k.indexOf('c:') === 0) setItem(k.slice(2), 'status', v); else { var o = find(k); if (o) o.status = v; } }
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
      var rows = [['ID', 'Task', 'Item', 'Assigned to', 'Due date', 'Status', 'Notes', 'Tower · Typology · Model']];
      lines().forEach(function (l) {
        var st = stOf(l), notes = l.n ? l.n.notes : cur(l.code, l.base).notes, task = (l.t || l.nt).title;
        var item = l.n ? (l.nt && l.n === l.nt ? '' : l.n.title) : (l.base === l.t ? '' : l.base.title);
        rows.push([l.code || 'NEW', task, item, l.n ? '' : whoOf(l).v, l.due || '', st, notes || '', !l.n && l.base && l.base.info || '']);
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
      var hd = e.target.closest('[data-fold]');
      if (hd && !e.target.closest('button')) { var fk = hd.getAttribute('data-fold'); S.fold[fk] = !S.fold[fk]; save(); render(); return; }
      var el = e.target.closest('button'); if (!el) return;
      var a = function (k) { return el.getAttribute(k); };
      if (a('data-ck')) { var ck = a('data-ck'), on = el.closest('.it').classList.contains('done'); setSt(ck, on ? 'Not started' : 'Completed'); save(); render(); }
      else if (a('data-all')) { var tc = a('data-all'); lines().filter(function (l) { return l.t && l.t.code === tc && match(l); }).forEach(function (l) { setSt(l.n ? 'n:' + l.n.lid : 'c:' + l.code, 'Completed'); }); save(); render(); }
      else if (a('data-st')) { setSt(a('data-st'), a('data-v')); save(); render(); }
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
      else if (a('data-act') === 'reply') download('Reply_' + fileName(S.name || P.label) + '_' + TODAY + '_' + (function () { var d = new Date(); return String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); })() + '.txt', reply(), 'text/plain');
      else if (a('data-act') === 'copy') { var txt = reply(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { alert('Copied. Now paste it into an email or Teams message to ' + (P.by || 'me') + '.'); }, function () { showCopy(txt); }); }
      else if (a('data-act') === 'print') window.print();
      else if (a('data-act') === 'csv') download(fileName(P.label) + '_Tasks_' + TODAY + '.csv', csv(), 'text/csv');
    });
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t.getAttribute('data-note')) { var nk = t.getAttribute('data-note'); if (nk.indexOf('c:') === 0) setItem(nk.slice(2), 'notes', t.value); else { var o = find(nk); if (o) o.notes = t.value; } save(); }
      else if (t.id === 'msg') { S.msg = t.value; save(); }
      else if (t.id === 'nm') { S.name = t.value; save(); }
      else if (t.id === 'who') { S.who = t.value; save(); render(); }
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
