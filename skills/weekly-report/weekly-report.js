/* ═══ SKILL (tool): Weekly report ══════════════════════════════════
   One printable page for the open project, last 7 days + next 7 days:
     • your To Do list — finished, overdue, coming up
     • team (Delegation) — progress per group, overdue, due next week
     • QA/QC — items, verified, open issues
     • MIDP — submissions sent this week, late drawings, coming up (by stage)
     • team per person — late, due this week / next week, done this week
   Opens in a new tab: Print → "Save as PDF", or 📋 Copy text for an email / Teams.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function k(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function nice(s) { if (!s) return ''; var d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); }

  function build(ctx) {
    var esc = ctx.esc, now = new Date(), today = k(now);
    var a = new Date(now); a.setDate(a.getDate() - 7); var from = k(a);
    var b = new Date(now); b.setDate(b.getDate() + 7); var to = k(b);
    var p = ctx.project(), T = ctx.tracker(), user = LT.user();
    var TXT = [];      // the plain-text version (📋 Copy text)
    var li = function (arr, f) { return arr.length ? '<ul>' + arr.map(f).join('') + '</ul>' : '<p class="none">None</p>'; };

    // 1. my tasks
    var tasks = ((T && T.tasks) || []);
    var doneWk = tasks.filter(function (t) { return t.status === 'done' && (t.completedAt || '') >= from; });
    var late = tasks.filter(function (t) { return t.status !== 'done' && t.due && t.due < today; });
    var soon = tasks.filter(function (t) { return t.status !== 'done' && t.due && t.due >= today && t.due <= to; }).sort(function (x, y) { return x.due.localeCompare(y.due); });
    TXT.push('MY TASKS: ' + doneWk.length + ' finished this week · ' + late.length + ' overdue · ' + soon.length + ' coming up');
    late.slice(0, 8).forEach(function (t) { TXT.push('  ! ' + t.title + ' (due ' + nice(t.due) + ')'); });
    var mine = '<h2>My tasks</h2><div class="kp"><span><b>' + doneWk.length + '</b> finished this week</span><span class="' + (late.length ? 'bad' : '') + '"><b>' + late.length + '</b> overdue</span><span><b>' + soon.length + '</b> due next 7 days</span></div>' +
      '<div class="cols"><div><h3>Finished</h3>' + li(doneWk, function (t) { return '<li>' + esc(t.title) + '</li>'; }) + '</div>' +
      '<div><h3>Overdue</h3>' + li(late, function (t) { return '<li>' + esc(t.title) + ' <i>' + nice(t.due) + '</i></li>'; }) + '</div>' +
      '<div><h3>Coming up</h3>' + li(soon, function (t) { return '<li>' + esc(t.title) + ' <i>' + nice(t.due) + '</i></li>'; }) + '</div></div>';

    // 2. team
    var team = '';
    var D = LT.isOn('delegate') ? ctx.delegation() : null;
    if (D && D.tasks && D.tasks.length) {
      var gname = function (id) { var g = (D.groups || []).filter(function (x) { return x.id === id; })[0]; return g ? g.name : 'No group'; };
      var val = function (s) { return s === 'Completed' ? 1 : s === 'In progress' ? 0.5 : 0; };
      var groups = {}, tl = [], ts = [];
      D.tasks.forEach(function (t) {
        var items = t.subs && t.subs.length ? t.subs.map(function (s) { return { code: s.code, title: t.title + ' › ' + s.title, who: s.assignees || t.assignees, due: s.due || t.due, st: s.status }; }) : [{ code: t.code, title: t.title, who: t.assignees, due: t.due, st: t.status }];
        var g = groups[gname(t.group)] = groups[gname(t.group)] || { n: 0, p: 0 };
        items.forEach(function (i) {
          g.n++; g.p += val(i.st);
          if (i.st !== 'Completed' && i.due && i.due < today) tl.push(i);
          else if (i.st !== 'Completed' && i.due && i.due <= to) ts.push(i);
        });
      });
      // per person: late · this week · next week · done this week
      var dk = function (d) { return k(d); }, n0 = new Date(today + 'T00:00:00'), mon = new Date(n0); mon.setDate(n0.getDate() - ((n0.getDay() + 6) % 7));
      var w0e = new Date(mon); w0e.setDate(mon.getDate() + 6); var w1e = new Date(mon); w1e.setDate(mon.getDate() + 13); var W0 = dk(mon), W0E = dk(w0e), W1E = dk(w1e);
      var ppl = {};
      D.tasks.forEach(function (t) {
        var units = t.subs && t.subs.length ? t.subs.map(function (x) { return { who: x.assignees || t.assignees, due: x.due || t.due, st: x.status, done: x.doneAt || '' }; }) : [{ who: t.assignees, due: t.due, st: t.status, done: t.doneAt || '' }];
        units.forEach(function (u) {
          String(u.who || '(no one)').split(/\s*[,;]\s*/).filter(Boolean).forEach(function (n) {
            var P = ppl[n] = ppl[n] || { late: 0, wk: 0, nx: 0, done: 0 };
            if (u.st === 'Completed') { if (u.done >= W0 && u.done <= W0E) P.done++; return; }
            if (!u.due) return; if (u.due < today) P.late++; else if (u.due <= W0E) P.wk++; else if (u.due <= W1E) P.nx++;
          });
        });
      });
      var pnames = Object.keys(ppl).sort(function (a, b) { var A = ppl[a], B = ppl[b]; return (B.late + B.wk + B.nx) - (A.late + A.wk + A.nx) || a.localeCompare(b); });
      TXT.push('', 'TEAM: ' + tl.length + ' overdue · ' + ts.length + ' due in the next 7 days');
      pnames.forEach(function (n) { var P = ppl[n]; if (P.late || P.wk || P.nx || P.done) TXT.push('  ' + n + ': ' + P.late + ' late · ' + P.wk + ' this week · ' + P.nx + ' next week · ' + P.done + ' done this week'); });
      var perPerson = pnames.length ? '<h3>Per person</h3><table><tr><th>Person</th><th>Late</th><th>Due this week</th><th>Next week</th><th>Done this week</th></tr>' +
        pnames.map(function (n) { var P = ppl[n]; return '<tr><td>' + esc(n) + '</td><td' + (P.late ? ' class="bad"' : '') + '>' + P.late + '</td><td>' + P.wk + '</td><td>' + P.nx + '</td><td>' + P.done + '</td></tr>'; }).join('') + '</table>' : '';
      team = '<h2>Team (Delegation)</h2><table><tr><th>Group</th><th>Items</th><th>Progress</th></tr>' +
        Object.keys(groups).sort().map(function (n) { var g = groups[n], pc = Math.round(g.p / g.n * 100); return '<tr><td>' + esc(n) + '</td><td>' + g.n + '</td><td><div class="bar"><i style="width:' + pc + '%"></i></div> ' + pc + '%</td></tr>'; }).join('') + '</table>' +
        '<div class="cols"><div><h3>Overdue</h3>' + li(tl, function (i) { return '<li><b>' + esc(i.code) + '</b> ' + esc(i.title) + ' — ' + esc(i.who || '?') + ' <i>' + nice(i.due) + '</i></li>'; }) + '</div>' +
        '<div><h3>Due next 7 days</h3>' + li(ts, function (i) { return '<li><b>' + esc(i.code) + '</b> ' + esc(i.title) + ' — ' + esc(i.who || '?') + ' <i>' + nice(i.due) + '</i></li>'; }) + '</div></div>';
      team += perPerson;
    }

    // 2b. MIDP — submissions, late, coming up
    var midp = '';
    var X = LT.readJSON('tidp-checker:index', null), ST = LT.readJSON('tidp-checker:tracker:v1', null);
    if (LT.isOn('tidp') && X && X.rows && X.rows.length) {
      var subs = ((ST && ST.subs) || []).filter(function (x) { return x.date && x.date >= from && x.date <= today; }).sort(function (x, y) { return x.date.localeCompare(y.date); });
      var rows = X.rows, lateR = rows.filter(function (r) { return r[13] === 'overdue'; }), sentAny = rows.filter(function (r) { return +r[16] > 0; }).length;
      var t14 = new Date(now); t14.setDate(t14.getDate() + 14); var to14 = k(t14), up = {};
      rows.forEach(function (r) { if (r[13] !== 'overdue' && r[14] && r[14] >= today && r[14] <= to14) { var key = r[14] + '|' + (r[15] || ''); up[key] = (up[key] || 0) + 1; } });
      var upk = Object.keys(up).sort();
      var byStage = {}; lateR.forEach(function (r) { var st2 = r[15] || 'Stage?'; byStage[st2] = (byStage[st2] || 0) + 1; });
      midp = '<h2>MIDP — ' + esc(X.file || 'drawings') + '</h2><div class="kp"><span><b>' + subs.length + '</b> submission' + (subs.length === 1 ? '' : 's') + ' this week</span><span><b>' + subs.reduce(function (a, x) { return a + (x.items || []).length; }, 0) + '</b> drawings sent</span>' +
        '<span class="' + (lateR.length ? 'bad' : '') + '"><b>' + lateR.length + '</b> late</span><span><b>' + sentAny + '</b> of ' + rows.length + ' sent at least once</span></div>' +
        '<div class="cols"><div><h3>Sent this week</h3>' + li(subs, function (x) { return '<li>' + nice(x.date) + ' · ' + esc(x.type || x.ref || '') + ' — ' + esc(x.file || '') + ' <i>' + (x.items || []).length + ' drawings</i></li>'; }) + '</div>' +
        '<div><h3>Late, by stage</h3>' + li(Object.keys(byStage).sort(), function (st2) { return '<li>' + esc(st2) + ' <i>' + byStage[st2] + ' drawings</i></li>'; }) + '</div>' +
        '<div><h3>Coming up (14 days)</h3>' + li(upk, function (kk) { var a2 = kk.split('|'); return '<li>' + nice(a2[0]) + ' · ' + esc(a2[1] || '') + ' <i>' + up[kk] + ' drawings</i></li>'; }) + '</div></div>';
      TXT.push('', 'MIDP (' + (X.file || '') + '): ' + subs.length + ' submission' + (subs.length === 1 ? '' : 's') + ' this week · ' + lateR.length + ' late · ' + sentAny + ' of ' + rows.length + ' sent at least once');
      subs.forEach(function (x) { TXT.push('  Sent ' + nice(x.date) + ': ' + (x.type || x.ref || '') + ' — ' + (x.items || []).length + ' drawings'); });
      upk.slice(0, 6).forEach(function (kk) { var a2 = kk.split('|'); TXT.push('  Due ' + nice(a2[0]) + ' (' + (a2[1] || '') + '): ' + up[kk] + ' drawings'); });
    }

    // 3. QA/QC
    var qa = '';
    var Q = LT.isOn('qaqc') ? ctx.qaqc() : null;
    var qp = Q && Q.projects && (Q.projects.filter(function (x) { return x.id === Q.activeId; })[0] || Q.projects[0]);
    if (qp && (qp.sheets || []).length) {
      var sh = qp.sheets.filter(function (s) { return !s.archived; }), st = function (s) { return typeof qaqcStatus === 'function' ? qaqcStatus(s) : (s.verified ? 'done' : 'todo'); };
      var issues = sh.filter(function (s) { return st(s) === 'issue'; }), ver = sh.filter(function (s) { return st(s) === 'done'; });
      TXT.push('', 'QA/QC (' + qp.name + '): ' + sh.length + ' items · ' + ver.length + ' verified · ' + issues.length + ' open issues');
      qa = '<h2>QA/QC — ' + esc(qp.name) + '</h2><div class="kp"><span><b>' + sh.length + '</b> items</span><span><b>' + ver.length + '</b> verified</span><span class="' + (issues.length ? 'bad' : '') + '"><b>' + issues.length + '</b> with issues</span></div>' +
        (issues.length ? '<h3>Open issues</h3>' + li(issues.slice(0, 15), function (s) { return '<li><b>' + esc(s.number || '') + '</b> ' + esc(s.title || '') + '</li>'; }) : '');
    }

    return '<!doctype html><html><head><meta charset="utf-8"><title>Weekly report — ' + esc(p.name) + '</title><style>' +
      'body{font:13px/1.45 Inter,Segoe UI,Arial,sans-serif;color:#1e221f;margin:28px;max-width:980px}h1{margin:0;font-size:22px}h2{margin:22px 0 8px;font-size:16px;border-bottom:2px solid #d8b76d;padding-bottom:4px}' +
      'h3{margin:8px 0 4px;font-size:13px;color:#5a6360}.sub{color:#5a6360;margin-bottom:6px}.kp{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}.kp span{border:1px solid #ddd;border-radius:10px;padding:6px 12px}.kp b{font-size:18px;margin-right:4px}.kp .bad b{color:#c0392b}' +
      '.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}ul{margin:0;padding-left:18px}li{margin:2px 0}i{color:#7a7f7a;font-style:normal}.none{color:#9aa;margin:0}' +
      'table{width:100%;border-collapse:collapse;margin:6px 0}th,td{text-align:left;border-bottom:1px solid #e5e5e5;padding:5px 8px}th{font-size:11px;text-transform:uppercase;color:#777}td.bad{color:#c62828;font-weight:700}textarea{font:12px/1.4 ui-monospace,monospace}' +
      '.bar{display:inline-block;width:140px;height:8px;background:#eee;border-radius:9px;vertical-align:middle;overflow:hidden}.bar i{display:block;height:100%;background:#7aa65f}' +
      '.noprint{margin-bottom:16px}@media print{.noprint{display:none}body{margin:12mm}}</style></head><body>' +
      '<div class="noprint"><button onclick="print()">🖨 Print / Save as PDF</button> <button onclick="var t=document.getElementById(\'wrTxt\');(navigator.clipboard?navigator.clipboard.writeText(t.value):Promise.reject()).then(function(){alert(\'Copied — paste it into your email or Teams\')},function(){t.hidden=false;t.select();document.execCommand(\'copy\');alert(\'Copied\')})">📋 Copy text</button></div>' +
      '<textarea id="wrTxt" hidden style="width:100%;height:220px">' + esc(['WEEKLY REPORT — ' + (p.code ? p.code + ' ' : '') + p.name, nice(from) + ' – ' + nice(to) + (user ? ' · ' + user : ''), ''].concat(TXT).join('\n')) + '</textarea>' +
      '<h1>Weekly report — ' + esc((p.code ? p.code + ' ' : '') + p.name) + '</h1><div class="sub">' + nice(from) + ' – ' + nice(to) + ' · prepared ' + esc(now.toLocaleString()) + (user ? ' by ' + esc(user) : '') + '</div>' +
      mine + team + midp + qa + '<p class="sub" style="margin-top:26px">Made with Lew’s Tracker — Weekly report skill.</p></body></html>';
  }

  LT.fn['weekly-report'] = {
    build: build,
    run: function (ctx) {
      var html = build(ctx);
      var w = window.open('', '_blank');
      if (!w) { ctx.download('Weekly_report_' + ctx.today() + '.html', new Blob([html], { type: 'text/html' })); ctx.toast('Pop-up blocked — downloaded the report instead'); return; }
      w.document.open(); w.document.write(html); w.document.close();
    }
  };
})();
